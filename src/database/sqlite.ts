/**
 * Production-Grade Cross-Platform SQLite Engine
 * Powered by @capacitor-community/sqlite.
 * Implements real SQLite on native platforms (Android/iOS) and SQL.js WebAssembly on Web (with IndexedDB persistence).
 */

import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

export interface SQLResultSet {
  insertId?: string | number;
  rowsAffected: number;
  rows: {
    item(index: number): any;
    length: number;
    _array: any[];
  };
}

export type SQLTransactionCallback = (tx: SQLTransaction) => void | Promise<void>;
export type SQLTransactionErrorCallback = (error: Error) => void;

export interface SQLTransaction {
  executeSql(
    sqlStatement: string,
    args?: any[],
    successCallback?: (tx: SQLTransaction, result: SQLResultSet) => void,
    errorCallback?: (tx: SQLTransaction, error: Error) => boolean
  ): void;
}

export class SQLiteDatabaseService {
  private sqliteConnection: SQLiteConnection | null = null;
  private dbConn: SQLiteDBConnection | null = null;
  private isInitialized = false;
  private isWebFallback = false;
  private initPromise: Promise<void> | null = null;
  private inTransaction = false;
  private queryQueue: Promise<any> = Promise.resolve();

  constructor() {
    this.initPromise = this.init();
  }

  private async runSequentially<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queryQueue.then(fn);
    this.queryQueue = next.catch(() => {});
    return next;
  }

  public async getConn(): Promise<SQLiteDBConnection> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (this.isWebFallback || !this.dbConn) {
      throw new Error('Database connection running in Web memory fallback mode.');
    }
    return this.dbConn;
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.sqliteConnection = new SQLiteConnection(CapacitorSQLite);

      if (Capacitor.getPlatform() === 'web') {
        try {
          // Register jeep-sqlite custom element if on web
          const { defineCustomElements } = await import('jeep-sqlite/loader');
          await defineCustomElements(window);

          let jeepEl = document.querySelector('jeep-sqlite');
          if (!jeepEl) {
            jeepEl = document.createElement('jeep-sqlite');
            document.body.appendChild(jeepEl);
          }
          await customElements.whenDefined('jeep-sqlite');
          await this.sqliteConnection.initWebStore();
        } catch (webErr) {
          console.warn('[SQLite Init] Web jeep-sqlite loader failed, switching to web memory fallback:', webErr);
          this.isWebFallback = true;
          this.isInitialized = true;
          return;
        }
      }

      // Open database connection
      const isConn = await this.sqliteConnection.isConnection('bunkmate', false);
      if (isConn.result) {
        this.dbConn = await this.sqliteConnection.retrieveConnection('bunkmate', false);
      } else {
        this.dbConn = await this.sqliteConnection.createConnection('bunkmate', false, 'no-encryption', 1, false);
      }

      const isOpenRes = await this.dbConn.isDBOpen();
      if (!isOpenRes.result) {
        await this.dbConn.open();
      }
      
      // Enable foreign keys
      await this.dbConn.execute('PRAGMA foreign_keys = ON;');
      
      // Perform automated database integrity verification
      try {
        const integrityCheckRes = await this.dbConn.query('PRAGMA integrity_check;');
        const integrityStatus = integrityCheckRes?.values?.[0]?.integrity_check;
        console.log(`[SQLite Init] Integrity status check: ${integrityStatus}`);
      } catch (corruptionErr) {
        console.warn('[SQLite Init] Integrity check query warning (database preserved):', corruptionErr);
      }
      
      // Ensure all core relational tables exist on database initialization
      await this.ensureCoreTablesExist();

      this.isInitialized = true;
    } catch (err) {
      console.warn('Failed to initialize Capacitor SQLite, enabling web memory fallback:', err);
      this.isWebFallback = true;
      this.isInitialized = true;
    }
  }

  private async ensureCoreTablesExist(): Promise<void> {
    if (!this.dbConn) return;
    const coreTables = [
      `CREATE TABLE IF NOT EXISTS Settings (id TEXT PRIMARY KEY, key TEXT UNIQUE NOT NULL, value TEXT NOT NULL, createdAt TEXT, updatedAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS Subjects (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT, room TEXT, teacher TEXT, color TEXT NOT NULL, targetPercentage INTEGER DEFAULT 75, isPinned INTEGER DEFAULT 0, isArchived INTEGER DEFAULT 0, icon TEXT, notes TEXT, initialPresent INTEGER DEFAULT 0, initialAbsent INTEGER DEFAULT 0, createdAt TEXT, updatedAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS Attendance (id TEXT PRIMARY KEY, subjectId TEXT NOT NULL, date TEXT NOT NULL, status TEXT NOT NULL, timestamp INTEGER NOT NULL, createdAt TEXT, updatedAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS Assignments (id TEXT PRIMARY KEY, subjectId TEXT NOT NULL, title TEXT NOT NULL, dueDate TEXT NOT NULL, dueTime TEXT, description TEXT, status TEXT DEFAULT 'pending', createdAt TEXT, updatedAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS Exams (id TEXT PRIMARY KEY, subjectId TEXT NOT NULL, title TEXT NOT NULL, date TEXT NOT NULL, time TEXT, syllabus TEXT, room TEXT, completed INTEGER DEFAULT 0, createdAt TEXT, updatedAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS Timetable (id TEXT PRIMARY KEY, subjectId TEXT NOT NULL, dayOfWeek INTEGER NOT NULL, time TEXT NOT NULL, duration INTEGER, createdAt TEXT, updatedAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS Notifications (id TEXT PRIMARY KEY, title TEXT NOT NULL, message TEXT NOT NULL, timestamp INTEGER NOT NULL, type TEXT NOT NULL, read INTEGER DEFAULT 0, createdAt TEXT, updatedAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS Achievements (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, unlockedAt INTEGER, createdAt TEXT, updatedAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS sync_deletions (id TEXT PRIMARY KEY, tableName TEXT NOT NULL, recordId TEXT NOT NULL, deletedAt INTEGER NOT NULL);`,
      `CREATE TABLE IF NOT EXISTS AITimetableHistory (id TEXT PRIMARY KEY, rawText TEXT, parsedData TEXT, timestamp INTEGER, createdAt TEXT, updatedAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS AttendanceHistory (id TEXT PRIMARY KEY, action TEXT, subjectId TEXT, date TEXT, status TEXT, timestamp INTEGER, createdAt TEXT, updatedAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS BackupMetadata (id TEXT PRIMARY KEY, filename TEXT, timestamp INTEGER, type TEXT, checksum TEXT, createdAt TEXT, updatedAt TEXT);`,
      `CREATE TABLE IF NOT EXISTS FriendAttendance (username TEXT PRIMARY KEY, stats TEXT NOT NULL, updatedAt INTEGER NOT NULL);`,
      `CREATE INDEX IF NOT EXISTS idx_attendance_subject ON Attendance (subjectId);`,
      `CREATE INDEX IF NOT EXISTS idx_timetable_subject ON Timetable (subjectId);`,
      `CREATE INDEX IF NOT EXISTS idx_exams_subject ON Exams (subjectId);`,
      `CREATE INDEX IF NOT EXISTS idx_assignments_subject ON Assignments (subjectId);`,
      `CREATE INDEX IF NOT EXISTS idx_settings_key ON Settings (key);`
    ];

    for (const sql of coreTables) {
      try {
        await this.dbConn.run(sql, [], false);
      } catch (e) {
        console.warn('[SQLite Emergency Table Init Warning]:', e);
      }
    }
  }

  public async executeSql(sql: string, params: any[] = [], shouldSave = true): Promise<SQLResultSet> {
    if (this.inTransaction) {
      return this.executeSqlInternal(sql, params, shouldSave);
    }
    return this.runSequentially(() => this.executeSqlInternal(sql, params, shouldSave));
  }

  private async executeSqlInternal(sql: string, params: any[] = [], shouldSave = true, isRetry = false): Promise<SQLResultSet> {
    if (this.isWebFallback || !this.dbConn) {
      return {
        insertId: undefined,
        rowsAffected: 0,
        rows: {
          item: () => null,
          length: 0,
          _array: []
        }
      };
    }
    const conn = await this.getConn();
    const cleanSql = sql.trim();
    const isSelect = cleanSql.toUpperCase().startsWith('SELECT') || cleanSql.toUpperCase().startsWith('PRAGMA');

    try {
      if (isSelect) {
        const res = await conn.query(cleanSql, params);
        const rows = res.values || [];
        return {
          rowsAffected: 0,
          rows: {
            item: (i: number) => rows[i],
            length: rows.length,
            _array: rows
          }
        };
      } else {
        // Since we are running a mutation query, run it with conn.run.
        // If we are already in a transaction, disable the auto-transaction parameter.
        const useTransaction = !this.inTransaction;
        const res = await conn.run(cleanSql, params, useTransaction);
        const rowsAffected = res.changes?.changes || 0;
        const insertId = res.changes?.lastId;

        // Persist to store if on web
        if (shouldSave && !this.inTransaction && Capacitor.getPlatform() === 'web' && this.sqliteConnection) {
          await this.sqliteConnection.saveToStore('bunkmate');
        }

        return {
          insertId,
          rowsAffected,
          rows: {
            item: () => null,
            length: 0,
            _array: []
          }
        };
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (!isRetry && errMsg.includes('no such table')) {
        console.warn(`[SQLite Self-Healing] Missing table detected (${errMsg}). Auto-creating schema tables and retrying query...`);
        try {
          await this.ensureCoreTablesExist();
          return await this.executeSqlInternal(sql, params, shouldSave, true);
        } catch (retryErr) {
          console.error('[SQLite Self-Healing] Retry after auto-creation failed:', retryErr);
        }
      }
      console.error(`SQL Error executing [${sql}] with params ${JSON.stringify(params)}:`, err);
      throw err;
    }
  }

  public async executeBatch(statements: string, shouldSave = true): Promise<void> {
    if (this.inTransaction) {
      return this.executeBatchInternal(statements, shouldSave);
    }
    return this.runSequentially(() => this.executeBatchInternal(statements, shouldSave));
  }

  private async executeBatchInternal(statements: string, shouldSave = true): Promise<void> {
    if (this.isWebFallback || !this.dbConn) return;
    const conn = await this.getConn();
    const useTransaction = !this.inTransaction;

    // Split statements by semicolon and filter out empty entries
    const individualStatements = statements
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    if (useTransaction) {
      await conn.beginTransaction();
    }

    try {
      for (const statement of individualStatements) {
        await conn.execute(statement + ';', false);
      }
      if (useTransaction) {
        await conn.commitTransaction();
      }
    } catch (err) {
      if (useTransaction) {
        try {
          await conn.rollbackTransaction();
        } catch (rollbackErr) {
          console.error('Failed to rollback batch transaction:', rollbackErr);
        }
      }
      throw err;
    }

    if (shouldSave && !this.inTransaction && Capacitor.getPlatform() === 'web' && this.sqliteConnection) {
      await this.sqliteConnection.saveToStore('bunkmate');
    }
  }

  public async saveToStore(): Promise<void> {
    if (this.isWebFallback || !this.dbConn) return;
    if (Capacitor.getPlatform() === 'web' && this.sqliteConnection) {
      await this.sqliteConnection.saveToStore('bunkmate');
    }
  }

  public async transaction(
    callback: SQLTransactionCallback,
    errorCallback?: SQLTransactionErrorCallback,
    successCallback?: () => void
  ): Promise<void> {
    return this.runSequentially(() => this.transactionInternal(callback, errorCallback, successCallback));
  }

  private async transactionInternal(
    callback: SQLTransactionCallback,
    errorCallback?: SQLTransactionErrorCallback,
    successCallback?: () => void
  ): Promise<void> {
    if (this.isWebFallback || !this.dbConn) {
      const tx: SQLTransaction = {
        executeSql: (sqlStatement, args = [], successCb) => {
          if (successCb) successCb(tx, { rowsAffected: 0, rows: { item: () => null, length: 0, _array: [] } });
        }
      };
      await callback(tx);
      if (successCallback) successCallback();
      return;
    }
    const conn = await this.getConn();
    const wasInTransaction = this.inTransaction;
    try {
      if (!wasInTransaction) {
        await conn.beginTransaction();
        this.inTransaction = true;
      }

      const tx: SQLTransaction = {
        executeSql: (sqlStatement, args = [], successCb, errorCb) => {
          this.executeSql(sqlStatement, args, false)
            .then(res => {
              if (successCb) successCb(tx, res);
            })
            .catch(err => {
              const shouldSuppress = errorCb ? errorCb(tx, err) : false;
              if (!shouldSuppress) {
                throw err;
              }
            });
        }
      };

      await callback(tx);

      if (!wasInTransaction) {
        await conn.commitTransaction();
        this.inTransaction = false;
        
        if (Capacitor.getPlatform() === 'web' && this.sqliteConnection) {
          await this.sqliteConnection.saveToStore('bunkmate');
        }
      }

      if (successCallback) successCallback();
    } catch (err: any) {
      console.error('Transaction failed, rolling back:', err);
      if (!wasInTransaction) {
        try {
          await conn.rollbackTransaction();
        } catch (rollbackErr) {
          console.error('Failed to rollback transaction:', rollbackErr);
        }
        this.inTransaction = false;
      }
      if (errorCallback) errorCallback(err);
      throw err;
    }
  }

  public async performIntegrityCheck(): Promise<boolean> {
    try {
      const conn = await this.getConn();
      const check = await conn.query('PRAGMA integrity_check;');
      return check?.values?.[0]?.integrity_check === 'ok';
    } catch {
      return false;
    }
  }
}

export const sqliteService = new SQLiteDatabaseService();
