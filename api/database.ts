import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

import { createClient as createLibsqlClient, type Client as LibsqlClient } from '@libsql/client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const isVercel = !!process.env.VERCEL;
const SEED_DB_PATH = path.join(process.cwd(), 'bunkmate_backend.sqlite');
const LOCAL_DB_PATH = isVercel
  ? path.join('/tmp', 'bunkmate_backend.sqlite')
  : SEED_DB_PATH;

// Seed the writable /tmp directory on Vercel if utilizing local sqlite fallback
if (isVercel && !TURSO_URL && !SUPABASE_URL) {
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
  private client: LibsqlClient | null = null;
  public supabase: any = null;
  public usingSupabase: boolean = false;
  private initPromise: Promise<void> | null = null;

  public get isPersistent(): boolean {
    return this.usingSupabase || !!TURSO_URL;
  }

  constructor() {
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
      this.supabase = createSupabaseClient(SUPABASE_URL.trim(), SUPABASE_ANON_KEY.trim());
      this.usingSupabase = true;
      console.log('[Database] Connected to online Supabase project.');
    } else if (TURSO_URL) {
      this.client = createLibsqlClient({
        url: TURSO_URL,
        authToken: TURSO_AUTH_TOKEN
      });
      console.log('[Database] Connected to remote persistent libSQL/Turso database.');
      this.initPromise = this.initialize();
    } else {
      this.client = createLibsqlClient({ url: `file:${LOCAL_DB_PATH}` });
      console.warn(
        '[Database] TURSO_DATABASE_URL/SUPABASE_URL is not set - falling back to local SQLite. ' +
        'This is fine for testing, but set SUPABASE_URL in production to keep all sessions persistent.'
      );
      this.initPromise = this.initialize();
    }
  }

  private async initialize(): Promise<void> {
    if (this.usingSupabase) return;
    try {
      await this.createSchema();
      console.log('[Database] Schema ready.');
    } catch (err) {
      console.error('[Database] Failed to initialize database schema:', err);
      throw err;
    }
  }

  private async createSchema(): Promise<void> {
    if (this.usingSupabase || !this.client) return;
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

      -- latest_updates Table
      CREATE TABLE IF NOT EXISTS latest_updates (
        id TEXT PRIMARY KEY,
        latest_version TEXT NOT NULL,
        minimum_supported_version TEXT NOT NULL,
        google_drive_apk_url TEXT NOT NULL,
        release_notes TEXT,
        release_date TEXT NOT NULL,
        force_update INTEGER NOT NULL DEFAULT 0,
        maintenance_mode INTEGER NOT NULL DEFAULT 0,
        maintenance_message TEXT,
        developer_email TEXT,
        app_license TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
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

    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await this.client.execute(statement);
    }

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
    if (this.usingSupabase) {
      const normSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

      if (normSql.includes('select count(*) as count from subjects where userid = ?')) {
        const { count, error } = await this.supabase
          .from('subjects')
          .select('*', { count: 'exact', head: true })
          .eq('userId', params[0]);
        if (error) console.error('[Supabase count error]:', error.message);
        return [{ count: count || 0 }];
      }

      if (normSql.includes('select id, username from users where username like ?')) {
        const likeParam = params[0].replace(/%/g, '');
        const userId = params[1];
        const { data, error } = await this.supabase
          .from('users')
          .select('id, username')
          .neq('id', userId)
          .ilike('username', `%${likeParam}%`)
          .limit(20);
        if (error) console.error('[Supabase search error]:', error.message);
        return data || [];
      }

      if (normSql.includes('select id, username from users') && normSql.includes('friends')) {
        const userId = params[0];
        const { data: friends } = await this.supabase
          .from('friends')
          .select('senderId, receiverId')
          .or(`senderId.eq.${userId},receiverId.eq.${userId}`);

        const friendIds = new Set<string>();
        friendIds.add(userId);
        if (friends) {
          for (const f of friends) {
            friendIds.add(f.senderId);
            friendIds.add(f.receiverId);
          }
        }

        const { data: users, error } = await this.supabase
          .from('users')
          .select('id, username')
          .not('id', 'in', `(${Array.from(friendIds).join(',')})`)
          .limit(10);
        if (error) console.error('[Supabase suggestions error]:', error.message);
        return users || [];
      }

      if (normSql.includes('from settings where userid')) {
        let query = this.supabase.from('settings').select('userId, key, value');
        if (normSql.includes('in (')) {
          query = query.in('userId', params);
        } else {
          query = query.eq('userId', params[0]);
        }
        if (normSql.includes('displayname')) {
          query = query.in('key', ['displayName', 'avatarId']);
        }
        const { data, error } = await query;
        if (error) console.error('[Supabase settings query error]:', error.message);
        return data || [];
      }

      if (normSql.includes('insert or ignore into users') || normSql.includes('insert into users')) {
        const ignoreDuplicates = normSql.includes('ignore');
        const { error } = await this.supabase.from('users').upsert([{
          id: params[0],
          username: params[1],
          passwordHash: params[2],
          salt: params[3],
          createdAt: params[4] || Date.now()
        }], { onConflict: 'id', ignoreDuplicates });
        if (error) console.error('[Supabase insert user error]:', error.message);
        return [];
      }
    }

    if (this.initPromise) await this.initPromise;
    if (!this.client) return [];
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
    if (this.usingSupabase) {
      const normSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();

      if (normSql.startsWith('update users set passwordhash =')) {
        const { error } = await this.supabase.from('users').update({
          passwordHash: params[0],
          salt: params[1],
          securityQuestion: params[2] || undefined,
          securityAnswerHash: params[3] || undefined,
          securityAnswerSalt: params[4] || undefined
        }).eq('id', params[params.length - 1]);
        if (error) console.error('[Supabase update password error]:', error.message);
        return;
      }

      if (normSql.startsWith('delete from friends')) {
        const { error } = await this.supabase
          .from('friends')
          .delete()
          .or(`and(senderId.eq.${params[0]},receiverId.eq.${params[1]}),and(senderId.eq.${params[2]},receiverId.eq.${params[3]})`);
        if (error) console.error('[Supabase delete friend error]:', error.message);
        return;
      }

      if (normSql.startsWith('delete from users where id =')) {
        const { error } = await this.supabase.from('users').delete().eq('id', params[0]);
        if (error) console.error('[Supabase delete user error]:', error.message);
        return;
      }

      if (normSql.startsWith('delete from') && normSql.includes('where userid =')) {
        const match = normSql.match(/delete from\s+(\w+)\s+where/);
        if (match && match[1]) {
          const tableName = match[1];
          const { error } = await this.supabase.from(tableName).delete().eq('userId', params[0]);
          if (error) console.error(`[Supabase delete all from ${tableName} error]:`, error.message);
        }
        return;
      }
    }

    if (this.initPromise) await this.initPromise;
    if (!this.client) return;
    await this.client.execute({ sql, args: params });
  }

  // ==========================================
  // DOMAIN INTERFACES & QUERIES
  // ==========================================

  // Users
  public async getUserByUsername(username: string): Promise<UserRecord | null> {
    if (this.usingSupabase) {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('username', username.toLowerCase().trim())
        .maybeSingle();
      if (error) console.error('[Supabase getUserByUsername error]:', error.message);
      return data;
    }
    const res = await this.query('SELECT * FROM users WHERE username = ?', [username]);
    return res.length > 0 ? res[0] as UserRecord : null;
  }

  public async getUserById(userId: string): Promise<UserRecord | null> {
    if (this.usingSupabase) {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) console.error('[Supabase getUserById error]:', error.message);
      return data;
    }
    const res = await this.query('SELECT * FROM users WHERE id = ?', [userId]);
    return res.length > 0 ? res[0] as UserRecord : null;
  }

  public async getAllUsers(): Promise<UserRecord[]> {
    if (this.usingSupabase) {
      const { data, error } = await this.supabase
        .from('users')
        .select('*');
      if (error) console.error('[Supabase getAllUsers error]:', error.message);
      return data || [];
    }
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
    if (this.usingSupabase) {
      const { error } = await this.supabase
        .from('users')
        .insert([{
          id,
          username: username.toLowerCase().trim(),
          passwordHash,
          salt,
          securityQuestion: securityQuestion || null,
          securityAnswerHash: securityAnswerHash || null,
          securityAnswerSalt: securityAnswerSalt || null,
          createdAt: Date.now()
        }]);
      if (error) throw new Error(error.message);
      return;
    }
    await this.run(
      'INSERT INTO users (id, username, passwordHash, salt, securityQuestion, securityAnswerHash, securityAnswerSalt, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, username, passwordHash, salt, securityQuestion || null, securityAnswerHash || null, securityAnswerSalt || null, Date.now()]
    );
  }

  // Friends
  public async getFriends(userId: string): Promise<any[]> {
    if (this.usingSupabase) {
      const { data, error } = await this.supabase
        .from('friends')
        .select(`
          id,
          status,
          senderId,
          receiverId,
          createdAt,
          sender:users!senderId(username),
          receiver:users!receiverId(username)
        `)
        .or(`senderId.eq.${userId},receiverId.eq.${userId}`);

      if (error) {
        console.error('[Supabase getFriends error]:', error.message);
        return [];
      }

      return (data || []).map((f: any) => ({
        id: f.id,
        status: f.status,
        senderId: f.senderId,
        receiverId: f.receiverId,
        createdAt: f.createdAt,
        senderUsername: f.sender?.username,
        receiverUsername: f.receiver?.username
      }));
    }
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
    if (this.usingSupabase) {
      const { data, error } = await this.supabase
        .from('friends')
        .select('*')
        .or(`and(senderId.eq.${userId1},receiverId.eq.${userId2}),and(senderId.eq.${userId2},receiverId.eq.${userId1})`)
        .maybeSingle();
      if (error) console.error('[Supabase getFriendship error]:', error.message);
      return data;
    }
    const res = await this.query(
      `SELECT * FROM friends 
       WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)`,
      [userId1, userId2, userId2, userId1]
    );
    return res.length > 0 ? res[0] : null;
  }

  public async addFriendRequest(senderId: string, receiverId: string): Promise<void> {
    if (this.usingSupabase) {
      const exists = await this.getFriendship(senderId, receiverId);
      if (exists) return;

      const { error } = await this.supabase
        .from('friends')
        .insert([{
          id: `friend-${Date.now()}-${Math.random()}`,
          senderId,
          receiverId,
          status: 'pending',
          createdAt: Date.now()
        }]);
      if (error) throw new Error(error.message);
      return;
    }
    const exists = await this.getFriendship(senderId, receiverId);
    if (exists) return;

    await this.run(
      'INSERT INTO friends (id, senderId, receiverId, status, createdAt) VALUES (?, ?, ?, ?, ?)',
      [`friend-${Date.now()}-${Math.random()}`, senderId, receiverId, 'pending', Date.now()]
    );
  }

  public async acceptFriendRequest(senderId: string, receiverId: string): Promise<void> {
    if (this.usingSupabase) {
      const { error } = await this.supabase
        .from('friends')
        .update({ status: 'accepted' })
        .or(`and(senderId.eq.${senderId},receiverId.eq.${receiverId}),and(senderId.eq.${receiverId},receiverId.eq.${senderId})`)
        .eq('status', 'pending');
      if (error) throw new Error(error.message);
      return;
    }
    await this.run(
      `UPDATE friends SET status = 'accepted' 
       WHERE ((senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)) 
         AND status = 'pending'`,
      [senderId, receiverId, receiverId, senderId]
    );
  }

  public async rejectFriendRequest(senderId: string, receiverId: string): Promise<void> {
    if (this.usingSupabase) {
      const { error } = await this.supabase
        .from('friends')
        .delete()
        .or(`and(senderId.eq.${senderId},receiverId.eq.${receiverId}),and(senderId.eq.${receiverId},receiverId.eq.${senderId})`);
      if (error) throw new Error(error.message);
      return;
    }
    await this.run(
      `DELETE FROM friends 
       WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)`,
      [senderId, receiverId, receiverId, senderId]
    );
  }

  public async getFriendStats(friendId: string): Promise<{ subjects: any[], timetable: any[], attendance: any[] }> {
    if (this.usingSupabase) {
      const [subjectsRes, timetableRes, attendanceRes] = await Promise.all([
        this.supabase.from('subjects').select('*').eq('userId', friendId),
        this.supabase.from('timetable').select('*').eq('userId', friendId),
        this.supabase.from('attendance').select('*').eq('userId', friendId)
      ]);
      return {
        subjects: subjectsRes.data || [],
        timetable: timetableRes.data || [],
        attendance: attendanceRes.data || []
      };
    }
    const subjects = await this.query('SELECT * FROM subjects WHERE userId = ?', [friendId]);
    const timetable = await this.query('SELECT * FROM timetable WHERE userId = ?', [friendId]);
    const attendance = await this.query('SELECT * FROM attendance WHERE userId = ?', [friendId]);
    return { subjects, timetable, attendance };
  }

  // ==========================================
  // DELTA SYNCHRONIZATION SUPPORT
  // ==========================================

  public async deleteRecord(userId: string, table: string, recordId: string, deletedAt: number, serverSyncTime: number): Promise<void> {
    const allowedTables = ['subjects', 'attendance', 'assignments', 'exams', 'settings', 'timetable'];
    if (!allowedTables.includes(table)) return;

    let targetId = recordId;
    if (table === 'settings' && recordId.startsWith('settings-')) {
      const key = recordId.substring('settings-'.length);
      targetId = `settings-${userId}-${key}`;
    }

    console.log(`[Sync DB] deleteRecord - user: ${userId}, table: ${table}, id: ${targetId}, deletedAt: ${deletedAt}, serverSyncTime: ${serverSyncTime}`);

    if (this.usingSupabase) {
      const { error: delErr } = await this.supabase.from(table).delete().eq('userId', userId).eq('id', targetId);
      if (delErr) throw new Error(`[Supabase deleteRecord error for ${table}]: ${delErr.message}`);
      const delId = `${userId}-${table}-${targetId}`;
      const { error: upsertErr } = await this.supabase.from('sync_deletions').upsert([{
        id: delId,
        userId,
        tableName: table,
        recordId: targetId,
        deletedAt: serverSyncTime
      }]);
      if (upsertErr) throw new Error(`[Supabase deleteRecord upsert sync_deletions error]: ${upsertErr.message}`);
      return;
    }

    await this.run(`DELETE FROM ${table} WHERE userId = ? AND id = ?`, [userId, targetId]);

    const delId = `${userId}-${table}-${targetId}`;
    await this.run(
      'INSERT OR REPLACE INTO sync_deletions (id, userId, tableName, recordId, deletedAt) VALUES (?, ?, ?, ?, ?)',
      [delId, userId, table, targetId, serverSyncTime]
    );
  }

  public async upsertRecord(userId: string, table: string, recordId: string, payload: any, updatedAt: number, serverSyncTime: number): Promise<any> {
    const allowedTables = ['subjects', 'attendance', 'assignments', 'exams', 'settings', 'timetable'];
    if (!allowedTables.includes(table)) return;

    let targetId = recordId;
    if (table === 'settings' && recordId.startsWith('settings-')) {
      const key = recordId.substring('settings-'.length);
      targetId = `settings-${userId}-${key}`;
    }

    const getEpochTimestamp = (val: any) => {
      if (!val) return Date.now();
      if (typeof val === 'string') {
        if (/^\d+$/.test(val)) return Number(val);
        const parsed = Date.parse(val);
        return isNaN(parsed) ? Date.now() : parsed;
      }
      if (typeof val === 'number') return val;
      return Date.now();
    };

    console.log(`[Sync DB] upsertRecord - user: ${userId}, table: ${table}, id: ${targetId}, clientUpdatedAt: ${updatedAt}, serverSyncTime: ${serverSyncTime}`);

    if (this.usingSupabase) {
      const { data: deletionCheck } = await this.supabase
        .from('sync_deletions')
        .select('deletedAt')
        .eq('userId', userId)
        .eq('tableName', table)
        .eq('recordId', targetId)
        .maybeSingle();

      if (deletionCheck && deletionCheck.deletedAt > updatedAt) {
        console.log(`[Sync DB Skip] Table: ${table} | recordId: ${targetId} | Skipped because deletionCheck.deletedAt (${deletionCheck.deletedAt}) > client updatedAt (${updatedAt})`);
        return { skipped: true, reason: 'deleted' };
      }

      const { data: existing } = await this.supabase
        .from(table)
        .select('updatedAt')
        .eq('userId', userId)
        .eq('id', targetId)
        .maybeSingle();

      if (existing && existing.updatedAt > updatedAt) {
        console.log(`[Sync DB Skip] Table: ${table} | recordId: ${targetId} | Skipped because existing.updatedAt (${existing.updatedAt}) > client updatedAt (${updatedAt})`);
        return { skipped: true, reason: 'newer_version_exists' };
      }

      if (deletionCheck) {
        const { error: delErr } = await this.supabase
          .from('sync_deletions')
          .delete()
          .eq('userId', userId)
          .eq('tableName', table)
          .eq('recordId', targetId);
        if (delErr) throw new Error(`[Supabase upsertRecord deletionCheck cleanup error]: ${delErr.message}`);
      }

      let parsedPayload = payload;
      if (typeof payload === 'string') {
        try {
          parsedPayload = JSON.parse(payload);
        } catch (err) {
          console.error('Failed to parse payload:', err);
        }
      }

      const effectiveUpdatedAt = updatedAt || serverSyncTime;

      if (table === 'subjects') {
        const { name, code, room, teacher, color, targetPercentage, isPinned, isArchived, icon, notes, initialPresent, initialAbsent, createdAt } = parsedPayload;
        const { error: subErr } = await this.supabase
          .from('subjects')
          .upsert([{
            id: recordId,
            userId,
            name,
            code: code || '',
            room: room || '',
            teacher: teacher || '',
            color,
            targetPercentage: targetPercentage || 75,
            isPinned: isPinned ? 1 : 0,
            isArchived: isArchived ? 1 : 0,
            icon: icon || '',
            notes: notes || '',
            initialPresent: initialPresent || 0,
            initialAbsent: initialAbsent || 0,
            createdAt: getEpochTimestamp(createdAt),
            updatedAt: effectiveUpdatedAt
          }], { onConflict: 'id' });
        if (subErr) throw new Error(`[Supabase subjects upsert error]: ${subErr.message}`);

        if (Array.isArray(parsedPayload.schedule)) {
          for (const entry of parsedPayload.schedule) {
            const entryId = entry.id || `entry-${Date.now()}-${Math.random()}`;
            const { data: existingEntry } = await this.supabase
              .from('timetable')
              .select('updatedAt')
              .eq('id', entryId)
              .maybeSingle();

            if (!existingEntry || existingEntry.updatedAt < updatedAt) {
              const { error: ttErr } = await this.supabase
                .from('timetable')
                .upsert([{
                  id: entryId,
                  userId,
                  subjectId: recordId,
                  dayOfWeek: entry.dayOfWeek,
                  time: entry.time,
                  duration: entry.duration || 60,
                  createdAt: getEpochTimestamp(entry.createdAt),
                  updatedAt: effectiveUpdatedAt
                }], { onConflict: 'id' });
              if (ttErr) throw new Error(`[Supabase timetable upsert error]: ${ttErr.message}`);
            }
          }
        }
      } 
      
      else if (table === 'timetable') {
        const { subjectId, dayOfWeek, time, duration, createdAt } = parsedPayload;
        const { error: ttErr } = await this.supabase
          .from('timetable')
          .upsert([{
            id: recordId,
            userId,
            subjectId,
            dayOfWeek,
            time,
            duration: duration || 60,
            createdAt: getEpochTimestamp(createdAt),
            updatedAt: effectiveUpdatedAt
          }], { onConflict: 'id' });
        if (ttErr) throw new Error(`[Supabase timetable upsert error]: ${ttErr.message}`);
      } 
      
      else if (table === 'attendance') {
        const { subjectId, date, status, timestamp, createdAt } = parsedPayload;

        // Auto-heal missing subject record in Supabase to prevent Foreign Key constraint (code 23503) failures
        if (subjectId) {
          const { data: subCheck } = await this.supabase
            .from('subjects')
            .select('id')
            .eq('id', subjectId)
            .maybeSingle();

          if (!subCheck) {
            console.warn(`[Supabase Attendance FK Heal] Subject ${subjectId} missing in Supabase for user ${userId}. Auto-provisioning placeholder subject...`);
            await this.supabase.from('subjects').upsert([{
              id: subjectId,
              userId,
              name: 'General Subject',
              code: '',
              color: '#4F46E5',
              targetPercentage: 75,
              updatedAt: effectiveUpdatedAt
            }], { onConflict: 'id' });
          }
        }

        const { error: attErr } = await this.supabase
          .from('attendance')
          .upsert([{
            id: recordId,
            userId,
            subjectId,
            date,
            status,
            timestamp,
            createdAt: getEpochTimestamp(createdAt),
            updatedAt: effectiveUpdatedAt
          }], { onConflict: 'id' });

        if (attErr) {
          console.error('[Supabase attendance upsert error]:', attErr.message, attErr.details, attErr.hint);
          throw new Error(`[Supabase attendance upsert error]: ${attErr.message}`);
        }
        console.log(`[Supabase Attendance Success] Upserted attendance record for user: ${userId} | recordId: ${recordId} | date: ${date} | status: ${status}`);
        return { success: true, recordId };
      } 
      
      else if (table === 'assignments') {
        const { subjectId, title, dueDate, dueTime, description, status, createdAt } = parsedPayload;
        const { error: asgErr } = await this.supabase
          .from('assignments')
          .upsert([{
            id: recordId,
            userId,
            subjectId: subjectId || null,
            title,
            dueDate,
            dueTime: dueTime || '',
            description: description || '',
            status: status || 'pending',
            createdAt: getEpochTimestamp(createdAt),
            updatedAt: serverSyncTime
          }]);
        if (asgErr) throw new Error(`[Supabase assignments upsert error]: ${asgErr.message}`);
      } 
      
      else if (table === 'exams') {
        const { subjectId, title, date, time, syllabus, room, completed, createdAt } = parsedPayload;
        const { error: exErr } = await this.supabase
          .from('exams')
          .upsert([{
            id: recordId,
            userId,
            subjectId: subjectId || null,
            title,
            date,
            time: time || '',
            syllabus: syllabus || '',
            room: room || '',
            completed: completed ? 1 : 0,
            createdAt: getEpochTimestamp(createdAt),
            updatedAt: serverSyncTime
          }]);
        if (exErr) throw new Error(`[Supabase exams upsert error]: ${exErr.message}`);
      } 
      
      else if (table === 'settings') {
        const { key, value, createdAt } = parsedPayload;
        const { error: setErr } = await this.supabase
          .from('settings')
          .upsert([{
            id: targetId,
            userId,
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
            createdAt: getEpochTimestamp(createdAt),
            updatedAt: serverSyncTime
          }]);
        if (setErr) throw new Error(`[Supabase settings upsert error]: ${setErr.message}`);
      }
      return;
    }

    const deletionCheck = await this.query(
      'SELECT deletedAt FROM sync_deletions WHERE userId = ? AND tableName = ? AND recordId = ?',
      [userId, table, targetId]
    );
    if (deletionCheck.length > 0 && deletionCheck[0].deletedAt >= updatedAt) {
      console.log(`[Sync DB SQLite Skip] Table: ${table} | recordId: ${targetId} | Skipped because deletionCheck.deletedAt (${deletionCheck[0].deletedAt}) >= client updatedAt (${updatedAt})`);
      return { skipped: true, reason: 'deleted' };
    }

    const existing = await this.query(`SELECT updatedAt FROM ${table} WHERE userId = ? AND id = ?`, [userId, targetId]);
    if (existing.length > 0 && existing[0].updatedAt >= updatedAt) {
      console.log(`[Sync DB SQLite Skip] Table: ${table} | recordId: ${targetId} | Skipped because existing.updatedAt (${existing[0].updatedAt}) >= client updatedAt (${updatedAt})`);
      return { skipped: true, reason: 'newer_version_exists' };
    }

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

    if (table === 'subjects') {
      const { name, code, room, teacher, color, targetPercentage, isPinned, isArchived, icon, notes, initialPresent, initialAbsent, createdAt } = parsedPayload;
      await this.run(
        `INSERT OR REPLACE INTO subjects (
          id, userId, name, code, room, teacher, color, targetPercentage, isPinned, isArchived, icon, notes, initialPresent, initialAbsent, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId, userId, name, code || '', room || '', teacher || '', color, targetPercentage || 75,
          isPinned ? 1 : 0, isArchived ? 1 : 0, icon || '', notes || '', initialPresent || 0, initialAbsent || 0,
          getEpochTimestamp(createdAt), serverSyncTime
        ]
      );

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
                getEpochTimestamp(entry.createdAt), serverSyncTime
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
          getEpochTimestamp(createdAt), serverSyncTime
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
          getEpochTimestamp(createdAt), serverSyncTime
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
          getEpochTimestamp(createdAt), serverSyncTime
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
          completed ? 1 : 0, getEpochTimestamp(createdAt), serverSyncTime
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
          getEpochTimestamp(createdAt), serverSyncTime
        ]
      );
    }
  }

  public async getChanges(userId: string, lastSynced: number): Promise<any[]> {
    if (this.usingSupabase) {
      const serverChanges: any[] = [];

      const [subRes, ttRes, attRes, asgRes, exRes, setRes, delRes] = await Promise.all([
        this.supabase.from('subjects').select('*').eq('userId', userId).gt('updatedAt', lastSynced),
        this.supabase.from('timetable').select('*').eq('userId', userId).gt('updatedAt', lastSynced),
        this.supabase.from('attendance').select('*').eq('userId', userId).gt('updatedAt', lastSynced),
        this.supabase.from('assignments').select('*').eq('userId', userId).gt('updatedAt', lastSynced),
        this.supabase.from('exams').select('*').eq('userId', userId).gt('updatedAt', lastSynced),
        this.supabase.from('settings').select('*').eq('userId', userId).gt('updatedAt', lastSynced),
        this.supabase.from('sync_deletions').select('*').eq('userId', userId).gt('deletedAt', lastSynced)
      ]);

      if (subRes.data) {
        for (const sub of subRes.data) {
          const { data: schedule } = await this.supabase
            .from('timetable')
            .select('id, dayOfWeek, time, duration')
            .eq('subjectId', sub.id);

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
              schedule: schedule || []
            },
            updatedAt: sub.updatedAt
          });
        }
      }

      if (ttRes.data) {
        for (const entry of ttRes.data) {
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
      }

      if (attRes.data) {
        for (const att of attRes.data) {
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
      }

      if (asgRes.data) {
        for (const asg of asgRes.data) {
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
      }

      if (exRes.data) {
        for (const ex of exRes.data) {
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
      }

      if (setRes.data) {
        for (const set of setRes.data) {
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
      }

      if (delRes.data) {
        for (const del of delRes.data) {
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
      }

      return serverChanges;
    }

    const serverChanges: any[] = [];

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
