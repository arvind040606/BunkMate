import React from 'react';
import { motion } from 'motion/react';
import { Bell, X, Trash2, ShieldAlert, CheckCircle2, Info } from 'lucide-react';
import { NotificationItem } from '../../types';
import { triggerHaptic } from '../../utils/db';

interface InAppNotificationsProps {
  notifications: NotificationItem[];
  onClose: () => void;
  onMarkAsRead: (id: string) => void;
  onClearAll: () => void;
}

export default function InAppNotifications({
  notifications,
  onClose,
  onMarkAsRead,
  onClearAll,
}: InAppNotificationsProps) {
  const handleMarkRead = (id: string) => {
    triggerHaptic('light');
    onMarkAsRead(id);
  };

  const handleClear = () => {
    triggerHaptic('heavy');
    onClearAll();
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-[440px] bg-zinc-955 rounded-t-[32px] shadow-2xl flex flex-col max-h-[85%] overflow-hidden border-t border-zinc-900 text-white"
      >
        {/* Header Drawer handle */}
        <div className="flex flex-col items-center pt-3 pb-4 px-6 border-b border-zinc-900 flex-shrink-0">
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full mb-3" />
          <div className="flex justify-between items-center w-full">
            <h3 className="text-lg font-display font-black text-white flex items-center">
              <Bell className="w-4 h-4 mr-1.5 text-indigo-400 animate-bounce" />
              Notifications Center
            </h3>
            <div className="flex space-x-2">
              {notifications.length > 0 && (
                <button
                  onClick={handleClear}
                  className="text-xs text-rose-455 hover:bg-rose-500/10 font-bold px-2.5 py-1.5 rounded-lg transition flex items-center cursor-pointer border border-rose-900/30"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Clear
                </button>
              )}
              <button
                onClick={() => { triggerHaptic('light'); onClose(); }}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 border border-zinc-800 rounded-full transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent">
          {notifications.length === 0 ? (
            <div className="text-center py-12 space-y-2">
              <Bell className="w-8 h-8 text-zinc-700 mx-auto" />
              <p className="text-xs font-bold text-zinc-400">Inbox fully clear!</p>
              <p className="text-[10px] text-zinc-550">We will notify you if attendance drops below targets.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {notifications.map(notif => (
                <div
                  key={notif.id}
                  onClick={() => !notif.read && handleMarkRead(notif.id)}
                  className={`p-4 rounded-2xl border transition relative flex items-start space-x-3 cursor-pointer text-left ${
                    notif.read
                      ? 'bg-zinc-900/30 border-zinc-900 text-zinc-450 opacity-80'
                      : 'bg-indigo-500/5 border-indigo-500/15 text-white font-medium shadow-sm'
                  }`}
                >
                  {/* Status Indicator Icon */}
                  <div className="mt-0.5 flex-shrink-0">
                    {notif.type === 'danger' && <ShieldAlert className="w-4.5 h-4.5 text-rose-500" />}
                    {notif.type === 'warning' && <ShieldAlert className="w-4.5 h-4.5 text-amber-500" />}
                    {notif.type === 'success' && <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />}
                    {notif.type === 'info' && <Info className="w-4.5 h-4.5 text-indigo-400" />}
                  </div>

                  <div className="space-y-1 pr-4">
                    <h4 className="text-xs font-black leading-normal">{notif.title}</h4>
                    <p className="text-[10px] leading-relaxed text-zinc-400">{notif.message}</p>
                    <span className="text-[9px] font-mono text-zinc-550 block pt-1 font-semibold">
                      {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Unread circle */}
                  {!notif.read && (
                    <span className="absolute right-3.5 top-4.5 w-2 h-2 rounded-full bg-indigo-500" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
