import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  RefreshCw, 
  UserMinus, 
  Clock, 
  GraduationCap, 
  BookOpen, 
  Activity, 
  Calendar, 
  AlertTriangle,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { friendsService } from '../../utils/friendsService';
import { triggerHaptic } from '../../utils/db';
import { syncService } from '../../utils/syncService';
import { renderAvatar } from './CompleteProfileModal';

interface FriendProfileModalProps {
  username: string;
  isOnlineInitial?: boolean;
  initialAvatarId?: string | null;
  initialDisplayName?: string | null;
  onClose: () => void;
  onFriendRemoved?: () => void;
}

export default function FriendProfileModal({
  username,
  isOnlineInitial = false,
  initialAvatarId,
  initialDisplayName,
  onClose,
  onFriendRemoved
}: FriendProfileModalProps) {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'subjects' | 'about'>('schedule');
  const [scheduleSubTab, setScheduleSubTab] = useState<'today' | 'tomorrow'>('today');
  const [isRemoving, setIsRemoving] = useState(false);
  const [showConfirmRemove, setShowConfirmRemove] = useState(false);
  const [isOnline] = useState(isOnlineInitial);

  // Load stats from friend
  const loadStats = async (force = false, silent = false) => {
    try {
      if (!silent) {
        if (force) setIsRefreshing(true);
        else setIsLoading(true);
      }
      setError(null);
      
      const today = new Date();
      const clientDayOfWeek = today.getDay();
      const tzOffset = today.getTimezoneOffset() * 60000;
      const clientLocalDate = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];

      const data = await friendsService.getStats(username, clientLocalDate, clientDayOfWeek);
      if (data.success) {
        setStats(data);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Private account locks or network failure.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
    
    // Subscribe to real-time sync updates for this friend
    const unsubscribe = syncService.subscribeToUserUpdates((updatedUserId, updatedUsername) => {
      const match = (stats && stats.userId === updatedUserId) || 
                    (updatedUsername && username.toLowerCase() === updatedUsername.toLowerCase());
      if (match) {
        console.log(`[Friend Profile SSE] Real-time reload for: ${username}`);
        loadStats(true, true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [username]);

  // Determine Class Scheduling Status (Upcoming, Completed, Ongoing)
  const getScheduledStatus = (timeStr: string, durationMins: number) => {
    try {
      const now = new Date();
      const cleanTime = timeStr.trim();
      
      let hours = 9;
      let minutes = 0;
      
      const ampmMatch = cleanTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (ampmMatch) {
        hours = parseInt(ampmMatch[1], 10);
        minutes = parseInt(ampmMatch[2], 10);
        const ampm = ampmMatch[3].toUpperCase();
        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;
      } else {
        const standardMatch = cleanTime.match(/(\d+):(\d+)/);
        if (standardMatch) {
          hours = parseInt(standardMatch[1], 10);
          minutes = parseInt(standardMatch[2], 10);
        }
      }
      
      const classStart = new Date();
      classStart.setHours(hours, minutes, 0, 0);
      const classEnd = new Date(classStart.getTime() + durationMins * 60000);
      
      if (now < classStart) {
        return 'Upcoming';
      } else if (now > classEnd) {
        return 'Completed';
      } else {
        return 'Ongoing';
      }
    } catch {
      return 'Upcoming';
    }
  };

  // Remove Friend Handler
  const handleRemoveFriend = async () => {
    triggerHaptic('heavy');
    setIsRemoving(true);
    try {
      const data = await friendsService.respond(username, false);
      if (data.success) {
        if (onFriendRemoved) onFriendRemoved();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to remove friend.');
      setIsRemoving(false);
      setShowConfirmRemove(false);
    }
  };

  // Status indicators mapping
  const getPercentageMeta = (pct: number) => {
    if (pct >= 85) return { text: 'Excellent', color: 'text-emerald-450 bg-emerald-500/10 border-emerald-500/20', ring: '#10b981' };
    if (pct >= 75) return { text: 'Safe', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20', ring: '#6366f1' };
    return { text: 'Critical', color: 'text-rose-455 bg-rose-500/10 border-rose-500/20', ring: '#ef4444' };
  };

  const pctMeta = stats ? getPercentageMeta(stats.overallPercentage) : null;
  const displayName = stats?.displayName || initialDisplayName || username;

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-[440px] bg-zinc-955 rounded-t-[32px] shadow-2xl flex flex-col h-[94%] overflow-hidden border-t border-zinc-900 text-white"
      >
        {/* Drag handle and close top row */}
        <div className="flex flex-col items-center pt-3 pb-2 px-6 border-b border-zinc-900 flex-shrink-0">
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full mb-3" />
          <div className="flex justify-between items-center w-full">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Friend Profile
            </span>
            <button
              onClick={() => { triggerHaptic('light'); onClose(); }}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex items-start space-x-2 text-rose-400 text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Profile Header */}
          <div className="bg-zinc-900 border border-zinc-850 rounded-3xl p-5 shadow-xs flex flex-col items-center text-center space-y-3 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500" />
            
            {/* Avatar */}
            <div className="relative mt-2 shrink-0">
              {renderAvatar(stats?.avatarId || initialAvatarId || undefined, displayName, 'w-20 h-20 text-3xl')}
              {/* Online indicator */}
              <div className="absolute bottom-0 right-0 flex items-center justify-center">
                <span className={`w-4 h-4 rounded-full border-2 border-zinc-900 flex items-center justify-center ${
                  isOnline ? 'bg-emerald-500' : 'bg-zinc-650'
                }`}>
                  <span className={`w-1 h-1 rounded-full bg-white ${isOnline ? 'animate-ping' : ''}`} />
                </span>
              </div>
            </div>

            {/* Display Name and Username */}
            <div className="space-y-0.5">
              <h2 className="text-lg font-display font-black text-white tracking-tight capitalize leading-tight">
                {displayName}
              </h2>
              <span className="text-xs font-semibold text-zinc-550 font-mono block">
                @{username.toLowerCase()}
              </span>
            </div>

            {/* Status Badges */}
            <div className="flex flex-wrap gap-2 justify-center pt-1">
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center ${
                isOnline 
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                  : 'bg-zinc-950 border-zinc-850 text-zinc-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
                {isOnline ? 'Active' : 'Offline'}
              </span>

              {isRefreshing && (
                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center">
                  <RefreshCw className="w-2.5 h-2.5 mr-1 animate-spin" />
                  Syncing
                </span>
              )}

              {pctMeta && (
                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${pctMeta.color}`}>
                  {pctMeta.text}
                </span>
              )}
            </div>
          </div>

          {/* Attendance Overview Card */}
          {stats && (
            <div className="bg-zinc-900 border border-zinc-850 rounded-3xl p-5 shadow-xs space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-zinc-450 flex items-center">
                <Activity className="w-4 h-4 mr-1.5 text-indigo-400" />
                Attendance Overview
              </h3>

              <div className="flex flex-col items-center sm:flex-row sm:justify-around space-y-4 sm:space-y-0 py-2">
                {/* SVG Progress Circle */}
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="w-28 h-28 transform -rotate-90">
                    <circle
                      cx="56"
                      cy="56"
                      r="48"
                      className="stroke-zinc-850 fill-transparent"
                      strokeWidth="8"
                    />
                    <motion.circle
                      cx="56"
                      cy="56"
                      r="48"
                      style={{ stroke: pctMeta?.ring || '#6366f1' }}
                      className="fill-transparent"
                      strokeWidth="8"
                      strokeDasharray="301.6"
                      initial={{ strokeDashoffset: 301.6 }}
                      animate={{ strokeDashoffset: 301.6 - (301.6 * Math.min(100, stats.overallPercentage)) / 100 }}
                      transition={{ duration: 1.0, ease: 'easeOut' }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-display font-black text-white">
                      {stats.overallPercentage}%
                    </span>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                      Overall
                    </span>
                  </div>
                </div>

                {/* Additional metrics */}
                <div className="flex-1 max-w-[200px] w-full space-y-2.5">
                  {stats.present !== undefined && (
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-400 border-b border-zinc-850 pb-1.5">
                      <span>Present</span>
                      <span className="text-white font-black">{stats.present}</span>
                    </div>
                  )}
                  {stats.absent !== undefined && (
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-400 border-b border-zinc-850 pb-1.5">
                      <span>Absent</span>
                      <span className="text-white font-black">{stats.absent}</span>
                    </div>
                  )}
                  {stats.bunks !== undefined && (
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-400 border-b border-zinc-850 pb-1.5">
                      <span>Bunks</span>
                      <span className="text-white font-black">{stats.bunks}</span>
                    </div>
                  )}
                  {stats.safeBunksLeft !== undefined && (
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-400 border-b border-zinc-850 pb-1.5">
                      <span>Safe Bunks Left</span>
                      <span className={`font-black ${stats.safeBunksLeft > 0 ? 'text-emerald-400' : 'text-rose-450'}`}>{stats.safeBunksLeft}</span>
                    </div>
                  )}
                  {stats.currentStreak !== undefined && (
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-400 border-b border-zinc-850 pb-1.5">
                      <span>Current Streak</span>
                      <span className="text-amber-500 font-black">🔥 {stats.currentStreak}</span>
                    </div>
                  )}
                  {stats.longestStreak !== undefined && (
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-400 border-b border-zinc-850 pb-1.5">
                      <span>Longest Streak</span>
                      <span className="text-white font-black">🏆 {stats.longestStreak}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Navigation Tab switcher */}
          <div className="flex bg-zinc-900 border border-zinc-850 p-1 rounded-2xl">
            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('schedule'); }}
              className={`flex-1 py-2 rounded-xl font-display font-black text-xs transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'schedule' 
                  ? 'bg-zinc-800 text-white shadow-xxs' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Schedule</span>
            </button>
            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('subjects'); }}
              className={`flex-1 py-2 rounded-xl font-display font-black text-xs transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'subjects' 
                  ? 'bg-zinc-800 text-white shadow-xxs' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Subjects</span>
            </button>
            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('about'); }}
              className={`flex-1 py-2 rounded-xl font-display font-black text-xs transition-all flex items-center justify-center space-x-1.5 ${
                activeTab === 'about' 
                  ? 'bg-zinc-800 text-white shadow-xxs' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Details</span>
            </button>
          </div>

          {/* Tab Contents: Today's Schedule */}
          {activeTab === 'schedule' && stats && (
            <div className="space-y-4 animate-fadeIn">
              {/* Today vs Tomorrow Sub-tab switcher */}
              <div className="flex bg-zinc-900 border border-zinc-850 p-0.5 rounded-xl w-36 ml-auto">
                <button
                  onClick={() => { triggerHaptic('light'); setScheduleSubTab('today'); }}
                  className={`flex-1 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all duration-200 ${
                    scheduleSubTab === 'today' ? 'bg-zinc-800 text-white shadow-xxs' : 'text-zinc-500'
                  }`}
                >
                  Today
                </button>
                <button
                  onClick={() => { triggerHaptic('light'); setScheduleSubTab('tomorrow'); }}
                  className={`flex-1 py-1 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all duration-200 ${
                    scheduleSubTab === 'tomorrow' ? 'bg-zinc-800 text-white shadow-xxs' : 'text-zinc-500'
                  }`}
                >
                  Tomorrow
                </button>
              </div>

              {/* Schedule list */}
              {scheduleSubTab === 'today' ? (
                <div className="space-y-3">
                  {stats.todaySchedule && stats.todaySchedule.length > 0 ? (
                    stats.todaySchedule.map((cls: any) => {
                      const schedStatus = getScheduledStatus(cls.time, cls.duration || 60);
                      
                      let statusBadgeColor = 'bg-zinc-950 border-zinc-850 text-zinc-400';
                      let statusLabel = schedStatus;

                      if (cls.status === 'attended') {
                        statusBadgeColor = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-450';
                        statusLabel = 'Present';
                      } else if (cls.status === 'bunked') {
                        statusBadgeColor = 'bg-rose-500/10 border border-rose-500/20 text-rose-450';
                        statusLabel = 'Absent';
                      } else {
                        if (schedStatus === 'Ongoing') {
                          statusBadgeColor = 'bg-amber-500/10 border-amber-500/20 text-amber-450';
                        } else if (schedStatus === 'Upcoming') {
                          statusBadgeColor = 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400';
                        }
                      }

                      return (
                        <div key={cls.id} className="bg-zinc-900 border border-zinc-850 rounded-2xl p-4 flex justify-between items-center text-left">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-1.5">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cls.subjectColor }} />
                              <h4 className="text-xs font-black text-white leading-tight">
                                {cls.subjectName}
                              </h4>
                            </div>
                            
                            <div className="flex flex-wrap gap-1.5 items-center text-[10px] text-zinc-500 font-semibold">
                              <span>⏰ {cls.time}</span>
                              {cls.room && <span>• 🏫 {cls.room}</span>}
                            </div>
                          </div>

                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${statusBadgeColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-10 bg-zinc-900/40 rounded-3xl border border-zinc-900">
                      <Clock className="w-8 h-8 text-zinc-755 mx-auto mb-2" />
                      <p className="text-xs font-bold text-zinc-400">No classes scheduled today</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.tomorrowSchedule && stats.tomorrowSchedule.length > 0 ? (
                    stats.tomorrowSchedule.map((cls: any) => (
                      <div key={cls.id} className="bg-zinc-900 border border-zinc-850 rounded-2xl p-4 flex justify-between items-center text-left">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cls.subjectColor }} />
                            <h4 className="text-xs font-black text-white leading-tight">
                              {cls.subjectName}
                            </h4>
                          </div>
                          
                          <div className="flex flex-wrap gap-1.5 items-center text-[10px] text-zinc-500 font-semibold">
                            <span>⏰ {cls.time}</span>
                            {cls.room && <span>• 🏫 {cls.room}</span>}
                          </div>
                        </div>
                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-850 text-zinc-450">
                          Tomorrow
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 bg-zinc-900/40 rounded-3xl border border-zinc-900">
                      <Clock className="w-8 h-8 text-zinc-755 mx-auto mb-2" />
                      <p className="text-xs font-bold text-zinc-400">No classes scheduled tomorrow</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab Contents: Subjects list */}
          {activeTab === 'subjects' && stats && (
            <div className="space-y-3 animate-fadeIn">
              {stats.subjects && stats.subjects.length > 0 ? (
                stats.subjects.map((sub: any) => {
                  const isBelowTarget = sub.attendancePercentage < 75;
                  return (
                    <div key={sub.name} className="bg-zinc-900 border border-zinc-850 rounded-2xl p-4 space-y-3 text-left">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: sub.color }} />
                          <h4 className="text-xs font-black text-white leading-tight">
                            {sub.name}
                          </h4>
                        </div>
                        <span className={`font-mono font-black text-xs px-2 py-0.5 rounded-md ${
                          isBelowTarget ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-zinc-950 border border-zinc-850 text-zinc-300'
                        }`}>
                          {sub.attendancePercentage}%
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-900">
                        <div 
                          className="h-full rounded-full transition-all duration-550"
                          style={{ 
                            width: `${sub.attendancePercentage}%`,
                            backgroundColor: sub.color 
                          }}
                        />
                      </div>

                      {(sub.present !== undefined || sub.total !== undefined || sub.safeBunks !== undefined) && (
                        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold">
                          {sub.present !== undefined && sub.total !== undefined && (
                            <span>Logged: {sub.present}/{sub.total} classes</span>
                          )}
                          {sub.safeBunks !== undefined && (
                            <span className={sub.safeBunks > 0 ? 'text-emerald-450' : 'text-rose-450'}>
                              {sub.safeBunks > 0 ? `Safe bunks remaining: ${sub.safeBunks}` : 'Warning!'}
                            </span>
                          )}
                        </div>
                      )}

                      {isBelowTarget && (
                        <div className="flex items-center space-x-1 text-[9px] font-black uppercase text-rose-450 bg-rose-500/10 p-1.5 rounded-lg border border-rose-500/20">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          <span>Below target</span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 bg-zinc-900/40 rounded-3xl border border-zinc-900">
                  <BookOpen className="w-8 h-8 text-zinc-755 mx-auto mb-2" />
                  <p className="text-xs font-bold text-zinc-400">No courses synced</p>
                  <p className="text-[10px] text-zinc-550 mt-0.5">Your buddy has not synchronized their curriculum yet.</p>
                </div>
              )}
            </div>
          )}

          {/* Tab Contents: About / Details */}
          {activeTab === 'about' && (
            <div className="space-y-4 animate-fadeIn">
              {/* Profile details */}
              {stats && (
                <div className="bg-zinc-900 border border-zinc-850 rounded-3xl p-5 shadow-xs space-y-4 text-left">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-450 flex items-center">
                    <GraduationCap className="w-4 h-4 mr-1.5 text-indigo-455" />
                    Academic Details
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                      <span className="text-zinc-500 font-bold">College</span>
                      <span className="text-white font-bold">{stats.collegeName || stats.college || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                      <span className="text-zinc-500 font-bold">Course</span>
                      <span className="text-white font-bold">{stats.course || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                      <span className="text-zinc-500 font-bold">Major / Branch</span>
                      <span className="text-white font-bold">{stats.major || stats.department || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                      <span className="text-zinc-500 font-bold">Semester</span>
                      <span className="text-white font-bold">{stats.semester || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                      <span className="text-zinc-500 font-bold">Section</span>
                      <span className="text-white font-bold">{stats.section || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                      <span className="text-zinc-500 font-bold">Group / Batch</span>
                      <span className="text-white font-bold">{stats.group || 'Not set'}</span>
                    </div>
                    {stats.friendSince && (
                      <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                        <span className="text-zinc-500 font-bold">Friend Since</span>
                        <span className="text-white font-bold">
                          {new Date(stats.friendSince).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                      <span className="text-zinc-500 font-bold">Last Sync Time</span>
                      <span className="text-white font-bold flex items-center text-[11px] font-mono">
                        <Clock className="w-3.5 h-3.5 mr-1 text-zinc-500" />
                        {stats.updatedAt ? new Date(stats.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Statistics card */}
              {stats && (stats.weeklyAttendance !== undefined || stats.monthlyAttendance !== undefined || stats.semesterAttendance !== undefined || stats.attendanceTrend !== undefined || stats.goal !== undefined) && (
                <div className="bg-zinc-900 border border-zinc-850 rounded-3xl p-5 shadow-xs space-y-4 text-left">
                  <h3 className="text-xs font-black uppercase tracking-wider text-zinc-450 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-1.5 text-indigo-400" />
                    Additional Statistics
                  </h3>
                  
                  <div className="space-y-3">
                    {stats.weeklyAttendance !== undefined && (
                      <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                        <span className="text-zinc-500 font-bold">Weekly Attendance</span>
                        <span className="text-white font-black">{stats.weeklyAttendance}%</span>
                      </div>
                    )}
                    {stats.monthlyAttendance !== undefined && (
                      <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                        <span className="text-zinc-500 font-bold">Monthly Attendance</span>
                        <span className="text-white font-black">{stats.monthlyAttendance}%</span>
                      </div>
                    )}
                    {stats.semesterAttendance !== undefined && (
                      <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                        <span className="text-zinc-500 font-bold">Semester Attendance</span>
                        <span className="text-white font-black">{stats.semesterAttendance}%</span>
                      </div>
                    )}
                    {stats.attendanceTrend !== undefined && (
                      <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                        <span className="text-zinc-500 font-bold">Attendance Trend</span>
                        <span className="text-white font-black font-mono">{stats.attendanceTrend}</span>
                      </div>
                    )}
                    {stats.goal !== undefined && (
                      <div className="flex justify-between items-center text-xs border-b border-zinc-850 pb-2">
                        <span className="text-zinc-500 font-bold">Goal</span>
                        <span className="text-indigo-400 font-black">{stats.goal}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Offline consistency badge */}
              <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-900 flex items-start space-x-2 text-[10px] text-zinc-550 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Values synced from buddy's local SQLite database. Everything looks good.</span>
              </div>
            </div>
          )}

          {/* Loading state spinner */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-20 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
              <span className="text-xs font-semibold text-zinc-500">Loading friend curriculum...</span>
            </div>
          )}
        </div>

        {/* Bottom Actions footer bar */}
        <div className="bg-zinc-955 border-t border-zinc-900 p-4 flex space-x-3 flex-shrink-0">
          <button
            onClick={() => { triggerHaptic('light'); onClose(); }}
            className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-850 text-zinc-350 border border-zinc-800 rounded-2xl text-xs font-black transition cursor-pointer flex items-center justify-center"
          >
            Close
          </button>
          
          <button
            onClick={() => { triggerHaptic('light'); loadStats(true); }}
            disabled={isLoading || isRefreshing}
            className="px-4 bg-zinc-900 hover:bg-zinc-850 text-indigo-400 border border-zinc-800 rounded-2xl text-xs font-black transition cursor-pointer disabled:opacity-50 flex items-center justify-center"
            title="Refresh Details"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-500' : ''}`} />
          </button>

          <button
            onClick={() => { triggerHaptic('medium'); setShowConfirmRemove(true); }}
            disabled={isRemoving}
            className="px-4 bg-rose-950/20 hover:bg-rose-900/30 text-rose-455 border border-rose-900/20 rounded-2xl text-xs font-black transition cursor-pointer disabled:opacity-50 flex items-center justify-center"
            title="Remove Friend"
          >
            <UserMinus className="w-4 h-4" />
          </button>
        </div>

        {/* Remove Friend confirm overlay */}
        <AnimatePresence>
          {showConfirmRemove && (
            <div className="absolute inset-0 bg-black/80 z-[60] flex items-center justify-center p-6 text-center backdrop-blur-sm">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-zinc-900 p-6 rounded-3xl max-w-[300px] w-full shadow-2xl border border-zinc-850 space-y-4 text-white animate-fadeIn"
              >
                <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto border border-rose-500/20">
                  <UserMinus className="w-6 h-6" />
                </div>
                <h4 className="text-base font-display font-black text-white">Remove Buddy?</h4>
                <p className="text-zinc-400 text-xs leading-relaxed font-semibold">
                  Are you sure you want to remove <b>@{username}</b> from your class buddies? You will no longer see each other's live attendance.
                </p>
                <div className="flex space-x-3 pt-2">
                  <button
                    onClick={() => { triggerHaptic('light'); setShowConfirmRemove(false); }}
                    className="flex-1 py-2.5 text-xs font-bold bg-zinc-800 hover:bg-zinc-755 text-zinc-300 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRemoveFriend}
                    disabled={isRemoving}
                    className="flex-1 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center space-x-1"
                  >
                    {isRemoving && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />}
                    <span>Remove</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
