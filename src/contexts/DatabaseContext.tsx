import React, { createContext, useContext, useState, useEffect } from 'react';
import { Subject, AttendanceRecord, AppPreferences, NotificationItem, Exam, Assignment } from '../types';
import { databaseService } from '../repositories/DatabaseService';
import { SubjectRepository } from '../repositories/SubjectRepository';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { NotificationRepository } from '../repositories/NotificationRepository';
import { ExamRepository } from '../repositories/ExamRepository';
import { AssignmentRepository } from '../repositories/AssignmentRepository';
import { BackupRepository } from '../repositories/BackupRepository';
import { triggerHaptic, db } from '../utils/db';
import { appPreferencesStore } from '../utils/preferences';

interface DatabaseContextType {
  subjects: Subject[];
  records: AttendanceRecord[];
  preferences: AppPreferences;
  notifications: NotificationItem[];
  exams: Exam[];
  assignments: Assignment[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
  
  // Subject actions
  saveSubject: (subject: Subject) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  
  // Attendance actions
  saveAttendanceRecord: (record: AttendanceRecord) => Promise<void>;
  deleteAttendanceRecord: (id: string) => Promise<void>;
  clearAttendanceRecords: () => Promise<void>;
  
  // Preferences actions
  savePreferences: (prefs: Partial<AppPreferences>) => Promise<void>;
  
  // Notification actions
  addNotification: (title: string, message: string, type: 'warning' | 'success' | 'info' | 'danger') => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  
  // Exam actions
  saveExam: (exam: Exam) => Promise<void>;
  deleteExam: (id: string) => Promise<void>;
  
  // Assignment actions
  saveAssignment: (assignment: Assignment) => Promise<void>;
  deleteAssignment: (id: string) => Promise<void>;
  
  // Backup & Reset actions
  restoreBackup: (parsed: any) => Promise<boolean>;
  resetDatabase: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [subjects, setSubjects] = useState<Subject[]>(db.getSubjects());
  const [records, setRecords] = useState<AttendanceRecord[]>(db.getRecords());
  const [preferences, setPreferences] = useState<AppPreferences>(db.getPrefs());
  const [notifications, setNotifications] = useState<NotificationItem[]>(db.getNotifications());
  const [exams, setExams] = useState<Exam[]>(db.getExams());
  const [assignments, setAssignments] = useState<Assignment[]>(db.getAssignments());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadAllDataFromRepositories = async () => {
    try {
      setSubjects(db.getSubjects());
      setRecords(db.getRecords());
      setPreferences(db.getPrefs());
      setNotifications(db.getNotifications());
      setExams(db.getExams());
      setAssignments(db.getAssignments());
    } catch (err) {
      console.error('DatabaseContext: Failed to load data from in-memory cache:', err);
    }
  };

  useEffect(() => {
    const initDb = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          appPreferencesStore.init(),
          databaseService.initialize()
        ]);
        await db.init();
        await loadAllDataFromRepositories();
      } catch (err) {
        console.error('DatabaseContext: Critical error during database and storage initialization:', err);
      } finally {
        setIsLoading(false);
      }
    };
    initDb();
  }, []);

  const refreshData = async () => {
    await loadAllDataFromRepositories();
  };

  const saveSubject = async (sub: Subject) => {
    await SubjectRepository.save(sub);
    await loadAllDataFromRepositories();
  };

  const deleteSubject = async (id: string) => {
    await SubjectRepository.delete(id);
    await loadAllDataFromRepositories();
  };

  const saveAttendanceRecord = async (record: AttendanceRecord) => {
    await AttendanceRepository.save(record);
    await loadAllDataFromRepositories();
  };

  const deleteAttendanceRecord = async (id: string) => {
    await AttendanceRepository.delete(id);
    await loadAllDataFromRepositories();
  };

  const clearAttendanceRecords = async () => {
    await AttendanceRepository.clear();
    await loadAllDataFromRepositories();
  };

  const savePreferences = async (prefs: Partial<AppPreferences>) => {
    await SettingsRepository.savePrefs(prefs);
    await loadAllDataFromRepositories();
  };

  const addNotification = async (title: string, message: string, type: 'warning' | 'success' | 'info' | 'danger') => {
    const item = await NotificationRepository.add(title, message, type);
    
    // Auto-haptics
    const currentPrefs = preferences || await SettingsRepository.getPrefs();
    if (currentPrefs.hapticsEnabled && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    
    await loadAllDataFromRepositories();
  };

  const markNotificationRead = async (id: string) => {
    await NotificationRepository.markAsRead(id);
    await loadAllDataFromRepositories();
  };

  const markAllNotificationsRead = async () => {
    await NotificationRepository.markAllAsRead();
    await loadAllDataFromRepositories();
  };

  const clearNotifications = async () => {
    await NotificationRepository.clearAll();
    await loadAllDataFromRepositories();
  };

  const saveExam = async (exam: Exam) => {
    await ExamRepository.save(exam);
    await loadAllDataFromRepositories();
  };

  const deleteExam = async (id: string) => {
    await ExamRepository.delete(id);
    await loadAllDataFromRepositories();
  };

  const saveAssignment = async (asg: Assignment) => {
    await AssignmentRepository.save(asg);
    await loadAllDataFromRepositories();
  };

  const deleteAssignment = async (id: string) => {
    await AssignmentRepository.delete(id);
    await loadAllDataFromRepositories();
  };

  const restoreBackup = async (parsed: any): Promise<boolean> => {
    const success = await BackupRepository.restoreBackupData(parsed);
    if (success) {
      await loadAllDataFromRepositories();
    }
    return success;
  };

  const resetDatabase = async () => {
    await databaseService.clearAllData();
    await loadAllDataFromRepositories();
  };

  return (
    <DatabaseContext.Provider
      value={{
        subjects,
        records,
        preferences,
        notifications,
        exams,
        assignments,
        isLoading,
        refreshData,
        saveSubject,
        deleteSubject,
        saveAttendanceRecord,
        deleteAttendanceRecord,
        clearAttendanceRecords,
        savePreferences,
        addNotification,
        markNotificationRead,
        markAllNotificationsRead,
        clearNotifications,
        saveExam,
        deleteExam,
        saveAssignment,
        deleteAssignment,
        restoreBackup,
        resetDatabase
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
