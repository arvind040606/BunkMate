import { Subject, AttendanceRecord, AppPreferences, NotificationItem, AnalyticsSummary, Exam, Assignment } from '../types';
import { sqliteService } from '../database/sqlite';
import { NotificationService } from './notificationService';
import { appPreferencesStore } from './preferences';

// Default Preferences
const DEFAULT_PREFS: AppPreferences = {
  globalTarget: 75,
  hapticsEnabled: true,
  notificationsEnabled: true,
  pinLockEnabled: false,
  soundEnabled: true,
  weekendClassesEnabled: true,
  activeNotificationDays: [0, 1, 2, 3, 4, 5, 6], // Sunday-Saturday active by default
  examRemindersEnabled: true,
  assignmentDeadlinesEnabled: true,
  appUpdatesEnabled: true,
  manualRemindersEnabled: true,
  collegeStartTime: '09:00',
  collegeEndTime: '17:00',
  dailyClassRemindersEnabled: true,
  displayName: '',
  avatarId: 'grad_indigo',
  major: '',
  semester: '',
  collegeName: '',
  course: '',
  section: '',
  group: '',
  profilePrompted: false,
};

// In-Memory synchronous cache synchronized with SQLite
interface DatabaseCache {
  prefs: AppPreferences;
  subjects: Subject[];
  records: AttendanceRecord[];
  notifications: NotificationItem[];
  exams: Exam[];
  assignments: Assignment[];
}

const cache: DatabaseCache = {
  prefs: { ...DEFAULT_PREFS },
  subjects: [],
  records: [],
  notifications: [],
  exams: [],
  assignments: [],
};

let settingsUpdatedAtCache: Record<string, number> = {};

function getNextMutationTimestamp(): number {
  return Math.max(Date.now(), (cache.prefs.syncLastSynced || 0) + 1000);
}

// Log deletion helper for Cloud Sync tombstones
async function logDeletion(tableName: string, recordId: string) {
  try {
    const id = `del-${tableName}-${recordId}-${Date.now()}`;
    await sqliteService.executeSql(
      'INSERT OR REPLACE INTO sync_deletions (id, tableName, recordId, deletedAt) VALUES (?, ?, ?, ?)',
      [id, tableName, recordId, getNextMutationTimestamp()],
      false
    );
  } catch (err) {
    console.error('Failed to log deletion:', err);
  }
}

// DB Operations Bridged to SQLite
export const db = {
  isInitialized: false,
  listeners: [] as (() => void)[],

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  },

  notify() {
    this.listeners.forEach(l => {
      try {
        l();
      } catch (err) {
        console.error('Error notifying listener:', err);
      }
    });

    // Automatically debounce rescheduling of all local notifications when database changes
    NotificationService.debounceReschedule(
      cache.prefs,
      cache.subjects,
      cache.records,
      cache.exams,
      cache.assignments
    );
  },

  // INITIALIZE CACHE FROM SQLite
  async init(): Promise<void> {
    try {
      // Sanitize null/missing/legacy updatedAt values for proper synchronization
      const nowTs = Date.now();
      const tablesToSanitize = ['Subjects', 'Timetable', 'Attendance', 'Exams', 'Assignments', 'Settings'];
      for (const table of tablesToSanitize) {
        await sqliteService.executeSql(
          `UPDATE ${table} SET updatedAt = ? WHERE updatedAt IS NULL OR updatedAt = '' OR updatedAt = 0 OR updatedAt = '0'`,
          [nowTs],
          false
        ).catch(err => console.warn(`Failed to sanitize table ${table}:`, err));
      }

      // Clean up legacy settings rows with corrupted/duplicate IDs
      await sqliteService.executeSql(
        "DELETE FROM Settings WHERE id != 'settings-' || key"
      ).catch(err => console.warn('Failed to clean up duplicate legacy settings rows:', err));

      // Execute all SELECT queries in parallel for peak performance
      const [
        settingsRes,
        subjectsRes,
        timetableRes,
        recordsRes,
        notifRes,
        examsRes,
        assignmentsRes
      ] = await Promise.all([
        sqliteService.executeSql('SELECT * FROM Settings'),
        sqliteService.executeSql('SELECT * FROM Subjects'),
        sqliteService.executeSql('SELECT * FROM Timetable'),
        sqliteService.executeSql('SELECT * FROM Attendance'),
        sqliteService.executeSql('SELECT * FROM Notifications ORDER BY timestamp DESC LIMIT 100'),
        sqliteService.executeSql('SELECT * FROM Exams'),
        sqliteService.executeSql('SELECT * FROM Assignments')
      ]);

      // Parse Settings
      const loadedPrefs: any = { ...DEFAULT_PREFS };
      const PREFS_KEYS = [
        ...Object.keys(DEFAULT_PREFS),
        'syncEnabled',
        'syncUsername',
        'syncToken',
        'syncUserId',
        'syncLastSynced',
        'syncLastSyncedLocal',
        'syncSessionExpired',
        'lastLoggedUserId',
        'syncDatabaseMode'
      ];
      PREFS_KEYS.forEach(key => {
        const storedVal = appPreferencesStore.getItem(key);
        if (storedVal !== null) {
          try {
            loadedPrefs[key] = JSON.parse(storedVal);
          } catch {
            loadedPrefs[key] = storedVal;
          }
        }
      });

      const settingsRows = settingsRes.rows._array;
      settingsRows.forEach((row: any) => {
        settingsUpdatedAtCache[row.key] = row.updatedAt ? Number(row.updatedAt) : Date.now();
        try {
          loadedPrefs[row.key] = JSON.parse(row.value);
        } catch {
          loadedPrefs[row.key] = row.value;
        }
      });

      // Normalize activeNotificationDays to be an array of numbers
      if (loadedPrefs.activeNotificationDays) {
        if (typeof loadedPrefs.activeNotificationDays === 'string') {
          loadedPrefs.activeNotificationDays = loadedPrefs.activeNotificationDays
            .split(',')
            .map((x: string) => parseInt(x.trim(), 10))
            .filter((x: number) => !isNaN(x));
        } else if (!Array.isArray(loadedPrefs.activeNotificationDays)) {
          loadedPrefs.activeNotificationDays = [0, 1, 2, 3, 4, 5, 6];
        }
      } else {
        loadedPrefs.activeNotificationDays = [0, 1, 2, 3, 4, 5, 6];
      }

      cache.prefs = loadedPrefs;

      // Parse Subjects & Timetable
      const subjectsRows = subjectsRes.rows._array;
      const timetableRows = timetableRes.rows._array;

      const schedulesBySubject: { [subjId: string]: any[] } = {};
      timetableRows.forEach((row: any) => {
        const entry = {
          id: row.id,
          dayOfWeek: Number(row.dayOfWeek),
          time: row.time,
          duration: row.duration ? Number(row.duration) : undefined
        };
        if (!schedulesBySubject[row.subjectId]) {
          schedulesBySubject[row.subjectId] = [];
        }
        schedulesBySubject[row.subjectId].push(entry);
      });

      cache.subjects = subjectsRows.map((row: any) => ({
        id: row.id,
        name: row.name,
        code: row.code || '',
        room: row.room || undefined,
        teacher: row.teacher || undefined,
        color: row.color,
        targetPercentage: Number(row.targetPercentage || 75),
        isPinned: row.isPinned === 1,
        isArchived: row.isArchived === 1,
        icon: row.icon || undefined,
        notes: row.notes || undefined,
        initialPresent: row.initialPresent ? Number(row.initialPresent) : 0,
        initialAbsent: row.initialAbsent ? Number(row.initialAbsent) : 0,
        schedule: schedulesBySubject[row.id] || []
      }));

      // Parse Records
      cache.records = recordsRes.rows._array.map((row: any) => ({
        id: row.id,
        subjectId: row.subjectId,
        date: row.date,
        status: row.status as any,
        timestamp: Number(row.timestamp)
      }));

      // Parse Notifications
      cache.notifications = notifRes.rows._array.map((row: any) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        timestamp: Number(row.timestamp),
        type: row.type as any,
        read: row.read === 1
      }));

      // Parse Exams
      cache.exams = examsRes.rows._array.map((row: any) => ({
        id: row.id,
        subjectId: row.subjectId,
        title: row.title,
        date: row.date,
        time: row.time || undefined,
        syllabus: row.syllabus || undefined,
        room: row.room || undefined,
        completed: row.completed === 1
      }));

      // Parse Assignments
      cache.assignments = assignmentsRes.rows._array.map((row: any) => ({
        id: row.id,
        subjectId: row.subjectId,
        title: row.title,
        dueDate: row.dueDate,
        dueTime: row.dueTime || undefined,
        description: row.description || undefined,
        status: row.status as any
      }));

      this.isInitialized = true;
      console.log('BunkMate Cache synchronized with genuine SQLite Database.');
      this.notify();
    } catch (err) {
      console.warn('Failed to pre-load BunkMate cache, proceeding with defaults:', err);
      this.isInitialized = true;
      this.notify();
    }
  },

  // CLEAR SETTINGS CACHE
  clearSettingsCache(): void {
    settingsUpdatedAtCache = {};
  },

  // GET PREFERENCES
  getPrefs(): AppPreferences {
    return cache.prefs;
  },

  savePrefs(prefs: AppPreferences, silent = false, isLoginReset = false): Promise<void> {
    const prevPrefs = { ...cache.prefs };
    cache.prefs = prefs;

    return new Promise<void>((resolve, reject) => {
      const runAsyncSave = async () => {
        try {
          const nextUpdatedAt = getNextMutationTimestamp();
          const SYNC_KEYS = [
            'syncEnabled',
            'syncUsername',
            'syncToken',
            'syncUserId',
            'syncLastSynced',
            'syncLastSyncedLocal',
            'syncSessionExpired',
            'lastLoggedUserId',
            'syncDatabaseMode'
          ];

          for (const [key, val] of Object.entries(prefs)) {
            // If this is a login reset, only write the sync keys to SQLite, skipping academic/general settings
            if (isLoginReset && !SYNC_KEYS.includes(key)) {
              continue;
            }

            // Sync with appPreferencesStore for cross-session web compatibility
            if (val === undefined || val === null) {
              appPreferencesStore.removeItem(key);
            } else {
              appPreferencesStore.setItem(key, JSON.stringify(val));
            }

            const prevVal = prevPrefs[key as keyof AppPreferences];
            const hasChanged = JSON.stringify(val) !== JSON.stringify(prevVal);

            if (val === undefined || val === null) {
              await sqliteService.executeSql(
                'DELETE FROM Settings WHERE key = ?',
                [key]
              );
              delete settingsUpdatedAtCache[key];
            } else {
              let uAt = settingsUpdatedAtCache[key];
              if (hasChanged || !uAt) {
                uAt = nextUpdatedAt;
                settingsUpdatedAtCache[key] = uAt;
              }
              await sqliteService.executeSql(
                'INSERT OR REPLACE INTO Settings (id, key, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
                [`settings-${key}`, key, JSON.stringify(val), new Date().toISOString(), uAt]
              );
            }
          }
          resolve();
        } catch (err) {
          console.error('Failed to save settings to SQLite:', err);
          reject(err);
        } finally {
          if (!silent) {
            this.notify();
          }
        }
      };
      runAsyncSave();
    });
  },

  // GET SUBJECTS
  getSubjects(): Subject[] {
    return cache.subjects;
  },

  // SAVE SUBJECTS
  saveSubjects(subjects: Subject[]): void {
    cache.subjects = subjects;

    const runAsyncSave = async () => {
      try {
        const [dbSubRes, dbTimeRes] = await Promise.all([
          sqliteService.executeSql('SELECT id FROM Subjects'),
          sqliteService.executeSql('SELECT id, subjectId FROM Timetable')
        ]);
        
        const dbSubIds = dbSubRes.rows._array.map((row: any) => row.id);
        const dbTimeEntries = dbTimeRes.rows._array;
        
        const newSubIds = subjects.map(s => s.id);
        const newTimeIds = subjects.flatMap(s => (s.schedule || []).map(entry => entry.id));

        // Delete subjects no longer in the list
        const subsToDelete = dbSubIds.filter(id => !newSubIds.includes(id));
        if (subsToDelete.length > 0) {
          const placeholders = subsToDelete.map(() => '?').join(',');
          await sqliteService.executeSql(`DELETE FROM Subjects WHERE id IN (${placeholders})`, subsToDelete);
          for (const id of subsToDelete) {
            await logDeletion('subjects', id);
          }
        }

        // Delete timetable entries no longer in the list or belonging to deleted subjects
        const timeToDelete = dbTimeEntries
          .filter((row: any) => !newTimeIds.includes(row.id) || subsToDelete.includes(row.subjectId))
          .map((row: any) => row.id);
        if (timeToDelete.length > 0) {
          const placeholders = timeToDelete.map(() => '?').join(',');
          await sqliteService.executeSql(`DELETE FROM Timetable WHERE id IN (${placeholders})`, timeToDelete);
          for (const id of timeToDelete) {
            await logDeletion('timetable', id);
          }
        }

        const nextUpdatedAt = getNextMutationTimestamp();
        for (const sub of subjects) {
          await sqliteService.executeSql(
            `INSERT OR REPLACE INTO Subjects (
              id, name, code, room, teacher, color, targetPercentage, isPinned, isArchived, icon, notes, initialPresent, initialAbsent, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sub.id,
              sub.name,
              sub.code || '',
              sub.room || '',
              sub.teacher || '',
              sub.color,
              sub.targetPercentage,
              sub.isPinned ? 1 : 0,
              sub.isArchived ? 1 : 0,
              sub.icon || '',
              sub.notes || '',
              sub.initialPresent || 0,
              sub.initialAbsent || 0,
              new Date().toISOString(),
              nextUpdatedAt
            ]
          );

          if (sub.schedule && Array.isArray(sub.schedule)) {
            for (const entry of sub.schedule) {
              await sqliteService.executeSql(
                'INSERT OR REPLACE INTO Timetable (id, subjectId, dayOfWeek, time, duration, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [
                  entry.id || `entry-${Date.now()}-${Math.random()}`,
                  sub.id,
                  entry.dayOfWeek,
                  entry.time,
                  entry.duration || 60,
                  new Date().toISOString(),
                  nextUpdatedAt
                ]
              );
            }
          }
        }
      } catch (err) {
        console.error('Failed to save subjects to SQLite:', err);
      } finally {
        this.notify();
      }
    };
    runAsyncSave();
  },

  // GET ATTENDANCE RECORDS
  getRecords(): AttendanceRecord[] {
    return cache.records;
  },

  // SAVE ATTENDANCE RECORDS
  saveRecords(records: AttendanceRecord[]): void {
    cache.records = records;

    const runAsyncSave = async () => {
      try {
        const dbRes = await sqliteService.executeSql('SELECT id FROM Attendance');
        const dbIds = dbRes.rows._array.map((row: any) => row.id);
        const newIds = records.map(r => r.id);

        const toDelete = dbIds.filter(id => !newIds.includes(id));
        if (toDelete.length > 0) {
          const placeholders = toDelete.map(() => '?').join(',');
          await sqliteService.executeSql(`DELETE FROM Attendance WHERE id IN (${placeholders})`, toDelete);
          for (const id of toDelete) {
            await logDeletion('attendance', id);
          }
        }

        const nextUpdatedAt = getNextMutationTimestamp();
        for (const r of records) {
          await sqliteService.executeSql(
            'INSERT OR REPLACE INTO Attendance (id, subjectId, date, status, timestamp, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              r.id,
              r.subjectId,
              r.date,
              r.status,
              r.timestamp,
              new Date().toISOString(),
              nextUpdatedAt
            ]
          );
        }
      } catch (err) {
        console.error('Failed to save records to SQLite:', err);
      } finally {
        this.notify();
      }
    };
    runAsyncSave();
  },

  // GET NOTIFICATIONS
  getNotifications(): NotificationItem[] {
    return cache.notifications;
  },

  // SAVE NOTIFICATIONS
  saveNotifications(notifs: NotificationItem[]): void {
    cache.notifications = notifs;

    const runAsyncSave = async () => {
      try {
        const dbRes = await sqliteService.executeSql('SELECT id FROM Notifications');
        const dbIds = dbRes.rows._array.map((row: any) => row.id);
        const newIds = notifs.map(n => n.id);

        const toDelete = dbIds.filter(id => !newIds.includes(id));
        if (toDelete.length > 0) {
          const placeholders = toDelete.map(() => '?').join(',');
          await sqliteService.executeSql(`DELETE FROM Notifications WHERE id IN (${placeholders})`, toDelete);
        }

        for (const n of notifs) {
          await sqliteService.executeSql(
            'INSERT OR REPLACE INTO Notifications (id, title, message, timestamp, type, read, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              n.id,
              n.title,
              n.message,
              n.timestamp,
              n.type,
              n.read ? 1 : 0,
              new Date().toISOString(),
              new Date().toISOString()
            ]
          );
        }
      } catch (err) {
        console.error('Failed to save notifications to SQLite:', err);
      } finally {
        this.notify();
      }
    };
    runAsyncSave();
  },

  // GET EXAMS
  getExams(): Exam[] {
    return cache.exams;
  },

  // SAVE EXAMS
  saveExams(exams: Exam[]): void {
    cache.exams = exams;

    const runAsyncSave = async () => {
      try {
        const dbRes = await sqliteService.executeSql('SELECT id FROM Exams');
        const dbIds = dbRes.rows._array.map((row: any) => row.id);
        const newIds = exams.map(e => e.id);

        const toDelete = dbIds.filter(id => !newIds.includes(id));
        if (toDelete.length > 0) {
          const placeholders = toDelete.map(() => '?').join(',');
          await sqliteService.executeSql(`DELETE FROM Exams WHERE id IN (${placeholders})`, toDelete);
          for (const id of toDelete) {
            await logDeletion('exams', id);
          }
        }

        const nextUpdatedAt = getNextMutationTimestamp();
        for (const e of exams) {
          await sqliteService.executeSql(
            'INSERT OR REPLACE INTO Exams (id, subjectId, title, date, time, syllabus, room, completed, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              e.id,
              e.subjectId,
              e.title,
              e.date,
              e.time || '',
              e.syllabus || '',
              e.room || '',
              e.completed ? 1 : 0,
              new Date().toISOString(),
              nextUpdatedAt
            ]
          );
        }
      } catch (err) {
        console.error('Failed to save exams to SQLite:', err);
      } finally {
        this.notify();
      }
    };
    runAsyncSave();
  },

  // GET ASSIGNMENTS
  getAssignments(): Assignment[] {
    return cache.assignments;
  },

  // SAVE ASSIGNMENTS
  saveAssignments(assignments: Assignment[]): void {
    cache.assignments = assignments;

    const runAsyncSave = async () => {
      try {
        const dbRes = await sqliteService.executeSql('SELECT id FROM Assignments');
        const dbIds = dbRes.rows._array.map((row: any) => row.id);
        const newIds = assignments.map(a => a.id);

        const toDelete = dbIds.filter(id => !newIds.includes(id));
        if (toDelete.length > 0) {
          const placeholders = toDelete.map(() => '?').join(',');
          await sqliteService.executeSql(`DELETE FROM Assignments WHERE id IN (${placeholders})`, toDelete);
          for (const id of toDelete) {
            await logDeletion('assignments', id);
          }
        }

        const nextUpdatedAt = getNextMutationTimestamp();
        for (const a of assignments) {
          await sqliteService.executeSql(
            'INSERT OR REPLACE INTO Assignments (id, subjectId, title, dueDate, dueTime, description, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              a.id,
              a.subjectId,
              a.title,
              a.dueDate,
              a.dueTime || '',
              a.description || '',
              a.status,
              new Date().toISOString(),
              nextUpdatedAt
            ]
          );
        }
      } catch (err) {
        console.error('Failed to save assignments to SQLite:', err);
      } finally {
        this.notify();
      }
    };
    runAsyncSave();
  },

  // ADD NOTIFICATION
  addNotification(title: string, message: string, type: 'warning' | 'success' | 'info' | 'danger'): void {
    const notifs = this.getNotifications();
    
    // Prevent duplicate unread notifications generated within the last 15 minutes
    const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
    const isDuplicate = notifs.some(n => 
      !n.read && 
      n.title === title && 
      n.message === message && 
      n.timestamp > fifteenMinutesAgo
    );
    
    if (isDuplicate) {
      console.log(`Notification suppressed: Duplicate of "${title}" detected within the lock window.`);
      return;
    }

    const newNotif: NotificationItem = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title,
      message,
      timestamp: Date.now(),
      type,
      read: false,
    };
    
    // Auto-purge notifications older than 14 days to maintain database lightness & efficiency
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const cleanNotifs = notifs.filter(n => n.timestamp > fourteenDaysAgo);
    
    cleanNotifs.unshift(newNotif);
    this.saveNotifications(cleanNotifs.slice(0, 50));
    
    // Trigger vibration/sound if enabled
    const prefs = this.getPrefs();
    if (prefs.hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }

    // Schedule Capacitor Native Local Notification if notifications are enabled
    if (prefs.notificationsEnabled) {
      let channelId: 'academic' | 'assignments' | 'exams' | 'general' | 'ai' = 'general';
      const lowerTitle = title.toLowerCase();
      const lowerMessage = message.toLowerCase();
      
      if (lowerTitle.includes('assignment') || lowerMessage.includes('assignment')) {
        channelId = 'assignments';
      } else if (lowerTitle.includes('exam') || lowerMessage.includes('exam') || lowerTitle.includes('test') || lowerMessage.includes('test')) {
        channelId = 'exams';
      } else if (lowerTitle.includes('attendance') || lowerMessage.includes('attendance') || lowerTitle.includes('bunk') || lowerMessage.includes('bunk') || lowerTitle.includes('class') || lowerMessage.includes('class')) {
        channelId = 'academic';
      } else if (lowerTitle.includes('ai') || lowerMessage.includes('ai') || lowerTitle.includes('timetable') || lowerMessage.includes('timetable')) {
        channelId = 'ai';
      }
      
      const numericId = Math.floor(Math.random() * 1000000);
      NotificationService.schedule(numericId, title, message, channelId).catch(err => {
        console.error('Failed to trigger native local notification:', err);
      });
    }
  },

  // EXPORT DATABASE
  exportDatabase(): string {
    const data = {
      subjects: this.getSubjects(),
      records: this.getRecords(),
      prefs: this.getPrefs(),
      notifications: this.getNotifications(),
      exams: this.getExams(),
      assignments: this.getAssignments()
    };
    return JSON.stringify(data, null, 2);
  },

  // IMPORT DATABASE
  importDatabase(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object') {
        if (Array.isArray(parsed.subjects)) {
          this.saveSubjects(parsed.subjects);
        }
        if (Array.isArray(parsed.records)) {
          this.saveRecords(parsed.records);
        }
        if (parsed.prefs && typeof parsed.prefs === 'object') {
          this.savePrefs(parsed.prefs);
        }
        if (Array.isArray(parsed.notifications)) {
          this.saveNotifications(parsed.notifications);
        }
        if (Array.isArray(parsed.exams)) {
          this.saveExams(parsed.exams);
        }
        if (Array.isArray(parsed.assignments)) {
          this.saveAssignments(parsed.assignments);
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error('Failed to import database:', e);
      return false;
    }
  },

  // CLEAR ALL DATA
  async clearAllData(): Promise<void> {
    cache.subjects = [];
    cache.records = [];
    cache.notifications = [];
    cache.exams = [];
    cache.assignments = [];
    cache.prefs = { ...DEFAULT_PREFS };
    settingsUpdatedAtCache = {};

    try {
      const tables = ['Subjects', 'Timetable', 'Attendance', 'Notifications', 'Exams', 'Assignments', 'Settings'];
      for (const table of tables) {
        await sqliteService.executeSql(`DELETE FROM ${table}`);
      }
    } catch (err) {
      console.error('Failed to clear all SQLite data:', err);
    } finally {
      this.notify();
    }
  },

  // RESET TO DEFAULT
  async resetMockData(): Promise<void> {
    await this.clearAllData();
    this.savePrefs(DEFAULT_PREFS);
  }
};

// Attendance Math Calculations
export interface SubjectAttendanceStats {
  subjectId: string;
  subjectName: string;
  color: string;
  code: string;
  totalLogged: number; // Conducted (Attended + Bunked)
  attended: number;
  bunked: number;
  cancelled: number;
  percentage: number;
  target: number;
  status: 'safe' | 'borderline' | 'danger' | 'no_data';
  bunksAvailable: number; // consecutive bunks safe to take
  classesToAttend: number; // consecutive classes to attend to reach target
}

export function calculateSubjectStats(subject: Subject, records: AttendanceRecord[]): SubjectAttendanceStats {
  const subjRecords = records.filter(r => r.subjectId === subject.id);
  
  const initialPres = subject.initialPresent || 0;
  const initialAbs = subject.initialAbsent || 0;

  const attended = initialPres + subjRecords.filter(r => r.status === 'attended').length;
  const bunked = initialAbs + subjRecords.filter(r => r.status === 'bunked').length;
  const cancelled = subjRecords.filter(r => r.status === 'cancelled').length;
  const totalLogged = attended + bunked; // conducted classes

  let percentage = 100;
  if (totalLogged > 0) {
    percentage = Math.round((attended / totalLogged) * 1000) / 10;
  }

  const target = subject.targetPercentage;
  let status: 'safe' | 'borderline' | 'danger' | 'no_data' = 'no_data';

  if (totalLogged === 0) {
    status = 'no_data';
  } else if (percentage < target) {
    status = 'danger';
  } else if (percentage - target <= 5) {
    status = 'borderline';
  } else {
    status = 'safe';
  }

  // Calculate Safe Bunks (bunksAvailable)
  // Formula: floor((100 * Attended - Target * TotalLogged) / Target)
  let bunksAvailable = 0;
  if (totalLogged > 0 && percentage >= target) {
    bunksAvailable = Math.floor((100 * attended - target * totalLogged) / target);
    if (bunksAvailable < 0) bunksAvailable = 0;
  } else if (totalLogged === 0) {
    bunksAvailable = 0; // standard safety
  }

  // Calculate Classes to Attend (classesToAttend)
  // Formula: ceil((Target * TotalLogged - 100 * Attended) / (100 - Target))
  let classesToAttend = 0;
  if (totalLogged > 0 && percentage < target) {
    const numerator = target * totalLogged - 100 * attended;
    const denominator = 100 - target;
    classesToAttend = Math.ceil(numerator / denominator);
    if (classesToAttend < 0) classesToAttend = 0;
  } else if (totalLogged === 0 && percentage < target) {
    classesToAttend = 1;
  }

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    color: subject.color,
    code: subject.code,
    totalLogged,
    attended,
    bunked,
    cancelled,
    percentage,
    target,
    status,
    bunksAvailable,
    classesToAttend
  };
}

// Calculate Overall Stats
export function calculateOverallStats(subjects: Subject[], records: AttendanceRecord[], globalTarget: number): AnalyticsSummary {
  const activeSubjects = subjects.filter(s => !s.isArchived);
  let totalAttended = 0;
  let totalBunked = 0;
  let totalCancelled = 0;

  activeSubjects.forEach(sub => {
    const subRecords = records.filter(r => r.subjectId === sub.id);
    totalAttended += (sub.initialPresent || 0) + subRecords.filter(r => r.status === 'attended').length;
    totalBunked += (sub.initialAbsent || 0) + subRecords.filter(r => r.status === 'bunked').length;
    totalCancelled += subRecords.filter(r => r.status === 'cancelled').length;
  });

  const totalConducted = totalAttended + totalBunked;
  const overallPercentage = totalConducted > 0 
    ? Math.round((totalAttended / totalConducted) * 1000) / 10 
    : 100;

  // Bunkability index represents a health index based on subjects status
  // If many subjects are in "danger" zone, it drops heavily.
  let dangerCount = 0;
  let safeCount = 0;
  activeSubjects.forEach(sub => {
    const stat = calculateSubjectStats(sub, records);
    if (stat.status === 'danger') dangerCount++;
    if (stat.status === 'safe') safeCount++;
  });

  let bunkabilityIndex = 100;
  if (activeSubjects.length > 0) {
    const dangerPenalty = (dangerCount / activeSubjects.length) * 60;
    const neutralCount = activeSubjects.length - dangerCount - safeCount;
    const neutralPenalty = (neutralCount / activeSubjects.length) * 20;
    bunkabilityIndex = Math.max(0, Math.round(100 - dangerPenalty - neutralPenalty));
  }

  return {
    totalClasses: totalConducted,
    attendedClasses: totalAttended,
    bunkedClasses: totalBunked,
    cancelledClasses: totalCancelled,
    overallPercentage,
    bunkabilityIndex
  };
}

// Trigger Haptic Feedback simulation
export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light'): void {
  const prefs = db.getPrefs();
  if (!prefs.hapticsEnabled) return;

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    switch (type) {
      case 'light':
        navigator.vibrate(15);
        break;
      case 'medium':
        navigator.vibrate(30);
        break;
      case 'heavy':
        navigator.vibrate(60);
        break;
      case 'success':
        navigator.vibrate([30, 40, 30]);
        break;
      case 'warning':
        navigator.vibrate([40, 80, 40]);
        break;
      case 'error':
        navigator.vibrate([60, 40, 100]);
        break;
    }
  }

  // Optional: Auditory tick sounds for high-fidelity native feeling!
  if (prefs.soundEnabled && typeof Audio !== 'undefined') {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      if (type === 'error') {
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
      } else {
        // Subtle tick sound
        osc.frequency.setValueAtTime(1000, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
      }
    } catch (e) {
      // browser blocked or unsupported context, fail silently
    }
  }
}

export function isNotificationAllowed(
  type: 'academic' | 'exam' | 'assignment' | 'update' | 'manual',
  dayOfWeek: number, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  prefs: AppPreferences
): { allowed: boolean; reason: string } {
  if (!prefs.notificationsEnabled) {
    return { allowed: false, reason: 'All notifications are disabled globally.' };
  }

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isDayActive = prefs.activeNotificationDays.includes(dayOfWeek);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = dayNames[dayOfWeek];

  if (type === 'academic') {
    if (isWeekend) {
      if (!prefs.weekendClassesEnabled) {
        return { 
          allowed: false, 
          reason: `Academic & class-related notifications are completely suppressed on weekends (${dayName}) when Weekend Classes setting is Off.` 
         };
      }
      if (!isDayActive) {
        return { 
          allowed: false, 
          reason: `${dayName} is not enabled as an active notification day in your custom scheduler preferences.` 
        };
      }
      return { allowed: true, reason: `Allowed: Academic notification on weekend (${dayName}) since Weekend Classes is On.` };
    } else {
      // Weekday academic
      if (!isDayActive) {
        return { 
          allowed: false, 
          reason: `Notification skipped: ${dayName} is deactivated in your custom notification weekday preferences.` 
        };
      }
      return { allowed: true, reason: `Allowed: Standard weekday notification schedule for ${dayName}.` };
    }
  } else {
    // Non-academic: exam, assignment, update, manual
    let enabled = true;
    let label = '';
    if (type === 'exam') {
      enabled = prefs.examRemindersEnabled;
      label = 'Exam Reminders';
    } else if (type === 'assignment') {
      enabled = prefs.assignmentDeadlinesEnabled;
      label = 'Assignment Deadlines';
    } else if (type === 'update') {
      enabled = prefs.appUpdatesEnabled;
      label = 'App Updates';
    } else if (type === 'manual') {
      enabled = prefs.manualRemindersEnabled;
      label = 'Manual Reminders';
    }

    if (!enabled) {
      return { allowed: false, reason: `Suppressed: Non-academic category '${label}' is toggled Off.` };
    }

    return { 
      allowed: true, 
      reason: `Allowed: '${label}' is a non-academic alert, which bypasses weekend and custom weekday suppression.` 
    };
  }
}

/**
 * Convert any time string (e.g. "09:00 AM", "14:30", "2:30 PM", "09:50") to minutes from midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  
  // Clean up whitespace and capitalize
  const clean = timeStr.trim().toUpperCase();
  
  // Check for AM/PM format
  const ampmMatch = clean.match(/^(\d+):(\d+)\s*(AM|PM)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const suffix = ampmMatch[3];
    
    if (suffix === 'PM' && hours < 12) {
      hours += 12;
    } else if (suffix === 'AM' && hours === 12) {
      hours = 0;
    }
    return hours * 60 + minutes;
  }
  
  // Fallback to 24h HH:MM format
  const standardMatch = clean.match(/^(\d+):(\d+)$/);
  if (standardMatch) {
    const hours = parseInt(standardMatch[1], 10);
    const minutes = parseInt(standardMatch[2], 10);
    return hours * 60 + minutes;
  }
  
  return 0;
}

export function compareTimeStrings(t1: string, t2: string): number {
  return timeStringToMinutes(t1) - timeStringToMinutes(t2);
}
