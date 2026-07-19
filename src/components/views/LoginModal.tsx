import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, User, RefreshCw, KeyRound, ShieldAlert, HelpCircle, ShieldCheck, ArrowLeft } from 'lucide-react';
import { syncService } from '../../utils/syncService';
import { triggerHaptic } from '../../utils/db';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: (action: 'login' | 'register') => void;
}

const PRESET_QUESTIONS = [
  "What was the name of your first school?",
  "What is your mother's maiden name?",
  "What is your major course name?",
  "What was the name of your first pet?",
  "In what city were you born?"
];

type ModalMode = 'login' | 'register' | 'forgot-username' | 'forgot-answer';

export default function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  const [mode, setMode] = useState<ModalMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration security question state
  const [securityQuestion, setSecurityQuestion] = useState(PRESET_QUESTIONS[0]);
  const [customQuestion, setCustomQuestion] = useState('');
  const [isCustomQuestion, setIsCustomQuestion] = useState(false);
  const [securityAnswer, setSecurityAnswer] = useState('');

  // Password recovery state
  const [fetchedQuestion, setFetchedQuestion] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const activeQuestion = isCustomQuestion ? customQuestion : securityQuestion;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      triggerHaptic('error');
      setError('Username is required');
      return;
    }

    if (mode === 'login') {
      if (!password) {
        triggerHaptic('error');
        setError('Password is required');
        return;
      }
      setIsLoading(true);
      triggerHaptic('medium');
      const result = await syncService.registerOrLogin(cleanUsername, password, 'login');
      if (result.success) {
        triggerHaptic('success');
        onSuccess('login');
      } else {
        triggerHaptic('error');
        setError(result.error || 'Invalid username or password.');
        setIsLoading(false);
      }
    } 
    
    else if (mode === 'register') {
      if (!password || password.length < 6) {
        triggerHaptic('error');
        setError('Password must be at least 6 characters');
        return;
      }
      if (isCustomQuestion && !customQuestion.trim()) {
        triggerHaptic('error');
        setError('Please enter a custom security question');
        return;
      }
      if (!securityAnswer.trim()) {
        triggerHaptic('error');
        setError('Please provide an answer to the security question');
        return;
      }

      setIsLoading(true);
      triggerHaptic('medium');
      const result = await syncService.registerOrLogin(
        cleanUsername,
        password,
        'register',
        activeQuestion,
        securityAnswer.trim()
      );
      if (result.success) {
        triggerHaptic('success');
        onSuccess('register');
      } else {
        triggerHaptic('error');
        setError(result.error || 'Registration failed');
        setIsLoading(false);
      }
    }
  };

  const handleFetchQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername) {
      triggerHaptic('error');
      setError('Please enter your username');
      return;
    }

    setIsLoading(true);
    triggerHaptic('medium');

    const result = await syncService.getSecurityQuestion(cleanUsername);
    setIsLoading(false);

    if (result.success && result.question) {
      setFetchedQuestion(result.question);
      setMode('forgot-answer');
      setError(null);
      triggerHaptic('success');
    } else {
      triggerHaptic('error');
      setError(result.error || 'Could not retrieve security question');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!recoveryAnswer.trim()) {
      triggerHaptic('error');
      setError('Please answer the security question');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      triggerHaptic('error');
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      triggerHaptic('error');
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);
    triggerHaptic('medium');

    const result = await syncService.recoverPassword(
      cleanUsername,
      recoveryAnswer.trim(),
      newPassword
    );
    setIsLoading(false);

    if (result.success) {
      triggerHaptic('success');
      setSuccessMessage('Password reset successfully! Please sign in with your new password.');
      setMode('login');
      setPassword('');
      setRecoveryAnswer('');
      setNewPassword('');
      setConfirmNewPassword('');
    } else {
      triggerHaptic('error');
      setError(result.error || 'Verification failed. Incorrect answer.');
    }
  };

  return (
    <div className="absolute inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-zinc-955 border border-zinc-900 rounded-[32px] p-6 shadow-2xl w-full max-w-sm overflow-hidden"
      >
        <div className="flex justify-between items-center mb-5">
          <div className="flex items-center">
            {mode.startsWith('forgot-') && (
              <button
                onClick={() => {
                  triggerHaptic('light');
                  setError(null);
                  setMode(mode === 'forgot-answer' ? 'forgot-username' : 'login');
                }}
                className="mr-2 p-1 bg-zinc-900/50 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-base font-black text-white flex items-center font-display">
              <KeyRound className="w-4.5 h-4.5 mr-2 text-indigo-400" />
              {mode === 'login' && 'Welcome Back'}
              {mode === 'register' && 'Create Account'}
              {mode.startsWith('forgot-') && 'Account Recovery'}
            </h2>
          </div>
          <button
            onClick={() => { triggerHaptic('light'); onClose(); }}
            className="p-1.5 bg-zinc-900/50 hover:bg-zinc-900 rounded-full transition text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher (Only visible for Login / Register) */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex bg-zinc-900/50 rounded-2xl p-1 mb-5 border border-white/5">
            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setMode('login'); setError(null); }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition ${mode === 'login' ? 'bg-indigo-650 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { triggerHaptic('light'); setMode('register'); setError(null); }}
              className={`flex-1 py-2 rounded-xl text-xs font-black transition ${mode === 'register' ? 'bg-indigo-650 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
            >
              Register
            </button>
          </div>
        )}

        {/* Success message banner */}
        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex items-start space-x-2 text-emerald-450 text-[10px] font-bold mb-4">
            <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  disabled={isLoading}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="college_id"
                  className="w-full bg-zinc-900/50 border border-zinc-900 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Password</label>
                <button
                  type="button"
                  onClick={() => { triggerHaptic('light'); setMode('forgot-username'); setError(null); }}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  disabled={isLoading}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900/50 border border-zinc-900 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition"
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 flex items-start space-x-2 text-rose-455 text-[10px] font-bold"
                >
                  <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-650/15 transition flex items-center justify-center space-x-2 cursor-pointer mt-4"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In</span>
              )}
            </button>
          </form>
        )}

        {/* REGISTRATION FORM */}
        {mode === 'register' && (
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  disabled={isLoading}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="college_id"
                  className="w-full bg-zinc-900/50 border border-zinc-900 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition"
                />
              </div>
              <p className="text-[9px] text-zinc-500 font-semibold px-1">Min 3 characters. Example: roll number.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  disabled={isLoading}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900/50 border border-zinc-900 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition"
                />
              </div>
              <p className="text-[9px] text-zinc-500 font-semibold px-1">Min 6 characters. Do not use your real college pass.</p>
            </div>

            <div className="pt-2 border-t border-zinc-900 space-y-3">
              <span className="block text-[9px] font-black text-indigo-400 uppercase tracking-wider">Privacy & Password Recovery</span>
              
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Security Question</label>
                {!isCustomQuestion ? (
                  <select
                    disabled={isLoading}
                    value={securityQuestion}
                    onChange={e => {
                      if (e.target.value === 'custom') {
                        setIsCustomQuestion(true);
                      } else {
                        setSecurityQuestion(e.target.value);
                      }
                    }}
                    className="w-full bg-zinc-900/50 border border-zinc-900 rounded-2xl py-2.5 px-3 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 transition"
                  >
                    {PRESET_QUESTIONS.map((q, idx) => (
                      <option key={idx} value={q}>{q}</option>
                    ))}
                    <option value="custom">Write custom question...</option>
                  </select>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      disabled={isLoading}
                      value={customQuestion}
                      onChange={e => setCustomQuestion(e.target.value)}
                      placeholder="e.g. What is your favorite book?"
                      className="w-full bg-zinc-900/50 border border-zinc-900 rounded-2xl py-2.5 px-3 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomQuestion(false)}
                      className="text-[9px] font-semibold text-indigo-400 hover:text-indigo-300"
                    >
                      Use list instead
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Answer Clue</label>
                <div className="relative">
                  <HelpCircle className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    disabled={isLoading}
                    value={securityAnswer}
                    onChange={e => setSecurityAnswer(e.target.value)}
                    placeholder="Your secure recovery answer"
                    className="w-full bg-zinc-900/50 border border-zinc-900 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition"
                  />
                </div>
                <p className="text-[9px] text-zinc-500 font-semibold px-1">Answer is hashed. Nobody else can read it.</p>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 flex items-start space-x-2 text-rose-455 text-[10px] font-bold"
                >
                  <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-650/15 transition flex items-center justify-center space-x-2 cursor-pointer mt-4"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <span>Register</span>
              )}
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD: ENTER USERNAME */}
        {mode === 'forgot-username' && (
          <form onSubmit={handleFetchQuestion} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Verify Username</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  disabled={isLoading}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="college_id"
                  className="w-full bg-zinc-900/50 border border-zinc-900 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition"
                />
              </div>
              <p className="text-[9px] text-zinc-500 font-semibold px-1">Enter your account username to retrieve your clue.</p>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 flex items-start space-x-2 text-rose-455 text-[10px] font-bold"
                >
                  <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-650/15 transition flex items-center justify-center space-x-2 cursor-pointer mt-4"
            >
              {isLoading ? (
                <RefreshCw className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <span>Retrieve Clue</span>
              )}
            </button>
          </form>
        )}

        {/* FORGOT PASSWORD: ANSWER CLUE & RESET PASSWORD */}
        {mode === 'forgot-answer' && (
          <form onSubmit={handleResetPassword} className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
            <div className="bg-zinc-900/50 border border-zinc-900 rounded-2xl p-4 space-y-2">
              <span className="block text-[9px] font-black text-indigo-400 uppercase tracking-wider">Recovery Clue</span>
              <p className="text-xs font-bold text-white leading-relaxed">{fetchedQuestion}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Answer Clue</label>
              <div className="relative">
                <HelpCircle className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  disabled={isLoading}
                  value={recoveryAnswer}
                  onChange={e => setRecoveryAnswer(e.target.value)}
                  placeholder="Verify security answer"
                  className="w-full bg-zinc-900/50 border border-zinc-900 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  disabled={isLoading}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900/50 border border-zinc-900 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Confirm New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
                <input
                  type="password"
                  disabled={isLoading}
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-900/50 border border-zinc-900 rounded-2xl py-2.5 pl-9 pr-4 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 focus:bg-zinc-900 transition"
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3 flex items-start space-x-2 text-rose-455 text-[10px] font-bold"
                >
                  <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-650/15 transition flex items-center justify-center space-x-2 cursor-pointer mt-4"
            >
              {isLoading ? (
                <RefreshCw className="w-4.5 h-4.5 animate-spin" />
              ) : (
                <span>Reset Password</span>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
