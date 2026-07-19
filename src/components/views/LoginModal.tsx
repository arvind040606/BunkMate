import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, User, RefreshCw, KeyRound, ShieldAlert } from 'lucide-react';
import { syncService } from '../../utils/syncService';
import { triggerHaptic } from '../../utils/db';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: (action: 'login' | 'register') => void;
}

export default function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase();
    if (!cleanUsername || !password) {
      triggerHaptic('error');
      setError('Username and password are required');
      return;
    }

    if (cleanUsername.length < 3) {
      triggerHaptic('error');
      setError('Username must be at least 3 characters');
      return;
    }

    if (password.length < 6) {
      triggerHaptic('error');
      setError('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);
    triggerHaptic('medium');

    const result = await syncService.registerOrLogin(
      cleanUsername,
      password,
      isLogin ? 'login' : 'register'
    );

    if (result.success) {
      triggerHaptic('success');
      onSuccess(isLogin ? 'login' : 'register');
    } else {
      triggerHaptic('error');
      setError(result.error || 'Authentication failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl w-full max-w-sm"
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-black text-white flex items-center">
            <KeyRound className="w-5 h-5 mr-2 text-indigo-400" />
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
          <button
            onClick={() => { triggerHaptic('light'); onClose(); }}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-full transition text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-zinc-900 rounded-xl p-1 mb-6">
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setIsLogin(true); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${isLogin ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { triggerHaptic('light'); setIsLogin(false); setError(null); }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${!isLogin ? 'bg-indigo-600 text-white shadow' : 'text-zinc-400 hover:text-white'}`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
              <input
                type="text"
                disabled={isLoading}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="college_id"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white font-semibold focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            {!isLogin && (
              <p className="text-[10px] text-zinc-500 px-1">Must be unique, min 3 characters (e.g. Roll No)</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-5 h-5 text-zinc-500" />
              <input
                type="password"
                disabled={isLoading}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-3 pl-10 pr-4 text-white font-semibold focus:outline-none focus:border-indigo-500 transition"
              />
            </div>
            {!isLogin && (
              <p className="text-[10px] text-zinc-500 px-1">Min 6 characters. Do not use your real college password.</p>
            )}
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start space-x-2 text-rose-400 text-xs font-bold"
              >
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 transition flex items-center justify-center space-x-2 mt-4"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Please wait...</span>
              </>
            ) : (
              <span>{isLogin ? 'Access Account' : 'Create Account'}</span>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
