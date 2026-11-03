import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/constants/theme';
import { getSelfStatus, SelfAttendanceStatus } from '@/services/selfAttendance.service';
import { getSelfStatusTone } from '@/utils/selfAttendanceUi';

interface TodayAttendanceCardProps {
  onMarkPress: () => void;
  /** Change this value to force a refetch (e.g. dashboard pull-to-refresh) */
  refreshKey?: number;
}

/**
 * Compact "Today's Attendance" card for the dashboard (geofence self check-in status).
 */
export default function TodayAttendanceCard({ onMarkPress, refreshKey }: TodayAttendanceCardProps) {
  const { colors, isDark } = useAppTheme();
  const [status, setStatus] = useState<SelfAttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const s = await getSelfStatus();
      setStatus(s);
      setError(null);
    } catch (e: any) {
      setError(e?.message || 'Unable to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (refreshKey) load();
  }, [refreshKey, load]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  const tone = getSelfStatusTone(status);
  const marked = !!status?.today.marked;
  const canMark = !!status && !status.blocked && !marked;

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={[styles.iconCircle, { backgroundColor: isDark ? tone.darkBg : tone.lightBg }]}>
          <Ionicons name={tone.icon as any} size={22} color={tone.color} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.title, { color: colors.text }]}>Today's Attendance</Text>
          {loading && !status ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
          ) : error && !status ? (
            <Text style={[styles.subText, { color: '#EF4444' }]} numberOfLines={2}>{error}</Text>
          ) : (
            <View style={[styles.chip, { backgroundColor: isDark ? tone.darkBg : tone.lightBg }]}>
              <View style={[styles.dot, { backgroundColor: tone.color }]} />
              <Text style={[styles.chipText, { color: tone.color }]} numberOfLines={1}>
                {tone.chip}
                {marked && status?.today.source === 'admin' ? ' · by admin' : ''}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.button,
            { backgroundColor: canMark ? colors.primary : colors.primaryLight },
          ]}
          onPress={onMarkPress}
          activeOpacity={0.8}
        >
          <Ionicons name={canMark ? 'finger-print' : 'eye-outline'} size={16} color={canMark ? '#fff' : colors.primary} />
          <Text style={[styles.buttonText, { color: canMark ? '#fff' : colors.primary }]}>
            {canMark ? 'Mark Attendance' : 'View'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  subText: {
    fontSize: 12,
    marginTop: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 5,
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 5,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
