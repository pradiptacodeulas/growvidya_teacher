import { createAsyncThunk } from '@reduxjs/toolkit';
import { apiClient } from '@/services/apiClient';
import { LoadMoreParams, StudentFilters } from './types';

// Thunk for fetching first-time initial list
export const fetchInitialStudents = createAsyncThunk(
  'students/fetchInitialStudents',
  async (filters: StudentFilters | undefined, { rejectWithValue }) => {
    try {
      const params: Record<string, any> = {
        page: 1,
        limit: 15,
      };

      if (filters?.name) params.name = filters.name;
      if (filters?.class) params.class = filters.class;
      if (filters?.section) params.section = filters.section;
      if (filters?.status !== undefined) params.status = filters.status;

      const response = await apiClient.get('/admin/students', { params });
      const resData = response.data;
      const students = resData?.data?.students || resData?.data || [];
      const pagination = resData?.data?.pagination || {};

      return {
        students: Array.isArray(students) ? students : [],
        page: Number(pagination.page || 1),
        totalPages: Number(pagination.totalPages || 1),
        total: Number(pagination.total || (Array.isArray(students) ? students.length : 0)),
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'An error occurred while fetching students');
    }
  }
);

// Thunk for pagination / load more
export const loadMoreStudents = createAsyncThunk(
  'students/loadMoreStudents',
  async (params: LoadMoreParams, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const currentPage = Number(state.students?.currentPage || 1);
      const totalPages = Number(state.students?.totalPages || 1);

      if (currentPage >= totalPages) {
        return {
          students: [],
          page: currentPage,
          totalPages,
          total: Number(state.students?.total || 0),
        };
      }

      const nextPage = currentPage + 1;

      const queryParams: Record<string, any> = {
        page: nextPage,
        limit: 15,
      };

      if (params.name) queryParams.name = params.name;
      if (params.class) queryParams.class = params.class;
      if (params.section) queryParams.section = params.section;
      if (params.status !== undefined) queryParams.status = params.status;

      const response = await apiClient.get('/admin/students', { params: queryParams });
      const resData = response.data;
      const students = resData?.data?.students || resData?.data || [];
      const pagination = resData?.data?.pagination || {};

      return {
        students: Array.isArray(students) ? students : [],
        page: Number(pagination.page || nextPage),
        totalPages: Number(pagination.totalPages || totalPages),
        total: Number(pagination.total || 0),
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'An error occurred while loading more students');
    }
  }
);

// Thunk for fetching classes list
export const fetchClasses = createAsyncThunk(
  'students/fetchClasses',
  async (_, { rejectWithValue }) => {
    try {
      const response = await apiClient.get('/teacher/academics/classes');
      const resData = response.data;
      const classes = resData?.data || [];
      return Array.isArray(classes) ? classes : [];
    } catch (err: any) {
      return rejectWithValue(err.message || 'An error occurred while fetching classes');
    }
  }
);

// Thunk for fetching sections list by class ID
export const fetchSections = createAsyncThunk(
  'students/fetchSections',
  async (classId: string, { rejectWithValue }) => {
    try {
      const response = await apiClient.get(`/teacher/academics/sections/${classId}`);
      const resData = response.data;
      const sections = resData?.data || [];
      return Array.isArray(sections) ? sections : [];
    } catch (err: any) {
      return rejectWithValue(err.message || 'An error occurred while fetching sections');
    }
  }
);

