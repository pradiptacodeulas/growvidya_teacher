import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SyllabusItem } from '@/redux/features/dashboard/types';
import { useAppTheme } from '@/constants/theme';

interface SyllabusLessonPlanCardProps {
  syllabus?: SyllabusItem[];
}

export default function SyllabusLessonPlanCard({ syllabus = [] }: SyllabusLessonPlanCardProps) {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();

  const getStatusConfig = (status: string) => {
    switch (status) {
      case '3':
        return {
          label: 'Completed',
          icon: 'checkmark-circle' as const,
          color: '#16a34a',
          bg: isDark ? 'rgba(22, 163, 74, 0.15)' : '#f0fdf4',
          progress: 100,
        };
      case '2':
        return {
          label: 'In Progress',
          icon: 'time' as const,
          color: colors.primary,
          bg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#eff6ff',
          progress: 50,
        };
      default:
        return {
          label: 'Pending',
          icon: 'ellipse-outline' as const,
          color: '#f59e0b',
          bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fffbeb',
          progress: 0,
        };
    }
  };

  const formatClassName = (className?: string) => {
    if (!className) return '';
    const trimmed = String(className).trim();
    if (trimmed.toLowerCase().startsWith('class')) return trimmed;
    return `Class ${trimmed}`;
  };

  const handleOpenSyllabus = () => {
    router.push('/(main)/(drawer)/academic/syllabus' as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>Syllabus / Lesson Plan</Text>
          {syllabus.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                {syllabus.length}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={handleOpenSyllabus} activeOpacity={0.7}>
          <Text style={[styles.viewAll, { color: colors.primary }]}>View All</Text>
        </TouchableOpacity>
      </View>

      {/* Lesson Cards Carousel / Empty State */}
      {syllabus.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {syllabus.map((item) => {
            const statusConfig = getStatusConfig(item.status);
            const displayClass = formatClassName(item.class_name);

            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.lessonCard,
                  { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }
                ]}
                onPress={handleOpenSyllabus}
                activeOpacity={0.7}
              >
                {/* Top Row: Subject Pill + Status Badge */}
                <View style={styles.cardTopRow}>
                  <View style={[styles.subjectPill, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="book-outline" size={12} color={colors.primary} />
                    <Text style={[styles.subjectText, { color: colors.primary }]} numberOfLines={1}>
                      {item.subject_name || 'General'}
                    </Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                    <Ionicons name={statusConfig.icon} size={11} color={statusConfig.color} />
                    <Text style={[styles.statusText, { color: statusConfig.color }]}>
                      {statusConfig.label}
                    </Text>
                  </View>
                </View>

                {/* Class identifier */}
                {!!displayClass && (
                  <Text style={[styles.classText, { color: colors.textMuted }]} numberOfLines={1}>
                    {displayClass}
                  </Text>
                )}

                {/* Lesson Title */}
                <Text style={[styles.lessonTitle, { color: colors.text }]} numberOfLines={2}>
                  {item.lession || 'Untitled Lesson'}
                </Text>

                {/* Progress Bar & Percentage */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Progress</Text>
                    <Text style={[styles.progressValue, { color: statusConfig.color }]}>
                      {statusConfig.progress}%
                    </Text>
                  </View>

                  <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${statusConfig.progress}%`, backgroundColor: statusConfig.color }
                      ]}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
            <Ionicons name="book-outline" size={26} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Syllabus Items</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Syllabus and lesson plans for your classes will appear here.
          </Text>
        </View>
      )}
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
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContent: {
    paddingLeft: 20,
    paddingRight: 8,
    paddingBottom: 4,
  },
  lessonCard: {
    width: 240,
    borderRadius: 14,
    padding: 14,
    marginRight: 12,
    borderWidth: 1,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subjectPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: 130,
    gap: 4,
  },
  subjectText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    gap: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  classText: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  lessonTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    minHeight: 38,
    marginBottom: 14,
  },
  progressContainer: {
    marginTop: 'auto',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  emptyContainer: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
});
