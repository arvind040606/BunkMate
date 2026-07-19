import { Subject, AttendanceRecord, AnalyticsSummary } from '../types';

export interface SubjectStats {
  subjectId: string;
  subjectName: string;
  color: string;
  code: string;
  totalLogged: number;
  attended: number;
  bunked: number;
  cancelled: number;
  percentage: number;
  target: number;
  status: 'safe' | 'borderline' | 'danger' | 'no_data';
  bunksAvailable: number;
  classesToAttend: number;
}

export class AnalyticsRepository {
  public static calculateSubjectStats(subject: Subject, records: AttendanceRecord[]): SubjectStats {
    const subjRecords = records.filter(r => r.subjectId === subject.id);
    
    const initialPres = subject.initialPresent || 0;
    const initialAbs = subject.initialAbsent || 0;

    const attended = initialPres + subjRecords.filter(r => r.status === 'attended').length;
    const bunked = initialAbs + subjRecords.filter(r => r.status === 'bunked').length;
    const cancelled = subjRecords.filter(r => r.status === 'cancelled').length;
    const totalLogged = attended + bunked;

    let percentage = 100;
    if (totalLogged > 0) {
      percentage = Math.round((attended / totalLogged) * 1000) / 10;
    }

    const target = subject.targetPercentage;
    let status: 'safe' | 'borderline' | 'danger' | 'no_data' = 'no_data';

    if (totalLogged === 0) {
      status = 'no_data';
    } else if (percentage < target) {
      status = 'danger';
    } else if (percentage - target <= 5) {
      status = 'borderline';
    } else {
      status = 'safe';
    }

    let bunksAvailable = 0;
    if (totalLogged > 0 && percentage >= target) {
      bunksAvailable = Math.floor((100 * attended - target * totalLogged) / target);
      if (bunksAvailable < 0) bunksAvailable = 0;
    }

    let classesToAttend = 0;
    if (totalLogged > 0 && percentage < target) {
      const numerator = target * totalLogged - 100 * attended;
      const denominator = 100 - target;
      classesToAttend = Math.ceil(numerator / denominator);
      if (classesToAttend < 0) classesToAttend = 0;
    } else if (totalLogged === 0 && percentage < target) {
      classesToAttend = 1;
    }

    return {
      subjectId: subject.id,
      subjectName: subject.name,
      color: subject.color,
      code: subject.code,
      totalLogged,
      attended,
      bunked,
      cancelled,
      percentage,
      target,
      status,
      bunksAvailable,
      classesToAttend
    };
  }

  public static calculateOverallStats(subjects: Subject[], records: AttendanceRecord[], globalTarget: number): AnalyticsSummary {
    const activeSubjects = subjects.filter(s => !s.isArchived);
    let totalAttended = 0;
    let totalBunked = 0;
    let totalCancelled = 0;

    activeSubjects.forEach(sub => {
      const subRecords = records.filter(r => r.subjectId === sub.id);
      totalAttended += (sub.initialPresent || 0) + subRecords.filter(r => r.status === 'attended').length;
      totalBunked += (sub.initialAbsent || 0) + subRecords.filter(r => r.status === 'bunked').length;
      totalCancelled += subRecords.filter(r => r.status === 'cancelled').length;
    });

    const totalConducted = totalAttended + totalBunked;
    const overallPercentage = totalConducted > 0 
      ? Math.round((totalAttended / totalConducted) * 1000) / 10 
      : 100;

    let dangerCount = 0;
    let safeCount = 0;
    activeSubjects.forEach(sub => {
      const stat = this.calculateSubjectStats(sub, records);
      if (stat.status === 'danger') dangerCount++;
      if (stat.status === 'safe') safeCount++;
    });

    let bunkabilityIndex = 100;
    if (activeSubjects.length > 0) {
      const dangerPenalty = (dangerCount / activeSubjects.length) * 60;
      const neutralCount = activeSubjects.length - dangerCount - safeCount;
      const neutralPenalty = (neutralCount / activeSubjects.length) * 20;
      bunkabilityIndex = Math.max(0, Math.round(100 - dangerPenalty - neutralPenalty));
    }

    return {
      totalClasses: totalConducted,
      attendedClasses: totalAttended,
      bunkedClasses: totalBunked,
      cancelledClasses: totalCancelled,
      overallPercentage,
      bunkabilityIndex
    };
  }

  // Calculate current streak of consecutive "attended" lectures dynamically
  public static calculateCurrentStreak(records: AttendanceRecord[]): number {
    const sorted = [...records].sort((a, b) => b.timestamp - a.timestamp);
    let streak = 0;
    for (const r of sorted) {
      if (r.status === 'attended') {
        streak++;
      } else if (r.status === 'bunked') {
        break; // Streak broken
      }
      // Cancelled records do not break the streak
    }
    return streak;
  }
}
