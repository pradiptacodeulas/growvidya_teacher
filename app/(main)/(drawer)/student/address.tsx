import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, BackHandler, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import InternalHeader from '@/components/InternalHeader';
import { apiClient } from '@/services/apiClient';

const formatAddressObj = (addr: any) => {
  if (!addr) return 'N/A';
  const parts = [
    addr.address1,
    addr.address2,
    addr.city_name,
    addr.state_name,
    addr.country_name,
    addr.postal_code
  ].filter(Boolean);
  return parts.join(', ') || 'N/A';
};

export default function StudentAddressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const token = useAppSelector(state => state.auth.token);
  const students = useAppSelector(state => state.students.students);
  const student = students.find(s => String(s.id) === String(id));

  const [addressList, setAddressList] = useState<any[]>([]);
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

  const loadAddress = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await apiClient.get(`/admin/students/${id}`);
      const resData = response.data;
      const data = resData?.data?.student || resData?.student || resData?.data || resData;

      if (data && typeof data === 'object') {
        const list = [];
        
        // 1. Present / Current Address
        const curr = data.current_address || {};
        if (curr.address1 || curr.formatted_address || data.father_address_1 || data.father_address) {
          list.push({
            address_type: '1',
            address1: curr.address1 || curr.formatted_address || data.father_address_1 || data.father_address || '',
            address2: curr.address2 || '',
            city_name: curr.city_name || data.father_city || '',
            state_name: curr.state_name || data.father_state || '',
            country_name: curr.country_name || data.father_country || '',
            postal_code: curr.postal_code || data.father_postal_code || '',
            same_permanent: data.same_permanent ? '1' : '0',
          });
        }

        // 2. Permanent Address
        const perm = data.permanent_address || {};
        if (perm.address1 || perm.formatted_address || data.mother_address_1 || data.mother_address) {
          list.push({
            address_type: '2',
            address1: perm.address1 || perm.formatted_address || data.mother_address_1 || data.mother_address || '',
            address2: perm.address2 || '',
            city_name: perm.city_name || data.mother_city || '',
            state_name: perm.state_name || data.mother_state || '',
            country_name: perm.country_name || data.mother_country || '',
            postal_code: perm.postal_code || data.mother_postal_code || '',
            same_permanent: data.same_permanent ? '1' : '0',
          });
        }

        setAddressList(list);
      } else {
        setAddressList([]);
      }
    } catch (err: any) {
      console.warn('loadAddress exception:', err?.message);
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadAddress();
    }
  }, [id, loadAddress]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAddress(true);
  }, [loadAddress]);

  if (!student) {
    return (
      <View style={styles.container}>
        <InternalHeader title="Address" onBack={handleBack} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Student not found</Text>
        </View>
      </View>
    );
  }

  const presentAddressObj = addressList.find(addr => String(addr.address_type) === '1');
  const permanentAddressObj = addressList.find(addr => String(addr.address_type) === '2');

  const presentAddress = formatAddressObj(presentAddressObj);
  const permanentAddress = formatAddressObj(permanentAddressObj);

  return (
    <View style={styles.container}>
      <InternalHeader title="Address" onBack={handleBack} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3d5ee1" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : addressList.length === 0 ? (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3d5ee1"]} />
          }
        >
          <View style={styles.emptyStateCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="location-outline" size={48} color="#7a869a" />
            </View>
            <Text style={styles.emptyStateTitle}>No Address Info</Text>
            <Text style={styles.emptyStateSubtitle}>
              No address details have been registered for this student.
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
          {/* Present Address Card */}
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>Present Address</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>{presentAddressObj?.address1 || 'N/A'}</Text>
            </View>
            {presentAddressObj?.address2 ? (
              <View style={styles.row}>
                <Text style={styles.label}>Address Line 2</Text>
                <Text style={styles.value}>{presentAddressObj.address2}</Text>
              </View>
            ) : null}
            <View style={styles.row}>
              <Text style={styles.label}>City</Text>
              <Text style={styles.value}>{presentAddressObj?.city_name || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>State</Text>
              <Text style={styles.value}>{presentAddressObj?.state_name || 'N/A'}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Country</Text>
              <Text style={styles.value}>{presentAddressObj?.country_name || 'N/A'}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.label}>Postal Code</Text>
              <Text style={styles.value}>{presentAddressObj?.postal_code || 'N/A'}</Text>
            </View>
          </View>

          {/* Permanent Address Card */}
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.sectionHeading}>Permanent Address</Text>
            <View style={styles.divider} />
            {permanentAddressObj?.same_permanent === '1' ? (
              <View style={styles.sameAddressContainer}>
                <Text style={styles.sameAddressText}>Same as Present Address</Text>
                <Text style={styles.value}>{permanentAddress}</Text>
              </View>
            ) : (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Address</Text>
                  <Text style={styles.value}>{permanentAddressObj?.address1 || 'N/A'}</Text>
                </View>
                {permanentAddressObj?.address2 ? (
                  <View style={styles.row}>
                    <Text style={styles.label}>Address Line 2</Text>
                    <Text style={styles.value}>{permanentAddressObj.address2}</Text>
                  </View>
                ) : null}
                <View style={styles.row}>
                  <Text style={styles.label}>City</Text>
                  <Text style={styles.value}>{permanentAddressObj?.city_name || 'N/A'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>State</Text>
                  <Text style={styles.value}>{permanentAddressObj?.state_name || 'N/A'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Country</Text>
                  <Text style={styles.value}>{permanentAddressObj?.country_name || 'N/A'}</Text>
                </View>
                <View style={[styles.row, { borderBottomWidth: 0 }]}>
                  <Text style={styles.label}>Postal Code</Text>
                  <Text style={styles.value}>{permanentAddressObj?.postal_code || 'N/A'}</Text>
                </View>
              </>
            )}
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
  value: { fontSize: 13, color: '#202c4b', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  sameAddressContainer: {
    paddingVertical: 12,
  },
  sameAddressText: {
    fontSize: 13,
    color: '#28a745',
    fontWeight: '700',
    marginBottom: 8,
  },
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
