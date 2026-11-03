import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, BackHandler, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import InternalHeader from '@/components/InternalHeader';
import { apiClient } from '@/services/apiClient';

export default function StudentPreviousSchoolScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const students = useAppSelector(state => state.students.students);
  const student = students.find(s => String(s.id) === String(id));

  const [previousSchool, setPreviousSchool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  const loadPreviousSchool = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await apiClient.get(`/admin/students/${id}`);
      const st = res.data?.data?.student || res.data?.student || res.data?.data || res.data;
      if (st && (st.previous_school_info || st.previous_school)) {
        setPreviousSchool(st.previous_school_info || st.previous_school);
      } else {
        setPreviousSchool(null);
      }
    } catch {
      setPreviousSchool(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) loadPreviousSchool();
  }, [id, loadPreviousSchool]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPreviousSchool(true);
  }, [loadPreviousSchool]);

  if (!student) {
    return (
      <View style={styles.container}>
        <InternalHeader title="Previous School" onBack={handleBack} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Student not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <InternalHeader title="Previous School" onBack={handleBack} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3d5ee1" />
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3d5ee1"]} />
          }
        >
          {previousSchool ? (
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>School Name</Text>
                <Text style={styles.value}>{previousSchool.school_name || previousSchool.name || 'N/A'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Qualification</Text>
                <Text style={styles.value}>{previousSchool.qualification || previousSchool.class || 'N/A'}</Text>
              </View>
              <View style={[styles.row, { borderBottomWidth: 0 }]}>
                <Text style={styles.label}>Address</Text>
                <Text style={styles.value}>{previousSchool.address || 'N/A'}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyStateCard}>
              <View style={styles.iconCircle}>
                <Ionicons name="school-outline" size={48} color="#7a869a" />
              </View>
              <Text style={styles.emptyStateTitle}>No Previous School History</Text>
              <Text style={styles.emptyStateSubtitle}>
                No past academic records or previous school history is available for this student.
              </Text>
            </View>
          )}
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
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
});
