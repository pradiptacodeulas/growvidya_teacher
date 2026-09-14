import React, { useState, useEffect, useCallback } from 'react';
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

export interface TransportAllocation {
  id: string;
  school_id: string;
  teacher_id: string;
  route: string;
  vehicle_number: string;
  pickup_point: string;
  drop_point: string;
  academic_year: string;
  staus?: string;
  status?: string;
  created_at: string;
  updated_at: string;
  transport_route: string;
  number_plate: string;
}

export default function TransportScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const { colors, isDark } = useAppTheme();
  const [transportData, setTransportData] = useState<TransportAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransportData = useCallback(async (isRefresh = false, isSilent = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!isSilent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await apiClient.get('/teacher/transport/my-transport');
      const resData = response.data;
      const raw = resData?.data?.transports || resData?.transports || (Array.isArray(resData?.data) ? resData.data : []);
      const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? [raw] : []);
      const normalized = list.map((item: any) => ({
        ...item,
        transport_route: item.transport_route || item.route_name || 'Assigned Route',
        vehicle_number: item.vehicle_number || item.number_plate || item.vehicle_name || 'N/A',
        academic_year: item.academic_year || item.academic_year_label || '',
      }));
      setTransportData(normalized);
    } catch (err: any) {
      console.warn('fetchTransportData exception:', err?.message);
      setError(err?.response?.data?.message || err?.message || 'An error occurred while fetching transport details');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchTransportData(false, transportData.length > 0);
    }, [fetchTransportData, transportData.length])
  );

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const parts = dateStr.split(' ');
      const dateParts = parts[0].split('-');
      if (dateParts.length === 3) {
        const year = dateParts[0];
        const monthIdx = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[2], 10);
        const months = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        return `${day} ${months[monthIdx] || dateParts[1]} ${year}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const renderHeader = () => {
    if (transportData.length === 0) return null;

    const activeCount = transportData.filter(
      (item) => (item.staus || item.status) === '1'
    ).length;

    return (
      <View style={styles.headerSummaryContainer}>
        {/* Main Banner Card */}
        <View style={[styles.bannerCard, { backgroundColor: colors.primary }]}>
          <View style={styles.bannerIconBg}>
            <Ionicons name="bus-outline" size={28} color="#fff" />
          </View>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerLabel}>Assigned Transport</Text>
            <Text style={styles.bannerValue}>
              {activeCount} {activeCount === 1 ? 'Active Route' : 'Active Routes'}
            </Text>
          </View>
        </View>

        {/* Quick Stats Grid */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.cardBg, borderColor: colors.border, marginRight: 8 }]}>
            <View style={[styles.statIconContainer, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="navigate-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Routes</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{transportData.length}</Text>
            </View>
          </View>

          <View style={[styles.statBox, { backgroundColor: colors.cardBg, borderColor: colors.border, marginLeft: 8 }]}>
            <View style={[styles.statIconContainer, { backgroundColor: isDark ? 'rgba(22, 163, 74, 0.2)' : '#dcfce7' }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Status</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{activeCount > 0 ? 'Assigned' : 'Unassigned'}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderTransportItem = ({ item }: { item: TransportAllocation }) => {
    const isActive = (item.staus || item.status) === '1';

    return (
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="bus-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.titleTextContainer}>
              <Text style={[styles.routeTitle, { color: colors.text }]}>{item.transport_route || `Route #${item.route}`}</Text>
              {item.number_plate ? (
                <View style={[styles.plateBadge, { backgroundColor: isDark ? '#3b2d07' : '#fef08a', borderColor: isDark ? '#854d0e' : '#ca8a04' }]}>
                  <Text style={[styles.plateText, { color: isDark ? '#fef08a' : '#854d0e' }]}>{item.number_plate}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={[styles.statusBadge, isActive ? (isDark ? { backgroundColor: 'rgba(22, 163, 74, 0.2)' } : styles.activeBadge) : (isDark ? { backgroundColor: 'rgba(220, 38, 38, 0.2)' } : styles.inactiveBadge)]}>
            <View style={[styles.statusDot, isActive ? styles.activeDot : styles.inactiveDot]} />
            <Text style={[styles.statusText, isActive ? (isDark ? { color: '#4ade80' } : styles.activeText) : (isDark ? { color: '#f87171' } : styles.inactiveText)]}>
              {isActive ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Route Visualizer Flow */}
        <View style={styles.routePathwayContainer}>
          {/* Pickup Point */}
          <View style={styles.pathNode}>
            <View style={[styles.nodeDot, { backgroundColor: colors.cardBg, borderColor: '#10b981' }]}>
              <View style={[styles.nodeDotInner, { backgroundColor: '#10b981' }]} />
            </View>
            <View style={styles.nodeTextContainer}>
              <Text style={[styles.nodeLabel, { color: colors.textMuted }]}>Pickup Point</Text>
              <Text style={[styles.nodeValue, { color: colors.text }]}>{item.pickup_point || 'N/A'}</Text>
            </View>
          </View>

          {/* Connection Line */}
          <View style={styles.pathLineContainer}>
            <View style={[styles.pathLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Drop Point */}
          <View style={styles.pathNode}>
            <View style={[styles.nodeDot, { backgroundColor: colors.cardBg, borderColor: '#ef4444' }]}>
              <View style={[styles.nodeDotInner, { backgroundColor: '#ef4444' }]} />
            </View>
            <View style={styles.nodeTextContainer}>
              <Text style={[styles.nodeLabel, { color: colors.textMuted }]}>Drop Point</Text>
              <Text style={[styles.nodeValue, { color: colors.text }]}>{item.drop_point || 'N/A'}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Card Footer Grid */}
        <View style={styles.detailsGrid}>
          <View style={styles.detailRow}>
            <View style={[styles.detailIconBg, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="car-outline" size={16} color={colors.textMuted} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Vehicle No.</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{item.vehicle_number || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={[styles.detailIconBg, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Academic Year</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{item.academic_year || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={[styles.detailIconBg, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            </View>
            <View style={styles.detailContent}>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Assigned On</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(item.created_at)}</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="My Transport" />

      {error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => fetchTransportData()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View> 
      ) : isLoading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading transport details...</Text>
        </View>
      ) : (
        <FlatList
          data={transportData}
          keyExtractor={(item, index) => (item.id ? String(item.id) : String(index))}
          renderItem={renderTransportItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchTransportData(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />  
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="bus-outline" size={48} color={colors.textMuted} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Transport Assigned</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {` You are currently not registered for transport or bus route services.`}
              </Text>
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
  headerSummaryContainer: {
    marginBottom: 16,
  },
  bannerCard: {
    backgroundColor: '#3d5ee1',
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
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
    alignItems: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  titleTextContainer: {
    flex: 1,
  },
  routeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  plateBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#fef08a',
    borderWidth: 1,
    borderColor: '#ca8a04',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  plateText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#854d0e',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
    marginRight: 4,
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
    textTransform: 'uppercase',
  },
  activeText: {
    color: '#15803d',
  },
  inactiveText: {
    color: '#b91c1c',
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginVertical: 12,

  },
  routePathwayContainer: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  pathNode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nodeDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginRight: 12,
  },
  nodeDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  nodeTextContainer: {
    flex: 1,
  },
  nodeLabel: {
    fontSize: 11,
    color: '#6b7280',
    fontWeight: '500',
  },
  nodeValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 1,
  },
  pathLineContainer: {
    paddingLeft: 8,
    height: 24,
    justifyContent: 'center',
  },
  pathLine: {
    width: 2,
    height: '100%',
    backgroundColor: '#d1d5db',
    borderRadius: 1,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIconBg: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 1,
  },
  emptyContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
  },
});
