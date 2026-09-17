import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  TextInput 
} from 'react-native';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import InternalHeader from '@/components/InternalHeader';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/constants/theme';
import { apiClient } from '@/services/apiClient';

interface NoticeItem {
  id: string;
  school_id: string;
  title: string;
  notice_date: string;
  publish_on: string;
  message: string;
  status: string;
  created_at: string;
}

export default function NoticeScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  // Notices List State
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  
  // Bottom Sheet Ref & State
  const noticeBottomSheetRef = useRef<BottomSheetModal>(null);
  const [selectedNotice, setSelectedNotice] = useState<NoticeItem | null>(null);

  // Ref to prevent initial focus loop
  const hasLoadedRef = useRef(false);

  // Fetch notices from API
  const fetchNotices = useCallback(async (isRefresh = false, isSilent = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!isSilent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await apiClient.get('/teacher/announcements/notices');
      const resData = response.data;
      const list =
        resData?.data?.notices ||
        resData?.notices ||
        (Array.isArray(resData?.data) ? resData.data : null) ||
        (Array.isArray(resData) ? resData : null) ||
        [];

      if (Array.isArray(list)) {
        const noticesArray = [...list].sort(
          (a: any, b: any) =>
            new Date(b.notice_date || b.created_at || '').getTime() -
            new Date(a.notice_date || a.created_at || '').getTime()
        );
        setNotices(noticesArray);
      } else {
        setNotices([]);
      }
    } catch (err: any) {
      console.warn('fetchNotices exception:', err?.message);
      setError(err?.response?.data?.message || err?.message || 'An error occurred while fetching notices.');
      setNotices([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        fetchNotices(false, false);
        return;
      }
      fetchNotices(false, true);
    }, [fetchNotices])
  );

  // Format date helper
  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleOpenNotice = (notice: NoticeItem) => {
    setSelectedNotice(notice);
    noticeBottomSheetRef.current?.present();
  };

  // Filter notices based on search query
  const filteredNotices = notices.filter(item => 
    item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.message?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  const renderNoticeItem = ({ item }: { item: NoticeItem }) => {
    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => handleOpenNotice(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.titleContainer}>
            <View style={[styles.noticeIconBadge, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="megaphone-outline" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.noticeTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
          <View style={[styles.dateBadge, { backgroundColor: colors.surfaceSubtle }]}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} style={styles.inlineIcon} />
            <Text style={[styles.dateText, { color: colors.textMuted }]}>{formatDateString(item.notice_date)}</Text>
          </View>
        </View>

        <Text style={[styles.noticePreview, { color: colors.textSecondary }]} numberOfLines={3}>
          {item.message?.replace(/\\n/g, '\n')}
        </Text>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.publishDateText, { color: colors.textMuted }]}>
            Published: {formatDateString(item.publish_on)}
          </Text>
          <View style={styles.readMoreContainer}>
            <Text style={[styles.readMoreText, { color: colors.primary }]}>Read More</Text>
            <Ionicons name="chevron-forward-outline" size={14} color={colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Notice Board" />

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBarContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search notices..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => fetchNotices()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading notices...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotices}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderNoticeItem}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotices(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="megaphone-outline" size={40} color={colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {searchQuery ? 'No Matching Notices' : 'No Notices Found'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                {searchQuery
                  ? `No notices match your search "${searchQuery}".`
                  : 'There are currently no announcements published on the notice board.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Notice Detail Bottom Sheet */}
      <BottomSheetModal
        ref={noticeBottomSheetRef}
        index={0}
        snapPoints={['65%', '85%']}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        handleIndicatorStyle={[styles.handleIndicator, { backgroundColor: colors.border }]}
        backgroundStyle={[styles.sheetBackground, { backgroundColor: colors.surface }]}
      >
        <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <View style={styles.modalTitleRow}>
              <View style={[styles.modalIconContainer, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="megaphone" size={20} color={colors.primary} />
              </View>
              <View style={styles.modalHeaderDetails}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedNotice?.title}</Text>
                <Text style={[styles.modalPublishDate, { color: colors.textMuted }]}>
                  Published on: {selectedNotice ? formatDateString(selectedNotice.publish_on) : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.closeIconButton}
              onPress={() => noticeBottomSheetRef.current?.dismiss()}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <BottomSheetScrollView 
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={true} 
            contentContainerStyle={styles.modalBody}
          >
            {/* Event Dates Info Block */}
            <View style={[styles.infoBlock, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
              <View style={styles.infoCol}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Notice Date</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {selectedNotice ? formatDateString(selectedNotice.notice_date) : ''}
                </Text>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoCol}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Category</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>School Announcement</Text>
              </View>
            </View>

            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              {selectedNotice?.message?.replace(/\\n/g, '\n')}
            </Text>
          </BottomSheetScrollView>
        </View>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fa',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  clearButton: {
    padding: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 60,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    fontWeight: '500',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#3d5ee1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 4,
    borderLeftColor: '#3d5ee1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  noticeIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inlineIcon: {
    marginRight: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#4b5563',
    fontWeight: '600',
  },
  noticePreview: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
  publishDateText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  readMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  readMoreText: {
    fontSize: 12,
    color: '#3d5ee1',
    fontWeight: '700',
  },
  handleIndicator: {
    backgroundColor: '#ccc',
    width: 50,
  },
  sheetBackground: {
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  sheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingBottom: 14,
    marginBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  modalIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderDetails: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1f2937',
  },
  modalPublishDate: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '500',
  },
  modalBody: {
    paddingBottom: 20,
  },
  infoBlock: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  infoCol: {
    flex: 1,
    alignItems: 'center',
  },
  infoDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
  infoLabel: {
    fontSize: 10,
    color: '#9ca3af',
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '700',
  },
  modalMessage: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 22,
    fontWeight: '400',
  },
  closeIconButton: {
    padding: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
