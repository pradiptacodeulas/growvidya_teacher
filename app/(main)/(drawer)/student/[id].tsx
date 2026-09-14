import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, Image, TouchableOpacity, BackHandler, ActivityIndicator, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppSelector } from '@/redux/hooks';
import { useAppTheme } from '@/constants/theme';
import { apiClient, getAvatarUrl } from '@/services/apiClient';

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

export default function StudentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const students = useAppSelector(state => state.students.students);
  const studentFromState = students.find(s => String(s.id) === String(id));

  const [fullStudent, setFullStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStudentDetails = useCallback(async (isRefresh = false) => {
    if (!id) return;
    if (!isRefresh && !studentFromState) setLoading(true);
    try {
      const res = await apiClient.get(`/admin/students/${id}`);
      const st = res.data?.data?.student || res.data?.student || res.data?.data;
      if (st) {
        setFullStudent(st);
      }
    } catch (e) {
      console.warn('Failed to fetch full student details:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, studentFromState]);

  useEffect(() => {
    fetchStudentDetails();
  }, [fetchStudentDetails]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchStudentDetails(true);
  }, [fetchStudentDetails]);

  const handleBack = () => {
    router.navigate('/(main)/(drawer)/ward');
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
  }, [router]);
  
  const student = fullStudent || studentFromState;

  if (loading && !student) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.errorText, { color: colors.textMuted }]}>Loading student details...</Text>
      </View>
    );
  }

  if (!student) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={64} color="#dc3545" />
        <Text style={styles.errorText}>Student details not found.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const name = student.full_name || `${student.first_name || ''} ${student.last_name || ''}`.trim();
  const avatarSource = { uri: getAvatarUrl(student.picture, student.gender) };
  const statusLabel = String(student.status) === '1' ? 'Active' : 'Inactive';
  const displayClass = student.class_name || student.class || 'N/A';
  const displayRoll = student.roll_number || 'N/A';
  const gender = student.gender_name || (student.gender === 2 || student.gender === '2' ? 'Female' : 'Male');
  const bloodGroup = student.blood_group_name || student.blood_group || 'N/A';
  const house = student.house_name || 'N/A';
  const religion = student.religion_name || student.religion || 'N/A';
  const category = student.category_name || student.category || 'N/A';
  const caste = student.caste || 'N/A';
  const motherTongue = student.mother_tongue_name || student.mother_tongue || 'N/A';
  const languages = student.language_known || 'N/A';
  const academicYear = student.academic_year_name || student.academic_year_range || student.academic_year || 'N/A';
  const contactNo = student.primary_contact_number || 'N/A';
  const emailAddr = student.email_address || 'N/A';

  const sections = [
    { label: 'Personal Information', icon: 'person-outline', route: '/(main)/(drawer)/student/personal' },
    { label: 'Parents & Guardian', icon: 'people-outline', route: '/(main)/(drawer)/student/parents' },
    { label: 'Siblings', icon: 'trail-sign-outline', route: '/(main)/(drawer)/student/siblings' },
    { label: 'Address', icon: 'location-outline', route: '/(main)/(drawer)/student/address' },
    { label: 'Transport', icon: 'bus-outline', route: '/(main)/(drawer)/student/transport' },
    { label: 'Hostel', icon: 'business-outline', route: '/(main)/(drawer)/student/hostel' },
    { label: 'Documents', icon: 'document-text-outline', route: '/(main)/(drawer)/student/documents' },
    { label: 'Medical History', icon: 'heart-outline', route: '/(main)/(drawer)/student/medical' },
    { label: 'Previous School', icon: 'school-outline', route: '/(main)/(drawer)/student/previous-school' },
    { label: 'Activity', icon: 'trophy-outline', route: '/(main)/(drawer)/student/activity' },
  ];

  const navigateToSection = (route: string) => {
    router.push({
      pathname: route as any,
      params: { id }
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Student Details</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {/* Profile Details & Basic Information Combined */}
        <View style={[styles.infoCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.profileRow}>
            <Image source={avatarSource} style={styles.avatar} />
            <View style={styles.profileDetails}>
              <View style={styles.nameRow}>
                <Text style={[styles.studentName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
                <View style={[styles.statusBadge, String(student.status) === '1' ? styles.statusActive : styles.statusInactive]}>
                  <View style={[styles.statusDot, { backgroundColor: String(student.status) === '1' ? '#28a745' : '#dc3545' }]} />
                  <Text style={[styles.statusText, String(student.status) === '1' ? styles.textActive : styles.textInactive]}>
                    {statusLabel}
                  </Text>
                </View>
              </View>
              <Text style={[styles.studentId, { color: colors.textMuted }]}>ID: {student.admission_number || 'N/A'}</Text>
              <Text style={[styles.studentClassRoll, { color: colors.textMuted }]}>
                Class {displayClass} • Roll {displayRoll}
              </Text>
            </View>
          </View>

          {/* Separator / Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border, marginVertical: 12 }]} />

          <Text style={[styles.cardHeaderTitle, { color: colors.text }]}>Basic Information</Text>
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Gender</Text>
            <Text style={styles.value}>{gender}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>DOB</Text>
            <Text style={styles.value}>{formatDate(student.date_of_birth)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Blood Group</Text>
            <Text style={styles.value}>{bloodGroup}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>House</Text>
            <Text style={styles.value}>{house}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Religion</Text>
            <Text style={styles.value}>{religion}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Category</Text>
            <Text style={styles.value}>{category}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Caste</Text>
            <Text style={styles.value}>{caste}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Mother Tongue</Text>
            <Text style={styles.value}>{motherTongue}</Text>
          </View>

          <View style={[styles.detailRow, { paddingBottom: 0 }]}>
            <Text style={styles.label}>Languages Known</Text>
            <Text style={styles.value}>{languages}</Text>
          </View>
        </View>

        {/* Academic Details Card */}
        <View style={styles.infoCard}>
          <Text style={styles.cardHeaderTitle}>Academic Information</Text>
          <View style={styles.divider} />
          
          <View style={styles.detailRow}>
            <Text style={styles.label}>Roll Number</Text>
            <Text style={styles.value}>{displayRoll}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Admission Date</Text>
            <Text style={styles.value}>{formatDate(student.admission_date)}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Academic Year</Text>
            <Text style={styles.value}>{academicYear}</Text>
          </View>
        </View>

        {/* Contact Card */}
        <View style={styles.infoCard}>
          <Text style={styles.cardHeaderTitle}>Contact</Text>
          <View style={styles.divider} />
          
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={18} color="#3d5ee1" style={styles.contactIcon} />
            <Text style={styles.contactValue}>{contactNo}</Text>
          </View>

          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={18} color="#3d5ee1" style={styles.contactIcon} />
            <Text style={styles.contactValue}>{emailAddr}</Text>
          </View>
        </View>

        {/* Sections Selection */}
        <View style={styles.infoCard}>
          <Text style={styles.cardHeaderTitle}>Sections</Text>
          <View style={styles.divider} />
          
          {sections.map((sec, idx) => (
            <TouchableOpacity 
              key={idx} 
              style={[styles.menuItem, idx === sections.length - 1 && { borderBottomWidth: 0 }]} 
              activeOpacity={0.7}
              onPress={() => navigateToSection(sec.route)}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons name={sec.icon as any} size={20} color="#555" style={styles.menuIcon} />
                <Text style={styles.menuItemLabel}>{sec.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#b1b1b1" />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 55,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#202c4b',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#f0f2f5',
  },
  profileDetails: {
    flex: 1,
    marginLeft: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#202c4b',
    flex: 1,
    marginRight: 8,
  },
  studentId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7a869a',
    marginBottom: 2,
  },
  studentClassRoll: {
    fontSize: 12,
    color: '#7a869a',
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  statusActive: {
    backgroundColor: '#e8f5e9',
  },
  statusInactive: {
    backgroundColor: '#ffebee',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  textActive: {
    color: '#28a745',
  },
  textInactive: {
    color: '#dc3545',
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#202c4b',
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f2f5',
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 13,
    color: '#7a869a',
    fontWeight: '500',
  },
  value: {
    fontSize: 13,
    color: '#202c4b',
    fontWeight: '600',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contactIcon: {
    marginRight: 10,
  },
  contactValue: {
    fontSize: 13,
    color: '#202c4b',
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f2f5',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginRight: 12,
  },
  menuItemLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#f5f7fa',
  },
  errorText: {
    fontSize: 15,
    color: '#7a869a',
    fontWeight: '500',
    marginTop: 15,
    marginBottom: 20,
  },
  backBtn: {
    backgroundColor: '#3d5ee1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
