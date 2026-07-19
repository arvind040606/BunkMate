import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { AppPreferences, Subject, AttendanceRecord, Exam, Assignment } from '../types';

export class NotificationService {
  private static channelsCreated = false;
  private static debounceTimer: any = null;

  public static async requestPermission(): Promise<boolean> {
    if (Capacitor.getPlatform() === 'web') return true;
    try {
      const check = await LocalNotifications.checkPermissions();
      if (check.display === 'granted') {
        return true;
      }
      const request = await LocalNotifications.requestPermissions();
      return request.display === 'granted';
    } catch (err) {
      console.error('Failed to request notification permissions:', err);
      return false;
    }
  }

  public static async setupChannels(): Promise<void> {
    if (Capacitor.getPlatform() === 'web') return;
    if (this.channelsCreated) return;

    try {
      // Create notification channels with proper importance
      await LocalNotifications.createChannel({
        id: 'academic',
        name: 'Academic',
        description: 'Class attendance and schedule reminders',
        importance: 4, // high
        visibility: 1, // public
        vibration: true
      });

      await LocalNotifications.createChannel({
        id: 'assignments',
        name: 'Assignments',
        description: 'Assignment deadlines and status',
        importance: 4,
        visibility: 1,
        vibration: true
      });

      await LocalNotifications.createChannel({
        id: 'exams',
        name: 'Exams',
        description: 'Exam dates and syllabus details',
        importance: 5, // max
        visibility: 1,
        vibration: true
      });

      await LocalNotifications.createChannel({
        id: 'general',
        name: 'General',
        description: 'General system notifications',
        importance: 3, // default
        visibility: 1,
        vibration: true
      });

      await LocalNotifications.createChannel({
        id: 'ai',
        name: 'AI',
        description: 'AI timetable configuration and suggestions',
        importance: 3,
        visibility: 1,
        vibration: true
      });

      this.channelsCreated = true;
      console.log('Notification channels registered successfully.');
    } catch (err) {
      console.error('Failed to create notification channels:', err);
    }
  }

  public static async schedule(
    id: number,
    title: string,
    body: string,
    channelId: 'academic' | 'assignments' | 'exams' | 'general' | 'ai' = 'general'
  ): Promise<void> {
    try {
      if (Capacitor.getPlatform() !== 'web') {
        await this.setupChannels();
        const granted = await this.requestPermission();
        if (!granted) {
          console.warn('Notification permissions not granted; skipping native alert.');
          return;
        }

        await LocalNotifications.schedule({
          notifications: [
            {
              id,
              title,
              body,
              channelId,
              schedule: { at: new Date(Date.now() + 500) },
              smallIcon: 'ic_launcher',
              actionTypeId: '',
              extra: null
            }
          ]
        });
      }
    } catch (err) {
      console.error('Failed to schedule local notification:', err);
    }
  }

  public static debounceReschedule(
    prefs: AppPreferences,
    subjects: Subject[],
    records: AttendanceRecord[],
    exams: Exam[],
    assignments: Assignment[]
  ) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.rescheduleAll(prefs, subjects, records, exams, assignments).catch(err => {
        console.error('Failed to reschedule notifications:', err);
      });
    }, 1000);
  }

  public static async rescheduleAll(
    prefs: AppPreferences,
    subjects: Subject[],
    records: AttendanceRecord[],
    exams: Exam[],
    assignments: Assignment[]
  ): Promise<void> {
    if (Capacitor.getPlatform() === 'web') return;

    try {
      await this.setupChannels();
      await this.requestPermission();

      // 1. Cancel all currently pending notifications
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map(n => ({ id: n.id }))
        });
      }

      if (!prefs.notificationsEnabled) {
        console.log('Notifications are disabled globally. Cleared all scheduled notifications.');
        return;
      }

      const scheduledNotifications: any[] = [];
      const nowMs = Date.now();

      // 1.5 Welcome Notification (triggers 1 minute after install/first run)
      const welcomeScheduled = localStorage.getItem('bunkmate_welcome_scheduled');
      if (!welcomeScheduled) {
        scheduledNotifications.push({
          id: 9999,
          title: 'Welcome to BunkMate! 🚀🎒',
          body: 'Yo! Thanks for installing BunkMate. Your attendance is safe with us. We got your back! 👊🔥',
          channelId: 'general',
          schedule: { at: new Date(Date.now() + 60 * 1000), allowWhileIdle: true }, // 1 minute from now
          smallIcon: 'ic_launcher'
        });
        localStorage.setItem('bunkmate_welcome_scheduled', 'true');
        console.log('Welcome notification scheduled for 1 minute in the future with allowWhileIdle.');
      }

      // 1.8 Schedule Funny/Crazy Daily Motivational Reminders (3 times a day for the next 7 days)
      const funnyTitles11AM = [
        'Canteen Calling? 🍔🍟',
        'Bunking Class Advisory! 🤫',
        'Picasso Mode? 🎨',
        'Backbenchers Assembly! 🗣️',
        'Emergency Chai Break! ☕',
        'Mass Bunk Protocol? 🚨',
        'Samosa Sighting! 🥟'
      ];
      const funnyBodies11AM = [
        'Bro, the canteen has fresh hot samosas. Is that lecture really worth it? 🤤',
        'Is the professor lecturing in ancient hieroglyphics? Bunkmate suggests a quick escape! 🏃‍♂️',
        'Bunking is an art, and you are the master. Grab some fresh air! 🎨',
        'Back bench whispers say the professor is opening slides. Time to sleep! 💤',
        'High-density lecture detected. Immediate chai/coffee injection recommended! ☕',
        'Rumor has it that half the class is bunking. Will you join the rebellion? ✊🏴‍☠️',
        'Vibes in the hallway are 10x better than the slideshow. Just saying! 🎸'
      ];

      const funnyTitles3PM = [
        'Post-Lunch Coma! 😴💤',
        'Detention Escape Plan! 🛡️',
        'Validation Check! 📈',
        'Vibe Check! 🎸',
        'Gaming Hour? 🎮',
        'Attendance Check! 🥵',
        'Reality Check! ⏱️'
      ];
      const funnyBodies3PM = [
        'Heavy lunch? The back row is the perfect spot for a high-fidelity power nap. 🛌',
        'If you attend this next lecture, you unlock a +5 defense stat against detention! 🛡️',
        'Keep those stats shining! Log your classes before you forget what course you took. 🎓',
        'A quick bunk now gives you a 100% boost in mental wellness. Scientific fact! 🧪',
        'If you slip out now, you can get in a full 2 hours of gaming. Extremely tempting! 🎮',
        'Quick check: Are you still sitting in class or did you successfully sneak out? 👀',
        'Only a few hours left in the college day. You can survive this! Or bunk it. 🤷‍♂️'
      ];

      const funnyTitles7PM = [
        'Daily Reckoning! 🤫',
        'Log or Cry! 😢',
        'Streak Savior! 🔥',
        'Mom Approved? 🧐',
        'System Calibrated? 🚀',
        'Vaporize the Stress! 🌪️',
        'Degree Check! 🎓'
      ];
      const funnyBodies7PM = [
        'Did you attend or bunk today? Tell BunkMate, we promise we won\'t email your parents. 🤫',
        'Log your attendances now or your progress graphs will cry tonight. 😢',
        'Don\'t let your attendance streak freeze! Log today\'s classes and keep the fire burning! 🔥',
        'Your attendance is looking hot. Keep logging to avoid awkward family dinners. 🍽️',
        'Take 2 seconds to check your logs and review tomorrow\'s classes. Be prepared! 🛡️',
        'College day is in the books! Blow off some steam and log those bunks. 💨',
        'Every class logged is one step closer to that shiny graduation cap. Keep it up! 🎓'
      ];

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + dayOffset);
        const dayOfWeek = targetDate.getDay();

        // 11:15 AM
        const date11AM = new Date(targetDate);
        date11AM.setHours(11, 15, 0, 0);
        if (date11AM.getTime() > nowMs) {
          scheduledNotifications.push({
            id: 20000 + dayOffset,
            title: funnyTitles11AM[dayOfWeek % 7],
            body: funnyBodies11AM[dayOfWeek % 7],
            channelId: 'general',
            schedule: { at: date11AM, allowWhileIdle: true },
            smallIcon: 'ic_launcher'
          });
        }

        // 3:15 PM
        const date3PM = new Date(targetDate);
        date3PM.setHours(15, 15, 0, 0);
        if (date3PM.getTime() > nowMs) {
          scheduledNotifications.push({
            id: 21000 + dayOffset,
            title: funnyTitles3PM[dayOfWeek % 7],
            body: funnyBodies3PM[dayOfWeek % 7],
            channelId: 'general',
            schedule: { at: date3PM, allowWhileIdle: true },
            smallIcon: 'ic_launcher'
          });
        }

        // 7:45 PM
        const date7PM = new Date(targetDate);
        date7PM.setHours(19, 45, 0, 0);
        if (date7PM.getTime() > nowMs) {
          scheduledNotifications.push({
            id: 22000 + dayOffset,
            title: funnyTitles7PM[dayOfWeek % 7],
            body: funnyBodies7PM[dayOfWeek % 7],
            channelId: 'general',
            schedule: { at: date7PM, allowWhileIdle: true },
            smallIcon: 'ic_launcher'
          });
        }
      }

      // 2. Schedule Academic / Daily College Reminders
      if (prefs.dailyClassRemindersEnabled) {
        const start = prefs.collegeStartTime || '09:00';
        const end = prefs.collegeEndTime || '17:00';

        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);

        const startMins = startH * 60 + startM;
        const endMins = endH * 60 + endM;

        let midMins = Math.floor(startMins + (endMins - startMins) * 0.44);
        let aftMins = Math.floor(startMins + (endMins - startMins) * 0.75);

        if (endMins <= startMins) {
          midMins = startMins + 180;
          aftMins = startMins + 360;
        }

        const slotMinutes = [startMins, midMins, aftMins, endMins];
        const slotTitles = [
          'College Commencing! 🎒⏰',
          'Mid-Day Bunkie Check! 🥪😎',
          'Survival Check: Keep Logging! ☕💪',
          'College Hours Over! 🚀🎉'
        ];

        // Schedule for the next 7 days (including today)
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + dayOffset);
          const dayOfWeek = targetDate.getDay();

          // Apply weekday suppression
          const activeDays = Array.isArray(prefs.activeNotificationDays)
            ? prefs.activeNotificationDays
            : [0, 1, 2, 3, 4, 5, 6];

          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          if (!activeDays.includes(dayOfWeek)) continue;
          if (isWeekend && !prefs.weekendClassesEnabled) continue;

          // Calculate safety stats dynamically for notification text
          const totalSafeBunks = subjects.reduce((acc, sub) => {
            const subjRecords = records.filter(r => r.subjectId === sub.id);
            const initialPres = sub.initialPresent || 0;
            const initialAbs = sub.initialAbsent || 0;
            const attended = initialPres + subjRecords.filter(r => r.status === 'attended').length;
            const bunked = initialAbs + subjRecords.filter(r => r.status === 'bunked').length;
            const totalLogged = attended + bunked;
            let percentage = 100;
            if (totalLogged > 0) {
              percentage = Math.round((attended / totalLogged) * 1000) / 10;
            }
            if (totalLogged > 0 && percentage >= sub.targetPercentage) {
              return acc + Math.floor((100 * attended - sub.targetPercentage * totalLogged) / sub.targetPercentage);
            }
            return acc;
          }, 0);

          for (let slotIdx = 0; slotIdx < 4; slotIdx++) {
            const slotMin = slotMinutes[slotIdx];
            const slotHour = Math.floor(slotMin / 60) % 24;
            const slotMinute = slotMin % 60;

            const scheduledDate = new Date(targetDate);
            scheduledDate.setHours(slotHour, slotMinute, 0, 0);

            if (scheduledDate.getTime() > nowMs) {
              let body = '';
              if (slotIdx === 0) {
                body = `Your college day has officially started. You have ${totalSafeBunks} safe bunks available today!`;
              } else if (slotIdx === 1) {
                body = `Halfway through! Check your lecture schedule before making canteen decisions!`;
              } else if (slotIdx === 2) {
                body = `Almost done! Keep your attendance logs updated to keep BunkMate stats precise.`;
              } else {
                body = `College is done for today! Take 2 seconds to check your dashboard and review tomorrow's classes.`;
              }

              scheduledNotifications.push({
                id: 1000 + (dayOffset * 4) + slotIdx,
                title: slotTitles[slotIdx],
                body,
                channelId: 'academic',
                schedule: { at: scheduledDate, allowWhileIdle: true },
                smallIcon: 'ic_launcher'
              });
            }
          }
        }
      }

      // 3. Schedule Assignment Reminders
      if (prefs.assignmentDeadlinesEnabled) {
        let assIndex = 0;
        for (const ass of assignments) {
          if (ass.status !== 'completed' && ass.dueDate) {
            const [year, month, day] = ass.dueDate.split('-').map(Number);
            const [hour, min] = (ass.dueTime || '23:59').split(':').map(Number);
            const dueDateObj = new Date(year, month - 1, day, hour, min, 0);

            if (dueDateObj.getTime() > nowMs) {
              scheduledNotifications.push({
                id: 3000 + assIndex,
                title: `Assignment Due! 📝`,
                body: `"${ass.title}" is due soon. Don't forget to submit and update BunkMate!`,
                channelId: 'assignments',
                schedule: { at: dueDateObj, allowWhileIdle: true },
                smallIcon: 'ic_launcher'
              });
              assIndex++;
            }
          }
        }
      }

      // 4. Schedule Exam Reminders
      if (prefs.examRemindersEnabled) {
        let examIndex = 0;
        for (const exam of exams) {
          if (!exam.completed && exam.date) {
            const [year, month, day] = exam.date.split('-').map(Number);
            const [hour, min] = (exam.time || '09:00').split(':').map(Number);
            const examDateObj = new Date(year, month - 1, day, hour, min, 0);

            if (examDateObj.getTime() > nowMs) {
              const reminderTime = new Date(examDateObj.getTime() - 2 * 60 * 60 * 1000);
              if (reminderTime.getTime() > nowMs) {
                scheduledNotifications.push({
                  id: 5000 + examIndex,
                  title: `Upcoming Exam: ${exam.title} 🎓`,
                  body: `Your exam starts in 2 hours. Location: ${exam.room || 'N/A'}. Good luck!`,
                  channelId: 'exams',
                  schedule: { at: reminderTime, allowWhileIdle: true },
                  smallIcon: 'ic_launcher'
                });
                examIndex++;
              }
            }
          }
        }
      }

      if (scheduledNotifications.length > 0) {
        await LocalNotifications.schedule({
          notifications: scheduledNotifications
        });
        console.log(`Successfully scheduled ${scheduledNotifications.length} native local notifications.`);
      }
    } catch (err) {
      console.error('Failed to reschedule native local notifications:', err);
    }
  }
}
