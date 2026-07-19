import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, User, Check, RefreshCw, GraduationCap, BookOpen, School, ArrowRight, ArrowLeft, Clock } from 'lucide-react';
import { db, triggerHaptic } from '../../utils/db';
import { syncService } from '../../utils/syncService';

export interface AvatarItem {
  id: string;
  emoji: string;
  label: string;
  type: 'emoji' | 'gradient';
  from?: string;
  to?: string;
}

export const BUILTIN_AVATARS: AvatarItem[] = [
  // Premium Gradients
  { id: 'grad_indigo', emoji: '🔮', label: 'Indigo Dusk', type: 'gradient', from: 'from-indigo-500', to: 'to-purple-600' },
  { id: 'grad_emerald', emoji: '🌿', label: 'Emerald Mint', type: 'gradient', from: 'from-emerald-400', to: 'to-teal-605' },
  { id: 'grad_sunset', emoji: '🌅', label: 'Amber Sunset', type: 'gradient', from: 'from-orange-400', to: 'to-rose-600' },
  { id: 'grad_ocean', emoji: '🌊', label: 'Ocean Blue', type: 'gradient', from: 'from-cyan-400', to: 'to-blue-600' },
  { id: 'grad_crimson', emoji: '🔥', label: 'Crimson Glow', type: 'gradient', from: 'from-rose-500', to: 'to-pink-600' },
  { id: 'grad_neon', emoji: '⚡', label: 'Cyber Neon', type: 'gradient', from: 'from-purple-500', to: 'to-pink-500' },
  { id: 'grad_metal', emoji: '🪙', label: 'Slate Steel', type: 'gradient', from: 'from-zinc-500', to: 'to-slate-700' },
  { id: 'grad_cosmic', emoji: '🌌', label: 'Cosmic Violet', type: 'gradient', from: 'from-violet-600', to: 'to-fuchsia-805' },

  // Emojis (Classic)
  { id: 'student_boy', emoji: '👨‍🎓', label: 'Student Boy', type: 'emoji' },
  { id: 'student_girl', emoji: '👩‍🎓', label: 'Student Girl', type: 'emoji' },
  { id: 'programmer', emoji: '🧑‍💻', label: 'Programmer', type: 'emoji' },
  { id: 'gamer', emoji: '🎧', label: 'Gamer', type: 'emoji' },
  { id: 'nerd', emoji: '🤓', label: 'Nerd', type: 'emoji' },
  { id: 'cool_student', emoji: '😎', label: 'Cool Student', type: 'emoji' },
  { id: 'fox', emoji: '🦊', label: 'Fox', type: 'emoji' },
  { id: 'panda', emoji: '🐼', label: 'Panda', type: 'emoji' },
  { id: 'robot', emoji: '🤖', label: 'Robot', type: 'emoji' },
  { id: 'penguin', emoji: '🐧', label: 'Penguin', type: 'emoji' },
  { id: 'bear', emoji: '🐻', label: 'Bear', type: 'emoji' },
  { id: 'lion', emoji: '🦁', label: 'Lion', type: 'emoji' },
  { id: 'koala', emoji: '🐨', label: 'Koala', type: 'emoji' },
  { id: 'owl', emoji: '🦉', label: 'Owl', type: 'emoji' },
  { id: 'cat', emoji: '🐱', label: 'Cat', type: 'emoji' },
  { id: 'bunny', emoji: '🐰', label: 'Bunny', type: 'emoji' },
  { id: 'unicorn', emoji: '🦄', label: 'Unicorn', type: 'emoji' },
  { id: 'astronaut', emoji: '🚀', label: 'Astronaut', type: 'emoji' },
  { id: 'artist', emoji: '🎨', label: 'Artist', type: 'emoji' },
  { id: 'bookworm', emoji: '📚', label: 'Bookworm', type: 'emoji' },
  { id: 'creator', emoji: '🧑‍🎨', label: 'Creator', type: 'emoji' },
  { id: 'dino', emoji: '🦖', label: 'Dino', type: 'emoji' },
  { id: 'ghost', emoji: '👻', label: 'Ghost', type: 'emoji' },
  { id: 'tiger', emoji: '🐯', label: 'Tiger', type: 'emoji' },
  { id: 'hamster', emoji: '🐹', label: 'Hamster', type: 'emoji' },
  { id: 'monkey', emoji: '🐵', label: 'Monkey', type: 'emoji' },
  { id: 'frog', emoji: '🐸', label: 'Frog', type: 'emoji' },
  { id: 'octopus', emoji: '🐙', label: 'Octopus', type: 'emoji' },
  { id: 'dog', emoji: '🐶', label: 'Dog', type: 'emoji' },
  { id: 'alien', emoji: '🛸', label: 'Alien', type: 'emoji' }
];

export const getAvatarEmoji = (avatarId?: string): string => {
  const found = BUILTIN_AVATARS.find(a => a.id === avatarId);
  return found ? found.emoji : '👨‍🎓';
};

export const getInitials = (name?: string): string => {
  if (!name) return 'ST';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return 'ST';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export const renderAvatar = (avatarId?: string, displayName?: string, sizeClass = 'w-12 h-12 text-lg') => {
  const avatar = BUILTIN_AVATARS.find(a => a.id === avatarId) || BUILTIN_AVATARS[0];
  if (avatar && avatar.type === 'gradient') {
    const initials = getInitials(displayName);
    return (
      <div className={`${sizeClass} rounded-full bg-gradient-to-br ${avatar.from} ${avatar.to} flex items-center justify-center font-display font-black text-white shadow-inner tracking-wider border border-white/10 shrink-0 select-none`}>
        {initials}
      </div>
    );
  }
  return (
    <div className={`${sizeClass} rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shadow-inner relative text-center shrink-0 select-none`}>
      <span className="leading-none" style={{ fontSize: '110%' }}>{avatar ? avatar.emoji : '👨‍🎓'}</span>
    </div>
  );
};

interface CompleteProfileModalProps {
  onClose: () => void;
  onSave?: () => void;
}

export default function CompleteProfileModal({ onClose, onSave }: CompleteProfileModalProps) {
  const prefs = db.getPrefs();
  const [step, setStep] = useState<1 | 2>(1);
  
  // Step 1: Personal Profile
  const [displayName, setDisplayName] = useState(prefs.displayName || '');
  const [selectedAvatarId, setSelectedAvatarId] = useState(prefs.avatarId || 'grad_indigo');
  
  // Step 2: Academic Details
  const [collegeName, setCollegeName] = useState(prefs.collegeName || '');
  const [major, setMajor] = useState(prefs.major || '');
  const [course, setCourse] = useState(prefs.course || '');
  const [semester, setSemester] = useState(prefs.semester || '');
  const [section, setSection] = useState(prefs.section || '');
  const [group, setGroup] = useState(prefs.group || '');
  
  const [isSaving, setIsSaving] = useState(false);

  const username = prefs.syncUsername || 'student';
  const subjectsCount = db.getSubjects().length || 0;

  const handleNextStep = () => {
    if (!displayName.trim()) {
      triggerHaptic('error');
      alert('Please enter a display name');
      return;
    }
    triggerHaptic('medium');
    setStep(2);
  };

  const handlePrevStep = () => {
    triggerHaptic('medium');
    setStep(1);
  };

  const handleClose = async () => {
    triggerHaptic('light');
    const currentPrefs = db.getPrefs();
    if (!currentPrefs.profilePrompted) {
      await db.savePrefs({
        ...currentPrefs,
        profilePrompted: true
      });
    }
    onClose();
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      triggerHaptic('error');
      alert('Please enter a display name');
      return;
    }

    setIsSaving(true);
    triggerHaptic('heavy');

    try {
      const updatedPrefs = {
        ...db.getPrefs(),
        displayName: displayName.trim(),
        avatarId: selectedAvatarId,
        collegeName: collegeName.trim(),
        major: major.trim(),
        course: course.trim(),
        semester: semester.trim(),
        section: section.trim(),
        group: group.trim(),
        profilePrompted: true
      };
      
      // Save locally to Settings
      await db.savePrefs(updatedPrefs);
      
      // Close the modal immediately so it pops down!
      if (onSave) onSave();
      onClose();

      // Force immediate sync to server in background if sync is enabled
      if (prefs.syncEnabled && prefs.syncToken) {
        syncService.performSync().catch(console.error);
      }
    } catch (err) {
      console.error(err);
      if (onSave) onSave();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const groupSuggestions = ['G1', 'G2', 'G3', 'Batch A', 'Batch B', 'A', 'B'];

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-[440px] bg-zinc-950 rounded-t-[32px] shadow-2xl flex flex-col h-[94%] overflow-hidden border-t border-zinc-900 text-white"
      >
        {/* Header with Progress Bar */}
        <div className="flex flex-col pt-3 pb-4 px-6 border-b border-zinc-900 flex-shrink-0">
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full mb-3 self-center" />
          <div className="flex justify-between items-center w-full mb-3">
            <div>
              <h3 className="text-xl font-display font-black text-white tracking-tight flex items-center">
                <Sparkles className="w-5 h-5 mr-1.5 text-indigo-400 animate-pulse" />
                {(!prefs.displayName || !prefs.avatarId) ? 'Set Up Profile Card' : 'Edit Profile Card'}
              </h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5">
                Step {step} of 2 • {step === 1 ? 'Personalize Profile' : 'Academic Details'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Animated Progress Bar */}
          <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-650"
              initial={{ width: '50%' }}
              animate={{ width: step === 1 ? '50%' : '100%' }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Scrollable Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
          
          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5 text-left"
              >
                {/* Welcome Card Banner for New Users */}
                {(!prefs.displayName || !prefs.avatarId) && (
                  <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-4 space-y-1">
                    <p className="text-xs font-black text-indigo-300 flex items-center">
                      <Sparkles className="w-4 h-4 mr-1 text-indigo-400 animate-pulse" /> Welcome to BunkMate!
                    </p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed font-semibold">
                      Let's set up your profile card. Classmates and bunkmates will see this when looking you up to share schedules or add you as a friend!
                    </p>
                  </div>
                )}

                {/* Display Name */}
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                    Display Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-zinc-500" />
                    <input
                      type="text"
                      maxLength={20}
                      value={displayName}
                      onChange={e => setDisplayName(e.target.value)}
                      placeholder="Enter display name..."
                      className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-sm font-bold placeholder:text-zinc-650 transition"
                    />
                  </div>
                </div>

                {/* Avatar Grid */}
                <div className="space-y-3">
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                    Choose Avatar or Gradient
                  </label>
                  <div className="grid grid-cols-5 gap-2.5 p-3.5 bg-zinc-900/40 border border-zinc-900 rounded-2xl max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    {BUILTIN_AVATARS.map(avatar => {
                      const isSelected = selectedAvatarId === avatar.id;
                      return (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => { triggerHaptic('light'); setSelectedAvatarId(avatar.id); }}
                          className={`aspect-square rounded-xl flex items-center justify-center transition-all relative ${
                            avatar.type === 'gradient'
                              ? `bg-gradient-to-br ${avatar.from} ${avatar.to} text-white font-display font-black text-xs`
                              : 'bg-zinc-900 border border-zinc-850 text-2xl'
                          } ${
                            isSelected 
                              ? 'ring-2 ring-indigo-500 scale-105 shadow-md shadow-indigo-650/30' 
                              : 'hover:bg-zinc-850 hover:scale-105'
                          }`}
                          title={avatar.label}
                        >
                          {avatar.type === 'gradient' ? (
                            getInitials(displayName)
                          ) : (
                            <span>{avatar.emoji}</span>
                          )}
                          {isSelected && (
                            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 border border-zinc-950">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-4 text-left"
              >
                {/* College / University Name */}
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                    College / University
                  </label>
                  <div className="relative">
                    <School className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-zinc-500" />
                    <input
                      type="text"
                      maxLength={50}
                      value={collegeName}
                      onChange={e => setCollegeName(e.target.value)}
                      placeholder="e.g. Amritsar Group of Colleges"
                      className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-sm font-bold placeholder:text-zinc-650 transition"
                    />
                  </div>
                </div>

                {/* Course Name */}
                <div className="space-y-2">
                  <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                    Course Name
                  </label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-zinc-500" />
                    <input
                      type="text"
                      maxLength={30}
                      value={course}
                      onChange={e => setCourse(e.target.value)}
                      placeholder="e.g. B.Tech"
                      className="w-full pl-11 pr-4 py-3 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-sm font-bold placeholder:text-zinc-650 transition"
                    />
                  </div>
                </div>

                {/* Major & Semester */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                      Department / Branch
                    </label>
                    <div className="relative">
                      <BookOpen className="absolute left-3 top-3.5 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        maxLength={30}
                        value={major}
                        onChange={e => setMajor(e.target.value)}
                        placeholder="e.g. Computer Science"
                        className="w-full pl-9 pr-3 py-3 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-xs font-bold placeholder:text-zinc-650 transition"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                      Semester / Year
                    </label>
                    <div className="relative">
                      <GraduationCap className="absolute left-3 top-3.5 w-4 h-4 text-zinc-500" />
                      <input
                        type="text"
                        maxLength={15}
                        value={semester}
                        onChange={e => setSemester(e.target.value)}
                        placeholder="e.g. 4"
                        className="w-full pl-9 pr-3 py-3 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-xs font-bold placeholder:text-zinc-650 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Section & Group */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                      Section
                    </label>
                    <input
                      type="text"
                      maxLength={10}
                      value={section}
                      onChange={e => setSection(e.target.value)}
                      placeholder="e.g. CS-1"
                      className="w-full px-3 py-3 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-xs font-bold placeholder:text-zinc-650 transition"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
                      Group / Batch
                    </label>
                    <input
                      type="text"
                      maxLength={15}
                      value={group}
                      onChange={e => setGroup(e.target.value)}
                      placeholder="e.g. G1"
                      className="w-full px-3 py-3 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 text-xs font-bold placeholder:text-zinc-650 transition"
                    />
                  </div>
                </div>

                {/* Quick Group Suggestion Tags */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-500">Quick Select Group / Batch</span>
                  <div className="flex flex-wrap gap-1.5">
                    {groupSuggestions.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => { triggerHaptic('light'); setGroup(tag); }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                          group === tag 
                            ? 'bg-indigo-950 border-indigo-500/35 text-indigo-400'
                            : 'bg-zinc-900 border-zinc-850 text-zinc-400 hover:border-zinc-750'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live Card Preview */}
          <div className="space-y-3">
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400 text-left">
              Card Preview
            </label>
            
            {/* Premium BunkMate Student ID Card */}
            <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950/40 via-zinc-900 to-zinc-950 border border-zinc-900 rounded-3xl p-5 shadow-xl space-y-4 text-left">
              {/* Decorative gradient overlay */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-black uppercase tracking-wider text-indigo-405 font-mono flex items-center">
                  <Sparkles className="w-3.5 h-3.5 mr-1 animate-pulse text-indigo-405" />
                  BunkMate Student ID
                </span>
                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  <span>Online</span>
                </span>
              </div>

              <div className="flex items-center space-x-4">
                {renderAvatar(selectedAvatarId, displayName, 'w-16 h-16 text-xl')}
                <div className="truncate flex-1">
                  <h4 className="text-lg font-black text-white leading-tight truncate">
                    {displayName.trim() || 'Your Name'}
                  </h4>
                  <span className="text-xs text-zinc-500 font-bold block mt-0.5">
                    @{username}
                  </span>
                </div>
              </div>

              <div className="border-t border-zinc-850/60 my-2" />

              {/* Grid of academic details */}
              <div className="grid grid-cols-2 gap-2 text-left pt-1">
                <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-855">
                  <span className="block text-[8px] font-black text-zinc-550 uppercase">College / University</span>
                  <span className="text-[10px] font-bold text-white truncate block">{collegeName || 'Not Set'}</span>
                </div>
                <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-855">
                  <span className="block text-[8px] font-black text-zinc-550 uppercase">Course & Branch</span>
                  <span className="text-[10px] font-bold text-white truncate block">
                    {course ? `${course} ${major ? `(${major})` : ''}` : (major || 'Not Set')}
                  </span>
                </div>
                <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-855">
                  <span className="block text-[8px] font-black text-zinc-550 uppercase">Semester / Year</span>
                  <span className="text-[10px] font-bold text-white truncate block">{semester || 'Not Set'}</span>
                </div>
                <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-855">
                  <span className="block text-[8px] font-black text-zinc-550 uppercase">Section & Group</span>
                  <span className="text-[10px] font-bold text-white truncate block">
                    {section || 'N/A'} • {group || 'N/A'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[9px] text-zinc-500 font-bold pt-1 border-t border-zinc-900/60">
                <span>Account Status</span>
                <span className="flex items-center text-zinc-450 font-mono text-[9px]">
                  <Clock className="w-3 h-3 mr-1 text-zinc-650" />
                  Synced just now
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer actions */}
        <div className="p-6 border-t border-zinc-900 bg-zinc-950 flex space-x-3 flex-shrink-0">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-3.5 text-zinc-400 bg-zinc-900 hover:bg-zinc-800 rounded-xl font-bold text-sm border border-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                className="flex-1 py-3.5 text-white bg-indigo-650 hover:bg-indigo-600 rounded-xl font-bold text-sm shadow-lg shadow-indigo-650/15 transition cursor-pointer flex items-center justify-center space-x-1.5"
              >
                <span>Academic details</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handlePrevStep}
                className="py-3.5 px-4 text-zinc-450 bg-zinc-900 hover:bg-zinc-850 rounded-xl font-bold text-sm border border-zinc-850 transition cursor-pointer flex items-center justify-center"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="flex-1 py-3.5 text-white bg-indigo-650 hover:bg-indigo-600 rounded-xl font-bold text-sm shadow-lg shadow-indigo-650/15 transition cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Profile</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
