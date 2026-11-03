import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '@/services/apiClient';

export const fetchDashboard = createAsyncThunk(
  'dashboard/fetchDashboard',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/teacher/dashboard');
      const resData = response.data;

      if (!resData || (resData.success === false && resData.status === false)) {
        return rejectWithValue(resData?.message || 'Failed to fetch dashboard data');
      }

      const raw = resData.data || {};

      const mappedData = {
        teacher_routine: Array.isArray(raw.todayClasses) ? raw.todayClasses : (raw.teacher_routine || []),
        teacher_attendance_data: {
          present: Number(raw.teacher_attendance_data?.present ?? raw.attendanceSummary?.present ?? 0),
          late: Number(raw.teacher_attendance_data?.late ?? raw.attendanceSummary?.late ?? 0),
          half: Number(raw.teacher_attendance_data?.half ?? raw.attendanceSummary?.halfday ?? 0),
          absent: Number(raw.teacher_attendance_data?.absent ?? raw.attendanceSummary?.absent ?? 0),
          periods: raw.teacher_attendance_data?.periods,
          recent_days: raw.teacher_attendance_data?.recent_days,
        },
        teacher_attendance: raw.teacher_attendance || {},
        upcomming_events: (raw.events || raw.upcomming_events || []).map((ev: any) => ({
          id: String(ev.id || ''),
          title: ev.title || ev.event_title || 'Event',
          start_date: ev.start_date || ev.from_date || '',
          end_date: ev.end_date || ev.to_date || '',
          type: ev.type || 'Event',
        })),
        syllabus: Array.isArray(raw.syllabus) ? raw.syllabus : [],
        teacher_leave: Array.isArray(raw.teacher_leave) ? raw.teacher_leave : [],
      };

      return mappedData;
    } catch (error: any) {
      return rejectWithValue(error.message || 'An unexpected error occurred');
    }
  }
);
