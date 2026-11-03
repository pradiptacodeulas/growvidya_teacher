import { apiClient } from '@/services/apiClient';

/**
 * Teacher geofence self-attendance API.
 * Contract: GET /teacher/attendance/self/status, POST /teacher/attendance/self/check-in
 */

/** 0 Absent, 1 Present, 2 Late, 3 Halfday */
export type AttendanceCode = 0 | 1 | 2 | 3;

export type SelfAttendanceSource = 'admin' | 'app' | 'machine' | null;

export type SelfAttendanceBlockReason =
  | 'GEOFENCE_NOT_SET'
  | 'HOLIDAY'
  | 'WEEKLY_OFF'
  | 'ON_LEAVE'
  | 'ALREADY_MARKED';

export type SelfAttendanceErrorCode =
  | 'INVALID_LOCATION'
  | 'GEOFENCE_NOT_SET'
  | 'HOLIDAY'
  | 'WEEKLY_OFF'
  | 'ON_LEAVE'
  | 'ALREADY_MARKED'
  | 'MOCK_LOCATION'
  | 'LOW_ACCURACY'
  | 'OUTSIDE_RADIUS'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export interface SelfGeofence {
  latitude: number;
  longitude: number;
  radius_m: number;
  max_accuracy_m: number;
  late_after: string; // "HH:mm" (may be "HH:mm:ss")
  address?: string | null;
}

export interface SelfAttendanceToday {
  marked: boolean;
  attendance: AttendanceCode | null;
  label: string | null;
  check_in_time: string | null;
  source: SelfAttendanceSource;
  distance_m: number | null;
}

export interface SelfAttendanceStatus {
  server_time: string;
  date: string;
  branch: { id: number; name: string } | null;
  geofence: SelfGeofence | null;
  today: SelfAttendanceToday;
  half_day_leave: boolean;
  blocked: boolean;
  reason: SelfAttendanceBlockReason | null;
  message: string | null;
  will_be_late: boolean;
}

export interface SelfCheckInPayload {
  latitude: number;
  longitude: number;
  accuracy: number;
  is_mocked: boolean;
  device_info?: string;
}

export interface SelfCheckInResult {
  attendance: AttendanceCode;
  label: string;
  check_in_time: string;
  distance_m: number;
  message?: string;
}

export interface SelfAttendanceError {
  code: SelfAttendanceErrorCode | string;
  message: string;
  status?: number;
  extra: Record<string, any>;
}

const toNum = (v: any): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeStatus = (raw: any): SelfAttendanceStatus => {
  const g = raw?.geofence;
  const lat = toNum(g?.latitude);
  const lng = toNum(g?.longitude);
  const geofence: SelfGeofence | null =
    g && lat !== null && lng !== null
      ? {
          latitude: lat,
          longitude: lng,
          radius_m: toNum(g.radius_m) ?? 150,
          max_accuracy_m: toNum(g.max_accuracy_m) ?? 100,
          late_after: String(g.late_after ?? '09:30').slice(0, 5),
          address: g.address ?? null,
        }
      : null;
  const t = raw?.today ?? {};
  return {
    server_time: raw?.server_time ?? '',
    date: raw?.date ?? '',
    branch: raw?.branch ?? null,
    geofence,
    today: {
      marked: Boolean(t.marked),
      attendance: (toNum(t.attendance) as AttendanceCode | null) ?? null,
      label: t.label ?? null,
      check_in_time: t.check_in_time ?? null,
      source: t.source ?? null,
      distance_m: toNum(t.distance_m),
    },
    half_day_leave: Boolean(raw?.half_day_leave),
    blocked: Boolean(raw?.blocked),
    reason: raw?.reason ?? null,
    message: raw?.message ?? null,
    will_be_late: Boolean(raw?.will_be_late),
  };
};

/**
 * Convert any thrown error (apiClient rejects with Error + .response) into a typed error.
 */
export const normalizeSelfAttendanceError = (err: any): SelfAttendanceError => {
  const res = err?.response;
  const data = res?.data;
  const errors = data?.errors && typeof data.errors === 'object' && !Array.isArray(data.errors) ? data.errors : {};
  const { code, ...extra } = errors as Record<string, any>;
  if (!res) {
    return {
      code: 'NETWORK_ERROR',
      message: err?.message || 'Unable to connect to the server. Please check your internet connection.',
      extra: {},
    };
  }
  return {
    code: code || 'UNKNOWN',
    message:
      (typeof data?.message === 'string' && data.message.trim()) ||
      err?.message ||
      'Something went wrong. Please try again.',
    status: res?.status,
    extra,
  };
};

export const getSelfStatus = async (): Promise<SelfAttendanceStatus> => {
  try {
    const response = await apiClient.get('/teacher/attendance/self/status');
    return normalizeStatus(response.data?.data ?? response.data);
  } catch (err) {
    throw normalizeSelfAttendanceError(err);
  }
};

export const selfCheckIn = async (payload: SelfCheckInPayload): Promise<SelfCheckInResult> => {
  try {
    const response = await apiClient.post('/teacher/attendance/self/check-in', payload);
    const d = response.data?.data ?? {};
    return {
      attendance: (toNum(d.attendance) ?? 1) as AttendanceCode,
      label: d.label ?? 'Present',
      check_in_time: d.check_in_time ?? '',
      distance_m: toNum(d.distance_m) ?? 0,
      message: d.message ?? response.data?.message,
    };
  } catch (err) {
    throw normalizeSelfAttendanceError(err);
  }
};

/**
 * Format server ISO datetime ("2026-10-27T08:41:05+05:30") as "08:41 AM"
 * using the wall-clock time embedded in the string (not the device timezone).
 */
export const formatServerTime = (iso?: string | null): string => {
  if (!iso) return '';
  const m = String(iso).match(/[T ](\d{2}):(\d{2})/);
  if (!m) return '';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${min} ${ampm}`;
};

/** Format "HH:mm" as "09:30 AM" */
export const formatHHmm = (hhmm?: string | null): string => {
  if (!hhmm) return '';
  return formatServerTime(`T${hhmm.slice(0, 5)}`);
};

/** Format server date "2026-10-27" as "Tue, 27 Oct 2026" without timezone drift. */
export const formatServerDate = (ymd?: string | null): string => {
  if (!ymd) return '';
  const m = String(ymd).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(ymd);
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getUTCDay()]}, ${m[3]} ${months[+m[2] - 1]} ${m[1]}`;
};
