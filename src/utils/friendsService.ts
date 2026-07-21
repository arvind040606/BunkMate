import { getApiUrl } from './api';
import { db } from './db';
import { sqliteService } from '../database/sqlite';
import { updateService } from './updateService';

async function callFriendsApi(body: any) {
  if (updateService.isForceUpdateActive()) {
    throw new Error('A mandatory update is required to access cloud/social features. Please update BunkMate.');
  }
  const token = db.getPrefs().syncToken;
  if (!token) {
    throw new Error('Please login to access social features.');
  }
  const url = getApiUrl('/api/friends');
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  
  if (response.status === 401) {
    import('./syncService').then(({ syncService }) => {
      syncService.logout();
    });
    throw new Error('Session expired. Please log in again.');
  }
  
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to communicate with friends service.');
  }
  return data;
}

export const friendsService = {
  async search(query: string): Promise<{ 
    success: boolean; 
    matches: Array<{ 
      userId: string;
      username: string; 
      displayName?: string | null; 
      avatarId?: string | null; 
    }> 
  }> {
    return callFriendsApi({ action: 'search', query });
  },
  async suggestions(): Promise<{ 
    success: boolean; 
    suggestions: Array<{ 
      userId: string;
      username: string; 
      displayName?: string | null; 
      avatarId?: string | null; 
    }> 
  }> {
    return callFriendsApi({ action: 'suggestions' });
  },
  async sendRequest(friendUsername: string): Promise<{ success: boolean; message: string }> {
    return callFriendsApi({ action: 'request', friendUsername });
  },
  async respond(friendUsername: string, accept: boolean): Promise<{ success: boolean; message: string }> {
    return callFriendsApi({ action: 'respond', friendUsername, accept });
  },
  async list(): Promise<{ 
    success: boolean; 
    friends: Array<{ 
      userId: string;
      username: string; 
      status: 'pending_sent' | 'pending_received' | 'accepted'; 
      isSender: boolean;
      displayName?: string | null;
      avatarId?: string | null;
    }> 
  }> {
    return callFriendsApi({ action: 'list' });
  },
  async getStats(
    friendUsername: string,
    clientLocalDate?: string,
    clientDayOfWeek?: number
  ): Promise<{
    success: boolean;
    username: string;
    userId: string;
    displayName?: string | null;
    avatarId?: string | null;
    collegeName?: string | null;
    course?: string | null;
    major?: string | null;
    semester?: string | null;
    section?: string | null;
    group?: string | null;
    overallPercentage: number;
    present: number;
    absent: number;
    bunks: number;
    safeBunksLeft: number;
    currentStreak: number;
    longestStreak: number;
    subjects: Array<{
      id: string;
      name: string;
      color: string;
      attendancePercentage: number;
      present: number;
      total: number;
      safeBunks: number;
      todayClasses: Array<{ time: string; duration?: number }>;
    }>;
    todaySchedule: Array<{
      id: string;
      subjectName: string;
      subjectColor: string;
      room: string;
      teacher: string;
      time: string;
      duration: number;
      status: 'attended' | 'bunked' | 'scheduled';
    }>;
    tomorrowSchedule: Array<{
      id: string;
      subjectName: string;
      subjectColor: string;
      room: string;
      teacher: string;
      time: string;
      duration: number;
      status: 'attended' | 'bunked' | 'scheduled';
    }>;
    updatedAt?: number;
  }> {
    const cleanUsername = friendUsername.toLowerCase().trim();
    
    // 1. Try to read from local SQLite cache
    let cachedRow: any = null;
    try {
      const res = await sqliteService.executeSql(
        'SELECT stats, updatedAt FROM FriendAttendance WHERE username = ?',
        [cleanUsername]
      );
      if (res.rows.length > 0) {
        cachedRow = res.rows.item(0);
      }
    } catch (err) {
      console.warn('[Friends Cache] Failed to read from SQLite cache:', err);
    }

    const runSilentRefresh = async (existingUpdatedAt: number) => {
      try {
        console.log(`[Friends Cache] Initiating silent background stats refresh for ${cleanUsername}`);
        const freshData = await callFriendsApi({ 
          action: 'stats', 
          friendUsername,
          clientLocalDate,
          clientDayOfWeek
        });
        
        if (freshData && freshData.success) {
          const freshUpdatedAt = freshData.updatedAt || Date.now();
          if (freshUpdatedAt > existingUpdatedAt) {
            console.log(`[Friends Cache] Newer stats received from server for ${cleanUsername} (Server: ${freshUpdatedAt} > Cache: ${existingUpdatedAt}). Updating cache...`);
            
            await sqliteService.executeSql(
              'INSERT OR REPLACE INTO FriendAttendance (username, stats, updatedAt) VALUES (?, ?, ?)',
              [cleanUsername, JSON.stringify(freshData), freshUpdatedAt]
            );
            
            // Notify subscribers so UI reloads automatically
            const { syncService } = await import('./syncService');
            if (syncService && typeof syncService.notifySubscribersOfUserUpdate === 'function') {
              syncService.notifySubscribersOfUserUpdate(freshData.userId, freshData.username);
            }
          } else {
            console.log(`[Friends Cache] Background refresh: No newer stats exist for ${cleanUsername} (Server: ${freshUpdatedAt} <= Cache: ${existingUpdatedAt})`);
          }
        }
      } catch (err) {
        console.warn(`[Friends Cache] Silent background refresh failed for ${cleanUsername}:`, err);
      }
    };

    if (cachedRow) {
      console.log(`[Friends Cache] Cache HIT for friend ${cleanUsername}. Returning cached stats immediately.`);
      let parsedStats: any = null;
      try {
        parsedStats = JSON.parse(cachedRow.stats);
      } catch (e) {
        console.error(`[Friends Cache] Failed to parse cached stats JSON for ${cleanUsername}:`, e);
      }
      
      if (parsedStats) {
        // Trigger silent background refresh
        runSilentRefresh(Number(cachedRow.updatedAt || 0));
        return {
          ...parsedStats,
          success: true
        };
      }
    }

    // 2. Cache Miss: Perform synchronous server fetch and store in cache
    console.log(`[Friends Cache] Cache MISS for friend ${cleanUsername}. Performing synchronous server fetch.`);
    const freshData = await callFriendsApi({ 
      action: 'stats', 
      friendUsername,
      clientLocalDate,
      clientDayOfWeek
    });

    if (freshData && freshData.success) {
      const freshUpdatedAt = freshData.updatedAt || Date.now();
      try {
        await sqliteService.executeSql(
          'INSERT OR REPLACE INTO FriendAttendance (username, stats, updatedAt) VALUES (?, ?, ?)',
          [cleanUsername, JSON.stringify(freshData), freshUpdatedAt]
        );
        console.log(`[Friends Cache] Successfully cached stats for friend ${cleanUsername}.`);
      } catch (err) {
        console.warn('[Friends Cache] Failed to write to SQLite cache:', err);
      }
    }

    return freshData;
  }
};
