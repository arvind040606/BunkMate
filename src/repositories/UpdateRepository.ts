import { VersionInfo } from '../utils/updateService';

export class UpdateRepository {
  private static CACHE_KEY = 'bunkmate_cached_update_info';
  private static LAST_CHECK_KEY = 'bunkmate_last_update_check_time';

  public static getCachedUpdate(): VersionInfo | null {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('[UpdateRepository] Failed to get cached update:', err);
      return null;
    }
  }

  public static saveCachedUpdate(info: VersionInfo): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(info));
    } catch (err) {
      console.error('[UpdateRepository] Failed to save cached update:', err);
    }
  }

  public static getLastCheckTime(): number {
    try {
      const raw = localStorage.getItem(this.LAST_CHECK_KEY);
      return raw ? parseInt(raw, 10) : 0;
    } catch {
      return 0;
    }
  }

  public static saveLastCheckTime(time: number): void {
    try {
      localStorage.setItem(this.LAST_CHECK_KEY, time.toString());
    } catch {}
  }
}
