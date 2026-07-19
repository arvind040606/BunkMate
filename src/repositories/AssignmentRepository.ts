import { sqliteService } from '../database/sqlite';
import { Assignment } from '../types';

export class AssignmentRepository {
  public static async getAll(): Promise<Assignment[]> {
    const res = await sqliteService.executeSql('SELECT * FROM Assignments ORDER BY dueDate ASC');
    const list: Assignment[] = [];

    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows.item(i);
      list.push({
        id: row.id,
        subjectId: row.subjectId,
        title: row.title,
        dueDate: row.dueDate,
        dueTime: row.dueTime || undefined,
        description: row.description || undefined,
        status: row.status as any
      });
    }
    return list;
  }

  public static async save(asg: Assignment): Promise<void> {
    await sqliteService.executeSql(
      'INSERT OR REPLACE INTO Assignments (id, subjectId, title, dueDate, dueTime, description, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        asg.id,
        asg.subjectId,
        asg.title,
        asg.dueDate,
        asg.dueTime || '',
        asg.description || '',
        asg.status,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );
  }

  public static async delete(id: string): Promise<void> {
    await sqliteService.executeSql('DELETE FROM Assignments WHERE id = ?', [id]);
  }
}
