import React from 'react';
import { X, Sparkles, Calendar, Tag, ExternalLink } from 'lucide-react';
import { ReleaseHistoryItem, ReleaseInfo } from '../../types/updateTypes';
import { triggerHaptic } from '../../utils/db';

interface ReleaseNotesDialogProps {
  release: ReleaseHistoryItem | ReleaseInfo | null;
  onClose: () => void;
  onDownload?: (url: string) => void;
}

export const ReleaseNotesDialog: React.FC<ReleaseNotesDialogProps> = ({ release, onClose, onDownload }) => {
  if (!release) return null;

  const version = 'latestVersion' in release ? release.latestVersion : release.version;
  const title = 'releaseTitle' in release ? release.releaseTitle : release.title;
  const notes = release.releaseNotes;
  const date = release.releaseDate;
  const channel = release.releaseChannel || 'stable';
  const url = 'googleDriveApkUrl' in release ? release.googleDriveApkUrl : release.apkUrl;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-900 bg-gradient-to-r from-indigo-950/40 via-zinc-900/60 to-zinc-950 flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h3 className="text-base font-black text-white font-display">{title || `BunkMate v${version}`}</h3>
            </div>
            <div className="flex items-center space-x-3 text-xs text-zinc-400 font-medium">
              <span className="flex items-center space-x-1">
                <Tag className="w-3 h-3 text-indigo-400" />
                <span className="font-mono text-zinc-300 font-bold">v{version}</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-zinc-500" />
                <span>{new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
              </span>
              <span>•</span>
              <span className="uppercase text-[10px] tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold">
                {channel}
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Release Notes Content */}
        <div className="p-5 max-h-[350px] overflow-y-auto space-y-3">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-zinc-400">Changelog & Notes</h4>
          <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 text-xs text-zinc-300 leading-relaxed font-medium whitespace-pre-line">
            {notes || 'No detailed release notes provided for this version.'}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-900 bg-zinc-950 flex justify-between items-center">
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
          {url && onDownload && (
            <button
              onClick={() => {
                triggerHaptic('heavy');
                onDownload(url);
              }}
              className="px-4 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-black transition flex items-center space-x-2 cursor-pointer shadow-lg shadow-indigo-650/20"
            >
              <span>Get APK</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
