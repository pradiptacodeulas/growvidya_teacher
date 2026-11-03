import React, { useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RoutineCard from '@/components/RoutineCard';
import { useAppSelector } from '@/redux/hooks';
import { useAppTheme } from '@/constants/theme';
import { apiClient } from '@/services/apiClient';
import { useFocusEffect } from 'expo-router';

export interface RoutinePeriod {
  class_name: string;
  section_name: string;
  period_name: string;
  start_time: string;
  end_time: string;
  subject_name: string;
}

export interface DayRoutine {
  id: string;
  school_id: string;
  day_name: string;
  status: string;
  class: RoutinePeriod[];
}

interface RoutineViewProps {
  showTitleBanner?: boolean;
}

const formatTimeStr = (timeStr: string) => {
  if (!timeStr) return '';
  const [hoursStr, minutesStr] = timeStr.split(':');
  const hours = parseInt(hoursStr, 10);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const padHours = displayHours < 10 ? `0${displayHours}` : displayHours;
  return `${padHours}:${minutesStr} ${ampm}`;
};

const formatPeriodTime = (startTime: string, endTime: string) => {
  return `${formatTimeStr(startTime)} - ${formatTimeStr(endTime)}`;
};

export default function RoutineView({ showTitleBanner = false }: RoutineViewProps) {
  const token = useAppSelector(state => state.auth.token);
  const user = useAppSelector(state => state.auth.user);
  const { colors } = useAppTheme();
  const [routine, setRoutine] = useState<DayRoutine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRoutineData = useCallback(async (isRefresh = false, isSilent = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!isSilent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await apiClient.get('/teacher/academics/routine');
      const resData = response.data;
      const raw = resData?.data || [];

      if (Array.isArray(raw)) {
        // If raw already grouped (has .class array):
        if (raw.length > 0 && Array.isArray((raw[0] as any).class)) {
          setRoutine(raw);
        } else {
          // Group flat periods by day_name:
          const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          const map = new Map<string, RoutinePeriod[]>();
          daysOrder.forEach(d => map.set(d, []));

          raw.forEach((r: any) => {
            const d = r.day_name || 'Monday';
            if (!map.has(d)) map.set(d, []);
            map.get(d)!.push({
              class_name: r.class_name || '',
              section_name: r.section_name || '',
              period_name: r.period_name || '',
              start_time: r.start_time || '',
              end_time: r.end_time || '',
              subject_name: r.subject_name || '',
            });
          });

          const dynamicSchoolId = String(user?.school_id || "");
          const dayRoutines: DayRoutine[] = [];
          map.forEach((classes, day_name) => {
            if (classes.length > 0) {
              dayRoutines.push({
                id: day_name,
                school_id: dynamicSchoolId,
                day_name,
                status: '1',
                class: classes,
              });
            }
          });
          setRoutine(dayRoutines);
        }
      } else {
        setRoutine([]);
      }
    } catch (err: any) {
      const errMsg = err.message || 'An unexpected error occurred';
      console.warn('fetchRoutine exception:', errMsg);
      setError(errMsg);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchRoutineData(false, routine.length > 0);
      }
    }, [token, fetchRoutineData, routine.length])
  );

  if (isLoading && !refreshing) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading routine...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.emptyIconCircle, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
          <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Failed to Load Routine</Text>
        <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
        <TouchableOpacity 
          style={[styles.emptyRetryButton, { backgroundColor: colors.primary }]} 
          onPress={() => fetchRoutineData()}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.emptyRetryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.scrollContent, 
        routine.length === 0 && styles.emptyScrollContent,
        { backgroundColor: colors.background }
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchRoutineData(true)}
          colors={[colors.primary]}
          tintColor={colors.primary}
        />
      }
    >
      {showTitleBanner && (
        <View style={styles.bannerHeader}>
          <Text style={[styles.bannerTitle, { color: colors.text }]}>Class Routine</Text>
          <Text style={[styles.bannerSubtitle, { color: colors.textMuted }]}>Your weekly class timetable and schedule</Text>
        </View>
      )}

      {routine.length > 0 ? (
        routine.map((dayData) => (
          <View key={dayData.id} style={styles.daySection}>
            <View style={styles.dayHeader}>
              <View style={[styles.dayBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.dayHeaderText}>{dayData.day_name}</Text>
              </View>
              <Text style={[styles.classCount, { color: colors.textMuted }]}>
                {dayData.class ? dayData.class.length : 0} {(dayData.class && dayData.class.length === 1) ? 'Class' : 'Classes'}
              </Text>
            </View>

            <ScrollView 
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            >
              {dayData.class && dayData.class.length > 0 ? (
                dayData.class.map((cls, idx) => (
                  <RoutineCard 
                    key={`${dayData.id}-${idx}`}
                    period={cls.period_name}
                    className={`${cls.class_name}, ${cls.section_name}`}
                    subject={cls.subject_name}
                    time={formatPeriodTime(cls.start_time, cls.end_time)}
                  />
                ))
              ) : (
                <RoutineCard isEmpty />
              )}
            </ScrollView>
          </View>
        ))
      ) : (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name="calendar-outline" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Class Routine Available</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            You do not have any class routines or periods assigned in your timetable yet.
          </Text>
          <TouchableOpacity 
            style={[styles.emptyRetryButton, { backgroundColor: colors.primary }]}
            onPress={() => fetchRoutineData(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.emptyRetryButtonText}>Refresh Schedule</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: 15,
    flexGrow: 1,
  },
  emptyScrollContent: {
    justifyContent: 'center',
  },
  bannerHeader: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  bannerSubtitle: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  daySection: {
    marginBottom: 25,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  dayBadge: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  dayHeaderText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  classCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  horizontalList: {
    paddingHorizontal: 20,
    paddingBottom: 5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyRetryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  emptyRetryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
