import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/constants/theme';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setActiveChatKey, fetchUnreadCount } from '@/redux/features/chat/slice';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as WebBrowser from 'expo-web-browser';
import { apiClient, getAvatarUrl, getFileUrl } from '@/services/apiClient';
import {
  connectSocket,
  getSocket,
  emitSendMessage,
  emitTyping,
  emitStopTyping,
  emitMarkRead,
} from '@/services/socket.service';

export interface ChatMessage {
  id?: number;
  school_id?: number;
  sender: number;
  sender_role: string;
  reciver: number;
  receiver_role: string;
  type?: number;
  message: string;
  file: string | null;
  file_type: string | null;
  time: string;
  seen: number;
  status?: number;
}

const getInitials = (name?: string): string => {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0].charAt(0).toUpperCase()}${parts[parts.length - 1].charAt(0).toUpperCase()}`;
};

const isNonEmptyPicture = (pic?: string | null): boolean => {
  if (!pic || typeof pic !== 'string') return false;
  const p = pic.trim().toLowerCase();
  if (p === '' || p === 'null' || p === 'undefined') return false;
  if (p.includes('male-user.png') || p.includes('female-user.png') || p.includes('placeholder')) {
    return false;
  }
  return true;
};

export default function ChatRoomScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const token = useAppSelector((state) => state.auth.token);
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id ? Number(currentUser.id) : 0;

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
  }>();

  const contactId = Number(params.id);
  const contactRole = (params.role || 'parent').toLowerCase();
  const contactName = params.name || `${contactRole.charAt(0).toUpperCase() + contactRole.slice(1)} #${contactId}`;
  const contactPicture = params.picture || null;
  const contactPhone = params.phone || '';

  // Local Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isContactTyping, setIsContactTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [headerImageError, setHeaderImageError] = useState(false);

  const contactInitials = useMemo(() => getInitials(contactName), [contactName]);
  const hasContactPic = isNonEmptyPicture(contactPicture);

  // Attachment states
  const [selectedAttachment, setSelectedAttachment] = useState<{
    uri: string;
    name: string;
    type: string;
    size?: number;
  } | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Format subtitle info (Class, Section, or Role)
  const contactSubText = useMemo(() => {
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

  // Load conversation messages
  const loadConversation = useCallback(async () => {
    if (!contactId) return;
    setIsChatLoading(true);
    try {
      const res = await apiClient.get(`/messages/${contactRole}/${contactId}`);
      const list = res.data?.data?.messages || res.data?.messages || [];
      if (Array.isArray(list)) {
        setChatMessages(list);
      } else {
        setChatMessages([]);
      }
    } catch (err: any) {
      console.warn('[ChatRoom] loadConversation exception:', err?.message);
    } finally {
      setIsChatLoading(false);
    }
  }, [contactId, contactRole]);

  // Register active chat key & Socket listeners
  useEffect(() => {
    if (!contactId) return;

    const chatKey = `${contactRole}_${contactId}`;
    dispatch(setActiveChatKey(chatKey));

    // Mark messages as read via socket and REST
    emitMarkRead(contactId, contactRole);
    apiClient.post('/messages/read', {
      senderId: contactId,
      senderRole: contactRole,
    }).then(() => {
      dispatch(fetchUnreadCount());
    }).catch(() => {});

    loadConversation();

    let activeSocket = getSocket();
    let handlers: Record<string, (...args: any[]) => void> = {};

    const setupSocket = async () => {
      if (!activeSocket) {
        activeSocket = await connectSocket(token || undefined);
      }
      if (!activeSocket) return;

      const handleReceiveMessage = (msg: ChatMessage) => {
        if (
          msg.sender === contactId &&
          msg.sender_role.toLowerCase() === contactRole
        ) {
          setChatMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(msg.id))) return prev;
            return [...prev, msg];
          });
          emitMarkRead(contactId, contactRole);
          apiClient.post('/messages/read', {
            senderId: contactId,
            senderRole: contactRole,
          }).then(() => {
            dispatch(fetchUnreadCount());
          }).catch(() => {});
        }
      };

      const handleMessageSent = (sentMsg: ChatMessage) => {
        if (
          sentMsg.reciver === contactId &&
          sentMsg.receiver_role.toLowerCase() === contactRole
        ) {
          setChatMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(sentMsg.id))) return prev;
            return [...prev, sentMsg];
          });
        }
      };

      const handleMessagesRead = ({ readerId, readerRole }: any) => {
        if (
          Number(readerId) === contactId &&
          String(readerRole).toLowerCase() === contactRole
        ) {
          setChatMessages((prev) =>
            prev.map((m) =>
              m.sender === currentUserId && m.sender_role === 'teacher' ? { ...m, seen: 1 } : m
            )
          );
        }
      };

      const handleUserTyping = ({ senderId, senderRole }: any) => {
        if (
          Number(senderId) === contactId &&
          String(senderRole).toLowerCase() === contactRole
        ) {
          setIsContactTyping(true);
        }
      };

      const handleUserStopTyping = ({ senderId, senderRole }: any) => {
        if (
          Number(senderId) === contactId &&
          String(senderRole).toLowerCase() === contactRole
        ) {
          setIsContactTyping(false);
        }
      };

      const handleMessageDeleted = ({ messageId }: any) => {
        setChatMessages((prev) =>
          prev.map((m) =>
            Number(m.id) === Number(messageId)
              ? { ...m, message: 'This message was deleted', file: null, file_type: null, status: 0 }
              : m
          )
        );
      };

      const handleUserOnline = ({ userId, role }: any) => {
        if (Number(userId) === contactId && String(role).toLowerCase() === contactRole) {
          setIsOnline(true);
        }
      };

      const handleUserOffline = ({ userId, role }: any) => {
        if (Number(userId) === contactId && String(role).toLowerCase() === contactRole) {
          setIsOnline(false);
        }
      };

      const handleOnlineUsersList = (onlineKeys: string[]) => {
        if (!Array.isArray(onlineKeys)) return;
        const set = new Set(onlineKeys.map((k) => k.toLowerCase()));
        setIsOnline(set.has(`${contactRole}_${contactId}`));
      };

      handlers = {
        receive_message: handleReceiveMessage,
        message_sent: handleMessageSent,
        messages_read: handleMessagesRead,
        user_typing: handleUserTyping,
        user_stop_typing: handleUserStopTyping,
        message_deleted: handleMessageDeleted,
        user_online: handleUserOnline,
        user_offline: handleUserOffline,
        online_users_list: handleOnlineUsersList,
      };

      Object.entries(handlers).forEach(([evt, fn]) => {
        activeSocket?.on(evt, fn);
      });
    };

    setupSocket();

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      emitStopTyping(contactId, contactRole);
      dispatch(setActiveChatKey(null));
      dispatch(fetchUnreadCount());

      if (activeSocket) {
        Object.entries(handlers).forEach(([evt, fn]) => {
          activeSocket?.off(evt, fn);
        });
      }
    };
  }, [contactId, contactRole, currentUserId, dispatch, loadConversation]);

  // Typing handler
  const handleInputChange = (text: string) => {
    setInputMessage(text);
    if (!contactId) return;

    if (text.length > 0) {
      emitTyping(contactId, contactRole);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        emitStopTyping(contactId, contactRole);
      }, 2000);
    } else {
      emitStopTyping(contactId, contactRole);
    }
  };

  // Upload attachment helper
  const uploadAttachment = async (asset: { uri: string; name?: string; type?: string }) => {
    const formData = new FormData();
    const filename = asset.name || asset.uri.split('/').pop() || 'upload.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = asset.type || (match ? `image/${match[1]}` : 'application/octet-stream');

    formData.append('file', {
      uri: Platform.OS === 'android' ? asset.uri : asset.uri.replace('file://', ''),
      name: filename,
      type,
    } as any);

    let response;
    try {
      response = await apiClient.post('/upload?folder=messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 30000,
      });
    } catch (uploadErr: any) {
      if (uploadErr?.response?.status === 404) {
        response = await apiClient.post('/upload/single?folder=messages', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 30000,
        });
      } else {
        throw uploadErr;
      }
    }

    const resData = response.data?.data || response.data;
    return {
      filePath: resData?.file_path || resData?.url || '',
      fileType: resData?.mimetype || type,
      fileName: resData?.file_name || filename,
      url: resData?.url || '',
    };
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
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  // Pick document
  const handlePickDocument = async () => {
    setShowAttachMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
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

  // Send message
  const handleSendMessage = async () => {
    const text = inputMessage.trim();
    if (!text && !selectedAttachment) return;

    setIsSending(true);
    emitStopTyping(contactId, contactRole);

    try {
      let uploadedFileUrl: string | null = null;
      let uploadedFileType: string | null = null;

      if (selectedAttachment) {
        const uploadRes = await uploadAttachment(selectedAttachment);
        uploadedFileUrl = uploadRes.filePath;
        uploadedFileType = uploadRes.fileType;
      }

      const payload = {
        receiverId: contactId,
        receiverRole: contactRole,
        message: text,
        file: uploadedFileUrl,
        fileType: uploadedFileType,
      };

      const socket = getSocket();
      if (socket && socket.connected) {
        emitSendMessage(payload, (res) => {
          if (res && res.success && res.data) {
            setChatMessages((prev) => {
              if (prev.some((m) => String(m.id) === String(res.data.id))) return prev;
              return [...prev, res.data];
            });
          }
        });
      } else {
        const res = await apiClient.post('/messages/send', payload);
        const saved = res.data?.data || res.data;
        if (saved) {
          setChatMessages((prev) => [...prev, saved]);
        }
      }

      setInputMessage('');
      setSelectedAttachment(null);
    } catch (err: any) {
      console.warn('[ChatRoom] handleSendMessage error:', err?.message);
      Alert.alert('Send Failed', err?.message || 'Unable to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Format message timestamp
  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return String(dateStr);
    }
  };

  // Long press message options
  const handleLongPressMessage = (item: ChatMessage) => {
    if (!item.id || Number(item.status) === 0) return;
    const isUser = item.sender === currentUserId && item.sender_role === 'teacher';
    if (!isUser) return;

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
            setChatMessages((prev) =>
              prev.map((m) =>
                m.id === msgId
                  ? { ...m, message: 'This message was deleted', file: null, file_type: null, status: 0 }
                  : m
              )
            );
            try {
              await apiClient.delete(`/messages/${msgId}`);
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to delete message');
              loadConversation();
            }
          },
        },
      ]
    );
  };

  // Handle call contact if phone number exists
  const handleCall = () => {
    if (!contactPhone) return;
    Linking.openURL(`tel:${contactPhone}`).catch(() => {
      Alert.alert('Error', 'Unable to initiate phone call.');
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
            paddingTop: insets.top > 0 ? insets.top + 8 : 14,
          },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.avatarContainer}>
          {!hasContactPic || headerImageError ? (
            <View style={[styles.avatar, styles.initialsAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.initialsText}>{contactInitials}</Text>
            </View>
          ) : (
            <Image
              source={{ uri: getAvatarUrl(contactPicture, undefined) }}
              style={styles.avatar}
              onError={() => setHeaderImageError(true)}
            />
          )}
          {isOnline && <View style={styles.onlineBadge} />}
        </View>

        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
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
              ? '✍️ typing...'
              : isOnline
              ? '🟢 Online'
              : `Offline • ${contactSubText}`}
          </Text>
        </View>

        {Boolean(contactPhone) && (
          <TouchableOpacity style={styles.callBtn} onPress={handleCall} activeOpacity={0.7}>
            <Ionicons name="call-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Main Conversation Area with Native Keyboard Avoidance */}
      <KeyboardAvoidingView
        style={styles.contentContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {isChatLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading messages...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={chatMessages}
            keyExtractor={(item, index) => (item.id != null ? String(item.id) : String(index))}
            contentContainerStyle={styles.messagesListContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            ListHeaderComponent={
              <View style={styles.chatHeaderNotice}>
                <Text
                  style={[
                    styles.encryptedNotice,
                    { color: colors.textMuted, backgroundColor: colors.surfaceSubtle },
                  ]}
                >
                  🔒 End-to-end encrypted school communication
                </Text>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.emptyChatContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyChatTitle, { color: colors.text }]}>No messages yet</Text>
                <Text style={[styles.emptyChatText, { color: colors.textMuted }]}>
                  Start the conversation with {contactName}!
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isUser = item.sender === currentUserId && item.sender_role === 'teacher';
              const isDeleted = Number(item.status) === 0;
              const fileFullUrl = !isDeleted && item.file ? getFileUrl(item.file) : null;
              const isImage =
                !isDeleted &&
                item.file &&
                (item.file_type?.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(item.file));

              return (
                <View
                  style={[
                    styles.messageRow,
                    isUser ? styles.userMessageRow : styles.otherMessageRow,
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onLongPress={isDeleted ? undefined : () => handleLongPressMessage(item)}
                    delayLongPress={300}
                    style={[
                      styles.messageBubble,
                      isDeleted
                        ? [
                            styles.otherBubble,
                            {
                              backgroundColor: colors.surfaceSubtle,
                              borderColor: colors.border,
                              borderStyle: 'dashed' as const,
                            },
                          ]
                        : isUser
                        ? [styles.userBubble, { backgroundColor: colors.primary }]
                        : [
                            styles.otherBubble,
                            { backgroundColor: colors.surface, borderColor: colors.border },
                          ],
                    ]}
                  >
                    {/* Image Attachment */}
                    {!isDeleted && isImage && fileFullUrl && (
                      <TouchableOpacity
                        onPress={() => setPreviewImage(fileFullUrl)}
                        activeOpacity={0.9}
                        style={styles.attachmentImageContainer}
                      >
                        <Image source={{ uri: fileFullUrl }} style={styles.attachmentImage} resizeMode="cover" />
                      </TouchableOpacity>
                    )}

                    {/* File / PDF Attachment */}
                    {!isDeleted && !isImage && fileFullUrl && (
                      <TouchableOpacity
                        style={[
                          styles.docAttachment,
                          {
                            backgroundColor: isUser
                              ? 'rgba(255,255,255,0.15)'
                              : colors.surfaceSubtle,
                          },
                        ]}
                        onPress={() => WebBrowser.openBrowserAsync(fileFullUrl)}
                      >
                        <Ionicons
                          name="document-text"
                          size={24}
                          color={isUser ? '#fff' : colors.primary}
                        />
                        <View style={styles.docInfo}>
                          <Text
                            style={[styles.docName, { color: isUser ? '#fff' : colors.text }]}
                            numberOfLines={1}
                          >
                            {item.file?.split('/').pop() || 'Attachment Document'}
                          </Text>
                          <Text
                            style={[
                              styles.docAction,
                              { color: isUser ? 'rgba(255,255,255,0.8)' : colors.primary },
                            ]}
                          >
                            Tap to view document
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* Text Message */}
                    {isDeleted ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Ionicons name="ban-outline" size={14} color={colors.textMuted} />
                        <Text
                          style={[
                            styles.messageText,
                            { color: colors.textMuted, fontStyle: 'italic' },
                          ]}
                        >
                          {item.message || 'This message was deleted'}
                        </Text>
                      </View>
                    ) : (
                      Boolean(item.message) && (
                        <Text
                          style={[styles.messageText, { color: isUser ? '#fff' : colors.text }]}
                        >
                          {item.message}
                        </Text>
                      )
                    )}

                    {/* Message Meta (Time & Seen status) */}
                    <View style={styles.messageMeta}>
                      <Text
                        style={[
                          styles.messageTime,
                          {
                            color: isDeleted
                              ? colors.textMuted
                              : isUser
                              ? 'rgba(255,255,255,0.7)'
                              : colors.textMuted,
                          },
                        ]}
                      >
                        {formatMessageTime(item.time)}
                      </Text>
                      {!isDeleted && isUser && (
                        <Ionicons
                          name={item.seen === 1 ? 'checkmark-done' : 'checkmark'}
                          size={14}
                          color={item.seen === 1 ? '#6ee7b7' : 'rgba(255,255,255,0.6)'}
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}

        {/* Selected Attachment Preview Chip */}
        {selectedAttachment && (
          <View
            style={[
              styles.attachmentPreviewBar,
              { backgroundColor: colors.surface, borderTopColor: colors.border },
            ]}
          >
            <Ionicons
              name={selectedAttachment.type.startsWith('image/') ? 'image' : 'document-attach'}
              size={20}
              color={colors.primary}
            />
            <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>
              {selectedAttachment.name}
            </Text>
            <TouchableOpacity onPress={() => setSelectedAttachment(null)} style={styles.removeAttachBtn}>
              <Ionicons name="close-circle" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Chat Input Bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 10),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.attachButton}
            onPress={() => setShowAttachMenu(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle" size={30} color={colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={[
              styles.chatInput,
              {
                backgroundColor: colors.inputBg,
                borderColor: colors.inputBorder,
                color: colors.text,
              },
            ]}
            placeholder="Type a message..."
            placeholderTextColor={colors.textMuted}
            value={inputMessage}
            onChangeText={handleInputChange}
            multiline
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  inputMessage.trim() || selectedAttachment ? colors.primary : colors.border,
              },
            ]}
            onPress={handleSendMessage}
            disabled={(!inputMessage.trim() && !selectedAttachment) || isSending}
            activeOpacity={0.8}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Attachment Action Sheet Modal */}
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
          <View style={[styles.attachSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.attachSheetTitle, { color: colors.text }]}>Share Content</Text>
            <View style={styles.attachOptionsRow}>
              <TouchableOpacity style={styles.attachOption} onPress={handlePickImage} activeOpacity={0.8}>
                <View style={[styles.attachOptionIcon, { backgroundColor: '#eff6ff' }]}>
                  <Ionicons name="image" size={24} color="#3b82f6" />
                </View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachOption} onPress={handleTakePhoto} activeOpacity={0.8}>
                <View style={[styles.attachOptionIcon, { backgroundColor: '#f0fdf4' }]}>
                  <Ionicons name="camera" size={24} color="#10b981" />
                </View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.attachOption} onPress={handlePickDocument} activeOpacity={0.8}>
                <View style={[styles.attachOptionIcon, { backgroundColor: '#fdf2f8' }]}>
                  <Ionicons name="document-attach" size={24} color="#ec4899" />
                </View>
                <Text style={[styles.attachOptionText, { color: colors.text }]}>Document</Text>
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
          <TouchableOpacity style={styles.closePreviewBtn} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          {previewImage && (
            <Image source={{ uri: previewImage }} style={styles.fullscreenImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e2e8f0',
  },
  initialsAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  callBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  contentContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  messagesListContent: {
    padding: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  chatHeaderNotice: {
    alignItems: 'center',
    marginBottom: 16,
  },
  encryptedNotice: {
    textAlign: 'center',
    fontSize: 11,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignSelf: 'center',
  },
  emptyChatContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyChatTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptyChatText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  messageRow: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 16,
    padding: 12,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 10,
  },
  attachmentImageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 6,
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  docAttachment: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  docInfo: {
    marginLeft: 10,
    flex: 1,
  },
  docName: {
    fontSize: 13,
    fontWeight: '700',
  },
  docAction: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  attachmentPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  attachmentName: {
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
  },
  removeAttachBtn: {
    padding: 4,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  attachButton: {
    padding: 4,
    marginRight: 6,
  },
  chatInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  attachSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    borderTopWidth: 1,
  },
  attachSheetTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  attachOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 16,
  },
  attachOption: {
    alignItems: 'center',
  },
  attachOptionIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachOptionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closePreviewBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
});
