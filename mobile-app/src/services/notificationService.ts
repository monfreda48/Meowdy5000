import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for notification permissions!');
      return false;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Daily Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#90CAF9',
      });
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

export const scheduleDailyReminder = async (hour: number, minute: number): Promise<string | null> => {
  try {
    const granted = await requestNotificationPermissions();
    if (!granted) return null;

    await Notifications.cancelAllScheduledNotificationsAsync();

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚡ Marvel Rivals Stats Reminder',
        body: 'Check your daily win rate and hero mastery updates on Meowdy 5000!',
        sound: true,
      },
      trigger: {
        hour,
        minute,
        repeats: true,
      },
    });

    console.log(`Scheduled daily notification for ${hour}:${minute} with ID: ${id}`);
    return id;
  } catch (error) {
    console.error('Error scheduling daily reminder:', error);
    return null;
  }
};

export const cancelReminder = async (): Promise<void> => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('Cancelled all scheduled notifications.');
  } catch (error) {
    console.error('Error cancelling notifications:', error);
  }
};
