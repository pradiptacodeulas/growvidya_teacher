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

interface EventItem {
  id: string;
  school_id: string;
  title: string;
  from_date: string;
  to_date: string;
  details: string;
  status: string;
  created_on: string;
}

export default function EventScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  // Events List State
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Search
  const [searchQuery, setSearchQuery] = useState('');
  
  // Bottom Sheet Ref & State
  const eventBottomSheetRef = useRef<BottomSheetModal>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);

  // Ref to prevent initial focus loop
  const hasLoadedRef = useRef(false);

  // Fetch events from API
  const fetchEvents = useCallback(async (isRefresh = false, isSilent = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!isSilent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await apiClient.get('/teacher/announcements/events');
      const resData = response.data;
      const list = resData?.data?.events || resData?.events || (Array.isArray(resData?.data) ? resData.data : []);

      if (Array.isArray(list)) {
        const eventArray: EventItem[] = list.map((e: any) => ({
          ...e,
          from_date: e.from_date || e.start_date || '',
          to_date: e.to_date || e.end_date || '',
          details: e.details || e.description || '',
        }));

        eventArray.sort((a, b) => new Date(String(a.from_date).replace(' ', 'T')).getTime() - new Date(String(b.from_date).replace(' ', 'T')).getTime());
        setEvents(eventArray);
      } else {
        setEvents([]);
      }
    } catch (err: any) {
      console.warn('fetchEvents exception:', err?.message);
      setError(err?.response?.data?.message || err?.message || 'An error occurred while fetching events.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        fetchEvents(false, false);
        return;
      }
      fetchEvents(false, true);
    }, [fetchEvents])
  );

  // Clean details string (decodes HTML entities and strips any tags)
  const cleanDetailsString = (str: string) => {
    if (!str) return '';
    return str
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&nbsp;/g, ' ')
      .trim();
  };

  // Format date-time helper
  const formatDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return { date: '', time: '' };
    // Replace space with T for Safari/iOS compatibility
    const dateObj = new Date(dateTimeStr.replace(' ', 'T'));
    if (isNaN(dateObj.getTime())) return { date: dateTimeStr, time: '' };
    
    const dateFormatted = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeFormatted = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    return {
      date: dateFormatted,
      time: timeFormatted
    };
  };

  const handleOpenEvent = (event: EventItem) => {
    setSelectedEvent(event);
    eventBottomSheetRef.current?.present();
  };

  // Filter events based on search query
  const filteredEvents = events.filter(item => 
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

  const renderEventItem = ({ item }: { item: EventItem }) => {
    const cleanedDetails = cleanDetailsString(item.details);
    const start = formatDateTime(item.from_date);
    const end = formatDateTime(item.to_date);

    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => handleOpenEvent(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.titleContainer}>
            <View style={[styles.eventIconBadge, { backgroundColor: '#f3e8ff' }]}>
              <Ionicons name="sparkles-outline" size={18} color="#8b5cf6" />
            </View>
            <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
        </View>

        <Text style={[styles.eventPreview, { color: colors.textSecondary }]} numberOfLines={2}>
          {cleanedDetails}
        </Text>

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <View style={styles.dateContainer}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} style={styles.inlineIcon} />
            <Text style={[styles.dateText, { color: colors.textMuted }]} numberOfLines={1} ellipsizeMode="tail">
              {start.date === end.date ? `${start.date} | ${start.time}` : `${start.date} - ${end.date}`}
            </Text>
          </View>
          <View style={styles.viewDetailsContainer}>
            <Text style={[styles.viewDetailsText, { color: colors.primary }]}>View</Text>
            <Ionicons name="chevron-forward-outline" size={14} color={colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="School Events" />

      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBarContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search events..."
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
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => fetchEvents()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading events...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={renderEventItem}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchEvents(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {searchQuery ? 'No matching events found' : 'No Events Found'}
              </Text>
            </View>
          }
        />
      )}

      {/* Event Detail Bottom Sheet */}
      <BottomSheetModal
        ref={eventBottomSheetRef}
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
              <View style={[styles.modalIconContainer, { backgroundColor: isDark ? colors.surfaceSubtle : '#f5f3ff' }]}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
              </View>
              <View style={styles.modalHeaderDetails}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedEvent?.title}</Text>
                <Text style={[styles.modalSubTitle, { color: colors.primary }]}>School Event &amp; Gathering</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.closeIconButton}
              onPress={() => eventBottomSheetRef.current?.dismiss()}
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
            {/* Event Schedule Block */}
            <View style={[styles.infoBlock, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
              <View style={styles.infoCol}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Starts</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {selectedEvent ? formatDateTime(selectedEvent.from_date).date : ''}
                </Text>
                <Text style={[styles.infoSubValue, { color: colors.textMuted }]}>
                  {selectedEvent ? formatDateTime(selectedEvent.from_date).time : ''}
                </Text>
              </View>
              <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
              <View style={styles.infoCol}>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Ends</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {selectedEvent ? formatDateTime(selectedEvent.to_date).date : ''}
                </Text>
                <Text style={[styles.infoSubValue, { color: colors.textMuted }]}>
                  {selectedEvent ? formatDateTime(selectedEvent.to_date).time : ''}
                </Text>
              </View>
            </View>

            <Text style={[styles.modalMessage, { color: colors.textSecondary }]}>
              {selectedEvent ? cleanDetailsString(selectedEvent.details) : ''}
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
    backgroundColor: '#8b5cf6',
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
    borderLeftColor: '#8b5cf6',
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
  eventIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
    flex: 1,
  },
  eventPreview: {
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
    flex: 1,
  },
  inlineIcon: {
    marginRight: 4,
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
    marginLeft: 10,
  },
  viewDetailsText: {
    fontSize: 12,
    color: '#8b5cf6',
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
    backgroundColor: '#f5f3ff',
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
    color: '#8b5cf6',
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
  infoSubValue: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 1,
    fontWeight: '500',
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
