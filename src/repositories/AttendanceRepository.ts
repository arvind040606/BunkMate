import { sqliteService } from '../database/sqlite';
import { AttendanceRecord } from '../types';

export class AttendanceRepository {
  public static async getAll(): Promise<AttendanceRecord[]> {
    const res = await sqliteService.executeSql('SELECT * FROM Attendance ORDER BY timestamp DESC');
    const records: AttendanceRecord[] = [];

    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows.item(i);
      records.push({
        id: row.id,
        subjectId: row.subjectId,
        date: row.date,
        status: row.status as any,
        timestamp: Number(row.timestamp)
      });
    }
    return records;
  }

  public static async save(record: AttendanceRecord): Promise<void> {
    const nowTs = Date.now();
    await sqliteService.executeSql(
      'INSERT OR REPLACE INTO Attendance (id, subjectId, date, status, timestamp, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        record.id,
        record.subjectId,
        record.date,
        record.status,
        record.timestamp,
        new Date().toISOString(),
        nowTs
      ]
    );
  }

  public static async delete(id: string): Promise<void> {
    await sqliteService.executeSql('DELETE FROM Attendance WHERE id = ?', [id]);
  }

  public static async clear(): Promise<void> {
    await sqliteService.executeSql('DELETE FROM Attendance');
  }
}
