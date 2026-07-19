import { sqliteService } from '../database/sqlite';
import { NotificationItem } from '../types';

export class NotificationRepository {
  public static async getAll(): Promise<NotificationItem[]> {
    const res = await sqliteService.executeSql('SELECT * FROM Notifications ORDER BY timestamp DESC');
    const list: NotificationItem[] = [];

    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows.item(i);
      list.push({
        id: row.id,
        title: row.title,
        message: row.message,
        timestamp: Number(row.timestamp),
        type: row.type as any,
        read: row.read === 1
      });
    }
    return list;
  }

  public static async add(title: string, message: string, type: 'warning' | 'success' | 'info' | 'danger'): Promise<NotificationItem> {
    const item: NotificationItem = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title,
      message,
      timestamp: Date.now(),
      type,
      read: false
    };

    await sqliteService.executeSql(
      'INSERT INTO Notifications (id, title, message, timestamp, type, read, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        item.id,
        item.title,
        item.message,
        item.timestamp,
        item.type,
        0,
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );

    // Limit to 50 rows
    const list = await this.getAll();
    if (list.length > 50) {
      const toDelete = list.slice(50);
      for (const d of toDelete) {
        await sqliteService.executeSql('DELETE FROM Notifications WHERE id = ?', [d.id]);
      }
    }

    return item;
  }

  public static async markAsRead(id: string): Promise<void> {
    await sqliteService.executeSql('UPDATE Notifications SET read = 1 WHERE id = ?', [id]);
  }

  public static async markAllAsRead(): Promise<void> {
    await sqliteService.executeSql('UPDATE Notifications SET read = 1');
  }

  public static async clearAll(): Promise<void> {
    await sqliteService.executeSql('DELETE FROM Notifications');
  }
}
