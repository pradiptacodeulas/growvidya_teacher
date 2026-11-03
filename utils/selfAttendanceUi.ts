import { Palette } from '@/constants/Colors';
import { formatServerTime, SelfAttendanceStatus } from '@/services/selfAttendance.service';

export type StatusToneKey = 'present' | 'late' | 'halfDay' | 'absent' | 'holiday' | 'leave' | 'neutral' | 'pending';

export interface StatusTone {
  key: StatusToneKey;
  color: string;
  lightBg: string;
  darkBg: string;
  icon: string; // Ionicons name
  chip: string; // short chip label, e.g. "Present 08:41 AM"
  title: string; // banner title
}

const TONES: Record<StatusToneKey, { color: string; lightBg: string; darkBg: string }> = {
  present: Palette.status.present,
  late: Palette.status.late,
  halfDay: Palette.status.halfDay,
  absent: Palette.status.absent,
  holiday: { color: '#8B5CF6', lightBg: '#F5F3FF', darkBg: '#3B2A6B' },
  leave: { color: '#F97316', lightBg: '#FFF7ED', darkBg: '#7C2D12' },
  neutral: { color: '#6B7280', lightBg: '#F3F4F6', darkBg: '#1F2937' },
  pending: { color: '#3D5EE1', lightBg: '#EEF2FF', darkBg: '#1E2545' },
};

/**
 * Derive banner / chip presentation from the server status.
 */
export const getSelfStatusTone = (status: SelfAttendanceStatus | null | undefined): StatusTone => {
  const make = (key: StatusToneKey, icon: string, chip: string, title: string): StatusTone => ({
    key,
    ...TONES[key],
    icon,
    chip,
    title,
  });

  if (!status) return make('neutral', 'time-outline', 'Loading…', 'Checking status…');

  const t = status.today;
  if (t.marked) {
    const time = formatServerTime(t.check_in_time);
    const suffix = time ? ` ${time}` : '';
    const by = t.source === 'admin' ? ' (Marked by admin)' : '';
    switch (t.attendance) {
      case 2:
        return make('late', 'alarm-outline', `Late${suffix}`, `Marked Late${time ? ` at ${time}` : ''}${by}`);
      case 3:
        return make('halfDay', 'contrast-outline', `Half Day${suffix}`, `Marked Half Day${time ? ` at ${time}` : ''}${by}`);
      case 0:
        return make('absent', 'close-circle-outline', 'Absent', `Marked Absent${by}`);
      default:
        return make('present', 'checkmark-circle-outline', `Present${suffix}`, `Marked Present${time ? ` at ${time}` : ''}${by}`);
    }
  }

  switch (status.reason) {
    case 'HOLIDAY':
      return make('holiday', 'sunny-outline', 'Holiday', 'Holiday today');
    case 'WEEKLY_OFF':
      return make('neutral', 'cafe-outline', 'Weekly Off', 'Weekly off today');
    case 'ON_LEAVE':
      return make('leave', 'airplane-outline', 'On Leave', 'You are on leave today');
    case 'GEOFENCE_NOT_SET':
      return make('neutral', 'location-outline', 'Not configured', 'Campus location not configured');
    case 'ALREADY_MARKED':
      return make('present', 'checkmark-circle-outline', t.label || 'Marked', 'Attendance already marked');
    default:
      break;
  }

  if (!status.geofence) {
    return make('neutral', 'location-outline', 'Not configured', 'Campus location not configured');
  }

  return make('pending', 'finger-print-outline', 'Not marked', "You haven't marked attendance today");
};
