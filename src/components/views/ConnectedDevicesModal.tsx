import React from 'react';
import { motion } from 'motion/react';
import { X, Smartphone, Monitor, Tablet, LogOut } from 'lucide-react';
import { triggerHaptic } from '../../utils/db';

interface ConnectedDevicesModalProps {
  onClose: () => void;
  username: string;
}

export default function ConnectedDevicesModal({ onClose, username }: ConnectedDevicesModalProps) {
  // Dynamically resolve current device metadata
  const getDeviceDetails = () => {
    if (typeof window === 'undefined') {
      return {
        name: 'Web client',
        type: 'desktop',
        os: 'Unknown OS',
      };
    }
    const ua = window.navigator.userAgent;
    let type = 'desktop';
    let name = 'Desktop Client';
    let os = 'Unknown OS';

    // Detect OS
    if (/windows/i.test(ua)) {
      os = 'Windows';
      name = 'Windows PC';
    } else if (/macintosh|mac os x/i.test(ua) && !/like mac os x/i.test(ua)) {
      os = 'macOS';
      name = 'Macbook / iMac';
    } else if (/android/i.test(ua)) {
      os = 'Android';
      name = 'Android Device';
      type = 'phone';
    } else if (/iphone/i.test(ua)) {
      os = 'iOS';
      name = 'iPhone';
      type = 'phone';
    } else if (/ipad/i.test(ua)) {
      os = 'iPadOS';
      name = 'iPad';
      type = 'tablet';
    } else if (/linux/i.test(ua)) {
      os = 'Linux';
      name = 'Linux Workstation';
    }

    // Detect Browser to refine name
    let browser = '';
    if (/edg/i.test(ua)) {
      browser = 'Edge';
    } else if (/chrome|crios/i.test(ua) && !/opr|opios/i.test(ua)) {
      browser = 'Chrome';
    } else if (/firefox|fxios/i.test(ua)) {
      browser = 'Firefox';
    } else if (/safari/i.test(ua)) {
      browser = 'Safari';
    } else if (/opr/i.test(ua)) {
      browser = 'Opera';
    }

    if (browser) {
      if (type === 'desktop') {
        name = `${browser} on ${os}`;
      } else {
        name = `${name} (${browser})`;
      }
    }

    return { name, type, os: `${os} System` };
  };

  const currentDetails = getDeviceDetails();

  const devices = [
    {
      id: 'current',
      name: currentDetails.name,
      type: currentDetails.type,
      os: currentDetails.os,
      lastActive: 'Active now',
      isCurrent: true,
    }
  ];

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-50 flex items-end justify-center select-none">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 220 }}
        className="w-full max-w-[440px] bg-zinc-955 rounded-t-[32px] shadow-2xl flex flex-col max-h-[75%] overflow-hidden border-t border-zinc-900 text-white"
      >
        {/* Header Drawer handle */}
        <div className="flex flex-col items-center pt-3 pb-4 px-6 border-b border-zinc-900 flex-shrink-0">
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full mb-3" />
          <div className="flex justify-between items-center w-full">
            <h3 className="text-xl font-display font-black text-white tracking-tight flex items-center">
              <Smartphone className="w-5 h-5 mr-1.5 text-indigo-400" />
              Connected Devices
            </h3>
            <button
              onClick={() => { triggerHaptic('light'); onClose(); }}
              className="p-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-full transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Device List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent">
          <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded-2xl">
            <p className="text-xs text-indigo-400 font-bold leading-normal">
              Logged in as <span className="underline">@{username}</span>
            </p>
            <p className="text-[10px] text-zinc-400 font-medium leading-relaxed mt-1">
              Your curriculum settings and attendance logs are securely locked to this account and will synchronize in real-time.
            </p>
          </div>

          <div className="space-y-2.5">
            {devices.map(device => (
              <div 
                key={device.id} 
                className={`p-4 rounded-2xl border flex items-center justify-between transition ${
                  device.isCurrent 
                    ? 'bg-emerald-500/5 border-emerald-500/15 text-white' 
                    : 'bg-zinc-900 border-zinc-850 text-zinc-300'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                    device.isCurrent 
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' 
                      : 'bg-zinc-950 border-zinc-850 text-zinc-500'
                  }`}>
                    {device.type === 'phone' && <Smartphone className="w-5 h-5" />}
                    {device.type === 'tablet' && <Tablet className="w-5 h-5" />}
                    {device.type === 'desktop' && <Monitor className="w-5 h-5" />}
                  </div>

                  <div className="text-left">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs font-bold text-white leading-tight">{device.name}</span>
                      {device.isCurrent && (
                        <span className="text-[8px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-full font-extrabold uppercase">
                          Current
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-555 font-semibold block mt-0.5">{device.os}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[10px] font-bold ${device.isCurrent ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {device.lastActive}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
