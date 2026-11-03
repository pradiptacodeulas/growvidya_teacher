export interface StudentClass {
  id: string;
  class?: string;
  class_name?: string;
  school_id?: string;
  status?: string;
  created_at?: string;
}

export interface StudentSection {
  id: string;
  class_id: string;
  section_name: string;
  school_id?: string;
  capacity?: string;
  status?: string;
}

export interface StudentState {
  students: any[];          // Array of raw API student objects
  selectedIds: string[];    // Array of selected student IDs
  classes: StudentClass[];  // Classes loaded from API
  sections: StudentSection[]; // Sections loaded from API for selected class
  isLoading: boolean;
  isLoadingMore: boolean;
  isLoadingClasses: boolean;
  isLoadingSections: boolean;
  error: string | null;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
}

export interface StudentFilters {
  name?: string;
  class?: string;
  section?: string;
  status?: string | number;
  date?: string;
}

export interface LoadMoreParams extends StudentFilters {
  lastId: string;
}
