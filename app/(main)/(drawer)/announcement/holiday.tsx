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

interface HolidayItem {
  id: string;
  school_id: string;
  title: string;
  from_date: string;
  to_date: string;
  details: string;
  status: string;
  created_on: string;
}

export default function HolidayScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  // Holidays List State
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  
  // Bottom Sheet Ref & State
  const holidayBottomSheetRef = useRef<BottomSheetModal>(null);
  const [selectedHoliday, setSelectedHoliday] = useState<HolidayItem | null>(null);

  // Ref to prevent initial focus loop
  const hasLoadedRef = useRef(false);

  // Fetch holidays from API
  const fetchHolidays = useCallback(async (isRefresh = false, isSilent = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!isSilent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await apiClient.get('/teacher/announcements/holidays');
      const resData = response.data;
      const list = resData?.data?.holidays || resData?.holidays || (Array.isArray(resData?.data) ? resData.data : []);

      if (Array.isArray(list)) {
        const holidayArray: HolidayItem[] = list.map((h: any) => ({
          ...h,
          from_date: h.from_date || h.start_date || '',
          to_date: h.to_date || h.end_date || '',
          details: h.details || h.description || '',
        }));

        holidayArray.sort((a, b) => new Date(a.from_date).getTime() - new Date(b.from_date).getTime());
        setHolidays(holidayArray);
      } else {
        setHolidays([]);
      }
    } catch (err: any) {
      console.warn('fetchHolidays exception:', err?.message);
      setError(err?.response?.data?.message || err?.message || 'An error occurred while fetching holidays.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        fetchHolidays(false, false);
        return;
      }
      fetchHolidays(false, true);
    }, [fetchHolidays])
  );

  // Strip HTML tags helper
  const stripHtmlTags = (htmlStr: string) => {
    if (!htmlStr) return '';
    return htmlStr
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .replace(/&nbsp;/g, ' ')  // Replace HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  };

  // Format date helper
  const formatDateString = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Format date range
  const formatHolidayDate = (from: string, to: string) => {
    if (from === to) {
      return formatDateString(from);
    }
    return `${formatDateString(from)} - ${formatDateString(to)}`;
  };

  // Calculate holiday duration days
  const getDurationDays = (from: string, to: string) => {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleOpenHoliday = (holiday: HolidayItem) => {
    setSelectedHoliday(holiday);
    holidayBottomSheetRef.current?.present();
  };

  // Filter holidays based on search query
  const filteredHolidays = holidays.filter(item => 
    item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.details?.toLowerCase().includes(searchQuery.toLowerCase())
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

  const renderHolidayItem = ({ item }: { item: HolidayItem }) => {
    const cleanedDetails = stripHtmlTags(item.details);
    const duration = getDurationDays(item.from_date, item.to_date);

    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => handleOpenHoliday(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.titleContainer}>
            <View style={[styles.holidayIconBadge, { backgroundColor: '#ffedd5' }]}>
              <Ionicons name="calendar-outline" size={18} color="#f97316" />
            </View>
            <Text style={[styles.holidayTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
          <View style={[styles.durationBadge, { backgroundColor: colors.surfaceSubtle }]}>
            <Text style={[styles.durationText, { color: colors.textMuted }]}>{duration} {duration > 1 ? 'Days' : 'Day'}</Text>
          </View>
        </View>

        <Text style={[styles.holidayPreview, { color: colors.textSecondary }]} numberOfLines={2}>
          {cleanedDetails}
        </Text>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <View style={styles.dateContainer}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.dateText, { color: colors.textMuted }]}>
              {formatHolidayDate(item.from_date, item.to_date)}
            </Text>
          </View>
          <View style={styles.viewDetailsContainer}>
            <Text style={[styles.viewDetailsText, { color: colors.primary }]}>View Details</Text>
            <Ionicons name="chevron-forward-outline" size={14} color={colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="School Holidays" />

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBarContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search holidays..."
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
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchHolidays()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingText}>Loading holidays...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredHolidays}
          keyExtractor={(item) => item.id}
          renderItem={renderHolidayItem}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchHolidays(true)}
              colors={["#f97316"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="gift-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No matching holidays found' : 'No Holidays Found'}
              </Text>
            </View>
          }
        />
      )}

      {/* Holiday Detail Bottom Sheet */}
      <BottomSheetModal
        ref={holidayBottomSheetRef}
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
              <View style={[styles.modalIconContainer, { backgroundColor: isDark ? colors.surfaceSubtle : '#fff7ed' }]}>
                <Ionicons name="gift" size={20} color="#f97316" />
              </View>
              <View style={styles.modalHeaderDetails}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedHoliday?.title}</Text>
                <Text style={[styles.modalSubTitle, { color: '#f97316' }]}>Official School Holiday</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.closeIconButton}
              onPress={() => holidayBottomSheetRef.current?.dismiss()}
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
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Holiday Schedule</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {selectedHoliday ? formatHolidayDate(selectedHoliday.from_date, selectedHoliday.to_date) : ''}
                </Text>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoCol}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Duration</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {selectedHoliday ? getDurationDays(selectedHoliday.from_date, selectedHoliday.to_date) : 0} Day(s)
                </Text>
              </View>
            </View>

            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              {selectedHoliday ? stripHtmlTags(selectedHoliday.details) : ''}
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
    backgroundColor: '#f97316',
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
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
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
  holidayIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holidayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
  },
  durationBadge: {
    backgroundColor: '#fff7ed',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  durationText: {
    fontSize: 11,
    color: '#ea580c',
    fontWeight: '700',
  },
  holidayPreview: {
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
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  viewDetailsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#f97316',
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
    backgroundColor: '#fff7ed',
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
  modalSubTitle: {
    fontSize: 11,
    color: '#ea580c',
    marginTop: 2,
    fontWeight: '700',
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
