import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, BackHandler, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import InternalHeader from '@/components/InternalHeader';
import { useAppTheme } from '@/constants/theme';
import { apiClient } from '@/services/apiClient';

export default function StudentHostelScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const students = useAppSelector(state => state.students.students);
  const student = students.find(s => String(s.id) === String(id));
  const { colors, isDark } = useAppTheme();

  const [hostelData, setHostelData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    router.navigate({
      pathname: '/(main)/(drawer)/student/[id]',
      params: { id }
    });
  };

  useEffect(() => {
    const handleHardwareBack = () => {
      handleBack();
      return true; // prevent default back behavior
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => {
      subscription.remove();
    };
  }, [router, id]);

  const loadHostel = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await apiClient.get<any>(`/admin/students/${id}`);
      const st = response.data?.data?.student || response.data?.student || response.data?.data || response.data;
      if (st && typeof st === 'object' && (st.hostel_name || st.room_number)) {
        setHostelData({
          status: '1',
          hostel_name: st.hostel_name || 'N/A',
          room_name: String(st.room_number || 'N/A'),
          room_number: String(st.room_number || 'N/A'),
        });
      } else {
        setHostelData(null);
      }
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message;
      setError(serverMsg || (err?.message?.includes('Network') ? 'Unable to connect to server.' : 'Failed to fetch student hostel details'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadHostel();
    }
  }, [id, loadHostel]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHostel(true);
  }, [loadHostel]);

  if (!student) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <InternalHeader title="Hostel" onBack={handleBack} />
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>Student not found</Text>
        </View>
      </View>
    );
  }

  const hasHostel = hostelData && hostelData.status === '1';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Hostel Details" onBack={handleBack} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
        </View>
      ) : !hasHostel ? (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
        >
          <View style={[styles.emptyStateCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="business-outline" size={48} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Hostel Assigned</Text>
            <Text style={[styles.emptyStateSubtitle, { color: colors.textMuted }]}>
              This student is not registered for hostel services.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
        >
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Text style={[styles.sectionHeading, { color: colors.primary }]}>Hostel & Room Details</Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Hostel Name</Text>
              <Text style={[styles.value, { color: colors.text }]}>{hostelData.hostel_name || 'N/A'}</Text>
            </View>
            <View style={[styles.row, { borderBottomColor: colors.border }]}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Room Name/No</Text>
              <Text style={[styles.value, { color: colors.text }]}>{hostelData.room_name || 'N/A'}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Room ID/Key</Text>
              <Text style={[styles.value, { color: colors.text }]}>{hostelData.room_number || 'N/A'}</Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
  errorText: { color: '#7a869a', fontSize: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3d5ee1',
    marginBottom: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f2f5',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  label: { fontSize: 13, color: '#7a869a', fontWeight: '500' },
  value: { fontSize: 13, color: '#202c4b', fontWeight: '600' },
  emptyStateCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f2f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202c4b',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: '#7a869a',
    textAlign: 'center',
    lineHeight: 18,
  },
});
