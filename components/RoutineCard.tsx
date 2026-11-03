import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/constants/theme';

interface RoutineCardProps {
  period?: string;
  className?: string;
  subject?: string;
  time?: string;
  isEmpty?: boolean;
}

export default function RoutineCard({
  period,
  className,
  subject,
  time,
  isEmpty = false
}: RoutineCardProps) {
  const { colors } = useAppTheme();

  if (isEmpty) {
    return (
      <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <View style={styles.emptyContent}>
          <Ionicons name="calendar-outline" size={32} color="#dc3545" style={styles.emptyIcon} />
          <Text style={styles.emptyText}>No Class Assigned</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={[styles.accentBar, { backgroundColor: colors.primary }]} />
      <View style={styles.cardContent}>
        <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
          <View style={[styles.periodBadge, { backgroundColor: colors.primaryLight }]}>
            <Text style={[styles.periodText, { color: colors.primary }]}>{period}</Text>
          </View>
          <View style={styles.timeContainer}>
            <Ionicons name="time-outline" size={14} color={colors.textMuted} />
            <Text style={[styles.timeText, { color: colors.textMuted }]}>{time}</Text>
          </View>
        </View>
        
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="school" size={16} color={colors.primary} />
            </View>
            <View style={styles.textStack}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Class</Text>
              <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>{className}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={[styles.iconCircle, { backgroundColor: '#e8f5e9' }]}>
              <Ionicons name="book" size={16} color="#4caf50" />
            </View>
            <View style={styles.textStack}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Subject</Text>
              <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>{subject}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    marginRight: 16,
    width: 280,
    flexDirection: 'row',
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    borderWidth: 1,
  },
  accentBar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  emptyCard: {
    borderColor: 'rgba(220, 53, 69, 0.2)',
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 2,
    width: 280,
    height: 120,
  },
  emptyContent: {
    alignItems: 'center',
  },
  emptyIcon: {
    marginBottom: 6,
    opacity: 0.7,
  },
  emptyText: {
    color: '#dc3545',
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  periodBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  periodText: {
    fontSize: 11,
    fontWeight: '800',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  textStack: {
    flex: 1,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
  },
});
