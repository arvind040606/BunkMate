import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Edit2, Trash2, Sliders, CheckCircle, AlertTriangle, XCircle, HelpCircle, Pin, Archive, Copy, FileText, BarChart3 } from 'lucide-react';
import { Subject, AttendanceRecord } from '../../types';
import { calculateSubjectStats, triggerHaptic } from '../../utils/db';

interface SubjectDetailModalProps {
  subject: Subject;
  records: AttendanceRecord[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleRecordStatus: (recordId: string, newStatus: 'attended' | 'bunked' | 'cancelled') => void;
  onDeleteRecord: (recordId: string) => void;
  onPin?: (id: string) => void;
  onArchive?: (id: string) => void;
  onDuplicate?: (id: string) => void;
}

export default function SubjectDetailModal({
  subject,
  records,
  onClose,
  onEdit,
  onDelete,
  onToggleRecordStatus,
  onDeleteRecord,
  onPin,
  onArchive,
  onDuplicate,
}: SubjectDetailModalProps) {
  const stats = calculateSubjectStats(subject, records);
  const filteredRecords = records
    .filter(r => r.subjectId === subject.id)
    .sort((a, b) => b.timestamp - a.timestamp); // reverse chronological

  // Simulator states
  const [bunkSim, setBunkSim] = useState(0);
  const [attendSim, setAttendSim] = useState(0);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Simulated Attendance calculation
  const calculateSimulatedPercentage = (extraAttended: number, extraBunked: number) => {
    const simAttended = stats.attended + extraAttended;
    const simBunked = stats.bunked + extraBunked;
    const simTotal = simAttended + simBunked;
    
    if (simTotal === 0) return 100;
    return Math.round((simAttended / simTotal) * 1000) / 10;
  };

  const simPercentBunk = calculateSimulatedPercentage(0, bunkSim);
  const simPercentAttend = calculateSimulatedPercentage(attendSim, 0);

  const getStatusColor = (percent: number, target: number) => {
    if (percent < target) return 'text-rose-455 bg-rose-500/10 border-rose-500/20';
    if (percent - target <= 5) return 'text-amber-455 bg-amber-500/10 border-amber-500/20';
    return 'text-emerald-450 bg-emerald-500/10 border-emerald-500/20';
  };

  const handleToggleRecord = (recordId: string, currentStatus: 'attended' | 'bunked' | 'cancelled') => {
    triggerHaptic('medium');
    const statuses: ('attended' | 'bunked' | 'cancelled')[] = ['attended', 'bunked', 'cancelled'];
    const nextIdx = (statuses.indexOf(currentStatus) + 1) % statuses.length;
    onToggleRecordStatus(recordId, statuses[nextIdx]);
  };

  const handleDeleteSubjClick = () => {
    triggerHaptic('error');
    setShowConfirmDelete(true);
  };

  const confirmDeleteSubject = () => {
    triggerHaptic('heavy');
    onDelete();
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-[440px] bg-zinc-955 rounded-t-[32px] shadow-2xl flex flex-col max-h-[92%] overflow-hidden border-t border-zinc-900 text-white"
      >
        {/* Header */}
        <div className="flex flex-col pt-3 pb-4 px-6 border-b border-zinc-900 relative flex-shrink-0">
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-3" />
          <div className="flex justify-between items-start w-full">
            <div className="text-left">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
                <span className="text-xs font-bold text-zinc-500 font-mono tracking-wider">
                  {subject.code || 'NO-CODE'}
                </span>
              </div>
              <h3 className="text-xl font-display font-black text-white mt-1 max-w-[240px] leading-tight">
                {subject.name}
              </h3>
              {(subject.room || subject.teacher) && (
                <p className="text-zinc-400 text-[11px] mt-1 font-semibold">
                  {subject.room && `🏫 ${subject.room}`} {subject.teacher && `• 👨‍🏫 ${subject.teacher}`}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 justify-end shrink-0 max-w-[45%]">
              {onPin && (
                <button
                  onClick={() => { triggerHaptic('light'); onPin(subject.id); }}
                  className={`p-1.5 border rounded-full transition cursor-pointer ${
                    subject.isPinned 
                      ? 'bg-amber-500/15 border-amber-500/20 text-amber-450' 
                      : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-350'
                  }`}
                  title={subject.isPinned ? "Unpin Subject" : "Pin Subject"}
                >
                  <Pin className={`w-4 h-4 ${subject.isPinned ? 'fill-amber-550' : ''}`} />
                </button>
              )}
              {onArchive && (
                <button
                  onClick={() => { triggerHaptic('light'); onArchive(subject.id); }}
                  className={`p-1.5 border rounded-full transition cursor-pointer ${
                    subject.isArchived 
                      ? 'bg-purple-500/15 border-purple-500/20 text-purple-405' 
                      : 'bg-zinc-900 hover:bg-zinc-850 border-zinc-800 text-zinc-350'
                  }`}
                  title={subject.isArchived ? "Unarchive Subject" : "Archive Subject"}
                >
                  <Archive className="w-4 h-4" />
                </button>
              )}
              {onDuplicate && (
                <button
                  onClick={() => { triggerHaptic('medium'); onDuplicate(subject.id); onClose(); }}
                  className="p-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-350 rounded-full transition cursor-pointer"
                  title="Duplicate Subject"
                >
                  <Copy className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => { triggerHaptic('light'); onEdit(); }}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-350 rounded-full transition cursor-pointer"
                title="Edit Subject"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => { triggerHaptic('light'); onClose(); }}
                className="p-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-350 rounded-full transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent">
          
          {/* Circular Graph and Quick Analytics block */}
          <div className="grid grid-cols-5 gap-4 items-center bg-zinc-900 border border-zinc-850 p-4 rounded-2xl">
            {/* Circle SVG */}
            <div className="col-span-2 flex justify-center relative">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  className="stroke-zinc-850 fill-transparent"
                  strokeWidth="8"
                />
                <motion.circle
                  cx="48"
                  cy="48"
                  r="40"
                  style={{ stroke: subject.color }}
                  className="fill-transparent"
                  strokeWidth="8"
                  strokeDasharray="251.2"
                  initial={{ strokeDashoffset: 251.2 }}
                  animate={{ strokeDashoffset: 251.2 - (251.2 * Math.min(100, stats.percentage)) / 100 }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-display font-black text-white">
                  {stats.totalLogged > 0 ? `${stats.percentage}%` : '—'}
                </span>
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  Target {stats.target}%
                </span>
              </div>
            </div>

            {/* Attendance Status Stats Text */}
            <div className="col-span-3 space-y-2 text-left">
              <div className="flex justify-between text-xs text-zinc-400 font-semibold border-b border-zinc-850 pb-1">
                <span>Total Lectures</span>
                <span className="text-white font-black">{stats.totalLogged}</span>
              </div>
              <div className="flex justify-between text-xs text-zinc-400 font-semibold border-b border-zinc-850 pb-1">
                <span>Attended / Bunked</span>
                <span className="text-white font-black">
                  <span className="text-emerald-400">{stats.attended}</span>
                  <span className="text-zinc-600 px-1 font-normal">/</span>
                  <span className="text-rose-455">{stats.bunked}</span>
                </span>
              </div>
              
              {/* Message Banner for Bunks */}
              <div className="mt-2 text-[10px] font-bold">
                {stats.status === 'safe' && (
                  <div className="flex items-center text-emerald-450 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20">
                    <CheckCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                    <span>🟢 Safe! You can bunk <b>{stats.bunksAvailable}</b> classes.</span>
                  </div>
                )}
                {stats.status === 'borderline' && (
                  <div className="flex items-center text-amber-450 bg-amber-500/10 px-2.5 py-1.5 rounded-xl border border-amber-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 mr-1 flex-shrink-0 animate-pulse" />
                    <span>😅 Careful... bunk limit: <b>{stats.bunksAvailable}</b> classes left.</span>
                  </div>
                )}
                {stats.status === 'danger' && (
                  <div className="flex items-center text-rose-455 bg-rose-500/10 px-2.5 py-1.5 rounded-xl border border-rose-500/20">
                    <XCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                    <span>💀 Cooked... attend the next <b>{stats.classesToAttend}</b> lectures!</span>
                  </div>
                )}
                {stats.status === 'no_data' && (
                  <div className="flex items-center text-zinc-400 bg-zinc-950 px-2.5 py-1.5 rounded-xl border border-zinc-850">
                    <HelpCircle className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
                    <span>No lectures recorded yet. Start tracking! 🚀</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Subject Notes (if set) */}
          {subject.notes && (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-1.5 text-left">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-amber-450" />
                Notes & Syllabus
              </h4>
              <p className="text-xs text-zinc-300 font-semibold leading-relaxed whitespace-pre-wrap">
                {subject.notes}
              </p>
            </div>
          )}

          {/* Subject Baseline Stats */}
          {(subject.initialPresent || subject.initialAbsent) ? (
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl space-y-1.5 text-left">
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center">
                <BarChart3 className="w-4 h-4 mr-1.5 text-indigo-400" />
                Baseline Configuration
              </h4>
              <p className="text-xs text-zinc-300 font-medium leading-relaxed">
                This subject includes an attendance baseline of{' '}
                <span className="font-bold text-indigo-405">{subject.initialPresent || 0} classes attended</span> and{' '}
                <span className="font-bold text-indigo-405">{subject.initialAbsent || 0} classes bunked</span>.
              </p>
            </div>
          ) : null}

          {/* Interactive Bunk Calculator Simulator */}
          <div className="space-y-4 bg-zinc-900 border border-zinc-850 p-5 rounded-2xl text-left">
            <h4 className="text-sm font-semibold text-white flex items-center">
              <Sliders className="w-4 h-4 mr-1.5 text-indigo-400" />
              Smart Simulator (Project your Bunks)
            </h4>

            {/* Slider 1: Bunk Simulator */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-zinc-400">
                <span>If I bunk next consecutive lectures:</span>
                <span className="text-rose-455 font-bold bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                  +{bunkSim} Class{bunkSim !== 1 && 'es'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                value={bunkSim}
                onChange={e => { triggerHaptic('light'); setBunkSim(Number(e.target.value)); if (Number(e.target.value) > 0) setAttendSim(0); }}
                className="w-full h-1.5 bg-zinc-950 border border-zinc-850/60 rounded-lg appearance-none cursor-pointer accent-rose-500"
              />
              {bunkSim > 0 && (
                <div className={`text-xs px-2.5 py-1.5 rounded-xl border font-semibold flex items-center transition-all ${getStatusColor(simPercentBunk, stats.target)}`}>
                  Projected: <b>{simPercentBunk}%</b> 
                  <span className="ml-1 text-[10px]">({simPercentBunk >= stats.target ? '🟢 Chill Zone' : '💀 Cooked Zone'})</span>
                </div>
              )}
            </div>

            {/* Slider 2: Attend Simulator */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-semibold text-zinc-400">
                <span>If I attend next consecutive lectures:</span>
                <span className="text-emerald-450 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                  +{attendSim} Class{attendSim !== 1 && 'es'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                value={attendSim}
                onChange={e => { triggerHaptic('light'); setAttendSim(Number(e.target.value)); if (Number(e.target.value) > 0) setBunkSim(0); }}
                className="w-full h-1.5 bg-zinc-950 border border-zinc-850/60 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              {attendSim > 0 && (
                <div className={`text-xs px-2.5 py-1.5 rounded-xl border font-semibold flex items-center transition-all ${getStatusColor(simPercentAttend, stats.target)}`}>
                  Projected: <b>{simPercentAttend}%</b>
                  <span className="ml-1 text-[10px]">({simPercentAttend >= stats.target ? '💪 Comeback secured!' : '😅 Need to attend more'})</span>
                </div>
              )}
            </div>
          </div>

          {/* Attendance Log / Session Editor */}
          <div className="space-y-3 text-left">
            <h4 className="text-sm font-semibold text-white flex items-center">
              <Calendar className="w-4 h-4 mr-1.5 text-indigo-400" />
              Lectures Log ({filteredRecords.length})
            </h4>

            {filteredRecords.length === 0 ? (
              <p className="text-zinc-550 text-xs italic text-center py-4 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-850">
                No attendance sessions logged for this subject yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                {filteredRecords.map(record => {
                  const formattedDate = new Date(record.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    weekday: 'short',
                  });

                  return (
                    <div
                      key={record.id}
                      className="flex justify-between items-center bg-zinc-900 hover:bg-zinc-850 px-3 py-2 rounded-xl border border-zinc-850/60 transition shadow-2xs text-left"
                    >
                      <div className="text-left">
                        <p className="text-xs font-semibold text-zinc-350">{formattedDate}</p>
                        <p className="text-[10px] text-zinc-550 font-semibold font-mono">
                          {new Date(record.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        {/* Status Toggle Button */}
                        <button
                          onClick={() => handleToggleRecord(record.id, record.status)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold shadow-2xs transition-all uppercase cursor-pointer ${
                            record.status === 'attended'
                              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                              : record.status === 'bunked'
                                ? 'bg-rose-600 text-white hover:bg-rose-500'
                                : 'bg-zinc-700 text-white hover:bg-zinc-650'
                          }`}
                        >
                          {record.status}
                        </button>

                        {/* Record Delete Button */}
                        <button
                          onClick={() => { triggerHaptic('heavy'); onDeleteRecord(record.id); }}
                          className="p-1.5 text-zinc-500 hover:text-rose-455 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Danger Zone */}
          <div className="pt-4 border-t border-zinc-900">
            <button
              onClick={handleDeleteSubjClick}
              className="w-full py-2.5 text-rose-455 bg-rose-500/5 hover:bg-rose-500/10 rounded-xl font-semibold text-xs border border-rose-900/30 flex items-center justify-center transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Remove Subject from Curriculum
            </button>
          </div>
        </div>
      </motion.div>

      {/* Embedded Delete confirmation Modal */}
      <AnimatePresence>
        {showConfirmDelete && (
          <div className="absolute inset-0 bg-black/80 z-[60] flex items-center justify-center p-6 text-center select-none backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 p-6 rounded-3xl max-w-[300px] w-full shadow-2xl border border-zinc-850 space-y-4 text-white"
            >
              <div className="w-12 h-12 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-display font-black text-white">Remove Subject?</h4>
              <p className="text-zinc-400 text-xs leading-relaxed font-semibold">
                Are you sure you want to remove <b>{subject.name}</b>? This will also permanently delete all logged attendance history for this subject.
              </p>
              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => { triggerHaptic('light'); setShowConfirmDelete(false); }}
                  className="flex-1 py-2.5 text-xs font-bold bg-zinc-800 hover:bg-zinc-755 text-zinc-300 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteSubject}
                  className="flex-1 py-2.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-sm transition cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
