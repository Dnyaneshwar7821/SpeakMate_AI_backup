import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import api from '../api/api';

let Notifications = null;
try {
  Notifications = require('expo-notifications');
} catch (_) {}

const DAILY_REMINDER_ID = 'speakmate_daily_practice_reminder';

export const NotificationHelper = {
  isAvailable: () => Boolean(Notifications),

  requestPermissions: async () => {
    if (!Notifications) return false;
    try {
      const { status: existing } = await Notifications.getPermissionsAsync();
      if (existing === 'granted') return true;
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch (_) {
      return false;
    }
  },

  registerPushToken: async () => {
    if (!Notifications) return null;
    try {
      const Device = require('expo-device');
      if (!Device.isDevice) return null;
      const granted = await NotificationHelper.requestPermissions();
      if (!granted) return null;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('speakmate-default', {
          name: 'SpeakMate Notifications',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4F46E5',
        });
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData?.data;
      if (token) {
        await api.put('/api/user/push-token', { token }).catch(() => {});
      }
      return token;
    } catch (e) {
      return null;
    }
  },

  scheduleDailyReminder: async (enabled) => {
    if (!Notifications) return;
    try {
      // Always cancel previous reminder first to prevent duplicates
      await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});

      if (!enabled) return;

      const granted = await NotificationHelper.requestPermissions();
      if (!granted) return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('speakmate-reminders', {
          name: 'Study Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 200, 200],
          sound: 'default',
        });
      }

      // Schedule recurring daily reminder for 7:00 PM (19:00)
      await Notifications.scheduleNotificationAsync({
        identifier: DAILY_REMINDER_ID,
        content: {
          title: 'Daily Practice Reminder 📚',
          body: "Don't forget to practice your English today! Even 5 minutes makes a difference.",
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          channelId: 'speakmate-reminders',
        },
        trigger: {
          hour: 19,
          minute: 0,
          repeats: true,
        },
      });
    } catch (e) {
      console.warn('[NotificationHelper] scheduleDailyReminder warning:', e);
    }
  },

  cancelAllReminders: async () => {
    if (!Notifications) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
    } catch (_) {}
  },
};
