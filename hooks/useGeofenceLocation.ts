import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { haversineMeters } from '@/utils/geo';

export interface GeofenceTarget {
  latitude: number;
  longitude: number;
  radius_m: number;
  max_accuracy_m: number;
}

export type GeoPermission = 'undetermined' | 'granted' | 'denied';

export interface GeofenceLocationState {
  permission: GeoPermission;
  canAskAgain: boolean;
  /** null while still being checked */
  gpsOn: boolean | null;
  coords: { latitude: number; longitude: number } | null;
  accuracy: number | null;
  mocked: boolean;
  distance: number | null;
  inside: boolean;
  accurateEnough: boolean;
  lastUpdated: number | null;
  error: string | null;
  requestPermission: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

const GPS_POLL_MS = 4000;

/**
 * Foreground-only location watcher for geofence attendance.
 * Watches position only while the screen is focused and the app is active.
 */
export function useGeofenceLocation(geofence: GeofenceTarget | null | undefined): GeofenceLocationState {
  const [permission, setPermission] = useState<GeoPermission>('undetermined');
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [gpsOn, setGpsOn] = useState<boolean | null>(null);
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const sessionRef = useRef(0);
  const focusedRef = useRef(false);
  const gpsOnRef = useRef<boolean | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopWatching = useCallback(() => {
    sessionRef.current += 1; // invalidates any in-flight start()
    if (subscriptionRef.current) {
      try {
        subscriptionRef.current.remove();
      } catch {
        // ignore
      }
      subscriptionRef.current = null;
    }
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const applyPermission = (res: Location.LocationPermissionResponse) => {
    const status: GeoPermission =
      res.status === Location.PermissionStatus.GRANTED
        ? 'granted'
        : res.status === Location.PermissionStatus.DENIED
        ? 'denied'
        : 'undetermined';
    setPermission(status);
    setCanAskAgain(res.canAskAgain);
    return status;
  };

  const startWatching = useCallback(
    async (allowPrompt: boolean) => {
      stopWatching();
      const session = sessionRef.current;
      const isStale = () => session !== sessionRef.current;
      setError(null);

      try {
        let perm = await Location.getForegroundPermissionsAsync();
        if (isStale()) return;
        if (perm.status !== Location.PermissionStatus.GRANTED && allowPrompt && perm.canAskAgain) {
          perm = await Location.requestForegroundPermissionsAsync();
          if (isStale()) return;
        }
        const status = applyPermission(perm);
        if (status !== 'granted') return;

        const enabled = await Location.hasServicesEnabledAsync();
        if (isStale()) return;
        gpsOnRef.current = enabled;
        setGpsOn(enabled);

        // Poll GPS service state so toggling it from quick settings is picked up.
        pollRef.current = setInterval(async () => {
          try {
            const on = await Location.hasServicesEnabledAsync();
            if (isStale()) return;
            const prev = gpsOnRef.current;
            gpsOnRef.current = on;
            setGpsOn(on);
            if (on && prev === false) {
              startWatching(false);
            }
          } catch {
            // ignore
          }
        }, GPS_POLL_MS);

        if (!enabled) return;

        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 5,
            timeInterval: 5000,
          },
          (loc) => {
            if (isStale()) return;
            setLocation(loc);
            setLastUpdated(Date.now());
            setError(null);
          },
          (reason) => {
            if (isStale()) return;
            setError(typeof reason === 'string' ? reason : 'Unable to get location.');
          }
        );
        if (isStale()) {
          sub.remove();
          return;
        }
        subscriptionRef.current = sub;
      } catch (e: any) {
        if (isStale()) return;
        setError(e?.message || 'Unable to get location.');
      }
    },
    [stopWatching]
  );

  // Start on focus, stop on blur/unmount
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      if (AppState.currentState === 'active') {
        startWatching(true);
      }
      return () => {
        focusedRef.current = false;
        stopWatching();
      };
    }, [startWatching, stopWatching])
  );

  // Stop when app goes to background, resume when active again (if focused)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        if (focusedRef.current) startWatching(false);
      } else if (next === 'background') {
        stopWatching();
      }
    });
    return () => {
      sub.remove();
      stopWatching();
    };
  }, [startWatching, stopWatching]);

  const requestPermission = useCallback(async () => {
    try {
      const res = await Location.requestForegroundPermissionsAsync();
      const status = applyPermission(res);
      if (status === 'granted' && focusedRef.current) {
        await startWatching(false);
      }
      return status === 'granted';
    } catch {
      return false;
    }
  }, [startWatching]);

  const refresh = useCallback(async () => {
    setLocation(null);
    setLastUpdated(null);
    await startWatching(false);
    // Kick a one-off fix so the user gets immediate feedback
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status !== Location.PermissionStatus.GRANTED) return;
      if (!(await Location.hasServicesEnabledAsync())) return;
      const session = sessionRef.current;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (session !== sessionRef.current) return;
      setLocation(loc);
      setLastUpdated(Date.now());
    } catch {
      // watcher will deliver updates
    }
  }, [startWatching]);

  const coords = location
    ? { latitude: location.coords.latitude, longitude: location.coords.longitude }
    : null;
  const accuracy = location?.coords.accuracy ?? null;
  const mocked = Platform.OS === 'android' ? Boolean(location?.mocked) : false;

  const distance = useMemo(() => {
    if (!coords || !geofence) return null;
    return haversineMeters(coords.latitude, coords.longitude, geofence.latitude, geofence.longitude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.latitude, coords?.longitude, geofence?.latitude, geofence?.longitude]);

  const inside = distance !== null && !!geofence && distance <= geofence.radius_m;
  const accurateEnough = accuracy !== null && !!geofence && accuracy <= geofence.max_accuracy_m;

  return {
    permission,
    canAskAgain,
    gpsOn,
    coords,
    accuracy,
    mocked,
    distance,
    inside,
    accurateEnough,
    lastUpdated,
    error,
    requestPermission,
    refresh,
  };
}

export default useGeofenceLocation;
