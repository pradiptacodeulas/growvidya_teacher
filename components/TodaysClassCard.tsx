import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Routine } from '@/redux/features/dashboard/types';
import { useAppTheme } from '@/constants/theme';

interface TodaysClassCardProps {
  routine?: Routine[];
}

export default function TodaysClassCard({ routine = [] }: TodaysClassCardProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      {/* Card Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Today's Class</Text>
      </View>

      {/* Horizontal Scrollable Class Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {routine.length > 0 ? (
          routine.map((item, index) => (
            <View key={index} style={[styles.classCard, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
              <View style={[styles.timeBadge, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="time-outline" size={12} color={colors.primary} />
                <Text style={[styles.timeText, { color: colors.primary }]}>
                  {item.start_time} - {item.end_time}
                </Text>
              </View>
              <Text style={[styles.classInfoText, { color: colors.text }]}>
                Class {item.class_name}, {item.section_name} ({item.subject_name})
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No classes scheduled for today</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    paddingVertical: 20,
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
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollContent: {
    paddingLeft: 20,
    paddingRight: 10,
    paddingBottom: 6,
  },
  classCard: {
    padding: 15,
    borderRadius: 12,
    marginRight: 15,
    width: 210,
    borderWidth: 1,
  },
  timeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 5,
  },
  classInfoText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingRight: 20,
    justifyContent: 'center',
    alignItems: 'center',
    width: 210,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
