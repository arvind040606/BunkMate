import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Plus, Trash2, Clock, MapPin, User, BookOpen, FileText, Smile } from 'lucide-react';
import { Subject, ScheduleEntry } from '../../types';
import { triggerHaptic } from '../../utils/db';

interface AddSubjectModalProps {
  onClose: () => void;
  onSave: (subject: Subject) => void;
  subjectToEdit?: Subject;
}

const PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#14B8A6', // Teal
];

const EMOJI_PRESETS = ['📚', '💻', '🔬', '🧪', '🎨', '📝', '🧠', '🧭', '🌍', '📊', '⚡', '☕', '🗣️', '🎭', '⚖️'];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function AddSubjectModal({ onClose, onSave, subjectToEdit }: AddSubjectModalProps) {
  const [name, setName] = useState(subjectToEdit?.name || '');
  const [code, setCode] = useState(subjectToEdit?.code || '');
  const [room, setRoom] = useState(subjectToEdit?.room || '');
  const [teacher, setTeacher] = useState(subjectToEdit?.teacher || '');
  const [color, setColor] = useState(subjectToEdit?.color || PALETTE[0]);
  const [target, setTarget] = useState(subjectToEdit?.targetPercentage || 75);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(subjectToEdit?.schedule || []);
  const [icon, setIcon] = useState(subjectToEdit?.icon || '📚');
  const [notes, setNotes] = useState(subjectToEdit?.notes || '');
  const [initialPresent, setInitialPresent] = useState<number>(subjectToEdit?.initialPresent || 0);
  const [initialAbsent, setInitialAbsent] = useState<number>(subjectToEdit?.initialAbsent || 0);

  const [activeDay, setActiveDay] = useState<number>(1); // Monday default
  const [activeTime, setActiveTime] = useState<string>('09:00 AM');

  const addScheduleItem = () => {
    triggerHaptic('medium');
    const newEntry: ScheduleEntry = {
      id: `sch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dayOfWeek: activeDay,
      time: activeTime,
    };
    setSchedule(prev => [...prev, newEntry].sort((a, b) => a.dayOfWeek - b.dayOfWeek));
  };

  const removeScheduleItem = (id: string) => {
    triggerHaptic('medium');
    setSchedule(prev => prev.filter(item => item.id !== id));
  };

  const handleSave = () => {
    if (!name.trim()) {
      triggerHaptic('error');
      alert('Subject name is required');
      return;
    }
    triggerHaptic('success');
    
    const subjectData: Subject = {
      id: subjectToEdit?.id || `subj-${Date.now()}`,
      name: name.trim(),
      code: code.trim().toUpperCase() || 'CS-' + name.substring(0, 3).toUpperCase(),
      room: room.trim() || undefined,
      teacher: teacher.trim() || undefined,
      color,
      targetPercentage: Number(target),
      schedule,
      icon,
      notes: notes.trim() || undefined,
      initialPresent: Number(initialPresent) || 0,
      initialAbsent: Number(initialAbsent) || 0,
    };
    
    onSave(subjectData);
  };

  const baselineTotal = Number(initialPresent) + Number(initialAbsent);

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-[440px] bg-zinc-950 rounded-t-[32px] shadow-2xl flex flex-col h-[94%] overflow-hidden border-t border-zinc-900 text-white"
      >
        {/* Header Drag Indicator and Title */}
        <div className="flex flex-col items-center pt-3 pb-4 px-6 border-b border-zinc-900 flex-shrink-0">
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full mb-3" />
          <div className="flex justify-between items-center w-full">
            <h3 className="text-xl font-display font-black text-white tracking-tight">
              {subjectToEdit ? '✏️ Edit Subject' : '➕ Add Subject'}
            </h3>
            <button
              onClick={() => { triggerHaptic('light'); onClose(); }}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-305 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent">
          
          {/* Icon Selector Grid */}
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
              Select Subject Icon
            </label>
            <div className="flex space-x-2 overflow-x-auto py-1.5 px-0.5 scrollbar-none">
              {EMOJI_PRESETS.map(emoji => {
                const isSelected = icon === emoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => { triggerHaptic('light'); setIcon(emoji); }}
                    className={`text-xl p-2.5 rounded-xl border flex-shrink-0 transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-500/10 border-indigo-500/30 scale-110 shadow-xs text-white' 
                        : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </div>

          {/* General info */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                Subject Name *
              </label>
              <div className="relative">
                <BookOpen className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-550" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Database Management Systems"
                  className="w-full pl-10 pr-4 py-3 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-sm font-bold placeholder:text-zinc-650 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                  Subject Code
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="e.g., CS-302"
                  className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-sm font-semibold transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                  Target Attendance (%)
                </label>
                <input
                  type="number"
                  value={target}
                  onChange={e => setTarget(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-850 text-indigo-400 rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-sm font-bold transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                  Room / Location
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3.5 w-3.5 h-3.5 text-zinc-550" />
                  <input
                    type="text"
                    value={room}
                    onChange={e => setRoom(e.target.value)}
                    placeholder="e.g., Room-402"
                    className="w-full pl-8 pr-4 py-3 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-sm font-semibold transition"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                  Teacher Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-3.5 w-3.5 h-3.5 text-zinc-550" />
                  <input
                    type="text"
                    value={teacher}
                    onChange={e => setTeacher(e.target.value)}
                    placeholder="e.g., Prof. Turing"
                    className="w-full pl-8 pr-4 py-3 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-sm font-semibold transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Color palette */}
          <div className="space-y-2">
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
              Color Accent
            </label>
            <div className="flex flex-wrap gap-2.5">
              {PALETTE.map(c => {
                const isSelected = color === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { triggerHaptic('light'); setColor(c); }}
                    style={{ backgroundColor: c }}
                    className={`w-8 h-8 rounded-full cursor-pointer transition-all ${
                      isSelected 
                        ? 'ring-4 ring-offset-2 ring-indigo-500/50 scale-110 shadow-md' 
                        : 'opacity-80 hover:opacity-100 hover:scale-105'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Manual Baseline History Inputs */}
          <div className="bg-indigo-550/10 p-4 rounded-2xl border border-indigo-500/20 space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center">
                <Smile className="w-4 h-4 mr-1.5 text-indigo-400" />
                Previous Attendance Baseline
              </h4>
              {baselineTotal > 0 && (
                <span className="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/25">
                  {baselineTotal} Class{baselineTotal > 1 && 'es'} baseline
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 font-semibold leading-relaxed">
              Have you already had classes conducted for this subject this semester? Set your initial counts here so you don't start from scratch!
            </p>

            <div className="grid grid-cols-2 gap-3.5 pt-1">
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  Present Classes
                </label>
                <input
                  type="number"
                  min="0"
                  value={initialPresent}
                  onChange={e => setInitialPresent(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-bold transition"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  Absent Classes
                </label>
                <input
                  type="number"
                  min="0"
                  value={initialAbsent}
                  onChange={e => setInitialAbsent(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-bold transition"
                />
              </div>
            </div>
          </div>

          {/* Notes area */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
              Notes / Syllabus / Exam details
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-zinc-550" />
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Grading criteria: 15% midterms, 50% finals. Professor is chill but takes roll call..."
                rows={3}
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-xs font-semibold placeholder:text-zinc-650 transition"
              />
            </div>
          </div>

          {/* Class Schedule manager */}
          <div className="space-y-3 bg-zinc-900/30 p-4 rounded-2xl border border-zinc-900">
            <h4 className="text-sm font-semibold text-white flex items-center">
              <Clock className="w-4 h-4 mr-1.5 text-indigo-400" />
              Weekly Class Schedule
            </h4>

            {/* Quick adding row */}
            <div className="grid grid-cols-1 gap-2 bg-zinc-900 border border-zinc-850 p-3 rounded-xl shadow-sm">
              <div className="flex space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
                {DAYS.map((dayName, idx) => (
                  <button
                    key={dayName}
                    type="button"
                    onClick={() => { triggerHaptic('light'); setActiveDay(idx); }}
                    className={`flex-1 min-w-[40px] py-1.5 text-xs font-semibold rounded-lg text-center cursor-pointer transition ${
                      activeDay === idx
                        ? 'bg-indigo-650 text-white shadow-sm'
                        : 'bg-zinc-950 border border-zinc-850 text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {dayName}
                  </button>
                ))}
              </div>

              <div className="flex space-x-2 items-center mt-1">
                <input
                  type="text"
                  value={activeTime}
                  onChange={e => setActiveTime(e.target.value)}
                  placeholder="e.g., 09:00 AM"
                  className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-850 text-white rounded-lg text-xs font-semibold text-center focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={addScheduleItem}
                  className="px-3.5 py-2 bg-indigo-650 text-white rounded-lg text-xs font-semibold hover:bg-indigo-600 flex items-center transition cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </button>
              </div>
            </div>

            {/* List of schedules */}
            {schedule.length === 0 ? (
              <p className="text-zinc-500 text-xs text-center py-2 italic">
                No classes scheduled yet.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                {schedule.map(item => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-zinc-900 border border-zinc-850 px-3 py-2 rounded-xl"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
                        {DAYS[item.dayOfWeek]}
                      </span>
                      <span className="text-xs font-semibold text-zinc-300">
                        {item.time}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeScheduleItem(item.id)}
                      className="p-1 hover:bg-rose-500/15 text-rose-455 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer save controls */}
        <div className="p-6 border-t border-zinc-900 flex space-x-3 bg-zinc-950 flex-shrink-0">
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); onClose(); }}
            className="flex-1 py-3 text-zinc-400 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl font-bold text-sm transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 text-white bg-indigo-650 hover:bg-indigo-600 rounded-xl font-bold text-sm shadow-lg shadow-indigo-650/15 transition cursor-pointer"
          >
            {subjectToEdit ? 'Save Changes' : 'Create Subject'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
