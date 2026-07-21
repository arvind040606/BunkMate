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
  Heart
} from 'lucide-react';
import { updateService, VersionInfo } from '../../utils/updateService';
import { triggerHaptic } from '../../utils/db';

interface UpdateScreenProps {
  onClose: () => void;
  currentVersion: string;
}

export const UpdateScreen: React.FC<UpdateScreenProps> = ({ onClose, currentVersion }) => {
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [statusText, setStatusText] = useState<'loading' | 'up_to_date' | 'available' | 'required' | 'error'>('loading');

  const fetchUpdateData = async (forceFetch = false) => {
    setIsChecking(true);
    try {
      const { updateAvailable, info } = await updateService.checkForUpdates(forceFetch);
      if (info) {
        setUpdateInfo(info);
        const forceActive = updateService.isForceUpdateActive();
        if (forceActive) {
          setStatusText('required');
        } else if (updateAvailable) {
          setStatusText('available');
        } else {
          setStatusText('up_to_date');
        }
      } else {
        setStatusText('error');
      }
    } catch (err) {
      console.error('[UpdateScreen] Failed to fetch update info:', err);
      // Fallback to cache
      const cached = updateService.getCachedUpdateInfo();
      if (cached) {
        setUpdateInfo(cached);
        let updateAvailable = updateService.isNewerVersion(currentVersion, cached.latestVersion);
        if (!cached.downloadUrl || !cached.downloadUrl.trim()) {
          updateAvailable = false;
        }
        const forceActive = updateService.isForceUpdateActive();
        if (forceActive) {
          setStatusText('required');
        } else if (updateAvailable) {
          setStatusText('available');
        } else {
          setStatusText('up_to_date');
        }
      } else {
        setStatusText('error');
      }
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    fetchUpdateData(true);
  }, []);

  const handleDownload = async () => {
    if (!updateInfo?.downloadUrl) return;
    triggerHaptic('heavy');
    await updateService.openDownloadLink(updateInfo.downloadUrl);
  };

  return (
    <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl z-[60] flex flex-col overflow-hidden text-white font-sans select-none">
      {/* Header */}
      <div className="px-4 py-4 flex justify-between items-center border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center space-x-2">
          <span className="text-xl">📢</span>
          <div>
            <h2 className="text-base font-black text-white leading-tight font-display">BunkMate Update Center</h2>
            <p className="text-[10px] text-zinc-400 font-semibold">Official Version & Cloud Registry</p>
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

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-24 text-left">
        
        {/* Update Status Card */}
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/15 via-zinc-900/40 to-zinc-950 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-zinc-500 font-extrabold uppercase tracking-wider block">Update Status</span>
            <button
              onClick={() => {
                triggerHaptic('medium');
                fetchUpdateData(true);
              }}
              disabled={isChecking}
              className="p-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-indigo-400 rounded-xl transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Dynamic Status Presentation */}
          {statusText === 'loading' && (
            <div className="py-6 flex flex-col items-center justify-center space-y-3">
              <RefreshCw className="w-7 h-7 text-indigo-500 animate-spin" />
              <p className="text-xs text-zinc-400 font-bold">Checking update registry...</p>
            </div>
          )}

          {statusText === 'up_to_date' && (
            <div className="space-y-2.5">
              <div className="flex items-center space-x-2 text-emerald-400">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <h3 className="text-sm font-black">✅ You're using the latest version.</h3>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-semibold">
                Your installation is completely up to date. You have all the latest stability, speed, and cloud integrations.
              </p>
            </div>
          )}

          {statusText === 'available' && (
            <div className="space-y-3.5">
              <div className="flex items-center space-x-2 text-amber-400">
                <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-bounce" />
                <h3 className="text-sm font-black">🚀 Update Available</h3>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-semibold">
                A new version of BunkMate is available. We recommend updating to maintain seamless synchronization and access new features.
              </p>
              <button
                onClick={handleDownload}
                className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 text-white rounded-2xl text-xs font-black transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-indigo-650/20"
              >
                <Download className="w-4 h-4" />
                <span>Update Now</span>
              </button>
            </div>
          )}

          {statusText === 'required' && (
            <div className="space-y-3.5">
              <div className="flex items-center space-x-2 text-rose-450">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 animate-pulse" />
                <h3 className="text-sm font-black">🔴 Update Required</h3>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-semibold">
                Your version of BunkMate is no longer supported for cloud features. Offline attendance features remain fully active, but cloud sync is disabled until you update.
              </p>
              <button
                onClick={handleDownload}
                className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-black transition flex items-center justify-center space-x-2 cursor-pointer shadow-lg shadow-rose-600/20 animate-pulse"
              >
                <Download className="w-4 h-4" />
                <span>Update Now</span>
              </button>
            </div>
          )}

          {statusText === 'error' && (
            <div className="space-y-2.5">
              <div className="flex items-center space-x-2 text-zinc-400">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <h3 className="text-sm font-black">Registry Offline</h3>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed font-semibold">
                Could not establish a connection to the Supabase update server. Showing locally cached version details.
              </p>
            </div>
          )}
        </div>

        {/* Version Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-950/60 border border-zinc-900 p-4 rounded-3xl text-center">
            <span className="block text-[9px] uppercase tracking-wider text-zinc-500 font-extrabold mb-1">Installed Version</span>
            <span className="text-base font-black text-white font-mono">v{currentVersion}</span>
          </div>
          <div className="bg-zinc-950/60 border border-zinc-900 p-4 rounded-3xl text-center">
            <span className="block text-[9px] uppercase tracking-wider text-zinc-500 font-extrabold mb-1">Latest Version</span>
            <span className="text-base font-black text-indigo-400 font-mono">
              {updateInfo ? `v${updateInfo.latestVersion}` : 'Checking...'}
            </span>
          </div>
        </div>

        {/* What's New / Release Notes */}
        {updateInfo?.releaseNotes && (
          <div className="bg-zinc-950/60 border border-zinc-900 rounded-3xl p-5 space-y-3.5">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-extrabold text-zinc-350 uppercase tracking-wider">
                📝 What's New
              </h3>
              {updateInfo.releaseDate && (
                <span className="text-[9px] text-zinc-550 font-mono font-bold">
                  {new Date(updateInfo.releaseDate).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </span>
              )}
            </div>
            <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-3.5 max-h-[180px] overflow-y-auto">
              <div className="text-xs text-zinc-300 space-y-2 leading-relaxed whitespace-pre-line font-medium">
                {updateInfo.releaseNotes}
              </div>
            </div>
          </div>
        )}

        {/* Registry & Licensing details */}
        <div className="bg-zinc-950/60 border border-zinc-900 rounded-3xl p-5 space-y-4">
          <h3 className="text-xs font-extrabold text-zinc-350 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-400" />
            Registry Details
          </h3>
          
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-zinc-550 font-semibold">Developer Email</span>
              <a 
                href={`mailto:${updateInfo?.developerEmail || 'support@bunkmate.com'}`}
                className="text-indigo-400 font-bold hover:underline flex items-center gap-1"
              >
                <Mail className="w-3 h-3" />
                {updateInfo?.developerEmail || 'support@bunkmate.com'}
              </a>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-zinc-550 font-semibold">App License</span>
              <span className="text-zinc-355 font-bold font-mono">{updateInfo?.appLicense || 'MIT License'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-zinc-550 font-semibold">Copyright</span>
              <span className="text-zinc-400 font-bold">© 2026 BunkMate</span>
            </div>
          </div>
        </div>

        <div className="text-center pt-2">
          <span className="text-[10px] text-zinc-650 font-bold flex items-center justify-center gap-1">
            Made with <Heart className="w-3 h-3 text-red-500/75 animate-pulse" /> for university students
          </span>
        </div>
      </div>
    </div>
  );
};
