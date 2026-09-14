import React, { useEffect, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ProfileCard from '@/components/ProfileCard';
import SyllabusStatusCard from '@/components/SyllabusStatusCard';
import TodaysClassCard from '@/components/TodaysClassCard';
import AttendanceCard from '@/components/AttendanceCard';
import LeaveStatusCard from '@/components/LeaveStatusCard';
import SchedulesCard from '@/components/SchedulesCard';
import SyllabusLessonPlanCard from '@/components/SyllabusLessonPlanCard';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppSelector, useAppDispatch } from '@/redux/hooks';
import { fetchDashboard } from '@/redux/features/dashboard/thunks';
import { useAppTheme } from '@/constants/theme';
import { getAvatarUrl } from '@/services/apiClient';

export default function HomeScreen() {
  const user = useAppSelector((state) => state.auth.user);
  const { data, isLoading, error } = useAppSelector((state) => state.dashboard);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { colors } = useAppTheme();

  const onRefresh = useCallback(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  // Re-fetch dashboard data whenever screen comes into focus
  useFocusEffect(
    useCallback(() => {
      dispatch(fetchDashboard());
    }, [dispatch])
  );

  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>No user data found.</Text>
      </View>
    );
  }

  const teacherData = {
    name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Teacher',
    id: String(user.teacherId || user.teacher_id || user.id || ''),
    className: user.className || user.class_name || 'Teacher',
    avatarUrl: getAvatarUrl(user.picture, user.gender),
  };

  // Calculate Syllabus Progress
  const calculateSyllabusProgress = () => {
    if (!data?.syllabus || data.syllabus.length === 0) return { completed: 0, pending: 100 };
    const total = data.syllabus.length;
    const completedCount = data.syllabus.filter(item => item.status === '3').length;
    const completedPercent = Math.round((completedCount / total) * 100);
    return { completed: completedPercent, pending: 100 - completedPercent };
  };

  const progress = calculateSyllabusProgress();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['left', 'right']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Teacher Dashboard</Text>
          <Text style={[styles.welcomeText, { color: colors.textMuted }]}>Welcome back, {user.first_name}</Text>
        </View>

        {isLoading && !data && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {error && !data && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <ProfileCard 
          name={teacherData.name}
          id={teacherData.id}
          className={teacherData.className}
          avatarUrl={teacherData.avatarUrl}
          onEditPress={() => router.push('/(main)/(drawer)/profile-edit')}
        />

        <SyllabusStatusCard 
          completed={progress.completed}
          pending={progress.pending}
        />

        <TodaysClassCard routine={data?.teacher_routine} />

        <AttendanceCard data={data?.teacher_attendance_data} />

        <LeaveStatusCard leaves={data?.teacher_leave} />

        <SchedulesCard events={data?.upcomming_events} />

        <SyllabusLessonPlanCard syllabus={data?.syllabus} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
  },
  welcomeText: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 15,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    marginBottom: 15,
  },
  errorText: {
    color: '#dc2626',
    textAlign: 'center',
  },
});