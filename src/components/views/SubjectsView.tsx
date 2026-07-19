import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BookOpen, Plus, Compass, Clock, MapPin, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Pin, Archive } from 'lucide-react';
import { Subject, AttendanceRecord } from '../../types';
import { calculateSubjectStats, triggerHaptic } from '../../utils/db';

interface SubjectsViewProps {
  subjects: Subject[];
  records: AttendanceRecord[];
  onSelectSubject: (subject: Subject) => void;
  onOpenAddSubject: () => void;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

export default function SubjectsView({
  subjects,
  records,
  onSelectSubject,
  onOpenAddSubject,
  onScroll,
}: SubjectsViewProps) {
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  const activeSubjects = subjects.filter(s => !s.isArchived);
  const archivedSubjects = subjects.filter(s => s.isArchived);

  const displayedSubjects = activeTab === 'active' ? activeSubjects : archivedSubjects;

  // Sorting: Pinned first, then alphabetically by name
  const sortedSubjects = [...displayedSubjects].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden h-full">
      {/* Scrollable list content */}
      <div className="flex-1 overflow-y-auto px-4 xs:px-5 pt-4 pb-32 select-none space-y-5" onScroll={onScroll}>
        {/* Page Title & Intro */}
        <div className="flex justify-between items-center">
          <div>
            <span className="text-xs font-bold text-zinc-500 font-mono uppercase tracking-wider">
              Curriculum Catalog
            </span>
            <h2 className="text-2xl font-display font-black text-white tracking-tight flex items-center">
              My Subjects <BookOpen className="w-5 h-5 ml-1.5 text-indigo-400" />
            </h2>
          </div>

          {/* Header Action Button */}
          <button
            onClick={() => { triggerHaptic('medium'); onOpenAddSubject(); }}
            className="text-xs text-white bg-indigo-600 hover:bg-indigo-700 font-bold px-3.5 py-2 rounded-full flex items-center transition cursor-pointer shadow-md shadow-indigo-600/10"
          >
            <Plus className="w-4 h-4 mr-1" /> Add Subject
          </button>
        </div>

        {/* Active vs Archived Selector Tabs */}
        {subjects.length > 0 && (
          <div className="flex bg-zinc-900 p-1 rounded-xl">
            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('active'); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'active'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-350'
              }`}
            >
              Active ({activeSubjects.length})
            </button>
            <button
              onClick={() => { triggerHaptic('light'); setActiveTab('archived'); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                activeTab === 'archived'
                  ? 'bg-zinc-800 text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-355'
              }`}
            >
              Archived ({archivedSubjects.length})
            </button>
          </div>
        )}

        {/* List of registered Subjects */}
        {displayedSubjects.length === 0 ? (
          <div className="py-16 px-6 glass-card text-center space-y-5 shadow-md">
            <div className="w-20 h-20 bg-indigo-950/40 text-indigo-400 rounded-full flex items-center justify-center mx-auto shadow-sm border border-indigo-900/30">
              <Compass className="w-10 h-10 animate-spin-slow" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-display font-black text-white">No subjects yet.</p>
              <p className="text-sm font-semibold text-zinc-500 max-w-[280px] mx-auto">
                {activeTab === 'active' 
                  ? 'Create your first subject to begin tracking.' 
                  : 'No archived courses found in your catalog.'}
              </p>
            </div>
            {activeTab === 'active' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { triggerHaptic('medium'); onOpenAddSubject(); }}
                className="py-3.5 px-8 bg-indigo-600 text-white font-bold rounded-2xl text-xs hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition mx-auto cursor-pointer"
              >
                Add Subject
              </motion.button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {sortedSubjects.map(subject => {
              const stats = calculateSubjectStats(subject, records);
              
              return (
                <div
                  key={subject.id}
                  onClick={() => { triggerHaptic('light'); onSelectSubject(subject); }}
                  className="glass-card p-4.5 shadow-md hover:border-white/15 transition duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden group"
                >
                  {/* Visual colored marker strip at the edge */}
                  <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: subject.color }} />

                  <div className="flex justify-between items-start pl-1">
                    <div className="flex-1 min-w-0 flex items-start space-x-3 pr-3 pl-1">
                      <div className="w-11 h-11 rounded-xl bg-zinc-900 flex items-center justify-center text-xl relative shrink-0 border border-zinc-800 shadow-2xs">
                        {subject.icon || '📚'}
                        {subject.isPinned && (
                          <span className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white p-0.5 rounded-full shadow-2xs">
                            <Pin className="w-2.5 h-2.5 fill-amber-650 text-white" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[10px] font-bold text-zinc-500 font-mono tracking-wider uppercase">
                            {subject.code || 'CS-SUBJECT'}
                          </span>
                          {subject.isPinned && (
                            <span className="text-[9px] bg-amber-950/40 text-amber-400 font-black px-1.5 py-0.2 rounded uppercase border border-amber-900/30">
                              Pinned
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-display font-extrabold text-zinc-100 tracking-tight leading-snug group-hover:text-indigo-400 transition break-words">
                          {subject.name}
                        </h3>
                        
                        <div className="flex flex-wrap gap-x-2.5 gap-y-1 text-[10px] font-semibold text-zinc-500 pt-0.5">
                          {subject.room && (
                            <span className="flex items-center">
                              <MapPin className="w-3 h-3 mr-0.5" />
                              {subject.room}
                            </span>
                          )}
                          {subject.schedule.length > 0 && (
                            <span className="flex items-center">
                              <Clock className="w-3 h-3 mr-0.5" />
                              {subject.schedule.length} Class{subject.schedule.length !== 1 && 'es'}/wk
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Percentage Circular / Rounded Widget */}
                    <div className="flex flex-col items-end shrink-0 pl-1">
                      <span className="text-2xl font-display font-black text-white">
                        {stats.totalLogged > 0 ? `${stats.percentage}%` : '0%'}
                      </span>
                      <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider">
                        Target {stats.target}%
                      </span>
                    </div>
                  </div>

                  {/* Subj Analytics Summary Banner */}
                  <div className="mt-4 pt-3 border-t border-zinc-900 pl-1 flex justify-between items-center">
                    <div className="text-xs font-bold">
                      {stats.status === 'safe' && (
                        <span className="text-emerald-400 flex items-center bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-900/30">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Safe bunk limit: <b>{stats.bunksAvailable}</b>
                        </span>
                      )}
                      {stats.status === 'borderline' && (
                        <span className="text-amber-400 flex items-center bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-900/30">
                          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                          Borderline! Bunks left: <b>{stats.bunksAvailable}</b>
                        </span>
                      )}
                      {stats.status === 'danger' && (
                        <span className="text-rose-455 flex items-center bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-900/30">
                          <XCircle className="w-3.5 h-3.5 mr-1" />
                          Danger! Must attend: <b>{stats.classesToAttend}</b>
                        </span>
                      )}
                      {stats.status === 'no_data' && (
                        <span className="text-zinc-500 flex items-center bg-zinc-900 px-2 py-0.5 rounded-md border border-zinc-800">
                          No lectures recorded yet
                        </span>
                      )}
                    </div>

                    <span className="text-indigo-400 hover:text-indigo-300 text-xs font-bold flex items-center transition group-hover:translate-x-1 duration-200">
                      Details <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => { triggerHaptic('medium'); onOpenAddSubject(); }}
        className="absolute bottom-5 right-5 w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition cursor-pointer z-10 border border-indigo-500/10"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
}
