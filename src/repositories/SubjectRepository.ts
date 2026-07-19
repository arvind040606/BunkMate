import { sqliteService } from '../database/sqlite';
import { Subject, ScheduleEntry } from '../types';

export class SubjectRepository {
  public static async getAll(): Promise<Subject[]> {
    const subjectsRes = await sqliteService.executeSql('SELECT * FROM Subjects');
    const scheduleRes = await sqliteService.executeSql('SELECT * FROM Timetable');

    const subjects: Subject[] = [];
    const schedulesBySubject: { [subjId: string]: ScheduleEntry[] } = {};

    // Group schedules
    for (let i = 0; i < scheduleRes.rows.length; i++) {
      const row = scheduleRes.rows.item(i);
      const entry: ScheduleEntry = {
        id: row.id,
        dayOfWeek: Number(row.dayOfWeek),
        time: row.time,
        duration: row.duration ? Number(row.duration) : undefined
      };
      if (!schedulesBySubject[row.subjectId]) {
        schedulesBySubject[row.subjectId] = [];
      }
      schedulesBySubject[row.subjectId].push(entry);
    }

    // Map subjects
    for (let i = 0; i < subjectsRes.rows.length; i++) {
      const row = subjectsRes.rows.item(i);
      subjects.push({
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
      });
    }

    return subjects;
  }

  public static async save(sub: Subject): Promise<void> {
    const isPinnedVal = sub.isPinned ? 1 : 0;
    const isArchivedVal = sub.isArchived ? 1 : 0;

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
        isPinnedVal,
        isArchivedVal,
        sub.icon || '',
        sub.notes || '',
        sub.initialPresent || 0,
        sub.initialAbsent || 0,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );

    // Sync schedules
    await sqliteService.executeSql('DELETE FROM Timetable WHERE subjectId = ?', [sub.id]);
    if (sub.schedule && Array.isArray(sub.schedule)) {
      for (const entry of sub.schedule) {
        await sqliteService.executeSql(
          'INSERT INTO Timetable (id, subjectId, dayOfWeek, time, duration, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            entry.id || `entry-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            sub.id,
            entry.dayOfWeek,
            entry.time,
            entry.duration || 60,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        );
      }
    }
  }

  public static async delete(id: string): Promise<void> {
    await sqliteService.executeSql('DELETE FROM Subjects WHERE id = ?', [id]);
    await sqliteService.executeSql('DELETE FROM Timetable WHERE subjectId = ?', [id]);
    await sqliteService.executeSql('DELETE FROM Attendance WHERE subjectId = ?', [id]);
    await sqliteService.executeSql('DELETE FROM Exams WHERE subjectId = ?', [id]);
    await sqliteService.executeSql('DELETE FROM Assignments WHERE subjectId = ?', [id]);
  }
}
