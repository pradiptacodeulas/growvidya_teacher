import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, BackHandler, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import InternalHeader from '@/components/InternalHeader';
import { apiClient } from '@/services/apiClient';

const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  try {
    const datePart = dateStr.split(' ')[0];
    const [year, month, day] = datePart.split('-');
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month, 10) - 1;
    
    return `${parseInt(day, 10)} ${months[monthIndex]} ${year}`;
  } catch (e) {
    return dateStr;
  }
};

const getMedicalConditionProps = (condition: string | number) => {
  const condStr = String(condition);
  switch (condStr) {
    case '1':
      return {
        label: 'Good',
        bgColor: '#ecfdf5',
        borderColor: '#a7f3d0',
        textColor: '#047857',
      };
    case '2':
      return {
        label: 'Bad',
        bgColor: '#fef2f2',
        borderColor: '#fecaca',
        textColor: '#b91c1c',
      };
    case '3':
      return {
        label: 'Other',
        bgColor: '#fef3c7',
        borderColor: '#fde68a',
        textColor: '#b45309',
      };
    default:
      return {
        label: `Code: ${condition}`,
        bgColor: '#eff6ff',
        borderColor: '#bfdbfe',
        textColor: '#1d4ed8',
      };
  }
};

export default function StudentMedicalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const students = useAppSelector(state => state.students.students);
  const student = students.find(s => String(s.id) === String(id));

  const [medicalData, setMedicalData] = useState<any[]>([]);
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

  const loadMedicalHistory = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await apiClient.get<any>(`/admin/students/${id}`);
      const st = response.data?.data?.student || response.data?.student || response.data?.data || response.data;
      if (st && Array.isArray(st.medical_history)) {
        setMedicalData(st.medical_history.map((m: any) => ({
          ...m,
          status: '1',
          is_informed: String(m.is_informed ?? '0'),
        })));
      } else {
        setMedicalData([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadMedicalHistory();
    }
  }, [id, loadMedicalHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadMedicalHistory(true);
  }, [loadMedicalHistory]);

  if (!student) {
    return (
      <View style={styles.container}>
        <InternalHeader title="Medical History" onBack={handleBack} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Student not found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <InternalHeader title="Medical History" onBack={handleBack} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3d5ee1" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3d5ee1"]} />
          }
        >
          {/* General info (Blood Group) */}
          <View style={styles.card}>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.label}>Blood Group</Text>
              <Text style={styles.value}>{student.blood_group || 'N/A'}</Text>
            </View>
          </View>

          {/* Medical Records Heading */}
          <Text style={styles.sectionTitle}>Medical Records ({medicalData.length})</Text>

          {medicalData.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <View style={styles.iconCircle}>
                <Ionicons name="pulse-outline" size={48} color="#7a869a" />
              </View>
              <Text style={styles.emptyStateTitle}>No Medical History</Text>
              <Text style={styles.emptyStateSubtitle}>
                No medical records have been registered for this student.
              </Text>
            </View>
          ) : (
            medicalData.map((record) => {
              const condProps = getMedicalConditionProps(record.medical_condition);
              return (
                <View key={record.id} style={styles.historyCard}>
                  <View style={styles.cardHeader}>
                    <View style={[
                      styles.conditionBadge,
                      { backgroundColor: condProps.bgColor, borderColor: condProps.borderColor }
                    ]}>
                      <Text style={[styles.conditionText, { color: condProps.textColor }]}>
                        Condition: {condProps.label}
                      </Text>
                    </View>
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: record.status === '1' ? '#ecfdf5' : '#fef2f2' }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: record.status === '1' ? '#059669' : '#dc2626' }
                      ]}>
                        {record.status === '1' ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.label}>Record Date</Text>
                    <Text style={styles.value}>{formatDate(record.medical_time)}</Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.label}>Parents Informed</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons
                        name={record.is_informed === '1' ? "checkmark-circle" : "close-circle"}
                        size={16}
                        color={record.is_informed === '1' ? "#10b981" : "#ef4444"}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[
                        styles.value,
                        { color: record.is_informed === '1' ? "#10b981" : "#ef4444" }
                      ]}>
                        {record.is_informed === '1' ? 'Yes' : 'No'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.row, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                    <Text style={styles.label}>Description</Text>
                  </View>
                  <Text style={styles.descriptionText}>
                    {record.description?.trim() || 'No description provided.'}
                  </Text>
                </View>
              );
            })
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
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#202c4b',
    marginTop: 20,
    marginBottom: 8,
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  conditionBadge: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  conditionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  descriptionText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    backgroundColor: '#f9fafb',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
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
