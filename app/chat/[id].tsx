import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  StatusBar,
  Alert,
  Keyboard,
  Modal,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';

import { useAppTheme } from '@/constants/theme';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchUnreadCount, setActiveChatKey } from '@/redux/features/chat/slice';
import { messageService, ChatMessage } from '@/services/messageService';
import { getFileUrl, getAvatarUrl } from '@/services/apiClient';
import { getAvatarInitials, isNonEmptyPicture } from '@/utils/avatar';
import {
  connectSocket,
  emitSendMessage,
  emitTyping,
  emitStopTyping,
  emitMarkRead,
} from '@/services/socket.service';

interface SelectedAttachment {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

export default function ChatScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = Number(
    currentUser?.id ||
    (currentUser as any)?.teacherId ||
    (currentUser as any)?.teacher_id ||
    0
  );

  const params = useLocalSearchParams<{
    id: string;
    role?: string;
    name?: string;
    picture?: string;
    phone?: string;
    email?: string;
    designation?: string;
    child_name?: string;
    class_name?: string;
    section_name?: string;
    code?: string;
  }>();

  const contactId = Number(params.id);
  const contactRole = (params.role || 'parent').toLowerCase();
  const contactName = params.name || `${contactRole.charAt(0).toUpperCase() + contactRole.slice(1)} #${contactId}`;
  const contactPicture = params.picture || '';
  const contactPhone = params.phone || '';
  const contactCode = params.code || '';

  const contactSubtitle = useMemo(() => {
    if (contactRole === 'admin') return params.designation || 'School Administration';
    if (contactRole === 'student') {
      const parts = [];
      if (params.class_name) parts.push(`Class ${params.class_name}`);
      if (params.section_name) parts.push(`Sec ${params.section_name}`);
      return parts.length > 0 ? parts.join(' - ') : 'Student';
    }
    if (contactRole === 'parent') {
      return params.child_name ? `Parent of ${params.child_name}` : 'Parent';
    }
    return contactRole.charAt(0).toUpperCase() + contactRole.slice(1);
  }, [contactRole, params.designation, params.class_name, params.section_name, params.child_name]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [selectedAttachment, setSelectedAttachment] = useState<SelectedAttachment | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [downloadedFiles, setDownloadedFiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [isContactTyping, setIsContactTyping] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [headerImageError, setHeaderImageError] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimerRef = useRef<any>(null);

  // Keyboard visibility listener for bottom inset adjustment
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, () => {
      setIsKeyboardVisible(true);
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setIsKeyboardVisible(false);
    });

    const didHideSub =
      Platform.OS === 'android'
        ? Keyboard.addListener('keyboardDidHide', () => {
            setIsKeyboardVisible(false);
          })
        : null;

    return () => {
      showSub.remove();
      hideSub.remove();
      didHideSub?.remove();
    };
  }, []);

  // Fetch conversation messages
  const fetchConversation = useCallback(
    async (silent = false) => {
      if (!contactId || !contactRole) return;
      if (!silent) setLoading(true);

      try {
        const res = await messageService.getConversation(contactRole, contactId, 50, 0);
        if (res.success) {
          // Inverted FlatList renders newest messages at index 0
          setMessages([...res.messages].reverse());
          setHasMore(Boolean(res.hasMore));
          if (res.contact) {
            setIsOnline(Boolean(res.contact.is_online));
          }

          // Mark messages as read
          messageService.markAsRead(contactId, contactRole);
          emitMarkRead(contactId, contactRole);
          dispatch(fetchUnreadCount());
        }
      } catch (err) {
        console.warn('Failed to fetch conversation:', err);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [contactId, contactRole, dispatch]
  );

  // Load older messages on scroll
  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);

    try {
      const currentOffset = messages.length;
      const res = await messageService.getConversation(
        contactRole,
        contactId,
        50,
        currentOffset
      );

      if (res.success && res.messages.length > 0) {
        const olderReversed = [...res.messages].reverse();
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => String(m.id)));
          const uniqueOlder = olderReversed.filter((m) => !existingIds.has(String(m.id)));
          return [...prev, ...uniqueOlder];
        });
        setHasMore(Boolean(res.hasMore));
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.warn('Failed to load older messages:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Set active chat key to prevent unread badge from incrementing while in this chat
  useEffect(() => {
    dispatch(setActiveChatKey(`${contactRole}_${contactId}`));
    return () => {
      dispatch(setActiveChatKey(null));
    };
  }, [contactId, contactRole, dispatch]);

  // Initial fetch
  useEffect(() => {
    fetchConversation();
  }, [fetchConversation]);

  // Setup real-time Socket.IO listeners
  useEffect(() => {
    let activeSocket: any = null;
    let cleanup: (() => void) | null = null;

    const setupChatSocket = async () => {
      activeSocket = await connectSocket();
      if (!activeSocket) return;

      const handleReceive = (newMsg: any) => {
        const senderId = Number(newMsg.sender);
        const senderRole = (newMsg.sender_role || '').toLowerCase();

        if (senderId === contactId && senderRole === contactRole) {
          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(newMsg.id))) return prev;
            return [newMsg, ...prev];
          });

          // Mark as read immediately
          emitMarkRead(contactId, contactRole);
          messageService.markAsRead(contactId, contactRole);
          dispatch(fetchUnreadCount());
        }
      };

      const handleUserTyping = (data: any) => {
        const sid = Number(data?.senderId || data?.userId);
        const srole = (data?.senderRole || '').toLowerCase();
        if (sid === contactId && srole === contactRole) {
          setIsContactTyping(true);
        }
      };

      const handleUserStopTyping = (data: any) => {
        const sid = Number(data?.senderId || data?.userId);
        const srole = (data?.senderRole || '').toLowerCase();
        if (sid === contactId && srole === contactRole) {
          setIsContactTyping(false);
        }
      };

      const handleMessagesRead = (data: any) => {
        const readerId = Number(data?.readerId);
        const readerRole = (data?.readerRole || '').toLowerCase();
        if (readerId === contactId && readerRole === contactRole) {
          setMessages((prev) => prev.map((m) => ({ ...m, seen: 1 })));
        }
      };

      const handleOnlineList = (onlineKeys: string[]) => {
        if (!Array.isArray(onlineKeys)) return;
        const key = `${contactRole}_${contactId}`;
        setIsOnline(onlineKeys.includes(key));
      };

      const handleUserOnline = (data: any) => {
        if (Number(data?.userId) === contactId && (data?.role || '').toLowerCase() === contactRole) {
          setIsOnline(true);
        }
      };

      const handleUserOffline = (data: any) => {
        if (Number(data?.userId) === contactId && (data?.role || '').toLowerCase() === contactRole) {
          setIsOnline(false);
        }
      };

      const handleMessageDeleted = (data: any) => {
        if (data?.messageId) {
          setMessages((prev) =>
            prev.map((m) =>
              String(m.id) === String(data.messageId)
                ? { ...m, message: 'This message was deleted', file: null, file_type: null, status: 0 }
                : m
            )
          );
        }
      };

      const handleMessageSent = (sentMsg: any) => {
        const receiverId = Number(sentMsg.reciver || sentMsg.receiver);
        const receiverRole = (sentMsg.receiver_role || '').toLowerCase();
        if (receiverId === contactId && receiverRole === contactRole) {
          setMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(sentMsg.id))) return prev;
            return [sentMsg, ...prev];
          });
        }
      };

      activeSocket.on('receive_message', handleReceive);
      activeSocket.on('message_sent', handleMessageSent);
      activeSocket.on('user_typing', handleUserTyping);
      activeSocket.on('user_stop_typing', handleUserStopTyping);
      activeSocket.on('messages_read', handleMessagesRead);
      activeSocket.on('online_users_list', handleOnlineList);
      activeSocket.on('user_online', handleUserOnline);
      activeSocket.on('user_offline', handleUserOffline);
      activeSocket.on('message_deleted', handleMessageDeleted);

      cleanup = () => {
        activeSocket.off('receive_message', handleReceive);
        activeSocket.off('message_sent', handleMessageSent);
        activeSocket.off('user_typing', handleUserTyping);
        activeSocket.off('user_stop_typing', handleUserStopTyping);
        activeSocket.off('messages_read', handleMessagesRead);
        activeSocket.off('online_users_list', handleOnlineList);
        activeSocket.off('user_online', handleUserOnline);
        activeSocket.off('user_offline', handleUserOffline);
        activeSocket.off('message_deleted', handleMessageDeleted);
      };
    };

    setupChatSocket();

    return () => {
      if (cleanup) cleanup();
    };
  }, [contactId, contactRole, dispatch]);

  // Handle typing input
  const handleInputChange = (text: string) => {
    setInputText(text);

    emitTyping(contactId, contactRole);

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      emitStopTyping(contactId, contactRole);
    }, 2000);
  };

  // Pick image from gallery
  const handlePickImage = async () => {
    setShowAttachMenu(false);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedAttachment({
          uri: asset.uri,
          name: asset.fileName || 'Photo.jpg',
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  // Capture photo with camera
  const handleTakePhoto = async () => {
    setShowAttachMenu(false);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedAttachment({
          uri: asset.uri,
          name: asset.fileName || `Photo_${Date.now()}.jpg`,
          type: asset.mimeType || 'image/jpeg',
          size: asset.fileSize,
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  // Pick document / PDF
  const handlePickDocument = async () => {
    setShowAttachMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'image/*',
        ],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedAttachment({
          uri: asset.uri,
          name: asset.name || 'Document.pdf',
          type: asset.mimeType || 'application/pdf',
          size: asset.size,
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to select document');
    }
  };

  // Upload attachment helper
  const uploadAttachmentFile = async (asset: SelectedAttachment) => {
    const formData = new FormData();
    const filename = asset.name || asset.uri.split('/').pop() || 'upload.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = asset.type || (match ? `image/${match[1]}` : 'application/octet-stream');

    formData.append('file', {
      uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
      name: filename,
      type,
    } as any);
    formData.append('folder', 'messages');

    const res = await messageService.uploadAttachment(formData);
    if (!res.success) {
      throw new Error(res.error || 'Failed to upload attachment');
    }

    return {
      filePath: res.filePath || res.fileUrl || '',
      fileType: res.fileType || type,
      fileName: res.fileName || filename,
      url: res.fileUrl || '',
    };
  };

  // Direct download attachment into application folder
  const handleDownloadAttachment = async (url: string, filename?: string) => {
    if (!url || downloadingUrl) return;
    setDownloadingUrl(url);

    try {
      const cleanName = filename || url.split('/').pop() || `file_${Date.now()}`;
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
      const downloadFolder = `${baseDir}downloads/`;

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(downloadFolder);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(downloadFolder, { intermediates: true });
      }

      const destinationUri = `${downloadFolder}${cleanName}`;

      // Check if already downloaded
      const existingInfo = await FileSystem.getInfoAsync(destinationUri);
      if (existingInfo.exists) {
        setDownloadedFiles((prev) => ({ ...prev, [url]: destinationUri }));
        Toast.show({
          type: 'info',
          text1: 'Already downloaded',
        });
        setDownloadingUrl(null);
        return;
      }

      Toast.show({
        type: 'info',
        text1: 'Downloading...',
      });

      const downloadResult = await FileSystem.downloadAsync(url, destinationUri);

      if (downloadResult.status === 200) {
        setDownloadedFiles((prev) => ({ ...prev, [url]: downloadResult.uri }));
        Toast.show({
          type: 'success',
          text1: 'Downloaded successfully',
        });
      } else {
        throw new Error(`Download failed with status ${downloadResult.status}`);
      }
    } catch (err: any) {
      console.warn('Direct download error:', err);
      Toast.show({
        type: 'error',
        text1: 'Download failed',
        text2: 'Please try again',
      });
    } finally {
      setDownloadingUrl(null);
    }
  };

  // Open document using system PDF / document viewer
  const openDocumentWithSystemViewer = async (
    url: string,
    filename?: string,
    fileType?: string
  ) => {
    try {
      const rawName = filename || url.split('/').pop() || 'document.pdf';
      let safeName = rawName.split('?')[0].replace(/[^a-zA-Z0-9._-]/g, '_');

      const isPdf = Boolean(
        (fileType && fileType.toLowerCase().includes('pdf')) ||
        /\.pdf$/i.test(safeName) ||
        /\.pdf$/i.test(url)
      );

      if (isPdf && !safeName.toLowerCase().endsWith('.pdf')) {
        safeName += '.pdf';
      }

      const mimeType = isPdf ? 'application/pdf' : (fileType || '*/*');
      const localDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const destinationUri = `${localDir}${safeName}`;

      const fileInfo = await FileSystem.getInfoAsync(destinationUri);
      let localUri = destinationUri;
      if (!fileInfo.exists) {
        const downloadRes = await FileSystem.downloadAsync(url, destinationUri);
        if (downloadRes.status !== 200 && downloadRes.status !== 304) {
          throw new Error(`Failed to download file (Status ${downloadRes.status})`);
        }
        localUri = downloadRes.uri;
      }
      setDownloadedFiles((prev) => ({ ...prev, [url]: localUri }));

      if (Platform.OS === 'android') {
        try {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(localUri, {
              mimeType,
              dialogTitle: 'Open with',
            });
            return;
          }
        } catch (shareErr) {
          console.warn('Sharing chooser unavailable, falling back to IntentLauncher:', shareErr);
        }

        const contentUri = await FileSystem.getContentUriAsync(localUri);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          flags: 1,
          type: mimeType,
        });
        return;
      }

      await WebBrowser.openBrowserAsync(url);
    } catch (err: any) {
      console.warn('openDocumentWithSystemViewer error:', err);
      Alert.alert(
        'Cannot Open Document',
        'Could not open this document with the system PDF viewer. Please ensure Google Drive, Adobe Acrobat, or another PDF reader app is installed.'
      );
    }
  };

  // Open image in Google Photos or Device Gallery
  const openImageInGallery = async (url: string) => {
    try {
      const rawName = url.split('/').pop() || `photo_${Date.now()}.jpg`;
      let safeName = rawName.split('?')[0].replace(/[^a-zA-Z0-9._-]/g, '_');
      if (!/\.(jpe?g|png|webp|gif)$/i.test(safeName)) {
        safeName += '.jpg';
      }

      const localDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const destinationUri = `${localDir}${safeName}`;

      const fileInfo = await FileSystem.getInfoAsync(destinationUri);
      let localUri = destinationUri;
      if (!fileInfo.exists) {
        const downloadRes = await FileSystem.downloadAsync(url, destinationUri);
        if (downloadRes.status !== 200 && downloadRes.status !== 304) {
          throw new Error(`Failed to load image (Status ${downloadRes.status})`);
        }
        localUri = downloadRes.uri;
      }
      setDownloadedFiles((prev) => ({ ...prev, [url]: localUri }));

      if (Platform.OS === 'android') {
        try {
          const contentUri = await FileSystem.getContentUriAsync(localUri);
          await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1,
            type: 'image/*',
          });
          return;
        } catch (intentErr) {
          console.warn('IntentLauncher gallery view failed, trying chooser:', intentErr);
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(localUri, {
              mimeType: 'image/jpeg',
              dialogTitle: 'Open image with',
            });
            return;
          }
          throw intentErr;
        }
      }

      await WebBrowser.openBrowserAsync(url);
    } catch (err: any) {
      console.warn('openImageInGallery error:', err);
      Alert.alert(
        'Cannot Open Image',
        'Could not open the image in the Photos/Gallery app. Please make sure Google Photos or a Gallery app is installed.'
      );
    }
  };

  // Send message
  const handleSendMessage = async () => {
    const trimmed = inputText.trim();
    if ((!trimmed && !selectedAttachment) || sending || uploadingAttachment) return;

    emitStopTyping(contactId, contactRole);
    setInputText('');
    const attachmentToSend = selectedAttachment;
    setSelectedAttachment(null);
    setSending(true);

    let uploadedFileUrl: string | null = null;
    let uploadedFileType: string | null = null;

    if (attachmentToSend) {
      setUploadingAttachment(true);
      try {
        const uploadRes = await uploadAttachmentFile(attachmentToSend);
        uploadedFileUrl = uploadRes.filePath;
        uploadedFileType = uploadRes.fileType;
      } catch (err: any) {
        setUploadingAttachment(false);
        setSending(false);
        Alert.alert('Upload Failed', err?.message || 'Failed to upload file');
        setSelectedAttachment(attachmentToSend);
        return;
      }
      setUploadingAttachment(false);
    }

    const tempId = `temp_${Date.now()}`;

    const optimisticMessage: ChatMessage = {
      id: tempId,
      sender: currentUserId,
      sender_role: 'teacher',
      reciver: contactId,
      receiver_role: contactRole,
      message: trimmed,
      file: uploadedFileUrl,
      file_type: uploadedFileType,
      time: new Date().toISOString(),
      seen: 0,
      sending: true,
    };

    setMessages((prev) => [optimisticMessage, ...prev]);

    // Try sending over Socket.IO first
    emitSendMessage(
      {
        receiverId: contactId,
        receiverRole: contactRole,
        message: trimmed,
        file: uploadedFileUrl,
        fileType: uploadedFileType,
      },
      (res: any) => {
        if (res?.success && res.data) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...res.data, sending: false } : m))
          );
          setSending(false);
          dispatch(fetchUnreadCount());
        } else {
          // Fallback to REST API
          messageService
            .sendMessage({
              receiverId: contactId,
              receiverRole: contactRole,
              message: trimmed,
              file: uploadedFileUrl,
              fileType: uploadedFileType,
            })
            .then((restRes) => {
              if (restRes.success && restRes.data) {
                setMessages((prev) =>
                  prev.map((m) => (m.id === tempId ? { ...restRes.data!, sending: false } : m))
                );
                dispatch(fetchUnreadCount());
              } else {
                setMessages((prev) => prev.filter((m) => m.id !== tempId));
              }
            })
            .catch(() => {
              setMessages((prev) => prev.filter((m) => m.id !== tempId));
            })
            .finally(() => {
              setSending(false);
            });
        }
      }
    );
  };

  const formatBubbleTime = (timeStr?: string) => {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const isMyMessage = (item: ChatMessage) => {
    const senderId = Number(item.sender);
    const senderRole = (item.sender_role || '').toLowerCase();
    const receiverId = Number(item.reciver || (item as any).receiver);
    const receiverRole = (item.receiver_role || '').toLowerCase();

    // 1. If sender ID matches contact, this is an incoming message from the contact
    if (contactId && senderId === contactId && (!contactRole || senderRole === contactRole)) {
      return false;
    }

    // 2. If receiver ID matches contact, this is an outgoing message sent to the contact
    if (contactId && receiverId === contactId && (!contactRole || receiverRole === contactRole)) {
      return true;
    }

    // 3. Match against current logged-in teacher ID
    if (currentUserId > 0) {
      if (senderId === currentUserId) return true;
      if (receiverId === currentUserId) return false;
    }

    // 4. Role-based fallback
    if (senderRole === 'teacher' && contactRole !== 'teacher') {
      return true;
    }
    if (receiverRole === 'teacher' && contactRole !== 'teacher') {
      return false;
    }

    // 5. Direct ID comparison fallback
    if (contactId && senderId === contactId) return false;
    if (contactId && receiverId === contactId) return true;

    return false;
  };

  const handleLongPressMessage = (item: ChatMessage) => {
    if (!item.id || item.sending || Number(item.status) === 0) return;
    const isOutgoing = isMyMessage(item);
    if (!isOutgoing) return;

    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message for everyone?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const msgId = item.id;
            setMessages((prev) =>
              prev.map((m) =>
                String(m.id) === String(msgId)
                  ? { ...m, message: 'This message was deleted', file: null, file_type: null, status: 0 }
                  : m
              )
            );
            try {
              await messageService.deleteMessage(msgId!);
            } catch (err: any) {
              console.warn('Failed to delete message:', err?.message);
              Alert.alert('Error', err?.message || 'Failed to delete message');
              fetchConversation(true);
            }
          },
        },
      ]
    );
  };


  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isOutgoing = isMyMessage(item);
    const isDeleted = Number(item.status) === 0;
    const fileFullUrl = !isDeleted && item.file ? getFileUrl(item.file) : null;
    const isImage =
      !isDeleted &&
      Boolean(item.file) &&
      (Boolean(item.file_type?.startsWith('image/')) || /\.(png|jpe?g|webp|gif|svg)$/i.test(item.file || ''));
    const isDoc = !isDeleted && Boolean(item.file) && !isImage;

    return (
      <View style={styles.messageItemContainer}>
        <View
          style={[
            styles.messageRow,
            isOutgoing ? styles.outgoingRow : styles.incomingRow,
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={isDeleted ? undefined : () => handleLongPressMessage(item)}
            delayLongPress={300}
            style={[
              styles.bubble,
              isDeleted
                ? [
                    styles.incomingBubble,
                    {
                      backgroundColor: isDark ? colors.surfaceSubtle : '#F1F5F9',
                      borderColor: colors.border,
                      borderStyle: 'dashed' as const,
                    },
                  ]
                : isOutgoing
                ? [styles.outgoingBubble, { backgroundColor: colors.primary }]
                : [
                    styles.incomingBubble,
                    {
                      backgroundColor: isDark ? colors.surfaceSubtle : '#F1F5F9',
                      borderColor: colors.border,
                    },
                  ],
            ]}
          >
            {isDeleted ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="ban-outline" size={13} color={colors.textMuted} />
                <Text
                  style={[
                    styles.messageText,
                    {
                      color: colors.textMuted,
                      fontStyle: 'italic',
                    },
                  ]}
                >
                  {item.message || 'This message was deleted'}
                </Text>
              </View>
            ) : (
              <>
                {/* Image Attachment */}
                {isImage && fileFullUrl && (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setPreviewImage(fileFullUrl)}
                    style={styles.attachmentImageWrapper}
                  >
                    <Image
                      source={{ uri: fileFullUrl }}
                      style={styles.attachmentImage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}

                {/* Document / PDF Attachment */}
                {isDoc && fileFullUrl && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => openDocumentWithSystemViewer(fileFullUrl, item.file?.split('/').pop(), item.file_type || undefined)}
                    style={[
                      styles.docAttachment,
                      {
                        backgroundColor: isOutgoing
                          ? 'rgba(255, 255, 255, 0.16)'
                          : isDark
                          ? colors.surface
                          : '#FFFFFF',
                        borderColor: isOutgoing
                          ? 'rgba(255, 255, 255, 0.25)'
                          : isDark
                          ? colors.border
                          : '#E2E8F0',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.docIconWrapper,
                        {
                          backgroundColor: isOutgoing
                            ? 'rgba(255, 255, 255, 0.25)'
                            : isDark
                            ? colors.primary + '22'
                            : '#EFF6FF',
                        },
                      ]}
                    >
                      <Ionicons
                        name="document-text"
                        size={20}
                        color={isOutgoing ? '#FFFFFF' : colors.primary}
                      />
                    </View>
                    <View style={styles.docInfo}>
                      <Text
                        style={[
                          styles.docName,
                          { color: isOutgoing ? '#FFFFFF' : colors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {item.file?.split('/').pop() || 'Document'}
                      </Text>
                      <Text
                        style={[
                          styles.docAction,
                          {
                            color: isOutgoing
                              ? 'rgba(255, 255, 255, 0.85)'
                              : colors.primary,
                          },
                        ]}
                      >
                        Tap to open in viewer
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.docDownloadBtn}
                      onPress={() => handleDownloadAttachment(fileFullUrl, item.file?.split('/').pop())}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      disabled={downloadingUrl === fileFullUrl}
                    >
                      {downloadingUrl === fileFullUrl ? (
                        <ActivityIndicator size="small" color={isOutgoing ? '#FFFFFF' : colors.primary} />
                      ) : downloadedFiles[fileFullUrl] ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={22}
                          color={isOutgoing ? '#6EE7B7' : '#10B981'}
                        />
                      ) : (
                        <Ionicons
                          name="arrow-down-circle-outline"
                          size={22}
                          color={isOutgoing ? 'rgba(255, 255, 255, 0.95)' : colors.primary}
                        />
                      )}
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}

                {/* Text Message */}
                {Boolean(item.message) && (
                  <Text
                    style={[
                      styles.messageText,
                      { color: isOutgoing ? '#FFFFFF' : colors.text },
                      Boolean(isImage || isDoc) && { marginTop: 6 },
                    ]}
                  >
                    {item.message}
                  </Text>
                )}
              </>
            )}

            <View style={styles.bubbleFooter}>
              <Text
                style={[
                  styles.bubbleTime,
                  {
                    color: isDeleted
                      ? colors.textMuted
                      : isOutgoing
                      ? 'rgba(255, 255, 255, 0.75)'
                      : colors.textMuted,
                  },
                ]}
              >
                {formatBubbleTime(item.time || item.created_at)}
              </Text>

              {!isDeleted && isOutgoing && (
                <View style={styles.checkIconWrapper}>
                  {item.sending ? (
                    <Ionicons name="time-outline" size={12} color="rgba(255, 255, 255, 0.75)" />
                  ) : item.seen === 1 ? (
                    <Ionicons name="checkmark-done" size={14} color="#67E8F9" />
                  ) : (
                    <Ionicons name="checkmark" size={13} color="rgba(255, 255, 255, 0.75)" />
                  )}
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const initials = getAvatarInitials(contactName);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header Bar */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + 8,
            backgroundColor: colors.headerBg,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerAvatarContainer}>
          {isNonEmptyPicture(contactPicture) && !headerImageError ? (
            <Image
              source={{ uri: getAvatarUrl(contactPicture, undefined) }}
              style={styles.headerAvatar}
              onError={() => setHeaderImageError(true)}
            />
          ) : (
            <View style={[styles.headerAvatar, styles.initialsAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.initialsText}>{initials}</Text>
            </View>
          )}
          {isOnline && <View style={styles.headerOnlineBadge} />}
        </View>

        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {contactName}
          </Text>
          <Text
            style={[
              styles.headerSubtitle,
              { color: isContactTyping ? colors.primary : colors.textMuted },
            ]}
            numberOfLines={1}
          >
            {isContactTyping
              ? 'Typing...'
              : isOnline
              ? 'Online'
              : `${contactSubtitle}${contactCode ? ` (${contactCode})` : ''}`}
          </Text>
        </View>

      </View>

      {/* Main Conversation & Input with KeyboardAvoidingView */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : (isKeyboardVisible ? 'height' : undefined)}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Main Chat Message List */}
        {loading ? (
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Loading conversation...
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            inverted
            keyExtractor={(item) => String(item.id)}
            renderItem={renderMessageItem}
            style={styles.messagesList}
            contentContainerStyle={[
              styles.messagesListContent,
              messages.length === 0 && styles.messagesListContentEmpty,
            ]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.2}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubble-ellipses-outline" size={44} color={colors.textMuted} />
                <Text style={[styles.emptyChatTitle, { color: colors.text }]}>
                  No messages yet
                </Text>
                <Text style={[styles.emptyChatSubtitle, { color: colors.textMuted }]}>
                  Say hello to {contactName}! Start a conversation here.
                </Text>
              </View>
            }
          />
        )}

        {/* Selected Attachment Preview Bar */}
        {selectedAttachment && (
          <View
            style={[
              styles.attachmentPreviewBar,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? colors.border : 'rgba(0, 0, 0, 0.08)',
                shadowColor: '#000000',
                shadowOpacity: isDark ? 0.2 : 0.06,
              },
            ]}
          >
            <View
              style={[
                styles.previewIconWrap,
                { backgroundColor: isDark ? colors.surfaceSubtle : '#EFF6FF' },
              ]}
            >
              <Ionicons
                name={selectedAttachment.type.startsWith('image/') ? 'image' : 'document-text'}
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={styles.previewInfo}>
              <Text
                style={[styles.previewName, { color: colors.text }]}
                numberOfLines={1}
              >
                {selectedAttachment.name}
              </Text>
              {selectedAttachment.size ? (
                <Text style={[styles.previewSize, { color: colors.textMuted }]}>
                  {(selectedAttachment.size / 1024).toFixed(0)} KB
                </Text>
              ) : null}
            </View>
            <TouchableOpacity
              onPress={() => setSelectedAttachment(null)}
              style={styles.removeAttachBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        {/* Floating Bottom Input Area */}
        <View
          style={[
            styles.inputContainer,
            {
              paddingBottom: isKeyboardVisible ? 8 : Math.max(insets.bottom, 10),
            },
          ]}
        >
          <View
            style={[
              styles.inputWrapper,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? colors.border : 'rgba(0, 0, 0, 0.07)',
                shadowOpacity: isDark ? 0.15 : 0.04,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.attachIconButton}
              onPress={() => setShowAttachMenu(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              disabled={sending || uploadingAttachment}
              activeOpacity={0.7}
            >
              <Ionicons
                name="add-circle"
                size={26}
                color={colors.primary}
              />
            </TouchableOpacity>

            <TextInput
              style={[
                styles.textInput,
                {
                  color: colors.text,
                },
              ]}
              placeholder={
                selectedAttachment
                  ? 'Add a caption...'
                  : 'Type a message...'
              }
              placeholderTextColor={colors.textMuted}
              value={inputText}
              onChangeText={handleInputChange}
              multiline
              maxLength={1000}
              textAlignVertical="center"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  inputText.trim().length > 0 || selectedAttachment
                    ? colors.primary
                    : isDark
                    ? colors.surfaceSubtle
                    : '#E2E8F0',
                shadowColor:
                  inputText.trim().length > 0 || selectedAttachment ? colors.primary : '#000000',
                shadowOpacity:
                  inputText.trim().length > 0 || selectedAttachment ? 0.18 : 0.04,
              },
            ]}
            onPress={handleSendMessage}
            disabled={
              (inputText.trim().length === 0 && !selectedAttachment) ||
              sending ||
              uploadingAttachment
            }
            activeOpacity={0.8}
          >
            {sending || uploadingAttachment ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons
                name="send"
                size={18}
                color={
                  inputText.trim().length > 0 || selectedAttachment
                    ? '#FFFFFF'
                    : colors.textMuted
                }
                style={{ marginLeft: 2 }}
              />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Attachment Options Action Sheet Modal */}
      <Modal
        visible={showAttachMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttachMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowAttachMenu(false)}
        >
          <View
            style={[
              styles.attachSheet,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 18),
              },
            ]}
          >
            <View style={styles.attachHandle} />
            <Text style={[styles.attachSheetTitle, { color: colors.text }]}>
              Share Attachment
            </Text>
            <View style={styles.attachOptionsRow}>
              <TouchableOpacity
                style={styles.attachOption}
                onPress={handlePickImage}
                activeOpacity={0.8}
              >
                <View style={[styles.attachOptionIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="image" size={24} color="#3B82F6" />
                </View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>
                  Gallery
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachOption}
                onPress={handleTakePhoto}
                activeOpacity={0.8}
              >
                <View style={[styles.attachOptionIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="camera" size={24} color="#10B981" />
                </View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>
                  Camera
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.attachOption}
                onPress={handlePickDocument}
                activeOpacity={0.8}
              >
                <View style={[styles.attachOptionIcon, { backgroundColor: '#FDF2F8' }]}>
                  <Ionicons name="document-text" size={24} color="#EC4899" />
                </View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>
                  Document
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fullscreen Image Preview Modal */}
      <Modal
        visible={previewImage !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <View style={styles.fullscreenBackdrop}>
          <View style={[styles.fullscreenHeader, { top: insets.top + 10 }]}>
            <TouchableOpacity
              style={styles.previewActionBtn}
              onPress={() => setPreviewImage(null)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.fullscreenTitleWrap}>
              <Text style={styles.fullscreenTitle} numberOfLines={1}>
                {contactName}
              </Text>
            </View>

            <View style={styles.fullscreenActions}>
              <TouchableOpacity
                style={styles.previewActionBtn}
                onPress={() => previewImage && openImageInGallery(previewImage)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Ionicons name="images-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.previewActionBtn}
                onPress={() => previewImage && handleDownloadAttachment(previewImage, previewImage.split('/').pop() || 'photo.jpg')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                disabled={Boolean(previewImage && downloadingUrl === previewImage)}
              >
                {previewImage && downloadingUrl === previewImage ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : previewImage && downloadedFiles[previewImage] ? (
                  <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                ) : (
                  <Ionicons name="download-outline" size={22} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: 6,
    padding: 4,
  },
  headerAvatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  initialsAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerOnlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },
  messagesListContent: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  messagesListContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loadingMoreContainer: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageItemContainer: {
    width: '100%',
  },
  messageRow: {
    marginVertical: 4,
    flexDirection: 'row',
    maxWidth: '82%',
  },
  outgoingRow: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  incomingRow: {
    alignSelf: 'flex-start',
    justifyContent: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  outgoingBubble: {
    borderBottomRightRadius: 4,
  },
  incomingBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  attachmentImageWrapper: {
    width: 220,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  attachmentImage: {
    width: '100%',
    height: '100%',
  },
  docAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 200,
    maxWidth: 250,
    gap: 10,
    marginBottom: 4,
  },
  docIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  docName: {
    fontSize: 13,
    fontWeight: '600',
  },
  docAction: {
    fontSize: 11,
    marginTop: 2,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  bubbleTime: {
    fontSize: 10,
  },
  checkIconWrapper: {
    marginLeft: 2,
  },
  emptyChat: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyChatTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyChatSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  messagesList: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  attachmentPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 2,
    gap: 10,
  },
  previewIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewInfo: {
    flex: 1,
  },
  previewName: {
    fontSize: 13,
    fontWeight: '600',
  },
  previewSize: {
    fontSize: 11,
    marginTop: 2,
  },
  removeAttachBtn: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 6,
    backgroundColor: 'transparent',
  },
  inputWrapper: {
    flex: 1,
    marginRight: 8,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  attachIconButton: {
    paddingLeft: 10,
    paddingRight: 4,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    paddingLeft: 4,
    paddingRight: 14,
    paddingTop: Platform.OS === 'ios' ? 12 : 9,
    paddingBottom: Platform.OS === 'ios' ? 12 : 9,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  attachSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  attachHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: 16,
  },
  attachSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  attachOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 12,
  },
  attachOption: {
    alignItems: 'center',
    gap: 8,
    minWidth: 80,
  },
  attachOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenHeader: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  fullscreenTitleWrap: {
    flex: 1,
    marginHorizontal: 12,
  },
  fullscreenTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  fullscreenActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewActionBtn: {
    padding: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    minWidth: 40,
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  docDownloadBtn: {
    padding: 4,
    marginLeft: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '100%',
  },
});
