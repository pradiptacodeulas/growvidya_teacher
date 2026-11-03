import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';
import { useAppTheme } from '@/constants/theme';
import { getAvatarUrl, formatGender } from '@/services/apiClient';

interface StudentCardProps {
  student: any;
  isSelected?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  selectionMode?: boolean;
}

export default function StudentCard({
  student,
  isSelected,
  onPress,
  onLongPress,
  selectionMode
}: StudentCardProps) {
  const { colors } = useAppTheme();
  const router = useRouter();

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
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

  const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.full_name || '';
  const classParts = [
    student.class_name || (student.class ? `Class ${student.class}` : ''),
    student.section_name || (student.section ? `Sec ${student.section}` : ''),
  ].filter(Boolean);
  const classText = classParts.join(', ');
  const isActive = String(student.status) === '1' || Number(student.status) === 1 || String(student.status).toLowerCase() === 'active';
  const statusLabel = isActive ? 'Active' : 'Inactive';
  const avatarSource = { uri: getAvatarUrl(student.picture, student.gender) };
  const [imageError, setImageError] = React.useState(false);
  const joinedDate = formatDate(student.admission_date);

  const phone =
    student.primary_contact_number ||
    student.phone ||
    student.mobile ||
    student.father_phone ||
    student.guardian_phone ||
    '';
  const email =
    student.email_address ||
    student.email ||
    student.father_email ||
    student.guardian_email ||
    '';

  const handleChatPress = () => {
    if (!student?.id) return;
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: String(student.id),
        role: 'student',
        name,
        avatar: student.picture || '',
      },
    });
  };

  const handleCallPress = () => {
    if (!phone) {
      Toast.show({
        type: 'info',
        text1: 'No Phone Number',
        text2: 'No contact number is available for this student.',
      });
      return;
    }
    Linking.openURL(`tel:${phone}`).catch(() => {
      Toast.show({
        type: 'error',
        text1: 'Unable to Call',
        text2: 'Could not open the phone dialer.',
      });
    });
  };

  const handleMailPress = () => {
    if (!email) {
      Toast.show({
        type: 'info',
        text1: 'No Email Address',
        text2: 'No email address is available for this student.',
      });
      return;
    }
    Linking.openURL(`mailto:${email}`).catch(() => {
      Toast.show({
        type: 'error',
        text1: 'Unable to Email',
        text2: 'Could not open the email client.',
      });
    });
  };

  return (
    <TouchableOpacity 
      activeOpacity={0.8}
      onPress={onPress}
      onLongPress={onLongPress}
      style={[
        styles.card,
        { backgroundColor: colors.cardBg, borderColor: isSelected ? colors.primary : colors.border }
      ]}
    >
      {/* Card Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          {selectionMode && (
            <Ionicons 
              name={isSelected ? "checkbox" : "square-outline"} 
              size={20} 
              color={isSelected ? colors.primary : colors.textMuted} 
              style={{ marginRight: 10 }}
            />
          )}
          <Text style={[styles.studentIdText, { color: colors.textMuted }]}>{student.admission_number}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Ionicons 
            name="ellipse" 
            size={10} 
            color={statusLabel === 'Active' ? '#28a745' : '#dc3545'} 
          />
        </View>
      </View>

      {/* Card Body - Profile Area */}
      <View style={styles.body}>
        <View style={styles.profileSection}>
          {imageError ? (
            <View style={[styles.avatar, styles.fallbackAvatar, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="person" size={24} color={colors.textMuted} />
            </View>
          ) : (
            <Image 
              source={avatarSource} 
              style={styles.avatar}
              onError={() => setImageError(true)}
            />
          )}
          <View style={styles.profileInfo}>
            <Text style={[styles.studentName, { color: colors.text }]}>{name}</Text>
            <Text style={[styles.classText, { color: colors.textMuted }]}>{classText}</Text>
          </View>
        </View>

        {/* Student Details Grid */}
        <View style={[styles.detailsGrid, { backgroundColor: colors.surfaceSubtle }]}>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Roll No</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{student.roll_number}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Gender</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{formatGender(student.gender, student.gender_name)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Joined On</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{joinedDate}</Text>
          </View>
        </View>
      </View>

      {/* Card Footer - Actions */}
      {!selectionMode && (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}
              onPress={handleChatPress}
              activeOpacity={0.7}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}
              onPress={handleCallPress}
              activeOpacity={0.7}
            >
              <Ionicons name="call-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}
              onPress={handleMailPress}
              activeOpacity={0.7}
            >
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentIdText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    padding: 2,
  },
  body: {
    padding: 16,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e2e8f0',
    marginRight: 12,
  },
  fallbackAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  classText: {
    fontSize: 13,
    fontWeight: '500',
  },
  detailsGrid: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 10,
    justifyContent: 'space-around',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
