import { sqliteService } from '../database/sqlite';
import { SubjectRepository } from './SubjectRepository';
import { AttendanceRepository } from './AttendanceRepository';
import { SettingsRepository } from './SettingsRepository';
import { NotificationRepository } from './NotificationRepository';
import { ExamRepository } from './ExamRepository';
import { AssignmentRepository } from './AssignmentRepository';

import { CURRENT_APP_VERSION } from '../utils/updateService';

export class BackupRepository {
  public static async generateBackupData(): Promise<string> {
    const backup = {
      app: 'BunkMate',
      version: CURRENT_APP_VERSION,
      timestamp: Date.now(),
      subjects: await SubjectRepository.getAll(),
      records: await AttendanceRepository.getAll(),
      preferences: await SettingsRepository.getPrefs(),
      notifications: await NotificationRepository.getAll(),
      exams: await ExamRepository.getAll(),
      assignments: await AssignmentRepository.getAll()
    };
    return JSON.stringify(backup, null, 2);
  }

  public static async logBackupMetadata(filename: string, type: 'plain' | 'encrypted', checksum?: string): Promise<void> {
    const id = `backup-${Date.now()}`;
    await sqliteService.executeSql(
      'INSERT INTO BackupMetadata (id, filename, timestamp, type, checksum, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        filename,
        Date.now(),
        type,
        checksum || '',
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
  }

  public static async restoreBackupData(parsed: any): Promise<boolean> {
    if (parsed.app !== 'BunkMate' || !Array.isArray(parsed.subjects) || !Array.isArray(parsed.records)) {
      return false;
    }

    // Backup before overwrite transaction
    const tx = async () => {
      // Clean everything
      await sqliteService.executeSql('DELETE FROM Subjects');
      await sqliteService.executeSql('DELETE FROM Timetable');
      await sqliteService.executeSql('DELETE FROM Attendance');
      await sqliteService.executeSql('DELETE FROM Exams');
      await sqliteService.executeSql('DELETE FROM Assignments');
      await sqliteService.executeSql('DELETE FROM Notifications');

      // 1. Insert subjects & timetable
      for (const sub of parsed.subjects) {
        await SubjectRepository.save(sub);
      }

      // 2. Insert records
      for (const rec of parsed.records) {
        await AttendanceRepository.save(rec);
      }

      // 3. Insert preferences
      if (parsed.preferences) {
        await SettingsRepository.savePrefs(parsed.preferences);
      }

      // 4. Insert exams
      if (Array.isArray(parsed.exams)) {
        for (const ex of parsed.exams) {
          await ExamRepository.save(ex);
        }
      }

      // 5. Insert assignments
      if (Array.isArray(parsed.assignments)) {
        for (const asg of parsed.assignments) {
          await AssignmentRepository.save(asg);
        }
      }

      // 6. Insert notifications
      if (Array.isArray(parsed.notifications)) {
        for (const notif of parsed.notifications) {
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
            ]
          );
        }
      }
    };

    try {
      await sqliteService.transaction(tx);
      return true;
    } catch (err) {
      console.error('Backup restore transaction failed:', err);
      return false;
    }
  }
}
