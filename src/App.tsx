import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home as HomeIcon,
  Calendar as CalendarIcon,
  BookOpen,
  BarChart3,
  Settings as SettingsIcon,
  Wifi,
  Battery,
  Signal,
  Bell,
  Users,
  Bot,
  User,
  Sparkles
} from 'lucide-react';

import { Subject, AttendanceRecord, AppPreferences, NotificationItem } from './types';
import { syncService } from './utils/syncService';
import { db, triggerHaptic, calculateSubjectStats, calculateOverallStats, isNotificationAllowed } from './utils/db';
import { appPreferencesStore } from './utils/preferences';
import { friendsService } from './utils/friendsService';
import { NotificationService } from './utils/notificationService';

// Views
import HomeView from './components/views/HomeView';
import CalendarView from './components/views/CalendarView';
import SubjectsView from './components/views/SubjectsView';
import AnalyticsView from './components/views/AnalyticsView';
import SettingsView from './components/views/SettingsView';
import ProfileView from './components/views/ProfileView';

// Security and overlays
import SecurityPinView from './components/views/SecurityPinView';
import AddSubjectModal from './components/views/AddSubjectModal';
import SubjectDetailModal from './components/views/SubjectDetailModal';
import InAppNotifications from './components/views/InAppNotifications';
import TimetableWizardModal from './components/views/TimetableWizardModal';
import FriendsView from './components/views/FriendsView';
import CompleteProfileModal from './components/views/CompleteProfileModal';
import LoginModal from './components/views/LoginModal';
import UpdateModal from './components/views/UpdateModal';
import { UpdateScreen } from './components/views/UpdateScreen';
import { updateService, VersionInfo } from './utils/updateService';
import { versionService } from './services/VersionService';

type Tab = 'home' | 'subjects' | 'calendar' | 'friends' | 'ai' | 'profile';

export default function App() {
  // Database States
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [preferences, setPreferences] = useState<AppPreferences>({
    globalTarget: 75,
    hapticsEnabled: true,
    notificationsEnabled: true,
    pinLockEnabled: false,
    soundEnabled: true,
    weekendClassesEnabled: true,
    activeNotificationDays: [0, 1, 2, 3, 4, 5, 6],
    examRemindersEnabled: true,
    assignmentDeadlinesEnabled: true,
    appUpdatesEnabled: true,
    manualRemindersEnabled: true,
    collegeStartTime: '09:00',
    collegeEndTime: '17:00',
    dailyClassRemindersEnabled: true,
  });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Navigation states
  const [currentTab, setCurrentTab] = useState<Tab>('home');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [systemTime, setSystemTime] = useState<string>('09:41');
  const [isTabBarVisible, setIsTabBarVisible] = useState<boolean>(true);
  const [lastScrollTop, setLastScrollTop] = useState<number>(0);

  const handleViewScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop < 20) {
      setIsTabBarVisible(true);
      setLastScrollTop(scrollTop);
      return;
    }
    if (scrollTop > lastScrollTop + 10) {
      setIsTabBarVisible(false);
    } else if (scrollTop < lastScrollTop - 10) {
      setIsTabBarVisible(true);
    }
    setLastScrollTop(scrollTop);
  };

  const handleTabChange = (tab: Tab) => {
    triggerHaptic('light');
    setCurrentTab(tab);
    setIsTabBarVisible(true);
  };

  // Overlays / Modal states
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [showAddSubject, setShowAddSubject] = useState<boolean>(false);
  const [subjectToEdit, setSubjectToEdit] = useState<Subject | undefined>(undefined);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showCompleteProfile, setShowCompleteProfile] = useState<boolean>(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [loginSuccessCallback, setLoginSuccessCallback] = useState<((action: 'login' | 'register') => void) | null>(null);
  const [pendingImportSubjects, setPendingImportSubjects] = useState<Subject[] | null>(null);

  // App updates state
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);
  const [updateInfo, setUpdateInfo] = useState<VersionInfo | null>(null);
  const [currentAppVersion, setCurrentAppVersion] = useState<string>('1.0.6');
  const [showUpdateScreen, setShowUpdateScreen] = useState<boolean>(false);

  const handleOpenWizard = () => {
    triggerHaptic('medium');
    if (!db.getPrefs().syncEnabled || !db.getPrefs().syncToken) {
      setLoginSuccessCallback(() => (action: 'login' | 'register') => {
        const updatedPrefs = db.getPrefs();
        if (action === 'register') {
          setShowCompleteProfile(true);
        } else if (updatedPrefs.displayName && updatedPrefs.avatarId && updatedPrefs.displayName !== 'Academic Student') {
          setShowWizard(true);
        } else {
          setShowCompleteProfile(true);
        }
      });
      setShowLoginModal(true);
    } else {
      setShowWizard(true);
    }
  };

  const updatePendingFriendsCount = async () => {
    if (!db.getPrefs().syncEnabled || !db.getPrefs().syncToken) {
      setPendingRequestsCount(0);
      return;
    }
    try {
      const data = await friendsService.list();
      if (data.success) {
        const receivedCount = data.friends.filter(f => f.status === 'pending_received').length;
        setPendingRequestsCount(receivedCount);
      }
    } catch (err) {
      console.error('Failed to update pending friends count:', err);
    }
  };

  useEffect(() => {
    updatePendingFriendsCount();
    const interval = setInterval(updatePendingFriendsCount, 15000);
    return () => clearInterval(interval);
  }, [preferences.syncEnabled, preferences.syncToken]);

  // Load database on initialization and subscribe to background synchronization updates
  useEffect(() => {
    const loadFromDb = () => {
      const loadedPrefs = db.getPrefs();
      setPreferences(loadedPrefs);
      const loadedSubjects = db.getSubjects();
      setSubjects(loadedSubjects);
      setRecords(db.getRecords());
      setNotifications(db.getNotifications());

      // If secure PIN lock is enabled, lock the app immediately
      if (loadedPrefs.pinLockEnabled && loadedPrefs.pinCode) {
        setIsLocked(true);
      }

    };

    // Load initial data (from cache/defaults immediately)
    loadFromDb();

    // Setup notification channels and request permissions for native platforms on mount
    NotificationService.setupChannels().then(() => {
      NotificationService.requestPermission().then((granted) => {
        if (granted) {
          // Immediately queue up the 1-minute welcome alert and daily schedule reminders
          const loadedPrefs = db.getPrefs();
          const loadedSubjects = db.getSubjects();
          NotificationService.rescheduleAll(
            loadedPrefs,
            loadedSubjects,
            db.getRecords(),
            db.getExams(),
            db.getAssignments()
          );
        }
      });
    }).catch(err => {
      console.error('Failed to setup notifications on mount:', err);
    });

    // Subscribe to updates when SQLite background load finishes
    const unsubscribe = db.subscribe(() => {
      loadFromDb();
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Check for app updates on launch and set a background interval
  useEffect(() => {
    const runUpdateCheck = async () => {
      try {
        const res = await updateService.checkForUpdates();
        setCurrentAppVersion(res.installedVersion);
        
        if ((res.status === 'update_available' || res.status === 'update_required') && res.info?.latestVersion) {
          const cleanLatest = VersionChecker.clean(res.info.latestVersion);
          const rawDismissed = localStorage.getItem('bunkmate_dismissed_update_version');
          const cleanDismissed = VersionChecker.clean(rawDismissed);

          // Only auto-show popup if user has NOT already acknowledged/dismissed this specific version
          // (Unless forceUpdate is strictly set to true on server)
          const isStrictForce = !!res.info.forceUpdate;
          if (isStrictForce || (cleanLatest && cleanDismissed !== cleanLatest)) {
            setUpdateInfo(res.info);
            setShowUpdateModal(true);
          }
        }
      } catch (err) {
        console.error('[App] Startup update check error:', err);
      }
    };

    // Check immediately on app launch
    runUpdateCheck();

    // Schedule subsequent check every 6 hours while app is active
    const updateTimer = setInterval(() => {
      runUpdateCheck();
    }, 6 * 60 * 60 * 1000);

    return () => clearInterval(updateTimer);
  }, []);

  // Update dynamic clock for the smartphone status bar
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // hour 0 should be 12
      setSystemTime(`${hours}:${minutes} ${ampm}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Helper to calculate 4 notification triggers during college hours
  const getScheduledSlots = () => {
    const start = preferences.collegeStartTime || '09:00';
    const end = preferences.collegeEndTime || '17:00';

    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;

    let midMins = Math.floor(startMins + (endMins - startMins) * 0.44);
    let aftMins = Math.floor(startMins + (endMins - startMins) * 0.75);

    if (endMins <= startMins) {
      midMins = startMins + 180;
      aftMins = startMins + 360;
    }

    const formatMins = (totalMins: number) => {
      const hrs = Math.floor(totalMins / 60) % 24;
      const mins = totalMins % 60;
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    return {
      start: start,
      midday: formatMins(midMins),
      afternoon: formatMins(aftMins),
      end: end
    };
  };

  // Daily scheduled college notifications simulator engine
  useEffect(() => {
    if (!preferences.notificationsEnabled || !preferences.dailyClassRemindersEnabled) return;

    const checkAndTriggerNotification = () => {
      const today = new Date();
      const dayOfWeek = today.getDay();

      // Check if notifications are allowed today based on active weekdays
      const activeDays = Array.isArray(preferences.activeNotificationDays)
        ? preferences.activeNotificationDays
        : typeof preferences.activeNotificationDays === 'string'
          ? (preferences.activeNotificationDays as string).split(',').map(Number)
          : [1, 2, 3, 4, 5];

      if (!activeDays.includes(dayOfWeek)) return;
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        if (!preferences.weekendClassesEnabled) return;
      }

      const dateStr = today.toISOString().split('T')[0];
      const nowH = String(today.getHours()).padStart(2, '0');
      const nowM = String(today.getMinutes()).padStart(2, '0');
      const timeStr = `${nowH}:${nowM}`; // "HH:MM" 24h format

      // Get calculated slots
      const slots = getScheduledSlots();

      // Load current day's logged slots from appPreferencesStore
      const storageKey = `bunkmate-triggered-notifs-${dateStr}`;
      const triggeredRaw = appPreferencesStore.getItem(storageKey);
      const triggeredSlots: string[] = triggeredRaw ? JSON.parse(triggeredRaw) : [];

      let matchedSlot: 'start' | 'midday' | 'afternoon' | 'end' | null = null;
      let title = '';
      let message = '';
      let type: 'info' | 'success' | 'warning' | 'danger' = 'info';

      // Total safe bunks remaining across all subjects
      const totalSafeBunks = subjects.reduce((acc, sub) => acc + calculateSubjectStats(sub, records).bunksAvailable, 0);

      let overallPercentage = 100;
      let bunkabilityIndex = 100;
      if (subjects.length > 0) {
        const stats = calculateOverallStats(subjects, records, preferences.globalTarget);
        overallPercentage = stats.overallPercentage;
        bunkabilityIndex = stats.bunkabilityIndex;
      }

      if (timeStr === slots.start && !triggeredSlots.includes('start')) {
        matchedSlot = 'start';
        title = 'College Commencing! 🎒⏰';
        message = `Your college day has officially started at ${slots.start}. You have ${totalSafeBunks} safe bunks available today! Let's conquer the curriculum!`;
        type = 'info';
      } else if (timeStr === slots.midday && !triggeredSlots.includes('midday')) {
        matchedSlot = 'midday';
        title = 'Mid-Day Bunkie Check! 🥪😎';
        message = `Halfway through! Your Bunkability Index is currently ${bunkabilityIndex}%. Check your lecture schedule before making canteen decisions!`;
        type = 'success';
      } else if (timeStr === slots.afternoon && !triggeredSlots.includes('afternoon')) {
        matchedSlot = 'afternoon';
        title = 'Survival Check: Keep Logging! ☕💪';
        message = `Almost done! Keep your attendance logs updated to ensure BunkMate math remains perfectly precise! Overall percentage: ${overallPercentage}%.`;
        type = 'warning';
      } else if (timeStr === slots.end && !triggeredSlots.includes('end')) {
        matchedSlot = 'end';
        title = 'College Hours Over! 🚀🎉';
        message = `College is done for today! Take 2 seconds to check your dashboard and review tomorrow's classes. Time to relax!`;
        type = 'info';
      }

      if (matchedSlot) {
        db.addNotification(title, message, type);
        setNotifications(db.getNotifications());

        // Log triggered slot
        triggeredSlots.push(matchedSlot);
        appPreferencesStore.setItem(storageKey, JSON.stringify(triggeredSlots));

        // Push notification simulation haptics
        triggerHaptic('heavy');
      }
    };

    // Run check immediately and then every 30 seconds
    checkAndTriggerNotification();
    const interval = setInterval(checkAndTriggerNotification, 30000);
    return () => clearInterval(interval);
  }, [preferences, subjects, records]);

  // Dynamic status check: If attendance drops below target or goes high enough to bunk, log an alert notification!
  const checkAttendanceDropAlerts = (subjId: string, updatedRecords: AttendanceRecord[]) => {
    const subj = subjects.find(s => s.id === subjId);
    if (!subj) return;

    // Check if the scheduler allows academic/class notifications today
    const currentDayOfWeek = new Date().getDay();
    const checkAllowed = isNotificationAllowed('academic', currentDayOfWeek, preferences);
    if (!checkAllowed.allowed) {
      console.log(`Notification suppressed: ${checkAllowed.reason}`);
      return;
    }

    const stats = calculateSubjectStats(subj, updatedRecords);
    if (stats.totalLogged > 0) {
      const currentNotifications = db.getNotifications();

      if (stats.percentage < stats.target) {
        // Check if we already have a recent warning notification for this subject
        const hasWarning = currentNotifications.some(
          n => n.title.includes(`Code Red: ${subj.name}`) && n.timestamp > Date.now() - 86400000
        );

        if (!hasWarning) {
          db.addNotification(
            `Code Red: ${subj.name}! 🚨💀`,
            `Bro... you are at ${stats.percentage}%! The dean is looking for you. You need to attend the next ${stats.classesToAttend} consecutive classes unless you want to get detained. Wake up! 😴`,
            'danger'
          );
          // Refresh notifications
          setNotifications(db.getNotifications());
        }
      } else if (stats.bunksAvailable > 0) {
        // Check if we already have a recent bunk availability notification for this subject
        const hasBunkAlert = currentNotifications.some(
          n => n.title.includes(`Mass Bunk Mode: ${subj.name}`) && n.timestamp > Date.now() - 86400000
        );

        if (!hasBunkAlert) {
          db.addNotification(
            `Mass Bunk Mode: ${subj.name}! 🥳🎉`,
            `Oh damn, you're at a sweet ${stats.percentage}%! You've got ${stats.bunksAvailable} safe bunk(s) in the bank. Go touch some grass, grab a chai, or sleep in. You earned this! ☕️🛌`,
            'success'
          );
          // Refresh notifications
          setNotifications(db.getNotifications());
        }
      }
    }
  };

  // LOG / RECORD ATTENDANCE Action
  const handleLogAttendance = (
    subjectId: string,
    dateStr: string,
    status: 'attended' | 'bunked' | 'cancelled',
    scheduleId?: string
  ) => {
    // If scheduleId is provided, ONLY match a record that has that scheduleId in its ID
    const existingIdx = records.findIndex(r => 
      r.subjectId === subjectId && 
      r.date === dateStr && 
      (scheduleId ? r.id.includes(scheduleId) : true)
    );
    let updatedRecords = [...records];

    if (existingIdx !== -1) {
      // Update record
      updatedRecords[existingIdx] = {
        ...updatedRecords[existingIdx],
        status,
        timestamp: Date.now(),
      };
    } else {
      // Add record
      const newRecord: AttendanceRecord = {
        id: `rec-${subjectId}-${dateStr}-${scheduleId || Date.now()}`,
        subjectId,
        date: dateStr,
        status,
        timestamp: Date.now(),
      };
      updatedRecords.push(newRecord);
    }

    setRecords(updatedRecords);
    db.saveRecords(updatedRecords);

    // Run alerts scanner
    checkAttendanceDropAlerts(subjectId, updatedRecords);
  };

  // DELETE SINGLE LOG RECORD
  const handleDeleteRecord = (recordId: string) => {
    const updated = records.filter(r => r.id !== recordId);
    setRecords(updated);
    db.saveRecords(updated);
  };

  // UNDO RECENT ACTION
  const handleUndoRecent = () => {
    if (records.length === 0) return;
    // Find newest record by timestamp
    const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp);
    const newest = sorted[0];
    const updated = records.filter(r => r.id !== newest.id);
    setRecords(updated);
    db.saveRecords(updated);

    db.addNotification(
      'Time Machine Activated! 🔄✨',
      'We erased that last attendance log. Shhh, it never happened! 😉',
      'info'
    );
    setNotifications(db.getNotifications());
    triggerHaptic('success');
  };

  // TOGGLE STATUS OF EXISTING RECORD
  const handleToggleRecordStatus = (recordId: string, newStatus: 'attended' | 'bunked' | 'cancelled') => {
    const existingIdx = records.findIndex(r => r.id === recordId);
    if (existingIdx !== -1) {
      const updatedRecords = [...records];
      updatedRecords[existingIdx] = {
        ...updatedRecords[existingIdx],
        status: newStatus,
        timestamp: Date.now()
      };
      setRecords(updatedRecords);
      db.saveRecords(updatedRecords);
      checkAttendanceDropAlerts(updatedRecords[existingIdx].subjectId, updatedRecords);
    }
  };

  // FINALIZE AI TIMETABLE IMPORT
  const handleFinalizeImport = (importedSubjects: Subject[], mode: 'append' | 'merge' | 'overwrite') => {
    let finalSubjects: Subject[] = [];
    
    if (mode === 'overwrite') {
      finalSubjects = importedSubjects;
    } else if (mode === 'append') {
      finalSubjects = [...subjects, ...importedSubjects];
    } else if (mode === 'merge') {
      finalSubjects = [...subjects];
      importedSubjects.forEach(newSub => {
        const existingIdx = finalSubjects.findIndex(
          s => s.name.toLowerCase().trim() === newSub.name.toLowerCase().trim() ||
               (s.code && newSub.code && s.code.toLowerCase().trim() === newSub.code.toLowerCase().trim())
        );
        
        if (existingIdx !== -1) {
          // Replace schedule, keep existing attendance data
          finalSubjects[existingIdx] = {
            ...finalSubjects[existingIdx],
            schedule: newSub.schedule,
            room: newSub.room || finalSubjects[existingIdx].room,
            teacher: newSub.teacher || finalSubjects[existingIdx].teacher,
          };
        } else {
          finalSubjects.push(newSub);
        }
      });
    }

    setSubjects(finalSubjects);
    db.saveSubjects(finalSubjects);

    db.addNotification(
      'Timetable Auto-Configured! 🤖✨',
      `Successfully loaded ${importedSubjects.length} courses into your curriculum. Ready to secure that 75% attendance line!`,
      'success'
    );
    setNotifications(db.getNotifications());
    setPendingImportSubjects(null);
  };

  // SAVE NEW OR EDITED SUBJECT
  const handleSaveSubject = (subjectData: Subject) => {
    let updatedSubjects = [...subjects];
    const existingIdx = subjects.findIndex(s => s.id === subjectData.id);

    if (existingIdx !== -1) {
      updatedSubjects[existingIdx] = subjectData;
      db.addNotification(
        'Curriculum Calibrated! ⚙️📚',
        `Successfully updated the parameters for ${subjectData.name}. Let's secure that degree! 🎓`,
        'success'
      );
    } else {
      updatedSubjects.push(subjectData);
      db.addNotification(
        'New Target Locked! 🎯',
        `Successfully added "${subjectData.name}" into your target list. Prepare for action! 🚀`,
        'success'
      );
    }

    setSubjects(updatedSubjects);
    db.saveSubjects(updatedSubjects);

    // Close modals
    setShowAddSubject(false);
    setSubjectToEdit(undefined);
    setNotifications(db.getNotifications());
  };

  // DELETE SUBJECT
  const handleDeleteSubject = (subjectId: string) => {
    const updatedSubjects = subjects.filter(s => s.id !== subjectId);
    const updatedRecords = records.filter(r => r.subjectId !== subjectId);

    setSubjects(updatedSubjects);
    setRecords(updatedRecords);

    db.saveSubjects(updatedSubjects);
    db.saveRecords(updatedRecords);

    const subToDelete = subjects.find(s => s.id === subjectId);
    // Clear detail overlay
    setSelectedSubject(null);
    db.addNotification(
      'Target Vaporized! 💣',
      `"${subToDelete?.name || 'Course'}" and all of its attendance logs have been completely wiped. Out of sight, out of mind! 💨`,
      'info'
    );
    setNotifications(db.getNotifications());
  };

  // PIN SUBJECT
  const handlePinSubject = (subjectId: string) => {
    const updated = subjects.map(s => s.id === subjectId ? { ...s, isPinned: !s.isPinned } : s);
    setSubjects(updated);
    db.saveSubjects(updated);

    const sub = updated.find(s => s.id === subjectId);
    if (sub) {
      setSelectedSubject(sub);
    }
    triggerHaptic('success');
  };

  // ARCHIVE SUBJECT
  const handleArchiveSubject = (subjectId: string) => {
    const updated = subjects.map(s => s.id === subjectId ? { ...s, isArchived: !s.isArchived } : s);
    setSubjects(updated);
    db.saveSubjects(updated);

    const sub = updated.find(s => s.id === subjectId);
    if (sub) {
      setSelectedSubject(sub);
    }

    db.addNotification(
      sub?.isArchived ? 'Subject Shelved! 📦' : 'Subject Revived! ⚡️',
      sub?.isArchived 
        ? `"${sub?.name || 'Course'}" is now successfully archived. Resting in peace! 🪦`
        : `"${sub?.name || 'Course'}" has been brought back from the dead! 🧟‍♂️`,
      'info'
    );
    setNotifications(db.getNotifications());
    triggerHaptic('success');
  };

  // DUPLICATE SUBJECT
  const handleDuplicateSubject = (subjectId: string) => {
    const original = subjects.find(s => s.id === subjectId);
    if (!original) return;
    const duplicated: Subject = {
      ...original,
      id: `subj-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: `${original.name} (Copy)`,
      isPinned: false,
      isArchived: false,
      schedule: original.schedule.map(sch => ({
        ...sch,
        id: `sch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      }))
    };
    const updated = [...subjects, duplicated];
    setSubjects(updated);
    db.saveSubjects(updated);
    db.addNotification(
      'Subject Duplicated! 📋',
      `Created a duplicate copy of ${original.name}.`,
      'success'
    );
    setNotifications(db.getNotifications());
    triggerHaptic('success');
  };

  // UPDATE PREFERENCES
  const handleUpdatePreferences = (newPrefs: AppPreferences) => {
    setPreferences(newPrefs);
    db.savePrefs(newPrefs);
    if (newPrefs.syncEnabled && newPrefs.syncToken) {
      syncService.performSync().catch(console.error);
    }
  };

  // RESTORE SYSTEM BACKUP
  const handleImportBackup = (importedSubjects: Subject[], importedRecords: AttendanceRecord[]) => {
    setSubjects(importedSubjects);
    setRecords(importedRecords);
    db.saveSubjects(importedSubjects);
    db.saveRecords(importedRecords);
  };

  // NOTIFICATION STATUS UTILITIES
  const handleMarkNotifRead = (notifId: string) => {
    const updated = notifications.map(n => n.id === notifId ? { ...n, read: true } : n);
    setNotifications(updated);
    db.saveNotifications(updated);
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
    db.saveNotifications([]);
  };

  const unreadNotifsCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center font-sans antialiased overflow-hidden select-none">
      {/* Main viewport-constrained container */}
      <div className="w-full max-w-[430px] h-screen bg-black relative flex flex-col overflow-hidden shadow-2xl border-x border-zinc-900/50">

        {/* Central Router Container for dynamic tab panels */}
        <div className="flex-1 relative overflow-hidden flex flex-col bg-black pt-[calc(env(safe-area-inset-top,24px)+8px)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              {currentTab === 'home' && (
                <HomeView
                  subjects={subjects}
                  records={records}
                  preferences={preferences}
                  onLogAttendance={handleLogAttendance}
                  onDeleteRecord={handleDeleteRecord}
                  onOpenNotifications={() => setShowNotifications(true)}
                  notificationCount={unreadNotifsCount}
                  onUndoRecent={handleUndoRecent}
                  onSelectSubject={(subj) => setSelectedSubject(subj)}
                  onOpenWizard={handleOpenWizard}
                  onScroll={handleViewScroll}
                  onOpenFriends={() => handleTabChange('friends')}
                  pendingFriendsCount={pendingRequestsCount}
                  onOpenLoginModal={() => {
                    triggerHaptic('medium');
                    setLoginSuccessCallback(null);
                    setShowLoginModal(true);
                  }}
                />
              )}
              {currentTab === 'subjects' && (
                <SubjectsView
                  subjects={subjects}
                  records={records}
                  onSelectSubject={(subj) => setSelectedSubject(subj)}
                  onOpenAddSubject={() => { setSubjectToEdit(undefined); setShowAddSubject(true); }}
                  onScroll={handleViewScroll}
                />
              )}
              {currentTab === 'calendar' && (
                <CalendarView
                  subjects={subjects}
                  records={records}
                  onLogAttendance={handleLogAttendance}
                  onDeleteRecord={handleDeleteRecord}
                  onScroll={handleViewScroll}
                />
              )}
              {currentTab === 'friends' && (
                <FriendsView
                  onOpenLogin={() => {
                    triggerHaptic('medium');
                    setLoginSuccessCallback(null);
                    setShowLoginModal(true);
                  }}
                  onScroll={handleViewScroll}
                />
              )}
              {currentTab === 'ai' && (
                <AnalyticsView
                  subjects={subjects}
                  records={records}
                  onAddSubject={handleSaveSubject}
                  onScroll={handleViewScroll}
                  onOpenWizard={handleOpenWizard}
                />
              )}
              {currentTab === 'profile' && (
                <ProfileView
                  preferences={preferences}
                  onEditProfile={() => setShowCompleteProfile(true)}
                  onOpenLogin={() => {
                    triggerHaptic('medium');
                    setLoginSuccessCallback(null);
                    setShowLoginModal(true);
                  }}
                  onOpenSettings={() => setShowSettingsModal(true)}
                  onOpenUpdates={() => setShowUpdateScreen(true)}
                  onUpdatePreferences={handleUpdatePreferences}
                  onViewScroll={handleViewScroll}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Floating Glass Bottom Tab Navigation Bar */}
        <div className={`absolute bottom-[calc(1.25rem+env(safe-area-inset-bottom,16px))] left-4 right-4 bg-zinc-950/60 backdrop-blur-xl border border-white/10 rounded-full flex justify-around items-center z-40 py-2 px-1 shadow-2xl transition-all duration-300 ${
          isTabBarVisible ? 'translate-y-0 opacity-100' : 'translate-y-28 opacity-0 pointer-events-none'
        }`}>
          {(['home', 'subjects', 'calendar', 'friends', 'ai', 'profile'] as const).map((tab) => {
            const isActive = currentTab === tab;
            return (
              <button
                key={tab}
                onClick={() => handleTabChange(tab)}
                className="flex flex-col items-center justify-center py-2 relative cursor-pointer group select-none flex-1 min-h-[48px] touch-target"
              >
                {/* Micro Animated active backplate */}
                {isActive && (
                  <motion.div
                    layoutId="activeTabGlow"
                    className="absolute inset-0 bg-indigo-500/15 border border-indigo-500/30 rounded-full -z-10"
                    transition={{ type: 'spring', damping: 20, stiffness: 220 }}
                  />
                )}

                {/* Tab Icon Selection */}
                <div className={`transition-all duration-200 transform relative ${isActive ? 'text-indigo-400 scale-110' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                  {tab === 'home' && <HomeIcon className="w-5.5 h-5.5" />}
                  {tab === 'subjects' && <BookOpen className="w-5.5 h-5.5" />}
                  {tab === 'calendar' && <CalendarIcon className="w-5.5 h-5.5" />}
                  {tab === 'friends' && (
                    <>
                      <Users className="w-5.5 h-5.5" />
                      {pendingRequestsCount > 0 && (
                        <span className="absolute -top-1 -right-1.5 w-4 h-4 bg-indigo-500 text-white font-extrabold text-[9px] rounded-full flex items-center justify-center border-2 border-zinc-950">
                          {pendingRequestsCount}
                        </span>
                      )}
                    </>
                  )}
                  {tab === 'ai' && <Sparkles className="w-5.5 h-5.5" />}
                  {tab === 'profile' && <User className="w-5.5 h-5.5" />}
                </div>

                {/* Tab textual label */}
                <span className={`text-[8px] font-sans font-bold uppercase mt-1 tracking-wider transition-colors ${isActive ? 'text-indigo-400 font-extrabold' : 'text-zinc-500'}`}>
                  {tab === 'ai' ? 'AI Assistant' : tab}
                </span>
              </button>
            );
          })}
        </div>

        {/* App Lock Screen PIN keypad overlay block */}
        <AnimatePresence>
          {isLocked && preferences.pinLockEnabled && preferences.pinCode && (
            <SecurityPinView
              correctPin={preferences.pinCode}
              onSuccess={() => setIsLocked(false)}
            />
          )}
        </AnimatePresence>

        {/* Add/Edit Subject slide drawer overlay */}
        <AnimatePresence>
          {showAddSubject && (
            <AddSubjectModal
              onClose={() => setShowAddSubject(false)}
              onSave={handleSaveSubject}
              subjectToEdit={subjectToEdit}
            />
          )}
        </AnimatePresence>

        {/* AI Timetable Setup Wizard overlay drawer */}
        <AnimatePresence>
          {showWizard && (
            <TimetableWizardModal
              onClose={() => setShowWizard(false)}
              onImport={(importedSubjects) => {
                if (subjects.length > 0) {
                  setPendingImportSubjects(importedSubjects);
                  setShowWizard(false);
                } else {
                  handleFinalizeImport(importedSubjects, 'overwrite');
                  setShowWizard(false);
                }
              }}
              collegeStartTime={preferences.collegeStartTime || '09:00'}
              collegeEndTime={preferences.collegeEndTime || '17:00'}
              onSaveTimings={(start, end) => {
                const updatedPrefs = {
                  ...preferences,
                  collegeStartTime: start,
                  collegeEndTime: end
                };
                setPreferences(updatedPrefs);
                db.savePrefs(updatedPrefs);
              }}
              userSection={preferences.section}
              userGroup={preferences.group}
            />
          )}
        </AnimatePresence>

        {/* Subject Detailed analytics overlay */}
        <AnimatePresence>
          {selectedSubject && (
            <SubjectDetailModal
              subject={selectedSubject}
              records={records}
              onClose={() => setSelectedSubject(null)}
              onEdit={() => {
                setSubjectToEdit(selectedSubject);
                setSelectedSubject(null);
                setShowAddSubject(true);
              }}
              onDelete={() => handleDeleteSubject(selectedSubject.id)}
              onToggleRecordStatus={handleToggleRecordStatus}
              onDeleteRecord={handleDeleteRecord}
              onPin={handlePinSubject}
            />
          )}
        </AnimatePresence>

        {/* Notifications Slide drawer overlay */}
        <AnimatePresence>
          {showNotifications && (
            <InAppNotifications
              notifications={notifications}
              onClose={() => setShowNotifications(false)}
              onMarkAsRead={handleMarkNotifRead}
              onClearAll={handleClearAllNotifications}
            />
          )}
        </AnimatePresence>

        {/* Complete Profile Modal */}
        <AnimatePresence>
          {showCompleteProfile && (
            <CompleteProfileModal
              onClose={() => setShowCompleteProfile(false)}
              onSave={() => {
                const updatedPrefs = db.getPrefs();
                setPreferences(updatedPrefs);
                setShowCompleteProfile(false);
                
              }}
            />
          )}
        </AnimatePresence>

        {/* Login Modal */}
        <AnimatePresence>
          {showLoginModal && (
            <LoginModal
              onClose={() => setShowLoginModal(false)}
              onSuccess={(action) => {
                setShowLoginModal(false);
                const updatedPrefs = db.getPrefs();
                setPreferences(updatedPrefs);
                
                if (loginSuccessCallback) {
                  loginSuccessCallback(action);
                }
              }}
            />
          )}
        </AnimatePresence>

        {/* Settings Modal Overlay */}
        <AnimatePresence>
          {showSettingsModal && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl z-50 overflow-y-auto">
              <div className="p-4 flex justify-between items-center border-b border-zinc-800 bg-zinc-950">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5 text-indigo-400" /> App Settings
                </h2>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl"
                >
                  Close
                </button>
              </div>
              <SettingsView
                preferences={preferences}
                onUpdatePreferences={handleUpdatePreferences}
                onImportData={handleImportBackup}
                subjects={subjects}
                records={records}
                onRefreshNotifications={() => setNotifications(db.getNotifications())}
                onScroll={handleViewScroll}
                onOpenUpdates={() => setShowUpdateScreen(true)}
              />
            </div>
          )}
        </AnimatePresence>

        {/* Custom Append/Replace Timetable Modal */}
        <AnimatePresence>
          {pendingImportSubjects && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6 select-none">
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl w-full max-w-[340px]"
              >
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-2">
                    <BookOpen className="w-8 h-8 text-blue-500" />
                  </div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Active Schedule Detected</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    You already have subjects in your profile. How would you like to handle the new AI timetable?
                  </p>
                  
                  <div className="flex flex-col space-y-3 w-full mt-6">
                    <button
                      onClick={() => {
                        triggerHaptic('medium');
                        handleFinalizeImport(pendingImportSubjects, 'merge');
                      }}
                      className="w-full py-3.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-semibold rounded-xl border border-blue-500/20 transition-colors"
                    >
                      Update Matching Subjects
                    </button>

                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        handleFinalizeImport(pendingImportSubjects, 'append');
                      }}
                      className="w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-semibold rounded-xl border border-emerald-500/20 transition-colors text-sm"
                    >
                      Append (Allow Duplicates)
                    </button>
                    
                    <button
                      onClick={() => {
                        triggerHaptic('heavy');
                        handleFinalizeImport(pendingImportSubjects, 'overwrite');
                      }}
                      className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-xl border border-red-500/20 transition-colors text-sm"
                    >
                      Overwrite Everything
                    </button>

                    <button
                      onClick={() => {
                        triggerHaptic('light');
                        setPendingImportSubjects(null);
                      }}
                      className="w-full py-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 font-medium rounded-xl transition-colors mt-2 text-sm"
                    >
                      Cancel Import
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* App Update Notification Modal */}
        <AnimatePresence>
          {showUpdateModal && updateInfo && (
            <UpdateModal
              currentVersion={currentAppVersion}
              info={updateInfo}
              onClose={() => setShowUpdateModal(false)}
            />
          )}
        </AnimatePresence>

        {/* App Updates Screen Overlay */}
        <AnimatePresence>
          {showUpdateScreen && (
            <UpdateScreen
              currentVersion={currentAppVersion}
              onClose={() => setShowUpdateScreen(false)}
            />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
