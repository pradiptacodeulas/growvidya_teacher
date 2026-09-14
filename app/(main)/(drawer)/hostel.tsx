import React, { useState, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity, 
  RefreshControl 
} from 'react-native';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import InternalHeader from '@/components/InternalHeader';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/constants/theme';
import { apiClient } from '@/services/apiClient';

export interface HostelAllocation {
  id: string | number;
  school_id?: string | number;
  teacher_id?: string | number;
  hostel_name: string;
  hostel_fee?: string | number;
  room_number: string | number;
  academic_year?: string;
  academic_year_label?: string;
  status: string | number;
  created_at: string;
  updated_at?: string;
}

export default function HostelScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const { colors, isDark } = useAppTheme();
  const [hostelData, setHostelData] = useState<HostelAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlanRestricted, setIsPlanRestricted] = useState(false);

  const hasLoadedRef = useRef(false);

  const isAllocationActive = (status: any) => {
    if (status === undefined || status === null) return true;
    return Number(status) === 1 || String(status) === '1' || String(status).toLowerCase() === 'active';
  };

  const fetchHostelData = useCallback(async (isRefresh = false, isSilent = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!isSilent) {
      setIsLoading(true);
    }
    setError(null);
    setIsPlanRestricted(false);

    try {
      const response = await apiClient.get('/teacher/hostel/my-hostel');
      const resData = response.data;
      const raw =
        resData?.data?.hostels ||
        resData?.hostels ||
        (Array.isArray(resData?.data) ? resData.data : []) ||
        (resData?.data?.assigned_hostel ? [resData.data.assigned_hostel] : []);
      const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? [raw] : []);
      const normalized: HostelAllocation[] = list.map((item: any) => ({
        ...item,
        hostel_name: item.hostel_name || 'Hostel Accommodation',
        hostel_fee: item.hostel_fee || undefined,
        room_number: item.room_number ? String(item.room_number) : 'N/A',
        academic_year: item.academic_year_label || item.academic_year || '',
      }));
      setHostelData(normalized);
    } catch (err: any) {
      console.warn('fetchHostelData exception:', err?.message);
      const serverMsg = err?.response?.data?.message;
      const status = err?.response?.status;
      const errorCode = err?.response?.data?.errors?.code;

      const isRestricted =
        status === 403 ||
        errorCode === 'FEATURE_NOT_IN_PLAN' ||
        String(serverMsg || err?.message).toLowerCase().includes('not included in your') ||
        String(serverMsg || err?.message).toLowerCase().includes('subscription plan') ||
        String(serverMsg || err?.message).toLowerCase().includes('feature_not_in_plan');

      if (isRestricted) {
        setIsPlanRestricted(true);
        setError(
          serverMsg ||
          "The Hostel Management module is not included in your school's current subscription plan."
        );
      } else {
        setIsPlanRestricted(false);
        if (err?.message?.includes('Network') || !err?.response) {
          setError('Unable to connect to the server. Please check your internet connection and try again.');
        } else {
          setError(serverMsg || 'Unable to retrieve hostel details at this time. Please try again later.');
        }
      }
      setHostelData([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        fetchHostelData(false, false);
        return;
      }
      fetchHostelData(false, true);
    }, [fetchHostelData])
  );

  const formatFee = (fee?: string | number) => {
    if (!fee) return 'N/A';
    const num = Number(fee);
    if (isNaN(num)) return `₹${fee}`;
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / month`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const cleanStr = String(dateStr).split('T')[0].split(' ')[0];
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const months = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        if (monthIdx >= 0 && monthIdx < 12) {
          return `${day} ${months[monthIdx]} ${year}`;
        }
      }
      return String(dateStr);
    } catch (e) {
      return String(dateStr);
    }
  };

  const renderHeader = () => {
    if (hostelData.length === 0) return null;

    const activeCount = hostelData.filter(item => isAllocationActive(item.status)).length;

    return (
      <View style={styles.headerSummaryContainer}>
        {/* Main Banner Card */}
        <View style={[styles.bannerCard, { backgroundColor: colors.primary }]}>
          <View style={styles.bannerIconBg}>
            <Ionicons name="business" size={28} color="#fff" />
          </View>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerLabel}>Assigned Residence</Text>
            <Text style={styles.bannerValue}>
              {activeCount > 0
                ? `${activeCount} Active ${activeCount === 1 ? 'Residence' : 'Residences'}`
                : 'Allocation Pending'}
            </Text>
          </View>
        </View>

        {/* Quick Stats Grid */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.cardBg, borderColor: colors.border, marginRight: 8 }]}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="home-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Rooms</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{hostelData.length}</Text>
            </View>
          </View>

          <View style={[styles.statBox, { backgroundColor: colors.cardBg, borderColor: colors.border, marginLeft: 8 }]}>
            <View
              style={[
                styles.statIconContainer,
                {
                  backgroundColor: activeCount > 0
                    ? (isDark ? 'rgba(22, 163, 74, 0.2)' : '#dcfce7')
                    : (isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2'),
                },
              ]}
            >
              <Ionicons
                name={activeCount > 0 ? "checkmark-circle-outline" : "close-circle-outline"}
                size={18}
                color={activeCount > 0 ? "#16a34a" : "#dc2626"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Status</Text>
              <Text
                style={[
                  styles.statValue,
                  { color: activeCount > 0 ? (isDark ? '#4ade80' : '#15803d') : (isDark ? '#f87171' : '#b91c1c') },
                ]}
              >
                {activeCount > 0 ? 'Allocated' : 'Inactive'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderHostelItem = ({ item }: { item: HostelAllocation }) => {
    const isActive = isAllocationActive(item.status);

    return (
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="business-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.titleTextContainer}>
              <Text style={[styles.hostelName, { color: colors.text }]}>{item.hostel_name}</Text>
              {item.academic_year ? (
                <Text style={[styles.subtext, { color: colors.textMuted }]}>
                  Academic Year: {item.academic_year}
                </Text>
              ) : null}
            </View>
          </View>
          <View
            style={[
              styles.statusBadge,
              isActive
                ? (isDark ? { backgroundColor: 'rgba(22, 163, 74, 0.2)' } : styles.activeBadge)
                : (isDark ? { backgroundColor: 'rgba(220, 38, 38, 0.2)' } : styles.inactiveBadge),
            ]}
          >
            <View style={[styles.statusDot, isActive ? styles.activeDot : styles.inactiveDot]} />
            <Text
              style={[
                styles.statusText,
                isActive
                  ? (isDark ? { color: '#4ade80' } : styles.activeText)
                  : (isDark ? { color: '#f87171' } : styles.inactiveText),
              ]}
            >
              {isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Card Body - Details */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailRow}>
            <View style={[styles.detailIconBg, { backgroundColor: isDark ? 'rgba(61, 94, 225, 0.15)' : '#eff6ff' }]}>
              <Ionicons name="key-outline" size={16} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Room Number</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>Room {item.room_number || 'N/A'}</Text>
            </View>
          </View>

          {item.hostel_fee ? (
            <View style={styles.detailRow}>
              <View style={[styles.detailIconBg, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ecfdf5' }]}>
                <Ionicons name="wallet-outline" size={16} color="#10b981" />
              </View>
              <View style={styles.detailContent}>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Monthly Fee</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>{formatFee(item.hostel_fee)}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <View style={[styles.detailIconBg, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb' }]}>
              <Ionicons name="calendar-outline" size={16} color="#f59e0b" />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Allocation Date</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="My Hostel" />

      {isPlanRestricted ? (
        <View style={styles.centerContainer}>
          <View style={[styles.planIconCircle, { backgroundColor: isDark ? 'rgba(234, 179, 8, 0.15)' : '#fef9c3' }]}>
            <Ionicons name="lock-closed" size={38} color={isDark ? '#facc15' : '#ca8a04'} />
          </View>
          <Text style={[styles.planTitle, { color: colors.text }]}>Hostel Module Not Available</Text>
          <Text style={[styles.planSubtitle, { color: colors.textMuted }]}>
            {error || "The Hostel Management module is not included in your school's current subscription plan."}
          </Text>

          <View style={[styles.planInfoBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.planInfoText, { color: colors.textSecondary }]}>
              Please contact your school administration or manager to upgrade the subscription package.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary, marginTop: 18 }]}
            onPress={() => fetchHostelData(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="alert-circle-outline" size={44} color="#ef4444" />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Unable to Load Hostel Details</Text>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={() => fetchHostelData()}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading hostel details...</Text>
        </View>
      ) : (
        <FlatList
          data={hostelData}
          keyExtractor={(item, index) => (item.id != null ? String(item.id) : String(index))}
          renderItem={renderHostelItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchHostelData(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(61, 94, 225, 0.12)' : '#eff6ff' }]}>
                <Ionicons name="bed-outline" size={42} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Hostel Assigned</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                You have not been allocated any hostel accommodation yet. Once your room is allocated by the school administration, the residence details will appear here.
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.primary, marginTop: 18 }]}
                onPress={() => fetchHostelData(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.retryButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    flexGrow: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  planIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  planSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  planInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    maxWidth: 340,
  },
  planInfoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  headerSummaryContainer: {
    marginBottom: 16,
  },
  bannerCard: {
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#3d5ee1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  bannerIconBg: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  bannerContent: {
    flex: 1,
  },
  bannerLabel: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  bannerValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 1,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
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
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleTextContainer: {
    flex: 1,
  },
  hostelName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtext: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  activeBadge: {
    backgroundColor: '#dcfce7',
  },
  inactiveBadge: {
    backgroundColor: '#fee2e2',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    backgroundColor: '#16a34a',
  },
  inactiveDot: {
    backgroundColor: '#dc2626',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activeText: {
    color: '#15803d',
  },
  inactiveText: {
    color: '#b91c1c',
  },
  divider: {
    height: 1,
    marginBottom: 14,
  },
  detailsGrid: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
