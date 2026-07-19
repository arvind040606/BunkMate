import { sqliteService } from '../database/sqlite';
import { AppPreferences } from '../types';

const DEFAULT_PREFS: AppPreferences = {
  globalTarget: 75,
  hapticsEnabled: true,
  notificationsEnabled: true,
  pinLockEnabled: false,
  soundEnabled: true,
  weekendClassesEnabled: true,
  activeNotificationDays: [0, 1, 2, 3, 4, 5, 6],
  examRemindersEnabled: true,
  assignmentDeadlinesEnabled: true,
  appUpdatesEnabled: true,
  manualRemindersEnabled: true,
  collegeStartTime: '09:00',
  collegeEndTime: '17:00',
  dailyClassRemindersEnabled: true,
};

export class SettingsRepository {
  public static async getPrefs(): Promise<AppPreferences> {
    try {
      const res = await sqliteService.executeSql('SELECT key, value FROM Settings');
      const prefs: any = { ...DEFAULT_PREFS };
      
      for (let i = 0; i < res.rows.length; i++) {
        const row = res.rows.item(i);
        try {
          prefs[row.key] = JSON.parse(row.value);
        } catch {
          // Fallback if not JSON
          prefs[row.key] = row.value;
        }
      }
      return prefs as AppPreferences;
    } catch {
      return DEFAULT_PREFS;
    }
  }

  public static async savePrefs(prefs: Partial<AppPreferences>): Promise<void> {
    const entries = Object.entries(prefs);
    for (const [key, value] of entries) {
      await sqliteService.executeSql(
        'INSERT OR REPLACE INTO Settings (id, key, value, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
        [
          `settings-${key}`,
          key,
          JSON.stringify(value),
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );
    }
  }
}
