import path from 'path';
import fs from 'fs';
import { createClient, type Client } from '@libsql/client';

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

const isVercel = !!process.env.VERCEL;
const SEED_DB_PATH = path.join(process.cwd(), 'bunkmate_backend.sqlite');
const LOCAL_DB_PATH = isVercel
  ? path.join('/tmp', 'bunkmate_backend.sqlite')
  : SEED_DB_PATH;

// Seed the writable /tmp directory on Vercel if utilizing local sqlite fallback
if (isVercel && !TURSO_URL) {
  try {
    if (!fs.existsSync(LOCAL_DB_PATH)) {
      if (fs.existsSync(SEED_DB_PATH)) {
        fs.copyFileSync(SEED_DB_PATH, LOCAL_DB_PATH);
        console.log('[Database] Seeded writable /tmp SQLite database from workspace template.');
      } else {
        console.log('[Database] Workspace template sqlite not found; initializing empty database.');
      }
    }
  } catch (err) {
    console.error('[Database] Failed to write fallback SQLite file to /tmp:', err);
  }
}

export interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  securityQuestion?: string;
  securityAnswerHash?: string;
  securityAnswerSalt?: string;
  createdAt: number;
}

class DB {
  private client: Client;
  private initPromise: Promise<void> | null = null;
  private usingRemote: boolean;

  constructor() {
    this.usingRemote = !!TURSO_URL;
    if (TURSO_URL) {
      this.client = createClient({
        url: TURSO_URL,
        authToken: TURSO_AUTH_TOKEN
      });
      console.log('[Database] Connected to remote persistent libSQL/Turso database.');
    } else {
      this.client = createClient({ url: `file:${LOCAL_DB_PATH}` });
      console.warn(
        '[Database] TURSO_DATABASE_URL is not set - falling back to a local SQLite file in ' +
        (isVercel ? '/tmp.' : 'workspace.') +
        ' This is fine for testing, but set TURSO_DATABASE_URL / TURSO_AUTH_TOKEN in ' +
        'production (see https://turso.tech) to keep all sessions persistent.'
      );
    }
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await this.createSchema();
      console.log('[Database] Schema ready.');
    } catch (err) {
      console.error('[Database] Failed to initialize database schema:', err);
      throw err;
    }
  }

  private async createSchema(): Promise<void> {
    const schema = `
      -- Users Table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        salt TEXT NOT NULL,
        securityQuestion TEXT,
        securityAnswerHash TEXT,
        securityAnswerSalt TEXT,
        createdAt INTEGER NOT NULL
      );

      -- Subjects Table
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT,
        room TEXT,
        teacher TEXT,
        color TEXT NOT NULL,
        targetPercentage INTEGER NOT NULL DEFAULT 75,
        isPinned INTEGER NOT NULL DEFAULT 0,
        isArchived INTEGER NOT NULL DEFAULT 0,
        icon TEXT,
        notes TEXT,
        initialPresent INTEGER NOT NULL DEFAULT 0,
        initialAbsent INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Timetable/Schedules Table
      CREATE TABLE IF NOT EXISTS timetable (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        subjectId TEXT NOT NULL,
        dayOfWeek INTEGER NOT NULL,
        time TEXT NOT NULL,
        duration INTEGER NOT NULL DEFAULT 60,
        createdAt TEXT,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(subjectId) REFERENCES subjects(id) ON DELETE CASCADE
      );

      -- Attendance Records Table
      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        subjectId TEXT NOT NULL,
        date TEXT NOT NULL,
        status TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        createdAt TEXT,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(subjectId) REFERENCES subjects(id) ON DELETE CASCADE
      );

      -- Assignments Table
      CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        subjectId TEXT,
        title TEXT NOT NULL,
        dueDate TEXT NOT NULL,
        dueTime TEXT,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        createdAt TEXT,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Exams Table
      CREATE TABLE IF NOT EXISTS exams (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        subjectId TEXT,
        title TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT,
        syllabus TEXT,
        room TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Settings/Preferences Table
      CREATE TABLE IF NOT EXISTS settings (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        createdAt TEXT,
        updatedAt INTEGER NOT NULL,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(userId, key)
      );

      -- Friends Table
      CREATE TABLE IF NOT EXISTS friends (
        id TEXT PRIMARY KEY,
        senderId TEXT NOT NULL,
        receiverId TEXT NOT NULL,
        status TEXT NOT NULL, -- 'pending' | 'accepted'
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(senderId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(receiverId) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Sync Deletions Tracker
      CREATE TABLE IF NOT EXISTS sync_deletions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        tableName TEXT NOT NULL,
        recordId TEXT NOT NULL,
        deletedAt INTEGER NOT NULL,
        FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Indexes for performance
      CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects (userId);
      CREATE INDEX IF NOT EXISTS idx_timetable_subject ON timetable (subjectId);
      CREATE INDEX IF NOT EXISTS idx_attendance_subject ON attendance (subjectId);
      CREATE INDEX IF NOT EXISTS idx_exams_user ON exams (userId);
      CREATE INDEX IF NOT EXISTS idx_assignments_user ON assignments (userId);
      CREATE INDEX IF NOT EXISTS idx_friends_sender ON friends (senderId);
      CREATE INDEX IF NOT EXISTS idx_friends_receiver ON friends (receiverId);
      CREATE INDEX IF NOT EXISTS idx_deletions_user ON sync_deletions (userId);
    `;

    // libSQL's execute() only runs a single statement at a time, so split the
    // schema into individual statements and run them in sequence.
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await this.client.execute(statement);
    }

    // Dynamic schema migrations for existing databases
    try {
      await this.client.execute('ALTER TABLE users ADD COLUMN securityQuestion TEXT');
    } catch {}
    try {
      await this.client.execute('ALTER TABLE users ADD COLUMN securityAnswerHash TEXT');
    } catch {}
    try {
      await this.client.execute('ALTER TABLE users ADD COLUMN securityAnswerSalt TEXT');
    } catch {}
  }

  // Base raw query executor
  public async query(sql: string, params: any[] = []): Promise<any[]> {
    if (this.initPromise) await this.initPromise;
    const result = await this.client.execute({ sql, args: params });
    return result.rows.map(row => {
      const obj: any = {};
      for (const col of result.columns) {
        obj[col] = (row as any)[col];
      }
      return obj;
    });
  }

  // Base raw write/execute executor
  public async run(sql: string, params: any[] = []): Promise<void> {
    if (this.initPromise) await this.initPromise;
    await this.client.execute({ sql, args: params });
  }

  // ==========================================
  // DOMAIN INTERFACES & QUERIES
  // ==========================================

  // Users
  public async getUserByUsername(username: string): Promise<UserRecord | null> {
    const res = await this.query('SELECT * FROM users WHERE username = ?', [username]);
    return res.length > 0 ? res[0] as UserRecord : null;
  }

  public async getUserById(userId: string): Promise<UserRecord | null> {
    const res = await this.query('SELECT * FROM users WHERE id = ?', [userId]);
    return res.length > 0 ? res[0] as UserRecord : null;
  }

  public async getAllUsers(): Promise<UserRecord[]> {
    return (await this.query('SELECT * FROM users')) as UserRecord[];
  }

  public async addUser(
    id: string, 
    username: string, 
    passwordHash: string, 
    salt: string,
    securityQuestion?: string,
    securityAnswerHash?: string,
    securityAnswerSalt?: string
  ): Promise<void> {
    await this.run(
      'INSERT INTO users (id, username, passwordHash, salt, securityQuestion, securityAnswerHash, securityAnswerSalt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, username, passwordHash, salt, securityQuestion || null, securityAnswerHash || null, securityAnswerSalt || null, Date.now()]
    );
  }

  // Friends
  public async getFriends(userId: string): Promise<any[]> {
    return this.query(
      `SELECT f.id, f.status, f.senderId, f.receiverId, f.createdAt,
              u1.username as senderUsername, u2.username as receiverUsername
       FROM friends f
       JOIN users u1 ON f.senderId = u1.id
       JOIN users u2 ON f.receiverId = u2.id
       WHERE f.senderId = ? OR f.receiverId = ?`,
      [userId, userId]
    );
  }

  public async getFriendship(userId1: string, userId2: string): Promise<any | null> {
    const res = await this.query(
      `SELECT * FROM friends 
       WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)`,
      [userId1, userId2, userId2, userId1]
    );
    return res.length > 0 ? res[0] : null;
  }

  public async addFriendRequest(senderId: string, receiverId: string): Promise<void> {
    const exists = await this.getFriendship(senderId, receiverId);
    if (exists) return;

    await this.run(
      'INSERT INTO friends (id, senderId, receiverId, status, createdAt) VALUES (?, ?, ?, ?, ?)',
      [`friend-${Date.now()}-${Math.random()}`, senderId, receiverId, 'pending', Date.now()]
    );
  }

  public async acceptFriendRequest(senderId: string, receiverId: string): Promise<void> {
    await this.run(
      `UPDATE friends SET status = 'accepted' 
       WHERE ((senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)) 
         AND status = 'pending'`,
      [senderId, receiverId, receiverId, senderId]
    );
  }

  public async rejectFriendRequest(senderId: string, receiverId: string): Promise<void> {
    await this.run(
      `DELETE FROM friends 
       WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)`,
      [senderId, receiverId, receiverId, senderId]
    );
  }

  public async getFriendStats(friendId: string): Promise<{ subjects: any[], timetable: any[], attendance: any[] }> {
    const subjects = await this.query('SELECT * FROM subjects WHERE userId = ?', [friendId]);
    const timetable = await this.query('SELECT * FROM timetable WHERE userId = ?', [friendId]);
    const attendance = await this.query('SELECT * FROM attendance WHERE userId = ?', [friendId]);
    return { subjects, timetable, attendance };
  }

  // ==========================================
  // DELTA SYNCHRONIZATION SUPPORT
  // ==========================================

  public async deleteRecord(userId: string, table: string, recordId: string, deletedAt: number): Promise<void> {
    const allowedTables = ['subjects', 'attendance', 'assignments', 'exams', 'settings', 'timetable'];
    if (!allowedTables.includes(table)) return;

    let targetId = recordId;
    if (table === 'settings' && recordId.startsWith('settings-')) {
      const key = recordId.substring('settings-'.length);
      targetId = `settings-${userId}-${key}`;
    }

    // Remove from active database table
    await this.run(`DELETE FROM ${table} WHERE userId = ? AND id = ?`, [userId, targetId]);

    // Save in deletions tracker
    const delId = `${userId}-${table}-${targetId}`;
    await this.run(
      'INSERT OR REPLACE INTO sync_deletions (id, userId, tableName, recordId, deletedAt) VALUES (?, ?, ?, ?, ?)',
      [delId, userId, table, targetId, deletedAt]
    );
  }

  public async upsertRecord(userId: string, table: string, recordId: string, payload: any, updatedAt: number): Promise<void> {
    const allowedTables = ['subjects', 'attendance', 'assignments', 'exams', 'settings', 'timetable'];
    if (!allowedTables.includes(table)) return;

    let targetId = recordId;
    if (table === 'settings' && recordId.startsWith('settings-')) {
      const key = recordId.substring('settings-'.length);
      targetId = `settings-${userId}-${key}`;
    }

    // 1. Check if a newer deletion exists
    const deletionCheck = await this.query(
      'SELECT deletedAt FROM sync_deletions WHERE userId = ? AND tableName = ? AND recordId = ?',
      [userId, table, targetId]
    );
    if (deletionCheck.length > 0 && deletionCheck[0].deletedAt >= updatedAt) {
      // Ignore client upsert since it was deleted subsequently
      return;
    }

    // 2. Check if database record is newer
    const existing = await this.query(`SELECT updatedAt FROM ${table} WHERE userId = ? AND id = ?`, [userId, targetId]);
    if (existing.length > 0 && existing[0].updatedAt >= updatedAt) {
      // Database has newer or same version
      return;
    }

    // 3. Remove deletion record if it exists but is older (re-created offline)
    if (deletionCheck.length > 0) {
      await this.run(
        'DELETE FROM sync_deletions WHERE userId = ? AND tableName = ? AND recordId = ?',
        [userId, table, targetId]
      );
    }

    let parsedPayload = payload;
    if (typeof payload === 'string') {
      try {
        parsedPayload = JSON.parse(payload);
      } catch (err) {
        console.error('Failed to parse payload:', err);
      }
    }

    // 4. Perform structured upsert based on target schema
    if (table === 'subjects') {
      const { name, code, room, teacher, color, targetPercentage, isPinned, isArchived, icon, notes, initialPresent, initialAbsent, createdAt } = parsedPayload;
      await this.run(
        `INSERT OR REPLACE INTO subjects (
          id, userId, name, code, room, teacher, color, targetPercentage, isPinned, isArchived, icon, notes, initialPresent, initialAbsent, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId, userId, name, code || '', room || '', teacher || '', color, targetPercentage || 75,
          isPinned ? 1 : 0, isArchived ? 1 : 0, icon || '', notes || '', initialPresent || 0, initialAbsent || 0,
          createdAt || new Date().toISOString(), updatedAt
        ]
      );

      // Support nested timetable schedules directly inside subject payload
      if (Array.isArray(parsedPayload.schedule)) {
        for (const entry of parsedPayload.schedule) {
          const entryId = entry.id || `entry-${Date.now()}-${Math.random()}`;
          const existingEntry = await this.query('SELECT updatedAt FROM timetable WHERE id = ?', [entryId]);
          if (existingEntry.length === 0 || existingEntry[0].updatedAt < updatedAt) {
            await this.run(
              `INSERT OR REPLACE INTO timetable (
                id, userId, subjectId, dayOfWeek, time, duration, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                entryId, userId, recordId, entry.dayOfWeek, entry.time, entry.duration || 60,
                new Date().toISOString(), updatedAt
              ]
            );
          }
        }
      }
    } 
    
    else if (table === 'timetable') {
      const { subjectId, dayOfWeek, time, duration, createdAt } = parsedPayload;
      await this.run(
        `INSERT OR REPLACE INTO timetable (
          id, userId, subjectId, dayOfWeek, time, duration, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId, userId, subjectId, dayOfWeek, time, duration || 60,
          createdAt || new Date().toISOString(), updatedAt
        ]
      );
    } 
    
    else if (table === 'attendance') {
      const { subjectId, date, status, timestamp, createdAt } = parsedPayload;
      await this.run(
        `INSERT OR REPLACE INTO attendance (
          id, userId, subjectId, date, status, timestamp, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId, userId, subjectId, date, status, timestamp,
          createdAt || new Date().toISOString(), updatedAt
        ]
      );
    } 
    
    else if (table === 'assignments') {
      const { subjectId, title, dueDate, dueTime, description, status, createdAt } = parsedPayload;
      await this.run(
        `INSERT OR REPLACE INTO assignments (
          id, userId, subjectId, title, dueDate, dueTime, description, status, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId, userId, subjectId || null, title, dueDate, dueTime || '', description || '', status || 'pending',
          createdAt || new Date().toISOString(), updatedAt
        ]
      );
    } 
    
    else if (table === 'exams') {
      const { subjectId, title, date, time, syllabus, room, completed, createdAt } = parsedPayload;
      await this.run(
        `INSERT OR REPLACE INTO exams (
          id, userId, subjectId, title, date, time, syllabus, room, completed, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId, userId, subjectId || null, title, date, time || '', syllabus || '', room || '',
          completed ? 1 : 0, createdAt || new Date().toISOString(), updatedAt
        ]
      );
    } 
    
    else if (table === 'settings') {
      const { key, value, createdAt } = parsedPayload;
      await this.run(
        `INSERT OR REPLACE INTO settings (
          id, userId, key, value, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          targetId, userId, key, typeof value === 'string' ? value : JSON.stringify(value),
          createdAt || new Date().toISOString(), updatedAt
        ]
      );
    }
  }

  public async getChanges(userId: string, lastSynced: number): Promise<any[]> {
    const serverChanges: any[] = [];

    // 1. Subjects (with nested schedule for simplified hydration)
    const subjects = await this.query('SELECT * FROM subjects WHERE userId = ? AND updatedAt > ?', [userId, lastSynced]);
    for (const sub of subjects) {
      const schedule = await this.query('SELECT id, dayOfWeek, time, duration FROM timetable WHERE subjectId = ?', [sub.id]);
      serverChanges.push({
        table: 'subjects',
        recordId: sub.id,
        payload: {
          id: sub.id,
          name: sub.name,
          code: sub.code,
          room: sub.room,
          teacher: sub.teacher,
          color: sub.color,
          targetPercentage: sub.targetPercentage,
          isPinned: sub.isPinned === 1,
          isArchived: sub.isArchived === 1,
          icon: sub.icon,
          notes: sub.notes,
          initialPresent: sub.initialPresent,
          initialAbsent: sub.initialAbsent,
          schedule
        },
        updatedAt: sub.updatedAt
      });
    }

    // 2. Timetable records updated independently
    const timetable = await this.query('SELECT * FROM timetable WHERE userId = ? AND updatedAt > ?', [userId, lastSynced]);
    for (const entry of timetable) {
      serverChanges.push({
        table: 'timetable',
        recordId: entry.id,
        payload: {
          id: entry.id,
          subjectId: entry.subjectId,
          dayOfWeek: entry.dayOfWeek,
          time: entry.time,
          duration: entry.duration
        },
        updatedAt: entry.updatedAt
      });
    }

    // 3. Attendance records
    const attendance = await this.query('SELECT * FROM attendance WHERE userId = ? AND updatedAt > ?', [userId, lastSynced]);
    for (const att of attendance) {
      serverChanges.push({
        table: 'attendance',
        recordId: att.id,
        payload: {
          id: att.id,
          subjectId: att.subjectId,
          date: att.date,
          status: att.status,
          timestamp: att.timestamp
        },
        updatedAt: att.updatedAt
      });
    }

    // 4. Assignments records
    const assignments = await this.query('SELECT * FROM assignments WHERE userId = ? AND updatedAt > ?', [userId, lastSynced]);
    for (const asg of assignments) {
      serverChanges.push({
        table: 'assignments',
        recordId: asg.id,
        payload: {
          id: asg.id,
          subjectId: asg.subjectId,
          title: asg.title,
          dueDate: asg.dueDate,
          dueTime: asg.dueTime,
          description: asg.description,
          status: asg.status
        },
        updatedAt: asg.updatedAt
      });
    }

    // 5. Exams records
    const exams = await this.query('SELECT * FROM exams WHERE userId = ? AND updatedAt > ?', [userId, lastSynced]);
    for (const ex of exams) {
      serverChanges.push({
        table: 'exams',
        recordId: ex.id,
        payload: {
          id: ex.id,
          subjectId: ex.subjectId,
          title: ex.title,
          date: ex.date,
          time: ex.time,
          syllabus: ex.syllabus,
          room: ex.room,
          completed: ex.completed === 1
        },
        updatedAt: ex.updatedAt
      });
    }

    // 6. Settings records
    const settings = await this.query('SELECT * FROM settings WHERE userId = ? AND updatedAt > ?', [userId, lastSynced]);
    for (const set of settings) {
      let parsedValue = set.value;
      try {
        parsedValue = JSON.parse(set.value);
      } catch {}
      const mappedId = `settings-${set.key}`;
      serverChanges.push({
        table: 'settings',
        recordId: mappedId,
        payload: {
          id: mappedId,
          key: set.key,
          value: parsedValue
        },
        updatedAt: set.updatedAt
      });
    }

    // 7. Sync Deletions
    const deletions = await this.query('SELECT * FROM sync_deletions WHERE userId = ? AND deletedAt > ?', [userId, lastSynced]);
    for (const del of deletions) {
      let mappedRecordId = del.recordId;
      if (del.tableName === 'settings' && del.recordId.startsWith(`settings-${userId}-`)) {
        const key = del.recordId.substring(`settings-${userId}-`.length);
        mappedRecordId = `settings-${key}`;
      }
      serverChanges.push({
        table: del.tableName,
        recordId: mappedRecordId,
        payload: {},
        updatedAt: del.deletedAt,
        isDeleted: true
      });
    }

    return serverChanges;
  }
}

export const dbInstance = new DB();
