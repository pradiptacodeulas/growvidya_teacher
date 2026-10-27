import {
  getMessaging,
  getToken,
  deleteToken,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient, getAuthToken, setAuthToken } from './apiClient';
import { router } from 'expo-router';

// Configure foreground notification presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Configure Android notification channels
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4F46E5',
      sound: 'default',
    });
  }
}

/**
 * Request notification permission, retrieve native Firebase FCM token, and register it with the backend
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    await setupNotificationChannels();

    // 1. Request OS permission for notifications across iOS and Android 13+
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[Push Notification]: Permission not granted by user');
      return null;
    }

    let token: string | null = null;
    let messagingInstance: any = null;

    try {
      messagingInstance = getMessaging();
      if (Platform.OS === 'ios') {
        await registerDeviceForRemoteMessages(messagingInstance).catch(() => {});
      }
      token = await getToken(messagingInstance);
      console.log('[FCM Notification] Successfully retrieved Firebase token:', token);
    } catch (fcmErr) {
      console.warn('[FCM Notification] Native Firebase error, falling back to Expo push token:', fcmErr);
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync().catch(() => null);
        token = tokenData?.data || null;
      } catch {}
    }

    if (!token) {
      console.log('[Push Notification] No token could be obtained');
      return null;
    }

    // Ensure we have active auth token
    let authToken = getAuthToken();
    if (!authToken) {
      authToken = await AsyncStorage.getItem('@auth_token');
      if (!authToken) {
        const saved = await AsyncStorage.getItem('user_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          authToken = parsed?.token || parsed?.data?.token || null;
        }
      }
      if (authToken) {
        setAuthToken(authToken);
      }
    }

    // Send token to Growvidya server via apiClient (axios)
    const deviceType = Platform.OS === 'ios' ? 'ios' : 'android';
    const deviceName = `${Device.manufacturer || ''} ${Device.modelName || (Platform.OS.toUpperCase() + ' Mobile')}`.trim();

    const regResult = await apiClient
      .post(
        '/notifications/device-token',
        {
          token,
          device_type: deviceType,
          device_name: deviceName,
        },
        authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined
      )
      .catch((err: any) => {
        console.warn('[Failed to register push token with server]:', err?.response?.data || err?.message);
        return null;
      });

    console.log('[Push Notification] Backend registration response:', regResult?.data || regResult);

    if (regResult?.data?.success || regResult?.status === 200) {
      await AsyncStorage.setItem('@fcm_push_token', token);

      // Listen for token refresh events if Firebase messaging is active
      if (messagingInstance) {
        try {
          onTokenRefresh(messagingInstance, async (refreshedToken: string) => {
            console.log('[FCM Notification] Token refreshed:', refreshedToken);
            await apiClient
              .post(
                '/notifications/device-token',
                {
                  token: refreshedToken,
                  device_type: deviceType,
                  device_name: deviceName,
                },
                authToken ? { headers: { Authorization: `Bearer ${authToken}` } } : undefined
              )
              .catch(() => {});
            await AsyncStorage.setItem('@fcm_push_token', refreshedToken);
          });
        } catch {}
      }

      return token;
    } else {
      console.warn('[Push Notification] Registration failed or returned non-200');
      return null;
    }
  } catch (err: any) {
    console.error('[registerForPushNotifications Error]:', err?.message || err);
    return null;
  }
}

/**
 * Unregister device push token upon user logout
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem('@fcm_push_token');
    if (token) {
      await apiClient
        .delete('/notifications/device-token', {
          data: { token },
        })
        .catch(() => {});
      await AsyncStorage.removeItem('@fcm_push_token');
    }
    try {
      const messagingInstance = getMessaging();
      await deleteToken(messagingInstance).catch(() => {});
    } catch {}
  } catch (err: any) {
    console.warn('[unregisterPushToken Error]:', err?.message);
  }
}

/**
 * Handle notification data payload and deep link to the target screen
 */
export function handleNotificationData(data: any): void {
  if (!data) return;

  try {
    // If it's a chat message notification
    if (data.senderId || data.sender_id || data.contactId) {
      const contactId = String(data.senderId || data.sender_id || data.contactId);
      const contactRole = String(data.senderRole || data.sender_role || 'student').toLowerCase();
      const contactName = String(data.senderName || data.sender_name || 'Chat');
      router.push({
        pathname: '/chat/[id]',
        params: { id: contactId, role: contactRole, name: contactName },
      });
      return;
    }

    // Leave request update
    if (data.category === 'leave') {
      router.push('/(main)/(drawer)/leaves' as any);
      return;
    }

    // Notice
    if (data.category === 'notice' || data.noticeId) {
      router.push('/(main)/(drawer)/announcement/notice' as any);
      return;
    }

    // Event
    if (data.category === 'event') {
      router.push('/(main)/(drawer)/announcement/event' as any);
      return;
    }

    // Holiday
    if (data.category === 'holiday') {
      router.push('/(main)/(drawer)/announcement/holiday' as any);
      return;
    }

    // Default deep link path
    if (data.url && typeof data.url === 'string') {
      router.push(data.url as any);
    }
  } catch (err: any) {
    console.warn('[handleNotificationData Error]:', err?.message);
  }
}

/**
 * Handle notification tap / interaction and deep link to the target screen (Expo Notifications listener)
 */
export function handleNotificationResponse(response: Notifications.NotificationResponse): void {
  const data: any = response?.notification?.request?.content?.data;
  if (!data) return;
  handleNotificationData(data);
}
