import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  fetchUnreadCount,
  incrementUnreadCount,
  setLastReceivedMessage,
} from '@/redux/features/chat/slice';
import { connectSocket, getSocket, disconnectSocket } from '@/services/socket.service';
import { getAvatarUrl } from '@/services/apiClient';

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

  const receiveMessageRef = useRef<((msg: any) => void) | null>(null);
  const messagesReadRef = useRef<(() => void) | null>(null);

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

          // Display rich in-app notification banner
          const senderName =
            msg.sender_name ||
            (msg.sender_role
              ? msg.sender_role.charAt(0).toUpperCase() + msg.sender_role.slice(1)
              : 'New Message');
          const messagePreview =
            msg.message || (msg.file ? '📎 Sent an attachment' : 'Sent you a message');
          const rawPic = msg.sender_picture || msg.picture || msg.avatar;
          const avatarUrl = rawPic ? getAvatarUrl(rawPic, msg.sender_gender) : null;

          try {
            Toast.show({
              type: 'chat_message',
              text1: senderName,
              text2: messagePreview,
              visibilityTime: 5500,
              topOffset: Platform.OS === 'ios' ? 52 : 36,
              props: {
                senderId: msg.sender,
                senderRole: msg.sender_role,
                avatarUrl,
                time: 'Just now',
              },
              onPress: () => {
                Toast.hide();
                router.push({
                  pathname: '/chat/[id]',
                  params: {
                    id: String(msg.sender),
                    role: String(msg.sender_role || '').toLowerCase(),
                    name: senderName,
                    picture: rawPic || '',
                  },
                });
              },
            });
          } catch (toastErr) {
            console.warn('[GlobalMessageListener] Failed to show chat_message toast, using fallback:', toastErr);
            Toast.show({
              type: 'info',
              text1: senderName,
              text2: messagePreview,
              visibilityTime: 4000,
            });
          }
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
  }, [token, isAuthenticated, dispatch, router]);

  return null;
}
