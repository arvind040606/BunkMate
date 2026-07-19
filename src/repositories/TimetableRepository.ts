import { sqliteService } from '../database/sqlite';
import { ScheduleEntry } from '../types';

export class TimetableRepository {
  public static async getBySubject(subjectId: string): Promise<ScheduleEntry[]> {
    const res = await sqliteService.executeSql('SELECT * FROM Timetable WHERE subjectId = ? ORDER BY dayOfWeek, time', [subjectId]);
    const entries: ScheduleEntry[] = [];

    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows.item(i);
      entries.push({
        id: row.id,
        dayOfWeek: Number(row.dayOfWeek),
        time: row.time,
        duration: row.duration ? Number(row.duration) : undefined
      });
    }
    return entries;
  }

  public static async saveEntry(subjectId: string, entry: ScheduleEntry): Promise<void> {
    await sqliteService.executeSql(
      'INSERT OR REPLACE INTO Timetable (id, subjectId, dayOfWeek, time, duration, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        entry.id || `entry-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        subjectId,
        entry.dayOfWeek,
        entry.time,
        entry.duration || 60,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
  }

  public static async deleteEntry(id: string): Promise<void> {
    await sqliteService.executeSql('DELETE FROM Timetable WHERE id = ?', [id]);
  }
}
