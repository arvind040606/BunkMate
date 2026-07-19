import { getApiUrl } from './api';
import { db } from './db';

async function callFriendsApi(body: any) {
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
    displayName?: string | null;
    avatarId?: string | null;
    overallPercentage: number;
    subjects: Array<{
      name: string;
      color: string;
      attendancePercentage: number;
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
  }> {
    return callFriendsApi({ 
      action: 'stats', 
      friendUsername,
      clientLocalDate,
      clientDayOfWeek
    });
  }
};
