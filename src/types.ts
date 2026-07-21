export interface Subject {
  id: string;
  name: string;
  code: string;
  room?: string;
  teacher?: string;
  color: string; // Hex color or Tailwind class
  targetPercentage: number; // e.g., 75
  schedule: ScheduleEntry[];
  isPinned?: boolean;
  isArchived?: boolean;
  icon?: string;
  notes?: string;
  initialPresent?: number;
  initialAbsent?: number;
}

export interface ScheduleEntry {
  id: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, etc.
  time: string; // e.g., "10:00 AM" or "14:30"
  duration?: number; // duration in minutes, optional
}

export interface AttendanceRecord {
  id: string;
  subjectId: string;
  date: string; // "YYYY-MM-DD"
  status: 'attended' | 'bunked' | 'cancelled';
  timestamp: number;
}

export interface AppPreferences {
  globalTarget: number;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  pinLockEnabled: boolean;
  pinCode?: string;
  soundEnabled: boolean;
  weekendClassesEnabled: boolean;
  activeNotificationDays: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  examRemindersEnabled: boolean;
  assignmentDeadlinesEnabled: boolean;
  appUpdatesEnabled: boolean;
  manualRemindersEnabled: boolean;
  collegeStartTime?: string; // e.g., "09:00"
  collegeEndTime?: string; // e.g., "17:00"
  dailyClassRemindersEnabled?: boolean; // active scheduled alerts during college hours
  syncEnabled?: boolean;
  syncUsername?: string;
  syncToken?: string;
  syncUserId?: string;
  syncLastSynced?: number;
  syncLastSyncedLocal?: number;
  syncSessionExpired?: boolean;
  syncRecovered?: boolean;
  lastLoggedUserId?: string;
  displayName?: string;
  avatarId?: string;
  major?: string;
  semester?: string;
  collegeName?: string;
  course?: string;
  section?: string;
  group?: string;
  profilePrompted?: boolean;
  customUpdateManifestUrl?: string;
  customDownloadUrlOverride?: string;
  syncDatabaseMode?: 'supabase' | 'ephemeral';
}

export interface Exam {
  id: string;
  subjectId: string;
  title: string;
  date: string; // "YYYY-MM-DD"
  time?: string; // "HH:MM" format
  syllabus?: string;
  room?: string;
  completed?: boolean;
}

export interface Assignment {
  id: string;
  subjectId: string;
  title: string;
  dueDate: string; // "YYYY-MM-DD"
  dueTime?: string; // "HH:MM" format
  description?: string;
  status: 'pending' | 'completed';
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  type: 'warning' | 'success' | 'info' | 'danger';
  read: boolean;
}

export interface AnalyticsSummary {
  totalClasses: number;
  attendedClasses: number;
  bunkedClasses: number;
  cancelledClasses: number;
  overallPercentage: number;
  bunkabilityIndex: number; // 0 - 100 indicator
}
