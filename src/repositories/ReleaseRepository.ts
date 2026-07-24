import { supabase } from '../utils/supabaseClient';
import { ReleaseInfo, ReleaseChannel, ReleasePriority } from '../types/updateTypes';
import { VersionChecker } from '../utils/versionChecker';

export class ReleaseRepository {
  private static CACHE_KEY = 'bunkmate_cached_release_info';
  private static LAST_CHECK_KEY = 'bunkmate_last_release_check_time';
  private static CHANNEL_KEY = 'bunkmate_selected_release_channel';

  /**
   * Fetches latest release information from Supabase latest_updates table.
   * If channel is specified, fetches for that channel; defaults to 'stable'.
   * Safely handles missing fields and invalid data formats without crashing.
   */
  public static async fetchLatestRelease(channel: ReleaseChannel = 'stable'): Promise<{ info: ReleaseInfo | null; isOffline: boolean }> {
    try {
      console.log(`[ReleaseRepository] Querying Supabase latest_updates for channel: ${channel}...`);
      
      // Query Supabase latest_updates ordered by updated_at (or release_date) descending
      let query = supabase
        .from('latest_updates')
        .select('*')
        .order('updated_at', { ascending: false });

      // If release_channel column exists, filter by channel or fallback to stable
      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        throw new Error('No records found in Supabase latest_updates table');
      }

      // Find matching channel item, or fallback to the top record
      const match = data.find((row: any) => (row.release_channel || 'stable').toLowerCase() === channel.toLowerCase()) || data[0];

      const info: ReleaseInfo = {
        id: match.id || undefined,
        latestVersion: match.latest_version ? String(match.latest_version).trim() : '1.0.0',
        minimumSupportedVersion: VersionChecker.clean(match.minimum_supported_version) || '1.0.0',
        googleDriveApkUrl: match.google_drive_apk_url || match.download_url || '',
        releaseNotes: match.release_notes || 'Performance improvements and bug fixes.',
        releaseTitle: match.release_title || `BunkMate ${match.latest_version || ''}`,
        releaseDate: match.release_date || match.created_at || new Date().toISOString(),
        forceUpdate: !!match.force_update,
        maintenanceMode: !!match.maintenance_mode,
        maintenanceMessage: match.maintenance_message || 'System maintenance in progress. Please check back shortly.',
        developerEmail: match.developer_email || 'arvindmadaan04@gmail.com',
        appLicense: match.app_license || 'MIT License',
        releaseChannel: (match.release_channel as ReleaseChannel) || channel || 'stable',
        releasePriority: (match.release_priority as ReleasePriority) || 'medium',
        rolloutPercentage: typeof match.rollout_percentage === 'number' ? match.rollout_percentage : 100,
        mandatoryAfter: match.mandatory_after || undefined,
        createdAt: match.created_at || undefined,
        updatedAt: match.updated_at || undefined,
      };

      // Save to local cache & update last check timestamp
      this.saveCachedRelease(info);
      this.saveLastCheckTime(Date.now());

      return { info, isOffline: false };
    } catch (err: any) {
      console.warn('[ReleaseRepository] Failed to fetch live release info from Supabase:', err?.message || err);
      // Fallback to offline cache
      const cached = this.getCachedRelease();
      if (cached) {
        console.log('[ReleaseRepository] Offline Fallback: Serving cached release info.');
        return { info: cached, isOffline: true };
      }
      return { info: null, isOffline: true };
    }
  }

  /**
   * Retrieves cached release info from local storage.
   */
  public static getCachedRelease(): ReleaseInfo | null {
    try {
      const raw = localStorage.getItem(this.CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('[ReleaseRepository] Error reading cached release info:', err);
      return null;
    }
  }

  /**
   * Saves release info to local storage.
   */
  public static saveCachedRelease(info: ReleaseInfo): void {
    try {
      localStorage.setItem(this.CACHE_KEY, JSON.stringify(info));
    } catch (err) {
      console.error('[ReleaseRepository] Error saving cached release info:', err);
    }
  }

  /**
   * Gets last checked timestamp.
   */
  public static getLastCheckTime(): number {
    try {
      const raw = localStorage.getItem(this.LAST_CHECK_KEY);
      return raw ? parseInt(raw, 10) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Saves last checked timestamp.
   */
  public static saveLastCheckTime(time: number): void {
    try {
      localStorage.setItem(this.LAST_CHECK_KEY, time.toString());
    } catch {}
  }

  /**
   * Selected Release Channel getter and setter.
   */
  private static inMemoryChannel: ReleaseChannel = 'stable';

  public static getSelectedChannel(): ReleaseChannel {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.CHANNEL_KEY);
        if (stored === 'beta' || stored === 'developer' || stored === 'stable') {
          return stored;
        }
      }
    } catch {}
    return this.inMemoryChannel || 'stable';
  }

  public static setSelectedChannel(channel: ReleaseChannel): void {
    this.inMemoryChannel = channel;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.CHANNEL_KEY, channel);
      }
    } catch {}
  }
}
