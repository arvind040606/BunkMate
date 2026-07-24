import { supabase } from '../utils/supabaseClient';
import { ReleaseHistoryItem, ReleaseChannel } from '../types/updateTypes';

export class ReleaseHistoryRepository {
  private static HISTORY_CACHE_KEY = 'bunkmate_cached_release_history';

  /**
   * Fetches release history items from Supabase release_history table.
   * If table or network fails, falls back gracefully to offline cached history.
   */
  public static async fetchReleaseHistory(channel: ReleaseChannel = 'stable'): Promise<ReleaseHistoryItem[]> {
    try {
      console.log('[ReleaseHistoryRepository] Querying Supabase release_history table...');
      const { data, error } = await supabase
        .from('release_history')
        .select('*')
        .order('release_date', { ascending: false });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        return this.getCachedHistory();
      }

      const items: ReleaseHistoryItem[] = data
        .filter((row: any) => !row.release_channel || row.release_channel === channel || channel === 'developer')
        .map((row: any) => ({
          id: row.id || `rel-${row.version || Math.random()}`,
          version: String(row.version || '1.0.0').trim(),
          title: row.title || `BunkMate ${row.version || ''}`,
          releaseNotes: row.release_notes || 'General updates and improvements.',
          releaseDate: row.release_date || row.created_at || new Date().toISOString(),
          apkUrl: row.apk_url || row.google_drive_apk_url || '',
          size: row.size || '15.5 MB',
          critical: !!row.critical,
          releaseChannel: (row.release_channel as ReleaseChannel) || 'stable',
          createdAt: row.created_at || new Date().toISOString()
        }));

      this.saveCachedHistory(items);
      return items;
    } catch (err: any) {
      console.warn('[ReleaseHistoryRepository] Live history fetch warning:', err?.message || err);
      return this.getCachedHistory();
    }
  }

  /**
   * Retrieves cached release history from local storage.
   */
  public static getCachedHistory(): ReleaseHistoryItem[] {
    try {
      const raw = localStorage.getItem(this.HISTORY_CACHE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Saves release history list to local storage.
   */
  public static saveCachedHistory(items: ReleaseHistoryItem[]): void {
    try {
      localStorage.setItem(this.HISTORY_CACHE_KEY, JSON.stringify(items));
    } catch {}
  }
}
