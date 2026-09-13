import { LocalNotifications } from '@capacitor/local-notifications';

const NOTIFICATION_ID = 5001;
const CHANNEL_ID = 'm5_daily_reminders';

export const initNotificationChannel = async () => {
  if (typeof window === 'undefined' || !window.Capacitor || typeof window.Capacitor.isNativePlatform !== 'function' || !window.Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Daily Check-in Reminders',
      description: 'Daily reminder to check Marvel Rivals match stats and progression',
      importance: 4,
      visibility: 1,
      sound: 'beep.wav',
      vibration: true,
    });
  } catch (e) {
    console.warn('Failed to create notification channel:', e);
  }
};

export const scheduleDailyReminder = async (timeString = '20:00') => {
  if (typeof window === 'undefined' || !window.Capacitor || typeof window.Capacitor.isNativePlatform !== 'function' || !window.Capacitor.isNativePlatform()) return false;

  // Request permissions on Android 13+
  const permStatus = await LocalNotifications.requestPermissions();
  if (permStatus.display !== 'granted') {
    throw new Error('Notification permissions denied.');
  }

  // Parse "HH:MM" (e.g. "20:00")
  const parts = timeString.split(':').map(Number);
  const hours = !isNaN(parts[0]) ? parts[0] : 20;
  const minutes = !isNaN(parts[1]) ? parts[1] : 0;

  const scheduleDate = new Date();
  scheduleDate.setHours(hours, minutes, 0, 0);

  // If selected time already passed today, schedule starting tomorrow
  if (scheduleDate.getTime() <= Date.now()) {
    scheduleDate.setDate(scheduleDate.getDate() + 1);
  }

  // Cancel previous scheduled reminders before creating a new one
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
  } catch (e) { }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: NOTIFICATION_ID,
        title: 'Marvel Rivals Stat Check ⚔️',
        body: "Ready to review your recent matches and check today's rank climb?",
        channelId: CHANNEL_ID,
        schedule: {
          at: scheduleDate,
          repeats: true,
          every: 'day',
          allowWhileIdle: true,
        },
        extra: { route: '/profile' }
      }
    ]
  });

  return true;
};

export const cancelDailyReminder = async () => {
  if (typeof window === 'undefined' || !window.Capacitor || typeof window.Capacitor.isNativePlatform !== 'function' || !window.Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIFICATION_ID }] });
  } catch (e) {
    console.warn('Failed to cancel daily reminder:', e);
  }
};
