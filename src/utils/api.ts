import { Capacitor } from '@capacitor/core';

export const getApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const envUrl = import.meta.env.VITE_API_URL?.trim() || '';

  // Check if we have a valid non-localhost env URL
  const isLocalhostEnv = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(envUrl);

  // When running on native mobile platforms (Android/iOS via Capacitor),
  // connect to the specified VITE_API_URL if it is a remote server.
  if (Capacitor.isNativePlatform()) {
    if (envUrl && !isLocalhostEnv) {
      return `${envUrl.replace(/\/+$/, '')}${normalizedPath}`;
    }
    // Fallback default
    return `https://bunkmate-lilac.vercel.app${normalizedPath}`;
  }

  const isDeployed = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

  if (isDeployed && isLocalhostEnv) {
    return normalizedPath;
  }

  if (!envUrl) {
    return normalizedPath;
  }

  return `${envUrl.replace(/\/+$/, '')}${normalizedPath}`;
};
