import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  GraduationCap,
  BookOpen,
  Building2,
  Calendar,
  Layers,
  Edit3,
  Cloud,
  CloudCheck,
  RefreshCw,
  Smartphone,
  LogOut,
  Settings,
  ShieldCheck,
  Zap,
  Wifi,
  WifiOff,
  ChevronRight,
  Key,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle
} from 'lucide-react';
import { db, triggerHaptic } from '../../utils/db';
import { syncService, SyncStatus } from '../../utils/syncService';
import { AppPreferences } from '../../types';
import { renderAvatar } from './CompleteProfileModal';
import ConnectedDevicesModal from './ConnectedDevicesModal';
import { AnalyticsRepository } from '../../repositories/AnalyticsRepository';

const PRESET_QUESTIONS = [
  "What was the name of your first school?",
  "What is your mother's maiden name?",
  "What is your major course name?",
  "What was the name of your first pet?",
  "In what city were you born?"
];

interface ProfileViewProps {
  preferences: AppPreferences;
  onEditProfile: () => void;
  onOpenLogin: () => void;
  onOpenSettings: () => void;
  onOpenUpdates: () => void;
  onUpdatePreferences: (newPrefs: AppPreferences) => void;
  onViewScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export default function ProfileView({
  preferences,
  onEditProfile,
  onOpenLogin,
  onOpenSettings,
  onOpenUpdates,
  onUpdatePreferences,
  onViewScroll
}: ProfileViewProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSynced: preferences.syncLastSynced || 0,
    error: null
  });
  const [showDevicesModal, setShowDevicesModal] = useState(false);
  const [humanStatus, setHumanStatus] = useState(syncService.getHumanReadableStatus());

  // Cloud Account Management states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>( '');
  const [deleteError, setDeleteError] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Change password states
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);
  const [oldPassword, setOldPassword] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmNewPassword, setConfirmNewPassword] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string>('');
  const [passwordSuccess, setPasswordSuccess] = useState<string>('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState<boolean>(false);

  // Security Question (Clue) Update inside password change
  const [updateSecurityClue, setUpdateSecurityClue] = useState<boolean>(false);
  const [securityQuestion, setSecurityQuestion] = useState<string>(PRESET_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState<string>('');
  const [isCustomQuestion, setIsCustomQuestion] = useState<boolean>(false);
  const [securityAnswer, setSecurityAnswer] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = syncService.subscribe((status) => {
      setSyncStatus(status);
      setHumanStatus(syncService.getHumanReadableStatus());
    });

    const interval = setInterval(() => {
      setHumanStatus(syncService.getHumanReadableStatus());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleManualSync = async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      triggerHaptic('medium');
      await syncService.performSync();
    } catch (err) {
      console.error('Manual sync error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    triggerHaptic('heavy');
    const confirmLogout = window.confirm('Are you sure you want to log out of your Cloud Account? Local data will remain saved on this device.');
    if (confirmLogout) {
      const updatedPrefs = {
        ...db.getPrefs(),
        syncEnabled: false,
        syncToken: '',
        syncUsername: '',
        syncUserId: ''
      };
      await db.savePrefs(updatedPrefs, false, false);
      window.location.reload();
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) return;
    setIsDeleting(true);
    setDeleteError('');
    triggerHaptic('heavy');

    const result = await syncService.deleteAccount(deletePassword);
    setIsDeleting(false);

    if (result.success) {
      triggerHaptic('success');
      alert('Your cloud account has been permanently deleted.');
      setShowDeleteConfirm(false);
      setDeletePassword('');
      onUpdatePreferences(db.getPrefs());
    } else {
      triggerHaptic('error');
      setDeleteError(result.error || 'Failed to delete account.');
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmNewPassword) {
      triggerHaptic('error');
      setPasswordError('All password fields are required.');
      return;
    }
    if (newPassword.length < 6) {
      triggerHaptic('error');
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      triggerHaptic('error');
      setPasswordError('New passwords do not match.');
      return;
    }

    const activeQuestion = isCustomQuestion ? customQuestion.trim() : securityQuestion.trim();
    if (updateSecurityClue) {
      if (!activeQuestion || activeQuestion.length < 5) {
        triggerHaptic('error');
        setPasswordError('Please provide a valid security question.');
        return;
      }
      if (!securityAnswer.trim() || securityAnswer.trim().length < 2) {
        triggerHaptic('error');
        setPasswordError('Please provide a descriptive answer for your recovery clue.');
        return;
      }
    }

    setIsUpdatingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');
    triggerHaptic('heavy');

    const result = await syncService.changePassword(
      oldPassword, 
      newPassword,
      updateSecurityClue ? activeQuestion : undefined,
      updateSecurityClue ? securityAnswer.trim() : undefined
    );
    setIsUpdatingPassword(false);

    if (result.success) {
      triggerHaptic('success');
      setPasswordSuccess('Password updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setSecurityAnswer('');
      setCustomQuestion('');
      setIsCustomQuestion(false);
      setUpdateSecurityClue(false);
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setPasswordSuccess('');
      }, 1500);
    } else {
      triggerHaptic('error');
      setPasswordError(result.error || 'Failed to update password.');
    }
  };

  const subjects = db.getSubjects();
  const records = db.getRecords();

  // 1. Organized Student (>= 4 subjects)
  const isOrganizedUnlocked = subjects.length >= 4;

  // 2. Attendance Champ (overall attendance >= 85%)
  let totalConducted = 0;
  let totalPresent = 0;
  subjects.forEach(sub => {
    const subRecords = records.filter(r => r.subjectId === sub.id);
    const present = subRecords.filter(r => r.status === 'attended').length;
    const absent = subRecords.filter(r => r.status === 'bunked').length;
    const finalPresent = (sub.initialPresent || 0) + present;
    const finalAbsent = (sub.initialAbsent || 0) + absent;
    totalPresent += finalPresent;
    totalConducted += (finalPresent + finalAbsent);
  });
  const overallPercentage = totalConducted > 0 ? Math.round((totalPresent / totalConducted) * 100) : 0;
  const isChampUnlocked = totalConducted > 0 && overallPercentage >= 85;

  // 3. Bunk Planner (all subjects >= 75%)
  const hasSubjects = subjects.length > 0;
  const isPlannerUnlocked = hasSubjects && subjects.every(sub => {
    const subRecords = records.filter(r => r.subjectId === sub.id);
    const present = subRecords.filter(r => r.status === 'attended').length;
    const absent = subRecords.filter(r => r.status === 'bunked').length;
    const finalPresent = (sub.initialPresent || 0) + present;
    const finalAbsent = (sub.initialAbsent || 0) + absent;
    const total = finalPresent + finalAbsent;
    if (total === 0) return true;
    return (finalPresent / total) >= 0.75;
  });

  // 4. Streak Master (streak >= 3)
  const currentStreak = AnalyticsRepository.calculateCurrentStreak(records);
  const isStreakUnlocked = currentStreak >= 3;

  const isLoggedIn = !!(preferences.syncEnabled && preferences.syncToken && preferences.syncUsername);

  return (
    <div
      onScroll={onViewScroll}
      className="h-full overflow-y-auto px-4 pt-6 pb-32 bg-black text-white select-none space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            👤 Student Profile
          </h1>
          <p className="text-xs text-zinc-400 font-medium">Manage your cloud account & academic info</p>
        </div>
        <button
          onClick={() => {
            triggerHaptic('light');
            onOpenSettings();
          }}
          className="p-3 bg-zinc-900/90 border border-zinc-800 rounded-2xl text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all active:scale-95 shadow-lg flex items-center gap-2 text-xs font-semibold"
        >
          <Settings className="w-4 h-4 text-indigo-400" />
          Settings
        </button>
      </div>

      {/* Main Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800/80 p-6 shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-center gap-5">
          {/* Avatar Display */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-xl flex items-center justify-center">
              <div className="w-full h-full bg-zinc-955 rounded-full overflow-hidden flex items-center justify-center">
                {renderAvatar(preferences.avatarId || 'male_student_1', 'w-full h-full')}
              </div>
            </div>
            <button
              onClick={() => {
                triggerHaptic('light');
                onEditProfile();
              }}
              className="absolute bottom-0 right-0 p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-lg border-2 border-zinc-900 transition-transform active:scale-95"
              title="Edit Profile Avatar"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* User Info Details */}
          <div className="flex-1 text-center sm:text-left space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {preferences.displayName || (preferences.syncUsername ? `@${preferences.syncUsername}` : 'Academic Student')}
              </h2>
              {isLoggedIn && (
                <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Cloud Sync Active
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-indigo-400">
              @{preferences.syncUsername || 'local_user'}
            </p>
            <p className="text-xs text-zinc-400 flex items-center justify-center sm:justify-start gap-1">
              <Building2 className="w-3.5 h-3.5 text-zinc-500" />
              {preferences.collegeName || 'Not configured yet'}
            </p>
          </div>
        </div>

        {/* Academic Profile Details Grid */}
        <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-zinc-800/80 text-xs">
          <div className="bg-zinc-955/60 border border-zinc-850/65 p-3 rounded-2xl">
            <span className="text-zinc-500 flex items-center gap-1 mb-1 font-medium text-[10px]">
              <GraduationCap className="w-3 h-3 text-indigo-400" /> Course & Major
            </span>
            <p className="font-semibold text-zinc-200 truncate">{preferences.course || 'N/A'}</p>
          </div>

          <div className="bg-zinc-955/60 border border-zinc-850/65 p-3 rounded-2xl">
            <span className="text-zinc-500 flex items-center gap-1 mb-1 font-medium text-[10px]">
              <BookOpen className="w-3 h-3 text-purple-400" /> Department
            </span>
            <p className="font-semibold text-zinc-200 truncate">{preferences.major || 'N/A'}</p>
          </div>

          <div className="bg-zinc-955/60 border border-zinc-850/65 p-3 rounded-2xl">
            <span className="text-zinc-500 flex items-center gap-1 mb-1 font-medium text-[10px]">
              <Calendar className="w-3 h-3 text-blue-400" /> Semester
            </span>
            <p className="font-semibold text-zinc-200 truncate">{preferences.semester ? `Semester ${preferences.semester}` : 'N/A'}</p>
          </div>

          <div className="bg-zinc-955/60 border border-zinc-850/65 p-3 rounded-2xl">
            <span className="text-zinc-500 flex items-center gap-1 mb-1 font-medium text-[10px]">
              <Layers className="w-3 h-3 text-amber-400" /> Section & Group
            </span>
            <p className="font-semibold text-zinc-200 truncate">
              {preferences.section ? `Sec ${preferences.section}` : ''} {preferences.group ? `(${preferences.group})` : ''} {!preferences.section && !preferences.group ? 'N/A' : ''}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            triggerHaptic('medium');
            onEditProfile();
          }}
          className="w-full mt-4 py-3 bg-indigo-650/20 hover:bg-indigo-650/30 text-indigo-300 font-semibold rounded-2xl border border-indigo-500/30 transition-all flex items-center justify-center gap-2 text-xs"
        >
          <Edit3 className="w-4 h-4" /> Edit Profile Details
        </button>
      </motion.div>

      {/* Achievements Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono font-black uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
          🏆 Student Achievements
        </h3>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent snap-x snap-mandatory">
          {/* Achievement 1: Attendance Champ */}
          <div className="snap-start shrink-0 w-72 bg-zinc-900 border border-zinc-800 p-4 rounded-3xl flex items-center gap-4 relative overflow-hidden">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isChampUnlocked ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-zinc-955 text-zinc-600 border border-zinc-850'}`}>
              <span className="text-2xl">{isChampUnlocked ? '🏆' : '🔒'}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white block truncate">Attendance Champ</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isChampUnlocked ? 'bg-amber-500/15 text-amber-400' : 'bg-zinc-955 text-zinc-500'}`}>
                  {isChampUnlocked ? 'Unlocked' : 'Locked'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                Maintain overall attendance &gt;= 85%. (Current: {overallPercentage}%)
              </p>
            </div>
          </div>

          {/* Achievement 2: Bunk Planner */}
          <div className="snap-start shrink-0 w-72 bg-zinc-900 border border-zinc-800 p-4 rounded-3xl flex items-center gap-4 relative overflow-hidden">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isPlannerUnlocked ? 'bg-emerald-500/10 text-emerald-455 border border-emerald-500/20' : 'bg-zinc-955 text-zinc-600 border border-zinc-850'}`}>
              <span className="text-2xl">{isPlannerUnlocked ? '🎯' : '🔒'}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white block truncate">Safe Bunk Planner</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isPlannerUnlocked ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-955 text-zinc-500'}`}>
                  {isPlannerUnlocked ? 'Unlocked' : 'Locked'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                Keep attendance for all subjects &gt;= 75%.
              </p>
            </div>
          </div>

          {/* Achievement 3: Streak Master */}
          <div className="snap-start shrink-0 w-72 bg-zinc-900 border border-zinc-800 p-4 rounded-3xl flex items-center gap-4 relative overflow-hidden">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isStreakUnlocked ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-zinc-955 text-zinc-600 border border-zinc-850'}`}>
              <span className="text-2xl">{isStreakUnlocked ? '🔥' : '🔒'}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white block truncate">Streak Master</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isStreakUnlocked ? 'bg-rose-500/15 text-rose-400' : 'bg-zinc-955 text-zinc-500'}`}>
                  {isStreakUnlocked ? 'Unlocked' : 'Locked'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                Consecutive attendance streak of 3+ days. (Current: {currentStreak}d)
              </p>
            </div>
          </div>

          {/* Achievement 4: Organized Scholar */}
          <div className="snap-start shrink-0 w-72 bg-zinc-900 border border-zinc-800 p-4 rounded-3xl flex items-center gap-4 relative overflow-hidden">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isOrganizedUnlocked ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-zinc-955 text-zinc-600 border border-zinc-855'}`}>
              <span className="text-2xl">{isOrganizedUnlocked ? '📚' : '🔒'}</span>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white block truncate">Organized Scholar</span>
                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isOrganizedUnlocked ? 'bg-indigo-500/15 text-indigo-400' : 'bg-zinc-955 text-zinc-500'}`}>
                  {isOrganizedUnlocked ? 'Unlocked' : 'Locked'}
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                Add 4 or more subjects to your list. (Current: {subjects.length})
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cloud Account & Synchronization Status Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-3xl bg-zinc-900 border border-zinc-800 p-6 space-y-4 shadow-xl"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Cloud Account Status</h3>
              <p className={`text-[11px] font-medium ${preferences.syncDatabaseMode === 'ephemeral' ? 'text-amber-400 font-bold animate-pulse' : 'text-zinc-400'}`}>
                {humanStatus}
              </p>
            </div>
          </div>

          <button
            onClick={handleManualSync}
            disabled={isRefreshing || !isLoggedIn}
            className={`p-2.5 bg-zinc-800 text-zinc-200 rounded-2xl border border-zinc-700 hover:text-white transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center ${isRefreshing ? 'animate-spin' : ''}`}
            title="Force Cloud Sync"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {preferences.syncDatabaseMode === 'ephemeral' && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 space-y-1.5 text-xs text-amber-400">
            <span className="font-extrabold flex items-center gap-1.5">
              ⚠️ Production Database Offline
            </span>
            <p className="text-[11px] leading-relaxed text-zinc-300">
              The backend is running in temporary SQLite mode. Server containers will recycle and discard all registrations/timetables.
            </p>
            <p className="text-[11px] font-semibold text-indigo-300">
              Fix: Add <code className="bg-zinc-950 px-1 py-0.5 rounded font-mono text-[10px] text-indigo-300">SUPABASE_URL</code> and <code className="bg-zinc-950 px-1 py-0.5 rounded font-mono text-[10px] text-indigo-300">SUPABASE_ANON_KEY</code> to Vercel env vars and redeploy.
            </p>
          </div>
        )}

        {/* Cloud Account Details */}
        {isLoggedIn ? (
          <div className="space-y-3 pt-2">
            <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-medium">Logged in Username:</span>
                <span className="text-white font-bold font-mono">@{preferences.syncUsername}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-medium">Cloud Account UUID:</span>
                <span className="text-zinc-400 font-mono text-[10px] bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                  {preferences.syncUserId ? `${preferences.syncUserId.slice(0, 8)}...${preferences.syncUserId.slice(-4)}` : 'Active'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-medium">Last Cloud Sync:</span>
                <span className="text-zinc-300 font-medium text-[11px]">
                  {preferences.syncLastSynced ? new Date(preferences.syncLastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setShowDevicesModal(true);
                }}
                className="py-3 px-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-zinc-300 hover:text-white text-xs font-semibold flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-purple-400" /> Devices
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-600" />
              </button>

              <button
                onClick={handleLogout}
                className="py-3 px-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>

            {/* Change Password & Delete Account Section */}
            <div className="space-y-2 pt-2 border-t border-zinc-800/40">
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setShowChangePasswordModal(true);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                  setPasswordError('');
                  setPasswordSuccess('');
                  setUpdateSecurityClue(false);
                  setSecurityQuestion(PRESET_QUESTIONS[0]);
                  setCustomQuestion('');
                  setIsCustomQuestion(false);
                  setSecurityAnswer('');
                }}
                className="w-full py-2.5 bg-zinc-950 hover:bg-zinc-850 border border-dashed border-zinc-800 text-zinc-350 rounded-2xl text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Key className="w-3.5 h-3.5 text-indigo-400 mr-1" />
                <span>Change Cloud Password</span>
              </button>

              <button
                onClick={() => { triggerHaptic('heavy'); setShowDeleteConfirm(true); setDeletePassword(''); setDeleteError(''); }}
                className="w-full py-2.5 bg-red-500/5 hover:bg-red-500/10 border border-dashed border-red-900/30 text-red-405 rounded-2xl text-xs font-semibold transition flex items-center justify-center space-x-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500 mr-1" />
                <span>Delete Cloud Account</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 text-center space-y-3">
            <p className="text-xs text-zinc-400 leading-relaxed">
              Connect your BunkMate Cloud Account to enable live attendance sharing with friends and seamless cross-device synchronization.
            </p>
            <button
              onClick={() => {
                triggerHaptic('medium');
                onOpenLogin();
              }}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl text-xs shadow-lg hover:brightness-110 transition-all"
            >
              Sign In or Create Cloud Account
            </button>
          </div>
        )}
      </motion.div>

      {/* App Updates & Version Information Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-3xl bg-zinc-900 border border-zinc-800 p-5 space-y-4 shadow-xl text-left"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400 border border-indigo-500/20">
              <span className="text-xl">📢</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">App Updates & About</h3>
              <p className="text-[11px] text-zinc-405 font-medium">Check for updates & system status</p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('light');
              onOpenUpdates();
            }}
            className="py-2 px-3 bg-zinc-950 hover:bg-zinc-855 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>Open updates</span>
            <ChevronRight className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {showDevicesModal && (
          <ConnectedDevicesModal 
            onClose={() => setShowDevicesModal(false)} 
            username={preferences.syncUsername || 'local_user'}
          />
        )}
      </AnimatePresence>

      {/* Confirm Delete Cloud Account Overlay */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-6 text-center select-none backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-6 w-full max-w-[320px] shadow-2xl rounded-3xl space-y-4"
            >
              <div className="w-12 h-12 bg-red-950/20 text-red-400 rounded-full flex items-center justify-center mx-auto border border-red-900/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-display font-bold text-white">Delete Cloud Account?</h4>
              <p className="text-zinc-405 text-xs leading-relaxed">
                This will delete your cloud account and all synced data permanently. This cannot be undone. Enter your password to confirm:
              </p>
              
              {deleteError && (
                <div className="text-[10px] text-red-400 font-bold bg-red-950/40 p-2 rounded-lg border border-red-900/20">
                  {deleteError}
                </div>
              )}

              <input
                type="password"
                disabled={isDeleting}
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:outline-none focus:border-indigo-500 text-xs font-bold text-center placeholder:text-zinc-600"
              />

              <div className="flex space-x-3 pt-2">
                <button
                  disabled={isDeleting}
                  onClick={() => {
                    triggerHaptic('light');
                    setShowDeleteConfirm(false);
                    setDeletePassword('');
                    setDeleteError('');
                  }}
                  className="flex-1 py-2 text-xs font-semibold bg-zinc-800 text-zinc-300 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={isDeleting || !deletePassword}
                  onClick={handleDeleteAccount}
                  className="flex-1 py-2 text-xs font-semibold bg-red-655 hover:bg-red-700 text-white rounded-lg shadow-sm transition cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Account</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Change Cloud Password Overlay */}
      <AnimatePresence>
        {showChangePasswordModal && (
          <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-6 text-center select-none backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-800 p-6 w-full max-w-[320px] shadow-2xl rounded-3xl space-y-4 text-left"
            >
              <div className="w-12 h-12 bg-indigo-950/40 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-900/30">
                <Key className="w-6 h-6" />
              </div>
              <h4 className="text-base font-display font-bold text-white text-center">Change Cloud Password</h4>
              <p className="text-zinc-405 text-xs leading-relaxed text-center">
                Please enter your current password and your new password below.
              </p>
              
              {passwordError && (
                <div className="text-[10px] text-red-400 font-bold bg-red-950/40 p-2.5 rounded-xl border border-red-900/20 text-center">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="text-[10px] text-emerald-400 font-bold bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-900/20 text-center">
                  {passwordSuccess}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-black mb-1">Current Password</label>
                  <input
                    type="password"
                    disabled={isUpdatingPassword}
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-black mb-1">New Password</label>
                  <input
                    type="password"
                    disabled={isUpdatingPassword}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-black mb-1">Confirm New Password</label>
                  <input
                    type="password"
                    disabled={isUpdatingPassword}
                    value={confirmNewPassword}
                    onChange={e => setConfirmNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-bold"
                  />
                </div>

                <div className="pt-2 border-t border-zinc-900 space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      disabled={isUpdatingPassword}
                      checked={updateSecurityClue}
                      onChange={e => setUpdateSecurityClue(e.target.checked)}
                      className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">Update Security Question (Clue)</span>
                  </label>

                  {updateSecurityClue && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-black mb-1">Security Question</label>
                        {!isCustomQuestion ? (
                          <select
                            disabled={isUpdatingPassword}
                            value={securityQuestion}
                            onChange={e => {
                              if (e.target.value === 'custom') {
                                setIsCustomQuestion(true);
                              } else {
                                setSecurityQuestion(e.target.value);
                              }
                            }}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 transition"
                          >
                            {PRESET_QUESTIONS.map((q, idx) => (
                              <option key={idx} value={q}>{q}</option>
                            ))}
                            <option value="custom">Write custom question...</option>
                          </select>
                        ) : (
                          <div className="space-y-1">
                            <input
                              type="text"
                              disabled={isUpdatingPassword}
                              value={customQuestion}
                              onChange={e => setCustomQuestion(e.target.value)}
                              placeholder="e.g. What is your favorite book?"
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 transition"
                            />
                            <button
                              type="button"
                              onClick={() => setIsCustomQuestion(false)}
                              className="text-[9px] font-semibold text-indigo-400 hover:text-indigo-305"
                            >
                              Use list instead
                            </button>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[9px] uppercase tracking-wider text-zinc-500 font-black mb-1">Answer Clue</label>
                        <input
                          type="text"
                          disabled={isUpdatingPassword}
                          value={securityAnswer}
                          onChange={e => setSecurityAnswer(e.target.value)}
                          placeholder="Your secure recovery answer"
                          className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800 text-white rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-bold"
                        />
                        <p className="text-[8px] text-zinc-550 font-semibold px-1 mt-0.5">Answer is hashed and private.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  disabled={isUpdatingPassword}
                  onClick={() => {
                    triggerHaptic('light');
                    setShowChangePasswordModal(false);
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setPasswordError('');
                    setPasswordSuccess('');
                    setUpdateSecurityClue(false);
                    setSecurityQuestion(PRESET_QUESTIONS[0]);
                    setCustomQuestion('');
                    setIsCustomQuestion(false);
                    setSecurityAnswer('');
                  }}
                  className="flex-1 py-2.5 text-xs font-semibold bg-zinc-800 text-zinc-300 rounded-xl transition cursor-pointer disabled:opacity-50 text-center"
                >
                  Cancel
                </button>
                <button
                  disabled={isUpdatingPassword || !oldPassword || !newPassword || !confirmNewPassword || (updateSecurityClue && (!securityAnswer || (!isCustomQuestion && !securityQuestion) || (isCustomQuestion && !customQuestion)))}
                  onClick={handleChangePassword}
                  className="flex-1 py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50 text-center"
                >
                  {isUpdatingPassword ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
