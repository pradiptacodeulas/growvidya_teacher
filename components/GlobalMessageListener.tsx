import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchUnreadCount,
  incrementUnreadCount,
  setLastReceivedMessage,
} from '@/redux/features/chat/slice';
import { connectSocket, getSocket, disconnectSocket } from '@/services/socket.service';
import * as Notifications from 'expo-notifications';
import {
  getMessaging,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  RemoteMessage,
} from '@react-native-firebase/messaging';
import {
  registerForPushNotificationsAsync,
  unregisterPushToken,
  handleNotificationResponse,
  handleNotificationData,
} from '@/services/notification.service';

/**
 * GlobalMessageListener
 * Mounts at the root app level to maintain active real-time socket connection,
 * listen for incoming messages globally, update unread count badges,
 * and display system push notifications when messages arrive (without in-app toast banners).
 */
export default function GlobalMessageListener() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const activeChatKey = useAppSelector((state) => state.chat.activeChatKey);

  const activeChatKeyRef = useRef<string | null>(null);
  activeChatKeyRef.current = activeChatKey;

  const receiveMessageRef = useRef<((msg: any) => void) | null>(null);
  const messagesReadRef = useRef<(() => void) | null>(null);

  // Set of recently notified message IDs to prevent duplicate alerts between Socket and FCM
  const recentNotifiedIdsRef = useRef<Set<string>>(new Set());

  const markMessageNotified = (key: string): boolean => {
    if (!key) return false;
    if (recentNotifiedIdsRef.current.has(key)) return false;
    recentNotifiedIdsRef.current.add(key);
    setTimeout(() => {
      recentNotifiedIdsRef.current.delete(key);
    }, 15000);
    return true;
  };

  // Setup push notification tap response listener (deep link on notification click)
  useEffect(() => {
    const responseSub = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);
    return () => {
      responseSub.remove();
    };
  }, []);

  // Setup Firebase Cloud Messaging notification listeners (foreground and tap routing)
  useEffect(() => {
    let unsubscribeForeground = () => {};
    let unsubscribeNotificationOpened = () => {};

    try {
      const messagingInstance = getMessaging();

      // 1. App in foreground: listen for incoming remote messages
      unsubscribeForeground = onMessage(messagingInstance, async (remoteMessage: RemoteMessage) => {
        console.log('[FCM Foreground Message Received]:', remoteMessage);

        const isChat = remoteMessage.data?.type === 'chat' || Boolean(remoteMessage.data?.senderId);
        const socketConnected = getSocket()?.connected;

        // If socket is connected and this is a chat message, let the socket handler handle it
        if (isChat && socketConnected) {
          return;
        }

        const msgKey =
          remoteMessage.messageId ||
          (remoteMessage.data?.messageId ? String(remoteMessage.data.messageId) : null);

        if (msgKey && !markMessageNotified(msgKey)) {
          return; // Duplicate
        }

        if (remoteMessage.notification) {
          const title = remoteMessage.notification.title || 'Growvidya Alert';
          const body = remoteMessage.notification.body || '';

          // Display Android system tray push notification with sound
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              data: remoteMessage.data || {},
              sound: 'default',
            },
            trigger: null,
          }).catch(() => {});
        }
      });

      // 2. Notification opened when app was in BACKGROUND
      unsubscribeNotificationOpened = onNotificationOpenedApp(messagingInstance, (remoteMessage: RemoteMessage) => {
        console.log('[FCM Notification Opened from Background]:', remoteMessage);
        if (remoteMessage?.data) {
          handleNotificationData(remoteMessage.data);
        }
      });

      // 3. Notification opened from cold start / KILLED state
      getInitialNotification(messagingInstance)
        .then((remoteMessage: RemoteMessage | null) => {
          if (remoteMessage?.data) {
            console.log('[FCM Notification Opened from Cold Start]:', remoteMessage);
            handleNotificationData(remoteMessage.data);
          }
        })
        .catch(() => {});
    } catch (e) {
      console.warn('[FCM Listener Init Warning]:', e);
    }

    return () => {
      unsubscribeForeground();
      unsubscribeNotificationOpened();
    };
  }, []);

  // Initialize socket and listeners when authenticated
  useEffect(() => {
    if (!token && !isAuthenticated) {
      unregisterPushToken().catch(() => {});
      disconnectSocket();
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      try {
        // Register device push token with backend
        registerForPushNotificationsAsync().catch(() => {});

        // 1. Connect socket globally
        const socket = await connectSocket(token || undefined);
        if (!socket || !isMounted) return;

        // 2. Fetch initial unread count for badges
        dispatch(fetchUnreadCount());

        // 3. Attach real-time message handler
        const handleReceiveMessage = (msg: any) => {
          if (!msg) return;

          console.log('[GlobalMessageListener] Received incoming message:', msg);

          // Dispatch to redux so chat screens can react
          dispatch(setLastReceivedMessage(msg));

          const currentOpenChat = activeChatKeyRef.current;
          const msgSenderKey = `${String(msg.sender_role || '').toLowerCase()}_${Number(msg.sender)}`;

          console.log(
            `[GlobalMessageListener] currentOpenChat: "${currentOpenChat}", msgSenderKey: "${msgSenderKey}"`
          );

          // If the user is currently inside the active chat with this sender, do not alert or increment
          if (currentOpenChat && currentOpenChat.toLowerCase() === msgSenderKey) {
            console.log('[GlobalMessageListener] Notification suppressed: chat currently active on screen');
            return;
          }

          // Otherwise, increment unread badge count
          dispatch(incrementUnreadCount());

          // Deduplicate notification
          const msgKey = msg.id ? `msg_${msg.id}` : `${msgSenderKey}_${msg.message || ''}_${Date.now()}`;
          if (!markMessageNotified(msgKey)) {
            return;
          }

          const senderName =
            msg.sender_name ||
            (msg.sender_role
              ? msg.sender_role.charAt(0).toUpperCase() + msg.sender_role.slice(1)
              : 'New Message');
          const messagePreview =
            msg.message || (msg.file ? '📎 Sent an attachment' : 'Sent you a message');

          // Schedule local heads-up push notification in Android notification bar with sound/vibration
          Notifications.scheduleNotificationAsync({
            content: {
              title: senderName,
              body: messagePreview,
              data: {
                senderId: msg.sender,
                senderRole: msg.sender_role,
                senderName,
                message: messagePreview,
              },
              sound: 'default',
            },
            trigger: null,
          }).catch(() => {});
        };

        const handleMessagesRead = () => {
          dispatch(fetchUnreadCount());
        };

        // Remove any prior listeners registered by this listener before attaching new ones
        if (receiveMessageRef.current) {
          socket.off('receive_message', receiveMessageRef.current);
        }
        if (messagesReadRef.current) {
          socket.off('messages_read', messagesReadRef.current);
        }

        receiveMessageRef.current = handleReceiveMessage;
        messagesReadRef.current = handleMessagesRead;

        socket.on('receive_message', handleReceiveMessage);
        socket.on('messages_read', handleMessagesRead);
      } catch (err) {
        console.warn('[GlobalMessageListener Init Warning]:', err);
      }
    };

    initialize();

    // App state listener to re-verify socket connection when returning to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && token) {
        const activeSocket = getSocket();
        if (!activeSocket || !activeSocket.connected) {
          connectSocket(token);
        }
        dispatch(fetchUnreadCount());
      }
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isMounted = false;
      appStateSubscription.remove();
      const socket = getSocket();
      if (socket) {
        if (receiveMessageRef.current) {
          socket.off('receive_message', receiveMessageRef.current);
          receiveMessageRef.current = null;
        }
        if (messagesReadRef.current) {
          socket.off('messages_read', messagesReadRef.current);
          messagesReadRef.current = null;
        }
      }
    };
  }, [token, isAuthenticated, dispatch]);

  return null;
}
