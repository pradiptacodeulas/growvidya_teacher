export interface Routine {
  class_name: string;
  section_name: string;
  period_name: string;
  start_time: string;
  end_time: string;
  subject_name: string;
}

export interface AttendancePeriodStats {
  present: number;
  late: number;
  half: number;
  absent: number;
}

export interface AttendanceRecentDay {
  day: string;
  day_name?: string;
  date?: string;
  status: string;
}

export interface AttendanceData {
  present: number;
  late: number;
  half: number;
  absent: number;
  periods?: {
    this_week: AttendancePeriodStats;
    last_week: AttendancePeriodStats;
    last_month: AttendancePeriodStats;
    overall: AttendancePeriodStats;
  };
  recent_days?: AttendanceRecentDay[];
}


export interface UpcomingEvent {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  type: string;
}

export interface SyllabusItem {
  id: string;
  school_id: string;
  academic_year: string;
  class_id: string;
  subject_id: string;
  lession: string;
  status: string; // "1" for pending, "2" for progress, "3" for completed
  created_at: string;
  subject_name: string;
  class_name: string;
}

export interface LeaveRequest {
  id: string;
  role: string;
  school_id: string;
  staff_id: string;
  leave_id: string;
  duration: string;
  document: string | null;
  leave_reason: string;
  status: string; // "1" for pending, "2" for approved, "3" for rejected
  created_at: string;
  leave_name: string;
  first_leave_date: string;
  last_leave_date: string;
  all_leave_date: {
    date: string;
    status: string;
  }[];
}

export interface DashboardData {
  teacher_routine: Routine[];
  teacher_attendance_data: AttendanceData;
  teacher_attendance: Record<string, string>;
  upcomming_events: UpcomingEvent[];
  syllabus: SyllabusItem[];
  teacher_leave: LeaveRequest[];
}

export interface DashboardState {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
}
