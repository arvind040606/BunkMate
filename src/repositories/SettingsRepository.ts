import { sqliteService } from '../database/sqlite';
import { AppPreferences } from '../types';
import { appPreferencesStore } from '../utils/preferences';
import { db } from '../utils/db';

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
      const prefs: any = { ...DEFAULT_PREFS };
      const PREFS_KEYS = [
        ...Object.keys(DEFAULT_PREFS),
        'syncEnabled',
        'syncUsername',
        'syncToken',
        'syncUserId',
        'syncLastSynced',
        'syncLastSyncedLocal',
        'syncSessionExpired',
        'lastLoggedUserId'
      ];
      PREFS_KEYS.forEach(key => {
        const storedVal = appPreferencesStore.getItem(key);
        if (storedVal !== null) {
          try {
            prefs[key] = JSON.parse(storedVal);
          } catch {
            prefs[key] = storedVal;
          }
        }
      });

      const res = await sqliteService.executeSql('SELECT key, value FROM Settings');
      
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
      if (value === undefined || value === null) {
        appPreferencesStore.removeItem(key);
      } else {
        appPreferencesStore.setItem(key, JSON.stringify(value));
      }
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
    // Sync to in-memory db cache
    const currentPrefs = db.getPrefs();
    await db.savePrefs({ ...currentPrefs, ...prefs }, false);
  }
}
