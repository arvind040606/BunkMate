import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Sparkles, 
  UploadCloud, 
  FileText, 
  Check, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  Image as ImageIcon,
  AlertCircle,
  Clipboard,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  RefreshCw
} from 'lucide-react';
import { Subject } from '../../types';
import { db, triggerHaptic, compareTimeStrings } from '../../utils/db';
import { getApiUrl } from '../../utils/api';

interface TimetableWizardModalProps {
  onClose: () => void;
  onImport: (subjects: Subject[]) => void;
  collegeStartTime: string;
  collegeEndTime: string;
  onSaveTimings: (start: string, end: string) => void;
  userSection?: string;
  userGroup?: string;
}

const WAITING_JOKES = [
  "Gemini is doing 90% of the heavy lifting. The other 10% is you double-checking for safety!",
  "Deciphering professor's handwriting... this might require an ancient languages degree.",
  "Calculating the exact probability of bunking the Monday 8:30 AM lecture.",
  "Remember: AI is smart, but it doesn't have to attend the exams. Safety check your schedule!",
  "Gemini is currently searching for a loophole to bypass the 75% attendance policy...",
  "Converting blurry timetable screenshot pixels into attendance-saving schedule rows...",
  "Analyzing timetable. Our AI operates at 90% efficiency, and 100% caffeine dependency.",
  "Double check your labs! AI gets excited and might schedule you for three chemistry sessions at once.",
  "Warning: Bunking recommendations are purely mathematical. Do not use as legal defense.",
  "Polishing the final schedule... Please verify classroom numbers so you don't walk into a test!"
];

export default function TimetableWizardModal({ 
  onClose, 
  onImport, 
  collegeStartTime, 
  collegeEndTime,
  onSaveTimings,
  userSection,
  userGroup
}: TimetableWizardModalProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Timings, 2: Input Method, 3: AI Processing, 4: Review
  const [startTime, setStartTime] = useState(collegeStartTime || '09:00');
  const [endTime, setEndTime] = useState(collegeEndTime || '17:00');
  const [targetGroup, setTargetGroup] = useState<string>(userGroup || db.getPrefs().group || '');
  
  // Input method states
  const [inputMethod, setInputMethod] = useState<'text' | 'image' | 'vault' | null>(null);
  
  // Custom modal states to replace native browser prompts
  const [pendingImageFile, setPendingImageFile] = useState<{file: File, fromClipboard: boolean} | null>(null);
  const [pastedText, setPastedText] = useState('');
  
  // Vault states
  const [hasSavedImage, setHasSavedImage] = useState(false);
  const [savedImageBase64, setSavedImageBase64] = useState<string | null>(null);
  const [showVaultViewer, setShowVaultViewer] = useState(false);
  const [vaultZoom, setVaultZoom] = useState(1);

  React.useEffect(() => {
    import('../../utils/vault').then(module => {
      module.TimetableVault.getImage().then(img => {
        if (img && img.startsWith('data:image')) {
          setHasSavedImage(true);
          setSavedImageBase64(img);
        }
      }).catch(err => {
        console.warn('Vault error:', err);
      });
    });
  }, []);
  
  // Image upload states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPasted, setIsPasted] = useState(false);
  
  // AI loader states
  const [loadingStatus, setLoadingStatus] = useState<string>('Uploading assets...');
  const [loadingSubText, setLoadingSubText] = useState<string>('Preparing timetable data for AI analysis');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // AI Results
  const [parsedSubjects, setParsedSubjects] = useState<Subject[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);
  const [jokeIndex, setJokeIndex] = useState(0);

  // Dynamically find all unique groups from parsed subjects (G1, G2, Batch A, etc.)
  const availableGroups = React.useMemo(() => {
    const groups = new Set<string>();
    const groupRegex = /\b(G\d+|Group\s*\d+|Group\s*[A-Z]|Batch\s*[A-Z]|Batch\s*\d+)\b/i;
    
    parsedSubjects.forEach(sub => {
      const matchName = sub.name.match(groupRegex);
      if (matchName) {
        groups.add(matchName[1].toUpperCase().replace(/\s+/g, ''));
      }
    });
    
    return Array.from(groups).sort();
  }, [parsedSubjects]);

  React.useEffect(() => {
    if (step !== 3) return;
    const interval = setInterval(() => {
      setJokeIndex(prev => (prev + 1) % WAITING_JOKES.length);
    }, 6500);
    return () => clearInterval(interval);
  }, [step]);

  React.useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  // Normalize name for matching theory class with corresponding lab/tutorials
  const normalizeSubjectName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\(t\)/g, '') // remove (t) or (T) parenthetical
      .replace(/\btutorial\b/g, '')
      .replace(/\btute\b/g, '')
      .replace(/\btheory\b/g, '') // remove theory

      .replace(/\bpl-\d+\b/g, '') // remove pl-1, pl-2, etc.
      .replace(/\bg\d+\b/g, '')
      .replace(/\bgroup\s*\d+\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  // Display the exact output generated by the AI since it now perfectly handles labs and groups internally
  const displaySubjects = React.useMemo(() => {
    return parsedSubjects;
  }, [parsedSubjects]);

  // Synchronize selection IDs with visible display subjects
  React.useEffect(() => {
    setSelectedSubjectIds(displaySubjects.map(s => s.id));
  }, [displaySubjects]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processImage(e.dataTransfer.files[0], false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processImage(e.target.files[0], false);
    }
  };

  const processImage = (file: File, fromClipboard = false, confirmedReplace = false) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG or JPEG).');
      return;
    }
    
    if (hasSavedImage && !confirmedReplace) {
      setPendingImageFile({ file, fromClipboard });
      triggerHaptic('medium');
      return;
    }
    
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setIsPasted(fromClipboard);
    triggerHaptic('light');
  };

  // Keyboard shortcut Ctrl+V / Cmd+V globally when modal is open to paste image
  React.useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (step !== 2) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile();
          if (file) {
            setInputMethod('image');
            processImage(file, true);
            e.preventDefault();
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [step]);

  const handlePasteFromClipboardButton = async () => {
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) {
        alert("Clipboard reading API is not fully supported in your browser. Please select 'Upload Photo' below and use standard Ctrl+V / Cmd+V shortcuts!");
        return;
      }
      
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], "pasted-timetable-image.png", { type });
            setInputMethod('image');
            processImage(file, true);
            triggerHaptic('success');
            return;
          }
        }
      }
      alert("No image found in your clipboard! Try copying an image (e.g., take a screenshot or right-click 'Copy Image') first.");
    } catch (err: any) {
      console.warn("Clipboard API paste blocked:", err);
      alert("Browser security blocked automatic clipboard reading, or no image is copied. Please select 'Upload Photo' below, click the area, and press Ctrl+V / Cmd+V to paste your image directly!");
    }
  };

  // Run the server-side AI parsing
  const handleStartParsing = async () => {
    if (inputMethod === 'text' && !pastedText.trim()) {
      alert('Please paste some timetable text first!');
      return;
    }
    if (inputMethod === 'image' && !imagePreview) {
      alert('Please upload a timetable photo first!');
      return;
    }
    if (inputMethod === 'vault' && !savedImageBase64) {
      alert('Vault image is missing or corrupted. Please upload a new timetable.');
      return;
    }

    setStep(3);
    setErrorMessage(null);
    triggerHaptic('medium');

    try {
      // Step messages sequence
      setLoadingStatus('Connecting to Gemini AI...');
      setLoadingSubText('Establishing encrypted full-stack tunnel');

      setTimeout(() => {
        setLoadingStatus('Analyzing Timetable Structure...');
        setLoadingSubText(inputMethod === 'image' ? 'Running high-fidelity visual OCR parsing' : 'Structuring lecture dates and details');
      }, 1500);

      setTimeout(() => {
        setLoadingStatus('Mapping Lecture Schedules...');
        setLoadingSubText('Calculating classroom codes and timings');
      }, 3200);

      const prefs = db.getPrefs();
      const requestBody: any = {
        collegeStartTime: startTime,
        collegeEndTime: endTime,
        userProfile: {
          displayName: prefs.displayName || '',
          course: prefs.course || '',
          major: prefs.major || '',
          semester: prefs.semester || '',
          section: prefs.section || '',
          group: targetGroup, // Strictly use wizard input, even if empty
          collegeName: prefs.collegeName || '',
        }
      };

      if (inputMethod === 'text') {
        requestBody.text = pastedText;
      } else if (inputMethod === 'image' && imagePreview) {
        requestBody.imageBase64 = imagePreview;
        requestBody.imageMimeType = imageFile?.type || 'image/png';
        import('../../utils/vault').then(m => m.TimetableVault.saveImage(imagePreview));
      } else if (inputMethod === 'vault' && savedImageBase64) {
        requestBody.imageBase64 = savedImageBase64;
        requestBody.imageMimeType = savedImageBase64.match(/data:(.*?);/)?.[1] || 'image/png';
      }

      const apiUrl = getApiUrl('/api/parse-timetable');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to parse timetable.');
      }

      const data = await response.json();
      
      if (!data.subjects || !Array.isArray(data.subjects) || data.subjects.length === 0) {
        throw new Error('AI could not detect any subjects in this timetable. Please try pasting text or uploading a clearer image.');
      }

      // Map parsed subjects into Subject models with generated IDs
      const mapped: Subject[] = data.subjects.map((sub: any, idx: number) => {
        const subId = `subj-ai-${Date.now()}-${idx}`;
        return {
          id: subId,
          name: sub.name,
          code: sub.code || 'CS-' + sub.name.substring(0, 3).toUpperCase(),
          room: sub.room || undefined,
          teacher: sub.teacher || undefined,
          color: sub.color || '#6366f1',
          targetPercentage: sub.targetPercentage || 75,
          icon: '📚',
          schedule: (sub.schedule || []).map((sch: any, sIdx: number) => ({
            id: `sch-${subId}-${sIdx}`,
            dayOfWeek: typeof sch.dayOfWeek === 'number' ? sch.dayOfWeek : 1,
            time: sch.time || '09:00 AM',
            duration: sch.duration || 60
          }))
        };
      });

      setParsedSubjects(mapped);
      // Select all by default
      setSelectedSubjectIds(mapped.map(s => s.id));
      setStep(4);
      triggerHaptic('success');
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'An error occurred while calling the Gemini API. Please check your internet connection or try again.');
      triggerHaptic('error');
    }
  };

  const toggleSubjectSelect = (id: string) => {
    setSelectedSubjectIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
    triggerHaptic('light');
  };

  const handleConfirmImport = () => {
    const finalSubjects = displaySubjects.filter(s => selectedSubjectIds.includes(s.id));
    if (finalSubjects.length === 0) {
      alert('Please select at least one subject to import!');
      return;
    }

    onSaveTimings(startTime, endTime);
    onImport(finalSubjects);
    triggerHaptic('success');
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end justify-center select-none p-0 md:p-6">
      {/* Full-Screen Vault Viewer */}
      <AnimatePresence>
        {showVaultViewer && savedImageBase64 && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center"
          >
            <div className="absolute top-0 inset-x-0 p-4 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center z-10">
              <div className="flex space-x-2">
                <button onClick={() => setVaultZoom(z => Math.min(z + 0.5, 4))} className="p-2 bg-zinc-800/80 rounded-full text-white">
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button onClick={() => setVaultZoom(z => Math.max(z - 0.5, 0.5))} className="p-2 bg-zinc-800/80 rounded-full text-white">
                  <ZoomOut className="w-5 h-5" />
                </button>
              </div>
              <button onClick={() => { setShowVaultViewer(false); setVaultZoom(1); }} className="p-2 bg-zinc-800/80 rounded-full text-white">
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

      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-[420px] h-[92%] bg-zinc-955 rounded-t-[32px] md:rounded-[36px] shadow-2xl flex flex-col overflow-hidden border border-zinc-900 text-white"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-900 shrink-0">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
            <span className="text-sm font-display font-black text-white uppercase tracking-wider">
              AI Timetable Assistant
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Wizard Steps Container */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent">
          
          {/* STEP 1: Timings Setup */}
          {step === 1 && (
            <div className="space-y-5 flex flex-col justify-between h-full text-left">
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-1.5">
                  <h4 className="text-xs font-bold text-indigo-400 flex items-center">
                    ⏰ Setting Up Your College Timings
                  </h4>
                  <p className="text-[11px] leading-relaxed text-zinc-350">
                    Specify the times you attend lectures. This will align the BunkMate auto-notifiers to ping you 3-4 times daily while college is running.
                  </p>
                </div>

                <div className="flex items-center justify-center space-x-6 pt-2">
                  <div className="flex items-center space-x-2">
                    <label className="text-[10px] font-black text-zinc-550 uppercase tracking-wider">
                      Starts
                    </label>
                    <input 
                      type="time" 
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="w-[90px] px-2.5 py-1.5 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition text-center"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <label className="text-[10px] font-black text-zinc-550 uppercase tracking-wider">
                      Ends
                    </label>
                    <input 
                      type="time" 
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="w-[90px] px-2.5 py-1.5 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Group/Batch Filter Input */}
              <div className="pt-2">
                <div className="flex flex-col space-y-2">
                  <label className="text-[10px] font-black text-zinc-550 uppercase tracking-wider">
                    Target Group / Batch (Optional)
                  </label>
                  <input
                    type="text"
                    value={targetGroup}
                    onChange={e => setTargetGroup(e.target.value)}
                    placeholder="e.g. Group 1, Batch B, G1"
                    className="w-full px-4 py-3 bg-zinc-900/50 border border-zinc-850 text-white rounded-xl text-xs font-bold focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition"
                  />
                  <p className="text-[9px] text-zinc-500 leading-relaxed px-1">
                    If your timetable contains split labs, AI will automatically filter them and only extract your group's classes.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => { triggerHaptic('light'); setStep(2); }}
                className="w-full py-3.5 bg-indigo-650 hover:bg-indigo-600 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center space-x-1 shadow-sm mt-8 cursor-pointer"
              >
                <span>Continue to Timetable</span>
                <Clock className="w-4 h-4 ml-1" />
              </button>
            </div>
          )}

          {/* STEP 2: Input Method */}
          {step === 2 && (
            <div className="space-y-5 text-left">
              <div className="text-center space-y-1">
                <h3 className="text-base font-display font-black text-white">
                  How would you like to set up?
                </h3>
                <p className="text-[11px] text-zinc-450 max-w-xs mx-auto leading-relaxed">
                  Our advanced Gemini AI does 90% of the heavy lifting by reading images or text! Since AI can sometimes make mistakes, you'll safety-check your schedule before importing.
                </p>
              </div>

              {/* Vault Card */}
              {hasSavedImage && (
                <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-2xl p-4 mb-4 space-y-3">
                  <div className="flex items-center justify-between">
                     <div className="flex items-center space-x-2">
                       <ShieldCheck className="w-5 h-5 text-emerald-400" />
                       <h4 className="text-xs font-bold text-white">Timetable Vault</h4>
                     </div>
                     <button
                       onClick={() => setShowVaultViewer(true)}
                       className="text-[10px] bg-emerald-900/50 hover:bg-emerald-800 text-emerald-200 px-2 py-1 rounded transition cursor-pointer"
                     >
                       View Image
                     </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => { triggerHaptic('medium'); setInputMethod('vault'); }}
                    className={`w-full py-2.5 rounded-xl border text-[11px] font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer ${
                      inputMethod === 'vault'
                        ? 'bg-emerald-600 text-white border-emerald-500'
                        : 'bg-emerald-950 border-emerald-900 text-emerald-300 hover:bg-emerald-900'
                    }`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reparse Saved Timetable</span>
                  </button>
                </div>
              )}

              {/* Method Cards */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => { triggerHaptic('light'); setInputMethod('text'); }}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-[130px] transition-all cursor-pointer ${
                    inputMethod === 'text' 
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/20' 
                      : 'border-zinc-850 bg-zinc-900 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <div className={`p-2 rounded-xl w-fit ${inputMethod === 'text' ? 'bg-indigo-600 text-white' : 'bg-zinc-950 border border-zinc-850 text-zinc-500'}`}>
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Paste Text</h4>
                    <p className="text-[9px] text-zinc-400 mt-0.5 leading-normal">
                      Copy-paste text timetable from WhatsApp, doc or portal.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => { triggerHaptic('light'); setInputMethod('image'); }}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between h-[130px] transition-all cursor-pointer ${
                    inputMethod === 'image' 
                      ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/20' 
                      : 'border-zinc-850 bg-zinc-900 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <div className={`p-2 rounded-xl w-fit ${inputMethod === 'image' ? 'bg-indigo-600 text-white' : 'bg-zinc-950 border border-zinc-850 text-zinc-500'}`}>
                    <ImageIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Upload Photo</h4>
                    <p className="text-[9px] text-zinc-400 mt-0.5 leading-normal">
                      Snap or upload an image of your class schedule.
                    </p>
                  </div>
                </button>
              </div>

              {/* TEXT FIELD INPUT */}
              {inputMethod === 'text' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-2"
                >
                  <label className="block text-[10px] font-extrabold text-zinc-550 uppercase tracking-wider">
                    Paste Timetable Text Content
                  </label>
                  <textarea
                    rows={6}
                    placeholder="e.g.&#10;Monday&#10;9:00 AM - Physics Room 102&#10;11:00 AM - Computer Networks Dr. Joe&#10;&#10;Wednesday&#10;10:00 AM - Maths..."
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                    className="w-full p-4 bg-zinc-900/50 border border-zinc-850 text-white rounded-2xl text-xs font-semibold focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition resize-none placeholder:text-zinc-650"
                  />
                </motion.div>
              )}

              {/* IMAGE UPLOADER */}
              {inputMethod === 'image' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <label className="block text-[10px] font-extrabold text-zinc-550 uppercase tracking-wider flex justify-between items-center">
                    <span>Upload Timetable Image</span>
                    <span className="text-[8px] font-mono font-medium text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-sm">
                      Pasting supported
                    </span>
                  </label>
                  
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-5 text-center flex flex-col items-center justify-center cursor-pointer transition ${
                      isDragging 
                        ? 'border-indigo-500 bg-indigo-500/10' 
                        : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/50 hover:bg-zinc-900'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden" 
                    />
                    
                    {imagePreview ? (
                      <div className="space-y-3">
                        <img 
                          src={imagePreview} 
                          alt="Timetable preview" 
                          className="max-h-[140px] rounded-lg object-contain mx-auto shadow-sm border border-zinc-800"
                        />
                        <div className="space-y-1">
                          {isPasted && (
                            <div className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 rounded-full text-[9px] font-extrabold tracking-wide uppercase mx-auto">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                              <span>📋 Pasted from Clipboard</span>
                            </div>
                          )}
                          <span className="text-[10px] font-bold text-indigo-400 block mt-1">
                            Change photo
                          </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="w-8 h-8 text-zinc-550 mb-2" />
                        <span className="text-xs font-bold text-zinc-300">Drag photo here, or browse</span>
                        <span className="text-[10px] text-zinc-500 mt-1.5 leading-relaxed max-w-[240px] mx-auto block">
                          Supports PNG, JPG, JPEG. Or simply press <kbd className="bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 font-mono text-[9px] text-zinc-400 font-bold">Ctrl+V</kbd> anywhere!
                        </span>
                      </>
                    )}
                  </div>

                  {/* clipboard pasting quick button */}
                  {!imagePreview && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerHaptic('light');
                        handlePasteFromClipboardButton();
                      }}
                      className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 rounded-2xl text-[10px] font-black tracking-wide uppercase transition flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Paste Image from Clipboard</span>
                    </button>
                  )}
                </motion.div>
              )}

              <div className="flex space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => { triggerHaptic('light'); setStep(1); }}
                  className="flex-1 py-3 text-xs font-bold bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 rounded-2xl transition cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!inputMethod}
                  onClick={handleStartParsing}
                  className={`flex-1 py-3 text-xs font-bold text-white rounded-2xl shadow-sm transition cursor-pointer flex items-center justify-center space-x-1 ${
                    inputMethod 
                      ? 'bg-indigo-650 hover:bg-indigo-600' 
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-850'
                  }`}
                >
                  <Sparkles className="w-4 h-4 mr-1 animate-pulse" />
                  <span>Analyze with AI</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Loading / AI Processing */}
          {step === 3 && (
            <div className="flex flex-col items-center justify-center h-full py-10 space-y-6">
              {!errorMessage ? (
                <>
                  <div className="relative">
                    {/* Ring loader animations */}
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/10 animate-ping opacity-20 w-16 h-16" />
                    <div className="w-16 h-16 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-indigo-455 animate-pulse" />
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <h3 className="text-sm font-bold text-white">
                      {loadingStatus}
                    </h3>
                    <p className="text-[10px] text-zinc-550 max-w-[240px] mx-auto animate-pulse font-semibold">
                      {loadingSubText}
                    </p>
                  </div>

                  <div className="w-full max-w-[300px] bg-indigo-950/20 border border-indigo-900/30 p-4 rounded-2xl space-y-2 mt-4 text-left shadow-2xs">
                    <div className="flex items-center space-x-1.5 text-indigo-400">
                      <Sparkles className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
                      <span className="text-[9px] font-mono font-black uppercase tracking-wider">While you wait...</span>
                    </div>
                    <div className="h-[40px] flex items-center">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={jokeIndex}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.25 }}
                          className="text-[10px] leading-relaxed text-zinc-350 font-bold"
                        >
                          {WAITING_JOKES[jokeIndex]}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center space-y-4 max-w-[320px]">
                  <div className="mx-auto bg-rose-500/20 text-rose-455 w-12 h-12 rounded-full flex items-center justify-center border border-rose-500/30">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">AI Parsing Failed</h4>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-semibold">
                      {errorMessage}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { triggerHaptic('light'); setStep(2); }}
                    className="px-4 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 rounded-xl text-[10px] font-bold transition cursor-pointer"
                  >
                    Try Another Method
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Review AI results */}
          {step === 4 && (
            <div className="space-y-4 flex flex-col justify-between h-full text-left">
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <div>
                      <h4 className="text-[11px] font-bold text-white">AI Extraction Success!</h4>
                      <p className="text-[9px] text-zinc-400">Detected {displaySubjects.length} subjects with class times.</p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-2xl space-y-1 text-left">
                  <h4 className="text-[10px] font-bold text-amber-400 flex items-center">
                    ✨ Friendly Reminder
                  </h4>
                  <p className="text-[9px] leading-relaxed text-zinc-400">
                    AI does 90% of the work, but can sometimes make mistakes. For safety, please review your schedule below before importing!
                  </p>
                </div>


                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                    Confirm Courses to Import
                  </label>
                  
                  {/* Subject Checklist view */}
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                    {displaySubjects.map((sub) => {
                      const isSelected = selectedSubjectIds.includes(sub.id);
                      return (
                        <div 
                          key={sub.id}
                          onClick={() => toggleSubjectSelect(sub.id)}
                          className={`p-3 rounded-2xl border text-left cursor-pointer flex items-center justify-between transition-all ${
                            isSelected 
                              ? 'border-indigo-500/20 bg-indigo-500/5' 
                              : 'border-zinc-900 bg-zinc-900/30 hover:border-zinc-800'
                          }`}
                        >
                          <div className="flex items-center space-x-3 overflow-hidden">
                            {/* Color Dot Accent */}
                            <div 
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-3xs"
                              style={{ backgroundColor: sub.color }}
                            />
                            <div className="overflow-hidden">
                              <h5 className="text-xs font-bold text-white truncate">{sub.name}</h5>
                              <div className="flex items-center space-x-2 text-[9px] text-zinc-450 mt-0.5">
                                <span className="font-mono bg-zinc-950 border border-zinc-850 text-zinc-400 px-1 py-0.5 rounded-sm">{sub.code}</span>
                                {sub.room && (
                                  <span className="flex items-center shrink-0">
                                    <MapPin className="w-2.5 h-2.5 mr-0.5" />
                                    {sub.room}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center space-x-2 shrink-0">
                            {/* Schedule mini tags */}
                            <span className="text-[8px] font-bold bg-zinc-900 text-zinc-400 px-1.5 py-0.5 border border-zinc-800 rounded-full shrink-0">
                              {sub.schedule.length} cls
                            </span>
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                              isSelected 
                                ? 'bg-indigo-600 border-indigo-600 text-white' 
                                : 'border-zinc-800 bg-zinc-950 text-transparent'
                            }`}>
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4 border-t border-zinc-900 shrink-0">
                <button
                  type="button"
                  onClick={() => { triggerHaptic('light'); setStep(2); }}
                  className="flex-1 py-3.5 text-xs font-bold bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-300 rounded-2xl transition cursor-pointer"
                >
                  Start Over
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="flex-1 py-3.5 text-xs font-bold bg-indigo-650 hover:bg-indigo-600 text-white rounded-2xl shadow-sm transition cursor-pointer"
                >
                  Import {selectedSubjectIds.length} Subjects
                </button>
              </div>
            </div>
          )}

        </div>
      </motion.div>

      {/* Custom Vault Replacement Modal */}
      <AnimatePresence>
        {pendingImageFile && (
          <div className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm select-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl w-full max-w-[320px]"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-14 h-14 bg-amber-500/10 rounded-full flex items-center justify-center mb-1">
                  <ShieldCheck className="w-7 h-7 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">Replace Vault Image?</h3>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  You already have a saved timetable in your secure vault. Do you want to overwrite it with this new image?
                </p>
                
                <div className="flex w-full space-x-3 mt-4 pt-2">
                  <button
                    onClick={() => {
                      triggerHaptic('light');
                      setPendingImageFile(null);
                    }}
                    className="flex-1 py-3 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-300 text-xs font-bold rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      triggerHaptic('success');
                      if (pendingImageFile) {
                        processImage(pendingImageFile.file, pendingImageFile.fromClipboard, true);
                        setPendingImageFile(null);
                      }
                    }}
                    className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-black rounded-xl transition-colors shadow-lg shadow-amber-500/20"
                  >
                    Replace
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
