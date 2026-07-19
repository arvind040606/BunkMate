import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Fingerprint, Delete, ShieldAlert } from 'lucide-react';
import { triggerHaptic } from '../../utils/db';

interface SecurityPinViewProps {
  correctPin: string;
  onSuccess: () => void;
}

export default function SecurityPinView({ correctPin, onSuccess }: SecurityPinViewProps) {
  const [pin, setPin] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const [isBiometricSimulating, setIsBiometricSimulating] = useState<boolean>(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      triggerHaptic('light');
      const newPin = pin + num;
      setPin(newPin);

      if (newPin.length === 4) {
        if (newPin === correctPin) {
          triggerHaptic('success');
          onSuccess();
        } else {
          triggerHaptic('error');
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 800);
        }
      }
    }
  };

  const handleDelete = () => {
    triggerHaptic('medium');
    setPin(prev => prev.slice(0, -1));
  };

  const handleBiometricSimulate = () => {
    triggerHaptic('light');
    setIsBiometricSimulating(true);
    setTimeout(() => {
      triggerHaptic('success');
      onSuccess();
      setIsBiometricSimulating(false);
    }, 1200);
  };

  return (
    <div className="absolute inset-0 bg-zinc-955 text-white z-50 flex flex-col justify-between p-8 select-none">
      {/* Top Section */}
      <div className="flex flex-col items-center mt-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-4 border border-indigo-500/25">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-display font-black tracking-tight text-white">
          App Locked
        </h2>
        <p className="text-zinc-400 text-xs mt-1 max-w-[250px] font-semibold">
          Enter your 4-digit security PIN code to access BunkMate.
        </p>
      </div>

      {/* Middle Section: PIN Dots */}
      <div className="flex flex-col items-center justify-center my-6">
        <motion.div 
          animate={error ? { x: [-10, 10, -10, 10, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="flex space-x-5 justify-center"
        >
          {[0, 1, 2, 3].map((index) => {
            const isActive = pin.length > index;
            return (
              <div
                key={index}
                className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
                  error 
                    ? 'bg-rose-500 border-rose-500 scale-110 shadow-lg shadow-rose-500/40' 
                    : isActive 
                      ? 'bg-indigo-400 border-indigo-400 scale-110 shadow-lg shadow-indigo-400/40' 
                      : 'border-zinc-700 bg-transparent'
                }`}
              />
            );
          })}
        </motion.div>
        
        {error && (
          <motion.span 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-rose-455 text-xs mt-4 flex items-center font-bold"
          >
            <ShieldAlert className="w-3.5 h-3.5 mr-1" />
            Incorrect passcode. Try again.
          </motion.span>
        )}
      </div>

      {/* Keypad Section */}
      <div className="flex flex-col items-center w-full max-w-[320px] mx-auto mb-8">
        <div className="grid grid-cols-3 gap-y-4 gap-x-6 w-full text-center">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="w-16 h-16 rounded-full bg-zinc-900 hover:bg-zinc-800 active:scale-90 text-2xl font-display font-semibold flex items-center justify-center transition-all cursor-pointer shadow-sm border border-zinc-800"
            >
              {num}
            </button>
          ))}
          
          {/* Biometrics Simulator Button */}
          <button
            onClick={handleBiometricSimulate}
            disabled={isBiometricSimulating}
            className="w-16 h-16 rounded-full text-indigo-400 hover:bg-indigo-500/10 active:scale-95 flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
          >
            <Fingerprint className="w-7 h-7" />
          </button>
          
          <button
            onClick={() => handleKeyPress('0')}
            className="w-16 h-16 rounded-full bg-zinc-900 hover:bg-zinc-800 active:scale-90 text-2xl font-display font-semibold flex items-center justify-center transition-all cursor-pointer shadow-sm border border-zinc-800"
          >
            0
          </button>
          
          <button
            onClick={handleDelete}
            className="w-16 h-16 rounded-full text-zinc-500 hover:bg-zinc-900 active:scale-95 flex items-center justify-center transition-all cursor-pointer"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Biometrics loading overlays */}
      <AnimatePresence>
        {isBiometricSimulating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-zinc-950/95 flex flex-col items-center justify-center p-6 z-50 text-center backdrop-blur-sm"
          >
            <div className="relative flex items-center justify-center mb-6">
              <motion.div 
                animate={{ scale: [1, 1.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute w-20 h-20 rounded-full bg-indigo-500/20"
              />
              <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                <Fingerprint className="w-8 h-8 animate-pulse" />
              </div>
            </div>
            <p className="text-lg font-bold">Scanning Biometrics</p>
            <p className="text-zinc-550 text-xs mt-1">Simulating Face ID / Fingerprint verification...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
