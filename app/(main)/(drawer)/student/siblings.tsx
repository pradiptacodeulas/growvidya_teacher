import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, BackHandler, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import InternalHeader from '@/components/InternalHeader';
import { apiClient } from '@/services/apiClient';

export default function StudentSiblingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const token = useAppSelector(state => state.auth.token);
  const students = useAppSelector(state => state.students.students);
  const student = students.find(s => String(s.id) === String(id));

  const [siblings, setSiblings] = useState<any[]>([]);
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

  const loadSiblings = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      // In current schema, sibling connections are retrieved or empty
      const response = await apiClient.get(`/admin/students/${id}`);
      const resData = response.data;
      const data = resData?.data?.student || resData?.student || resData?.data || resData;

      if (data && Array.isArray(data.siblings)) {
        setSiblings(data.siblings);
      } else {
        setSiblings([]);
      }
    } catch (err: any) {
      console.warn('loadSiblings exception:', err?.message);
      setSiblings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadSiblings();
    }
  }, [id, loadSiblings]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadSiblings(true);
  }, [loadSiblings]);

  if (!student) {
    return (
      <View style={styles.container}>
        <InternalHeader title="Siblings" onBack={handleBack} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Student not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <InternalHeader title="Siblings" onBack={handleBack} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3d5ee1" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : siblings.length === 0 ? (
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
            <Text style={styles.emptyStateTitle}>No Siblings Enrolled</Text>
            <Text style={styles.emptyStateSubtitle}>
              This student does not have any siblings registered in the school database.
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
          {siblings.map((sib: any, idx: number) => (
            <View key={idx} style={[styles.card, idx > 0 && { marginTop: 16 }]}>
              <Text style={styles.sectionTitle}>Sibling #{idx + 1}</Text>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>Name</Text>
                <Text style={styles.value}>{`${sib.first_name || ''} ${sib.last_name || ''}`.trim() || 'N/A'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Class</Text>
                <Text style={styles.value}>{sib.class_name || sib.class || 'N/A'}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Roll Number</Text>
                <Text style={styles.value}>{sib.roll_number || 'N/A'}</Text>
              </View>
              <View style={[styles.row, { borderBottomWidth: 0 }]}>
                <Text style={styles.label}>Admission Number</Text>
                <Text style={styles.value}>{sib.admission_number || 'N/A'}</Text>
              </View>
            </View>
          ))}
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
  sectionTitle: {
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
