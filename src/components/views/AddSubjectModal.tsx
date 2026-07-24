import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X, Plus, Trash2, Clock, MapPin, User, BookOpen, FileText, Calendar } from 'lucide-react';
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
  const [activeTime, setActiveTime] = useState<string>('09:00'); // 24h format for input[type=time]

  const formatTime12h = (time24: string) => {
    const match = time24.match(/^(\d+):(\d+)(?:\s*(AM|PM))?$/i);
    if (!match) return time24;
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const suffix = match[3];
    if (suffix) return time24; // already formatted
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const addScheduleItem = () => {
    triggerHaptic('medium');
    const formattedTime = formatTime12h(activeTime);
    const newEntry: ScheduleEntry = {
      id: `sch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      dayOfWeek: activeDay,
      time: formattedTime,
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
        {/* Header */}
        <div className="flex flex-col items-center pt-3 pb-4 px-6 border-b border-zinc-900 flex-shrink-0">
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full mb-3" />
          <div className="flex justify-between items-center w-full">
            <div>
              <h3 className="text-lg font-display font-black text-white tracking-tight">
                {subjectToEdit ? '✏️ Edit Subject' : '➕ Add Subject'}
              </h3>
              <p className="text-[11px] text-zinc-400 font-medium">Configure details for tracking</p>
            </div>
            <button
              onClick={() => { triggerHaptic('light'); onClose(); }}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-none">
          
          {/* Card: Core details */}
          <div className="bg-zinc-900/35 border border-zinc-900 p-4 rounded-2xl space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Core Information</h4>
            
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-zinc-400">Subject Name *</label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-3.5 w-4 h-4 text-zinc-650" />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g., Mathematics"
                  className="w-full pl-9 pr-4 py-3 bg-zinc-950 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-semibold placeholder:text-zinc-650 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-zinc-400">Subject Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  placeholder="e.g., MATH-101"
                  className="w-full px-3.5 py-3 bg-zinc-950 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-semibold transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-zinc-400">Target Attendance (%)</label>
                <input
                  type="number"
                  value={target}
                  onChange={e => setTarget(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-full px-3.5 py-3 bg-zinc-950 border border-zinc-850 text-indigo-400 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-bold transition"
                />
              </div>
            </div>
          </div>

          {/* Card: Appearance */}
          <div className="bg-zinc-900/35 border border-zinc-900 p-4 rounded-2xl space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Appearance</h4>
            
            {/* Icon Picker */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-zinc-400">Subject Icon</label>
              <div className="flex space-x-1.5 overflow-x-auto py-1 px-0.5 scrollbar-none">
                {EMOJI_PRESETS.map(emoji => {
                  const isSelected = icon === emoji;
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setIcon(emoji); }}
                      className={`text-lg p-2 rounded-lg border flex-shrink-0 transition cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-500/10 border-indigo-500/35 text-white scale-105' 
                          : 'bg-zinc-950 border-zinc-850 text-zinc-450 hover:bg-zinc-900'
                      }`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Accent Picker */}
            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-zinc-400">Accent Color</label>
              <div className="flex flex-wrap gap-2.5">
                {PALETTE.map(c => {
                  const isSelected = color === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { triggerHaptic('light'); setColor(c); }}
                      style={{ backgroundColor: c }}
                      className={`w-7 h-7 rounded-full cursor-pointer transition-all ${
                        isSelected 
                          ? 'ring-4 ring-offset-2 ring-indigo-500/50 scale-105 shadow-md' 
                          : 'opacity-80 hover:opacity-100'
                      }`}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Card: Already had classes this semester? (Simple Attendance Baseline) */}
          <div className="bg-zinc-900/35 border border-zinc-900 p-4 rounded-2xl space-y-3.5">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Already Had Classes?</h4>
              {baselineTotal > 0 && (
                <span className="text-[9px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/25">
                  {baselineTotal} Class{baselineTotal > 1 && 'es'} baseline
                </span>
              )}
            </div>
            <p className="text-[10.5px] text-zinc-400 font-semibold leading-relaxed">
              If this subject has already conducted lectures this semester, enter your progress below so we start with accurate stats.
            </p>

            <div className="grid grid-cols-2 gap-3.5 pt-1">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-zinc-450 uppercase">Classes Attended</label>
                <input
                  type="number"
                  min="0"
                  value={initialPresent}
                  onChange={e => setInitialPresent(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-850 text-emerald-450 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-black transition"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-zinc-455 uppercase">Classes Missed</label>
                <input
                  type="number"
                  min="0"
                  value={initialAbsent}
                  onChange={e => setInitialAbsent(Math.max(0, Number(e.target.value)))}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-850 text-rose-455 rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-black transition"
                />
              </div>
            </div>
          </div>

          {/* Card: Weekly Class Schedule */}
          <div className="bg-zinc-900/35 border border-zinc-900 p-4 rounded-2xl space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Weekly Schedule</h4>
            
            {/* Days Selector */}
            <div className="flex space-x-1 overflow-x-auto pb-1 scrollbar-none">
              {DAYS.map((dayName, idx) => (
                <button
                  key={dayName}
                  type="button"
                  onClick={() => { triggerHaptic('light'); setActiveDay(idx); }}
                  className={`flex-1 min-w-[42px] py-1.5 text-xs font-semibold rounded-lg text-center cursor-pointer transition ${
                    activeDay === idx
                      ? 'bg-indigo-600 text-white shadow-sm font-bold'
                      : 'bg-zinc-950 border border-zinc-850 text-zinc-400 hover:bg-zinc-900'
                  }`}
                >
                  {dayName}
                </button>
              ))}
            </div>

            {/* Time selector and add button */}
            <div className="flex space-x-2 items-center">
              <div className="flex-1 relative">
                <Clock className="absolute left-3 top-3 w-3.5 h-3.5 text-zinc-650 pointer-events-none" />
                <input
                  type="time"
                  value={activeTime}
                  onChange={e => setActiveTime(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-850 text-white rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="button"
                onClick={addScheduleItem}
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center transition cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Class
              </button>
            </div>

            {/* Schedule List */}
            {schedule.length === 0 ? (
              <p className="text-zinc-600 text-[11px] text-center py-2 italic font-medium">
                No classes scheduled for this subject yet.
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 scrollbar-none">
                {schedule.map(item => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center bg-zinc-950 border border-zinc-850 px-3 py-2 rounded-xl"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-md">
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

          {/* Card: Logistics (Room & Teacher) */}
          <div className="bg-zinc-900/35 border border-zinc-900 p-4 rounded-2xl space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Class Logistics (Optional)</h4>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-zinc-400">Room / Location</label>
                <div className="relative">
                  <MapPin className="absolute left-2.5 top-3.5 w-3.5 h-3.5 text-zinc-650" />
                  <input
                    type="text"
                    value={room}
                    onChange={e => setRoom(e.target.value)}
                    placeholder="Room-102"
                    className="w-full pl-8 pr-3 py-3 bg-zinc-950 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-semibold placeholder:text-zinc-650 transition"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-bold text-zinc-400">Teacher Name</label>
                <div className="relative">
                  <User className="absolute left-2.5 top-3.5 w-3.5 h-3.5 text-zinc-650" />
                  <input
                    type="text"
                    value={teacher}
                    onChange={e => setTeacher(e.target.value)}
                    placeholder="Prof. Smith"
                    className="w-full pl-8 pr-3 py-3 bg-zinc-950 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 text-xs font-semibold placeholder:text-zinc-650 transition"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes field */}
          <div className="space-y-1.5 px-1">
            <label className="block text-[11px] font-bold text-zinc-450 uppercase">Notes / Syllabus / Exam details</label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-zinc-650" />
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Grading criteria, notes, or classroom rules..."
                rows={3}
                className="w-full pl-9 pr-4 py-2.5 bg-zinc-905 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-xs font-medium placeholder:text-zinc-650 transition"
              />
            </div>
          </div>

        </div>

        {/* Footer save controls */}
        <div className="p-5 border-t border-zinc-900 flex space-x-3 bg-zinc-950 flex-shrink-0">
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); onClose(); }}
            className="flex-1 py-3 text-zinc-400 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl font-bold text-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 py-3 text-white bg-indigo-650 hover:bg-indigo-600 rounded-xl font-bold text-xs shadow-lg shadow-indigo-650/15 transition cursor-pointer"
          >
            {subjectToEdit ? 'Save Changes' : 'Create Subject'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
