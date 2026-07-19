import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Plus, 
  Trash2, 
  CheckCircle, 
  HelpCircle,
  FileText,
  Award,
  MapPin,
  Square,
  CheckSquare,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Info,
  CalendarDays
} from 'lucide-react';
import { Subject, AttendanceRecord, Exam, Assignment } from '../../types';
import { triggerHaptic, db, compareTimeStrings } from '../../utils/db';

interface CalendarViewProps {
  subjects: Subject[];
  records: AttendanceRecord[];
  onLogAttendance: (subjectId: string, date: string, status: 'attended' | 'bunked' | 'cancelled') => void;
  onDeleteRecord: (recordId: string) => void;
  onRefreshNotifications?: () => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export default function CalendarView({
  subjects,
  records,
  onLogAttendance,
  onDeleteRecord,
  onRefreshNotifications,
  onScroll,
}: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Active section selection
  const [activeSection, setActiveSection] = useState<'classes' | 'assignments' | 'exams'>('classes');

  // Database-backed states
  const [exams, setExams] = useState<Exam[]>(() => db.getExams());
  const [assignments, setAssignments] = useState<Assignment[]>(() => db.getAssignments());

  // Modal triggers
  const [showAddAssignmentModal, setShowAddAssignmentModal] = useState<boolean>(false);
  const [showAddExamModal, setShowAddExamModal] = useState<boolean>(false);

  // New assignment form states
  const [newAssignSubjectId, setNewAssignSubjectId] = useState<string>('');
  const [newAssignTitle, setNewAssignTitle] = useState<string>('');
  const [newAssignDueDate, setNewAssignDueDate] = useState<string>(selectedDateStr);
  const [newAssignDueTime, setNewAssignDueTime] = useState<string>('');
  const [newAssignDesc, setNewAssignDesc] = useState<string>('');

  // New exam form states
  const [newExamSubjectId, setNewExamSubjectId] = useState<string>('');
  const [newExamTitle, setNewExamTitle] = useState<string>('');
  const [newExamDate, setNewExamDate] = useState<string>(selectedDateStr);
  const [newExamTime, setNewExamTime] = useState<string>('');
  const [newExamRoom, setNewExamRoom] = useState<string>('');
  const [newExamSyllabus, setNewExamSyllabus] = useState<string>('');

  // Parse year/month details
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Helper: get list of days in the month
  const getDaysInMonth = (y: number, m: number) => {
    return new Date(y, m + 1, 0).getDate();
  };

  // Helper: get day of week of the 1st of the month
  const getFirstDayOfMonth = (y: number, m: number) => {
    return new Date(y, m, 1).getDay();
  };

  const totalDays = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    triggerHaptic('medium');
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    triggerHaptic('medium');
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Get records for a specific date
  const getRecordsForDate = (dateStr: string) => {
    return records.filter(r => r.date === dateStr);
  };

  // Get subjects scheduled on selected date's day of week, parsing in local time to avoid timezone offset shifts
  const [selYear, selMonth, selDay] = selectedDateStr.split('-').map(Number);
  const selectedDateObj = new Date(selYear, selMonth - 1, selDay);
  const selectedDayOfWeek = selectedDateObj.getDay();

  const scheduledSubjectsOnSelectedDate = subjects
    .flatMap(sub => 
      sub.schedule
        .filter(sch => sch.dayOfWeek === selectedDayOfWeek)
        .map(sch => ({ subject: sub, schedule: sch }))
    )
    .sort((a, b) => compareTimeStrings(a.schedule.time, b.schedule.time));

  // Handle manual extra lecture addition dialog
  const [showAddExtraModal, setShowAddExtraModal] = useState<boolean>(false);
  const [extraSubjId, setExtraSubjId] = useState<string>(subjects[0]?.id || '');
  const [extraStatus, setExtraStatus] = useState<'attended' | 'bunked' | 'cancelled'>('attended');

  const handleAddExtraLecture = () => {
    if (!extraSubjId) return;
    triggerHaptic('success');
    onLogAttendance(extraSubjId, selectedDateStr, extraStatus);
    setShowAddExtraModal(false);
  };

  // Submit new assignment
  const handleAddAssignmentSubmit = () => {
    const subjId = newAssignSubjectId || subjects[0]?.id;
    if (!newAssignTitle || !subjId) {
      triggerHaptic('error');
      return;
    }
    
    const subject = subjects.find(s => s.id === subjId);
    const newAssign: Assignment = {
      id: `assign-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      subjectId: subjId,
      title: newAssignTitle,
      dueDate: newAssignDueDate,
      dueTime: newAssignDueTime || undefined,
      description: newAssignDesc || undefined,
      status: 'pending'
    };

    triggerHaptic('success');
    const updated = [...assignments, newAssign];
    setAssignments(updated);
    db.saveAssignments(updated);

    // Save automatic system notification
    db.addNotification(
      `New Task Added: ${newAssignTitle} 📝`,
      `Due on ${newAssignDueDate}${newAssignDueTime ? ` at ${newAssignDueTime}` : ''} for ${subject?.name || 'course'}.`,
      'success'
    );
    onRefreshNotifications?.();

    // Reset fields & close
    setNewAssignTitle('');
    setNewAssignDueTime('');
    setNewAssignDesc('');
    setShowAddAssignmentModal(false);
  };

  // Toggle completion of assignment
  const handleToggleAssignmentStatus = (id: string) => {
    triggerHaptic('medium');
    const updated = assignments.map(a => {
      if (a.id === id) {
        const nextStatus = a.status === 'completed' ? 'pending' as const : 'completed' as const;
        if (nextStatus === 'completed') {
          db.addNotification(
            'Task Completed! 🎉',
            `You cleared "${a.title}". Keep it up! 🚀`,
            'success'
          );
          onRefreshNotifications?.();
        }
        return { ...a, status: nextStatus };
      }
      return a;
    });
    setAssignments(updated);
    db.saveAssignments(updated);
  };

  // Delete assignment
  const handleDeleteAssignment = (id: string) => {
    triggerHaptic('heavy');
    const updated = assignments.filter(a => a.id !== id);
    setAssignments(updated);
    db.saveAssignments(updated);
  };

  // Submit new exam
  const handleAddExamSubmit = () => {
    const subjId = newExamSubjectId || subjects[0]?.id;
    if (!newExamTitle || !subjId) {
      triggerHaptic('error');
      return;
    }

    const subject = subjects.find(s => s.id === subjId);
    const newExam: Exam = {
      id: `exam-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      subjectId: subjId,
      title: newExamTitle,
      date: newExamDate,
      time: newExamTime || undefined,
      room: newExamRoom || undefined,
      syllabus: newExamSyllabus || undefined,
      completed: false
    };

    triggerHaptic('success');
    const updated = [...exams, newExam];
    setExams(updated);
    db.saveExams(updated);

    db.addNotification(
      `New Exam Scheduled: ${newExamTitle} 🎯`,
      `Exam date: ${newExamDate}${newExamTime ? ` at ${newExamTime}` : ''} in room ${newExamRoom || 'TBA'} for ${subject?.name || 'course'}.`,
      'danger'
    );
    onRefreshNotifications?.();

    // Reset fields & close
    setNewExamTitle('');
    setNewExamTime('');
    setNewExamRoom('');
    setNewExamSyllabus('');
    setShowAddExamModal(false);
  };

  // Delete exam
  const handleDeleteExam = (id: string) => {
    triggerHaptic('heavy');
    const updated = exams.filter(e => e.id !== id);
    setExams(updated);
    db.saveExams(updated);
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32 select-none space-y-5" onScroll={onScroll}>
      {/* View Title */}
      <div>
        <span className="text-xs font-bold text-zinc-500 font-mono uppercase tracking-wider">
          Attendance Calendar
        </span>
        <h2 className="text-2xl font-display font-extrabold text-white tracking-tight flex items-center">
          Schedule Logs <CalendarIcon className="w-5 h-5 ml-1.5 text-indigo-400" />
        </h2>
      </div>

      {/* Calendar widget */}
      <div className="glass-card p-4 border border-white/5 space-y-4">
        {/* Calendar Header */}
        <div className="flex justify-between items-center px-2">
          <span className="font-display font-bold text-white text-lg">
            {monthNames[month]} {year}
          </span>
          <div className="flex space-x-2">
            <button
              onClick={prevMonth}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 rounded-full transition cursor-pointer border border-zinc-800/80"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-355 rounded-full transition cursor-pointer border border-zinc-800/80"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Days of week */}
        <div className="grid grid-cols-7 gap-y-2 text-center">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
            <span key={idx} className="text-xs font-bold text-zinc-500">
              {day}
            </span>
          ))}

          {/* Render blank space for days of prev month */}
          {Array.from({ length: firstDayIndex }).map((_, idx) => (
            <div key={`blank-${idx}`} className="h-10" />
          ))}

          {/* Render days of current month */}
          {Array.from({ length: totalDays }).map((_, idx) => {
            const dayNum = idx + 1;
            const dayDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isSelected = selectedDateStr === dayDateStr;
            const isToday = new Date().toISOString().split('T')[0] === dayDateStr;

            // Gather records for this day to show small colored visual dots
            const dayRecords = getRecordsForDate(dayDateStr);

            // Find scheduled subjects for this day of week
            const calDateObj = new Date(year, month, dayNum);
            const calDayOfWeek = calDateObj.getDay();
            const dayScheduled = subjects.filter(sub => 
              sub.schedule.some(sch => sch.dayOfWeek === calDayOfWeek)
            );

            // Check if there are assignments or exams on this day
            const dayHasAssignments = assignments.some(a => a.dueDate === dayDateStr && a.status === 'pending');
            const dayHasExams = exams.some(e => e.date === dayDateStr);

            return (
              <button
                key={dayNum}
                onClick={() => {
                  triggerHaptic('light');
                  setSelectedDateStr(dayDateStr);
                  setNewAssignDueDate(dayDateStr);
                  setNewExamDate(dayDateStr);
                }}
                className={`h-11 rounded-2xl flex flex-col items-center justify-center relative cursor-pointer transition ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/15 font-bold'
                    : isToday
                      ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/30 font-bold'
                      : 'hover:bg-zinc-900 text-zinc-300'
                }`}
              >
                <span className="text-sm relative">
                  {dayNum}
                  {(dayHasAssignments || dayHasExams) && (
                    <span className={`absolute -top-1 -right-2.5 w-1.5 h-1.5 rounded-full ${
                      dayHasExams ? 'bg-rose-500 animate-pulse' : 'bg-indigo-500'
                    }`} />
                  )}
                </span>
                
                {/* Dots indicators for records or scheduled classes */}
                {dayRecords.length > 0 ? (
                  <div className="flex justify-center space-x-0.5 absolute bottom-1.5 w-full px-1">
                    {dayRecords.slice(0, 4).map(rec => {
                      const sub = subjects.find(s => s.id === rec.subjectId);
                      return (
                        <span
                          key={rec.id}
                          className="w-1.5 h-1.5 rounded-full"
                          style={{
                            backgroundColor: rec.status === 'cancelled' 
                              ? '#52525B' // zinc-600
                              : sub?.color || '#6366F1'
                          }}
                        />
                      );
                    })}
                  </div>
                ) : (
                  dayScheduled.length > 0 && (
                    <div className="flex justify-center space-x-0.5 absolute bottom-1.5 w-full px-1">
                      {dayScheduled.slice(0, 4).map(sub => (
                        <span
                          key={sub.id}
                          className="w-1.5 h-1.5 rounded-full border border-current opacity-60"
                          style={{
                            borderColor: sub.color,
                            color: sub.color,
                            backgroundColor: isSelected ? 'transparent' : 'rgba(0,0,0,0.4)'
                          }}
                        />
                      ))}
                    </div>
                  )
                )}
              </button>
            );
          })}
        </div>

        {/* Subtle Indicators Legend */}
        <div className="flex justify-center items-center space-x-4 pt-3.5 border-t border-zinc-900 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-650 shrink-0" />
            <span>Logged Record</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full border border-zinc-650 shrink-0" />
            <span>Scheduled Class</span>
          </div>
        </div>

      </div>

      {/* Segmented Control Tabs */}
      <div className="bg-zinc-900 p-1 rounded-2xl grid grid-cols-3 gap-1">
        <button
          onClick={() => { triggerHaptic('light'); setActiveSection('classes'); }}
          className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1 ${
            activeSection === 'classes'
              ? 'bg-zinc-800 text-white shadow-xs'
              : 'text-zinc-500 hover:text-zinc-350'
          }`}
        >
          <span>⏰ Classes</span>
          <span className="text-[10px] bg-zinc-950 text-zinc-400 px-1.5 py-0.5 rounded-full font-mono scale-90">
            {scheduledSubjectsOnSelectedDate.length || 0}
          </span>
        </button>
        <button
          onClick={() => { triggerHaptic('light'); setActiveSection('assignments'); }}
          className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1 ${
            activeSection === 'assignments'
              ? 'bg-zinc-800 text-indigo-400 shadow-xs'
              : 'text-zinc-500 hover:text-zinc-350'
          }`}
        >
          <span>📝 Tasks</span>
          {assignments.filter(a => a.dueDate === selectedDateStr && a.status === 'pending').length > 0 && (
            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
          )}
          <span className="text-[10px] bg-indigo-950/50 text-indigo-400 px-1.5 py-0.5 rounded-full font-mono scale-90 font-bold border border-indigo-900/30">
            {assignments.filter(a => a.dueDate === selectedDateStr).length || 0}
          </span>
        </button>
        <button
          onClick={() => { triggerHaptic('light'); setActiveSection('exams'); }}
          className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1 ${
            activeSection === 'exams'
              ? 'bg-zinc-800 text-rose-400 shadow-xs'
              : 'text-zinc-500 hover:text-zinc-350'
          }`}
        >
          <span>🎯 Exams</span>
          <span className="text-[10px] bg-rose-955/20 text-rose-455 px-1.5 py-0.5 rounded-full font-mono scale-90 font-bold border border-rose-900/30">
            {exams.filter(e => e.date === selectedDateStr).length || 0}
          </span>
        </button>
      </div>

      {/* Selected Date logs list */}
      <div className="space-y-3">
        {activeSection === 'classes' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-display font-bold text-white">
                {new Date(selectedDateStr).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric'
                })}
              </h3>
              <button
                onClick={() => { triggerHaptic('light'); setShowAddExtraModal(true); }}
                className="text-xs text-indigo-405 bg-indigo-950/40 border border-indigo-900/30 hover:bg-indigo-900/30 font-bold px-3 py-1.5 rounded-full flex items-center transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> Extra Class
              </button>
            </div>

            {/* Display scheduled classes and existing logs */}
            <div className="space-y-3">
              {/* Scheduled classes scheduled on this day of week */}
              {scheduledSubjectsOnSelectedDate.length === 0 && getRecordsForDate(selectedDateStr).length === 0 ? (
                <div className="p-8 bg-zinc-950/40 border border-dashed border-zinc-800 rounded-3xl text-center space-y-2">
                  <CalendarIcon className="w-8 h-8 text-zinc-700 mx-auto" />
                  <p className="text-sm font-semibold text-zinc-300">No scheduled classes or logs</p>
                  <p className="text-xs text-zinc-500">Tap "Extra Class" if you attended a makeup session on this date.</p>
                </div>
              ) : (
                <>
                  {/* Combine scheduled classes and current logs visually */}
                  {subjects.map(subject => {
                    const dayRecords = getRecordsForDate(selectedDateStr).filter(r => r.subjectId === subject.id);
                    const isScheduled = subject.schedule.some(sch => sch.dayOfWeek === selectedDayOfWeek);
                    
                    // If not scheduled AND has no records logged, don't show it in standard list to avoid clutter
                    if (!isScheduled && dayRecords.length === 0) return null;

                    return (
                      <div
                        key={subject.id}
                        className="glass-card p-4 shadow-2xs flex flex-col space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex items-center space-x-2">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
                            <div>
                              <h4 className="text-sm font-display font-bold text-zinc-150">
                                {subject.name}
                              </h4>
                              <p className="text-[10px] text-zinc-500 font-mono">
                                {isScheduled ? 'Scheduled Session' : 'Extra Session'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Log status display & edit buttons */}
                        <div>
                          {dayRecords.length > 0 ? (
                            <div className="space-y-2">
                              {dayRecords.map(rec => (
                                <div key={rec.id} className="flex justify-between items-center bg-zinc-900/40 border border-zinc-900/50 px-3 py-2 rounded-xl">
                                  <span className="text-xs text-zinc-500 font-semibold flex items-center">
                                    <Clock className="w-3.5 h-3.5 mr-1 text-zinc-500" />
                                    {new Date(rec.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                  </span>
                                  <div className="flex items-center space-x-2">
                                    <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                                      rec.status === 'attended'
                                        ? 'bg-emerald-955/20 text-emerald-400 border border-emerald-900/30'
                                        : rec.status === 'bunked'
                                          ? 'bg-rose-955/20 text-rose-455 border border-rose-900/30'
                                          : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                                    }`}>
                                      {rec.status}
                                    </span>
                                    <button
                                      onClick={() => { triggerHaptic('heavy'); onDeleteRecord(rec.id); }}
                                      className="p-1 text-zinc-500 hover:text-rose-400 rounded transition cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex space-x-2 pt-1.5">
                              <button
                                onClick={() => { triggerHaptic('success'); onLogAttendance(subject.id, selectedDateStr, 'attended'); }}
                                className="flex-1 py-1.5 bg-emerald-955/20 hover:bg-emerald-900/45 text-emerald-400 border border-emerald-900/30 rounded-xl text-xs font-bold transition cursor-pointer"
                              >
                                Attend
                              </button>
                              <button
                                onClick={() => { triggerHaptic('error'); onLogAttendance(subject.id, selectedDateStr, 'bunked'); }}
                                className="flex-1 py-1.5 bg-rose-955/20 hover:bg-rose-900/45 text-rose-400 border border-rose-900/30 rounded-xl text-xs font-bold transition cursor-pointer"
                              >
                                Bunk
                              </button>
                              <button
                                onClick={() => { triggerHaptic('medium'); onLogAttendance(subject.id, selectedDateStr, 'cancelled'); }}
                                className="flex-1 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 border border-zinc-800 rounded-xl text-xs font-bold transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        )}

        {activeSection === 'assignments' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-display font-bold text-white flex items-center">
                <FileText className="w-4 h-4 mr-1.5 text-indigo-400" />
                Tasks Due: {new Date(selectedDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </h3>
              <button
                onClick={() => { triggerHaptic('light'); setShowAddAssignmentModal(true); }}
                className="text-xs text-indigo-405 bg-indigo-955/20 border border-indigo-900/30 hover:bg-indigo-900/30 font-bold px-3 py-1.5 rounded-full flex items-center transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> New Task
              </button>
            </div>

            {/* List assignments due today */}
            <div className="space-y-3">
              {assignments.filter(a => a.dueDate === selectedDateStr).length === 0 ? (
                <div className="p-8 bg-zinc-955/40 border border-dashed border-zinc-800 rounded-3xl text-center space-y-1">
                  <span className="text-lg">🎉</span>
                  <p className="text-sm font-semibold text-zinc-300">No tasks due on this date</p>
                  <p className="text-xs text-zinc-500">All quiet. Perfect time to get ahead!</p>
                </div>
              ) : (
                assignments.filter(a => a.dueDate === selectedDateStr).map(assign => {
                  const subject = subjects.find(s => s.id === assign.subjectId);
                  const isCompleted = assign.status === 'completed';
                  return (
                    <div
                      key={assign.id}
                      className={`glass-card p-4 flex items-start space-x-3 transition-all ${
                        isCompleted ? 'border-emerald-900/30 bg-emerald-950/20' : 'border-white/5'
                      }`}
                    >
                      <button
                        onClick={() => handleToggleAssignmentStatus(assign.id)}
                        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center transition cursor-pointer shrink-0 ${
                          isCompleted ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-700 hover:border-zinc-650 bg-zinc-900'
                        }`}
                      >
                        {isCompleted && <CheckCircle className="w-4 h-4" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          {subject && (
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: subject.color }} />
                          )}
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide truncate">
                            {subject?.name || 'General Task'}
                          </span>
                        </div>
                        <h4 className={`text-sm font-display font-bold text-zinc-150 ${isCompleted ? 'line-through text-zinc-500' : ''}`}>
                          {assign.title}
                        </h4>
                        {assign.dueTime && (
                          <span className="inline-flex items-center text-[10px] text-indigo-400 bg-indigo-955/20 border border-indigo-900/30 font-bold px-2 py-0.5 rounded-md mt-1 font-mono">
                            <Clock className="w-3 h-3 mr-1" /> {assign.dueTime}
                          </span>
                        )}
                        {assign.description && (
                          <p className="text-xs text-zinc-400 mt-1.5 bg-zinc-900/40 border border-zinc-900/50 p-2 rounded-xl">
                            {assign.description}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteAssignment(assign.id)}
                        className="p-1 text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Other Pending Assignments */}
            {assignments.filter(a => a.dueDate !== selectedDateStr && a.status === 'pending').length > 0 && (
              <div className="space-y-3 pt-4 border-t border-zinc-900">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Other Pending Tasks
                </h4>
                <div className="space-y-2.5">
                  {assignments
                    .filter(a => a.dueDate !== selectedDateStr && a.status === 'pending')
                    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                    .map(assign => {
                      const subject = subjects.find(s => s.id === assign.subjectId);
                      const assignDate = new Date(assign.dueDate);
                      return (
                        <div
                          key={assign.id}
                          className="glass-card p-3.5 border border-white/5 flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <button
                              onClick={() => handleToggleAssignmentStatus(assign.id)}
                              className="w-4.5 h-4.5 rounded border border-zinc-800 hover:border-zinc-700 bg-zinc-900 flex items-center justify-center cursor-pointer shrink-0"
                            >
                              <Square className="w-3.5 h-3.5 text-transparent" />
                            </button>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-zinc-150 truncate">
                                {assign.title}
                              </h5>
                              <div className="flex items-center space-x-1.5 mt-0.5">
                                {subject && (
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subject.color }} />
                                )}
                                <span className="text-[9px] text-zinc-500 truncate">
                                  {subject?.name || 'General Task'} • Due {assignDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => { triggerHaptic('light'); setSelectedDateStr(assign.dueDate); }}
                            className="text-[9px] font-bold text-indigo-400 hover:bg-indigo-950/45 px-2 py-1 rounded-md cursor-pointer shrink-0"
                          >
                            Go to Date
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === 'exams' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-display font-bold text-white flex items-center">
                <Award className="w-4.5 h-4.5 mr-1.5 text-rose-455" />
                Exams: {new Date(selectedDateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </h3>
              <button
                onClick={() => { triggerHaptic('light'); setShowAddExamModal(true); }}
                className="text-xs text-rose-455 bg-rose-955/20 border border-rose-900/30 hover:bg-rose-900/30 font-bold px-3 py-1.5 rounded-full flex items-center transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 mr-1" /> New Exam
              </button>
            </div>

            {/* List exams scheduled today */}
            <div className="space-y-3">
              {exams.filter(e => e.date === selectedDateStr).length === 0 ? (
                <div className="p-8 bg-zinc-955/40 border border-dashed border-zinc-800 rounded-3xl text-center space-y-1">
                  <span className="text-lg">🧘‍♂️</span>
                  <p className="text-sm font-semibold text-zinc-300">No exams on this date</p>
                  <p className="text-xs text-zinc-500 font-medium">Enjoy the relaxed schedule!</p>
                </div>
              ) : (
                exams.filter(e => e.date === selectedDateStr).map(exam => {
                  const subject = subjects.find(s => s.id === exam.subjectId);
                  return (
                    <div
                      key={exam.id}
                      className="glass-card p-4 border border-white/5 flex items-start justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-1.5">
                          {subject && (
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: subject.color }} />
                          )}
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">
                            {subject?.name || 'Exam'}
                          </span>
                        </div>
                        <h4 className="text-sm font-display font-bold text-zinc-150">
                          {exam.title}
                        </h4>
                        
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {exam.time && (
                            <span className="inline-flex items-center text-[10px] text-zinc-400 bg-zinc-900/40 border border-zinc-900/50 px-2.5 py-0.5 rounded-md font-mono">
                              <Clock className="w-3 h-3 mr-1 text-zinc-500" /> {exam.time}
                            </span>
                          )}
                          {exam.room && (
                            <span className="inline-flex items-center text-[10px] text-rose-455 bg-rose-955/20 border border-rose-900/30 px-2.5 py-0.5 rounded-md font-mono font-bold">
                              <MapPin className="w-3 h-3 mr-1 text-rose-500" /> Room {exam.room}
                            </span>
                          )}
                        </div>

                        {exam.syllabus && (
                          <div className="text-xs text-zinc-400 mt-2 bg-zinc-900/40 border border-zinc-900/50 p-2.5 rounded-xl">
                            <span className="font-bold text-[10px] text-zinc-500 uppercase block tracking-wider mb-0.5">Syllabus / Notes</span>
                            {exam.syllabus}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteExam(exam.id)}
                        className="p-1 text-zinc-500 hover:text-rose-400 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Other Upcoming Exams */}
            {exams.filter(e => e.date !== selectedDateStr).length > 0 && (
              <div className="space-y-3 pt-4 border-t border-zinc-900">
                <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Upcoming Exam Calendar
                </h4>
                <div className="space-y-2.5">
                  {exams
                    .filter(e => e.date !== selectedDateStr)
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(exam => {
                      const subject = subjects.find(s => s.id === exam.subjectId);
                      const examDate = new Date(exam.date);
                      return (
                        <div
                          key={exam.id}
                          className="glass-card p-3.5 border border-white/5 flex items-center justify-between"
                        >
                          <div className="min-w-0">
                            <h5 className="text-xs font-bold text-zinc-150 truncate">
                              {exam.title}
                            </h5>
                            <div className="flex items-center space-x-1.5 mt-0.5">
                              {subject && (
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: subject.color }} />
                              )}
                              <span className="text-[9px] text-zinc-500 truncate">
                                {subject?.name || 'General Exam'} • {examDate.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                {exam.room ? ` • Rm ${exam.room}` : ''}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => { triggerHaptic('light'); setSelectedDateStr(exam.date); }}
                            className="text-[9px] font-bold text-indigo-400 hover:bg-indigo-955/40 px-2 py-1 rounded-md cursor-pointer"
                          >
                            Go to Date
                          </button>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Makeup Lecture Slide-In Overlay */}
      {showAddExtraModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-card p-6 w-full max-w-[340px] shadow-2xl border border-white/5 space-y-4"
          >
            <h3 className="text-base font-display font-bold text-white">
              Log Extra Class
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                  Select Course
                </label>
                <select
                  value={extraSubjId}
                  onChange={e => setExtraSubjId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none"
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id} className="bg-zinc-900 text-white">{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                  Attendance Status
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['attended', 'bunked', 'cancelled'] as const).map(status => {
                    const isActive = extraStatus === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setExtraStatus(status); }}
                        className={`py-2 rounded-xl text-[10px] font-bold uppercase transition border ${
                          isActive
                            ? status === 'attended'
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : status === 'bunked'
                                ? 'bg-rose-500 border-rose-500 text-white'
                                : 'bg-zinc-650 border-zinc-650 text-white'
                            : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                        }`}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setShowAddExtraModal(false); }}
                className="flex-1 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-xl transition cursor-pointer border border-zinc-800/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddExtraLecture}
                className="flex-1 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition cursor-pointer"
              >
                Save Log
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Assignment Modal */}
      {showAddAssignmentModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-card p-6 w-full max-w-[340px] shadow-2xl border border-white/5 space-y-4"
          >
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-display font-bold text-white">
                New Task Deadline
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                  Select Course
                </label>
                <select
                  value={newAssignSubjectId}
                  onChange={e => setNewAssignSubjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="" className="bg-zinc-900 text-zinc-400">-- Choose Course --</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id} className="bg-zinc-900 text-white">{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lab Report 3, Essay Submission"
                  value={newAssignTitle}
                  onChange={e => setNewAssignTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none placeholder-zinc-650"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={newAssignDueDate}
                    onChange={e => setNewAssignDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                    Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={newAssignDueTime}
                    onChange={e => setNewAssignDueTime(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                  Description / Notes (Optional)
                </label>
                <textarea
                  placeholder="e.g. Submit PDF on classroom portal"
                  value={newAssignDesc}
                  onChange={e => setNewAssignDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none resize-none placeholder-zinc-650"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setShowAddAssignmentModal(false); }}
                className="flex-1 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-355 rounded-xl transition cursor-pointer border border-zinc-800/85"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddAssignmentSubmit}
                className="flex-1 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition cursor-pointer"
              >
                Save Task
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Add Exam Modal */}
      {showAddExamModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="glass-card p-6 w-full max-w-[340px] shadow-2xl border border-white/5 space-y-4"
          >
            <div className="flex items-center space-x-2">
              <Award className="w-5 h-5 text-rose-455" />
              <h3 className="text-base font-display font-bold text-white">
                New Exam Date
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                  Select Course
                </label>
                <select
                  value={newExamSubjectId}
                  onChange={e => setNewExamSubjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none"
                >
                  <option value="" className="bg-zinc-900 text-zinc-400">-- Choose Course --</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id} className="bg-zinc-900 text-white">{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                  Exam Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Midterm 1, Final Theory Exam"
                  value={newExamTitle}
                  onChange={e => setNewExamTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none placeholder-zinc-650"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                    Exam Date
                  </label>
                  <input
                    type="date"
                    value={newExamDate}
                    onChange={e => setNewExamDate(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                    Time (Optional)
                  </label>
                  <input
                    type="time"
                    value={newExamTime}
                    onChange={e => setNewExamTime(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                  Room No / Hall (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Auditorium Hall C, Room 302"
                  value={newExamRoom}
                  onChange={e => setNewExamRoom(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none placeholder-zinc-650"
                />
              </div>

              <div>
                <label className="block text-[10px] font-extrabold text-zinc-500 uppercase mb-1">
                  Syllabus / Notes (Optional)
                </label>
                <textarea
                  placeholder="e.g. Unit 1 to 4, carry calculator"
                  value={newExamSyllabus}
                  onChange={e => setNewExamSyllabus(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold focus:outline-none resize-none placeholder-zinc-650"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setShowAddExamModal(false); }}
                className="flex-1 py-2 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-355 rounded-xl transition cursor-pointer border border-zinc-800/85"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddExamSubmit}
                className="flex-1 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-sm transition cursor-pointer"
              >
                Save Exam
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
