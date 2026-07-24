import { versionService } from './VersionService';
import { ReleaseRepository } from '../repositories/ReleaseRepository';
import { ReleaseHistoryRepository } from '../repositories/ReleaseHistoryRepository';
import { 
  ReleaseInfo, 
  ReleaseHistoryItem, 
  UpdateCheckResult, 
  UpdateStatus, 
  ReleaseChannel,
  UpdateAnalyticsEvent 
} from '../types/updateTypes';
import { Capacitor } from '@capacitor/core';

export class UpdateService {
  private static instance: UpdateService;
  private lastResult: UpdateCheckResult | null = null;
  private deviceRolloutSeed: number;

  private constructor() {
    this.deviceRolloutSeed = this.initDeviceRolloutSeed();
  }

  public static getInstance(): UpdateService {
    if (!UpdateService.instance) {
      UpdateService.instance = new UpdateService();
    }
    return UpdateService.instance;
  }

  /**
   * Generates a deterministic device seed (1 to 100) for staged rollout calculations.
   */
  private initDeviceRolloutSeed(): number {
    try {
      const KEY = 'bunkmate_device_rollout_seed';
      const stored = localStorage.getItem(KEY);
      if (stored) {
        const num = parseInt(stored, 10);
        if (!isNaN(num) && num >= 1 && num <= 100) return num;
      }
      const newSeed = Math.floor(Math.random() * 100) + 1;
      localStorage.setItem(KEY, newSeed.toString());
      return newSeed;
    } catch {
      return 50;
    }
  }

  public getDeviceRolloutSeed(): number {
    return this.deviceRolloutSeed;
  }

  public getSelectedChannel(): ReleaseChannel {
    return ReleaseRepository.getSelectedChannel();
  }

  public setSelectedChannel(channel: ReleaseChannel): void {
    ReleaseRepository.setSelectedChannel(channel);
  }

  /**
   * Validates download URL format (Google Drive / HTTP / HTTPS).
   */
  public isValidDownloadUrl(url: any): boolean {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();
    return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('drive.google.com');
  }

  /**
   * Master Update Evaluation Pipeline.
   */
  public evaluateUpdate(
    installedVersion: string, 
    info: ReleaseInfo, 
    isOffline = false
  ): UpdateCheckResult {
    const isNewerAvailable = versionService.isNewer(installedVersion, info.latestVersion);
    const isBelowMinimum = versionService.isOlder(installedVersion, info.minimumSupportedVersion);
    const forceUpdateFlag = !!info.forceUpdate;
    const isMaintenanceActive = !!info.maintenanceMode;

    // Check mandatory deadline ISO timestamp if present
    let isMandatoryPassed = false;
    if (info.mandatoryAfter) {
      try {
        const deadline = new Date(info.mandatoryAfter).getTime();
        if (!isNaN(deadline) && Date.now() > deadline) {
          isMandatoryPassed = true;
        }
      } catch {}
    }

    // Check rollout percentage eligibility for non-forced updates
    const rolloutPercentage = typeof info.rolloutPercentage === 'number' ? info.rolloutPercentage : 100;
    const isRolloutEligible = this.deviceRolloutSeed <= rolloutPercentage || forceUpdateFlag || isBelowMinimum || isMandatoryPassed;

    let status: UpdateStatus = 'up_to_date';

    if (isMaintenanceActive) {
      status = 'maintenance_mode';
    } else if (isBelowMinimum || forceUpdateFlag || isMandatoryPassed) {
      status = 'update_required';
    } else if (isNewerAvailable && isRolloutEligible) {
      status = 'update_available';
    } else {
      status = 'up_to_date';
    }

    // Print evaluation summary
    console.log('==================================================');
    console.log('[UpdateService] Production OTA Update Evaluation:');
    console.log(`  • Installed Version        : ${installedVersion}`);
    console.log(`  • Latest Version           : ${info.latestVersion}`);
    console.log(`  • Minimum Supported Version: ${info.minimumSupportedVersion}`);
    console.log(`  • Release Channel          : ${info.releaseChannel}`);
    console.log(`  • Rollout Percentage       : ${rolloutPercentage}% (Device Seed: ${this.deviceRolloutSeed})`);
    console.log(`  • Force Update Flag        : ${forceUpdateFlag}`);
    console.log(`  • Maintenance Mode         : ${isMaintenanceActive}`);
    console.log(`  • Offline Cached Data      : ${isOffline}`);
    console.log(`  • Final Status             : ${status}`);
    console.log('==================================================');

    const result: UpdateCheckResult = {
      status,
      installedVersion,
      latestVersion: info.latestVersion,
      minimumSupportedVersion: info.minimumSupportedVersion,
      isNewerAvailable,
      isBelowMinimum,
      forceUpdateFlag,
      isMaintenanceActive,
      isRolloutEligible,
      isOffline,
      info,
      lastCheckedAt: Date.now()
    };

    this.lastResult = result;
    this.logAnalytics('decision', installedVersion, info.latestVersion, status, info.releaseChannel);

    return result;
  }

  /**
   * Main entry point to perform a live or cached update check.
   * ALWAYS reads installed version freshly from native APK via VersionService.
   */
  public async checkForUpdates(channelOverride?: ReleaseChannel): Promise<UpdateCheckResult> {
    const channel = channelOverride || this.getSelectedChannel();
    const installedVersion = await versionService.getInstalledVersion();
    const { info, isOffline } = await ReleaseRepository.fetchLatestRelease(channel);

    if (!info) {
      const errorResult: UpdateCheckResult = {
        status: 'error',
        installedVersion,
        latestVersion: 'Unable to determine version',
        minimumSupportedVersion: 'Unable to determine version',
        isNewerAvailable: false,
        isBelowMinimum: false,
        forceUpdateFlag: false,
        isMaintenanceActive: false,
        isRolloutEligible: true,
        isOffline: true,
        info: null,
        lastCheckedAt: Date.now(),
        error: 'Unable to connect to Supabase update server and no cached release found.'
      };
      this.lastResult = errorResult;
      this.logAnalytics('check', installedVersion, 'unknown', 'error', channel);
      return errorResult;
    }

    return this.evaluateUpdate(installedVersion, info, isOffline);
  }

  /**
   * Fetches release history.
   */
  public async fetchReleaseHistory(channel?: ReleaseChannel): Promise<ReleaseHistoryItem[]> {
    const targetChannel = channel || this.getSelectedChannel();
    return ReleaseHistoryRepository.fetchReleaseHistory(targetChannel);
  }

  public getLastCheckResult(): UpdateCheckResult | null {
    return this.lastResult;
  }

  public isForceUpdateActive(): boolean {
    if (!this.lastResult) return false;
    return this.lastResult.status === 'update_required';
  }

  /**
   * Launches Google Drive APK URL securely.
   */
  public async openGoogleDriveApk(url: string): Promise<boolean> {
    try {
      if (!this.isValidDownloadUrl(url)) {
        console.warn('[UpdateService] Invalid Google Drive / download URL provided:', url);
        return false;
      }

      this.logAnalytics(
        'download_click', 
        this.lastResult?.installedVersion || 'unknown', 
        this.lastResult?.latestVersion || 'unknown', 
        'clicked', 
        this.getSelectedChannel()
      );

      console.log(`[UpdateService] Launching Google Drive APK URL: ${url}`);
      if (Capacitor.isNativePlatform()) {
        await window.open(url, '_system');
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return true;
    } catch (err) {
      console.error('[UpdateService] Failed to open Google Drive APK URL:', err);
      try {
        window.open(url, '_blank');
        return true;
      } catch {
        return false;
      }
    }
  }

  /**
   * Analytics event logger.
   */
  private logAnalytics(
    event: UpdateAnalyticsEvent['event'], 
    installedVersion: string, 
    latestVersion: string, 
    result: string, 
    channel: string,
    metadata?: Record<string, any>
  ): void {
    try {
      const KEY = 'bunkmate_update_analytics_log';
      const entry: UpdateAnalyticsEvent = {
        event,
        installedVersion,
        latestVersion,
        result,
        channel,
        timestamp: Date.now(),
        metadata
      };
      const existingRaw = localStorage.getItem(KEY);
      const list: UpdateAnalyticsEvent[] = existingRaw ? JSON.parse(existingRaw) : [];
      list.unshift(entry);
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
    } catch {}
  }
}

export const updateService = UpdateService.getInstance();
