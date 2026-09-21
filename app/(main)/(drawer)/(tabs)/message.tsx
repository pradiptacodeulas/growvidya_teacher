import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/constants/theme';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchUnreadCount } from '@/redux/features/chat/slice';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { apiClient, getAvatarUrl } from '@/services/apiClient';
import { connectSocket, getSocket } from '@/services/socket.service';

export interface Contact {
  id: number;
  name: string;
  first_name?: string;
  last_name?: string;
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

const getInitials = (name?: string, firstName?: string, lastName?: string): string => {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (f && l) {
    return `${f.charAt(0).toUpperCase()}${l.charAt(0).toUpperCase()}`;
  }
  if (f) {
    return f.slice(0, 2).toUpperCase();
  }
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

function ContactAvatar({ contact, backgroundColor }: { contact: Contact; backgroundColor?: string }) {
  const [imageError, setImageError] = useState(false);
  const initials = useMemo(
    () => getInitials(contact.name, contact.first_name, contact.last_name),
    [contact.name, contact.first_name, contact.last_name]
  );
  const hasPic = isNonEmptyPicture(contact.picture);

  if (!hasPic || imageError) {
    return (
      <View style={[styles.initialsAvatar, { backgroundColor: backgroundColor || '#3d5ee1' }]}>
        <Text style={styles.initialsText}>{initials}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: getAvatarUrl(contact.picture, undefined) }}
      style={styles.avatar}
      onError={() => setImageError(true)}
    />
  );
}

export default function MessageScreen() {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const currentUser = useAppSelector((state) => state.auth.user);
  const currentUserId = currentUser?.id ? Number(currentUser.id) : 0;
  const params = useLocalSearchParams<{ contactId?: string; role?: string }>();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const contactsRef = useRef<Contact[]>([]);
  contactsRef.current = contacts;
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'All' | 'Admins' | 'Parents' | 'Students' | 'Unread'>('All');

  // Helper to format subText based on contact role
  const getContactSubText = (c: Contact) => {
    switch (c.role) {
      case 'admin':
        return c.designation || 'School Administration';
      case 'student':
        const studentInfo = [];
        if (c.class_name) studentInfo.push(`Class ${c.class_name}`);
        if (c.section_name) studentInfo.push(`Sec ${c.section_name}`);
        return studentInfo.length > 0 ? studentInfo.join(' - ') : 'Student';
      case 'parent':
        return c.child_name ? `Parent of ${c.child_name}` : 'Parent';
      default:
        return 'Contact';
    }
  };

  // Safe avatar helper
  const getContactAvatar = (c: Contact) => {
    return getAvatarUrl(c.picture, undefined);
  };

  // Fetch contacts from server
  const fetchContacts = useCallback(async (isRefresh = false) => {
    if (!token) return;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      let rawContacts: any[] = [];
      try {
        const res = await apiClient.get('/messages/contacts');
        rawContacts = res.data?.data?.contacts || res.data?.contacts || res.data?.data || [];
      } catch (err: any) {
        if (err?.response?.status === 404) {
          const fallbackRes = await apiClient.get('/messages/users');
          rawContacts = fallbackRes.data?.data?.users || fallbackRes.data?.users || fallbackRes.data?.data || [];
        } else {
          throw err;
        }
      }

      if (Array.isArray(rawContacts)) {
        const normalized: Contact[] = rawContacts.map((item: any) => ({
          id: Number(item.id || item.user_id || item.contact_id),
          name: item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'User',
          first_name: item.first_name || '',
          last_name: item.last_name || '',
          role: (item.role || 'parent').toLowerCase() as Contact['role'],
          picture: item.picture || item.avatar || null,
          phone: item.phone || item.mobile || '',
          email: item.email || '',
          last_message: item.last_message || item.message || null,
          last_message_time: item.last_message_time || item.time || item.created_at || null,
          last_message_seen: item.last_message_seen ?? item.seen ?? null,
          last_message_is_outgoing: item.last_message_is_outgoing ?? (Number(item.last_message_sender) === currentUserId),
          unread_count: Number(item.unread_count || 0),
          is_online: Boolean(item.is_online),
          designation: item.designation || '',
          child_name: item.child_name || item.student_name || '',
          class_name: item.class_name || '',
          section_name: item.section_name || '',
          code: item.code || '',
        }));

        normalized.sort((a, b) => {
          if (a.last_message_time && b.last_message_time) {
            return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
          }
          if (a.last_message_time) return -1;
          if (b.last_message_time) return 1;
          return a.name.localeCompare(b.name);
        });

        setContacts(normalized);
      } else {
        setContacts([]);
      }
    } catch (err: any) {
      console.warn('[MessageScreen] fetchContacts error:', err?.message);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [token, currentUserId]);

  // Connect Socket & Listen for inbox updates
  useEffect(() => {
    if (!token) return;

    let activeSocket = getSocket();
    let handlers: Record<string, (...args: any[]) => void> = {};

    const setupSocket = async () => {
      if (!activeSocket) {
        activeSocket = await connectSocket(token || undefined);
      }
      if (!activeSocket) return;

      const handleReceiveMessage = (msg: ChatMessage) => {
        setContacts((prev) => {
          const senderId = Number(msg.sender);
          const senderRole = (msg.sender_role || '').toLowerCase();
          const isFromOther = senderId !== currentUserId;

          let found = false;
          const updated = prev.map((c) => {
            if (c.id === senderId && c.role.toLowerCase() === senderRole) {
              found = true;
              return {
                ...c,
                last_message: msg.message || (msg.file ? '📎 Attachment' : ''),
                last_message_time: msg.time || new Date().toISOString(),
                last_message_is_outgoing: false,
                last_message_seen: 0,
                unread_count: isFromOther ? c.unread_count + 1 : c.unread_count,
              };
            }
            return c;
          });

          return updated.sort((a, b) => {
            if (a.last_message_time && b.last_message_time) {
              return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
            }
            if (a.last_message_time) return -1;
            if (b.last_message_time) return 1;
            return a.name.localeCompare(b.name);
          });
        });

        dispatch(fetchUnreadCount());
      };

      const handleMessageSent = (sentMsg: ChatMessage) => {
        setContacts((prev) => {
          const updated = prev.map((c) =>
            c.id === sentMsg.reciver && c.role.toLowerCase() === sentMsg.receiver_role.toLowerCase()
              ? {
                  ...c,
                  last_message: sentMsg.message || (sentMsg.file ? '📎 Attachment' : ''),
                  last_message_time: sentMsg.time || new Date().toISOString(),
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
      };

      const handleMessagesRead = ({ readerId, readerRole }: any) => {
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

      handlers = {
        receive_message: handleReceiveMessage,
        message_sent: handleMessageSent,
        messages_read: handleMessagesRead,
        user_online: handleUserOnline,
        user_offline: handleUserOffline,
        online_users_list: handleOnlineUsersList,
      };

      Object.entries(handlers).forEach(([event, fn]) => {
        activeSocket?.on(event, fn);
      });
    };

    setupSocket();

    return () => {
      if (activeSocket) {
        Object.entries(handlers).forEach(([event, fn]) => {
          activeSocket?.off(event, fn);
        });
      }
    };
  }, [token, currentUserId, dispatch]);

  useFocusEffect(
    useCallback(() => {
      fetchContacts();
      dispatch(fetchUnreadCount());
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

  // Open a conversation as a dedicated screen
  const handleOpenChat = (contact: Contact) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: String(contact.id),
        role: contact.role,
        name: contact.name,
        picture: contact.picture || '',
        phone: contact.phone || '',
        email: contact.email || '',
        designation: contact.designation || '',
        child_name: contact.child_name || '',
        class_name: contact.class_name || '',
        section_name: contact.section_name || '',
      },
    });
  };

  // Backward compatibility: If navigated with contactId query param, route directly to chat screen
  useEffect(() => {
    if (params?.contactId) {
      const targetId = params.contactId;
      const targetRole = params.role || '';
      router.setParams({ contactId: '', role: '' });
      router.push({
        pathname: '/chat/[id]',
        params: {
          id: String(targetId),
          role: targetRole,
        },
      });
    }
  }, [params?.contactId, params?.role, router]);

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

  // Role badge styling
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
            activeOpacity={0.7}
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
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          )}
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
            const hasUnread = item.unread_count > 0;

            return (
              <TouchableOpacity
                style={styles.convRow}
                onPress={() => handleOpenChat(item)}
                activeOpacity={0.6}
              >
                <View style={styles.avatarWrapper}>
                  <ContactAvatar contact={item} backgroundColor={colors.primary} />
                  {item.is_online && (
                    <View style={[styles.onlineDot, { borderColor: colors.background }]} />
                  )}
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
                    {item.last_message_time ? (
                      <Text
                        style={[
                          styles.convTime,
                          {
                            color: hasUnread ? colors.primary : colors.textMuted,
                            fontWeight: hasUnread ? '700' : '500',
                          },
                        ]}
                      >
                        {formatRelativeTime(item.last_message_time)}
                      </Text>
                    ) : null}
                  </View>

                  <View style={styles.convSubRow}>
                    <Text style={[styles.subText, { color: colors.textMuted }]} numberOfLines={1}>
                      {subText}
                    </Text>
                    {hasUnread && (
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
    flexGrow: 1,
    paddingBottom: 24,
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
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  convRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 78,
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
  initialsAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
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
    marginBottom: 2,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  convName: {
    fontSize: 16,
    fontWeight: '700',
    marginRight: 6,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
  },
  convTime: {
    fontSize: 12,
  },
  convSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 3,
  },
  subText: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
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
});
