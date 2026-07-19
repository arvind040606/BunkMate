import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Sliders, Volume2, Key, Download, Upload, Trash2, ShieldCheck, RefreshCw, AlertTriangle, Fingerprint, Lock, CheckCircle2, Bell, Clock, Sparkles, Shield, Eye, EyeOff, FileText, Cloud, Users, Smartphone, LogOut, User, Image as ImageIcon, ZoomIn, ZoomOut, X } from 'lucide-react';
import { AppPreferences, Subject, AttendanceRecord } from '../../types';
import { triggerHaptic, db } from '../../utils/db';
import { encryptData, decryptData } from '../../utils/crypto';
import { syncService } from '../../utils/syncService';
import LoginModal from './LoginModal';
import FriendsModal from './FriendsModal';
import ConnectedDevicesModal from './ConnectedDevicesModal';
import CompleteProfileModal, { getAvatarEmoji, renderAvatar } from './CompleteProfileModal';

interface SettingsViewProps {
  preferences: AppPreferences;
  onUpdatePreferences: (newPrefs: AppPreferences) => void;
  onImportData: (subjects: Subject[], records: AttendanceRecord[]) => void;
  subjects: Subject[];
  records: AttendanceRecord[];
  onRefreshNotifications?: () => void;
  onOpenWizard?: () => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onTabChange?: (tab: 'home' | 'calendar' | 'subjects' | 'analytics' | 'settings') => void;
}

export default function SettingsView({
  preferences,
  onUpdatePreferences,
  onImportData,
  subjects,
  records,
  onRefreshNotifications,
  onOpenWizard,
  onScroll,
  onTabChange,
}: SettingsViewProps) {
  const globalTarget = preferences.globalTarget;
  const [showPinSetupModal, setShowPinSetupModal] = useState<boolean>(false);
  const [tempPin, setTempPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // Cloud synchronization & social view states
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showFriendsModal, setShowFriendsModal] = useState<boolean>(false);
  const [showConnectedDevicesModal, setShowConnectedDevicesModal] = useState<boolean>(false);
  const [showCompleteProfileModal, setShowCompleteProfileModal] = useState<boolean>(false);
  const [successPopup, setSuccessPopup] = useState<{ show: boolean; type: 'login' | 'register' | null }>({ show: false, type: null });

  // Vault states
  const [hasVaultImage, setHasVaultImage] = useState(false);
  const [savedImageBase64, setSavedImageBase64] = useState<string | null>(null);
  const [showVaultViewer, setShowVaultViewer] = useState(false);
  const [vaultZoom, setVaultZoom] = useState(1);

  React.useEffect(() => {
    import('../../utils/vault').then(module => {
      module.TimetableVault.getImage().then(img => {
        if (img && img.startsWith('data:image')) {
          setHasVaultImage(true);
          setSavedImageBase64(img);
        }
      }).catch(err => {
        console.warn('Vault error:', err);
      });
    });
  }, []);

  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    lastSynced: preferences.syncLastSynced || 0,
    error: null as string | null
  });

  React.useEffect(() => {
    const unsub = syncService.subscribe((status) => {
      setSyncStatus({
        isSyncing: status.isSyncing,
        lastSynced: status.lastSynced,
        error: status.error
      });
    });
    return unsub;
  }, [preferences.syncLastSynced]);

  const [showImportTextModal, setShowImportTextModal] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');
  const [importError, setImportError] = useState<string>('');

  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState<boolean>(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [deletePassword, setDeletePassword] = useState<string>('');
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

  // Backup Password security states
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [exportPassword, setExportPassword] = useState<string>('');
  const [confirmExportPassword, setConfirmExportPassword] = useState<string>('');
  const [exportPasswordError, setExportPasswordError] = useState<string>('');
  const [showExportPasswordText, setShowExportPasswordText] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [importPassword, setImportPassword] = useState<string>('');
  const [isDecryptionRequired, setIsDecryptionRequired] = useState<boolean>(false);
  const [pendingEncryptedData, setPendingEncryptedData] = useState<string>('');
  const [isDecrypting, setIsDecrypting] = useState<boolean>(false);
  const [showImportPasswordText, setShowImportPasswordText] = useState<boolean>(false);

  // Auto-clear error & success notices after 4 seconds
  React.useEffect(() => {
    if (pinError) {
      const timer = setTimeout(() => setPinError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [pinError]);

  React.useEffect(() => {
    if (importError) {
      const timer = setTimeout(() => setImportError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [importError]);

  React.useEffect(() => {
    if (deleteError) {
      const timer = setTimeout(() => setDeleteError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [deleteError]);

  React.useEffect(() => {
    if (passwordError) {
      const timer = setTimeout(() => setPasswordError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [passwordError]);

  React.useEffect(() => {
    if (passwordSuccess) {
      const timer = setTimeout(() => setPasswordSuccess(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [passwordSuccess]);

  React.useEffect(() => {
    if (exportPasswordError) {
      const timer = setTimeout(() => setExportPasswordError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [exportPasswordError]);

  // Update simple toggle state
  const handleToggle = (key: keyof AppPreferences) => {
    triggerHaptic('medium');
    onUpdatePreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  // Toggle active weekday for notifications
  const handleToggleDay = (dayNum: number) => {
    triggerHaptic('medium');
    let updatedDays = [...(preferences.activeNotificationDays || [])];
    if (updatedDays.includes(dayNum)) {
      updatedDays = updatedDays.filter(d => d !== dayNum);
    } else {
      updatedDays.push(dayNum);
    }
    updatedDays.sort((a, b) => a - b);
    onUpdatePreferences({
      ...preferences,
      activeNotificationDays: updatedDays,
    });
  };

  // Target Slider submit
  const handleTargetChange = (val: number) => {
    onUpdatePreferences({
      ...preferences,
      globalTarget: val,
    });
  };

  // PIN code setup handler
  const handlePinSubmit = () => {
    if (tempPin.length !== 4 || isNaN(Number(tempPin))) {
      triggerHaptic('error');
      setPinError('PIN must be exactly 4 numeric digits.');
      return;
    }
    triggerHaptic('success');
    onUpdatePreferences({
      ...preferences,
      pinLockEnabled: true,
      pinCode: tempPin,
    });
    setTempPin('');
    setPinError('');
    setShowPinSetupModal(false);
  };

  const handleDisablePin = () => {
    triggerHaptic('heavy');
    onUpdatePreferences({
      ...preferences,
      pinLockEnabled: false,
      pinCode: undefined,
    });
  };

  // Export Backups as JSON file downloads (opens security prompt first)
  const handleExportBackup = () => {
    triggerHaptic('medium');
    setExportPassword('');
    setConfirmExportPassword('');
    setExportPasswordError('');
    setShowExportModal(true);
  };

  const executeExportBackup = async () => {
    if (exportPassword) {
      if (exportPassword !== confirmExportPassword) {
        triggerHaptic('error');
        setExportPasswordError('Passwords do not match.');
        return;
      }
      if (exportPassword.length < 4) {
        triggerHaptic('error');
        setExportPasswordError('Password must be at least 4 characters for security.');
        return;
      }
    }

    try {
      setIsExporting(true);
      const backupData = {
        app: 'BunkMate',
        version: '1.0.0',
        timestamp: Date.now(),
        subjects,
        records,
        preferences,
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      let finalPayload = jsonString;
      let filename = `bunkmate_backup_${new Date().toISOString().split('T')[0]}.json`;

      if (exportPassword) {
        finalPayload = await encryptData(jsonString, exportPassword);
        filename = `bunkmate_encrypted_backup_${new Date().toISOString().split('T')[0]}.json`;
      }

      // Download File trigger
      const blob = new Blob([finalPayload], { type: exportPassword ? 'text/plain' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      triggerHaptic('success');
      db.addNotification(
        exportPassword ? 'Secure Backup Exported! 🔐' : 'Backup Exported! 📥',
        exportPassword
          ? 'Your secure, password-encrypted local backup file has been generated and saved.'
          : 'Your local backup file has been generated and saved successfully.',
        'success'
      );

      setShowExportModal(false);
      setExportPassword('');
      setConfirmExportPassword('');
      setExportPasswordError('');
    } catch (e: any) {
      console.error(e);
      triggerHaptic('error');
      setExportPasswordError('Failed to generate encrypted backup. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Import Backups with optional decryption
  const handleImportBackupText = async () => {
    const textToImport = importJsonText.trim();
    if (!textToImport) {
      triggerHaptic('error');
      setImportError('Please enter, paste, or upload a backup file.');
      return;
    }

    // Detect Encryption
    if (textToImport.startsWith('v1:')) {
      triggerHaptic('medium');
      setPendingEncryptedData(textToImport);
      setIsDecryptionRequired(true);
      setImportPassword('');
      setImportError('');
      return;
    }

    // Standard unencrypted JSON import
    try {
      const parsed = JSON.parse(textToImport);
      if (parsed.app !== 'BunkMate' || !Array.isArray(parsed.subjects) || !Array.isArray(parsed.records)) {
        triggerHaptic('error');
        setImportError('Invalid backup file formatting. Must contain valid subjects and records arrays.');
        return;
      }

      triggerHaptic('success');
      onImportData(parsed.subjects, parsed.records);
      if (parsed.preferences) {
        onUpdatePreferences(parsed.preferences);
      }

      db.addNotification('Backup Restored! 🚀', 'Your database backup has been successfully imported. All subjects and logs are updated.', 'success');
      setShowImportTextModal(false);
      setImportJsonText('');
      setImportError('');
    } catch (e) {
      triggerHaptic('error');
      setImportError('Failed to parse JSON backup. If this backup is encrypted, make sure it starts with the correct cipher tag.');
    }
  };

  const handleDecryptAndImport = async () => {
    if (!importPassword) {
      triggerHaptic('error');
      setImportError('Password is required to decrypt this backup file.');
      return;
    }

    try {
      setIsDecrypting(true);
      triggerHaptic('light');

      const decryptedText = await decryptData(pendingEncryptedData, importPassword);
      const parsed = JSON.parse(decryptedText);

      if (parsed.app !== 'BunkMate' || !Array.isArray(parsed.subjects) || !Array.isArray(parsed.records)) {
        triggerHaptic('error');
        setImportError('Decrypted data format is invalid or corrupted.');
        return;
      }

      triggerHaptic('success');
      onImportData(parsed.subjects, parsed.records);
      if (parsed.preferences) {
        onUpdatePreferences(parsed.preferences);
      }

      db.addNotification('Secure Backup Restored! 🔐✨', 'Decrypted successfully! All subjects, attendance logs, and local preferences have been loaded.', 'success');

      setShowImportTextModal(false);
      setImportJsonText('');
      setImportError('');
      setPendingEncryptedData('');
      setIsDecryptionRequired(false);
      setImportPassword('');
    } catch (e) {
      console.error(e);
      triggerHaptic('error');
      setImportError('Incorrect password or corrupted backup file. Please check and try again.');
    } finally {
      setIsDecrypting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    triggerHaptic('light');
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportJsonText(text);
      setImportError('');

      // Auto-detect encrypted files
      if (text.trim().startsWith('v1:')) {
        setPendingEncryptedData(text.trim());
        setIsDecryptionRequired(true);
        setImportPassword('');
      } else {
        setIsDecryptionRequired(false);
      }
    };
    reader.readAsText(file);
  };

  const handleResetConfirm = async () => {
    triggerHaptic('heavy');
    await db.resetMockData();
    window.location.reload();
  };

  const handlePurgeConfirm = async () => {
    triggerHaptic('error');
    try {
      if (preferences.syncEnabled && preferences.syncToken) {
        await syncService.purgeCloudData();
      }
    } catch (err) {
      console.error('Failed to purge cloud data on server during storage wipe:', err);
    }
    await db.clearAllData();
    window.location.reload();
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

    setIsUpdatingPassword(true);
    setPasswordError('');
    setPasswordSuccess('');
    triggerHaptic('heavy');

    const result = await syncService.changePassword(oldPassword, newPassword);
    setIsUpdatingPassword(false);

    if (result.success) {
      triggerHaptic('success');
      setPasswordSuccess('Password updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setPasswordSuccess('');
      }, 1500);
    } else {
      triggerHaptic('error');
      setPasswordError(result.error || 'Failed to update password.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32 select-none space-y-5" onScroll={onScroll}>
      {/* Page Title */}
      <div>
        <span className="text-xs font-bold text-zinc-500 font-mono uppercase tracking-wider">
          System Panel
        </span>
        <h2 className="text-2xl font-display font-extrabold text-white tracking-tight flex items-center">
          Preferences <Settings className="w-5 h-5 ml-1.5 text-indigo-400" />
        </h2>
      </div>

      {/* Student Profile Card or Login/Register Prompt */}
      {preferences.syncEnabled && preferences.syncToken ? (
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/20 via-zinc-900/50 to-zinc-950 border border-white/5 rounded-3xl p-5 shadow-xl space-y-4 text-left">
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-3.5">
              <div className="relative">
                {renderAvatar(preferences.avatarId, preferences.displayName, 'w-14 h-14 text-xl')}
                {/* Online status indicator */}
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full border border-zinc-950 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                </div>
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="block text-base font-black text-white leading-tight">
                    {preferences.displayName || 'Academic Student'}
                  </span>
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded-full border border-emerald-500/20 flex items-center space-x-1">
                    <span className="w-1 h-1 bg-emerald-450 rounded-full" />
                    <span>Online</span>
                  </span>
                </div>
                <span className="block text-[11px] font-bold text-zinc-500 mt-0.5">
                  @{preferences.syncUsername || 'local_user'}
                </span>
                <span className="text-[10px] text-zinc-400 font-bold block mt-1.5 flex items-center">
                  <span className="mr-1.5">🏫</span> {preferences.collegeName || 'Not Set'}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => { triggerHaptic('medium'); setShowCompleteProfileModal(true); }}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-black text-indigo-400 rounded-xl transition cursor-pointer flex items-center space-x-1"
            >
              <span>Edit Profile</span>
            </button>
          </div>

          {/* Academic Details Sub-grid */}
          <div className="grid grid-cols-2 gap-2.5 pt-3 border-t border-white/5 text-[11px] font-semibold text-zinc-400 text-left">
            <div className="bg-zinc-900/30 p-2 rounded-xl border border-white/5">
              <span className="block text-[9px] uppercase tracking-wider text-zinc-500 font-black">Course</span>
              <span className="text-white font-bold">{preferences.course || 'Not Set'}</span>
            </div>
            <div className="bg-zinc-900/30 p-2 rounded-xl border border-white/5">
              <span className="block text-[9px] uppercase tracking-wider text-zinc-500 font-black">Department</span>
              <span className="text-white font-bold">{preferences.major || 'Not Set'}</span>
            </div>
            <div className="bg-zinc-900/30 p-2 rounded-xl border border-white/5">
              <span className="block text-[9px] uppercase tracking-wider text-zinc-500 font-black">Semester</span>
              <span className="text-white font-bold">{preferences.semester || 'Not Set'}</span>
            </div>
            <div className="bg-zinc-900/30 p-2 rounded-xl border border-white/5">
              <span className="block text-[9px] uppercase tracking-wider text-zinc-500 font-black">Section & Group</span>
              <span className="text-white font-bold text-left">
                {preferences.section || 'N/A'} • {preferences.group || 'N/A'}
              </span>
            </div>
          </div>

          {/* Footer: Last Sync status */}
          <div className="flex justify-between items-center text-[10px] text-zinc-500 font-semibold pt-1">
            <span>Cloud Sync Status</span>
            <span className="flex items-center text-zinc-450 font-mono text-[9px]">
              <Clock className="w-3 h-3 mr-1 text-zinc-650" />
              {syncStatus.lastSynced 
                ? `Synced ${new Date(syncStatus.lastSynced).toLocaleTimeString()}`
                : 'Not Synced'
              }
            </span>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/15 via-zinc-900/40 to-zinc-950 border border-white/5 rounded-3xl p-6 shadow-xl space-y-4 text-center">
          <div className="absolute -top-12 -right-12 w-28 h-28 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full flex items-center justify-center mx-auto">
            <User className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-display font-black text-white">Create a Cloud Profile</h3>
            <p className="text-xs text-zinc-400 max-w-[320px] mx-auto leading-relaxed">
              Login or Register an account to configure your custom student ID card, connect with classmates, and automatically backup your attendance details.
            </p>
          </div>
          <button
            onClick={() => { triggerHaptic('medium'); setShowLoginModal(true); }}
            className="w-full max-w-[240px] mx-auto py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-lg shadow-indigo-650/15 animate-bounce"
          >
            <Sparkles className="w-4 h-4 text-indigo-350" />
            <span>Login or Register</span>
          </button>
        </div>
      )}

      {/* Target Attendance Settings */}
      <div className="glass-card p-5 border border-white/5 space-y-3.5">
        <h3 className="text-sm font-display font-bold text-zinc-150 flex items-center">
          <Sliders className="w-4 h-4 mr-1.5 text-indigo-400" />
          General Attendance Options
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-semibold text-zinc-300">
            <span>Global Target Attendance</span>
            <span className="text-indigo-400 font-bold bg-indigo-950/40 px-2 py-0.5 rounded-md font-mono border border-indigo-900/30">
              {globalTarget}%
            </span>
          </div>
          <input
            type="range"
            min="50"
            max="95"
            step="5"
            value={globalTarget}
            onChange={e => { triggerHaptic('light'); handleTargetChange(Number(e.target.value)); }}
            className="w-full h-1.5 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <p className="text-[10px] text-zinc-500 leading-normal">
            Your minimum required attendance limit (typically 75% or 80%). This changes how we evaluate safe bunks.
          </p>
        </div>
      </div>

      {/* Cloud Account Login & Registration Panel */}
      <div className="glass-card p-5 border border-white/5 space-y-4">
        <h3 className="text-sm font-display font-bold text-zinc-150 flex items-center">
          <Cloud className="w-4 h-4 mr-1.5 text-indigo-400" />
          Cloud Login & Registration
        </h3>

        {!preferences.syncEnabled || !preferences.syncToken ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400 leading-normal">
              Register or log in to sync your attendance data across all devices, find class friends, and configure your student profile card.
            </p>
            <button
              onClick={() => { triggerHaptic('medium'); setShowLoginModal(true); }}
              className="w-full py-2.5 bg-indigo-650/40 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-400 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Key className="w-4 h-4 mr-1.5" />
              <span>Login / Register Account</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cloud Status Info */}
            <div className="flex items-center justify-between bg-zinc-950/40 p-4 rounded-2xl border border-white/5">
              <div>
                <span className="block text-xs font-black text-zinc-350">
                  Connected as <span className="text-indigo-400">@{preferences.syncUsername}</span>
                </span>
                {preferences.syncSessionExpired ? (
                  <span className="text-[9px] text-rose-400 font-bold block mt-1">
                    Session expired. Please sign in again.
                  </span>
                ) : (
                  <span className="text-[9px] text-zinc-550 font-bold block mt-1">
                    Last Synced: {syncStatus.lastSynced ? new Date(syncStatus.lastSynced).toLocaleTimeString() : 'Never'}
                  </span>
                )}
              </div>
              
              {preferences.syncSessionExpired ? (
                <button
                  onClick={() => { triggerHaptic('medium'); setShowLoginModal(true); }}
                  className="text-[8px] font-mono uppercase bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 px-2.5 py-1.5 rounded-full border border-rose-500/20 font-bold transition cursor-pointer"
                >
                  Re-auth
                </button>
              ) : (
                <span className="text-[8px] font-mono uppercase bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full border border-emerald-500/20 font-bold flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                  Active
                </span>
              )}
            </div>

            {/* Status indicators */}
            {syncStatus.error && (
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-400 text-[10px] font-bold">
                Sync error: {syncStatus.error}
              </div>
            )}

            {/* Action grid */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { triggerHaptic('medium'); syncService.performSync(); }}
                disabled={syncStatus.isSyncing}
                className="py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center space-x-1 border border-zinc-800 disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${syncStatus.isSyncing ? 'animate-spin text-indigo-400' : ''}`} />
                <span>{syncStatus.isSyncing ? 'Syncing...' : 'Sync Now'}</span>
              </button>
              <button
                onClick={() => { triggerHaptic('medium'); setShowFriendsModal(true); }}
                className="py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center space-x-1 border border-zinc-800"
              >
                <Users className="w-3 h-3 text-indigo-400" />
                <span>Friends & Social</span>
              </button>
              <button
                onClick={() => { triggerHaptic('medium'); setShowConnectedDevicesModal(true); }}
                className="py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center space-x-1 border border-zinc-800"
              >
                <Smartphone className="w-3 h-3 text-indigo-400" />
                <span>Devices</span>
              </button>
              <button
                onClick={async () => { triggerHaptic('heavy'); await syncService.logout(); }}
                className="py-2 bg-rose-955/15 hover:bg-rose-955/25 text-rose-455 rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center justify-center space-x-1 border border-rose-900/20"
              >
                <LogOut className="w-3 h-3 text-rose-500 mr-1" />
                <span>Logout</span>
              </button>
            </div>

            {/* Change Password & Delete Account Section */}
            <div className="pt-2 border-t border-zinc-900/40 space-y-2">
              <button
                onClick={() => { triggerHaptic('medium'); setShowChangePasswordModal(true); setOldPassword(''); setNewPassword(''); setConfirmNewPassword(''); setPasswordError(''); setPasswordSuccess(''); }}
                className="w-full py-2 bg-zinc-900/40 hover:bg-zinc-800/40 border border-dashed border-zinc-805 text-zinc-300 rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Key className="w-3 h-3 text-indigo-400 mr-1" />
                <span>Change Cloud Password</span>
              </button>

              <button
                onClick={() => { triggerHaptic('heavy'); setShowDeleteConfirm(true); setDeletePassword(''); setDeleteError(''); }}
                className="w-full py-2 bg-rose-955/5 hover:bg-rose-955/10 border border-dashed border-rose-900/30 text-rose-455 rounded-lg text-[10px] font-bold transition flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3 text-rose-500 mr-1" />
                <span>Delete Cloud Account</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Timetable Vault / AI Wizard card */}
      {onOpenWizard && (
        hasVaultImage ? (
          <div className="bg-gradient-to-br from-emerald-950/20 to-emerald-950/40 rounded-3xl p-5 border border-emerald-900/30 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-bold text-white flex items-center">
                <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-400" />
                Timetable Vault
              </h3>
              <span className="text-[9px] font-mono font-black uppercase text-emerald-400 bg-emerald-950/45 px-1.5 py-0.5 rounded-md border border-emerald-900/30">
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-emerald-200/80 leading-relaxed">
              Your original timetable photo is securely saved locally. You can view it anytime or re-run the AI analysis if your classes update.
            </p>
            <div className="flex space-x-2">
              <button
                onClick={() => { triggerHaptic('light'); setShowVaultViewer(true); }}
                className="flex-1 py-3 bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-900/50 text-emerald-300 rounded-2xl text-xs font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <ImageIcon className="w-4 h-4" />
                <span>View Image</span>
              </button>
              <button
                onClick={() => { triggerHaptic('heavy'); onOpenWizard(); }}
                className="flex-[1.5] py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-emerald-100" />
                <span>Reparse With AI</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-indigo-950/20 to-indigo-950/40 rounded-3xl p-5 border border-indigo-900/30 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-bold text-white flex items-center">
                <Sparkles className="w-4 h-4 mr-1.5 text-indigo-400 animate-pulse" />
                AI Timetable Assistant
              </h3>
              <span className="text-[9px] font-mono font-black uppercase text-indigo-400 bg-indigo-950/45 px-1.5 py-0.5 rounded-md border border-indigo-900/30">
                Gemini AI
              </span>
            </div>
            <p className="text-xs text-indigo-200 leading-relaxed">
              Quickly import your entire college syllabus and class timetable! Upload a picture of your timetable or paste the schedule text to let Gemini AI auto-configure your BunkMate curriculum.
            </p>
            <button
              onClick={() => { triggerHaptic('heavy'); onOpenWizard(); }}
              className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black transition flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-indigo-100 animate-bounce" />
              <span>Launch AI Setup Assistant</span>
            </button>
          </div>
        )
      )}

      {/* Smart Notification Scheduler Panel */}
      <div className="glass-card p-5 border border-white/5 space-y-4">
        <h3 className="text-sm font-display font-bold text-zinc-150 flex items-center">
          <Bell className="w-4 h-4 mr-1.5 text-indigo-400" />
          Smart Notification Scheduler
        </h3>

        <p className="text-xs text-zinc-400 leading-normal">
          Customize when you receive attendance warnings, class reminders, study prompts, and custom alerts.
        </p>

        {/* Master Notification Switch */}
        <div className="flex justify-between items-center py-2 border-b border-zinc-900/60">
          <div>
            <span className="block text-xs font-bold text-zinc-200">Receive Push Alerts</span>
            <span className="text-[10px] text-zinc-500">Master switch for all system notifications</span>
          </div>
          <button
            onClick={() => handleToggle('notificationsEnabled')}
            className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ${preferences.notificationsEnabled ? 'bg-indigo-600' : 'bg-zinc-800'
              }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${preferences.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
            />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {preferences.notificationsEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 pt-2 overflow-hidden"
            >
              {/* Weekend Classes Toggle */}
              <div className="flex justify-between items-center py-2 border-b border-zinc-900/60">
                <div>
                  <span className="block text-xs font-bold text-zinc-200">Weekend Classes</span>
                  <span className="text-[10px] text-zinc-500">Allows schedule alerts on Saturday & Sunday</span>
                </div>
                <button
                  onClick={() => handleToggle('weekendClassesEnabled')}
                  className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ${preferences.weekendClassesEnabled ? 'bg-indigo-600' : 'bg-zinc-800'
                    }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${preferences.weekendClassesEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>

              {/* Active Notification Weekdays checkboxes */}
              <div className="space-y-2">
                <span className="block text-xs font-bold text-zinc-200">Select Active Weekdays</span>
                <span className="block text-[10px] text-zinc-500">Choose which days are active for academic reminders</span>

                <div className="flex justify-between pt-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayChar, idx) => {
                    const isActive = (preferences.activeNotificationDays || []).includes(idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => handleToggleDay(idx)}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all border cursor-pointer ${isActive
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                          }`}
                        title={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][idx]}
                      >
                        {dayChar}
                      </button>
                    );
                  })}
                </div>
                <div className="text-[9px] text-zinc-500 mt-1 leading-normal">
                  {!preferences.weekendClassesEnabled ? (
                    <span className="text-amber-400 font-semibold block">⚠️ Weekend Classes = Off. Academic & class reminders are completely suppressed on Saturdays and Sundays.</span>
                  ) : (
                    <span className="text-emerald-400 font-semibold block">✨ Weekend Classes = On. Weekend schedule notifications check customized active days above.</span>
                  )}
                  <span className="text-indigo-400 font-semibold block mt-0.5">ℹ️ The scheduler intelligently resumes normal notifications every Monday.</span>
                </div>
              </div>

              {/* Allowed Non-academic bypasses */}
              <div className="space-y-3 pt-3 border-t border-zinc-900">
                <span className="block text-xs font-bold text-zinc-150">Non-Academic Alerts (Always Bypass Weekend Suppression)</span>

                <div className="space-y-3">
                  {[
                    { key: 'examRemindersEnabled', label: 'Exam Reminders', desc: 'Alerts for upcoming test/quiz dates' },
                    { key: 'assignmentDeadlinesEnabled', label: 'Assignment Deadlines', desc: 'Reminders for homework submissions' },
                    { key: 'appUpdatesEnabled', label: 'App Updates', desc: 'New feature alerts & developer notes' },
                    { key: 'manualRemindersEnabled', label: 'Manual Reminders', desc: 'To-do notes and custom text prompts' },
                  ].map(({ key, label, desc }) => (
                    <div key={key} className="flex justify-between items-center">
                      <div>
                        <span className="block text-[11px] font-bold text-zinc-200">{label}</span>
                        <span className="text-[9px] text-zinc-500">{desc}</span>
                      </div>
                      <button
                        onClick={() => handleToggle(key as keyof AppPreferences)}
                        className={`w-9 h-5 rounded-full p-0.5 cursor-pointer transition-colors duration-200 ${preferences[key as keyof AppPreferences] ? 'bg-indigo-600' : 'bg-zinc-800'
                          }`}
                      >
                        <div
                          className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform duration-200 ${preferences[key as keyof AppPreferences] ? 'translate-x-4' : 'translate-x-0'
                            }`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Daily Scheduled College Reminders */}
              <div className="space-y-3 pt-3 border-t border-zinc-900">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="block text-xs font-bold text-zinc-200">Daily College Reminders</span>
                    <span className="text-[9px] text-zinc-500">Receive 3-4 smart reminders daily during college hours</span>
                  </div>
                  <button
                    onClick={() => handleToggle('dailyClassRemindersEnabled')}
                    className={`w-9 h-5 rounded-full p-0.5 cursor-pointer transition-colors duration-200 ${preferences.dailyClassRemindersEnabled ? 'bg-indigo-600' : 'bg-zinc-800'
                      }`}
                  >
                    <div
                      className={`bg-white w-4 h-4 rounded-full shadow-xs transform transition-transform duration-200 ${preferences.dailyClassRemindersEnabled ? 'translate-x-4' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {preferences.dailyClassRemindersEnabled && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between pt-1.5"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-extrabold text-zinc-550 uppercase tracking-wider">
                          Starts
                        </span>
                        <input
                          type="time"
                          value={preferences.collegeStartTime || '09:00'}
                          onChange={(e) => {
                            triggerHaptic('light');
                            onUpdatePreferences({
                              ...preferences,
                              collegeStartTime: e.target.value
                            });
                          }}
                          className="w-[80px] px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-250 focus:outline-none focus:border-indigo-500 focus:bg-zinc-950 text-center"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-extrabold text-zinc-550 uppercase tracking-wider">
                          Ends
                        </span>
                        <input
                          type="time"
                          value={preferences.collegeEndTime || '17:00'}
                          onChange={(e) => {
                            triggerHaptic('light');
                            onUpdatePreferences({
                              ...preferences,
                              collegeEndTime: e.target.value
                            });
                          }}
                          className="w-[80px] px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-250 focus:outline-none focus:border-indigo-500 focus:bg-zinc-950 text-center"
                        />
                      </div>
                    </div>

                    {onOpenWizard && (
                      <button
                        onClick={() => { triggerHaptic('medium'); onOpenWizard(); }}
                        className="px-2.5 py-1.5 bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-400 rounded-lg flex items-center space-x-1.5 text-[10px] font-bold border border-indigo-900/20 transition cursor-pointer"
                        title="AI Timetable Setup Wizard"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                        <span>AI Setup</span>
                      </button>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Vibration & Sounds Toggles */}
      <div className="glass-card p-5 border border-white/5 space-y-4">
        <h3 className="text-sm font-display font-bold text-zinc-150 flex items-center">
          <Volume2 className="w-4 h-4 mr-1.5 text-indigo-400" />
          App Sounds & Feedback
        </h3>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <span className="block text-xs font-bold text-zinc-200">Haptic Tap Vibrations</span>
              <span className="text-[10px] text-zinc-500">Vibrate smartphone slightly during tapping</span>
            </div>
            <button
              onClick={() => handleToggle('hapticsEnabled')}
              className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ${preferences.hapticsEnabled ? 'bg-indigo-600' : 'bg-zinc-800'
                }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${preferences.hapticsEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>

          <div className="flex justify-between items-center">
            <div>
              <span className="block text-xs font-bold text-zinc-200">Acoustic Audio Ticks</span>
              <span className="text-[10px] text-zinc-500">Play subtle tick sound indicators</span>
            </div>
            <button
              onClick={() => handleToggle('soundEnabled')}
              className={`w-11 h-6 rounded-full p-1 cursor-pointer transition-colors duration-200 ${preferences.soundEnabled ? 'bg-indigo-600' : 'bg-zinc-800'
                }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${preferences.soundEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </div>
      </div>



      {/* Dangerous Administrative Options */}
      <div className="glass-card p-5 border border-rose-950/40 space-y-4">
        <h3 className="text-sm font-display font-bold text-rose-400 flex items-center">
          <Trash2 className="w-4 h-4 mr-1.5" />
          Curriculum Administration
        </h3>

        <div className="space-y-3">
          <button
            onClick={() => { triggerHaptic('heavy'); setShowResetConfirm(true); }}
            className="w-full py-3 bg-amber-955/20 hover:bg-amber-950/45 text-amber-400 border border-amber-900/30 rounded-xl text-xs font-semibold flex items-center justify-center transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Restore Preloaded Sandbox Logs
          </button>

          <button
            onClick={() => { triggerHaptic('error'); setShowPurgeConfirm(true); }}
            className="w-full py-3 bg-rose-955/20 hover:bg-rose-950/45 text-rose-400 border border-rose-900/30 rounded-xl text-xs font-semibold flex items-center justify-center transition cursor-pointer"
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            Completely Purge All Storage
          </button>
        </div>
      </div>

      {/* App version footer */}
      <div className="text-center pt-4">
        <p className="text-xs font-display font-semibold text-zinc-500">BunkMate Handcrafted Mobile App</p>
        <p className="text-[10px] font-mono text-zinc-500 mt-0.5">Version 1.0.0 </p>
        <p className="text-[10px] font-sans font-medium text-zinc-650 mt-2">Developed by <span className="font-semibold text-zinc-450">Arvind Madaan</span></p>
      </div>

      {/* Passcode lock setup modal overlay */}
      <AnimatePresence>
        {showPinSetupModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6 select-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-[320px] shadow-2xl border border-white/5 space-y-4"
            >
              <div className="w-12 h-12 bg-indigo-950/40 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-900/30">
                <Lock className="w-6 h-6 animate-pulse" />
              </div>
              <div className="text-center">
                <h4 className="text-base font-display font-bold text-white">Set 4-Digit Passcode PIN</h4>
                <p className="text-zinc-500 text-xs mt-1">
                  Choose a 4-digit code. Do not forget this PIN, as there is no server retrieval.
                </p>
              </div>

              <div className="space-y-1">
                <input
                  type="password"
                  maxLength={4}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  value={tempPin}
                  onChange={e => setTempPin(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 1234"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-center font-bold tracking-widest text-lg focus:outline-none"
                />
                {pinError && (
                  <p className="text-[10px] text-rose-455 font-semibold text-center mt-1">{pinError}</p>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => { triggerHaptic('light'); setShowPinSetupModal(false); setTempPin(''); setPinError(''); }}
                  className="flex-1 py-2 text-xs font-semibold bg-zinc-900 text-zinc-300 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePinSubmit}
                  className="flex-1 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl shadow-sm transition cursor-pointer"
                >
                  Set Passcode
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* JSON Import backup Modal */}
      <AnimatePresence>
        {showImportTextModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6 select-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-[360px] shadow-2xl border border-white/5 space-y-4"
            >
              {isDecryptionRequired ? (
                <div className="space-y-4">
                  <div className="w-12 h-12 bg-amber-955/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-900/30">
                    <Shield className="w-6 h-6 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-display font-bold text-white">Encrypted Backup Detected</h3>
                    <p className="text-zinc-400 text-xs mt-1">
                      This local backup is protected with password encryption. Enter the correct password to decrypt and restore.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type={showImportPasswordText ? "text" : "password"}
                        value={importPassword}
                        onChange={e => setImportPassword(e.target.value)}
                        placeholder="Backup password"
                        className="w-full pl-3.5 pr-10 py-3 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowImportPasswordText(!showImportPasswordText)}
                        className="absolute right-3 top-3.5 text-zinc-500 hover:text-zinc-350 cursor-pointer"
                      >
                        {showImportPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {importError && (
                      <p className="text-[10px] text-rose-455 font-semibold leading-relaxed text-center">{importError}</p>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-1">
                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setIsDecryptionRequired(false);
                        setPendingEncryptedData('');
                        setImportPassword('');
                        setImportError('');
                      }}
                      className="flex-1 py-2.5 text-xs font-semibold bg-zinc-900 text-zinc-300 rounded-xl transition cursor-pointer"
                      disabled={isDecrypting}
                    >
                      Back
                    </button>
                    <button
                      onClick={handleDecryptAndImport}
                      className="flex-1 py-2.5 text-xs font-bold bg-indigo-600 text-white rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center space-x-1.5"
                      disabled={isDecrypting}
                    >
                      {isDecrypting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Decrypting...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Decrypt & Import</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Upload className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-base font-display font-bold text-white">Restore Local Backup</h3>
                  </div>

                  <p className="text-zinc-400 text-xs">
                    Choose a `.json` backup file from your device, or paste the raw backup contents below.
                  </p>

                  {/* Real file uploader */}
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileChange}
                      className="hidden"
                      id="backup-file-picker"
                    />
                    <label
                      htmlFor="backup-file-picker"
                      className="w-full py-3.5 bg-indigo-950/20 hover:bg-indigo-950/40 border border-dashed border-indigo-900/30 text-indigo-400 rounded-2xl text-xs font-bold transition flex flex-col items-center justify-center space-y-1.5 cursor-pointer shadow-3xs"
                    >
                      <FileText className="w-5 h-5 text-indigo-400" />
                      <span>Select Backup File from Device</span>
                    </label>
                  </div>

                  <div className="relative flex items-center justify-center">
                    <span className="absolute bg-zinc-950 px-2.5 text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">or paste data</span>
                    <hr className="w-full border-zinc-900" />
                  </div>

                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={importJsonText}
                      onChange={e => setImportJsonText(e.target.value)}
                      placeholder='Paste bunkmate_backup data string here...'
                      className="w-full p-3 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-mono focus:outline-none focus:bg-zinc-950 resize-none"
                    />
                    {importError && (
                      <p className="text-[10px] text-rose-455 font-semibold leading-relaxed">{importError}</p>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-1">
                    <button
                      onClick={() => { triggerHaptic('light'); setShowImportTextModal(false); setImportJsonText(''); setImportError(''); }}
                      className="flex-1 py-2.5 text-xs font-semibold bg-zinc-900 text-zinc-300 rounded-xl transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleImportBackupText}
                      className="flex-1 py-2.5 text-xs font-bold bg-indigo-600 text-white rounded-xl shadow-sm transition cursor-pointer"
                    >
                      Restore Data
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password protection export setup modal overlay */}
      <AnimatePresence>
        {showExportModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-6 select-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-[340px] shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6 animate-pulse" />
              </div>
              <div className="text-center">
                <h4 className="text-base font-display font-bold text-slate-900">Secure Your Local Backup</h4>
                <p className="text-slate-400 text-[11px] mt-1.5 leading-normal">
                  (Optional) Enter a password to encrypt your logs and syllabus securely. If left empty, your backup will be exported as standard plain JSON.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="relative">
                  <input
                    type={showExportPasswordText ? "text" : "password"}
                    value={exportPassword}
                    onChange={e => setExportPassword(e.target.value)}
                    placeholder="Create Backup Password (Optional)"
                    className="w-full pl-3.5 pr-10 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowExportPasswordText(!showExportPasswordText)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showExportPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {exportPassword && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="relative"
                  >
                    <input
                      type={showExportPasswordText ? "text" : "password"}
                      value={confirmExportPassword}
                      onChange={e => setConfirmExportPassword(e.target.value)}
                      placeholder="Confirm Backup Password"
                      className="w-full pl-3.5 pr-10 py-3 bg-slate-50 border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                    />
                  </motion.div>
                )}

                {exportPasswordError && (
                  <p className="text-[10px] text-rose-500 font-semibold text-center leading-normal">{exportPasswordError}</p>
                )}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => { triggerHaptic('light'); setShowExportModal(false); setExportPassword(''); setConfirmExportPassword(''); setExportPasswordError(''); }}
                  className="flex-1 py-2.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-xl transition cursor-pointer"
                  disabled={isExporting}
                >
                  Cancel
                </button>
                <button
                  onClick={executeExportBackup}
                  className="flex-1 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center space-x-1"
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Encrypting...</span>
                    </>
                  ) : (
                    <span>{exportPassword ? 'Encrypt & Save' : 'Save Plain JSON'}</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm preloaded mock database restore */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-6 text-center select-none backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-[300px] shadow-2xl border border-white/5 space-y-4"
            >
              <div className="w-12 h-12 bg-amber-955/20 text-amber-400 rounded-full flex items-center justify-center mx-auto border border-amber-900/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-display font-bold text-white">Restore Mock Logs?</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                This will overwrite your current subjects and custom logs with preloaded mock semester data. Ideal for checking out charts!
              </p>
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => { triggerHaptic('light'); setShowResetConfirm(false); }}
                  className="flex-1 py-2 text-xs font-semibold bg-zinc-900 text-zinc-300 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetConfirm}
                  className="flex-1 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition cursor-pointer"
                >
                  Restore Sandbox
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm database purge */}
      <AnimatePresence>
        {showPurgeConfirm && (
          <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-6 text-center select-none backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-[300px] shadow-2xl border border-white/5 space-y-4"
            >
              <div className="w-12 h-12 bg-rose-955/20 text-rose-455 rounded-full flex items-center justify-center mx-auto border border-rose-900/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-display font-bold text-white">Wipe Database?</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Are you absolutely sure? This will wipe your subjects, schedules, preferences, and logged sessions permanently. This cannot be undone.
              </p>
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => { triggerHaptic('light'); setShowPurgeConfirm(false); }}
                  className="flex-1 py-2 text-xs font-semibold bg-zinc-900 text-zinc-300 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurgeConfirm}
                  className="flex-1 py-2 text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white rounded-lg shadow-sm transition cursor-pointer"
                >
                  Purge Storage
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cloud Sign In Drawer Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <LoginModal
            onClose={() => setShowLoginModal(false)}
            onSuccess={(action) => {
              setShowLoginModal(false);
              onUpdatePreferences(db.getPrefs());
              if (onRefreshNotifications) onRefreshNotifications();
              
              // Automatically switch to Settings tab (showing their profile card)
              if (onTabChange) {
                onTabChange('settings');
              }

              // Show the beautiful success dialog popup
              setSuccessPopup({ show: true, type: action });
              
              // Show Complete Profile immediately after account creation/registration
              if (action === 'register') {
                setShowCompleteProfileModal(true);
              } else {
                const currentPrefs = db.getPrefs();
                if (!currentPrefs.profilePrompted && (!currentPrefs.displayName || currentPrefs.displayName === 'Academic Student')) {
                  setShowCompleteProfileModal(true);
                }
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Custom Success Popup */}
      <AnimatePresence>
        {successPopup.show && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-6 select-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-900/50 rounded-3xl p-6 shadow-2xl text-center space-y-4 max-w-[340px] w-full"
            >
              <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-display font-black text-white">
                  {successPopup.type === 'register' ? 'Registration Successful!' : 'Welcome Back!'}
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {successPopup.type === 'register' 
                    ? 'Your BunkMate account has been successfully created. Ready to set up your profile!' 
                    : 'You have successfully signed in. Your attendance and schedules are now in sync.'}
                </p>
              </div>
              <button
                onClick={() => {
                  triggerHaptic('medium');
                  setSuccessPopup({ show: false, type: null });
                }}
                className="w-full py-2.5 bg-emerald-650 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-650/15 cursor-pointer"
              >
                Let's Go!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Complete Profile Modal */}
      <AnimatePresence>
        {showCompleteProfileModal && (
          <CompleteProfileModal
            onClose={() => setShowCompleteProfileModal(false)}
            onSave={() => {
              onUpdatePreferences(db.getPrefs());
            }}
          />
        )}
      </AnimatePresence>

      {/* Friends & Social Dashboard Modal */}
      <AnimatePresence>
        {showFriendsModal && (
          <FriendsModal
            onClose={() => setShowFriendsModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Full-Screen Vault Viewer Overlay */}
      <AnimatePresence>
        {showVaultViewer && savedImageBase64 && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center"
          >
            <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center z-10">
              <div className="flex space-x-2">
                <button onClick={() => setVaultZoom(z => Math.min(z + 0.5, 4))} className="p-2 bg-zinc-800/80 rounded-full text-white cursor-pointer">
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button onClick={() => setVaultZoom(z => Math.max(z - 0.5, 0.5))} className="p-2 bg-zinc-800/80 rounded-full text-white cursor-pointer">
                  <ZoomOut className="w-5 h-5" />
                </button>
              </div>
              <button onClick={() => { setShowVaultViewer(false); setVaultZoom(1); }} className="p-2 bg-zinc-800/80 rounded-full text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="w-full h-full overflow-auto flex items-center justify-center">
              <img 
                src={savedImageBase64} 
                alt="Vault" 
                style={{ transform: `scale(${vaultZoom})`, transition: 'transform 0.2s', transformOrigin: 'center' }}
                className="max-w-none shadow-2xl" 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connected Devices Modal */}
      <AnimatePresence>
        {showConnectedDevicesModal && (
          <ConnectedDevicesModal
            onClose={() => setShowConnectedDevicesModal(false)}
            username={preferences.syncUsername || 'User'}
          />
        )}
      </AnimatePresence>

      {/* Confirm Delete Cloud Account */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-6 text-center select-none backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-[320px] shadow-2xl border border-white/5 space-y-4"
            >
              <div className="w-12 h-12 bg-rose-955/20 text-rose-455 rounded-full flex items-center justify-center mx-auto border border-rose-900/30">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-display font-bold text-white">Delete Cloud Account?</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">
                This will delete your cloud account and all synced data permanently. This cannot be undone. Enter your password to confirm:
              </p>
              
              {deleteError && (
                <div className="text-[10px] text-rose-400 font-bold bg-rose-950/40 p-2 rounded-lg border border-rose-900/20">
                  {deleteError}
                </div>
              )}

              <input
                type="password"
                disabled={isDeleting}
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 text-white rounded-lg focus:outline-none focus:border-indigo-500 text-xs font-bold text-center placeholder:text-zinc-650"
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
                  className="flex-1 py-2 text-xs font-semibold bg-zinc-900 text-zinc-300 rounded-lg transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={isDeleting || !deletePassword}
                  onClick={handleDeleteAccount}
                  className="flex-1 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
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

      {/* Confirm Change Cloud Password */}
      <AnimatePresence>
        {showChangePasswordModal && (
          <div className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-6 text-center select-none backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-[320px] shadow-2xl border border-white/5 space-y-4 text-left"
            >
              <div className="w-12 h-12 bg-indigo-950/40 text-indigo-400 rounded-full flex items-center justify-center mx-auto border border-indigo-900/30">
                <Key className="w-6 h-6 animate-pulse" />
              </div>
              <h4 className="text-base font-display font-bold text-white text-center">Change Cloud Password</h4>
              <p className="text-zinc-400 text-xs leading-relaxed text-center">
                Please enter your current password and your new password below.
              </p>
              
              {passwordError && (
                <div className="text-[10px] text-rose-405 font-bold bg-rose-950/40 p-2.5 rounded-xl border border-rose-900/20 text-center">
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
                  }}
                  className="flex-1 py-2.5 text-xs font-semibold bg-zinc-900 text-zinc-300 rounded-xl transition cursor-pointer disabled:opacity-50 text-center"
                >
                  Cancel
                </button>
                <button
                  disabled={isUpdatingPassword || !oldPassword || !newPassword || !confirmNewPassword}
                  onClick={handleChangePassword}
                  className="flex-1 py-2.5 text-xs font-semibold bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50 text-center"
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
