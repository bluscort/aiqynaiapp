import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { translate, type Lang } from '@/i18n';

const CHANNEL_ID = 'daily-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Schedules (or re-schedules) the daily "feed the orb" reminder. Returns false if permission is denied. */
export async function scheduleDailyReminder(hour: number, minute: number, lang: Lang): Promise<boolean> {
  if (!(await ensurePermission())) return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Daily reminder',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: translate(lang, 'notifTitle'),
      body: translate(lang, 'notifBody'),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: CHANNEL_ID,
    },
  });
  return true;
}

export async function cancelReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
