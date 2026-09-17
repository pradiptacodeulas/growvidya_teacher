import { io, Socket } from 'socket.io-client';
import { getServerBaseUrl, getAuthToken } from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

let socket: Socket | null = null;

/**
 * Initialize and connect Socket.IO client for real-time messaging
 */
export const connectSocket = async (explicitToken?: string): Promise<Socket | null> => {
  let token = explicitToken || getAuthToken();

  if (!token) {
    try {
      const saved = await AsyncStorage.getItem('user_data');
      if (saved) {
        const parsed = JSON.parse(saved);
        token = parsed?.token || parsed?.data?.token || null;
      }
    } catch {
      // ignore
    }
  }

  if (!token) return null;

  if (socket && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.auth = { token };
    socket.connect();
    return socket;
  }

  const serverUrl = getServerBaseUrl();

  socket = io(serverUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    // Socket connected successfully
  });

  socket.on('connect_error', (error) => {
    console.warn('[Socket Connection Warning]:', error?.message);
  });

  return socket;
};

/**
 * Get active socket instance
 */
export const getSocket = (): Socket | null => {
  return socket;
};

/**
 * Disconnect socket on logout or background
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Send real-time message via socket with response callback
 */
export const emitSendMessage = (
  payload: {
    receiverId: number | string;
    receiverRole: string;
    message?: string;
    file?: string | null;
    fileType?: string | null;
  },
  callback?: (res: any) => void
) => {
  if (socket && socket.connected) {
    let responded = false;
    const timer = setTimeout(() => {
      if (!responded) {
        responded = true;
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Socket response timed out' });
        }
      }
    }, 6000);

    try {
      socket.emit('send_message', payload, (response: any) => {
        if (!responded) {
          responded = true;
          clearTimeout(timer);
          if (typeof callback === 'function') {
            callback(response);
          }
        }
      });
    } catch (err: any) {
      if (!responded) {
        responded = true;
        clearTimeout(timer);
        if (typeof callback === 'function') {
          callback({ success: false, error: err?.message });
        }
      }
    }
  } else if (typeof callback === 'function') {
    callback({ success: false, error: 'Socket not connected' });
  }
};

/**
 * Emit typing indicator
 */
export const emitTyping = (receiverId: number | string, receiverRole: string) => {
  if (socket && socket.connected) {
    socket.emit('typing', { receiverId: Number(receiverId), receiverRole });
  }
};

/**
 * Emit stop typing indicator
 */
export const emitStopTyping = (receiverId: number | string, receiverRole: string) => {
  if (socket && socket.connected) {
    socket.emit('stop_typing', { receiverId: Number(receiverId), receiverRole });
  }
};

/**
 * Mark conversation messages as read
 */
export const emitMarkRead = (
  senderId: number | string,
  senderRole: string,
  callback?: (res: any) => void
) => {
  if (socket && socket.connected) {
    socket.emit('mark_read', { senderId: Number(senderId), senderRole }, callback);
  } else if (typeof callback === 'function') {
    callback({ success: false });
  }
};
