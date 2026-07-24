import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Mail,
  ShieldAlert,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Info,
  Heart,
  Sparkles,
  WifiOff,
  ChevronRight,
  Wrench,
  FileText
} from 'lucide-react';
import { updateService } from '../../services/UpdateService';
import { VersionChecker } from '../../utils/versionChecker';
import {
  UpdateCheckResult,
  ReleaseInfo
} from '../../types/updateTypes';
import { ReleaseNotesDialog } from './ReleaseNotesDialog';
import { triggerHaptic } from '../../utils/db';

interface UpdateScreenProps {
  onClose: () => void;
  currentVersion: string;
}

export const UpdateScreen: React.FC<UpdateScreenProps> = ({ onClose }) => {
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [selectedDetailsRelease, setSelectedDetailsRelease] = useState<ReleaseInfo | null>(null);

  const fetchUpdateData = async () => {
    setIsChecking(true);
    try {
      const res = await updateService.checkForUpdates();
      setResult(res);
    } catch (err) {
      console.error('[UpdateScreen] Check for updates failed:', err);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    fetchUpdateData();
  }, []);

  const handleDownload = async () => {
    if (!result?.info?.googleDriveApkUrl) return;
    triggerHaptic('heavy');
    if (result.info.latestVersion) {
      const cleanVer = VersionChecker.clean(result.info.latestVersion) || result.info.latestVersion;
      localStorage.setItem('bunkmate_dismissed_update_version', cleanVer);
      localStorage.setItem('bunkmate_installed_version', cleanVer);
    }
    await updateService.openGoogleDriveApk(result.info.googleDriveApkUrl);
  };

  const formatLastChecked = (timestamp: number): string => {
    if (!timestamp) return 'Never';
    const diffMs = Date.now() - timestamp;
    if (diffMs < 30000) return 'Just now';
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const info = result?.info;
  const installedVer = result?.installedVersion || '1.0.0';
  const status = result?.status || 'loading';

  return (
    <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl z-[60] flex flex-col overflow-hidden text-white font-sans select-none">

      {/* Header */}
      <div className="px-4 py-4 flex justify-between items-center border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-black text-white leading-tight font-display">Update Center</h2>
            <p className="text-[10px] text-zinc-400 font-semibold">BunkMate Software Update System</p>
          </div>
        </div>
        <button
          onClick={() => {
            triggerHaptic('light');
            onClose();
          }}
          className="p-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-24 text-left">

        {/* Offline Banner */}
        {result?.isOffline && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center space-x-3 text-amber-400 text-xs font-semibold">
            <WifiOff className="w-4 h-4 flex-shrink-0" />
            <span>Offline Mode: Showing cached system info.</span>
          </div>
        )}

        {/* Maintenance Banner */}
        {result?.isMaintenanceActive && (
          <div className="bg-yellow-500/15 border border-yellow-500/30 rounded-2xl p-4 space-y-1.5 text-yellow-300">
            <div className="flex items-center space-x-2 font-black text-xs uppercase tracking-wider">
              <Wrench className="w-4 h-4 text-yellow-400 animate-spin" />
              <span>Maintenance Mode Active</span>
            </div>
            <p className="text-xs text-yellow-200/80 leading-relaxed font-medium">
              {info?.maintenanceMessage || 'System maintenance in progress. Cloud sync may be temporarily unavailable.'}
            </p>
          </div>
        )}

        {/* Primary System Status Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/20 via-zinc-900/60 to-zinc-950 border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider block">System Status</span>
              <span className="text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded-full font-mono">
                {formatLastChecked(result?.lastCheckedAt || 0)}
              </span>
            </div>
            <button
              onClick={() => {
                triggerHaptic('medium');
                fetchUpdateData();
              }}
              disabled={isChecking}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-indigo-400 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Status Content */}
          {isChecking && (
            <div className="py-6 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-7 h-7 text-indigo-400 animate-spin" />
              <p className="text-xs text-zinc-400 font-bold">Checking update registry...</p>
            </div>
          )}

          {!isChecking && status === 'up_to_date' && (
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <span className="px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Latest</span>
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                Your application is completely up to date. You have all current stability patches and features.
              </p>
            </div>
          )}

          {!isChecking && status === 'update_available' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                  <span>Update Available</span>
                </span>
                {info && (
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedDetailsRelease(info);
                    }}
                    className="text-xs text-indigo-400 font-bold hover:underline flex items-center space-x-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Release Details</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                A new update is ready for installation. Download directly from Google Drive to get the latest features.
              </p>
              <button
                onClick={handleDownload}
                className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 text-white rounded-2xl text-xs font-black transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-indigo-650/20"
              >
                <Download className="w-4 h-4" />
                <span>Download Update from Google Drive</span>
              </button>
            </div>
          )}

          {!isChecking && status === 'update_required' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="px-3 py-1 bg-rose-500/15 border border-rose-500/30 text-rose-400 rounded-full text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 animate-pulse">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>Update Required</span>
                </span>
                {info && (
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setSelectedDetailsRelease(info);
                    }}
                    className="text-xs text-rose-300 font-bold hover:underline flex items-center space-x-1"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>View Release Details</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                A critical update is required to continue using BunkMate cloud services. Please update immediately.
              </p>
              <button
                onClick={handleDownload}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-black transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-rose-600/20 animate-pulse"
              >
                <Download className="w-4 h-4" />
                <span>Download Required Update</span>
              </button>
            </div>
          )}

          {!isChecking && status === 'error' && (
            <div className="space-y-2.5">
              <div className="flex items-center space-x-2 text-zinc-400">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <h3 className="text-sm font-black">Registry Connection Warning</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed font-semibold">
                {result?.error || 'Unable to connect to the update registry.'}
              </p>
            </div>
          )}
        </div>

        {/* Version Display Cards */}
        <div className="space-y-3">
          {/* Installed Build (Read directly from device APK) */}
          <div className="bg-zinc-950/60 border border-zinc-900 p-4 rounded-3xl flex items-center justify-between shadow-lg">
            <div className="space-y-0.5">
              <span className="block text-[9px] uppercase tracking-wider text-zinc-500 font-extrabold">Installed Build</span>
              <div className="text-sm font-black text-white font-mono">
                {VersionChecker.isValid(installedVer) ? `v${VersionChecker.formatDisplayVersion(installedVer)}` : VersionChecker.formatDisplayVersion(installedVer)}
              </div>
              <span className="text-[9px] text-zinc-500 block">Current Device Installation</span>
            </div>

            {/* Status Badge Tag */}
            <div className="flex-shrink-0">
              {status === 'up_to_date' ? (
                <span className="whitespace-nowrap px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                  Latest
                </span>
              ) : (
                <span className="whitespace-nowrap px-3 py-1 bg-zinc-800/80 border border-zinc-700/60 text-zinc-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  Installed
                </span>
              )}
            </div>
          </div>

          {/* Latest Version from Supabase (Shown when update is available/required) */}
          {(status === 'update_available' || status === 'update_required') && info?.latestVersion && (
            <div className="bg-gradient-to-r from-indigo-950/30 to-zinc-950 border border-indigo-500/25 p-4 rounded-3xl flex items-center justify-between shadow-lg">
              <div className="space-y-0.5">
                <span className="block text-[9px] uppercase tracking-wider text-indigo-400 font-extrabold">Cloud Release</span>
                <div className="text-sm font-black text-indigo-200 font-mono">
                  {VersionChecker.isValid(info.latestVersion) ? `v${VersionChecker.formatDisplayVersion(info.latestVersion)}` : VersionChecker.formatDisplayVersion(info.latestVersion)}
                </div>
                <span className="text-[9px] text-indigo-300/60 block">Available in Registry</span>
              </div>

              <div className="flex-shrink-0">
                <span className="whitespace-nowrap px-3 py-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold rounded-full uppercase tracking-wider">
                  New Version
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Release Notes Preview */}
        {info?.releaseNotes && (
          <div className="bg-zinc-950/60 border border-zinc-900 rounded-3xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-extrabold text-zinc-350 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Latest Release Notes
              </h3>
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedDetailsRelease(info);
                }}
                className="text-[10px] text-indigo-400 font-bold hover:underline flex items-center space-x-1"
              >
                <span>Full Details</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
            <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 max-h-[140px] overflow-y-auto">
              <div className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line font-medium">
                {info.releaseNotes}
              </div>
            </div>
          </div>
        )}

        {/* Registry Info & Licensing */}
        <div className="bg-zinc-950/60 border border-zinc-900 rounded-3xl p-5 space-y-4">
          <h3 className="text-xs font-extrabold text-zinc-350 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            Developer & License Metadata
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-zinc-500 font-semibold">Developer Email</span>
              <a
                href={`mailto:${info?.developerEmail || 'arvindmadaan04@gmail.com'}`}
                className="text-indigo-400 font-bold hover:underline flex items-center gap-1"
              >
                <Mail className="w-3 h-3" />
                {info?.developerEmail || 'arvindmadaan04@gmail.com'}
              </a>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-zinc-500 font-semibold">App License</span>
              <span className="text-zinc-300 font-bold font-mono">{info?.appLicense || 'MIT License'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-zinc-500 font-semibold">Copyright</span>
              <span className="text-zinc-400 font-bold">© 2026 BunkMate</span>
            </div>
          </div>
        </div>

        <div className="text-center pt-2">
          <span className="text-[10px] text-zinc-600 font-bold flex items-center justify-center gap-1">
            Made with <Heart className="w-3 h-3 text-red-500/75 animate-pulse" /> for university students
          </span>
        </div>
      </div>

      {/* Release Details Dialog Overlay (Shows latest version number when opened) */}
      {selectedDetailsRelease && (
        <ReleaseNotesDialog
          release={selectedDetailsRelease}
          onClose={() => setSelectedDetailsRelease(null)}
          onDownload={(url) => updateService.openGoogleDriveApk(url)}
        />
      )}
    </div>
  );
};
