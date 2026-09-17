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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/constants/theme';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { setActiveChatKey, fetchUnreadCount } from '@/redux/features/chat/slice';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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

export interface Contact {
  id: number;
  name: string;
  role: 'admin' | 'parent' | 'student';
  picture: string | null;
  phone?: string;
  email?: string;
  last_message: string | null;
  last_message_time: string | null;
  last_message_seen: number | null;
  last_message_is_outgoing?: boolean;
  unread_count: number;
  is_online?: boolean;
  designation?: string;
  child_name?: string;
  class_name?: string;
  section_name?: string;
  code?: string;
}

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

export default function MessageScreen() {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = Number(currentUser?.id || 1);
  const params = useLocalSearchParams<{ contactId?: string; role?: string }>();
  const autoOpenedContactIdRef = useRef<string | null>(null);

  const [contacts, setContacts] = useState<Contact[]>([]);
  const contactsRef = useRef<Contact[]>([]);
  contactsRef.current = contacts;
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Admins' | 'Parents' | 'Students' | 'Unread'>('All');

  // Selected chat state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const selectedContactRef = useRef<Contact | null>(null);
  selectedContactRef.current = selectedContact;

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isContactTyping, setIsContactTyping] = useState(false);

  // Attachment state
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

  // Helper to format subText based on contact role
  const getContactSubText = (c: Contact) => {
    if (c.role === 'admin') {
      return c.designation || 'School Administration';
    }
    if (c.role === 'parent') {
      return c.child_name ? `Parent of ${c.child_name}` : 'Parent';
    }
    if (c.role === 'student') {
      const cls = c.class_name ? `Class ${c.class_name}${c.section_name ? `-${c.section_name}` : ''}` : '';
      const code = c.code ? `ID: ${c.code}` : '';
      return [cls, code].filter(Boolean).join(' • ') || 'Student';
    }
    return '';
  };

  // Helper to get contact avatar URL
  const getContactAvatar = (c: Contact) => {
    if (c.picture) {
      return getAvatarUrl(c.picture);
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name || 'User')}&background=3d5ee1&color=fff&size=128`;
  };

  // Fetch contacts from backend
  const fetchContacts = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (contacts.length === 0) {
      setIsLoading(true);
    }

    try {
      const response = await apiClient.get('/messages/contacts');
      const data = response.data?.data || response.data || [];
      const list = Array.isArray(data) ? data : [];
      setContacts(list);
    } catch (err: any) {
      console.warn('fetchContacts error:', err?.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [contacts.length]);

  // Load chat conversation with a specific contact
  const loadConversation = useCallback(async (contact: Contact) => {
    setIsChatLoading(true);
    try {
      const response = await apiClient.get(`/messages/conversation/${contact.role}/${contact.id}`);
      const data = response.data?.data || response.data || {};
      const msgs = Array.isArray(data.messages) ? data.messages : [];
      setChatMessages(msgs);

      // Mark messages as read locally and in state
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id && c.role === contact.role ? { ...c, unread_count: 0 } : c
        )
      );
    } catch (err: any) {
      console.warn('loadConversation error:', err?.message);
    } finally {
      setIsChatLoading(false);
    }
  }, []);

  // Socket Connection and Event Listeners
  useEffect(() => {
    let activeSocket: any = null;
    let handlers: { [key: string]: (...args: any[]) => void } = {};

    const setupSocket = async () => {
      activeSocket = await connectSocket(token || undefined);
      if (!activeSocket) return;

      const handleReceiveMessage = (newMsg: ChatMessage) => {
        const activeChat = selectedContactRef.current;

        // If the chat is open with the sender
        if (
          activeChat &&
          activeChat.id === newMsg.sender &&
          activeChat.role.toLowerCase() === newMsg.sender_role.toLowerCase()
        ) {
          setChatMessages((prev) => [...prev, newMsg]);
          // Mark as read immediately
          emitMarkRead(newMsg.sender, newMsg.sender_role);
          apiClient.post('/messages/read', {
            senderId: newMsg.sender,
            senderRole: newMsg.sender_role,
          }).then(() => {
            dispatch(fetchUnreadCount());
          }).catch(() => {});
        }

        // Update contacts list in inbox
        setContacts((prev) => {
          const updated = prev.map((c) => {
            const isMatch =
              c.id === newMsg.sender &&
              c.role.toLowerCase() === newMsg.sender_role.toLowerCase();
            if (isMatch) {
              const isChatOpen =
                activeChat &&
                activeChat.id === newMsg.sender &&
                activeChat.role.toLowerCase() === newMsg.sender_role.toLowerCase();
              return {
                ...c,
                last_message: newMsg.message || (newMsg.file ? '📎 Attachment' : ''),
                last_message_time: newMsg.time || new Date().toISOString(),
                last_message_seen: 0,
                last_message_is_outgoing: false,
                unread_count: isChatOpen ? 0 : (c.unread_count || 0) + 1,
              };
            }
            return c;
          });

          // Move the conversation to the top
          return updated.sort((a, b) => {
            if (a.last_message_time && b.last_message_time) {
              return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
            }
            if (a.last_message_time) return -1;
            if (b.last_message_time) return 1;
            return a.name.localeCompare(b.name);
          });
        });
      };

      const handleMessageSent = (sentMsg: ChatMessage) => {
        const activeChat = selectedContactRef.current;
        if (
          activeChat &&
          activeChat.id === sentMsg.reciver &&
          activeChat.role.toLowerCase() === sentMsg.receiver_role.toLowerCase()
        ) {
          setChatMessages((prev) => {
            if (prev.some((m) => String(m.id) === String(sentMsg.id))) return prev;
            return [...prev, sentMsg];
          });
        }
      };

      const handleMessagesRead = ({ readerId, readerRole }: any) => {
        const activeChat = selectedContactRef.current;
        if (
          activeChat &&
          activeChat.id === Number(readerId) &&
          activeChat.role.toLowerCase() === String(readerRole).toLowerCase()
        ) {
          setChatMessages((prev) =>
            prev.map((m) =>
              m.sender === currentUserId && m.sender_role === 'teacher' ? { ...m, seen: 1 } : m
            )
          );
        }
        setContacts((prev) =>
          prev.map((c) =>
            c.id === Number(readerId) && c.role.toLowerCase() === String(readerRole).toLowerCase()
              ? { ...c, last_message_seen: 1 }
              : c
          )
        );
      };

      const handleUserOnline = ({ userId, role }: any) => {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === Number(userId) && c.role.toLowerCase() === String(role).toLowerCase()
              ? { ...c, is_online: true }
              : c
          )
        );
      };

      const handleUserOffline = ({ userId, role }: any) => {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === Number(userId) && c.role.toLowerCase() === String(role).toLowerCase()
              ? { ...c, is_online: false }
              : c
          )
        );
      };

      const handleOnlineUsersList = (onlineKeys: string[]) => {
        if (!Array.isArray(onlineKeys)) return;
        const set = new Set(onlineKeys.map((k) => k.toLowerCase()));
        setContacts((prev) =>
          prev.map((c) => ({
            ...c,
            is_online: set.has(`${c.role.toLowerCase()}_${c.id}`),
          }))
        );
      };

      const handleUserTyping = ({ senderId, senderRole }: any) => {
        const activeChat = selectedContactRef.current;
        if (
          activeChat &&
          activeChat.id === Number(senderId) &&
          activeChat.role.toLowerCase() === String(senderRole).toLowerCase()
        ) {
          setIsContactTyping(true);
        }
      };

      const handleUserStopTyping = ({ senderId, senderRole }: any) => {
        const activeChat = selectedContactRef.current;
        if (
          activeChat &&
          activeChat.id === Number(senderId) &&
          activeChat.role.toLowerCase() === String(senderRole).toLowerCase()
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

      handlers = {
        receive_message: handleReceiveMessage,
        message_sent: handleMessageSent,
        messages_read: handleMessagesRead,
        user_online: handleUserOnline,
        user_offline: handleUserOffline,
        online_users_list: handleOnlineUsersList,
        user_typing: handleUserTyping,
        user_stop_typing: handleUserStopTyping,
        message_deleted: handleMessageDeleted,
      };

      Object.entries(handlers).forEach(([event, fn]) => {
        activeSocket.on(event, fn);
      });
    };

    setupSocket();

    return () => {
      if (activeSocket) {
        Object.entries(handlers).forEach(([event, fn]) => {
          activeSocket.off(event, fn);
        });
      }
    };
  }, [token, currentUserId, dispatch]);

  useEffect(() => {
    return () => {
      dispatch(setActiveChatKey(null));
    };
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      fetchContacts();
      dispatch(fetchUnreadCount());

      // If chat is open when tab is focused, restore activeChatKey
      if (selectedContactRef.current) {
        dispatch(
          setActiveChatKey(
            `${selectedContactRef.current.role.toLowerCase()}_${selectedContactRef.current.id}`
          )
        );
      }

      return () => {
        // Clear activeChatKey on blur/leave so global notifications are NOT suppressed on other screens
        dispatch(setActiveChatKey(null));
      };
    }, [fetchContacts, dispatch])
  );

  // Filter contacts counts
  const filterCounts = useMemo(() => {
    return {
      All: contacts.length,
      Admins: contacts.filter((c) => c.role === 'admin').length,
      Parents: contacts.filter((c) => c.role === 'parent').length,
      Students: contacts.filter((c) => c.role === 'student').length,
      Unread: contacts.filter((c) => c.unread_count > 0).length,
    };
  }, [contacts]);

  // Filtered contacts list
  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return contacts.filter((c) => {
      const nameMatch = c.name?.toLowerCase().includes(q);
      const subMatch = getContactSubText(c).toLowerCase().includes(q);
      const lastMsgMatch = c.last_message?.toLowerCase().includes(q);
      const matchesSearch = !q || nameMatch || subMatch || lastMsgMatch;

      let matchesFilter = true;
      if (activeFilter === 'Admins') matchesFilter = c.role === 'admin';
      else if (activeFilter === 'Parents') matchesFilter = c.role === 'parent';
      else if (activeFilter === 'Students') matchesFilter = c.role === 'student';
      else if (activeFilter === 'Unread') matchesFilter = c.unread_count > 0;

      return matchesSearch && matchesFilter;
    });
  }, [contacts, searchQuery, activeFilter]);

  // Open a conversation
  const handleOpenChat = (contact: Contact) => {
    setSelectedContact(contact);
    dispatch(setActiveChatKey(`${contact.role.toLowerCase()}_${contact.id}`));
    loadConversation(contact);

    // Mark messages as read via socket & API
    emitMarkRead(contact.id, contact.role);
    apiClient.post('/messages/read', {
      senderId: contact.id,
      senderRole: contact.role,
    }).then(() => {
      dispatch(fetchUnreadCount());
    }).catch(() => {});
  };

  // Handle opening chat ONLY when explicitly navigated from in-app notification tap
  useEffect(() => {
    const contactIdStr = params?.contactId;
    if (!contactIdStr) return;

    const targetKey = `${contactIdStr}_${params.role || ''}`;
    if (autoOpenedContactIdRef.current === targetKey) return;
    autoOpenedContactIdRef.current = targetKey;

    // Immediately clear route params so future incoming messages or contacts updates NEVER re-trigger this
    router.setParams({ contactId: '', role: '' });

    const targetId = Number(contactIdStr);
    const targetRole = String(params.role || '').toLowerCase();

    const currentContacts = contactsRef.current;
    const match = currentContacts.find(
      (c) =>
        c.id === targetId &&
        (!targetRole || c.role.toLowerCase() === targetRole)
    );

    if (match) {
      handleOpenChat(match);
    } else {
      // If not yet in contacts list, synthesize a temporary contact so chat can open
      const tempContact: Contact = {
        id: targetId,
        name: params.role
          ? `${params.role.charAt(0).toUpperCase() + params.role.slice(1)} #${targetId}`
          : `User #${targetId}`,
        role: (targetRole || 'parent') as Contact['role'],
        picture: null,
        last_message: null,
        last_message_time: null,
        last_message_seen: null,
        last_message_is_outgoing: false,
        unread_count: 0,
        is_online: false,
      };
      handleOpenChat(tempContact);
    }
  }, [params?.contactId, params?.role, router]);

  // Close conversation
  const handleCloseChat = () => {
    if (selectedContact) {
      emitStopTyping(selectedContact.id, selectedContact.role);
    }
    dispatch(setActiveChatKey(null));
    dispatch(fetchUnreadCount());
    setSelectedContact(null);
    autoOpenedContactIdRef.current = null;
    router.setParams({ contactId: '', role: '' });
    setChatMessages([]);
    setInputMessage('');
    setSelectedAttachment(null);
    setIsContactTyping(false);
  };

  // Typing handler
  const handleInputChange = (text: string) => {
    setInputMessage(text);
    if (!selectedContact) return;

    if (text.length > 0) {
      emitTyping(selectedContact.id, selectedContact.role);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (selectedContact) {
          emitStopTyping(selectedContact.id, selectedContact.role);
        }
      }, 2000);
    } else {
      emitStopTyping(selectedContact.id, selectedContact.role);
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
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 30000,
      });
    } catch (uploadErr: any) {
      if (uploadErr?.response?.status === 404) {
        response = await apiClient.post('/upload/single?folder=messages', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
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
    } catch (e: any) {
      Alert.alert('Error', 'Failed to select photo');
    }
  };

  // Capture photo from camera
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
    } catch (e: any) {
      Alert.alert('Error', 'Failed to capture photo');
    }
  };

  // Pick Document / PDF
  const handlePickDocument = async () => {
    setShowAttachMenu(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*'],
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
    } catch (e: any) {
      Alert.alert('Error', 'Failed to select document');
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!selectedContact) return;
    const text = inputMessage.trim();
    if (!text && !selectedAttachment) return;

    setIsSending(true);
    emitStopTyping(selectedContact.id, selectedContact.role);

    try {
      let uploadedFileUrl: string | null = null;
      let uploadedFileType: string | null = null;

      if (selectedAttachment) {
        const uploadRes = await uploadAttachment(selectedAttachment);
        uploadedFileUrl = uploadRes.filePath;
        uploadedFileType = uploadRes.fileType;
      }

      const payload = {
        receiverId: selectedContact.id,
        receiverRole: selectedContact.role,
        message: text,
        file: uploadedFileUrl,
        fileType: uploadedFileType,
      };

      // Try sending via Socket first, fallback to REST API
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

      // Optimistic update for contact in list
      setContacts((prev) => {
        const updated = prev.map((c) =>
          c.id === selectedContact.id && c.role === selectedContact.role
            ? {
                ...c,
                last_message: text || (selectedAttachment ? '📎 Attachment' : ''),
                last_message_time: new Date().toISOString(),
                last_message_is_outgoing: true,
                last_message_seen: 0,
              }
            : c
        );
        return updated.sort((a, b) => {
          if (a.last_message_time && b.last_message_time) {
            return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
          }
          return 0;
        });
      });

      setInputMessage('');
      setSelectedAttachment(null);
    } catch (err: any) {
      console.warn('handleSendMessage error:', err?.message);
      Alert.alert('Send Failed', err?.message || 'Unable to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Format relative timestamp
  const formatRelativeTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24 && d.getDate() === now.getDate()) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
      }
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return String(dateStr);
    }
  };

  // Format message time
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

  // Role badge colors
  const getRoleBadgeStyle = (role: Contact['role']) => {
    switch (role) {
      case 'admin':
        return { bg: isDark ? 'rgba(61, 94, 225, 0.2)' : '#eef2ff', text: colors.primary, label: 'Admin' };
      case 'parent':
        return { bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5', text: '#059669', label: 'Parent' };
      case 'student':
        return { bg: isDark ? 'rgba(139, 92, 246, 0.2)' : '#ede9fe', text: '#7c3aed', label: 'Student' };
      default:
        return { bg: colors.surfaceSubtle, text: colors.textMuted, label: role };
    }
  };

  // Handle long-press message deletion
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
              console.warn('Failed to delete message:', err?.message);
              Alert.alert('Error', err?.response?.data?.message || err?.message || 'Failed to delete message');
              if (selectedContact) {
                loadConversation(selectedContact);
              }
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header Banner */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Messages & Inbox</Text>
            <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
              Connect with parents, students, and administration
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshIconBtn, { backgroundColor: colors.surfaceSubtle }]}
            onPress={() => fetchContacts(true)}
          >
            <Ionicons name="refresh" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search contacts, parents, or messages..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Quick Contacts Bar */}
      {contacts.length > 0 && (
        <View style={[styles.quickBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Quick Access</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickList}>
            {contacts.slice(0, 8).map((item) => (
              <TouchableOpacity
                key={`quick-${item.role}-${item.id}`}
                style={styles.quickItem}
                onPress={() => handleOpenChat(item)}
                activeOpacity={0.8}
              >
                <View style={styles.avatarWrapper}>
                  <Image source={{ uri: getContactAvatar(item) }} style={styles.quickAvatar} />
                  {item.is_online && <View style={styles.onlineDot} />}
                </View>
                <Text style={[styles.quickName, { color: colors.text }]} numberOfLines={1}>
                  {item.name ? item.name.split(' ')[0] : 'User'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Filter Tabs */}
      <View style={[styles.filterBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
          {(['All', 'Admins', 'Parents', 'Students', 'Unread'] as const).map((filter) => {
            const isActive = activeFilter === filter;
            const count = filterCounts[filter];
            return (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  { backgroundColor: isActive ? colors.primary : colors.surfaceSubtle },
                ]}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterText, { color: isActive ? '#fff' : colors.textSecondary }]}>
                  {filter}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.filterCountBadge,
                      { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : colors.border },
                    ]}
                  >
                    <Text style={[styles.filterCountText, { color: isActive ? '#fff' : colors.textSecondary }]}>
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Conversation List */}
      {isLoading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading conversations...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredContacts}
          keyExtractor={(item) => `${item.role}_${item.id}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchContacts(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="chatbubbles-outline" size={42} color={colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Conversations Found</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                {searchQuery
                  ? 'No contacts matched your search. Try a different query.'
                  : 'Your messages with school administration, parents, and students will appear here.'}
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.primary, marginTop: 16 }]}
                onPress={() => fetchContacts(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.retryButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const badgeStyle = getRoleBadgeStyle(item.role);
            const subText = getContactSubText(item);

            return (
              <TouchableOpacity
                style={[styles.convCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                onPress={() => handleOpenChat(item)}
                activeOpacity={0.7}
              >
                <View style={styles.avatarWrapper}>
                  <Image source={{ uri: getContactAvatar(item) }} style={styles.avatar} />
                  {item.is_online && <View style={styles.onlineDot} />}
                </View>

                <View style={styles.convBody}>
                  <View style={styles.convHeader}>
                    <View style={styles.nameContainer}>
                      <Text style={[styles.convName, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <View style={[styles.roleBadge, { backgroundColor: badgeStyle.bg }]}>
                        <Text style={[styles.roleText, { color: badgeStyle.text }]}>{badgeStyle.label}</Text>
                      </View>
                    </View>
                    <Text style={[styles.convTime, { color: colors.textMuted }]}>
                      {formatRelativeTime(item.last_message_time)}
                    </Text>
                  </View>

                  <Text style={[styles.subText, { color: colors.textMuted }]} numberOfLines={1}>
                    {subText}
                  </Text>

                  <View style={styles.convFooter}>
                    <View style={styles.lastMessageRow}>
                      {item.last_message_is_outgoing && (
                        <Ionicons
                          name={item.last_message_seen === 1 ? 'checkmark-done' : 'checkmark'}
                          size={14}
                          color={item.last_message_seen === 1 ? colors.primary : colors.textMuted}
                          style={{ marginRight: 4 }}
                        />
                      )}
                      <Text
                        style={[
                          styles.lastMessage,
                          { color: item.unread_count > 0 ? colors.text : colors.textMuted },
                          item.unread_count > 0 && styles.unreadMessageText,
                        ]}
                        numberOfLines={1}
                      >
                        {item.last_message || 'Tap to start conversation'}
                      </Text>
                    </View>
                    {item.unread_count > 0 && (
                      <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.unreadCountText}>{item.unread_count}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* Chat Detail Modal */}
      <Modal
        visible={selectedContact !== null}
        animationType="slide"
        onRequestClose={handleCloseChat}
      >
        {selectedContact && (
          <KeyboardAvoidingView
            style={[styles.chatModalContainer, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Modal Header */}
            <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <TouchableOpacity style={styles.backButton} onPress={handleCloseChat}>
                <Ionicons name="arrow-back" size={24} color={colors.icon} />
              </TouchableOpacity>

              <View style={styles.modalAvatarContainer}>
                <Image source={{ uri: getContactAvatar(selectedContact) }} style={styles.modalAvatar} />
                {selectedContact.is_online && <View style={styles.modalOnlineDot} />}
              </View>

              <View style={styles.modalHeaderInfo}>
                <Text style={[styles.modalName, { color: colors.text }]} numberOfLines={1}>
                  {selectedContact.name}
                </Text>
                <Text style={[styles.modalStatus, { color: isContactTyping ? colors.primary : colors.textMuted }]} numberOfLines={1}>
                  {isContactTyping
                    ? '✍️ typing...'
                    : selectedContact.is_online
                    ? '🟢 Online'
                    : `Offline • ${getContactSubText(selectedContact)}`}
                </Text>
              </View>
            </View>

            {/* Chat Messages */}
            {isChatLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading messages...</Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={chatMessages}
                keyExtractor={(item, index) => (item.id != null ? String(item.id) : String(index))}
                contentContainerStyle={styles.chatMessagesContent}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                ListHeaderComponent={
                  <View style={styles.chatHeaderNotice}>
                    <Text style={[styles.encryptedNotice, { color: colors.textMuted, backgroundColor: colors.surfaceSubtle }]}>
                      🔒 End-to-end encrypted school communication
                    </Text>
                  </View>
                }
                ListEmptyComponent={
                  <View style={styles.emptyChatContainer}>
                    <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.textMuted} />
                    <Text style={[styles.emptyChatText, { color: colors.textMuted }]}>
                      No messages here yet. Say hello to {selectedContact.name}!
                    </Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isUser = item.sender === currentUserId && item.sender_role === 'teacher';
                  const isDeleted = Number(item.status) === 0;
                  const fileFullUrl = !isDeleted && item.file ? getFileUrl(item.file) : null;
                  const isImage = !isDeleted && item.file && (
                    item.file_type?.startsWith('image/') ||
                    /\.(png|jpe?g|webp|gif)$/i.test(item.file)
                  );

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
                            : [styles.otherBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
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
                              { backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : colors.surfaceSubtle },
                            ]}
                            onPress={() => WebBrowser.openBrowserAsync(fileFullUrl)}
                          >
                            <Ionicons name="document-text" size={24} color={isUser ? '#fff' : colors.primary} />
                            <View style={styles.docInfo}>
                              <Text style={[styles.docName, { color: isUser ? '#fff' : colors.text }]} numberOfLines={1}>
                                {item.file?.split('/').pop() || 'Attachment Document'}
                              </Text>
                              <Text style={[styles.docAction, { color: isUser ? 'rgba(255,255,255,0.8)' : colors.primary }]}>
                                Tap to view document
                              </Text>
                            </View>
                          </TouchableOpacity>
                        )}

                        {/* Text Message */}
                        {isDeleted ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Ionicons name="ban-outline" size={14} color={colors.textMuted} />
                            <Text style={[styles.messageText, { color: colors.textMuted, fontStyle: 'italic' }]}>
                              {item.message || 'This message was deleted'}
                            </Text>
                          </View>
                        ) : (
                          Boolean(item.message) && (
                            <Text style={[styles.messageText, { color: isUser ? '#fff' : colors.text }]}>
                              {item.message}
                            </Text>
                          )
                        )}

                        {/* Message Meta (Time & Seen status) */}
                        <View style={styles.messageMeta}>
                          <Text style={[styles.messageTime, { color: isDeleted ? colors.textMuted : isUser ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>
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

            {/* Selected Attachment Preview */}
            {selectedAttachment && (
              <View style={[styles.attachmentPreviewBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
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

            {/* Chat Input Bar */}
            <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
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
                <View style={[styles.attachSheet, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <Text style={[styles.attachSheetTitle, { color: colors.text }]}>Share Attachment</Text>

                  <View style={styles.attachOptionsRow}>
                    <TouchableOpacity style={styles.attachOptionItem} onPress={handleTakePhoto}>
                      <View style={[styles.attachOptionIcon, { backgroundColor: '#fee2e2' }]}>
                        <Ionicons name="camera" size={24} color="#ef4444" />
                      </View>
                      <Text style={[styles.attachOptionLabel, { color: colors.text }]}>Camera</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.attachOptionItem} onPress={handlePickImage}>
                      <View style={[styles.attachOptionIcon, { backgroundColor: '#e0e7ff' }]}>
                        <Ionicons name="images" size={24} color="#4f46e5" />
                      </View>
                      <Text style={[styles.attachOptionLabel, { color: colors.text }]}>Gallery</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.attachOptionItem} onPress={handlePickDocument}>
                      <View style={[styles.attachOptionIcon, { backgroundColor: '#dcfce7' }]}>
                        <Ionicons name="document-text" size={24} color="#16a34a" />
                      </View>
                      <Text style={[styles.attachOptionLabel, { color: colors.text }]}>Document</Text>
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
              <View style={styles.fullscreenImageContainer}>
                <TouchableOpacity style={styles.closePreviewBtn} onPress={() => setPreviewImage(null)}>
                  <Ionicons name="close" size={30} color="#fff" />
                </TouchableOpacity>
                {previewImage && (
                  <Image source={{ uri: previewImage }} style={styles.fullscreenImage} resizeMode="contain" />
                )}
              </View>
            </Modal>
          </KeyboardAvoidingView>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 3,
    fontWeight: '500',
  },
  refreshIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginTop: 14,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  quickBar: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  quickList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  quickItem: {
    alignItems: 'center',
    width: 60,
  },
  quickAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e2e8f0',
  },
  quickName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  filterBar: {
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  filterList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
  },
  filterCountBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  filterCountText: {
    fontSize: 11,
    fontWeight: '800',
  },
  listContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  centerContainer: {
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  convCard: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e2e8f0',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  convBody: {
    flex: 1,
  },
  convHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  convName: {
    fontSize: 15,
    fontWeight: '700',
    maxWidth: '65%',
  },
  roleBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
  },
  convTime: {
    fontSize: 11,
    fontWeight: '600',
  },
  subText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  convFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  lastMessageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  lastMessage: {
    fontSize: 13,
    flex: 1,
  },
  unreadMessageText: {
    fontWeight: '700',
  },
  unreadBadge: {
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  chatModalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  backButton: {
    padding: 6,
    marginRight: 6,
  },
  modalAvatarContainer: {
    position: 'relative',
    marginRight: 10,
  },
  modalAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e2e8f0',
  },
  modalOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  modalHeaderInfo: {
    flex: 1,
  },
  modalName: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalStatus: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  chatMessagesContent: {
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
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyChatText: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
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
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  attachButton: {
    padding: 2,
  },
  chatInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    borderWidth: 1,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  attachSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderWidth: 1,
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
  },
  attachOptionItem: {
    alignItems: 'center',
    width: 80,
  },
  attachOptionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachOptionLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  fullscreenImageContainer: {
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
    padding: 10,
  },
  fullscreenImage: {
    width: '100%',
    height: '80%',
  },
});
