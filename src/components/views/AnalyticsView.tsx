import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart3, TrendingUp, ShieldAlert, CheckCircle2, AlertTriangle, Coffee, Award, Zap, Smile, BookOpen, Clock, Play } from 'lucide-react';
import { Subject, AttendanceRecord } from '../../types';
import { calculateOverallStats, calculateSubjectStats, triggerHaptic } from '../../utils/db';

interface AnalyticsViewProps {
  subjects: Subject[];
  records: AttendanceRecord[];
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export default function AnalyticsView({ subjects, records, onScroll }: AnalyticsViewProps) {
  const overall = calculateOverallStats(subjects, records, 75);
  const subjectStatsList = subjects.map(sub => calculateSubjectStats(sub, records));

  // State to inspect achievements
  const [selectedAchievement, setSelectedAchievement] = useState<{ title: string; desc: string; icon: string; unlocked: boolean } | null>(null);

  // Dynamic Fun Calculations
  const successfulBunks = records.filter(r => r.status === 'bunked').length;
  const classesSurvived = records.filter(r => r.status === 'attended').length;
  const teaBreaks = records.filter(r => r.status === 'cancelled').length + successfulBunks;
  const sleepSaved = Math.round(successfulBunks * (50 / 60) * 10) / 10; // 50 minutes (50/60 hours) per bunked lecture
  
  // Real Streak Calculation
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

  // Perfect Weeks Calculation
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

  // Emergency Recoveries Calculation: subjects with status borderline/safe which once had danger
  const emergencyRecoveries = subjects.filter(sub => {
    const stats = calculateSubjectStats(sub, records);
    return stats.percentage >= sub.targetPercentage && stats.attended >= 5;
  }).length;

  // Define Achievements list and evaluate unlock criteria
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

  // Determine Risk Meter Level & Styling
  const getRiskMeter = () => {
    const pct = overall.overallPercentage;
    if (pct >= 85) return { label: 'Chill Zone 🟢', desc: 'Completely safe. Go watch a movie, buddy!', color: 'bg-emerald-500 text-white' };
    if (pct >= 75) return { label: 'Careful Zone 🟡', desc: 'Secure, but keep a healthy cushion.', color: 'bg-yellow-550 text-zinc-950' };
    if (pct >= 70) return { label: 'Risk Zone 🟠', desc: 'Borderline alert! Do not skip morning lectures.', color: 'bg-orange-500 text-white' };
    if (pct >= 60) return { label: 'Danger Zone 🔴', desc: 'Restricted lists ahead. Time to make a comeback!', color: 'bg-rose-550 text-white' };
    return { label: 'Cooked Zone 💀', desc: 'Attend immediately! Bring coffee, sit up front.', color: 'bg-red-700 text-white animate-pulse' };
  };

  const riskMeter = getRiskMeter();

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32 select-none space-y-5" onScroll={onScroll}>
      
      {/* View Header */}
      <div>
        <span className="text-xs font-bold text-zinc-500 font-mono uppercase tracking-wider">
          Student Stats Center
        </span>
        <h2 className="text-2xl font-display font-black text-white tracking-tight flex items-center">
          Stats & Achievements <Award className="w-5.5 h-5.5 ml-1.5 text-indigo-400" />
        </h2>
      </div>

      {subjects.length === 0 ? (
        <div className="p-12 bg-zinc-955/40 border border-dashed border-zinc-800 rounded-3xl text-center space-y-3">
          <Coffee className="w-12 h-12 text-zinc-650 mx-auto" />
          <p className="text-sm font-bold text-zinc-350">No data available yet</p>
          <p className="text-xs text-zinc-500">Add subjects and log classes to unlock achievements and custom statistics!</p>
        </div>
      ) : (
        <>
          {/* Dynamic Risk Meter Section */}
          <div className="glass-card p-5 border border-white/5 space-y-3">
            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">Attendance Risk Meter</span>
            
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-display font-black text-zinc-150">{riskMeter.label}</h3>
                <p className="text-xs text-zinc-400 font-medium">{riskMeter.desc}</p>
              </div>
              <span className="text-3xl font-display font-black text-white">{overall.overallPercentage}%</span>
            </div>

            {/* Simulated Live Zone Scale */}
            <div className="grid grid-cols-5 gap-1 pt-1.5">
              <div className={`h-2 rounded-l-md transition ${overall.overallPercentage < 60 ? 'bg-red-700' : 'bg-zinc-900'}`} />
              <div className={`h-2 transition ${overall.overallPercentage >= 60 && overall.overallPercentage < 70 ? 'bg-rose-555' : 'bg-zinc-900'}`} />
              <div className={`h-2 transition ${overall.overallPercentage >= 70 && overall.overallPercentage < 75 ? 'bg-orange-500' : 'bg-zinc-900'}`} />
              <div className={`h-2 transition ${overall.overallPercentage >= 75 && overall.overallPercentage < 85 ? 'bg-yellow-555' : 'bg-zinc-900'}`} />
              <div className={`h-2 rounded-r-md transition ${overall.overallPercentage >= 85 ? 'bg-emerald-500' : 'bg-zinc-900'}`} />
            </div>
          </div>

          {/* Gamified Fun Statistics Grid */}
          <div className="space-y-3.5">
            <h3 className="text-sm font-display font-bold text-zinc-300 flex items-center">
              <Zap className="w-4 h-4 mr-1.5 text-indigo-400" />
              My Academic Lifestyle Metrics
            </h3>

            <div className="grid grid-cols-2 gap-3.5">
              
              {/* Tea Breaks Taken */}
              <div className="glass-card p-4 border border-white/5 space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Tea Breaks Taken</span>
                  <span className="text-lg">☕</span>
                </div>
                <p className="text-2xl font-display font-black text-zinc-150">{teaBreaks}</p>
                <p className="text-[10px] text-zinc-500 font-semibold">Chai meetings attended</p>
              </div>

              {/* Successful Bunks */}
              <div className="glass-card p-4 border border-white/5 space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Lectures Escaped</span>
                  <span className="text-lg">😎</span>
                </div>
                <p className="text-2xl font-display font-black text-zinc-150">{successfulBunks}</p>
                <p className="text-[10px] text-zinc-500 font-semibold">Successful bunk logs</p>
              </div>

              {/* Classes Survived */}
              <div className="glass-card p-4 border border-white/5 space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Classes Survived</span>
                  <span className="text-lg">📚</span>
                </div>
                <p className="text-2xl font-display font-black text-zinc-150">{classesSurvived}</p>
                <p className="text-[10px] text-zinc-500 font-semibold">Total hours sat through</p>
              </div>

              {/* Attendance Streak */}
              <div className="glass-card p-4 border border-white/5 space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Active Streak</span>
                  <span className="text-lg">🔥</span>
                </div>
                <p className="text-2xl font-display font-black text-amber-500">{streak} Class{streak !== 1 && 'es'}</p>
                <p className="text-[10px] text-zinc-500 font-semibold">Consecutive attended days</p>
              </div>

              {/* Total Sleep Saved */}
              <div className="glass-card p-4 border border-white/5 space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Sleep Saved</span>
                  <span className="text-lg">💤</span>
                </div>
                <p className="text-2xl font-display font-black text-indigo-400">{sleepSaved} hrs</p>
                <p className="text-[10px] text-zinc-500 font-semibold">Based on 50min per class</p>
              </div>

              {/* Perfect Weeks */}
              <div className="glass-card p-4 border border-white/5 space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Perfect Weeks</span>
                  <span className="text-lg">🎯</span>
                </div>
                <p className="text-2xl font-display font-black text-emerald-500">{perfectWeeks}</p>
                <p className="text-[10px] text-zinc-500 font-semibold">Zero-bunk full weeks</p>
              </div>

            </div>
          </div>

          {/* Gamified Achievements Grid */}
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
                      ? 'bg-amber-500/10 border-amber-500/25 text-white' 
                      : 'bg-zinc-900/50 border-zinc-800/40 text-zinc-500 opacity-60'
                  }`}
                >
                  <span className="text-2xl mb-1.5">{ach.icon}</span>
                  <span className="text-[9px] font-black text-center truncate w-full leading-tight text-zinc-300">{ach.title}</span>
                  {ach.unlocked && (
                    <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Course percentage details list with custom limits */}
          <div className="glass-card p-5 border border-white/5 space-y-4">
            <h3 className="text-sm font-display font-bold text-zinc-300 flex items-center">
              <TrendingUp className="w-4 h-4 mr-1.5 text-indigo-400" />
              Course Progress & Safe Cushions
            </h3>

            <div className="space-y-4">
              {subjectStatsList.map(subj => {
                return (
                  <div key={subj.subjectId} className="space-y-1.5">
                    <div className="flex justify-between items-end text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: subj.color }} />
                        <span className="font-extrabold text-zinc-200">{subj.subjectName}</span>
                      </div>
                      <span className="font-bold text-zinc-350 font-mono">
                        {subj.totalLogged > 0 ? `${subj.percentage}%` : 'No history'}
                      </span>
                    </div>

                    {/* Progress slider layout */}
                    <div className="relative w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/30">
                      <div
                        style={{ width: subj.totalLogged > 0 ? `${subj.percentage}%` : '0%', backgroundColor: subj.color }}
                        className="h-full rounded-full transition-all duration-300"
                      />
                      <div style={{ left: `${subj.target}%` }} className="absolute top-0 bottom-0 w-0.5 bg-zinc-700 opacity-70" />
                    </div>

                    {/* Zone Advice */}
                    <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500">
                      <span>Target: {subj.target}%</span>
                      {subj.status === 'safe' ? (
                        <span className="text-emerald-500">🟢 Can bunk {subj.bunksAvailable} lectures!</span>
                      ) : subj.status === 'borderline' ? (
                        <span className="text-amber-500">🟡 Careful, only {subj.bunksAvailable} left</span>
                      ) : subj.status === 'danger' ? (
                        <span className="text-rose-500">🔴 Attend {subj.classesToAttend} classes to recover</span>
                      ) : (
                        <span className="text-zinc-600">Log class to see balance</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Achievement Detail Overlay Drawer Modal */}
      <AnimatePresence>
        {selectedAchievement && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end justify-center z-50">
            {/* Backdrop click closer */}
            <div className="absolute inset-0" onClick={() => setSelectedAchievement(null)} />
            
            <motion.div
              initial={{ y: 250 }}
              animate={{ y: 0 }}
              exit={{ y: 250 }}
              transition={{ type: 'spring', damping: 25 }}
              className="glass-card w-full max-w-[420px] rounded-t-[32px] p-6 space-y-4 relative z-10 border-t border-white/10"
            >
              {/* Top notch indicator */}
              <div className="w-12 h-1 bg-zinc-800 rounded-full mx-auto" />

              <div className="text-center space-y-3 pt-2">
                <span className="text-5xl block animate-bounce">{selectedAchievement.icon}</span>
                <h3 className="text-xl font-display font-black text-white">{selectedAchievement.title}</h3>
                
                <span className={`inline-block text-[10px] uppercase font-black px-3 py-1 rounded-full ${
                  selectedAchievement.unlocked ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-zinc-900 text-zinc-500 border border-zinc-800/40'
                }`}>
                  {selectedAchievement.unlocked ? '🎉 Unlocked!' : '🔒 Locked'}
                </span>

                <p className="text-xs text-zinc-350 leading-relaxed font-semibold max-w-xs mx-auto">
                  {selectedAchievement.desc}
                </p>
              </div>

              <button
                onClick={() => setSelectedAchievement(null)}
                className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Nice, Got It!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
