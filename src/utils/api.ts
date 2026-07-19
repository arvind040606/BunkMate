import { Capacitor } from '@capacitor/core';

export const getApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // When running on native mobile platforms (Android/iOS via Capacitor),
  // we must connect directly to the deployed production backend rather than local dev URLs.
  if (Capacitor.isNativePlatform()) {
    return `https://bunkmate-lilac.vercel.app${normalizedPath}`;
  }

  const envUrl = import.meta.env.VITE_API_URL?.trim() || '';
  const isLocalhostEnv = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(envUrl);
  const isDeployed = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  if (isDeployed && isLocalhostEnv) {
    return normalizedPath;
  }

  if (!envUrl) {
    return normalizedPath;
  }

  return `${envUrl.replace(/\/+$/, '')}${normalizedPath}`;
};
