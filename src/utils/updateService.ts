import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getApiUrl } from './api';
import { VersionChecker } from './versionChecker';
import { UpdateRepository } from '../repositories/UpdateRepository';

export const CURRENT_APP_VERSION = '1.0.0';

export interface VersionInfo {
  latestVersion: string;
  minimumSupportedVersion: string;
  downloadUrl: string;
  releaseNotes: string;
  forceUpdate: boolean;
  releaseDate?: string;
  maintenanceMode?: boolean;
  maintenanceMessage?: string;
  developerEmail?: string;
  appLicense?: string;
}

export class UpdateService {
  private static instance: UpdateService;
  private currentNativeVersion: string = CURRENT_APP_VERSION;

  private constructor() {
    // Try to load cached version immediately if available
    this.getAppVersion().catch(() => {});
  }

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /**
   * Helper to parse and compare semantic version strings (delegated to VersionChecker)
   */
  public isNewerVersion(current: string, latest: string): boolean {
    return VersionChecker.isNewer(current, latest);
  }

  /**
   * Fetch current app version using Capacitor App info, falling back to a hardcoded constant
   */
  public async getAppVersion(): Promise<string> {
    try {
      if (Capacitor.isNativePlatform()) {
        const info = await App.getInfo();
        console.log(`[Update Service] Current Native Version: ${info.version}`);
        this.currentNativeVersion = info.version;
        return info.version;
      }
    } catch (err) {
      console.warn('[Update Service] Failed to get app version from Capacitor App. Falling back to constant:', err);
    }
    return CURRENT_APP_VERSION;
  }

  /**
   * Retrieve cached update info from repository
   */
  public getCachedUpdateInfo(): VersionInfo | null {
    return UpdateRepository.getCachedUpdate();
  }

  /**
   * Save update info to repository
   */
  private cacheUpdateInfo(info: VersionInfo): void {
    UpdateRepository.saveCachedUpdate(info);
  }

  /**
   * Check if a newer version is available.
   * If not forced, it will enforce a 12-hour throttling window between network requests.
   */
  public async checkForUpdates(force = false): Promise<{ updateAvailable: boolean; info: VersionInfo | null }> {
    console.log(`[Update Service] Update check started (forced=${force})`);

    const currentVersion = await this.getAppVersion();
    console.log(`[Update Service] Current Version: ${currentVersion}`);

    // Throttling: Skip network check if last checked within 12 hours
    const now = Date.now();
    const lastCheckTime = UpdateRepository.getLastCheckTime();
    const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

    if (!force && now - lastCheckTime < TWELVE_HOURS_MS) {
      console.log('[Update Service] Skipping network check due to 12-hour throttling window.');
      const cached = this.getCachedUpdateInfo();
      if (cached) {
        const updateAvailable = VersionChecker.isNewer(currentVersion, cached.latestVersion);
        return { updateAvailable, info: cached };
      }
      return { updateAvailable: false, info: null };
    }

    try {
      console.log(`[Update Service] Fetching latest version info directly from Supabase...`);
      const { supabase } = await import('./supabaseClient');
      
      const { data, error } = await supabase
        .from('latest_updates')
        .select('*')
        .order('release_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error('No version configuration found in Supabase latest_updates table');
      }

      const info: VersionInfo = {
        latestVersion: data.latest_version || '1.0.0',
        minimumSupportedVersion: data.minimum_supported_version || '1.0.0',
        downloadUrl: data.google_drive_apk_url || '',
        releaseNotes: data.release_notes || '',
        releaseDate: data.release_date || new Date().toISOString(),
        forceUpdate: !!data.force_update,
        maintenanceMode: !!data.maintenance_mode,
        maintenanceMessage: data.maintenance_message || '',
        developerEmail: data.developer_email || 'support@bunkmate.com',
        appLicense: data.app_license || 'MIT License'
      };

      console.log(`[Update Service] Latest Version fetched: ${info.latestVersion}`);
      
      // Update check timestamp and cache the response
      UpdateRepository.saveLastCheckTime(now);
      this.cacheUpdateInfo(info);

      let updateAvailable = VersionChecker.isNewer(currentVersion, info.latestVersion);
      if (!info.downloadUrl || !info.downloadUrl.trim()) {
        updateAvailable = false;
      }

      if (updateAvailable) {
        console.log(`[Update Service] Update available! Latest: ${info.latestVersion} | Force Update: ${info.forceUpdate}`);
      } else {
        console.log('[Update Service] App is up to date.');
      }

      return { updateAvailable, info };

    } catch (err: any) {
      console.error('[Update Service] Error querying Supabase for updates:', err);
      
      // Offline fallback: use cached information if available
      const cached = this.getCachedUpdateInfo();
      if (cached) {
        console.log('[Update Service] Falling back to cached update information.');
        let updateAvailable = VersionChecker.isNewer(currentVersion, cached.latestVersion);
        if (!cached.downloadUrl || !cached.downloadUrl.trim()) {
          updateAvailable = false;
        }
        return { updateAvailable, info: cached };
      }

      return { updateAvailable: false, info: null };
    }
  }

  /**
   * Determine if a force update is required and active.
   * Returns true if there is a newer version AND (forceUpdate is true OR current version is below minimumSupportedVersion).
   */
  public isForceUpdateActive(): boolean {
    const cached = this.getCachedUpdateInfo();
    if (!cached || !cached.downloadUrl || !cached.downloadUrl.trim()) return false;
    const current = this.currentNativeVersion;
    
    // If current version is below minimum supported version, update is mandatory
    const isBelowMin = VersionChecker.isNewer(current, cached.minimumSupportedVersion);
    if (isBelowMin) return true;

    // If a newer version is available and forceUpdate is true
    const isNewer = VersionChecker.isNewer(current, cached.latestVersion);
    return isNewer && cached.forceUpdate;
  }

  /**
   * Opens the Google Drive APK download link in the native browser
   */
  public async openDownloadLink(url: string): Promise<boolean> {
    try {
      console.log(`[Update Service] Attempting to open download URL: ${url}`);
      if (Capacitor.isNativePlatform()) {
        await window.open(url, '_system');
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      console.log('[Update Service] Browser opened successfully.');
      return true;
    } catch (err) {
      console.error('[Update Service] Failed to open download link in system browser:', err);
      try {
        window.open(url, '_blank');
        return true;
      } catch (innerErr) {
        console.error('[Update Service] Final fallback window.open failed:', innerErr);
        return false;
      }
    }
  }
}

export const updateService = UpdateService.getInstance();
