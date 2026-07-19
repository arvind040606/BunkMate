import { getApiUrl } from './api';
import { sqliteService } from '../database/sqlite';
import { db } from './db';
import { AppPreferences } from '../types';

export interface SyncStatus {
  isSyncing: boolean;
  lastSynced: number;
  error: string | null;
}

export class SyncService {
  private static instance: SyncService;
  private isSyncInProgress = false;
  private hasPendingSyncRequest = false;
  public isWritingSyncData = false;
  private listeners: ((status: SyncStatus) => void)[] = [];
  private lastError: string | null = null;
  private eventSource: EventSource | null = null;
  private sseFailureCount = 0;
  private userUpdateListeners: ((userId: string, username?: string) => void)[] = [];

  private constructor() {}

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  public subscribeToUserUpdates(listener: (userId: string, username?: string) => void) {
    this.userUpdateListeners.push(listener);
    return () => {
      this.userUpdateListeners = this.userUpdateListeners.filter(l => l !== listener);
    };
  }

  private notifySubscribersOfUserUpdate(userId: string, username?: string) {
    this.userUpdateListeners.forEach(l => {
      try {
        l(userId, username);
      } catch (err) {
        console.error('Error notifying user update listener:', err);
      }
    });
  }

  public setupSyncStream() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    // Check if running in a production web environment (e.g. Vercel) where persistent SSE streams
    // are not sustainable/supported by the serverless runtime.
    const isDeployed = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
    if (isDeployed) {
      console.log('[SSE] Disabled in production web/serverless environment; using polling fallback.');
      return;
    }

    const prefs = db.getPrefs();
    if (!prefs.syncEnabled || !prefs.syncToken) {
      this.closeSyncStream();
      return;
    }

    if (this.eventSource) {
      return; // Already setup
    }

    const url = getApiUrl(`/api/sync-events?token=${encodeURIComponent(prefs.syncToken)}`);
    console.log('[SSE] Connecting to sync events stream...');
    const es = new EventSource(url);

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'sync_update') {
          console.log(`[SSE] Real-time sync update received for user: ${data.userId} (${data.username || 'unknown'})`);
          this.notifySubscribersOfUserUpdate(data.userId, data.username);
        }
      } catch (err) {
        // Heartbeats are non-JSON and fall back silently
      }
    };

    es.onerror = () => {
      // On serverless deployments (e.g. Vercel), /api/sync-events may not exist as a
      // persistent stream, or a given connection may land on an instance that can't
      // sustain it. Rather than let the browser retry forever (console spam + wasted
      // requests), close the stream after repeated failures and rely entirely on the
      // polling fallbacks already in place (FriendsModal / FriendCard), which work
      // reliably regardless of hosting environment.
      this.sseFailureCount += 1;
      if (this.sseFailureCount >= 3) {
        console.warn('[SSE] Sync stream unavailable after repeated failures — falling back to polling.');
        this.closeSyncStream();
        return;
      }
      console.warn('[SSE] EventSource stream error, reconnecting...');
    };

    es.onopen = () => {
      this.sseFailureCount = 0;
    };

    this.eventSource = es;
  }

  public closeSyncStream() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      console.log('[SSE] EventSource stream closed');
    }
  }

  public subscribe(listener: (status: SyncStatus) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const status: SyncStatus = {
      isSyncing: this.isSyncInProgress,
      lastSynced: db.getPrefs().syncLastSynced || 0,
      error: this.lastError
    };
    this.listeners.forEach(l => l(status));
  }

  private parseUpdatedAt(val: any): number {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    const num = Number(val);
    if (!isNaN(num)) return num;
    const parsed = new Date(val).getTime();
    return isNaN(parsed) ? 0 : parsed;
  }

  public async registerOrLogin(
    username: string, 
    password: string, 
    action: 'register' | 'login', 
    securityQuestion?: string, 
    securityAnswer?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.isSyncInProgress = true;
      this.lastError = null;
      this.notify();

      const url = getApiUrl('/api/auth');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, username, password, securityQuestion, securityAnswer })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Check if logging in as a different user to prevent data mixture
      const currentPrefs = db.getPrefs();
      const previousUserId = currentPrefs.lastLoggedUserId || currentPrefs.syncUserId;
      const isDifferentUser = previousUserId && previousUserId !== data.userId;

      if (isDifferentUser) {
        console.log('[Sync] New user detected. Wiping local database before initial cloud hydration...');
        await Promise.all([
          sqliteService.executeSql('DELETE FROM Subjects'),
          sqliteService.executeSql('DELETE FROM Timetable'),
          sqliteService.executeSql('DELETE FROM Attendance'),
          sqliteService.executeSql('DELETE FROM Notifications'),
          sqliteService.executeSql('DELETE FROM Exams'),
          sqliteService.executeSql('DELETE FROM Assignments'),
          sqliteService.executeSql('DELETE FROM sync_deletions'),
          sqliteService.executeSql('DELETE FROM Settings')
        ]);
        db.clearSettingsCache();
        await db.init();
      }

      // Set the new user preferences, preserving other settings if the user is the same
      const basePrefs = db.getPrefs();
      const updatedPrefs: AppPreferences = {
        ...basePrefs,
        syncEnabled: true,
        syncUsername: data.username,
        syncToken: data.token,
        syncUserId: data.userId,
        lastLoggedUserId: data.userId,
        syncLastSynced: 0, // Force fresh sync
        syncLastSyncedLocal: 0,
        syncSessionExpired: false
      };

      await db.savePrefs(updatedPrefs, false, false);
      
      this.setupSyncStream();

      // Perform initial sync to download existing user data before returning
      await this.performSync().catch(console.error);

      this.isSyncInProgress = false;
      this.notify();

      return { success: true };
    } catch (err: any) {
      this.isSyncInProgress = false;
      this.lastError = err.message || 'Network error';
      this.notify();
      return { success: false, error: this.lastError };
    }
  }

  public async getSecurityQuestion(username: string): Promise<{ success: boolean; question?: string; error?: string }> {
    try {
      const url = getApiUrl('/api/auth');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get-security-question', username })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Failed to fetch recovery question' };
      }
      return { success: true, question: data.question };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  }

  public async recoverPassword(username: string, securityAnswer: string, newPassword: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const url = getApiUrl('/api/auth');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'recover-password', username, securityAnswer, newPassword })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        return { success: false, error: data.error || 'Verification failed' };
      }
      return { success: true, message: data.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  }

  public async logout() {
    this.closeSyncStream();
    this.lastError = null;

    try {
      // Selective non-destructive logout: preserve profiles/attendance, only clear sync state
      const currentPrefs = db.getPrefs();
      const previousUserId = currentPrefs.syncUserId || currentPrefs.lastLoggedUserId;
      
      const updatedPrefs: AppPreferences = {
        ...currentPrefs,
        syncEnabled: false,
        syncUsername: undefined,
        syncToken: undefined,
        syncUserId: undefined,
        syncLastSynced: 0,
        syncLastSyncedLocal: 0,
        syncSessionExpired: false,
        lastLoggedUserId: previousUserId
      };

      await db.savePrefs(updatedPrefs, false, false);
      await db.init();
    } catch (err) {
      console.error('Error during selective logout:', err);
    }

    this.notify();
  }

  public async deleteAccount(password: string): Promise<{ success: boolean; error?: string }> {
    try {
      const prefs = db.getPrefs();
      if (!prefs.syncEnabled || !prefs.syncToken || !prefs.syncUsername) {
        throw new Error('Not connected to a cloud account.');
      }

      this.isSyncInProgress = true;
      this.notify();

      const url = getApiUrl('/api/auth');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${prefs.syncToken}`
        },
        body: JSON.stringify({
          action: 'delete',
          username: prefs.syncUsername,
          password
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Account deletion failed.');
      }

      // Local cleanup: Logout and completely clear all local tables and settings
      await this.logout();

      return { success: true };
    } catch (err: any) {
      this.isSyncInProgress = false;
      this.notify();
      return { success: false, error: err.message || 'Network error' };
    }
  }

  public async changePassword(
    oldPassword: string,
    newPassword: string,
    securityQuestion?: string,
    securityAnswer?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const prefs = db.getPrefs();
      if (!prefs.syncEnabled || !prefs.syncToken || !prefs.syncUsername) {
        throw new Error('Sync is not enabled or user session is missing.');
      }

      this.isSyncInProgress = true;
      this.notify();

      const url = getApiUrl('/api/auth');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${prefs.syncToken}`
        },
        body: JSON.stringify({
          action: 'change-password',
          username: prefs.syncUsername,
          oldPassword,
          newPassword,
          securityQuestion,
          securityAnswer
        })
      });

      const data = await response.json();
      this.isSyncInProgress = false;
      this.notify();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Password update failed.');
      }

      // Update sync token in preferences to the new one returned by server
      const currentPrefs = db.getPrefs();
      const updatedPrefs: AppPreferences = {
        ...currentPrefs,
        syncToken: data.token
      };
      await db.savePrefs(updatedPrefs);

      return { success: true };
    } catch (err: any) {
      this.isSyncInProgress = false;
      this.notify();
      return { success: false, error: err.message || 'Network error' };
    }
  }

  public async purgeCloudData(): Promise<{ success: boolean; error?: string }> {
    try {
      const prefs = db.getPrefs();
      if (!prefs.syncEnabled || !prefs.syncToken) {
        return { success: true };
      }

      this.isSyncInProgress = true;
      this.notify();

      const url = getApiUrl('/api/sync-purge');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${prefs.syncToken}`
        }
      });

      const data = await response.json();
      this.isSyncInProgress = false;
      this.notify();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to purge cloud storage.');
      }

      return { success: true };
    } catch (err: any) {
      this.isSyncInProgress = false;
      this.notify();
      return { success: false, error: err.message || 'Network error' };
    }
  }

  public async performSync(): Promise<boolean> {
    const prefs = db.getPrefs();
    if (!prefs.syncEnabled || !prefs.syncToken || prefs.syncSessionExpired) {
      return false;
    }

    if (this.isSyncInProgress) {
      if (!this.isWritingSyncData) {
        this.hasPendingSyncRequest = true;
      }
      return false;
    }

    try {
      this.isSyncInProgress = true;
      this.lastError = null;
      this.notify();

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

      const lastSynced = prefs.syncLastSynced || 0;
      const lastSyncedLocal = prefs.syncLastSyncedLocal || 0;
      const clientSyncStartTime = Date.now();
      const changes: any[] = [];

      // 1. Gather modified Subjects
      const subjectsRes = await sqliteService.executeSql('SELECT * FROM Subjects');
      for (const row of subjectsRes.rows._array) {
        const uAt = this.parseUpdatedAt(row.updatedAt);
        if (uAt > lastSyncedLocal) {
          changes.push({
            table: 'subjects',
            recordId: row.id,
            payload: {
              name: row.name,
              code: row.code,
              room: row.room,
              teacher: row.teacher,
              color: row.color,
              targetPercentage: row.targetPercentage,
              isPinned: row.isPinned,
              isArchived: row.isArchived,
              icon: row.icon,
              notes: row.notes,
              initialPresent: row.initialPresent,
              initialAbsent: row.initialAbsent
            },
            updatedAt: uAt
          });
        }
      }

      // 2. Gather modified Timetable
      const timetableRes = await sqliteService.executeSql('SELECT * FROM Timetable');
      for (const row of timetableRes.rows._array) {
        const uAt = this.parseUpdatedAt(row.updatedAt);
        if (uAt > lastSyncedLocal) {
          changes.push({
            table: 'timetable',
            recordId: row.id,
            payload: {
              subjectId: row.subjectId,
              dayOfWeek: row.dayOfWeek,
              time: row.time,
              duration: row.duration
            },
            updatedAt: uAt
          });
        }
      }

      // 3. Gather modified Attendance records
      const attendanceRes = await sqliteService.executeSql('SELECT * FROM Attendance');
      for (const row of attendanceRes.rows._array) {
        const uAt = this.parseUpdatedAt(row.updatedAt);
        if (uAt > lastSyncedLocal) {
          changes.push({
            table: 'attendance',
            recordId: row.id,
            payload: {
              subjectId: row.subjectId,
              date: row.date,
              status: row.status,
              timestamp: row.timestamp
            },
            updatedAt: uAt
          });
        }
      }

      // 4. Gather modified Exams
      const examsRes = await sqliteService.executeSql('SELECT * FROM Exams');
      for (const row of examsRes.rows._array) {
        const uAt = this.parseUpdatedAt(row.updatedAt);
        if (uAt > lastSyncedLocal) {
          changes.push({
            table: 'exams',
            recordId: row.id,
            payload: {
              subjectId: row.subjectId,
              title: row.title,
              date: row.date,
              time: row.time,
              syllabus: row.syllabus,
              room: row.room,
              completed: row.completed
            },
            updatedAt: uAt
          });
        }
      }

      // 5. Gather modified Assignments
      const assignmentsRes = await sqliteService.executeSql('SELECT * FROM Assignments');
      for (const row of assignmentsRes.rows._array) {
        const uAt = this.parseUpdatedAt(row.updatedAt);
        if (uAt > lastSyncedLocal) {
          changes.push({
            table: 'assignments',
            recordId: row.id,
            payload: {
              subjectId: row.subjectId,
              title: row.title,
              dueDate: row.dueDate,
              dueTime: row.dueTime,
              description: row.description,
              status: row.status
            },
            updatedAt: uAt
          });
        }
      }

      // 6. Gather modified Settings
      const settingsRes = await sqliteService.executeSql('SELECT * FROM Settings');
      const SYNC_METADATA_KEYS = [
        'syncEnabled',
        'syncUsername',
        'syncToken',
        'syncUserId',
        'syncLastSynced',
        'syncLastSyncedLocal'
      ];
      for (const row of settingsRes.rows._array) {
        if (SYNC_METADATA_KEYS.includes(row.key)) {
          continue;
        }
        const uAt = this.parseUpdatedAt(row.updatedAt);
        if (uAt > lastSyncedLocal) {
          changes.push({
            table: 'settings',
            recordId: row.id,
            payload: {
              key: row.key,
              value: row.value
            },
            updatedAt: uAt
          });
        }
      }

      // 7. Gather tombstoned Deletions
      const deletionsRes = await sqliteService.executeSql('SELECT * FROM sync_deletions WHERE deletedAt > ?', [lastSyncedLocal]);
      for (const row of deletionsRes.rows._array) {
        changes.push({
          table: row.tableName,
          recordId: row.recordId,
          isDeleted: true,
          updatedAt: row.deletedAt
        });
      }

      // Get local subject count to assist self-healing logic without infinite loops
      const localSubjectCountRes = await sqliteService.executeSql('SELECT COUNT(*) as count FROM Subjects');
      const localSubjectCount = localSubjectCountRes.rows._array[0]?.count || 0;

      // Send to server
      const url = getApiUrl('/api/sync');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${prefs.syncToken}`
        },
        body: JSON.stringify({ lastSynced, changes, localSubjectCount })
      });

      if (response.status === 401) {
        console.warn('[Sync] Authentication failed (401). Marking session as expired...');
        const nextPrefs: AppPreferences = {
          ...db.getPrefs(),
          syncSessionExpired: true
        };
        await db.savePrefs(nextPrefs, false, false);
        throw new Error('Authentication expired or user deleted. Please log in again.');
      }

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Synchronization failed');
      }

      if (data.resetSync) {
        console.warn('[Sync] Server requested a sync reset. Resetting timestamps...');
        const nextPrefs: AppPreferences = {
          ...db.getPrefs(),
          syncLastSynced: 0,
          syncLastSyncedLocal: 0
        };
        db.savePrefs(nextPrefs, true);

        // Schedule a full sync
        setTimeout(() => {
          this.performSync().catch(console.error);
        }, 100);

        return true;
      }

      // Apply server changes to local SQLite (Download updates)
      this.isWritingSyncData = true;
      await sqliteService.transaction(async () => {
        for (const sCh of data.changes) {
          const { table, recordId, payload, isDeleted } = sCh;

          if (isDeleted) {
            if (table === 'subjects') {
              await sqliteService.executeSql('DELETE FROM Subjects WHERE id = ?', [recordId]);
              await sqliteService.executeSql('DELETE FROM Timetable WHERE subjectId = ?', [recordId]);
              await sqliteService.executeSql('DELETE FROM Attendance WHERE subjectId = ?', [recordId]);
              await sqliteService.executeSql('DELETE FROM Exams WHERE subjectId = ?', [recordId]);
              await sqliteService.executeSql('DELETE FROM Assignments WHERE subjectId = ?', [recordId]);
            } else if (table === 'timetable') {
              await sqliteService.executeSql('DELETE FROM Timetable WHERE id = ?', [recordId]);
            } else if (table === 'attendance') {
              await sqliteService.executeSql('DELETE FROM Attendance WHERE id = ?', [recordId]);
            } else if (table === 'exams') {
              await sqliteService.executeSql('DELETE FROM Exams WHERE id = ?', [recordId]);
            } else if (table === 'assignments') {
              await sqliteService.executeSql('DELETE FROM Assignments WHERE id = ?', [recordId]);
            } else if (table === 'settings') {
              await sqliteService.executeSql('DELETE FROM Settings WHERE id = ?', [recordId]);
            }
          } else if (payload) {
            if (table === 'subjects') {
              await sqliteService.executeSql(
                `INSERT OR REPLACE INTO Subjects (
                  id, name, code, room, teacher, color, targetPercentage, isPinned, isArchived, icon, notes, initialPresent, initialAbsent, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  recordId,
                  payload.name,
                  payload.code || '',
                  payload.room || '',
                  payload.teacher || '',
                  payload.color,
                  payload.targetPercentage || 75,
                  payload.isPinned ? 1 : 0,
                  payload.isArchived ? 1 : 0,
                  payload.icon || '',
                  payload.notes || '',
                  payload.initialPresent || 0,
                  payload.initialAbsent || 0,
                  sCh.updatedAt
                ]
              );
            } else if (table === 'timetable') {
              await sqliteService.executeSql(
                'INSERT OR REPLACE INTO Timetable (id, subjectId, dayOfWeek, time, duration, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
                [
                  recordId,
                  payload.subjectId,
                  payload.dayOfWeek,
                  payload.time,
                  payload.duration || 60,
                  sCh.updatedAt
                ]
              );
            } else if (table === 'attendance') {
              await sqliteService.executeSql(
                'INSERT OR REPLACE INTO Attendance (id, subjectId, date, status, timestamp, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
                [
                  recordId,
                  payload.subjectId,
                  payload.date,
                  payload.status,
                  payload.timestamp,
                  sCh.updatedAt
                ]
              );
            } else if (table === 'exams') {
              await sqliteService.executeSql(
                'INSERT OR REPLACE INTO Exams (id, subjectId, title, date, time, syllabus, room, completed, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                  recordId,
                  payload.subjectId,
                  payload.title,
                  payload.date,
                  payload.time || '',
                  payload.syllabus || '',
                  payload.room || '',
                  payload.completed ? 1 : 0,
                  sCh.updatedAt
                ]
              );
            } else if (table === 'assignments') {
              await sqliteService.executeSql(
                'INSERT OR REPLACE INTO Assignments (id, subjectId, title, dueDate, dueTime, description, status, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [
                  recordId,
                  payload.subjectId,
                  payload.title,
                  payload.dueDate,
                  payload.dueTime || '',
                  payload.description || '',
                  payload.status || 'pending',
                  sCh.updatedAt
                ]
              );
            } else if (table === 'settings') {
              await sqliteService.executeSql(
                'INSERT OR REPLACE INTO Settings (id, key, value, updatedAt) VALUES (?, ?, ?, ?)',
                [
                  recordId,
                  payload.key,
                  typeof payload.value === 'string' ? payload.value : JSON.stringify(payload.value),
                  sCh.updatedAt
                ]
              );
            }
          }
        }

        // Clean local tombstone deletions table for records synchronized up to now
        await sqliteService.executeSql('DELETE FROM sync_deletions WHERE deletedAt <= ?', [data.syncTime]);
      });

      // Update sync preferences
      const nextPrefs: AppPreferences = {
        ...db.getPrefs(),
        syncLastSynced: data.syncTime,
        syncLastSyncedLocal: clientSyncStartTime
      };
      db.savePrefs(nextPrefs, true);

      // Hydrate local cache and trigger UI refresh
      await db.init();

      return true;
    } catch (err: any) {
      console.error('Cloud Sync service error:', err);
      this.lastError = err.message || 'Sync failed';
      return false;
    } finally {
      this.isWritingSyncData = false;
      this.isSyncInProgress = false;
      this.notify();
      if (this.hasPendingSyncRequest) {
        this.hasPendingSyncRequest = false;
        setTimeout(() => {
          this.performSync().catch(console.error);
        }, 100);
      }
    }
  }
}

export const syncService = SyncService.getInstance();

// Trigger background sync on startup if sync is enabled
setTimeout(() => {
  syncService.performSync().catch(console.error);
  syncService.setupSyncStream();
}, 1000);

// Resilient periodic auto-sync: even if a specific mutation-triggered sync is
// missed (app backgrounded mid-save, a transient network blip, a race with
// initialization, etc.), this guarantees local changes still reach the cloud
// - and therefore stay visible to friends - within a bounded time window,
// without the user needing to notice a failure and manually hit "Sync Now".
setInterval(() => {
  syncService.performSync().catch(console.error);
}, 20000);


// Auto-trigger background sync on database mutations
db.subscribe(() => {
  if (db.isInitialized && !syncService.isWritingSyncData) {
    syncService.performSync().catch(console.error);
  }
});

// Auto-trigger background sync on network status transition to online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Sync] Network connection restored. Auto-triggering sync...');
    syncService.performSync().catch(console.error);
  });
}
