import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { updateProfilePicture, fetchProfile } from '@/redux/features/auth/thunks';
import Toast from 'react-native-toast-message';
import { useAppTheme } from '@/constants/theme';
import { getAvatarUrl } from '@/services/apiClient';

export default function ProfileScreen() {
  const user = useAppSelector((state) => state.auth.user);
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { colors, isDark } = useAppTheme();
  const [isUploading, setIsUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      await dispatch(fetchProfile()).unwrap();
    } catch (e: any) {
      console.log('Error refreshing profile:', e?.message || e);
    }
  }, [dispatch]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const formatValue = (value: any) => {
    if (value === null || value === undefined || value === '') return 'N/A';
    return String(value);
  };

  const formatDate = (dateStr: any) => {
    if (!dateStr || dateStr === 'N/A' || dateStr === '0000-00-00') return 'N/A';
    try {
      const cleanStr = String(dateStr).split(' ')[0].split('T')[0];
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        if (!isNaN(d.getTime())) {
          return d.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          });
        }
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
      }
      return cleanStr;
    } catch {
      return String(dateStr);
    }
  };

  const getGenderText = (gender: any, genderName?: string) => {
    if (genderName && isNaN(Number(genderName))) return genderName;
    const g = String(gender).trim();
    if (g === '1') return 'Male';
    if (g === '2') return 'Female';
    if (g === '3') return 'Other';
    return formatValue(genderName || gender);
  };

  const getBloodGroupText = (bg: any, bgName?: string) => {
    if (bgName && typeof bgName === 'string' && isNaN(Number(bgName)) && bgName.trim()) {
      return bgName.trim();
    }
    if (typeof bg === 'string' && isNaN(Number(bg)) && bg.trim()) {
      return bg.trim();
    }
    return formatValue(bgName || bg);
  };

  const getMaritalStatusText = (status: any, statusName?: string) => {
    if (statusName && typeof statusName === 'string' && isNaN(Number(statusName)) && statusName.trim()) {
      return statusName.trim();
    }
    if (typeof status === 'string' && isNaN(Number(status)) && status.trim()) {
      return status.trim();
    }
    return formatValue(statusName || status);
  };

  const getStatusText = (status: any) => {
    if (Number(status) === 1) return 'Active';
    if (Number(status) === 0) return 'Inactive';
    return formatValue(status);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      Toast.show({
        type: 'error',
        text1: 'Permission Denied',
        text2: 'We need camera roll permissions to upload your profile picture.',
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selectedImage = result.assets[0];
      uploadImage(selectedImage.uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!token) {
      Toast.show({
        type: 'error',
        text1: 'Authentication Error',
        text2: 'Please log in again to update your picture.',
      });
      return;
    }

    try {
      setIsUploading(true);
      const filename = uri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : `image/jpeg`;

      const resultAction = await dispatch(updateProfilePicture({ uri, fileName: filename, mimeType: type }));

      if (updateProfilePicture.fulfilled.match(resultAction)) {
        await dispatch(fetchProfile());
        Toast.show({
          type: 'success',
          text1: 'Profile Picture Updated',
          text2: 'Your profile picture has been updated successfully.',
        });
      } else {
        const errorMsg = (resultAction.payload as string) || 'Failed to upload profile picture';
        Toast.show({
          type: 'error',
          text1: 'Upload Failed',
          text2: errorMsg,
        });
      }
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Upload Error',
        text2: error.message || 'An error occurred while uploading.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text, marginTop: 12 }}>Loading profile...</Text>
      </View>
    );
  }

  const fullName =
    user.name ||
    `${user.first_name || user.firstName || ''} ${user.last_name || user.lastName || ''}`.trim() ||
    'Teacher';
  const staffId =
    user.teacherId ||
    user.teacher_id ||
    user.national_id ||
    (user.id ? `TCH-${user.id}` : 'N/A');
  const isActive = Number(user.status) === 1;
  const schoolName = user.schoolName || user.school_name || 'Growvidya School';
  const roleName = user.roleName || user.role_name || 'Teacher';
  const assignedClasses = user.className || user.class_name || 'Not Assigned';
  const assignedSubjects = user.subjectName || user.subject_name || 'Not Assigned';
  const qualification = user.qualification || 'N/A';
  const workExperience = user.workExperience || user.work_experience || 'N/A';

  const addressObj = Array.isArray(user.address) ? user.address[0] : null;
  const addressLine =
    user.address1 ||
    addressObj?.address1 ||
    (typeof user.address === 'string' ? user.address : '') ||
    user.present_address ||
    '';
  const cityName = user.cityName || user.city_name || addressObj?.city_name || '';
  const stateName = user.stateName || user.state_name || addressObj?.state_name || '';
  const countryName = user.countryName || user.country_name || addressObj?.country_name || '';
  const postalCode = user.postalCode || user.postal_code || addressObj?.postal_code || '';
  const regionParts = [cityName, stateName, countryName].filter(Boolean).join(', ');

  const infoSections = [
    {
      title: 'Academic & Official Details',
      icon: 'school-outline',
      data: [
        { label: 'Staff / Teacher ID', value: formatValue(staffId), icon: 'id-card-outline' },
        { label: 'Designation / Role', value: formatValue(roleName), icon: 'briefcase-outline' },
        { label: 'School / Institution', value: formatValue(schoolName), icon: 'business-outline' },
        {
          label: 'Joining Date',
          value: formatDate(user.dateOfJoining || user.date_of_joining || user.joining_date),
          icon: 'time-outline',
        },
        { label: 'Qualification', value: formatValue(qualification), icon: 'ribbon-outline' },
        { label: 'Work Experience', value: formatValue(workExperience), icon: 'hourglass-outline' },
        { label: 'Assigned Classes', value: formatValue(assignedClasses), icon: 'book-outline' },
        { label: 'Assigned Subjects', value: formatValue(assignedSubjects), icon: 'library-outline' },
      ],
    },
    {
      title: 'Personal Information',
      icon: 'person-outline',
      data: [
        {
          label: 'First Name',
          value: formatValue(user.first_name || user.firstName),
          icon: 'person-outline',
        },
        {
          label: 'Last Name',
          value: formatValue(user.last_name || user.lastName),
          icon: 'person-outline',
        },
        {
          label: 'Gender',
          value: getGenderText(user.gender, user.gender_name),
          icon: 'transgender-outline',
        },
        {
          label: 'Blood Group',
          value: getBloodGroupText(
            user.blood_group || user.bloodGroup,
            user.blood_group_name || user.bloodGroupName
          ),
          icon: 'water-outline',
        },
        {
          label: 'Date of Birth',
          value: formatDate(user.dateOfBirth || user.date_of_birth || user.dob),
          icon: 'calendar-outline',
        },
        {
          label: 'Marital Status',
          value: getMaritalStatusText(
            user.marital_status || user.maritalStatus,
            user.marital_status_name || user.maritalStatusName
          ),
          icon: 'heart-outline',
        },
        ...(user.father_name
          ? [{ label: "Father's Name", value: formatValue(user.father_name), icon: 'man-outline' }]
          : []),
        ...(user.mother_name
          ? [{ label: "Mother's Name", value: formatValue(user.mother_name), icon: 'woman-outline' }]
          : []),
        ...(user.religion
          ? [{ label: 'Religion', value: formatValue(user.religion), icon: 'sunny-outline' }]
          : []),
        ...(user.pan_number
          ? [{ label: 'PAN Number', value: formatValue(user.pan_number), icon: 'card-outline' }]
          : []),
        ...(user.language_known
          ? [{ label: 'Languages Known', value: formatValue(user.language_known), icon: 'language-outline' }]
          : []),
      ],
    },
    {
      title: 'Contact & Address Details',
      icon: 'call-outline',
      data: [
        {
          label: 'Email Address',
          value: formatValue(user.email || user.email_address),
          icon: 'mail-outline',
        },
        {
          label: 'Mobile Number',
          value: formatValue(user.phone || user.primary_contact_number),
          icon: 'call-outline',
        },
        ...(user.emergency_phone
          ? [{ label: 'Emergency Contact', value: formatValue(user.emergency_phone), icon: 'alert-circle-outline' }]
          : []),
        {
          label: 'Current Address',
          value: formatValue(addressLine || regionParts || user.present_address),
          icon: 'location-outline',
        },
        ...(regionParts
          ? [{ label: 'City / State / Country', value: formatValue(regionParts), icon: 'map-outline' }]
          : []),
        ...(postalCode
          ? [{ label: 'Postal Code', value: formatValue(postalCode), icon: 'navigate-outline' }]
          : []),
      ],
    },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header Profile Info */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.headerBg} />

          <View style={styles.profileInfo}>
            <View style={styles.avatarWrapper}>
              <Image
                source={{ uri: getAvatarUrl(user.picture, user.gender) }}
                style={styles.avatar}
              />
              <TouchableOpacity
                style={[styles.editAvatarButton, { backgroundColor: colors.primary }]}
                onPress={pickImage}
                disabled={isUploading}
                activeOpacity={0.8}
              >
                {isUploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            <Text style={[styles.name, { color: colors.text }]}>{fullName}</Text>

            <View style={styles.badgeRow}>
              {/* Staff ID Pill */}
              <View style={[styles.idBadge, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="id-card-outline" size={13} color={colors.primary} />
                <Text style={[styles.idBadgeText, { color: colors.primary }]}>{staffId}</Text>
              </View>

              {/* Status Pill */}
              <View
                style={[
                  styles.statusBadge,
                  {
                    borderColor: isActive
                      ? isDark
                        ? '#1b382b'
                        : '#e8f5e9'
                      : isDark
                      ? '#3b2512'
                      : '#fff3e0',
                    backgroundColor: isActive
                      ? isDark
                        ? '#142e22'
                        : '#f1f8e9'
                      : isDark
                      ? '#2e1c0d'
                      : '#fff8e1',
                  },
                ]}
              >
                <View style={[styles.statusDot, { backgroundColor: isActive ? '#4CAF50' : '#FF9800' }]} />
                <Text
                  style={[
                    styles.statusText,
                    { color: isActive ? (isDark ? '#66bb6a' : '#2e7d32') : '#ef6c00' },
                  ]}
                >
                  {getStatusText(user.status)}
                </Text>
              </View>
            </View>

            <Text style={[styles.schoolName, { color: colors.textMuted }]}>{schoolName}</Text>

            <TouchableOpacity
              style={[styles.editProfileButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/(main)/(drawer)/profile-edit')}
              activeOpacity={0.85}
            >
              <Ionicons name="create-outline" size={18} color="#fff" />
              <Text style={styles.editProfileText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Highlights Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={[styles.statIconWrapper, { backgroundColor: isDark ? '#1f2937' : '#EFF6FF' }]}>
              <Ionicons name="book-outline" size={20} color="#3B82F6" />
            </View>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Classes</Text>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
              {assignedClasses}
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={[styles.statIconWrapper, { backgroundColor: isDark ? '#2e1d2e' : '#FDF2F8' }]}>
              <Ionicons name="library-outline" size={20} color="#EC4899" />
            </View>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Subjects</Text>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
              {assignedSubjects}
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={[styles.statIconWrapper, { backgroundColor: isDark ? '#142e22' : '#F0FDF4' }]}>
              <Ionicons name="school-outline" size={20} color="#10B981" />
            </View>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Qualification</Text>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
              {qualification}
            </Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={[styles.statIconWrapper, { backgroundColor: isDark ? '#2b2210' : '#FFFBEB' }]}>
              <Ionicons name="hourglass-outline" size={20} color="#F59E0B" />
            </View>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Experience</Text>
            <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
              {workExperience}
            </Text>
          </View>
        </View>

        {/* Detail Sections */}
        <View style={styles.content}>
          {infoSections.map((section, idx) => (
            <View key={idx} style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name={section.icon as any} size={20} color={colors.primary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
              </View>

              <View style={[styles.sectionCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                {section.data.map((item, itemIdx) => (
                  <View
                    key={itemIdx}
                    style={[
                      styles.infoRow,
                      { borderBottomColor: colors.border },
                      itemIdx === section.data.length - 1 && styles.lastInfoRow,
                    ]}
                  >
                    <View style={[styles.infoIconWrapper, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name={item.icon as any} size={18} color={colors.primary} />
                    </View>
                    <View style={styles.infoTextWrapper}>
                      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{item.label}</Text>
                      <Text style={[styles.infoValue, { color: colors.text }]}>{item.value}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>Growvidya Teacher Portal v1.0.4</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingBottom: 22,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  headerBg: {
    height: 40,
  },
  profileInfo: {
    alignItems: 'center',
    marginTop: -20,
    paddingHorizontal: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#fff',
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  idBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  idBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  schoolName: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 14,
    textAlign: 'center',
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 9,
    borderRadius: 20,
    gap: 7,
  },
  editProfileText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    alignItems: 'flex-start',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
      },
      android: {
        elevation: 1.5,
      },
    }),
  },
  statIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  lastInfoRow: {
    borderBottomWidth: 0,
  },
  infoIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextWrapper: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 30,
    paddingTop: 10,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
