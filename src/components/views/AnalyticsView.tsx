import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  TrendingUp,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Coffee,
  Award,
  Zap,
  Smile,
  BookOpen,
  Clock,
  Play,
  Sparkles,
  Bot,
  Send,
  Plus,
  Trash2,
  Calendar,
  Check,
  ShieldCheck,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  X,
  Lock
} from 'lucide-react';
import { Subject, AttendanceRecord, ScheduleEntry } from '../../types';
import { calculateOverallStats, calculateSubjectStats, triggerHaptic } from '../../utils/db';

interface AnalyticsViewProps {
  subjects: Subject[];
  records: AttendanceRecord[];
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onAddSubject?: (subj: Subject) => void;
  onOpenWizard?: () => void;
}

const PALETTE = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4', '#14B8A6'];

export default function AnalyticsView({ subjects, records, onScroll, onAddSubject, onOpenWizard }: AnalyticsViewProps) {
  const [activeTab, setActiveTab] = useState<'stats' | 'assistant'>('assistant');

  // Vault states
  const [hasVaultImage, setHasVaultImage] = useState(false);
  const [savedImageBase64, setSavedImageBase64] = useState<string | null>(null);
  const [showVaultViewer, setShowVaultViewer] = useState(false);
  const [vaultZoom, setVaultZoom] = useState(1);

  useEffect(() => {
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
  
  // Stats center calculations
  const overall = calculateOverallStats(subjects, records, 75);
  const subjectStatsList = subjects.map(sub => calculateSubjectStats(sub, records));

  const [selectedAchievement, setSelectedAchievement] = useState<{ title: string; desc: string; icon: string; unlocked: boolean } | null>(null);

  // Dynamic Fun Calculations
  const successfulBunks = records.filter(r => r.status === 'bunked').length;
  const classesSurvived = records.filter(r => r.status === 'attended').length;
  const teaBreaks = records.filter(r => r.status === 'cancelled').length + successfulBunks;
  const sleepSaved = Math.round(successfulBunks * (50 / 60) * 10) / 10; 
  
  const getStreak = () => {
    const sorted = [...records]
      .filter(r => r.status === 'attended' || r.status === 'bunked')
      .sort((a, b) => b.timestamp - a.timestamp);
    let streakCount = 0;
    for (const r of sorted) {
      if (r.status === 'attended') streakCount++;
      else break;
    }
    return streakCount;
  };
  const streak = getStreak();

  const getPerfectWeeks = () => {
    if (records.length === 0) return 0;
    const sorted = [...records].sort((a, b) => a.timestamp - b.timestamp);
    const start = sorted[0].timestamp;
    const weekMap: { [key: number]: { attended: number; bunked: number } } = {};
    records.forEach(r => {
      const weekIndex = Math.floor((r.timestamp - start) / (7 * 24 * 3600 * 1000));
      if (!weekMap[weekIndex]) weekMap[weekIndex] = { attended: 0, bunked: 0 };
      if (r.status === 'attended') weekMap[weekIndex].attended++;
      if (r.status === 'bunked') weekMap[weekIndex].bunked++;
    });
    return Object.values(weekMap).filter(w => w.attended > 0 && w.bunked === 0).length;
  };
  const perfectWeeks = getPerfectWeeks();

  const achievements = [
    {
      id: 'bunk_strategist',
      title: 'Bunk Strategist',
      desc: 'Overall attendance is maintained in the high safety zone (>= 83%). Master planner! 🎯',
      icon: '🏆',
      unlocked: overall.overallPercentage >= 83 && subjects.length > 0
    },
    {
      id: 'chill_master',
      title: 'Chill Master',
      desc: 'Accumulated more than 5 safe bunks across your curriculum. King of relaxation! 😎',
      icon: '😎',
      unlocked: subjects.reduce((acc, sub) => acc + calculateSubjectStats(sub, records).bunksAvailable, 0) > 5
    },
    {
      id: 'canteen_vip',
      title: 'Canteen VIP',
      desc: 'Bunked 5 or more lectures. The canteen owners know your name! ☕',
      icon: '☕',
      unlocked: successfulBunks >= 5
    },
    {
      id: 'last_bench_legend',
      title: 'Last Bench Legend',
      desc: 'Logged 10 or more successful bunks. A veteran of the rear rows! 👑',
      icon: '👑',
      unlocked: successfulBunks >= 10
    },
    {
      id: 'attendance_ninja',
      title: 'Attendance Ninja',
      desc: 'Scored an outstanding 90%+ attendance in any subject. Professor loves you! 🎯',
      icon: '🎯',
      unlocked: subjectStatsList.some(s => s.percentage >= 90 && s.totalLogged > 0)
    },
    {
      id: 'recovery_king',
      title: 'Recovery King',
      desc: 'Maintained an active streak of 5 or more consecutive classes attended. Welcome back! 🔥',
      icon: '🔥',
      unlocked: streak >= 5
    },
    {
      id: 'semester_survivor',
      title: 'Semester Survivor',
      desc: 'Logged a total of 20 or more classes in the app. Survival guide complete! 👑',
      icon: '🛡️',
      unlocked: records.length >= 20
    }
  ];

  const getRiskMeter = () => {
    const pct = overall.overallPercentage;
    if (pct >= 85) return { label: 'Chill Zone 🟢', desc: 'Completely safe. Go watch a movie, buddy!', color: 'bg-emerald-500 text-white' };
    if (pct >= 75) return { label: 'Careful Zone 🟡', desc: 'Secure, but keep a healthy cushion.', color: 'bg-yellow-550 text-zinc-950' };
    if (pct >= 70) return { label: 'Risk Zone 🟠', desc: 'Borderline alert! Do not skip morning lectures.', color: 'bg-orange-500 text-white' };
    if (pct >= 60) return { label: 'Danger Zone 🔴', desc: 'Restricted lists ahead. Time to make a comeback!', color: 'bg-rose-555 text-white' };
    return { label: 'Cooked Zone 💀', desc: 'Attend immediately! Bring coffee, sit up front.', color: 'bg-red-700 text-white animate-pulse' };
  };

  const riskMeter = getRiskMeter();

  // --- AI ASSISTANT STATE & LOGIC ---
  const [messages, setMessages] = useState<{ sender: 'ai' | 'user'; text: string }[]>([
    { sender: 'ai', text: 'Hey there! I am your AI Bunkmate Assistant. Ask me how to save attendance, check if you can bunk a class, or paste a raw timetable message to parse it automatically!' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [parserText, setParserText] = useState('');
  const [parsedItems, setParsedItems] = useState<Subject[]>([]);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const triggerAIResponse = (userMsg: string) => {
    setIsTyping(true);
    triggerHaptic('medium');

    setTimeout(() => {
      let reply = "I'm analyzing your attendance data... ";
      const textLower = userMsg.toLowerCase();

      if (textLower.includes('bunk') || textLower.includes('skip')) {
        // Can I bunk class?
        if (subjects.length === 0) {
          reply = "You don't have any subjects configured yet! Add some subjects so I can help calculate bunk safety.";
        } else {
          // Find matching subject or offer general overview
          const matchedSub = subjects.find(s => textLower.includes(s.name.toLowerCase()) || textLower.includes((s.code || '').toLowerCase()));
          if (matchedSub) {
            const stats = calculateSubjectStats(matchedSub, records);
            if (stats.status === 'safe') {
              reply = `🎉 Yes! You have a safe attendance of **${stats.percentage}%** in **${matchedSub.name}** (Target: ${matchedSub.targetPercentage}%). You can safely bunk **${stats.bunksAvailable}** class${stats.bunksAvailable !== 1 ? 'es' : ''}! Enjoy the break!`;
            } else if (stats.status === 'borderline') {
              reply = `⚠️ Careful! Your attendance in **${matchedSub.name}** is **${stats.percentage}%**. You only have **${stats.bunksAvailable}** safe bunk left. Skip with extreme caution.`;
            } else {
              reply = `❌ Absolutely not! Your attendance in **${matchedSub.name}** is **${stats.percentage}%**, which is below your target of ${matchedSub.targetPercentage}%. You need to attend the next **${stats.classesToAttend}** classes in a row to recover. Sit in the front row!`;
            }
          } else {
            // General overview
            const safeCount = subjectStatsList.filter(s => s.status === 'safe').length;
            const dangerCount = subjectStatsList.filter(s => s.status === 'danger').length;
            reply = `Here is your Bunk Planner overview: You have **${safeCount}** safe subjects where bunks are available, and **${dangerCount}** subjects in the danger zone. Your overall attendance is **${overall.overallPercentage}%**. Tell me a specific subject name, and I will calculate details!`;
          }
        }
      } else if (textLower.includes('streak') || textLower.includes('fire')) {
        reply = streak > 0 
          ? `🔥 You currently have a hot streak of **${streak} consecutive classes attended**! Keep it going, you are doing awesome!`
          : `💀 Your streak is currently at 0. Log attendance as "Attended" for your next class to kickstart a new streak!`;
      } else if (textLower.includes('plan') || textLower.includes('recovery')) {
        const dangerSubs = subjectStatsList.filter(s => s.status === 'danger');
        if (dangerSubs.length === 0) {
          reply = `🌟 You don't have any subjects in the danger zone! You are maintaining your target goals perfectly. Keep up the great work!`;
        } else {
          const lines = dangerSubs.map(s => {
            const originalSub = subjects.find(sub => sub.id === s.subjectId);
            return `• **${originalSub?.name}**: Attend the next **${s.classesToAttend}** classes consecutively.`;
          });
          reply = `📈 Here is your personalized recovery plan to reach your target percentages:\n\n${lines.join('\n')}\n\nStick to this plan to keep your overall attendance clean!`;
        }
      } else if (textLower.includes('parse') || textLower.includes('schedule') || textLower.includes('timetable')) {
        reply = `To parse your timetable automatically, paste your raw schedule text into the **AI Timetable Text Parser** below! I'll scan days, times, and subject names to set up your profile in one click.`;
      } else {
        reply = `I've analyzed your academic records! Your overall attendance is **${overall.overallPercentage}%** (${overall.overallPercentage >= 75 ? 'above target' : 'below target'}). You have logged **${records.length}** total classes. Let me know if you want a bunk check, recovery plan, or streak update!`;
      }

      setMessages(prev => [...prev, { sender: 'ai', text: reply }]);
      setIsTyping(false);
      triggerHaptic('light');
    }, 1200);
  };

  const handleSendMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    setMessages(prev => [...prev, { sender: 'user', text }]);
    setChatInput('');
    triggerAIResponse(text);
  };

  // Rule-based timetable extraction
  const handleParseTimetable = () => {
    triggerHaptic('medium');
    if (!parserText.trim()) return;

    const dayMap: { [key: string]: number } = {
      sunday: 0, sun: 0,
      monday: 1, mon: 1,
      tuesday: 2, tue: 2,
      wednesday: 3, wed: 3,
      thursday: 4, thu: 4,
      friday: 5, fri: 5,
      saturday: 6, sat: 6
    };

    const lines = parserText.split(/[\n.]+/);
    const results: Subject[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const dayRegex = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/gi;
      const timeRegex = /\b(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?\b/gi;

      const daysFound: number[] = [];
      let dayMatch;
      while ((dayMatch = dayRegex.exec(trimmed)) !== null) {
        const dayKey = dayMatch[1].toLowerCase();
        if (dayMap[dayKey] !== undefined) {
          daysFound.push(dayMap[dayKey]);
        }
      }

      const timesFound: string[] = [];
      let timeMatch;
      while ((timeMatch = timeRegex.exec(trimmed)) !== null) {
        const hour = parseInt(timeMatch[1]);
        const min = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3] ? timeMatch[3].toUpperCase() : 'AM';
        timesFound.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} ${ampm}`);
      }

      let nameCandidate = trimmed
        .replace(dayRegex, '')
        .replace(timeRegex, '')
        .replace(/\b(at|on|every|class|lecture|room|in|from|to|am|pm)\b/gi, '')
        .replace(/[:,\-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (nameCandidate.length > 2 && nameCandidate.length < 40) {
        nameCandidate = nameCandidate.replace(/\b\w/g, c => c.toUpperCase());
        
        const schedule: ScheduleEntry[] = [];
        daysFound.forEach((day, dIdx) => {
          const time = timesFound[dIdx] || timesFound[0] || '09:00 AM';
          schedule.push({
            id: `sch-ai-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            dayOfWeek: day,
            time
          });
        });

        results.push({
          id: `subj-ai-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
          name: nameCandidate,
          code: 'AI-' + nameCandidate.substring(0, 3).toUpperCase(),
          color: PALETTE[results.length % PALETTE.length],
          targetPercentage: 75,
          schedule,
          icon: '📚',
          initialPresent: 0,
          initialAbsent: 0
        });
      }
    });

    setParsedItems(results);
    if (results.length === 0) {
      alert("No subjects could be extracted. Try format: 'Math on Mon at 10 AM, English on Tue at 11 AM'");
    }
  };

  const handleImportParsedSubjects = () => {
    if (parsedItems.length === 0 || !onAddSubject) return;
    triggerHaptic('success');
    parsedItems.forEach(item => {
      onAddSubject(item);
    });
    setImportSuccess(`Successfully imported ${parsedItems.length} subjects to your profile!`);
    setParsedItems([]);
    setParserText('');
    setTimeout(() => setImportSuccess(null), 4000);
  };

  return (
    <div
      onScroll={onScroll}
      className="h-full overflow-y-auto px-4 pt-6 pb-32 bg-black text-white select-none space-y-6"
    >
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            🤖 AI Assistant
          </h1>
          <p className="text-xs text-zinc-400 font-medium">Chat Bunk Planner & Smart Timetable Parser</p>
        </div>
      </div>

      {/* Segmented Tab Selector */}
      <div className="flex bg-zinc-900/80 p-1 rounded-2xl border border-zinc-850">
        <button
          onClick={() => { triggerHaptic('light'); setActiveTab('assistant'); }}
          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
            activeTab === 'assistant'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-550 hover:text-zinc-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>AI Companion & Parser</span>
        </button>
        <button
          onClick={() => { triggerHaptic('light'); setActiveTab('stats'); }}
          className={`flex-1 py-3 text-xs font-black rounded-xl transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
            activeTab === 'stats'
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-550 hover:text-zinc-300'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Stats & Analytics</span>
        </button>
      </div>

      {activeTab === 'stats' ? (
        // Existing stats view content
        subjects.length === 0 ? (
          <div className="p-12 bg-zinc-900 border border-dashed border-zinc-800 rounded-3xl text-center space-y-3">
            <Coffee className="w-12 h-12 text-zinc-600 mx-auto" />
            <p className="text-sm font-bold text-zinc-300">No data available yet</p>
            <p className="text-xs text-zinc-500">Add subjects and log classes to unlock achievements and custom statistics!</p>
          </div>
        ) : (
          <>
            {/* Risk Meter */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-3 shadow-md">
              <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Attendance Risk Meter</span>
              
              <div className="flex justify-between items-center text-left">
                <div>
                  <h3 className="text-lg font-display font-black text-zinc-200">{riskMeter.label}</h3>
                  <p className="text-xs text-zinc-400 font-semibold">{riskMeter.desc}</p>
                </div>
                <span className="text-3xl font-display font-black text-white">{overall.overallPercentage}%</span>
              </div>

              {/* Simulated Live Zone Scale */}
              <div className="grid grid-cols-5 gap-1 pt-1.5">
                <div className={`h-2 rounded-l-md transition ${overall.overallPercentage < 60 ? 'bg-red-700' : 'bg-zinc-950'}`} />
                <div className={`h-2 transition ${overall.overallPercentage >= 60 && overall.overallPercentage < 70 ? 'bg-rose-555' : 'bg-zinc-955'}`} />
                <div className={`h-2 transition ${overall.overallPercentage >= 70 && overall.overallPercentage < 75 ? 'bg-orange-500' : 'bg-zinc-955'}`} />
                <div className={`h-2 transition ${overall.overallPercentage >= 75 && overall.overallPercentage < 85 ? 'bg-yellow-555' : 'bg-zinc-955'}`} />
                <div className={`h-2 rounded-r-md transition ${overall.overallPercentage >= 85 ? 'bg-emerald-500' : 'bg-zinc-955'}`} />
              </div>
            </div>

            {/* Life Metrics Grid */}
            <div className="space-y-3.5">
              <h3 className="text-sm font-display font-bold text-zinc-300 flex items-center">
                <Zap className="w-4 h-4 mr-1.5 text-indigo-400" />
                My Academic Lifestyle Metrics
              </h3>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl space-y-1 text-left">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Tea Breaks Taken</span>
                    <span className="text-lg">☕</span>
                  </div>
                  <p className="text-2xl font-display font-black text-zinc-100">{teaBreaks}</p>
                  <p className="text-[10px] text-zinc-550 font-bold">Chai meetings</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl space-y-1 text-left">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Lectures Escaped</span>
                    <span className="text-lg">😎</span>
                  </div>
                  <p className="text-2xl font-display font-black text-zinc-100">{successfulBunks}</p>
                  <p className="text-[10px] text-zinc-550 font-bold">Bunks logged</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl space-y-1 text-left">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Classes Survived</span>
                    <span className="text-lg">📚</span>
                  </div>
                  <p className="text-2xl font-display font-black text-zinc-100">{classesSurvived}</p>
                  <p className="text-[10px] text-zinc-550 font-bold">Total classes sat</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl space-y-1 text-left">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Active Streak</span>
                    <span className="text-lg">🔥</span>
                  </div>
                  <p className="text-2xl font-display font-black text-amber-500">{streak} Class{streak !== 1 && 'es'}</p>
                  <p className="text-[10px] text-zinc-550 font-bold">Consecutive attended</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl space-y-1 text-left">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Sleep Saved</span>
                    <span className="text-lg">💤</span>
                  </div>
                  <p className="text-2xl font-display font-black text-indigo-400">{sleepSaved} hrs</p>
                  <p className="text-[10px] text-zinc-550 font-bold">Escaping lectures</p>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-3xl space-y-1 text-left">
                  <div className="flex justify-between items-start">
                    <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Perfect Weeks</span>
                    <span className="text-lg">🎯</span>
                  </div>
                  <p className="text-2xl font-display font-black text-emerald-500">{perfectWeeks}</p>
                  <p className="text-[10px] text-zinc-550 font-bold">Zero-bunk weeks</p>
                </div>
              </div>
            </div>

            {/* Achievements Grid */}
            <div className="space-y-3.5">
              <h3 className="text-sm font-display font-bold text-zinc-300 flex items-center">
                <Award className="w-4 h-4 mr-1.5 text-amber-500 fill-amber-500" />
                Bunk Achievements ({achievements.filter(a => a.unlocked).length} / {achievements.length})
              </h3>

              <div className="grid grid-cols-4 gap-3">
                {achievements.map((ach) => (
                  <button
                    key={ach.id}
                    onClick={() => { triggerHaptic('light'); setSelectedAchievement(ach); }}
                    className={`relative p-3.5 rounded-2xl flex flex-col items-center justify-center border transition aspect-square cursor-pointer ${
                      ach.unlocked 
                        ? 'bg-amber-500/10 border-amber-500/25 text-white animate-pulse' 
                        : 'bg-zinc-900 border-zinc-850 text-zinc-500 opacity-60'
                    }`}
                  >
                    <span className="text-2xl mb-1.5">{ach.icon}</span>
                    <span className="text-[9px] font-black text-center truncate w-full leading-tight text-zinc-300">{ach.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Course Cushions */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-4">
              <h3 className="text-sm font-display font-bold text-zinc-300 flex items-center">
                <TrendingUp className="w-4 h-4 mr-1.5 text-indigo-400" />
                Course Progress & Safe Cushions
              </h3>

              <div className="space-y-4">
                {subjectStatsList.map(subj => {
                  return (
                    <div key={subj.subjectId} className="space-y-1.5 text-left">
                      <div className="flex justify-between items-end text-xs">
                        <div className="flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: subj.color }} />
                          <span className="font-extrabold text-zinc-200">{subj.subjectName}</span>
                        </div>
                        <span className="font-bold text-zinc-350 font-mono">
                          {subj.totalLogged > 0 ? `${subj.percentage}%` : 'No history'}
                        </span>
                      </div>

                      <div className="relative w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-850">
                        <div
                          style={{ width: subj.totalLogged > 0 ? `${subj.percentage}%` : '0%', backgroundColor: subj.color }}
                          className="h-full rounded-full transition-all duration-300"
                        />
                        <div style={{ left: `${subj.target}%` }} className="absolute top-0 bottom-0 w-0.5 bg-zinc-700 opacity-70" />
                      </div>

                      <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500">
                        <span>Target: {subj.target}%</span>
                        {subj.status === 'safe' ? (
                          <span className="text-emerald-500">🟢 Can bunk {subj.bunksAvailable} classes!</span>
                        ) : subj.status === 'borderline' ? (
                          <span className="text-amber-500">🟡 Careful, only {subj.bunksAvailable} left</span>
                        ) : subj.status === 'danger' ? (
                          <span className="text-rose-500">🔴 Attend {subj.classesToAttend} classes to recover</span>
                        ) : (
                          <span className="text-zinc-650 font-medium">Log class to see balance</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )
      ) : (
        // AI Companion and Parser View
        <div className="space-y-6">
          {/* AI Setup Assistant Card / Timetable Vault */}
          {onOpenWizard && (
            hasVaultImage ? (
              <div className="bg-gradient-to-br from-emerald-950/20 to-emerald-950/40 rounded-3xl p-5 border border-emerald-900/30 shadow-xs space-y-3.5 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-display font-bold text-white flex items-center">
                    <ShieldCheck className="w-4 h-4 mr-1.5 text-emerald-400" />
                    Timetable Vault
                  </h3>
                  <span className="text-[9px] font-mono font-black uppercase text-emerald-400 bg-emerald-950/45 px-1.5 py-0.5 rounded-md border border-emerald-900/30">
                    ACTIVE
                  </span>
                </div>
                <p className="text-xs text-emerald-200/80 leading-relaxed font-semibold">
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
              <div className="bg-gradient-to-br from-indigo-950/20 to-indigo-950/40 rounded-3xl p-5 border border-indigo-900/30 shadow-xs space-y-3.5 text-left">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-display font-bold text-white flex items-center">
                    <Sparkles className="w-4 h-4 mr-1.5 text-indigo-400 animate-pulse" />
                    AI Timetable Assistant
                  </h3>
                  <span className="text-[9px] font-mono font-black uppercase text-indigo-400 bg-indigo-950/45 px-1.5 py-0.5 rounded-md border border-indigo-900/30">
                    Gemini AI
                  </span>
                </div>
                <p className="text-xs text-indigo-200 leading-relaxed font-semibold">
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

          {/* Parser Section */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-extrabold text-white">AI Timetable Text Parser</h4>
                <p className="text-[10px] text-zinc-500 font-semibold">Paste raw schedule texts to auto-populate your subjects</p>
              </div>
            </div>

            {importSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-start space-x-2 text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>{importSuccess}</span>
              </div>
            )}

            <div className="space-y-2">
              <textarea
                value={parserText}
                onChange={e => setParserText(e.target.value)}
                placeholder="Example: Monday at 10:00 AM Physics class. Tuesday at 11:30 AM Calculus lecture. Thursday at 02:00 PM Chemistry lab."
                rows={4}
                className="w-full p-4 bg-zinc-950 border border-zinc-850 text-white rounded-2xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-xs font-semibold placeholder:text-zinc-600 transition"
              />
              <button
                onClick={handleParseTimetable}
                className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-black rounded-2xl transition"
              >
                Scan Timetable Text
              </button>
            </div>

            {parsedItems.length > 0 && (
              <div className="pt-3 border-t border-zinc-800 space-y-3">
                <div className="flex justify-between items-center">
                  <h5 className="text-xs font-mono font-black text-zinc-450 uppercase">Extracted Subjects ({parsedItems.length})</h5>
                  <button
                    onClick={handleImportParsedSubjects}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black transition flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Import All
                  </button>
                </div>

                <div className="space-y-2">
                  {parsedItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-zinc-950 border border-zinc-850 p-3 rounded-2xl text-left">
                      <div className="flex items-center space-x-3">
                        <span className="text-lg">📚</span>
                        <div>
                          <span className="block text-xs font-bold text-white leading-tight">{item.name}</span>
                          <span className="block text-[9px] text-zinc-550 font-bold mt-0.5">
                            {item.schedule.length > 0 ? `${item.schedule.length} weekly classes` : 'No days detected'}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                        {item.code}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* AI Chat Section */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-3xl space-y-4 flex flex-col h-[400px]">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
                <Bot className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h4 className="text-sm font-extrabold text-white">AI Chat Companion</h4>
                <p className="text-[10px] text-zinc-500 font-semibold">Get smart calculations and advice instantly</p>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 scrollbar-thin scrollbar-thumb-zinc-800 text-left">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3.5 rounded-2xl text-xs leading-relaxed font-semibold ${
                      msg.sender === 'user'
                        ? 'bg-indigo-650 text-white rounded-tr-none'
                        : 'bg-zinc-950 border border-zinc-850 text-zinc-200 rounded-tl-none'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-zinc-950 border border-zinc-850 p-3.5 rounded-2xl rounded-tl-none text-zinc-500 text-xs font-bold flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 bg-zinc-650 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-zinc-650 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-1.5 h-1.5 bg-zinc-650 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Prompts */}
            <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none flex-shrink-0">
              <button
                onClick={() => { setChatInput('Can I bunk classes today?'); }}
                className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-850 text-[10px] font-black text-zinc-400 hover:text-white rounded-xl transition flex-shrink-0 cursor-pointer"
              >
                Can I bunk today?
              </button>
              <button
                onClick={() => { setChatInput('Give me my attendance recovery plan.'); }}
                className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-850 text-[10px] font-black text-zinc-400 hover:text-white rounded-xl transition flex-shrink-0 cursor-pointer"
              >
                Recovery plan
              </button>
              <button
                onClick={() => { setChatInput('Check my attendance streak.'); }}
                className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-850 text-[10px] font-black text-zinc-400 hover:text-white rounded-xl transition flex-shrink-0 cursor-pointer"
              >
                Check my streak
              </button>
            </div>

            {/* Input Form */}
            <div className="flex space-x-2 flex-shrink-0">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSendMessage(); }}
                placeholder="Ask: 'Can I bunk Physics?' or 'Recovery plan'"
                className="flex-1 px-4 py-3 bg-zinc-950 border border-zinc-850 text-white rounded-2xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-xs font-bold transition placeholder:text-zinc-600"
              />
              <button
                onClick={handleSendMessage}
                className="p-3 bg-indigo-650 hover:bg-indigo-600 text-white rounded-2xl transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Achievement Detail Overlay */}
      <AnimatePresence>
        {selectedAchievement && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end justify-center z-50">
            <div className="absolute inset-0" onClick={() => setSelectedAchievement(null)} />
            
            <motion.div
              initial={{ y: 250 }}
              animate={{ y: 0 }}
              exit={{ y: 250 }}
              transition={{ type: 'spring', damping: 25 }}
              className="bg-zinc-900 border-t border-zinc-800 w-full max-w-[420px] rounded-t-[32px] p-6 space-y-4 relative z-10"
            >
              <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto" />

              <div className="text-center space-y-3 pt-2">
                <span className="text-5xl block animate-bounce">{selectedAchievement.icon}</span>
                <h3 className="text-xl font-display font-black text-white">{selectedAchievement.title}</h3>
                
                <span className={`inline-block text-[10px] uppercase font-black px-3 py-1 rounded-full ${
                  selectedAchievement.unlocked ? 'bg-amber-500/10 text-amber-450 border border-amber-500/30' : 'bg-zinc-955 text-zinc-500 border border-zinc-850/40'
                }`}>
                  {selectedAchievement.unlocked ? '🎉 Unlocked!' : '🔒 Locked'}
                </span>

                <p className="text-xs text-zinc-350 leading-relaxed font-semibold max-w-xs mx-auto">
                  {selectedAchievement.desc}
                </p>
              </div>

              <button
                onClick={() => setSelectedAchievement(null)}
                className="w-full py-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Got It!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full-Screen Vault Viewer Overlay */}
      <AnimatePresence>
        {showVaultViewer && savedImageBase64 && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center select-none"
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
    </div>
  );
}
