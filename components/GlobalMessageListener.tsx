import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchUnreadCount,
  incrementUnreadCount,
  setLastReceivedMessage,
} from '@/redux/features/chat/slice';
import { connectSocket, getSocket, disconnectSocket } from '@/services/socket.service';

/**
 * GlobalMessageListener
 * Mounts at the root app level to maintain active real-time socket connection,
 * listen for incoming messages globally, update unread count badges,
 * and display in-app notifications/toasts when messages arrive.
 */
export default function GlobalMessageListener() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const activeChatKey = useAppSelector((state) => state.chat.activeChatKey);

  const activeChatKeyRef = useRef<string | null>(null);
  activeChatKeyRef.current = activeChatKey;

  // Initialize socket and listeners when authenticated
  useEffect(() => {
    if (!token && !isAuthenticated) {
      disconnectSocket();
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      try {
        // 1. Connect socket globally
        const socket = await connectSocket(token || undefined);
        if (!socket || !isMounted) return;

        // 2. Fetch initial unread count for badges
        dispatch(fetchUnreadCount());

        // 3. Attach real-time message handler
        const handleReceiveMessage = (msg: any) => {
          if (!msg) return;

          // Dispatch to redux so chat screens can react
          dispatch(setLastReceivedMessage(msg));

          const currentOpenChat = activeChatKeyRef.current;
          const msgSenderKey = `${String(msg.sender_role).toLowerCase()}_${Number(msg.sender)}`;

          // If the user is currently inside the active chat with this sender, do not alert or increment
          if (currentOpenChat && currentOpenChat.toLowerCase() === msgSenderKey) {
            return;
          }

          // Otherwise, increment unread badge count
          dispatch(incrementUnreadCount());

          // Display in-app notification toast
          const senderName =
            msg.sender_name ||
            (msg.sender_role
              ? msg.sender_role.charAt(0).toUpperCase() + msg.sender_role.slice(1)
              : 'New Message');
          const messagePreview =
            msg.message || (msg.file ? '📎 Sent an attachment' : 'Sent you a message');

          Toast.show({
            type: 'info',
            text1: `💬 ${senderName}`,
            text2: messagePreview,
            visibilityTime: 4500,
            onPress: () => {
              Toast.hide();
              router.push('/(main)/(drawer)/(tabs)/message');
            },
          });
        };

        const handleMessagesRead = () => {
          dispatch(fetchUnreadCount());
        };

        // Remove any prior listeners before attaching to avoid duplicate calls
        socket.off('receive_message', handleReceiveMessage);
        socket.off('messages_read', handleMessagesRead);

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
        socket.off('receive_message');
        socket.off('messages_read');
      }
    };
  }, [token, isAuthenticated, dispatch, router]);

  return null;
}
