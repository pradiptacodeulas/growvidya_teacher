import { createSlice } from '@reduxjs/toolkit';
import { StudentState } from './types';
import { fetchInitialStudents, loadMoreStudents, fetchClasses, fetchSections } from './thunks';

const initialState: StudentState = {
  students: [],
  selectedIds: [],
  classes: [],
  sections: [],
  isLoading: false,
  isLoadingMore: false,
  isLoadingClasses: false,
  isLoadingSections: false,
  error: null,
  hasMore: false,
  currentPage: 1,
  totalPages: 1,
};

export const studentSlice = createSlice({
  name: 'students',
  initialState,
  reducers: {
    toggleStudentSelection: (state, action) => {
      const id = action.payload;
      if (state.selectedIds.includes(id)) {
        state.selectedIds = state.selectedIds.filter(x => x !== id);
      } else {
        state.selectedIds.push(id);
      }
    },
    clearStudentSelection: (state) => {
      state.selectedIds = [];
    },
    resetStudentState: (state) => {
      state.students = [];
      state.selectedIds = [];
      state.classes = [];
      state.sections = [];
      state.isLoading = false;
      state.isLoadingMore = false;
      state.isLoadingClasses = false;
      state.isLoadingSections = false;
      state.error = null;
      state.hasMore = false;
      state.currentPage = 1;
      state.totalPages = 1;
    },
    clearSections: (state) => {
      state.sections = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Initial Students
      .addCase(fetchInitialStudents.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchInitialStudents.fulfilled, (state, action) => {
        state.isLoading = false;
        const { students, page, totalPages } = action.payload;
        // Deduplicate students by ID
        const seen = new Set<string>();
        const uniqueStudents = (students || []).filter((s: any) => {
          const id = String(s.id);
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
        state.students = uniqueStudents;
        state.selectedIds = []; // clear selections on reload
        state.currentPage = page;
        state.totalPages = totalPages;
        state.hasMore = page < totalPages;
      })
      .addCase(fetchInitialStudents.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })

      // Load More Students
      .addCase(loadMoreStudents.pending, (state) => {
        state.isLoadingMore = true;
      })
      .addCase(loadMoreStudents.fulfilled, (state, action) => {
        state.isLoadingMore = false;
        const { students: newStudents, page, totalPages } = action.payload;
        if (!newStudents || newStudents.length === 0) {
          state.hasMore = false;
        } else {
          // Strictly deduplicate by student id when appending
          const existingIds = new Set(state.students.map((s: any) => String(s.id)));
          const uniqueNew = newStudents.filter((s: any) => !existingIds.has(String(s.id)));
          state.students = [...state.students, ...uniqueNew];
          state.currentPage = page;
          state.totalPages = totalPages;
          state.hasMore = page < totalPages && uniqueNew.length > 0;
        }
      })
      .addCase(loadMoreStudents.rejected, (state) => {
        state.isLoadingMore = false;
        state.hasMore = false; // Turn off hasMore to prevent infinite retry loops on failure
      })

      // Fetch Classes
      .addCase(fetchClasses.pending, (state) => {
        state.isLoadingClasses = true;
      })
      .addCase(fetchClasses.fulfilled, (state, action) => {
        state.isLoadingClasses = false;
        state.classes = action.payload;
      })
      .addCase(fetchClasses.rejected, (state) => {
        state.isLoadingClasses = false;
      })

      // Fetch Sections
      .addCase(fetchSections.pending, (state) => {
        state.isLoadingSections = true;
        state.sections = [];
      })
      .addCase(fetchSections.fulfilled, (state, action) => {
        state.isLoadingSections = false;
        state.sections = action.payload;
      })
      .addCase(fetchSections.rejected, (state) => {
        state.isLoadingSections = false;
        state.sections = [];
      });
  },
});

export const { toggleStudentSelection, clearStudentSelection, resetStudentState, clearSections } = studentSlice.actions;
export default studentSlice.reducer;
