import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  AppState,
  Linking,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as Device from 'expo-device';
import * as Location from 'expo-location';
import Svg, { Circle } from 'react-native-svg';
import InternalHeader from '@/components/InternalHeader';
import { useAppTheme } from '@/constants/theme';
import { useGeofenceLocation } from '@/hooks/useGeofenceLocation';
import {
  getSelfStatus,
  selfCheckIn,
  formatServerTime,
  formatServerDate,
  formatHHmm,
  SelfAttendanceStatus,
  SelfAttendanceError,
  SelfCheckInResult,
} from '@/services/selfAttendance.service';
import { formatDistance } from '@/utils/geo';
import { getSelfStatusTone } from '@/utils/selfAttendanceUi';

type DisabledAction = 'settings' | 'permission' | 'gps' | 'refresh' | 'retry' | null;

interface DisabledInfo {
  text: string;
  icon: keyof typeof Ionicons.glyphMap;
  action: DisabledAction;
  actionLabel?: string;
}

const RING_SIZE = 132;
const RING_STROKE = 10;

export default function MyAttendanceScreen() {
  const { colors, isDark } = useAppTheme();

  const [status, setStatus] = useState<SelfAttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SelfCheckInResult | null>(null);
  const [now, setNow] = useState(Date.now());

  const successAnim = useRef(new Animated.Value(0)).current;
  const fetchingRef = useRef(false);

  const geofence = status?.geofence ?? null;
  const geo = useGeofenceLocation(geofence);

  // ---- Status fetching ----
  const fetchStatus = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'silent') => {
    if (fetchingRef.current && mode === 'silent') return;
    fetchingRef.current = true;
    if (mode === 'refresh') setRefreshing(true);
    if (mode === 'initial') setLoading(true);
    try {
      const s = await getSelfStatus();
      setStatus(s);
      setStatusError(null);
    } catch (e: any) {
      setStatusError((e as SelfAttendanceError)?.message || 'Unable to load attendance status.');
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchStatus(status ? 'silent' : 'initial');
      const tick = setInterval(() => setNow(Date.now()), 5000);
      return () => {
        clearInterval(tick);
        // Server status is the source of truth once the user comes back
        setSuccess(null);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchStatus])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') fetchStatus('silent');
    });
    return () => sub.remove();
  }, [fetchStatus]);

  const onRefresh = useCallback(() => {
    setSubmitError(null);
    fetchStatus('refresh');
    geo.refresh();
  }, [fetchStatus, geo.refresh]);

  // ---- Success animation ----
  useEffect(() => {
    if (success) {
      successAnim.setValue(0);
      Animated.spring(successAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
    }
  }, [success, successAnim]);

  // ---- Derived state ----
  const tone = getSelfStatusTone(status);
  const radius = geofence?.radius_m ?? 0;
  const maxAcc = geofence?.max_accuracy_m ?? 0;
  const marked = !!status?.today.marked;

  const enabled =
    !!status &&
    !status.blocked &&
    !!geofence &&
    geo.permission === 'granted' &&
    geo.gpsOn === true &&
    !geo.mocked &&
    geo.coords !== null &&
    geo.accuracy !== null &&
    geo.accuracy <= maxAcc &&
    geo.distance !== null &&
    geo.distance <= radius &&
    !submitting;

  const getDisabledInfo = (): DisabledInfo | null => {
    if (enabled) return null;
    if (submitting) return { text: 'Marking your attendance…', icon: 'hourglass-outline', action: null };
    if (!status) {
      if (statusError) return { text: statusError, icon: 'cloud-offline-outline', action: 'retry', actionLabel: 'Retry' };
      return { text: 'Loading attendance status…', icon: 'time-outline', action: null };
    }
    if (status.blocked) {
      return {
        text: status.message || tone.title,
        icon: (marked ? 'checkmark-done-outline' : 'information-circle-outline') as any,
        action: null,
      };
    }
    if (!geofence) {
      return { text: 'Campus location is not configured. Please contact the school admin.', icon: 'location-outline', action: null };
    }
    if (geo.permission !== 'granted') {
      if (geo.permission === 'denied' && !geo.canAskAgain) {
        return {
          text: 'Location permission is denied. Enable it in Settings to mark attendance.',
          icon: 'lock-closed-outline',
          action: 'settings',
          actionLabel: 'Open Settings',
        };
      }
      return {
        text: 'Location permission is required to verify you are on campus.',
        icon: 'navigate-outline',
        action: 'permission',
        actionLabel: 'Allow Location',
      };
    }
    if (geo.gpsOn === false) {
      return { text: 'GPS / Location services are turned off.', icon: 'navigate-circle-outline', action: 'gps', actionLabel: 'Turn On GPS' };
    }
    if (!geo.coords || geo.accuracy === null) {
      return { text: geo.error || 'Locating you…', icon: 'locate-outline', action: geo.error ? 'refresh' : null, actionLabel: 'Retry' };
    }
    if (geo.mocked) {
      return {
        text: 'Mock location detected. Disable fake GPS apps / developer mock location to mark attendance.',
        icon: 'warning-outline',
        action: null,
      };
    }
    if (geo.accuracy > maxAcc) {
      return {
        text: `Weak GPS signal (±${Math.round(geo.accuracy)} m, need ±${Math.round(maxAcc)} m). Move to an open area and wait a moment.`,
        icon: 'cellular-outline',
        action: 'refresh',
        actionLabel: 'Refresh',
      };
    }
    if (geo.distance !== null && geo.distance > radius) {
      return {
        text: `You are ${formatDistance(geo.distance)} away (allowed ${formatDistance(radius)}).`,
        icon: 'walk-outline',
        action: 'refresh',
        actionLabel: 'Refresh',
      };
    }
    return { text: 'Locating you…', icon: 'locate-outline', action: null };
  };

  const disabledInfo = getDisabledInfo();

  const handleDisabledAction = async (action: DisabledAction) => {
    switch (action) {
      case 'settings':
        Linking.openSettings().catch(() => {});
        break;
      case 'permission': {
        const ok = await geo.requestPermission();
        if (!ok) Linking.openSettings().catch(() => {});
        break;
      }
      case 'gps':
        if (Platform.OS === 'android') {
          try {
            await Location.enableNetworkProviderAsync();
            geo.refresh();
          } catch {
            Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => Linking.openSettings());
          }
        } else {
          Linking.openSettings().catch(() => {});
        }
        break;
      case 'refresh':
        geo.refresh();
        break;
      case 'retry':
        fetchStatus('initial');
        break;
      default:
        break;
    }
  };

  // ---- Check-in ----
  const handleCheckIn = async () => {
    if (!enabled || !geo.coords || geo.accuracy === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await selfCheckIn({
        latitude: geo.coords.latitude,
        longitude: geo.coords.longitude,
        accuracy: geo.accuracy,
        is_mocked: geo.mocked,
        device_info: `${Platform.OS} ${Platform.Version} ${Device.modelName ?? ''}`.trim(),
      });
      setSuccess(result);
    } catch (e: any) {
      const err = e as SelfAttendanceError;
      const msg = err?.message || 'Unable to mark attendance. Please try again.';
      setSubmitError(msg);
      Alert.alert('Attendance Not Marked', msg);
    } finally {
      setSubmitting(false);
      fetchStatus('silent');
    }
  };

  // ---- Render helpers ----
  const toneBg = isDark ? tone.darkBg : tone.lightBg;
  const ringColor = geo.mocked
    ? '#EF4444'
    : geo.inside && geo.accurateEnough
    ? '#10B981'
    : geo.inside
    ? '#F59E0B'
    : geo.distance !== null
    ? '#EF4444'
    : colors.textMuted;
  const ringProgress =
    geo.distance === null || radius <= 0 ? 0 : Math.max(0.04, Math.min(1, radius / Math.max(geo.distance, 1)));
  const circumference = 2 * Math.PI * ((RING_SIZE - RING_STROKE) / 2);

  const lastUpdatedText = (() => {
    if (!geo.lastUpdated) return '--';
    const secs = Math.max(0, Math.round((now - geo.lastUpdated) / 1000));
    if (secs < 10) return 'just now';
    if (secs < 60) return `${secs}s ago`;
    return `${Math.floor(secs / 60)}m ago`;
  })();

  const doneResult = success
    ? { label: success.label, time: formatServerTime(success.check_in_time), source: 'app' as const }
    : marked
    ? { label: status?.today.label || tone.chip, time: formatServerTime(status?.today.check_in_time), source: status?.today.source }
    : null;

  const showLocationCard = !!status && !marked && !!geofence && !status.blocked;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="My Attendance" />

      {loading && !status ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading attendance status...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
          }
        >
          {/* Date & Branch */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <Text style={[styles.metaText, { color: colors.text }]}>
                {status?.date ? formatServerDate(status.date) : '--'}
              </Text>
            </View>
            {!!status?.branch?.name && (
              <View style={[styles.metaItem, { flexShrink: 1 }]}>
                <Ionicons name="business-outline" size={16} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.text }]} numberOfLines={1}>
                  {status.branch.name}
                </Text>
              </View>
            )}
          </View>

          {statusError && status && (
            <View style={[styles.inlineError, { backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2' }]}>
              <Ionicons name="cloud-offline-outline" size={16} color="#EF4444" />
              <Text style={styles.inlineErrorText}>{statusError}</Text>
            </View>
          )}

          {/* Status banner */}
          <View style={[styles.banner, { backgroundColor: toneBg, borderColor: tone.color }]}>
            <View style={[styles.bannerIcon, { backgroundColor: tone.color }]}>
              <Ionicons name={tone.icon as any} size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerTitle, { color: colors.text }]}>{tone.title}</Text>
              {!!status?.message && (
                <Text style={[styles.bannerMsg, { color: colors.textSecondary }]}>{status.message}</Text>
              )}
              {!status?.message && !status?.blocked && !!geofence && (
                <Text style={[styles.bannerMsg, { color: colors.textSecondary }]}>
                  Be inside the campus and tap PRESENT to mark your attendance.
                </Text>
              )}
            </View>
          </View>

          {/* Warnings */}
          {!!status && !status.blocked && status.will_be_late && !!geofence && (
            <View style={[styles.warning, { backgroundColor: isDark ? '#78350F' : '#FEF3C7' }]}>
              <Ionicons name="alarm-outline" size={18} color="#F59E0B" />
              <Text style={[styles.warningText, { color: isDark ? '#FDE68A' : '#92400E' }]}>
                It's past {formatHHmm(geofence.late_after)}. This check-in will be marked Late.
              </Text>
            </View>
          )}
          {!!status && !status.blocked && status.half_day_leave && (
            <View style={[styles.warning, { backgroundColor: isDark ? '#1E3A8A' : '#EFF6FF' }]}>
              <Ionicons name="contrast-outline" size={18} color="#3B82F6" />
              <Text style={[styles.warningText, { color: isDark ? '#BFDBFE' : '#1E40AF' }]}>
                You have an approved half-day leave today. Attendance will be marked as Half Day.
              </Text>
            </View>
          )}

          {/* Location card */}
          {showLocationCard && geofence && (
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={styles.cardHeader}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Your Location</Text>
                <TouchableOpacity
                  style={[styles.refreshBtn, { backgroundColor: colors.primaryLight }]}
                  onPress={() => geo.refresh()}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                  <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.locationBody}>
                <View style={styles.ringWrap}>
                  <Svg width={RING_SIZE} height={RING_SIZE}>
                    <Circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={(RING_SIZE - RING_STROKE) / 2}
                      stroke={colors.surfaceSubtle}
                      strokeWidth={RING_STROKE}
                      fill="none"
                    />
                    <Circle
                      cx={RING_SIZE / 2}
                      cy={RING_SIZE / 2}
                      r={(RING_SIZE - RING_STROKE) / 2}
                      stroke={ringColor}
                      strokeWidth={RING_STROKE}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${circumference} ${circumference}`}
                      strokeDashoffset={circumference * (1 - ringProgress)}
                      transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                    />
                  </Svg>
                  <View style={styles.ringCenter}>
                    {geo.distance === null ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <>
                        <Text style={[styles.ringValue, { color: ringColor }]}>{formatDistance(geo.distance)}</Text>
                        <Text style={[styles.ringSub, { color: colors.textMuted }]}>
                          {geo.inside ? 'on campus' : 'from campus'}
                        </Text>
                      </>
                    )}
                  </View>
                </View>

                <View style={styles.locationStats}>
                  <Text style={[styles.distanceLine, { color: colors.text }]}>
                    {geo.distance === null
                      ? `Allowed radius ${formatDistance(radius)}`
                      : `${formatDistance(geo.distance)} of ${formatDistance(radius)} allowed`}
                  </Text>
                  <View style={styles.statRow}>
                    <Ionicons
                      name="radio-outline"
                      size={14}
                      color={geo.accuracy === null ? colors.textMuted : geo.accurateEnough ? '#10B981' : '#F59E0B'}
                    />
                    <Text style={[styles.statText, { color: colors.textSecondary }]}>
                      GPS accuracy: {geo.accuracy === null ? '--' : `±${Math.round(geo.accuracy)} m`}
                      <Text style={{ color: colors.textMuted }}> (max ±{Math.round(maxAcc)} m)</Text>
                    </Text>
                  </View>
                  <View style={styles.statRow}>
                    <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                    <Text style={[styles.statText, { color: colors.textSecondary }]}>Updated: {lastUpdatedText}</Text>
                  </View>
                  {!!geofence.address && (
                    <View style={styles.statRow}>
                      <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.statText, { color: colors.textMuted }]} numberOfLines={2}>
                        {geofence.address}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Action area */}
          {doneResult ? (
            <View style={[styles.card, styles.doneCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <Animated.View
                style={{
                  transform: [
                    {
                      scale: success
                        ? successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] })
                        : 1,
                    },
                  ],
                  opacity: success ? successAnim : 1,
                }}
              >
                <View style={[styles.doneIconCircle, { backgroundColor: isDark ? tone.darkBg : tone.lightBg }]}>
                  <Ionicons name="checkmark-circle" size={72} color={success ? '#10B981' : tone.color} />
                </View>
              </Animated.View>
              <Text style={[styles.doneTitle, { color: colors.text }]}>
                Marked {doneResult.label}
                {doneResult.time ? ` at ${doneResult.time}` : ''}
              </Text>
              {doneResult.source === 'admin' && (
                <Text style={[styles.doneSub, { color: colors.textMuted }]}>Marked by admin</Text>
              )}
              {!!success?.message && (
                <Text style={[styles.doneSub, { color: colors.textMuted }]}>{success.message}</Text>
              )}
            </View>
          ) : (
            <View style={styles.actionArea}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!enabled}
                onPress={handleCheckIn}
                style={[
                  styles.presentBtn,
                  {
                    backgroundColor: enabled ? '#10B981' : colors.surfaceSubtle,
                    borderColor: enabled ? (isDark ? '#064E3B' : '#A7F3D0') : colors.border,
                    shadowOpacity: enabled ? 0.25 : 0,
                    elevation: enabled ? 8 : 0,
                  },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="large" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="finger-print" size={48} color={enabled ? '#fff' : colors.textMuted} />
                    <Text style={[styles.presentText, { color: enabled ? '#fff' : colors.textMuted }]}>PRESENT</Text>
                  </>
                )}
              </TouchableOpacity>

              {disabledInfo && (
                <View style={[styles.reasonBox, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <View style={styles.reasonRow}>
                    <Ionicons name={disabledInfo.icon} size={18} color={colors.textSecondary} />
                    <Text style={[styles.reasonText, { color: colors.textSecondary }]}>{disabledInfo.text}</Text>
                  </View>
                  {disabledInfo.action && disabledInfo.actionLabel && (
                    <TouchableOpacity
                      style={[styles.reasonBtn, { backgroundColor: colors.primary }]}
                      onPress={() => handleDisabledAction(disabledInfo.action)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.reasonBtnText}>{disabledInfo.actionLabel}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {!!submitError && !submitting && (
                <View style={[styles.inlineError, { backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2', marginTop: 12 }]}>
                  <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                  <Text style={styles.inlineErrorText}>{submitError}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  bannerMsg: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '700',
  },
  locationBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  ringSub: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  locationStats: {
    flex: 1,
    gap: 8,
  },
  distanceLine: {
    fontSize: 15,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  actionArea: {
    alignItems: 'center',
    marginTop: 8,
  },
  presentBtn: {
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 6,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
  },
  presentText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 6,
  },
  reasonBox: {
    width: '100%',
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  reasonText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  reasonBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reasonBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
    width: '100%',
  },
  inlineErrorText: {
    flex: 1,
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
  },
  doneCard: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  doneIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  doneTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  doneSub: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});
