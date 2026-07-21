import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpCircle, ChevronRight, Download, RefreshCw } from 'lucide-react';
import { updateService, VersionInfo } from '../../utils/updateService';
import { triggerHaptic } from '../../utils/db';

interface UpdateModalProps {
  currentVersion: string;
  info: VersionInfo;
  onClose: () => void;
}

export default function UpdateModal({ currentVersion, info, onClose }: UpdateModalProps) {
  const handleUpdateNow = async () => {
    triggerHaptic('heavy');
    const opened = await updateService.openDownloadLink(info.downloadUrl);
    if (opened && !info.forceUpdate) {
      onClose();
    }
  };

  const handleLater = () => {
    triggerHaptic('light');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/85 backdrop-blur-md"
        onClick={info.forceUpdate ? undefined : handleLater}
      />

      {/* Modal Dialog Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-[360px] bg-zinc-950 border border-zinc-800/80 rounded-[32px] p-6 overflow-hidden shadow-[0_0_50px_-10px_rgba(99,102,241,0.25)] flex flex-col"
      >
        {/* Subtle top glow bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

        {/* Header Icon */}
        <div className="flex justify-center mb-4">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
            <ArrowUpCircle className="w-8 h-8 animate-bounce" />
          </div>
        </div>

        {/* Title & Subtitle */}
        <h2 className="text-xl font-extrabold text-white text-center tracking-tight mb-1">
          Update Available! 🚀
        </h2>
        <p className="text-xs text-zinc-400 text-center mb-4">
          A new version of BunkMate is ready to install.
        </p>

        {/* Version Badges Compare */}
        <div className="flex items-center justify-center gap-3 bg-zinc-900/60 border border-zinc-800/40 rounded-2xl py-3 px-4 mb-4">
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold">Current</span>
            <span className="text-sm font-semibold text-zinc-300">v{currentVersion}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-600 mt-2" />
          <div className="flex flex-col items-center">
            <span className="text-[9px] uppercase tracking-wider text-indigo-400 font-bold">Latest</span>
            <span className="text-sm font-bold text-indigo-400">v{info.latestVersion}</span>
          </div>
        </div>

        {/* Release Notes */}
        <div className="flex flex-col mb-6">
          <span className="text-xs font-bold text-zinc-300 mb-2 px-1">What's New</span>
          <div className="max-h-[120px] overflow-y-auto bg-zinc-900/40 border border-zinc-800/40 rounded-2xl p-3 text-xs text-zinc-400 leading-relaxed font-sans scrollbar-thin">
            {info.releaseNotes ? (
              <div className="whitespace-pre-line">{info.releaseNotes}</div>
            ) : (
              <span className="italic text-zinc-500">General performance improvements and stability bug fixes.</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={handleUpdateNow}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 rounded-2xl transition-all shadow-lg active:scale-95 cursor-pointer select-none"
          >
            <Download className="w-4 h-4" />
            Update Now
          </button>

          {info.forceUpdate ? (
            <button
              onClick={handleLater}
              className="w-full text-zinc-550 hover:text-zinc-400 font-semibold py-2.5 rounded-2xl transition-all cursor-pointer text-center text-xs select-none"
            >
              Continue Offline (Disable Sync)
            </button>
          ) : (
            <button
              onClick={handleLater}
              className="w-full text-zinc-500 hover:text-zinc-300 font-semibold py-2.5 rounded-2xl transition-all cursor-pointer text-center text-xs select-none"
            >
              Later
            </button>
          )}
        </div>

        {/* Force update warning */}
        {info.forceUpdate && (
          <p className="text-[10px] text-zinc-500 text-center mt-3 font-semibold flex items-center justify-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
            This update is required to continue using BunkMate.
          </p>
        )}
      </motion.div>
    </div>
  );
}
