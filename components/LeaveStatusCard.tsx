import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LeaveRequest } from '@/redux/features/dashboard/types';
import { useAppTheme } from '@/constants/theme';

interface LeaveStatusCardProps {
  leaves?: LeaveRequest[];
}

export default function LeaveStatusCard({ leaves = [] }: LeaveStatusCardProps) {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();

  const getStatusStyle = (status: string) => {
    switch (status) {
      case '2': // Approved
        return { label: 'Approved', bg: isDark ? '#1b382b' : '#f6ffed', color: '#52c41a', dot: '#52c41a' };
      case '3': // Rejected
        return { label: 'Rejected', bg: isDark ? '#3b1c1d' : '#fff1f0', color: '#ff4d4f', dot: '#ff4d4f' };
      default: // Pending
        return { label: 'Pending', bg: isDark ? '#162b42' : '#e6f7ff', color: '#1890ff', dot: '#1890ff' };
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch (e) {
      return dateStr;
    }
  };

  const formatLeaveDates = (firstDate: string, lastDate: string) => {
    const f = formatDate(firstDate);
    const l = formatDate(lastDate);
    if (!f && !l) return '';
    if (f === l || !l) return f;
    return `${f} - ${l}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      {/* Card Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Leave Status</Text>
        <TouchableOpacity onPress={() => router.push('/(main)/(drawer)/leaves')}>
          <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
        </TouchableOpacity>
      </View>

      {/* Leave Items List */}
      <View style={styles.listContainer}>
        {leaves.length > 0 ? (
          leaves.map((item) => {
            const statusStyle = getStatusStyle(item.status);
            return (
              <View key={item.id} style={[styles.leaveItem, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                <View style={styles.leftSection}>
                  <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="calendar-outline" size={22} color={colors.primary} />
                  </View>
                  <View style={styles.infoContainer}>
                    <Text style={[styles.typeText, { color: colors.text }]}>{item.leave_name}</Text>
                    <Text style={[styles.dateText, { color: colors.textMuted }]}>
                      {formatLeaveDates(item.first_leave_date, item.last_leave_date)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusStyle.dot }]} />
                  <Text style={[styles.statusText, { color: statusStyle.color }]}>
                    {statusStyle.label}
                  </Text>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No recent leave requests</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginVertical: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    gap: 12,
  },
  leaveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
  },
  typeText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
