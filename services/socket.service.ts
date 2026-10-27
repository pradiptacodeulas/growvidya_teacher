import { io, Socket } from 'socket.io-client';
import { getServerBaseUrl, getAuthToken, setAuthToken } from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

let socket: Socket | null = null;

/**
 * Initialize and connect Socket.IO client for real-time messaging
 */
export const connectSocket = async (explicitToken?: string): Promise<Socket | null> => {
  let token = explicitToken || getAuthToken();

  if (!token) {
    try {
      token = await AsyncStorage.getItem('@auth_token');
      if (!token) {
        const saved = await AsyncStorage.getItem('user_data');
        if (saved) {
          const parsed = JSON.parse(saved);
          token = parsed?.token || parsed?.access_token || parsed?.data?.token || null;
        }
      }
      if (token) {
        setAuthToken(token);
      }
    } catch {
      // ignore
    }
  }

  if (!token) return null;

  const serverUrl = getServerBaseUrl();

  // If socket already exists, ensure it targets the active server URL
  if (socket) {
    const currentUri = (socket as any).io?.uri || (socket as any).uri;
    if (currentUri && currentUri !== serverUrl) {
      console.log('[Socket] Server URL changed from', currentUri, 'to', serverUrl, '- reconnecting');
      socket.disconnect();
      socket = null;
    } else if (socket.connected) {
      return socket;
    } else {
      socket.auth = { token };
      socket.connect();
      return socket;
    }
  }

  socket = io(serverUrl, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to server successfully:', serverUrl);
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
