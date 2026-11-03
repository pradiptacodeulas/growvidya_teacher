import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TextInput,
  View,
  Text,
  StatusBar,
  RefreshControl,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAppTheme } from '@/constants/theme';
import { useAppDispatch } from '@/redux/hooks';
import { fetchUnreadCount } from '@/redux/features/chat/slice';
import { connectSocket } from '@/services/socket.service';
import { apiFetch } from '@/services/apiClient';
import ContactCard, { ContactType } from '@/components/message/ContactCard';

const ROW_HEIGHT = 86;

type FilterMode = 'ALL' | 'PARENTS' | 'STUDENTS' | 'ADMINS' | 'TEACHERS' | 'UNREAD';

export default function MessageScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useLocalSearchParams<{ contactId?: string; role?: string }>();

  const [query, setQuery] = useState('');
  const [contacts, setContacts] = useState<ContactType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('ALL');

  // Handle deep-link or notification navigation directly to chat
  useEffect(() => {
    if (params?.contactId) {
      const targetId = params.contactId;
      const targetRole = (params.role || 'parent').toLowerCase();
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

  // Fetch contacts from server
  const loadContacts = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const response = await apiFetch('/messages/contacts', {
        method: 'GET',
      });

      if (response?.success && response?.data) {
        const rawList = Array.isArray(response.data) ? response.data : [];
        const normalized: ContactType[] = rawList.map((item: any) => ({
          id: item.id || item.user_id || item.contact_id,
          name: item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'User',
          first_name: item.first_name || '',
          last_name: item.last_name || '',
          role: (item.role || 'parent').toLowerCase(),
          picture: item.picture || item.avatar || null,
          phone: item.phone || item.mobile || '',
          email: item.email || '',
          designation: item.designation || '',
          child_name: item.child_name || item.student_name || '',
          class_name: item.class_name || '',
          section_name: item.section_name || '',
          code: item.code || item.admission_number || '',
          last_message: item.last_message || item.message || null,
          last_message_time: item.last_message_time || item.time || item.created_at || null,
          last_message_seen: item.last_message_seen ?? item.seen ?? null,
          last_message_is_outgoing: Boolean(item.last_message_is_outgoing),
          unread_count: Number(item.unread_count || item.unread || 0),
          unread: Number(item.unread_count || item.unread || 0),
          is_online: Boolean(item.is_online),
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
    } catch (e) {
      console.warn('Failed to load message contacts:', e);
      setContacts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadContacts(true);
      dispatch(fetchUnreadCount());
    }, [loadContacts, dispatch])
  );

  useEffect(() => {
    loadContacts();
    dispatch(fetchUnreadCount());
  }, [loadContacts, dispatch]);

  // Real-time socket event handlers
  useEffect(() => {
    let activeSocket: any = null;
    let cleanupListeners: (() => void) | null = null;

    const setupSocket = async () => {
      activeSocket = await connectSocket();
      if (!activeSocket) return;

      const handleReceive = (newMsg: any) => {
        const senderId = Number(newMsg.sender);
        const senderRole = (newMsg.sender_role || 'parent').toLowerCase();

        setContacts((prev) => {
          const idx = prev.findIndex(
            (c) => Number(c.id) === senderId && (c.role || '').toLowerCase() === senderRole
          );
          if (idx >= 0) {
            const copy = [...prev];
            const found = copy[idx];
            const updated: ContactType = {
              ...found,
              last_message: newMsg.message || (newMsg.file ? '📎 Sent an attachment' : ''),
              last_message_time: newMsg.time || new Date().toISOString(),
              unread_count: (found.unread_count || found.unread || 0) + 1,
              unread: (found.unread_count || found.unread || 0) + 1,
            };
            copy.splice(idx, 1);
            return [updated, ...copy];
          } else {
            loadContacts(true);
            return prev;
          }
        });

        dispatch(fetchUnreadCount());
      };

      const handleMessageSent = (sentMsg: any) => {
        const receiverId = Number(sentMsg.reciver || sentMsg.receiver);
        const receiverRole = (sentMsg.receiver_role || '').toLowerCase();

        setContacts((prev) => {
          const idx = prev.findIndex(
            (c) => Number(c.id) === receiverId && (c.role || '').toLowerCase() === receiverRole
          );
          if (idx >= 0) {
            const copy = [...prev];
            const found = copy[idx];
            const updated: ContactType = {
              ...found,
              last_message: sentMsg.message || (sentMsg.file ? '📎 Sent an attachment' : ''),
              last_message_time: sentMsg.time || new Date().toISOString(),
              last_message_is_outgoing: true,
            };
            copy.splice(idx, 1);
            return [updated, ...copy];
          }
          return prev;
        });
      };

      const handleOnlineList = (onlineKeys: string[]) => {
        if (!Array.isArray(onlineKeys)) return;
        const set = new Set(onlineKeys.map((k) => k.toLowerCase()));
        setContacts((prev) =>
          prev.map((c) => {
            const role = (c.role || 'parent').toLowerCase();
            const key = `${role}_${c.id}`;
            const isOnline = set.has(key);
            return { ...c, is_online: isOnline };
          })
        );
      };

      const handleUserOnline = (data: any) => {
        if (!data?.userId) return;
        const uid = Number(data.userId);
        const urole = (data.role || '').toLowerCase();
        setContacts((prev) =>
          prev.map((c) =>
            Number(c.id) === uid && (c.role || '').toLowerCase() === urole
              ? { ...c, is_online: true }
              : c
          )
        );
      };

      const handleUserOffline = (data: any) => {
        if (!data?.userId) return;
        const uid = Number(data.userId);
        const urole = (data.role || '').toLowerCase();
        setContacts((prev) =>
          prev.map((c) =>
            Number(c.id) === uid && (c.role || '').toLowerCase() === urole
              ? { ...c, is_online: false }
              : c
          )
        );
      };

      const handleMessagesRead = (data: any) => {
        if (data?.senderId || data?.readerId) {
          const id = Number(data.senderId || data.readerId);
          const role = String(data.senderRole || data.readerRole || '').toLowerCase();
          setContacts((prev) =>
            prev.map((c) => {
              if (Number(c.id) === id && (!role || (c.role || '').toLowerCase() === role)) {
                return { ...c, unread_count: 0, unread: 0, last_message_seen: 1 };
              }
              return c;
            })
          );
          dispatch(fetchUnreadCount());
        }
      };

      activeSocket.on('receive_message', handleReceive);
      activeSocket.on('message_sent', handleMessageSent);
      activeSocket.on('online_users_list', handleOnlineList);
      activeSocket.on('user_online', handleUserOnline);
      activeSocket.on('user_offline', handleUserOffline);
      activeSocket.on('messages_read', handleMessagesRead);

      cleanupListeners = () => {
        activeSocket.off('receive_message', handleReceive);
        activeSocket.off('message_sent', handleMessageSent);
        activeSocket.off('online_users_list', handleOnlineList);
        activeSocket.off('user_online', handleUserOnline);
        activeSocket.off('user_offline', handleUserOffline);
        activeSocket.off('messages_read', handleMessagesRead);
      };
    };

    setupSocket();

    return () => {
      if (cleanupListeners) {
        cleanupListeners();
      }
    };
  }, [dispatch, loadContacts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadContacts(true);
    dispatch(fetchUnreadCount());
  }, [loadContacts, dispatch]);

  const unreadTotal = useMemo(() => {
    return contacts.reduce((sum, c) => sum + (c.unread_count || c.unread || 0), 0);
  }, [contacts]);

  const counts = useMemo(() => {
    return {
      all: contacts.length,
      parents: contacts.filter((c) => (c.role || '').toLowerCase() === 'parent').length,
      students: contacts.filter((c) => (c.role || '').toLowerCase() === 'student').length,
      admins: contacts.filter((c) => (c.role || '').toLowerCase() === 'admin').length,
      teachers: contacts.filter((c) => (c.role || '').toLowerCase() === 'teacher').length,
      unread: unreadTotal,
    };
  }, [contacts, unreadTotal]);

  const filtered = useMemo(() => {
    let result = contacts;

    // Apply role/unread filter
    if (filterMode === 'UNREAD') {
      result = result.filter((c) => (c.unread_count || c.unread || 0) > 0);
    } else if (filterMode === 'PARENTS') {
      result = result.filter((c) => (c.role || '').toLowerCase() === 'parent');
    } else if (filterMode === 'STUDENTS') {
      result = result.filter((c) => (c.role || '').toLowerCase() === 'student');
    } else if (filterMode === 'ADMINS') {
      result = result.filter((c) => (c.role || '').toLowerCase() === 'admin');
    } else if (filterMode === 'TEACHERS') {
      result = result.filter((c) => (c.role || '').toLowerCase() === 'teacher');
    }

    // Apply search query filter
    const q = query.toLowerCase().trim();
    if (!q) return result;

    return result.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const role = (c.role || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const child = (c.child_name || '').toLowerCase();
      const cls = (c.class_name || '').toLowerCase();
      const sec = (c.section_name || '').toLowerCase();
      const des = (c.designation || '').toLowerCase();
      const lastMsg = (c.last_message || '').toLowerCase();

      return (
        name.includes(q) ||
        role.includes(q) ||
        phone.includes(q) ||
        child.includes(q) ||
        cls.includes(q) ||
        sec.includes(q) ||
        des.includes(q) ||
        lastMsg.includes(q)
      );
    });
  }, [query, contacts, filterMode]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={styles.content}>
        {/* Modern Search Bar */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: colors.inputBg, borderColor: colors.border, borderWidth: 1 },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            placeholder="Search parents, students, staff..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Modern Filter Chips matching Parent App */}
        <View style={styles.filterRowContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            <TouchableOpacity
              onPress={() => setFilterMode('ALL')}
              style={[
                styles.filterChip,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                filterMode === 'ALL' && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.textSecondary },
                  filterMode === 'ALL' && { color: colors.primary, fontWeight: '700' },
                ]}
              >
                All Messages ({counts.all})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterMode('PARENTS')}
              style={[
                styles.filterChip,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                filterMode === 'PARENTS' && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.textSecondary },
                  filterMode === 'PARENTS' && { color: colors.primary, fontWeight: '700' },
                ]}
              >
                Parents ({counts.parents})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterMode('STUDENTS')}
              style={[
                styles.filterChip,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                filterMode === 'STUDENTS' && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.textSecondary },
                  filterMode === 'STUDENTS' && { color: colors.primary, fontWeight: '700' },
                ]}
              >
                Students ({counts.students})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setFilterMode('ADMINS')}
              style={[
                styles.filterChip,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                filterMode === 'ADMINS' && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.textSecondary },
                  filterMode === 'ADMINS' && { color: colors.primary, fontWeight: '700' },
                ]}
              >
                Admins ({counts.admins})
              </Text>
            </TouchableOpacity>

            {counts.teachers > 0 && (
              <TouchableOpacity
                onPress={() => setFilterMode('TEACHERS')}
                style={[
                  styles.filterChip,
                  { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  filterMode === 'TEACHERS' && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: colors.textSecondary },
                    filterMode === 'TEACHERS' && { color: colors.primary, fontWeight: '700' },
                  ]}
                >
                  Colleagues ({counts.teachers})
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => setFilterMode('UNREAD')}
              style={[
                styles.filterChip,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                filterMode === 'UNREAD' && { backgroundColor: colors.primaryLight, borderColor: colors.primary },
              ]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: colors.textSecondary },
                  filterMode === 'UNREAD' && { color: colors.primary, fontWeight: '700' },
                ]}
              >
                Unread ({counts.unread})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {loading && !refreshing ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading conversations...</Text>
          </View>
        ) : filtered && filtered.length > 0 ? (
          <FlatList
            data={filtered}
            keyExtractor={(item) => `${item.role || 'contact'}_${item.id}`}
            renderItem={({ item }) => <ContactCard contact={item} />}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 90,
              paddingTop: 4,
            }}
            getItemLayout={(_, index) => ({
              length: ROW_HEIGHT,
              offset: ROW_HEIGHT * index,
              index,
            })}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          />
        ) : (
          <View style={styles.centerContainer}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {query ? 'No Contacts Found' : 'No Conversations'}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              {query
                ? 'Try searching for a different name, role, or student class.'
                : 'Parents, students, and administration will appear here. Tap to start messaging.'}
            </Text>
            <TouchableOpacity
              onPress={onRefresh}
              style={[styles.refreshBtn, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <Ionicons name="refresh" size={14} color={colors.primary} />
              <Text style={[styles.refreshBtnText, { color: colors.primary }]}>Refresh Contacts</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
    fontWeight: '500',
  },
  filterRowContainer: {
    marginBottom: 10,
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 16,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  refreshBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
