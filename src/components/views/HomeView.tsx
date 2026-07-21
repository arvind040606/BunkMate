import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Calendar, GraduationCap, Clock, Sparkles, Bell, Zap, Flame, AlertTriangle, ShieldCheck, Skull, Smile, AlertCircle, ArrowUp, Edit3, Cloud, CloudOff, RefreshCw, Users } from 'lucide-react';
import { Subject, AttendanceRecord, AppPreferences, ScheduleEntry } from '../../types';
import { calculateOverallStats, calculateSubjectStats, triggerHaptic, compareTimeStrings } from '../../utils/db';
import { syncService } from '../../utils/syncService';
import { getAvatarEmoji } from './CompleteProfileModal';

interface HomeViewProps {
  subjects: Subject[];
  records: AttendanceRecord[];
  preferences: AppPreferences;
  onLogAttendance: (subjectId: string, date: string, status: 'attended' | 'bunked' | 'cancelled', scheduleId?: string) => void;
  onOpenNotifications: () => void;
  notificationCount: number;
  onUndoRecent: () => void;
  onSelectSubject: (subject: Subject) => void;
  onOpenWizard?: () => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onOpenFriends?: () => void;
  pendingFriendsCount?: number;
  onOpenLoginModal?: () => void;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Beautiful pre-cooked list of witty, student-first dialogs for Bunkie the Mascot
const MASCOT_QUOTES = {
  no_data: [
    "No classes logged yet. Let's start tracking today! Swipe cards below to record present/absent. 📚",
    "Welcome to the club! Add your schedule and start logging classes so I can calculate your bunk stats. 🎒",
    "Ready to roll? Log your first class to see my smart alerts and attendance metrics in action! ⚡"
  ],
  few_data: [
    "Warming up! Log a few more lectures to get highly accurate predictions. You are doing great! 🌱",
    "A journey of a thousand classes starts with a single log. Keep tracking! 🚀",
    "Good start, buddy! More data points mean more precise bunk warnings. Keep it rolling! 📈"
  ],
  confident: [
    "Surfer mode activated! We are literally the professor's favorite benchwarmer. Go get that extra sleep! 😎",
    "Attendance is so high, the professor might ask YOU for permission to take a leave. Go chill! 🔥",
    "Absolute topper energy! Future generations will study our bunking strategies. Canteen calling? ☕",
    "Bro is literally running the department. Go sleep, the system is yours! 🥱🚀",
    "Legend says if you bunk today, the department GPA goes UP. Absolute king behavior. 👑",
    "Bro, you are the final boss of attendance. Bunk today, you earned it! 🏆"
  ],
  happy: [
    "Life is solid, chai is hot, and we are perfectly safe to skip today. What game are we playing? 🎮",
    "Attendance looking clean! Bunkie approved. No stress, just vibes today! 😎",
    "We have built a premium cushion. Skip class, grab a samosa, and enjoy the freedom! 🍕",
    "We have more cushion than a luxury sofa. Time to hit the canteen and grab some hot maggi! 🍜",
    "Safe and sound, like a bug in a rug. Bunkie gives you a green pass for a movies day! 🎬",
    "No warnings, no danger. Just pure, unadulterated chilling. Go touch some grass! 🌱"
  ],
  relaxed: [
    "Looking decent, mate! We can bunk selectively, but don't go full vacation mode yet. 🏝️",
    "We are above the line. Secure today's attendance if you can, or bunk if it's an emergency! 🙂",
    "Comfort zone secured! Just watch out for surprise tests. Keep the balance alive. ⚖️",
    "You are coasting smoothly, but don't fall asleep at the wheel. Attendance is like trust—hard to build, fast to lose! 🚗",
    "We're in the sweet spot. Go to the fun lectures, bunk the boring ones. Balanced life! ⚖️",
    "Looking clean, but keep an eye on the scoreboard. Don't let a surprise test catch you snoozing! 📝"
  ],
  nervous: [
    "Oof! Attendance is getting a bit too cozy with the boundary. I'd sit in the front row today. 😬",
    "Caution, buddy! One more bunk and we drop into the quicksand. Suffer through today's lecture! 📚",
    "My antenna is tingling... it's a high-risk gamble to miss today. Grab a coffee and go to class! ☕",
    "Danger zone is calling! If you miss today, you'll have to write a 10-page apology letter. Go to class! 📄",
    "Bro, the margin is thinner than my patience. Get up, wash your face, and run to the lecture hall! 🏃‍♂️",
    "This is a classic 'do I risk it for the biscuit' moment. Spoilers: the biscuit is burnt. Go to class! 🍪"
  ],
  panic: [
    "BRO, WE ARE ABSOLUTELY COOKED! Get to class! Make direct eye contact with the professor! 💀",
    "EMERGENCY! Run, don't walk, to the lecture hall! Sit right in the front row! 🏃‍♂️💨",
    "We are sinking! Only consecutive lectures can save us now. Put down the video games! 😭",
    "YOU ARE ON LIFE SUPPORT! If you skip today, they'll delete your enrollment! RUN! 🚨🏃‍♂️",
    "The professor is literally holding a red card. Do not pass go, get to the front seat NOW! 🛑",
    "Cooked? Bro, we are deep-fried and served with a side of failure. Sit in that class and don't even blink! 😭🍟"
  ]
};

// Particle interface for satisfying confetti burst
interface Particle {
  id: number;
  x: number;
  y: number;
  emoji: string;
  rotation: number;
  scale: number;
}

export default function HomeView({
  subjects,
  records,
  preferences,
  onLogAttendance,
  onOpenNotifications,
  notificationCount,
  onUndoRecent,
  onSelectSubject,
  onOpenWizard,
  onScroll,
  onOpenFriends,
  pendingFriendsCount,
  onOpenLoginModal,
}: HomeViewProps) {
  const overallStats = calculateOverallStats(subjects, records, preferences.globalTarget);

  // Today dates
  const today = new Date();
  const currentDayOfWeek = today.getDay();
  const dateString = today.toISOString().split('T')[0];

  // Bunk predictor interactive state
  const [showBunkMode, setShowBunkMode] = useState<boolean>(false);
  const [bunkPredictCount, setBunkPredictCount] = useState<number>(1);
  const [predictSubjectId, setPredictSubjectId] = useState<string>('overall');

  // Swipe interactive state & message popup
  const [swipeMessage, setSwipeMessage] = useState<{ text: string; type: 'success' | 'bunk' | 'info' | null }>({ text: '', type: null });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isShaking, setIsShaking] = useState<boolean>(false);

  // Sync and connection status hooks
  const [syncStatus, setSyncStatus] = useState({
    isSyncing: false,
    lastSynced: preferences.syncLastSynced || 0,
    error: null as string | null
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsub = syncService.subscribe((status) => {
      setSyncStatus({
        isSyncing: status.isSyncing,
        lastSynced: status.lastSynced,
        error: status.error
      });
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsub();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [preferences.syncLastSynced]);

  // Filter subjects scheduled for today
  const todayClasses = subjects
    .flatMap(sub => 
      sub.schedule
        .filter(sch => sch.dayOfWeek === currentDayOfWeek)
        .map(sch => ({ subject: sub, schedule: sch }))
    )
    .sort((a, b) => compareTimeStrings(a.schedule.time, b.schedule.time));

  // Check attendance status for today's classes
  const getClassRecordStatus = (subjectId: string, scheduleId: string) => {
    return records.find(r => r.subjectId === subjectId && r.date === dateString && r.id.includes(scheduleId));
  };

  // Determine Mascot Mood & Styling
  const getMascotMood = () => {
    const totalLogged = overallStats.totalClasses;
    if (totalLogged === 0) {
      return { key: 'no_data' as const, emoji: '🤔', bg: 'from-zinc-700 to-slate-800', label: 'Fresh Start', accent: 'bg-zinc-950/30 border-zinc-900/30 text-zinc-400' };
    }
    if (totalLogged < 5) {
      return { key: 'few_data' as const, emoji: '🌱', bg: 'from-blue-500/80 to-indigo-650/80', label: 'Warming Up', accent: 'bg-blue-950/30 border-blue-900/30 text-blue-400' };
    }

    const pct = overallStats.overallPercentage;
    if (pct >= 90) return { key: 'confident' as const, emoji: '😎', bg: 'from-emerald-500 to-teal-650', label: 'Chill Zone', accent: 'bg-emerald-950/30 border-emerald-900/30 text-emerald-400' };
    if (pct >= 80) return { key: 'happy' as const, emoji: '😁', bg: 'from-indigo-500 to-blue-600', label: 'Careful Zone', accent: 'bg-indigo-950/30 border-indigo-900/30 text-indigo-400' };
    if (pct >= 75) return { key: 'relaxed' as const, emoji: '🙂', bg: 'from-amber-500 to-orange-600', label: 'Relaxed Zone', accent: 'bg-amber-950/30 border-amber-900/30 text-amber-400' };
    if (pct >= 70) return { key: 'nervous' as const, emoji: '😬', bg: 'from-orange-500 to-rose-600', label: 'Risk Zone', accent: 'bg-orange-950/30 border-orange-900/30 text-orange-400' };
    return { key: 'panic' as const, emoji: '💀', bg: 'from-red-650 to-rose-800', label: 'Cooked Zone', accent: 'bg-rose-950/30 border-rose-900/30 text-rose-455' };
  };

  const mascot = getMascotMood();

  // Pick a random quote based on mood
  const [randomQuote, setRandomQuote] = useState<string>('');
  useEffect(() => {
    const quotes = MASCOT_QUOTES[mascot.key];
    const index = Math.floor(Math.random() * quotes.length);
    setRandomQuote(quotes[index]);
  }, [mascot.key, records]);

  // Simulate Shake Phone to Undo
  useEffect(() => {
    let lastX: number | null = null;
    let lastY: number | null = null;
    let lastZ: number | null = null;
    const threshold = 16; 

    const handleMotion = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      const { x, y, z } = acc;
      if (x === null || y === null || z === null) return;

      if (lastX !== null && lastY !== null && lastZ !== null) {
        const deltaX = Math.abs(x - lastX);
        const deltaY = Math.abs(y - lastY);
        const deltaZ = Math.abs(z - lastZ);

        if ((deltaX > threshold && deltaY > threshold) || (deltaX > threshold && deltaZ > threshold) || (deltaY > threshold && deltaZ > threshold)) {
          triggerHaptic('heavy');
          setIsShaking(true);
          onUndoRecent();
          setTimeout(() => setIsShaking(false), 800);
        }
      }
      lastX = x;
      lastY = y;
      lastZ = z;
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [records, onUndoRecent]);

  // Spawn visual satisfying confetti burst on the screen
  const triggerConfetti = (type: 'present' | 'bunk' | 'holiday') => {
    const emojis = type === 'present' 
      ? ['🎉', '🔥', '✅', '🙌', '💯', '✨'] 
      : type === 'bunk'
        ? ['😎', '☕', '🍕', '🎮', '🔋', '🕺']
        : ['🏖️', '🏝️', '🍹', '😴', '✨'];

    const newParticles: Particle[] = Array.from({ length: 18 }).map((_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 240 - 120, // Spread horizontally
      y: -50 - Math.random() * 150, // Burst upwards
      emoji: emojis[Math.floor(Math.random() * emojis.length)],
      rotation: Math.random() * 360,
      scale: Math.random() * 0.6 + 0.7,
    }));

    setParticles(newParticles);
    // Cleanup particles
    setTimeout(() => setParticles([]), 1500);
  };

  // Log attendance via swipe action
  const handleSwipeAction = (subjectId: string, status: 'attended' | 'bunked' | 'cancelled', scheduleId?: string) => {
    onLogAttendance(subjectId, dateString, status, scheduleId);

    const presentMsgs = [
      "🔥 Nice! Keep the streak alive.",
      "💪 Attendance secured.",
      "📚 Future topper energy."
    ];
    const bunkMsgs = [
      "😎 Enjoy your freedom.",
      "☕ Chai > Lecture.",
      "🎮 Time to recharge.",
      "😂 Hope the professor doesn't notice.",
      "🍕 Enjoy your break."
    ];
    const holidayMsgs = [
      "🏖️ Sunkissed & Relaxed. Lecture cancelled!",
      "😴 Extra sleep unlocked!",
      "✨ Free time secured!"
    ];

    let msg = '';
    if (status === 'attended') {
      msg = presentMsgs[Math.floor(Math.random() * presentMsgs.length)];
      setSwipeMessage({ text: msg, type: 'success' });
      triggerConfetti('present');
    } else if (status === 'bunked') {
      msg = bunkMsgs[Math.floor(Math.random() * bunkMsgs.length)];
      setSwipeMessage({ text: msg, type: 'bunk' });
      triggerConfetti('bunk');
    } else {
      msg = holidayMsgs[Math.floor(Math.random() * holidayMsgs.length)];
      setSwipeMessage({ text: msg, type: 'info' });
      triggerConfetti('holiday');
    }

    setTimeout(() => {
      setSwipeMessage({ text: '', type: null });
    }, 3000);
  };

  // Smart calculations for "Can I Bunk?" Mode
  const getSmartBunkVerdict = () => {
    if (predictSubjectId === 'overall') {
      const overallPct = overallStats.overallPercentage;
      const target = preferences.globalTarget;
      
      // Calculate how many times user can bunk overall
      // Let's look at total subjects
      if (subjects.length === 0) return { status: 'no_data', text: 'Add some subjects first, buddy! 📚', color: 'text-slate-500' };
      
      const totalSafeBunks = subjects.reduce((acc, sub) => acc + calculateSubjectStats(sub, records).bunksAvailable, 0);
      
      if (totalSafeBunks > 0) {
        return {
          status: 'safe' as const,
          emoji: '🟢 YES',
          title: 'YES',
          text: `You can safely miss today's lectures.`,
          subtext: `Attendance will comfortably stay safe.`,
          detail: `Safe bunks remaining: ${totalSafeBunks} classes total.`
        };
      } else {
        const totalNeeded = subjects.reduce((acc, sub) => acc + calculateSubjectStats(sub, records).classesToAttend, 0);
        return {
          status: 'danger' as const,
          emoji: '🔴 Nope.',
          title: 'Nope.',
          text: `Attend this class.`,
          subtext: `We'd love to say yes... but your attendance disagrees.`,
          detail: `You'll need ${totalNeeded} consecutive classes to recover overall.`
        };
      }
    } else {
      const subject = subjects.find(s => s.id === predictSubjectId);
      if (!subject) return { status: 'no_data', text: 'Subject not found.', color: 'text-slate-500' };
      
      const stats = calculateSubjectStats(subject, records);
      const target = subject.targetPercentage;

      // Calculate attendance value if we bunk 1 more class
      const nextTotal = stats.totalLogged + 1;
      const nextPct = nextTotal > 0 ? Math.round((stats.attended / nextTotal) * 1000) / 10 : 100;

      if (stats.percentage >= target) {
        if (nextPct >= target) {
          return {
            status: 'safe' as const,
            emoji: '🟢 YES',
            title: 'YES',
            text: `You can safely miss today's lecture.`,
            subtext: `Attendance after bunk: ${nextPct}% (Target: ${target}%)`,
            detail: `Safe bunks remaining: ${stats.bunksAvailable}`
          };
        } else {
          return {
            status: 'borderline' as const,
            emoji: '🟡 Maybe...',
            title: 'Maybe...',
            text: `You'll drop below ${target}% after this bunk.`,
            subtext: `Attendance after bunk: ${nextPct}%`,
            detail: `You'll need classes to recover if you bunk now.`
          };
        }
      } else {
        return {
          status: 'danger' as const,
          emoji: '🔴 Nope.',
          title: 'Nope.',
          text: `Attend this class.`,
          subtext: `Your current attendance is already low (${stats.percentage}%).`,
          detail: `💪 Just survive the next ${stats.classesToAttend} lectures and you're back in the safe zone.`
        };
      }
    }
  };

  const smartVerdict = getSmartBunkVerdict();

  // Bunk Predictor Math: Live updates based on slider count
  const getBunkPredictorStats = () => {
    // We compute the hypothetical percentage if we add 'bunkPredictCount' number of bunks
    let totalAttended = 0;
    let totalConducted = 0;

    subjects.forEach(sub => {
      const subRecords = records.filter(r => r.subjectId === sub.id);
      totalAttended += subRecords.filter(r => r.status === 'attended').length;
      totalConducted += subRecords.filter(r => r.status === 'bunked' || r.status === 'attended').length;
    });

    const hypotheticalConducted = totalConducted + bunkPredictCount;
    const hypotheticalPct = hypotheticalConducted > 0 
      ? Math.round((totalAttended / hypotheticalConducted) * 1000) / 10 
      : 100;

    const globalTarget = preferences.globalTarget;
    let zone = '🟢 Chill Zone';
    let text = 'You are comfortably in the clear. Samosa time! ☕';
    let ringColor = 'stroke-emerald-500';

    if (hypotheticalPct < globalTarget - 10) {
      zone = '💀 Cooked Zone';
      text = "Bro, you are absolutely drowning! Suffer through class. 🚨";
      ringColor = 'stroke-rose-600';
    } else if (hypotheticalPct < globalTarget) {
      zone = '🔴 Danger Zone';
      text = "You'll drop into the restricted attendance list! Attend immediately.";
      ringColor = 'stroke-rose-500';
    } else if (hypotheticalPct < globalTarget + 5) {
      zone = '🟠 Risk Zone';
      text = "Cutting it close. One more and we are in trouble. 😬";
      ringColor = 'stroke-amber-500';
    } else if (hypotheticalPct < globalTarget + 10) {
      zone = '🟡 Careful Zone';
      text = "Safe, but starting to lean. Keep it measured. 📉";
      ringColor = 'stroke-yellow-500';
    }

    // Recover plan
    const diff = globalTarget * hypotheticalConducted - 100 * totalAttended;
    const classesToRecover = diff > 0 ? Math.ceil(diff / (100 - globalTarget)) : 0;

    return {
      percentage: hypotheticalPct,
      zone,
      text,
      ringColor,
      classesToRecover
    };
  };

  const predictorStats = getBunkPredictorStats();

  return (
    <div className="flex-1 overflow-y-auto px-4 xs:px-5 pt-4 pb-32 select-none space-y-5 relative" onScroll={onScroll}>
      
      {/* Satisfying Confetti particles wrapper */}
      <div className="absolute inset-x-0 top-0 pointer-events-none z-50 flex items-center justify-center">
        <AnimatePresence>
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, scale: 0, x: 0, y: 150, rotate: 0 }}
              animate={{ 
                opacity: [1, 1, 0], 
                scale: p.scale, 
                x: p.x, 
                y: p.y, 
                rotate: p.rotation 
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="absolute text-2xl"
            >
              {p.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating Swipe/Gesture Notification Message */}
      <AnimatePresence>
        {swipeMessage.text && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`fixed top-14 left-1/2 -translate-x-1/2 px-4 py-3 rounded-2xl shadow-lg z-50 flex items-center space-x-2 border text-xs font-bold ${
              swipeMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
                : swipeMessage.type === 'bunk'
                  ? 'bg-purple-50 border-purple-100 text-purple-800'
                  : 'bg-indigo-50 border-indigo-100 text-indigo-800'
            }`}
          >
            {swipeMessage.type === 'success' && <Check className="w-4 h-4 text-emerald-600" />}
            {swipeMessage.type === 'bunk' && <Zap className="w-4 h-4 text-purple-600" />}
            <span>{swipeMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Header Block */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3 min-w-0 flex-1 mr-3">
          {preferences.syncEnabled && (
            <div className="w-10 h-10 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center text-2xl shadow-inner shrink-0">
              {getAvatarEmoji(preferences.avatarId)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <span className="text-xs font-bold text-zinc-500 font-mono uppercase tracking-wider block">
              {today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </span>
            <h2 className="text-xl font-display font-black text-white tracking-tight flex items-center min-w-0">
              <span className="truncate">
                {preferences.syncEnabled && preferences.syncUsername
                  ? `Hey, ${preferences.displayName || '@' + preferences.syncUsername}`
                  : 'BunkMate'}
              </span>
              <span className="ml-1 shrink-0">👋</span>
              <Sparkles className="w-4 h-4 ml-1.5 text-indigo-400 animate-pulse shrink-0" />
            </h2>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 flex-shrink-0">
          {/* Online/Offline status badge */}
          {!isOnline && (
            <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/25 text-rose-500 rounded-full flex items-center justify-center shrink-0 animate-pulse" title="Offline Mode">
              <CloudOff className="w-5 h-5 text-rose-455" />
            </div>
          )}



          {onOpenWizard && (
            <button
              onClick={() => { triggerHaptic('medium'); onOpenWizard(); }}
              className="w-10 h-10 bg-indigo-950/30 hover:bg-indigo-900/40 text-indigo-400 rounded-full flex items-center justify-center border border-indigo-900/20 transition cursor-pointer shrink-0"
              title="AI Timetable Setup Wizard"
            >
              <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            </button>
          )}

          {/* Friends Request Engine Button */}
          {preferences.syncEnabled && preferences.syncToken && onOpenFriends && (
            <button
              onClick={() => { triggerHaptic('medium'); onOpenFriends(); }}
              className="relative w-10 h-10 bg-zinc-900 hover:bg-zinc-850 hover:text-indigo-400 rounded-full flex items-center justify-center transition text-zinc-400 cursor-pointer"
              title="Class Buddies & Invites"
            >
              <Users className="w-5 h-5" />
              {pendingFriendsCount !== undefined && pendingFriendsCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 border-2 border-black text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-bounce">
                  {pendingFriendsCount}
                </span>
              )}
            </button>
          )}

          {/* Notifications Bell */}
          <button
            onClick={() => { triggerHaptic('medium'); onOpenNotifications(); }}
            className="relative w-10 h-10 bg-zinc-900 hover:bg-zinc-850 hover:text-indigo-400 rounded-full flex items-center justify-center transition text-zinc-400 cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-500 border-2 border-black text-[10px] font-bold text-white rounded-full flex items-center justify-center">
                {notificationCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Session Expired Banner */}
      {preferences.syncSessionExpired && onOpenLoginModal && (
        <div className="bg-gradient-to-r from-rose-950/40 to-rose-900/20 border border-rose-500/20 rounded-2.5xl p-4 flex items-center justify-between space-x-3 shadow-md">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
              <AlertCircle className="w-4.5 h-4.5 text-rose-455" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-black text-rose-400 leading-none">Session Expired</h4>
              <p className="text-[10px] text-zinc-400 font-semibold truncate mt-1">Please sign in again to resume syncing.</p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('medium');
              onOpenLoginModal();
            }}
            className="px-3 py-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-black shadow-xs transition shrink-0 cursor-pointer"
          >
            Sign In
          </button>
        </div>
      )}

      {/* If there are no subjects, show an empty onboarding layout */}
      {subjects.length === 0 ? (
        <div className="space-y-6 pt-2">
          {/* Friendly Greeting Card */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-[32px] p-6 text-center space-y-4 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
            
            <div className="w-20 h-20 bg-white/15 rounded-full flex items-center justify-center mx-auto text-4xl shadow-md border border-white/20 animate-bounce">
              👋😎
            </div>
            
            <div className="space-y-1.5">
              <h3 className="text-xl font-display font-black leading-tight">Meet BunkMate!</h3>
              <p className="text-xs text-indigo-100 font-semibold leading-relaxed">
                The buddy who helps you navigate college, enjoy your freedom, and track your attendance—completely guilt-free! ☕
              </p>
            </div>

            {onOpenWizard && (
              <button
                type="button"
                onClick={() => { triggerHaptic('medium'); onOpenWizard(); }}
                className="w-full py-3 bg-white hover:bg-slate-50 text-indigo-700 hover:text-indigo-800 rounded-2xl text-xs font-black shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer mt-2"
              >
                <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                <span>Auto-Setup Timetable with AI</span>
              </button>
            )}
          </div>

          {/* Onboarding Cards explaining the app */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider font-mono">
              Getting Started Checklist
            </h4>
            
            <div className="bg-white border border-slate-100 p-4.5 rounded-2.5xl flex items-start space-x-3.5 shadow-2xs">
              <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-lg shrink-0 border border-indigo-100/60 font-bold font-mono">
                1
              </div>
              <div className="space-y-0.5">
                <h5 className="text-sm font-bold text-slate-800">Add Your Subjects</h5>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                  Go to the **Subjects** tab to register your courses, target percentage (75% default), notes, and initial attendance baseline.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 p-4.5 rounded-2.5xl flex items-start space-x-3.5 shadow-2xs">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-lg shrink-0 border border-emerald-100/60 font-bold font-mono">
                2
              </div>
              <div className="space-y-0.5">
                <h5 className="text-sm font-bold text-slate-800">Swipe To Track Logs</h5>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                  Once added, today's schedule appears as swipeable cards! Swipe **Right** for Present ✅ or **Left** to Bunk 😎.
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-100 p-4.5 rounded-2.5xl flex items-start space-x-3.5 shadow-2xs">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-lg shrink-0 border border-amber-100/60 font-bold font-mono">
                3
              </div>
              <div className="space-y-0.5">
                <h5 className="text-sm font-bold text-slate-800">Smart Bunk Predictors</h5>
                <p className="text-xs text-slate-400 font-semibold leading-relaxed">
                  Instantly calculate safe bunks, borderline risks, or warning requirements dynamically. No spreadsheet math needed!
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Mascot Section (Bunkie the Student Buddy) */}
      <div className="glass-card rounded-3xl p-4 relative overflow-hidden flex items-center space-x-4">
        {/* Animated Mascot Character Vector */}
        <motion.div 
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${mascot.bg} text-white flex items-center justify-center text-3xl shadow-sm relative shrink-0`}
          animate={mascot.key === 'panic' 
            ? { x: [-2, 2, -2, 2, 0], y: [-1, 1, -1, 1, 0] } 
            : { y: [0, -4, 0] }
          }
          transition={mascot.key === 'panic'
            ? { repeat: Infinity, duration: 0.3 }
            : { repeat: Infinity, duration: 2.5, ease: 'easeInOut' }
          }
        >
          {mascot.emoji}
          {/* Sweat droplet if nervous */}
          {mascot.key === 'nervous' && (
            <motion.span 
              className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-blue-400 border border-white"
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
            />
          )}
        </motion.div>

        {/* Witty Speech Bubble */}
        <div className="flex-1 space-y-1">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-black uppercase text-indigo-400 tracking-wider">Bunkie says:</span>
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${mascot.accent}`}>
              {mascot.label}
            </span>
          </div>
          <p className="text-xs font-semibold text-zinc-300 leading-relaxed italic">
            "{randomQuote || "Chai breaks make lectures tolerable!"}"
          </p>
        </div>
      </div>

      {/* Quick Stats Dashboard Banner */}
      <div className="bg-slate-950 text-white rounded-3xl p-5 shadow-xl border border-slate-800 flex justify-between items-center relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-indigo-500/10 blur-xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />

        <div className="space-y-3 relative z-10">
          <div>
            <span className="text-xs font-semibold text-indigo-300 font-mono uppercase tracking-wider">
              Total Attendance Health
            </span>
            <div className="flex items-baseline mt-0.5 space-x-1">
              <span className="text-3xl font-display font-black tracking-tight">
                {overallStats.overallPercentage}%
              </span>
              <span className="text-xs text-slate-400 font-bold">
                average
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Classes Attended</span>
              <span className="text-sm font-display font-black text-emerald-400">
                {overallStats.attendedClasses} <span className="text-[10px] text-slate-400 font-sans font-medium">logs</span>
              </span>
            </div>
            <div>
              <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">Classes Bunked</span>
              <span className="text-sm font-display font-black text-rose-400">
                {overallStats.bunkedClasses} <span className="text-[10px] text-slate-400 font-medium">bunks</span>
              </span>
            </div>
          </div>
        </div>

        {/* Circular Progress Meter */}
        <div className="relative flex items-center justify-center z-10 shrink-0">
          <svg className="w-20 h-20 transform -rotate-90">
            <circle
              cx="40"
              cy="40"
              r="34"
              className="stroke-zinc-900 fill-transparent"
              strokeWidth="5"
            />
            <motion.circle
              cx="40"
              cy="40"
              r="34"
              className="stroke-indigo-500 fill-transparent"
              strokeWidth="5"
              strokeDasharray="213.6"
              initial={{ strokeDashoffset: 213.6 }}
              animate={{ strokeDashoffset: 213.6 - (213.6 * overallStats.overallPercentage) / 100 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-[8px] text-indigo-300 uppercase tracking-wider font-extrabold">BUNKABILITY</span>
            <span className="text-xs font-display font-black text-white">{overallStats.bunkabilityIndex}%</span>
          </div>
        </div>
      </div>

      {/* Can I Bunk Interactive Widget */}
      <div className="bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-3xl p-5 text-white shadow-md relative overflow-hidden space-y-4">
        {/* Glow backdrop */}
        <div className="absolute right-0 bottom-0 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />

        <div className="flex justify-between items-center">
          <div className="space-y-0.5">
            <h3 className="text-base font-display font-black flex items-center">
              <Zap className="w-4 h-4 mr-1.5 text-amber-300 fill-amber-300" />
              Can I Bunk?
            </h3>
            <p className="text-xs text-indigo-100 font-semibold">Instant AI Bunk feasibility calculator</p>
          </div>

          <button
            onClick={() => { triggerHaptic('light'); setShowBunkMode(!showBunkMode); }}
            className="px-4 py-1.5 bg-white text-indigo-600 rounded-full text-xs font-extrabold shadow-sm active:scale-95 transition cursor-pointer"
          >
            {showBunkMode ? 'Collapse' : 'Calculate'}
          </button>
        </div>

        {showBunkMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pt-1"
          >
            <div className="space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-indigo-100">Select Course</label>
              <select
                value={predictSubjectId}
                onChange={(e) => { triggerHaptic('light'); setPredictSubjectId(e.target.value); }}
                className="w-full bg-white/10 border border-white/25 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-white cursor-pointer"
              >
                <option value="overall" className="text-slate-800 font-bold">Overall Average</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id} className="text-slate-800 font-bold">{s.name}</option>
                ))}
              </select>
            </div>

            {/* Smart calculation result box */}
            <div className="p-4 bg-white/15 backdrop-blur-xs border border-white/15 rounded-2xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-indigo-100 uppercase tracking-wider">Bunk Status</span>
                <span className={`text-sm font-black px-3 py-0.5 rounded-full bg-white font-display text-slate-850 shadow-xs`}>
                  {smartVerdict.emoji}
                </span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-extrabold">{smartVerdict.text}</p>
                <p className="text-xs text-indigo-100 font-medium">{smartVerdict.subtext}</p>
                {smartVerdict.detail && (
                  <p className="text-[10px] font-mono text-indigo-200 mt-1.5 border-t border-white/10 pt-1.5">
                    💡 {smartVerdict.detail}
                  </p>
                )}
              </div>
            </div>

            {/* Interactive live Bunk Predictor Slider */}
            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3.5 text-white">
              <div className="flex justify-between items-center">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-black uppercase">Bunk Predictor Slider</span>
                  <h4 className="text-xs font-bold">How many classes do you want to bunk?</h4>
                </div>
                <span className="text-2xl font-display font-black text-indigo-300">{bunkPredictCount}</span>
              </div>

              {/* Slider Input */}
              <input
                type="range"
                min="0"
                max="20"
                value={bunkPredictCount}
                onChange={(e) => { triggerHaptic('light'); setBunkPredictCount(Number(e.target.value)); }}
                className="w-full accent-indigo-400 h-1.5 bg-slate-800 rounded-full cursor-pointer outline-none"
              />

              {/* Live Predictor Output metrics */}
              <div className="grid grid-cols-2 gap-3.5 pt-1">
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/40">
                  <span className="text-[8px] text-slate-400 uppercase tracking-wider font-extrabold">HYPOTHETICAL ATTENDANCE</span>
                  <p className="text-lg font-display font-black text-indigo-300">{predictorStats.percentage}%</p>
                </div>
                <div className="bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/40">
                  <span className="text-[8px] text-slate-400 uppercase tracking-wider font-extrabold">RISK LEVEL ZONE</span>
                  <p className="text-xs font-bold text-slate-200 mt-1">{predictorStats.zone}</p>
                </div>
              </div>

              <div className="text-[11px] text-slate-300 leading-relaxed font-semibold bg-slate-950/30 p-2.5 rounded-xl border border-slate-800/20">
                <span className="font-bold text-white">Prediction:</span> {predictorStats.text}
                {predictorStats.classesToRecover > 0 && (
                  <p className="text-orange-400 font-bold mt-1 text-[10px]">
                    ⚠️ You will need to attend {predictorStats.classesToRecover} classes in a row to recover your target percentage!
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Today's Classes Swipe List Widget */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-display font-bold text-white flex items-center">
            <Calendar className="w-4 h-4 mr-1.5 text-indigo-400" />
            Today's Attendance Deck ({todayClasses.length})
          </h3>
          <span className="text-xs text-indigo-400 bg-indigo-950/45 px-2.5 py-1 rounded-full font-bold border border-indigo-900/30">
            {DAYS[currentDayOfWeek]}
          </span>
        </div>

        {/* Tip banner about gestures */}
        <div className="bg-zinc-950/40 border border-zinc-900/50 p-2.5 rounded-2xl text-[10px] text-zinc-400 font-semibold flex items-center space-x-2">
          <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded-md font-mono font-bold">GESTURES</span>
          <p>Swipe Right: Attend | Swipe Left: Bunk | Double Tap: Undo | Long Press: Detail</p>
        </div>

        {todayClasses.length === 0 ? (
          <div className="p-8 bg-zinc-950/40 border border-zinc-900/50 rounded-3xl text-center space-y-2">
            <GraduationCap className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-300">No classes scheduled today!</p>
            <p className="text-xs text-zinc-500">Enjoy your absolute freedom or modify schedule in Subjects tab.</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {todayClasses.map(({ subject, schedule }) => (
              <SwipeClassCard
                key={schedule.id}
                subject={subject}
                schedule={schedule}
                records={records}
                dateString={dateString}
                getClassRecordStatus={getClassRecordStatus}
                onLogAttendance={onLogAttendance}
                onSelectSubject={onSelectSubject}
                onUndoRecent={onUndoRecent}
                handleSwipeAction={handleSwipeAction}
              />
            ))}
          </div>
        )}
      </div>
      </>
      )}

    </div>
  );
}

// ============================================================================
// HIGH PERFORMANCE SWIPE CARD COMPONENT WITH COLOR MORPHING & SNAP STABILIZATION
// ============================================================================
interface SwipeClassCardProps {
  key?: string;
  subject: Subject;
  schedule: ScheduleEntry;
  records: AttendanceRecord[];
  dateString: string;
  getClassRecordStatus: (subjectId: string, scheduleId: string) => AttendanceRecord | undefined;
  onLogAttendance: (subjectId: string, date: string, status: 'attended' | 'bunked' | 'cancelled', scheduleId?: string) => void;
  onSelectSubject: (subject: Subject) => void;
  onUndoRecent: () => void;
  handleSwipeAction: (subjectId: string, status: 'attended' | 'bunked' | 'cancelled', scheduleId?: string) => void;
}

const SwipeClassCard: React.FC<SwipeClassCardProps> = ({
  subject,
  schedule,
  records,
  dateString,
  getClassRecordStatus,
  onLogAttendance,
  onSelectSubject,
  onUndoRecent,
  handleSwipeAction,
}) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // References for robust gesture detection (supports both touch and mouse)
  const pressTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = React.useRef<number>(0);
  const lastTouchTimeRef = React.useRef<number>(0);

  const currentRecord = getClassRecordStatus(subject.id, schedule.id);
  const subjectStats = calculateSubjectStats(subject, records);

  const absX = Math.abs(offsetX);

  let trackBgColor = 'rgb(15, 15, 17)'; // Default pure dark background
  if (isDragging) {
    if (offsetX > 0) {
      const opacity = Math.min(0.85, offsetX / 120);
      trackBgColor = `rgba(16, 185, 129, ${opacity})`; // emerald-500 for present
    } else if (offsetX < 0) {
      const opacity = Math.min(0.85, absX / 120);
      trackBgColor = `rgba(244, 63, 94, ${opacity})`; // rose-500 for bunked
    }
  }

  // Calculate opacity and scale of background labels based on gesture offsets
  let presentOpacity = 0.35;
  let bunkOpacity = 0.35;

  let presentScale = 1;
  let bunkScale = 1;

  let presentColor = '#059669'; // Emerald-600
  let bunkColor = '#e11d48'; // Rose-600

  if (isDragging) {
    if (offsetX > 0) {
      presentOpacity = Math.min(1, 0.35 + (offsetX / 100));
      presentScale = Math.min(1.25, 1 + (offsetX / 250));
      presentColor = offsetX > 50 ? '#ffffff' : '#059669';
      
      bunkOpacity = Math.max(0, 0.35 - (offsetX / 50));
    } else {
      bunkOpacity = Math.min(1, 0.35 + (absX / 100));
      bunkScale = Math.min(1.25, 1 + (absX / 250));
      bunkColor = absX > 50 ? '#ffffff' : '#e11d48';
      
      presentOpacity = Math.max(0, 0.35 - (absX / 50));
    }
  }

  // Unified start handler for both mouse and touch input
  const startPressTimer = (e: React.MouseEvent | React.TouchEvent) => {
    // Prevent simulated mouse events after a real touch event
    if (e.type === 'mousedown') {
      if (Date.now() - lastTouchTimeRef.current < 500) {
        return;
      }
      // Ensure only left click triggers actions
      if ((e as React.MouseEvent).button !== 0) return;
    } else if (e.type === 'touchstart') {
      lastTouchTimeRef.current = Date.now();
    }

    // 1. Double tap/click detection
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (pressTimerRef.current) {
        clearTimeout(pressTimerRef.current);
        pressTimerRef.current = null;
      }
      triggerHaptic('medium');
      onUndoRecent();
      lastTapRef.current = 0; // Reset to prevent triple-taps registering as double
      return;
    }
    lastTapRef.current = now;

    // 2. Long press / context-select detection
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }
    pressTimerRef.current = setTimeout(() => {
      triggerHaptic('heavy');
      onSelectSubject(subject);
      pressTimerRef.current = null;
    }, 600);
  };

  // Cancel long press when tap ends or mouse leaves
  const cancelPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl shadow-md border transition-all duration-300 backdrop-blur-md ${
      currentRecord?.status === 'cancelled'
        ? 'border-dashed border-zinc-800 bg-zinc-950/40 opacity-60'
        : 'border-white/5 bg-zinc-950/65'
    }`}>
      
      {/* Interactive Framer Motion Swipe Panel */}
      <motion.div
        drag={currentRecord?.status === 'cancelled' ? false : "x"}
        dragDirectionLock={true}
        dragSnapToOrigin={true}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.65}
        onDragStart={() => {
          setIsDragging(true);
          cancelPressTimer();
        }}
        onDrag={(event, info) => {
          setOffsetX(info.offset.x);
        }}
        onDragEnd={(event, info) => {
          setIsDragging(false);
          setOffsetX(0);

          const threshold = 75;
          if (info.offset.x > threshold) {
            triggerHaptic('success');
            handleSwipeAction(subject.id, 'attended', schedule.id);
          } else if (info.offset.x < -threshold) {
            triggerHaptic('error');
            handleSwipeAction(subject.id, 'bunked', schedule.id);
          }
        }}
        onMouseDown={startPressTimer}
        onMouseUp={cancelPressTimer}
        onMouseLeave={cancelPressTimer}
        onTouchStart={startPressTimer}
        onTouchEnd={cancelPressTimer}
        onTouchMove={cancelPressTimer}
        className={`relative z-20 backdrop-blur-md p-4 select-none transition-colors duration-300 ${
          currentRecord?.status === 'cancelled' 
            ? 'bg-[#0a0a0c]/60 cursor-default' 
            : 'bg-[#0e0e10]/95 cursor-grab active:cursor-grabbing'
        }`}
        whileDrag={currentRecord?.status === 'cancelled' ? undefined : { scale: 1.01, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1 flex-1 min-w-0 pr-3">
            <div className="flex items-center space-x-1.5 min-w-0">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 transition-opacity duration-300 ${currentRecord?.status === 'cancelled' ? 'opacity-40' : ''}`} style={{ backgroundColor: subject.color }} />
              <span className={`text-[10px] font-mono font-bold truncate uppercase transition-colors duration-300 ${
                currentRecord?.status === 'cancelled' ? 'text-zinc-600' : 'text-zinc-500'
              }`}>
                {subject.code || 'CS-CODE'} • ROOM {subject.room || 'LAB'}
              </span>
            </div>
            <h4 className={`text-sm font-display font-extrabold break-words leading-tight transition-all duration-300 ${
              currentRecord?.status === 'cancelled' ? 'line-through text-zinc-500' : 'text-zinc-100'
            }`}>
              {subject.name}
            </h4>
            <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-bold transition-colors duration-300 ${
              currentRecord?.status === 'cancelled' ? 'text-zinc-650' : 'text-zinc-500'
            }`}>
              <span className="flex items-center shrink-0">
                <Clock className="w-3.5 h-3.5 mr-1 shrink-0" />
                {schedule.time}
              </span>
              <span className="text-zinc-800 hidden xs:inline">|</span>
              <span className="shrink-0">Current: {subjectStats.totalLogged > 0 ? `${subjectStats.percentage}%` : 'No history'}</span>
            </div>
          </div>

          {/* Health Label / Status Badge */}
          <div className="flex flex-col items-end space-y-1 shrink-0">
            {subjectStats.totalLogged > 0 && currentRecord?.status !== 'cancelled' && (
              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md ${
                subjectStats.status === 'safe'
                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'
                  : subjectStats.status === 'borderline'
                    ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30'
                    : 'bg-rose-950/40 text-rose-455 border border-rose-900/30'
              }`}>
                {subjectStats.status === 'safe' ? `Safe (+${subjectStats.bunksAvailable})` : `Needs ${subjectStats.classesToAttend}`}
              </span>
            )}
            
            <div className="flex space-x-1.5">
              <button
                onClick={() => { triggerHaptic('medium'); onSelectSubject(subject); }}
                className="p-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded-lg transition"
                title="More details / Log history"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer log status displays */}
        {currentRecord ? (
          <div className="mt-3 pt-2.5 border-t border-zinc-900 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 font-bold uppercase">
              {currentRecord.status === 'cancelled' ? 'Lecture Status:' : 'Status Logged:'}
            </span>
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                currentRecord.status === 'attended'
                  ? 'bg-emerald-600 text-white'
                  : currentRecord.status === 'bunked'
                    ? 'bg-rose-600 text-white'
                    : 'bg-zinc-800 border border-zinc-700 text-zinc-400'
              }`}>
                {currentRecord.status === 'cancelled' ? 'Cancelled 🏖️' : currentRecord.status}
              </span>

              {currentRecord.status === 'cancelled' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic('light');
                    onUndoRecent();
                  }}
                  className="px-2.5 py-0.5 bg-indigo-950/40 hover:bg-indigo-900/40 text-[9px] text-indigo-400 font-bold rounded border border-indigo-900/30 transition cursor-pointer"
                >
                  Undo
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-3.5 pt-2 border-t border-dashed border-zinc-900 flex justify-between items-center text-[10px] text-zinc-500 font-bold">
            <span>Swipe card or use buttons:</span>
            <div className="flex space-x-1.5 shrink-0">
              <button
                onClick={() => handleSwipeAction(subject.id, 'attended', schedule.id)}
                className="px-2 py-0.5 bg-emerald-950/40 hover:bg-emerald-900/40 text-emerald-400 rounded font-black transition cursor-pointer"
              >
                Attend
              </button>
              <button
                onClick={() => handleSwipeAction(subject.id, 'bunked', schedule.id)}
                className="px-2 py-0.5 bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 rounded font-black transition cursor-pointer"
              >
                Bunk
              </button>
              <button
                onClick={() => handleSwipeAction(subject.id, 'cancelled', schedule.id)}
                className="px-2 py-0.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded font-black transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Swipe background tracks with custom spring color dynamics */}
      <div 
        className="absolute inset-0 z-10 flex justify-between items-center px-6 transition-colors duration-200 pointer-events-none rounded-2xl"
        style={{ backgroundColor: trackBgColor }}
      >
        {/* PRESENT INDICATOR */}
        <div 
          className="flex items-center space-x-2 font-black text-sm transition-all duration-150"
          style={{ 
            opacity: presentOpacity,
            transform: `scale(${presentScale})`,
            color: presentColor
          }}
        >
          <Check className="w-5 h-5 stroke-[3px]" />
          <span>PRESENT</span>
        </div>

        {/* BUNK INDICATOR */}
        <div 
          className="flex items-center space-x-2 font-black text-sm transition-all duration-150"
          style={{ 
            opacity: bunkOpacity,
            transform: `scale(${bunkScale})`,
            color: bunkColor
          }}
        >
          <span>BUNK</span>
          <X className="w-5 h-5 stroke-[3px]" />
        </div>
      </div>

    </div>
  );
}
