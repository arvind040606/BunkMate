import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { VersionChecker } from '../utils/versionChecker';

export const CURRENT_APP_VERSION = '1.0.1';

export class VersionService {
  private static instance: VersionService;

  private constructor() {}

  public static getInstance(): VersionService {
    if (!VersionService.instance) {
      VersionService.instance = new VersionService();
    }
    return VersionService.instance;
  }

  /**
   * 1. Get Installed Version: ALWAYS read directly from the installed APK via App.getInfo().
   * Refreshed every time this method is invoked.
   * Never uses Supabase, SQLite, localStorage, or hardcoded overrides on native device.
   */
  public async getInstalledVersion(): Promise<string> {
    try {
      if (Capacitor.isNativePlatform()) {
        const info = await App.getInfo();
        if (info && info.version) {
          const cleaned = VersionChecker.clean(info.version);
          if (cleaned && VersionChecker.isValid(cleaned)) {
            console.log(`[VersionService] Native Installed APK Version: ${cleaned} (build ${info.build})`);
            return cleaned;
          }
        }
      }
    } catch (err) {
      console.warn('[VersionService] Native App.getInfo() check warning:', err);
    }

    // Web platform / dev fallback
    return CURRENT_APP_VERSION;
  }

  /**
   * Compare two semantic version strings segment by segment.
   * Supports unlimited numeric segments (e.g. 1, 1.0, 1.0.5, 1.10.2, 2.5.12.3).
   * Treats missing parts as zero. Ignores optional "v" prefix.
   */
  public compare(v1: any, v2: any): number {
    return VersionChecker.compare(v1, v2);
  }

  public isNewer(current: any, latest: any): boolean {
    return VersionChecker.isNewer(current, latest);
  }

  public isOlder(v1: any, v2: any): boolean {
    return VersionChecker.isOlder(v1, v2);
  }

  public isEqual(v1: any, v2: any): boolean {
    return VersionChecker.isEqual(v1, v2);
  }

  public isValid(version: any): boolean {
    return VersionChecker.isValid(version);
  }

  public clean(version: any): string | null {
    return VersionChecker.clean(version);
  }

  public formatDisplayVersion(version: any): string {
    return VersionChecker.formatDisplayVersion(version);
  }

  public async checkVersion() {
    const { updateService } = await import('./UpdateService');
    return updateService.checkForUpdates();
  }
}

export const versionService = VersionService.getInstance();
