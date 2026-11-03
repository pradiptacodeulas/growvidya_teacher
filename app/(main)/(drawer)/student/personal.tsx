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

export default function StudentPersonalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const token = useAppSelector(state => state.auth.token);
  const students = useAppSelector(state => state.students.students);
  const student = students.find(s => String(s.id) === String(id));

  const [personalData, setPersonalData] = useState<any>(null);
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

  const loadPersonal = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const response = await apiClient.get(`/admin/students/${id}`);
      const resData = response.data;
      const data = resData?.data?.student || resData?.student || resData?.data || resData;

      if (data && typeof data === 'object') {
        setPersonalData({
          ...data,
          gender: data.gender_name || (data.gender === 2 || data.gender === '2' ? 'Female' : 'Male'),
          blood_group: data.blood_group_name || data.blood_group || 'N/A',
          category: data.category_name || data.category || 'N/A',
          religion: data.religion_name || data.religion || 'N/A',
          caste: data.caste || 'N/A',
          house_name: data.house_name || 'N/A',
          mother_tongue: data.mother_tongue_name || data.mother_tongue || 'N/A',
          language_known: data.language_known || 'N/A',
          academic_year: data.academic_year_name || data.academic_year_range || data.academic_year || 'N/A',
          academic_start_date: data.academic_year_start_date || data.academic_start_date,
          academic_end_date: data.academic_year_end_date || data.academic_end_date,
        });
      } else {
        setError('Failed to parse personal information');
      }
    } catch (err: any) {
      console.warn('loadPersonal exception:', err?.message);
      setError(err?.response?.data?.message || err?.message || 'Failed to fetch details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      loadPersonal();
    }
  }, [id, loadPersonal]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPersonal(true);
  }, [loadPersonal]);

  if (!student) {
    return (
      <View style={styles.container}>
        <InternalHeader title="Personal Information" onBack={handleBack} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>Student not found</Text>
        </View>
      </View>
    );
  }

  // API fields
  const gender = personalData?.gender || 'N/A';
  const dob = formatDate(personalData?.date_of_birth);
  const bloodGroup = personalData?.blood_group || 'N/A';
  const house = personalData?.house_name || 'N/A';
  const category = personalData?.category || 'N/A';
  const caste = personalData?.caste || 'N/A';
  const religion = personalData?.religion || 'N/A';
  const motherTongue = personalData?.mother_tongue || 'N/A';
  const languageKnown = personalData?.language_known || 'N/A';
  const rollNumber = personalData?.roll_number || 'N/A';
  const admissionNumber = personalData?.admission_number || 'N/A';
  const admissionDate = formatDate(personalData?.admission_date);
  const academicYear = personalData?.academic_year || 'N/A';
  const className = personalData?.class_name || 'N/A';
  const sectionName = personalData?.section_name || 'N/A';
  const academicStart = formatDate(personalData?.academic_start_date);
  const academicEnd = formatDate(personalData?.academic_end_date);
  const contactNo = personalData?.primary_contact_number || 'N/A';
  const emailAddr = personalData?.email_address || 'N/A';
  const isActive = String(personalData?.status) === '1' || Number(personalData?.status) === 1 || String(personalData?.status).toLowerCase() === 'active';
  const statusLabel = isActive ? 'Active' : 'Inactive';

  return (
    <View style={styles.container}>
      <InternalHeader title="Personal Information" onBack={handleBack} />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3d5ee1" />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (!personalData || Object.keys(personalData).length === 0) ? (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#3d5ee1"]} />
          }
        >
          <View style={styles.emptyStateCard}>
            <View style={styles.iconCircle}>
              <Ionicons name="person-outline" size={48} color="#7a869a" />
            </View>
            <Text style={styles.emptyStateTitle}>No Personal Info</Text>
            <Text style={styles.emptyStateSubtitle}>
              No personal details have been registered for this student.
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
          
          {/* Card 1: Personal Profile */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal Profile</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Gender</Text>
              <Text style={styles.value}>{gender}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Date of Birth</Text>
              <Text style={styles.value}>{dob}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Blood Group</Text>
              <Text style={styles.value}>{bloodGroup}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>House</Text>
              <Text style={styles.value}>{house}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Category</Text>
              <Text style={styles.value}>{category}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Caste</Text>
              <Text style={styles.value}>{caste}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Religion</Text>
              <Text style={styles.value}>{religion}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Mother Tongue</Text>
              <Text style={styles.value}>{motherTongue}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.label}>Languages Known</Text>
              <Text style={styles.value}>{languageKnown}</Text>
            </View>
          </View>

          {/* Card 2: Academic Details */}
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Academic Details</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Class & Section</Text>
              <Text style={styles.value}>{`${className} - ${sectionName}`}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Roll Number</Text>
              <Text style={styles.value}>{rollNumber}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Admission Number</Text>
              <Text style={styles.value}>{admissionNumber}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Admission Date</Text>
              <Text style={styles.value}>{admissionDate}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Academic Year</Text>
              <Text style={styles.value}>{academicYear}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Academic Start Date</Text>
              <Text style={styles.value}>{academicStart}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Academic End Date</Text>
              <Text style={styles.value}>{academicEnd}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{statusLabel}</Text>
            </View>
          </View>

          {/* Card 3: Contact Info */}
          <View style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>Contact Details</Text>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.label}>Phone Number</Text>
              <Text style={styles.value}>{contactNo}</Text>
            </View>
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.label}>Email Address</Text>
              <Text style={styles.value}>{emailAddr}</Text>
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
