import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/constants/theme';
import { getAvatarUrl } from '@/services/apiClient';

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

  const name = `${student.first_name || ''} ${student.last_name || ''}`.trim();
  const classText = `${student.class_name || `Class ${student.class || ''}`}, ${student.section_name || `Sec ${student.section || ''}`}`;
  const statusLabel = student.status === '1' ? 'Active' : 'Inactive';
  const avatarSource = { uri: getAvatarUrl(student.picture, student.gender) };
  const joinedDate = formatDate(student.admission_date);

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
          <Image 
            source={avatarSource} 
            style={styles.avatar}
          />
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
            <Text style={[styles.detailValue, { color: colors.text }]}>{student.gender}</Text>
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
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="call-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.primaryLight }]}>
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
