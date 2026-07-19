import { sqliteService } from '../database/sqlite';
import { Exam } from '../types';

export class ExamRepository {
  public static async getAll(): Promise<Exam[]> {
    const res = await sqliteService.executeSql('SELECT * FROM Exams ORDER BY date ASC');
    const list: Exam[] = [];

    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows.item(i);
      list.push({
        id: row.id,
        subjectId: row.subjectId,
        title: row.title,
        date: row.date,
        time: row.time || undefined,
        syllabus: row.syllabus || undefined,
        room: row.room || undefined,
        completed: row.completed === 1
      });
    }
    return list;
  }

  public static async save(ex: Exam): Promise<void> {
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
      ]
    );
  }

  public static async delete(id: string): Promise<void> {
    await sqliteService.executeSql('DELETE FROM Exams WHERE id = ?', [id]);
  }
}
