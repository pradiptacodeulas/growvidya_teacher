import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  RefreshControl, 
  Linking, 
  Alert,
} from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import InternalHeader from '@/components/InternalHeader';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/constants/theme';
import { apiClient, getFileUrl } from '@/services/apiClient';

interface LeaveItem {
  id: string;
  role: string;
  school_id: string;
  staff_id: string;
  leave_id: string;
  duration: string;
  document: string | null;
  leave_reason: string;
  status: string;
  created_at: string;
  date: string;
  leave_status: string;
  leave_name: string;
  person_name: string;
  person_picture: string | null;
  gender: string;
}

interface LeaveDetailDay {
  id: string;
  school_id: string;
  staff_leave_id: string;
  date: string;
  status: string;
  leave_name: string;
  leave_reason: string;
  document: string | null;
  person_name: string;
  person_picture: string | null;
  gender: string;
}

export default function LeavesScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const leaveDetailBottomSheetRef = useRef<BottomSheetModal>(null);
  
  // Leave list states
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Leave detail states
  const [selectedLeaveItem, setSelectedLeaveItem] = useState<LeaveItem | null>(null);
  const [selectedLeaveDetails, setSelectedLeaveDetails] = useState<LeaveDetailDay[]>([]);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

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

  // Fetch leaves from API
  const fetchLeaves = useCallback(async (isRefresh = false, isSilent = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!isSilent) {
      setIsLoadingList(true);
    }
    setListError(null);

    try {
      const response = await apiClient.get('/teacher/leaves/my-leaves');
      const resData = response.data;
      const list =
        resData?.data?.leaves ||
        resData?.leaves ||
        (Array.isArray(resData?.data) ? resData.data : []);

      // Normalize status and date properties for UI
      const normalizedList = list.map((item: any) => ({
        ...item,
        status: String(item.leave_status || item.status || '1'),
        date: item.leave_date || item.created_at || '',
      }));

      setLeaves(normalizedList);
    } catch (err: any) {
      console.warn('fetchLeaves exception:', err?.message);
      setListError(err?.response?.data?.message || err?.message || 'An error occurred while fetching leaves');
    } finally {
      setIsLoadingList(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeaves(false, true);
    }, [fetchLeaves])
  );

  // Fetch leave details day-by-day
  const handleViewDetails = async (item: LeaveItem) => {
    setSelectedLeaveItem(item);
    leaveDetailBottomSheetRef.current?.present();
    setIsLoadingDetails(true);
    setDetailsError(null);
    setSelectedLeaveDetails([]);

    try {
      const response = await apiClient.get(`/teacher/leaves/my-leaves/${item.id}`);
      const resData = response.data;
      const leaveData = resData?.data?.leave || resData?.leave;

      if (leaveData?.dates && Array.isArray(leaveData.dates)) {
        const days = leaveData.dates.map((d: any) => ({
          id: String(d.id),
          school_id: String(leaveData.school_id || ''),
          staff_leave_id: String(d.staff_leave_id || item.id),
          date: d.date,
          status: String(d.status || item.status),
          leave_name: leaveData.leave_name || item.leave_name,
          leave_reason: leaveData.leave_reason || item.leave_reason,
          document: leaveData.document || item.document,
          person_name: item.person_name || '',
          person_picture: item.person_picture || null,
          gender: item.gender || '',
        }));
        setSelectedLeaveDetails(days);
      } else {
        setDetailsError('No breakdown details found for this leave.');
      }
    } catch (err: any) {
      console.warn('handleViewDetails exception:', err?.message);
      setDetailsError(err?.response?.data?.message || err?.message || 'An error occurred while loading details');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const formatDateString = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    try {
      const datePart = dateStr.split(' ')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const months = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        return `${day} ${months[monthIdx]} ${year}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  // Maps leave_status value to appropriate badge styles
  const getStatusStyle = (status: string) => {
    switch (status) {
      case '2': // Approved
        return { 
          label: 'Approved', 
          bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#d1fae5', 
          color: isDark ? '#34d399' : '#065f46', 
          dot: '#10b981' 
        };
      case '3': // Rejected
        return { 
          label: 'Rejected', 
          bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2', 
          color: isDark ? '#f87171' : '#991b1b', 
          dot: '#ef4444' 
        };
      default: // Pending
        return { 
          label: 'Pending', 
          bg: isDark ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe', 
          color: isDark ? '#38bdf8' : '#0369a1', 
          dot: '#0284c7' 
        };
    }
  };

  // Maps duration value to the requested enum: 1=Full Day, 2=Half Day, 3=Multiple
  const getDurationLabel = (durationVal: string) => {
    switch (durationVal) {
      case '1':
        return 'Full Day';
      case '2':
        return 'Half Day';
      case '3':
        return 'Multiple';
      default:
        return `${durationVal} Day(s)`;
    }
  };

  const handleOpenAttachment = async (docUrl: string | null) => {
    if (!docUrl) return;
    const fullUrl = getFileUrl(docUrl);
    
    try {
      await Linking.openURL(fullUrl);
    } catch (e) {
      Alert.alert('Error', 'Cannot open document URL');
    }
  };

  const renderLeaveItem = ({ item }: { item: LeaveItem }) => {
    const statusStyle = getStatusStyle(item.leave_status || item.status);
    
    return (
      <TouchableOpacity 
        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={() => handleViewDetails(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.leaveTypeHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="calendar" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.leaveName, { color: colors.text }]}>{item.leave_name || 'Leave Request'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
            <Text style={[styles.statusText, { color: statusStyle.color }]}>
              {statusStyle.label}
            </Text>
          </View>
        </View>

        <View style={styles.detailsGrid}>
          <View style={styles.detailCol}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Start Date</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{formatDateString(item.date)}</Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Duration</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{getDurationLabel(item.duration)}</Text>
          </View>
        </View>

        {item.leave_reason ? (
          <View style={styles.reasonSection}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Reason</Text>
            <Text style={[styles.reasonText, { color: colors.textSecondary }]}>{item.leave_reason}</Text>
          </View>
        ) : null}

        {item.document ? (
          <View style={[styles.attachmentSection, { borderTopColor: colors.border }]}>
            <TouchableOpacity 
              style={[styles.attachmentButton, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
              onPress={() => handleOpenAttachment(item.document)}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={16} color={colors.primary} />
              <Text style={[styles.attachmentText, { color: colors.primary }]}>View Attachment</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.appliedOnText, { color: colors.textMuted }]}>Applied on: {formatDateString(item.created_at)}</Text>
          <Text style={[styles.clickDetailsText, { color: colors.primary }]}>Tap to view details</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const handleApply = () => {
    router.push('/(main)/(drawer)/apply-leave');
  };

  const applyHeaderButton = (
    <TouchableOpacity 
      style={[styles.applyHeaderBtn, { backgroundColor: colors.primary }]} 
      onPress={handleApply}
      activeOpacity={0.7}
    >
      <Text style={styles.applyHeaderBtnText}>Apply</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="My Leave" rightAction={applyHeaderButton} />

      {listError ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={[styles.errorText, { color: colors.text }]}>{listError}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => fetchLeaves()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : isLoadingList && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading leave requests...</Text>
        </View>
      ) : (
        <FlatList
          data={leaves}
          keyExtractor={(item) => item.id}
          renderItem={renderLeaveItem}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchLeaves(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No Leave Requests Found</Text>
            </View>
          }
        />
      )}

      {/* Day-by-Day Details Bottom Sheet */}
      <BottomSheetModal
        ref={leaveDetailBottomSheetRef}
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
                <Ionicons name="calendar" size={20} color={colors.primary} />
              </View>
              <View style={styles.modalHeaderDetails}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedLeaveItem?.leave_name || 'Leave Details'}</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>Day-by-Day Breakdown</Text>
              </View>
            </View>
            <TouchableOpacity 
              style={styles.closeIconButton}
              onPress={() => leaveDetailBottomSheetRef.current?.dismiss()}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <BottomSheetScrollView 
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false} 
            contentContainerStyle={styles.modalBody}
          >
            {/* Summary Section */}
            <View style={styles.modalSummarySection}>
              <View style={styles.modalSummaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Duration:</Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{selectedLeaveItem ? getDurationLabel(selectedLeaveItem.duration) : 'N/A'}</Text>
              </View>
              {selectedLeaveItem?.leave_reason ? (
                <View style={[styles.modalReasonBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                  <Text style={[styles.reasonBoxLabel, { color: colors.textMuted }]}>Reason for Leave</Text>
                  <Text style={[styles.reasonBoxText, { color: colors.textSecondary }]}>"{selectedLeaveItem.leave_reason}"</Text>
                </View>
              ) : null}
            </View>

            {/* Day-by-Day Breakdown Header */}
            <Text style={[styles.breakdownListTitle, { color: colors.text }]}>Status per Day</Text>

            {isLoadingDetails ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.modalLoadingText, { color: colors.textMuted }]}>Loading day-by-day status...</Text>
              </View>
            ) : detailsError ? (
              <View style={styles.modalErrorContainer}>
                <Ionicons name="warning-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.modalErrorText, { color: colors.textMuted }]}>{detailsError}</Text>
              </View>
            ) : (
              <View style={styles.breakdownList}>
                {selectedLeaveDetails.map((day, index) => {
                  const statusStyle = getStatusStyle(day.status);
                  return (
                    <View key={day.id || index} style={[styles.breakdownItem, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                      <View style={styles.breakdownLeft}>
                        <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                        <Text style={[styles.breakdownDate, { color: colors.text }]}>{formatDateString(day.date)}</Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
                        <Text style={[styles.statusText, { color: statusStyle.color }]}>
                          {statusStyle.label}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Attachment if present */}
            {selectedLeaveItem?.document ? (
              <TouchableOpacity 
                style={[styles.modalAttachmentBtn, { backgroundColor: colors.primaryLight, borderColor: colors.border }]}
                onPress={() => handleOpenAttachment(selectedLeaveItem.document)}
                activeOpacity={0.7}
              >
                <Ionicons name="document-attach-outline" size={18} color={colors.primary} />
                <Text style={[styles.modalAttachmentText, { color: colors.primary }]}>Open Application Document</Text>
              </TouchableOpacity>
            ) : null}
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
    marginBottom: 14,
  },
  leaveTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailsGrid: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 24,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  reasonSection: {
    marginBottom: 12,
  },
  reasonText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  attachmentSection: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
    marginBottom: 8,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attachmentText: {
    fontSize: 13,
    color: '#3d5ee1',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
    marginTop: 4,
  },
  appliedOnText: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '500',
  },
  clickDetailsText: {
    fontSize: 11,
    color: '#3d5ee1',
    fontWeight: '600',
  },
  applyHeaderBtn: {
    backgroundColor: '#3d5ee1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyHeaderBtnText: {
    color: '#fff',
    fontSize: 13,
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
  modalSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '500',
  },
  closeIconButton: {
    padding: 6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  modalBody: {
    paddingBottom: 20,
  },
  modalSummarySection: {
    marginBottom: 20,
  },
  modalSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '600',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '700',
  },
  modalReasonBox: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderRadius: 12,
    padding: 12,
    marginTop: 4,
  },
  reasonBoxLabel: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  reasonBoxText: {
    fontSize: 13,
    color: '#4b5563',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  breakdownListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  breakdownList: {
    gap: 8,
    marginBottom: 20,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakdownDate: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f2937',
  },
  modalLoadingContainer: {
    paddingVertical: 30,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalLoadingText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  modalErrorContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalErrorText: {
    fontSize: 13,
    color: '#ef4444',
    textAlign: 'center',
    fontWeight: '500',
  },
  modalAttachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    gap: 8,
    marginTop: 10,
  },
  modalAttachmentText: {
    color: '#3d5ee1',
    fontSize: 13,
    fontWeight: '700',
  },
});
