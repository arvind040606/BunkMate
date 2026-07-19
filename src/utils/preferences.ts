import { Preferences } from '@capacitor/preferences';

class AppPreferencesStore {
  private cache = new Map<string, string>();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  public async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        const { keys } = await Preferences.keys();
        for (const key of keys) {
          const { value } = await Preferences.get({ key });
          if (value !== null) {
            this.cache.set(key, value);
          }
        }
        this.initialized = true;
        console.log('Capacitor Preferences synchronized successfully.');
      } catch (err) {
        console.error('Failed to initialize Capacitor Preferences cache:', err);
        // Fallback to legacy localStorage-only mode if preferences fails
        this.initialized = true;
      }
    })();

    return this.initPromise;
  }

  public getItem(key: string): string | null {
    // Return from memory cache if populated
    const cached = this.cache.get(key);
    if (cached !== undefined) return cached;
    // Fallback/fallback sync with localStorage
    return localStorage.getItem(key);
  }

  public setItem(key: string, value: string): void {
    this.cache.set(key, value);
    // Write asynchronously to native preferences
    Preferences.set({ key, value }).catch(err => {
      console.error(`Failed to set Capacitor Preference [${key}]:`, err);
    });
    // Write to localStorage as secondary sync/legacy fallback
    try {
      localStorage.setItem(key, value);
    } catch {}
  }

  public removeItem(key: string): void {
    this.cache.delete(key);
    Preferences.remove({ key }).catch(err => {
      console.error(`Failed to remove Capacitor Preference [${key}]:`, err);
    });
    try {
      localStorage.removeItem(key);
    } catch {}
  }

  public async clear(): Promise<void> {
    this.cache.clear();
    await Preferences.clear();
    try {
      localStorage.clear();
    } catch {}
  }
}

export const appPreferencesStore = new AppPreferencesStore();
