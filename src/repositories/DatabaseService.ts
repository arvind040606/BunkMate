import { sqliteService } from '../database/sqlite';
import { runSchemaMigrations } from '../database/migrations';

export class DatabaseService {
  private static instance: DatabaseService;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = (async () => {
      try {
        await runSchemaMigrations();
        console.log('DatabaseService: Relational Schema verified & migrated successfully.');
      } catch (err) {
        console.error('DatabaseService: Failed to initialize schema migrations:', err);
        this.initPromise = null; // Reset on failure so it can be retried
        throw err;
      }
    })();
    return this.initPromise;
  }

  public async clearAllData(): Promise<void> {
    const tables = [
      'Subjects',
      'Attendance',
      'Assignments',
      'Exams',
      'Timetable',
      'Notifications',
      'Achievements',
      'Settings',
      'AITimetableHistory',
      'AttendanceHistory',
      'BackupMetadata'
    ];
    for (const table of tables) {
      await sqliteService.executeSql(`DELETE FROM ${table}`);
    }
  }
}

export const databaseService = DatabaseService.getInstance();
