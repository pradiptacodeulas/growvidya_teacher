import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SyllabusItem } from '@/redux/features/dashboard/types';
import { useAppTheme } from '@/constants/theme';

interface SyllabusLessonPlanCardProps {
  syllabus?: SyllabusItem[];
}

export default function SyllabusLessonPlanCard({ syllabus = [] }: SyllabusLessonPlanCardProps) {
  const { colors, isDark } = useAppTheme();

  const getStatusColor = (status: string) => {
    switch (status) {
      case '3': return '#4caf50';
      case '2': return colors.primary;
      default: return isDark ? '#ef5350' : '#f44336';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case '3': return 'Completed';
      case '2': return 'Progress';
      default: return 'Pending';
    }
  };

  const getProgress = (status: string) => {
    switch (status) {
      case '3': return 100;
      case '2': return 50;
      default: return 0;
    }
  };

  const getThemeColor = (index: number) => {
    const palette = ['#ff9800', '#00bcd4', '#4caf50', colors.primary, '#e91e63', '#9c27b0'];
    return palette[index % palette.length];
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Syllabus / Lesson Plan</Text>
        <TouchableOpacity>
          <Text style={[styles.viewAll, { color: colors.primary }]}>View All</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {syllabus.length > 0 ? (
          syllabus.map((item, index) => {
            const themeColor = getThemeColor(index);
            const progress = getProgress(item.status);
            return (
              <View key={item.id} style={[styles.lessonCard, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                <View style={[styles.classBadge, { backgroundColor: themeColor + '20' }]}>
                  <Text style={[styles.classText, { color: themeColor }]}>
                    Class {item.class_name} - {item.subject_name}
                  </Text>
                </View>
                
                <Text style={[styles.lessonTitle, { color: colors.text }]} numberOfLines={2}>
                  {item.lession}
                </Text>

                <View style={styles.progressSection}>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { width: `${progress}%`, backgroundColor: themeColor }
                      ]} 
                    />
                  </View>
                </View>

                <View style={styles.footer}>
                  <View style={styles.statusBadge}>
                    <Ionicons 
                      name="ellipse" 
                      size={8} 
                      color={getStatusColor(item.status)} 
                      style={styles.statusDot}
                    />
                    <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                      {getStatusText(item.status)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No syllabus items found</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  viewAll: {
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 15,
  },
  lessonCard: {
    width: 300,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
  },
  classBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'center',
    width: '100%',
    alignItems: 'center',
    marginBottom: 15,
  },
  classText: {
    fontSize: 14,
    fontWeight: '700',
  },
  lessonTitle: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    height: 48,
    marginBottom: 18,
  },
  progressSection: {
    marginBottom: 18,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
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
