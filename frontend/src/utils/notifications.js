export const initNotificationChannel = async () => {
  return;
};

export const scheduleDailyReminder = async (timeString = '20:00') => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      return true;
    }
    const perm = await Notification.requestPermission();
    return perm === 'granted';
  }
  return false;
};

export const cancelDailyReminder = async () => {
  return;
};
