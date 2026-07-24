export type ReleaseChannel = 'stable' | 'beta' | 'developer';
export type ReleasePriority = 'low' | 'medium' | 'high' | 'critical';
export type UpdateStatus = 'up_to_date' | 'update_available' | 'update_required' | 'maintenance_mode' | 'error';

export interface ReleaseInfo {
  id?: string;
  latestVersion: string;
  minimumSupportedVersion: string;
  googleDriveApkUrl: string;
  releaseNotes: string;
  releaseTitle: string;
  releaseDate: string;
  forceUpdate: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  developerEmail: string;
  appLicense: string;
  releaseChannel: ReleaseChannel;
  releasePriority: ReleasePriority;
  rolloutPercentage: number;
  mandatoryAfter?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReleaseHistoryItem {
  id: string;
  version: string;
  title: string;
  releaseNotes: string;
  releaseDate: string;
  apkUrl: string;
  size: string;
  critical: boolean;
  releaseChannel: ReleaseChannel;
  createdAt: string;
}

export interface UpdateCheckResult {
  status: UpdateStatus;
  installedVersion: string;
  latestVersion: string;
  minimumSupportedVersion: string;
  isNewerAvailable: boolean;
  isBelowMinimum: boolean;
  forceUpdateFlag: boolean;
  isMaintenanceActive: boolean;
  isRolloutEligible: boolean;
  isOffline: boolean;
  info: ReleaseInfo | null;
  lastCheckedAt: number;
  error?: string;
}

export interface UpdateAnalyticsEvent {
  event: 'check' | 'decision' | 'download_click' | 'update_success' | 'update_failure';
  installedVersion: string;
  latestVersion: string;
  result: string;
  channel: string;
  timestamp: number;
  metadata?: Record<string, any>;
}
