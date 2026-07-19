import { sqliteService } from './sqlite';

export async function runSchemaMigrations(): Promise<void> {
  // 1. Create Tables and Indexes in a single Batch transaction for extreme performance
  const schema = `
    CREATE TABLE IF NOT EXISTS Subjects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      room TEXT,
      teacher TEXT,
      color TEXT NOT NULL,
      targetPercentage INTEGER DEFAULT 75,
      isPinned INTEGER DEFAULT 0,
      isArchived INTEGER DEFAULT 0,
      icon TEXT,
      notes TEXT,
      initialPresent INTEGER DEFAULT 0,
      initialAbsent INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS Attendance (
      id TEXT PRIMARY KEY,
      subjectId TEXT NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (subjectId) REFERENCES Subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Assignments (
      id TEXT PRIMARY KEY,
      subjectId TEXT NOT NULL,
      title TEXT NOT NULL,
      dueDate TEXT NOT NULL,
      dueTime TEXT,
      description TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (subjectId) REFERENCES Subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Exams (
      id TEXT PRIMARY KEY,
      subjectId TEXT NOT NULL,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      syllabus TEXT,
      room TEXT,
      completed INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (subjectId) REFERENCES Subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Timetable (
      id TEXT PRIMARY KEY,
      subjectId TEXT NOT NULL,
      dayOfWeek INTEGER NOT NULL,
      time TEXT NOT NULL,
      duration INTEGER,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (subjectId) REFERENCES Subjects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Notifications (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      type TEXT NOT NULL,
      read INTEGER DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS Achievements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      unlockedAt INTEGER,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS Settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_deletions (
      id TEXT PRIMARY KEY,
      tableName TEXT NOT NULL,
      recordId TEXT NOT NULL,
      deletedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS AITimetableHistory (
      id TEXT PRIMARY KEY,
      rawText TEXT,
      parsedData TEXT,
      timestamp INTEGER,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS AttendanceHistory (
      id TEXT PRIMARY KEY,
      action TEXT,
      subjectId TEXT,
      date TEXT,
      status TEXT,
      timestamp INTEGER,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS BackupMetadata (
      id TEXT PRIMARY KEY,
      filename TEXT,
      timestamp INTEGER,
      type TEXT,
      checksum TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_attendance_subject ON Attendance (subjectId);
    CREATE INDEX IF NOT EXISTS idx_timetable_subject ON Timetable (subjectId);
    CREATE INDEX IF NOT EXISTS idx_exams_subject ON Exams (subjectId);
    CREATE INDEX IF NOT EXISTS idx_assignments_subject ON Assignments (subjectId);
    CREATE INDEX IF NOT EXISTS idx_settings_key ON Settings (key);
  `;

  await sqliteService.executeBatch(schema, false);

  // 2. Perform automatic localStorage migration
  await handleLocalStorageMigration();

  // 3. Persist the database to the Web Store once at the end
  await sqliteService.saveToStore();
}

async function handleLocalStorageMigration(): Promise<void> {
  const SUBJECTS_KEY = 'bunkmate_subjects';
  const RECORDS_KEY = 'bunkmate_records';
  const PREFS_KEY = 'bunkmate_prefs';
  const NOTIFICATIONS_KEY = 'bunkmate_notifications';
  const EXAMS_KEY = 'bunkmate_exams';
  const ASSIGNMENTS_KEY = 'bunkmate_assignments';

  const migratedKey = 'bunkmate_localstorage_migrated_to_sqlite';
  if (localStorage.getItem(migratedKey) === 'true') {
    return; // Already migrated
  }

  console.log('Starting BunkMate automatic localStorage to SQLite migration...');

  try {
    // A. Migrate Preferences / Settings
    const prefsRaw = localStorage.getItem(PREFS_KEY);
    if (prefsRaw) {
      const prefs = JSON.parse(prefsRaw);
      for (const [key, val] of Object.entries(prefs)) {
        if (val === undefined || val === null) continue;
        await sqliteService.executeSql(
          'INSERT OR REPLACE INTO Settings (id, key, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
          [`settings-${key}`, key, JSON.stringify(val), new Date().toISOString(), new Date().toISOString()],
          false
        );
      }
    }

    // B. Migrate Subjects & Schedule entries
    const subjectsRaw = localStorage.getItem(SUBJECTS_KEY);
    if (subjectsRaw) {
      const subjects = JSON.parse(subjectsRaw);
      if (Array.isArray(subjects)) {
        for (const sub of subjects) {
          // Insert subject
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
              sub.targetPercentage || 75,
              sub.isPinned ? 1 : 0,
              sub.isArchived ? 1 : 0,
              sub.icon || '',
              sub.notes || '',
              sub.initialPresent || 0,
              sub.initialAbsent || 0,
              new Date().toISOString(),
              new Date().toISOString()
            ],
            false
          );

          // Insert nested schedule entries into Timetable
          if (Array.isArray(sub.schedule)) {
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
                  new Date().toISOString()
                ],
                false
              );
            }
          }
        }
      }
    }

    // C. Migrate Attendance Records
    const recordsRaw = localStorage.getItem(RECORDS_KEY);
    if (recordsRaw) {
      const records = JSON.parse(recordsRaw);
      if (Array.isArray(records)) {
        for (const rec of records) {
          await sqliteService.executeSql(
            'INSERT OR REPLACE INTO Attendance (id, subjectId, date, status, timestamp, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              rec.id,
              rec.subjectId,
              rec.date,
              rec.status,
              rec.timestamp,
              new Date().toISOString(),
              new Date().toISOString()
            ],
            false
          );
        }
      }
    }

    // D. Migrate Exams
    const examsRaw = localStorage.getItem(EXAMS_KEY);
    if (examsRaw) {
      const exams = JSON.parse(examsRaw);
      if (Array.isArray(exams)) {
        for (const ex of exams) {
          await sqliteService.executeSql(
            'INSERT OR REPLACE INTO Exams (id, subjectId, title, date, time, syllabus, room, completed, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              ex.id,
              ex.subjectId,
              ex.title,
              ex.date,
              ex.time || '',
              ex.syllabus || '',
              ex.room || '',
              ex.completed ? 1 : 0,
              new Date().toISOString(),
              new Date().toISOString()
            ],
            false
          );
        }
      }
    }

    // E. Migrate Assignments
    const assignmentsRaw = localStorage.getItem(ASSIGNMENTS_KEY);
    if (assignmentsRaw) {
      const assignments = JSON.parse(assignmentsRaw);
      if (Array.isArray(assignments)) {
        for (const asg of assignments) {
          await sqliteService.executeSql(
            'INSERT OR REPLACE INTO Assignments (id, subjectId, title, dueDate, dueTime, description, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              asg.id,
              asg.subjectId,
              asg.title,
              asg.dueDate,
              asg.dueTime || '',
              asg.description || '',
              asg.status || 'pending',
              new Date().toISOString(),
              new Date().toISOString()
            ],
            false
          );
        }
      }
    }

    // F. Migrate Notifications
    const notificationsRaw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (notificationsRaw) {
      const notifications = JSON.parse(notificationsRaw);
      if (Array.isArray(notifications)) {
        for (const notif of notifications) {
          await sqliteService.executeSql(
            'INSERT OR REPLACE INTO Notifications (id, title, message, timestamp, type, read, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
              notif.id,
              notif.title,
              notif.message,
              notif.timestamp,
              notif.type,
              notif.read ? 1 : 0,
              new Date().toISOString(),
              new Date().toISOString()
            ],
            false
          );
        }
      }
    }

    // Verify migration succeeded
    const subjectsCheck = await sqliteService.executeSql('SELECT id FROM Subjects');
    console.log(`Verification: Migrated ${subjectsCheck.rows.length} subjects to SQLite successfully.`);

    // Set flag and safely clear old localStorage arrays
    localStorage.setItem(migratedKey, 'true');
    
    // Purge deprecated storage keys (No loss because now in SQLite)
    localStorage.removeItem(SUBJECTS_KEY);
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(NOTIFICATIONS_KEY);
    localStorage.removeItem(EXAMS_KEY);
    localStorage.removeItem(ASSIGNMENTS_KEY);

  } catch (err) {
    console.error('Error migrating localStorage to SQLite:', err);
  }
}
