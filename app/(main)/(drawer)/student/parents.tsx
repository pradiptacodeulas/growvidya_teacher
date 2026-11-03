import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, BackHandler, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import InternalHeader from '@/components/InternalHeader';
import { apiClient } from '@/services/apiClient';

const formatAddressObj = (addressVal: any) => {
  if (!addressVal) return 'N/A';
  if (typeof addressVal === 'string') return addressVal || 'N/A';
  if (Array.isArray(addressVal) && addressVal.length > 0) {
    const addr = addressVal[0];
    const parts = [
      addr.address1,
      addr.address2,
      addr.city_name || addr.city,
      addr.state_name || addr.state,
      addr.country_name || addr.country,
      addr.postal_code
    ].filter(Boolean);
    return parts.join(', ') || 'N/A';
  }
  return 'N/A';
};

export default function StudentParentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const token = useAppSelector(state => state.auth.token);
  const students = useAppSelector(state => state.students.students);
  const student = students.find(s => String(s.id) === String(id));

  const [parentsData, setParentsData] = useState<any>(null);
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

  const loadParents = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await apiClient.get(`/admin/students/${id}`);
      const resData = response.data;
      const data = resData?.data?.student || resData?.student || resData?.data || resData;

      if (data && typeof data === 'object') {
        const fatherAddr = data.father_address || data.father_address_1 || (data.father_info ? data.father_info.father_address_1 : '') || 'N/A';
        const motherAddr = data.mother_address || data.mother_address_1 || (data.mother_info ? data.mother_info.mother_address_1 : '') || 'N/A';
        const guardianAddr = data.other_guardian_address || fatherAddr;

        setParentsData({
          ...data,
          first_name: data.father_first_name || (data.father_name ? data.father_name.split(' ')[0] : '') || '',
          last_name: data.father_last_name || (data.father_name ? data.father_name.split(' ').slice(1).join(' ') : '') || '',
          phone: data.father_phone || '',
          email: data.father_email || '',
          occupation: data.father_occupation || '',
          father_address: fatherAddr,
          mother_first_name: data.mother_first_name || (data.mother_name ? data.mother_name.split(' ')[0] : '') || '',
          mother_last_name: data.mother_last_name || (data.mother_name ? data.mother_name.split(' ').slice(1).join(' ') : '') || '',
          mother_phone: data.mother_phone || '',
          mother_email: data.mother_email || '',
          mother_occupation: data.mother_occupation || '',
          mother_address: motherAddr,
          guardian_first_name: data.other_guardian_first_name || data.father_first_name || (data.parent_name ? data.parent_name.split(' ')[0] : '') || '',
          guardian_last_name: data.other_guardian_last_name || data.father_last_name || '',
          guardian_phone: data.other_guardian_phone || data.parent_phone || data.father_phone || '',
          guardian_email: data.other_guardian_email || data.parent_email || data.father_email || '',
          guardian_occupation: data.other_guardian_occupation || data.father_occupation || '',
          guardian_address: guardianAddr,
        });
      } else {
        setError('Failed to parse parent data');
      }
    } catch (err: any) {
      console.warn('loadParents exception:', err?.message);
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadParents();
    }
  }, [id, loadParents]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadParents(true);
  }, [loadParents]);

  if (!student) {
    return (
      <View style={styles.container}>
        <InternalHeader title="Parents & Guardian" onBack={handleBack} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Student not found</Text>
        </View>
      </View>
    );
  }

  // Extract fields from parentsData API payload
  const fatherName = parentsData ? `${parentsData.first_name || ''} ${parentsData.last_name || ''}`.trim() : 'N/A';
  const fatherPhone = parentsData?.phone || 'N/A';
  const fatherEmail = parentsData?.email || 'N/A';
  const fatherOccupation = parentsData?.occupation || 'N/A';
  const fatherAddress = parentsData ? formatAddressObj(parentsData.father_address) : 'N/A';

  const motherName = parentsData ? `${parentsData.mother_first_name || ''} ${parentsData.mother_last_name || ''}`.trim() : 'N/A';
  const motherPhone = parentsData?.mother_phone || 'N/A';
  const motherEmail = parentsData?.mother_email || 'N/A';
  const motherOccupation = parentsData?.mother_occupation || 'N/A';
  const motherAddress = parentsData ? formatAddressObj(parentsData.mother_address) : 'N/A';

  const guardianName = parentsData ? `${parentsData.guardian_first_name || ''} ${parentsData.guardian_last_name || ''}`.trim() : 'N/A';
  const guardianPhone = parentsData?.guardian_phone || 'N/A';
  const guardianEmail = parentsData?.guardian_email || 'N/A';
  const guardianOccupation = parentsData?.guardian_occupation || 'N/A';
  const guardianAddress = parentsData ? formatAddressObj(parentsData.guardian_address) : 'N/A';

  return (
    <View style={styles.container}>
      <InternalHeader title="Parents & Guardian" onBack={handleBack} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3d5ee1" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (!parentsData || Object.keys(parentsData).length === 0) ? (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3d5ee1"]} />
          }
        >
          <View style={styles.emptyStateCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="people-outline" size={48} color="#7a869a" />
            </View>
            <Text style={styles.emptyStateTitle}>No Parents/Guardian Info</Text>
            <Text style={styles.emptyStateSubtitle}>
              No parent or guardian details have been registered for this student.
            </Text>
          </View>
        </ScrollView>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3d5ee1"]} />
          }
        >
          {/* Father Card */}
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>Father Details</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{fatherName || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{fatherPhone || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{fatherEmail || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Occupation</Text>
              <Text style={styles.value}>{fatherOccupation || 'N/A'}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.label}>Address</Text>
              <Text style={[styles.value, { maxWidth: '60%', textAlign: 'right' }]}>{fatherAddress}</Text>
            </View>
          </View>

          {/* Mother Card */}
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.sectionHeading}>Mother Details</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{motherName || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{motherPhone || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{motherEmail || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Occupation</Text>
              <Text style={styles.value}>{motherOccupation || 'N/A'}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.label}>Address</Text>
              <Text style={[styles.value, { maxWidth: '60%', textAlign: 'right' }]}>{motherAddress}</Text>
            </View>
          </View>

          {/* Guardian Card */}
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.sectionHeading}>Guardian Details</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Name</Text>
              <Text style={styles.value}>{guardianName || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Phone</Text>
              <Text style={styles.value}>{guardianPhone || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{guardianEmail || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Occupation</Text>
              <Text style={styles.value}>{guardianOccupation || 'N/A'}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.label}>Address</Text>
              <Text style={[styles.value, { maxWidth: '60%', textAlign: 'right' }]}>{guardianAddress}</Text>
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
    paddingVertical: 10,
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
