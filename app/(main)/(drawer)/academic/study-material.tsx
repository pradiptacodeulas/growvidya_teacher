import InternalHeader from "@/components/InternalHeader";
import SelectionBottomSheet from "@/components/common/SelectionBottomSheet";
import { useAppTheme } from "@/constants/theme";
import { useAppSelector } from "@/redux/hooks";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { apiClient, getFileUrl } from "@/services/apiClient";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Modal, RefreshControl, StyleSheet, Text, TouchableOpacity, View, } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

// Data Interfaces
export interface AcademicYearItem {
  id: string;
  school_id?: string;
  academic_year: string;
  start_date?: string;
  end_date?: string;
  is_current?: string;
  status?: string;
}

export interface MaterialTypeItem {
  id: string;
  school_id?: string;
  material_type_name: string;
  description?: string;
  display_order?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ClassItem {
  id: string;
  class_id?: string;
  class_name: string;
}

export interface SectionItem {
  id: string;
  school_id?: string;
  class_id?: string;
  section_name: string;
  capacity?: string;
  note?: string;
  sort_order?: string;
  status?: string;
}

export interface SubjectItem {
  id: string;
  subject_name: string;
  class_id?: string;
}

export interface StatusItem {
  id: string;
  name: string;
}

export interface StudyMaterialItem {
  id: string;
  school_id?: string;
  academic_year_id?: string;
  class_id?: string;
  section_id?: string;
  subject_id?: string;
  material_type_id?: string;
  uploaded_by?: string;
  uploader_type?: string;
  title?: string;
  material_name?: string;
  name?: string;
  description?: string;
  chapter?: string;
  details?: string;
  attachment?: string;
  attachment_original_name?: string;
  attachment_extension?: string;
  attachment_size?: string | number;
  publish_date?: string;
  expiry_date?: string | null;
  allow_download?: string;
  display_order?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  class_name?: string;
  section_name?: string | null;
  subject_name?: string;
  material_type_name?: string;
  academic_year?: string;
  uploaded_by_name?: string;
  [key: string]: any;
}

export default function StudyMaterialScreen() {
  const router = useRouter();
  const token = useAppSelector((state) => state.auth.token);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const handleNavigateToMaterialTypes = () => {
    router.push("/(main)/(drawer)/academic/material-types");
  };

  const handleNavigateToAddMaterial = () => {
    router.push("/(main)/(drawer)/academic/add-study-material");
  };

  // Collapsible Filter State
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(true);

  // BottomSheet References
  const academicYearSheetRef = useRef<BottomSheetModal>(null);
  const materialTypeSheetRef = useRef<BottomSheetModal>(null);
  const classSheetRef = useRef<BottomSheetModal>(null);
  const sectionSheetRef = useRef<BottomSheetModal>(null);
  const subjectSheetRef = useRef<BottomSheetModal>(null);
  const statusSheetRef = useRef<BottomSheetModal>(null);
  const detailsSheetRef = useRef<BottomSheetModal>(null);

  // Details Modal & Delete States
  const [selectedMaterialDetails, setSelectedMaterialDetails] = useState<StudyMaterialItem | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);

  // Filter Data States
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialTypeItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  const statusOptions: StatusItem[] = useMemo(
    () => [
      { id: "all", name: "All Status" },
      { id: "1", name: "Active" },
      { id: "2", name: "Inactive" },
    ],
    [],
  );

  // Selected Filter States
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("all");
  const [selectedMaterialType, setSelectedMaterialType] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Filter Loading States
  const [isLoadingYears, setIsLoadingYears] = useState<boolean>(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState<boolean>(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState<boolean>(false);
  const [isLoadingSections, setIsLoadingSections] = useState<boolean>(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState<boolean>(false);

  // Content & Pagination States
  const [studyMaterials, setStudyMaterials] = useState<StudyMaterialItem[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [lastIdState, setLastIdState] = useState<string | null>(null);

  // 1. Fetch Academic Years
  const fetchAcademicYears = useCallback(async () => {
    setIsLoadingYears(true);
    try {
      const response = await apiClient.get<any>('/teacher/academics/years');
      const raw = response?.data?.data ?? response?.data;
      const list = Array.isArray(raw?.years)
        ? raw.years
        : Array.isArray(raw)
        ? raw
        : [];
      setAcademicYears(list);
    } catch (e: any) {
      console.warn("fetchAcademicYears error:", e?.message);
    } finally {
      setIsLoadingYears(false);
    }
  }, []);

  // 2. Fetch Material Types
  const fetchMaterialTypes = useCallback(async () => {
    setIsLoadingTypes(true);
    try {
      const response = await apiClient.get<any>('/teacher/academics/material-types');
      const raw = response?.data?.data ?? response?.data;
      const list = Array.isArray(raw?.material_types)
        ? raw.material_types
        : Array.isArray(raw)
        ? raw
        : Array.isArray(response?.data?.material_types)
        ? response.data.material_types
        : [];
      setMaterialTypes(list);
    } catch (e: any) {
      console.warn("fetchMaterialTypes error:", e?.message);
    } finally {
      setIsLoadingTypes(false);
    }
  }, []);

  // 3. Fetch Assigned Classes
  const fetchClasses = useCallback(async () => {
    setIsLoadingClasses(true);
    try {
      const response = await apiClient.get<any>('/teacher/academics/classes');
      const raw = response?.data?.data ?? response?.data;
      const rawClasses = Array.isArray(raw?.classes)
        ? raw.classes
        : Array.isArray(raw)
        ? raw
        : [];
      setClasses(rawClasses);
    } catch (e: any) {
      console.warn("fetchClasses error:", e?.message);
    } finally {
      setIsLoadingClasses(false);
    }
  }, []);

  // 4. Fetch Sections by class_id
  const fetchSections = useCallback(
    async (classId: string) => {
      if (!classId || classId === "all") {
        setSections([]);
        return;
      }
      setIsLoadingSections(true);
      try {
        const response = await apiClient.get<any>(`/teacher/academics/sections/${classId}`);
        const raw = response?.data?.data ?? response?.data;
        const dataList = Array.isArray(raw?.sections)
          ? raw.sections
          : Array.isArray(raw)
          ? raw
          : [];
        setSections(dataList);
      } catch (e: any) {
        console.warn("fetchSections error:", e?.message);
        setSections([]);
      } finally {
        setIsLoadingSections(false);
      }
    },
    [],
  );

  // 5. Fetch Subjects by class_id
  const fetchSubjects = useCallback(
    async (classId: string) => {
      if (!classId || classId === "all") {
        setSubjects([]);
        return;
      }
      setIsLoadingSubjects(true);
      try {
        const response = await apiClient.get<any>(`/teacher/academics/subjects?class_id=${classId}`);
        const raw = response?.data?.data ?? response?.data;
        const dataList = Array.isArray(raw?.subjects)
          ? raw.subjects
          : Array.isArray(raw)
          ? raw
          : [];
        setSubjects(dataList);
      } catch (e: any) {
        console.warn("fetchSubjects error:", e?.message);
        setSubjects([]);
      } finally {
        setIsLoadingSubjects(false);
      }
    },
    [],
  );

  // Helper function to construct query parameters
  const buildQueryParams = useCallback(
    (page = 1) => {
      const params: string[] = [`page=${page}`, `limit=10`];
      if (selectedAcademicYear && selectedAcademicYear !== "all") {
        params.push(`academic_year_id=${encodeURIComponent(selectedAcademicYear)}`);
      }
      if (selectedMaterialType && selectedMaterialType !== "all") {
        params.push(`material_type_id=${encodeURIComponent(selectedMaterialType)}`);
      }
      if (selectedClass && selectedClass !== "all") {
        params.push(`class_id=${encodeURIComponent(selectedClass)}`);
      }
      if (selectedSection && selectedSection !== "all") {
        params.push(`section_id=${encodeURIComponent(selectedSection)}`);
      }
      if (selectedSubject && selectedSubject !== "all") {
        params.push(`subject_id=${encodeURIComponent(selectedSubject)}`);
      }
      if (selectedStatus && selectedStatus !== "all") {
        params.push(`status=${encodeURIComponent(selectedStatus)}`);
      }

      return `?${params.join("&")}`;
    },
    [
      selectedAcademicYear,
      selectedMaterialType,
      selectedClass,
      selectedSection,
      selectedSubject,
      selectedStatus,
    ],
  );

  // 6. Initial Fetch or Filter Refresh of Study Materials
  const fetchStudyMaterials = useCallback(
    async (isSilent = false) => {
      if (!isSilent) {
        setIsLoadingMaterials(true);
      }
      setError(null);
      setHasMore(true);
      setLastIdState(null);

      const queryString = buildQueryParams(1);
      const url = `/teacher/academics/study-materials${queryString}`;

      try {
        const response = await apiClient.get<any>(url);
        const raw = response?.data?.data ?? response?.data;
        const dataList = Array.isArray(raw?.study_materials)
          ? raw.study_materials
          : Array.isArray(raw)
          ? raw
          : [];

        setStudyMaterials(dataList);
        setHasMore(dataList.length >= 10);
        if (dataList.length === 0 && response?.data?.success === false) {
          setError(response?.data?.message || "Failed to load study materials");
        }
      } catch (e: any) {
        console.warn("fetchStudyMaterials error:", e?.message);
        setError(e?.message || "Failed to load study materials");
        setStudyMaterials([]);
        setHasMore(false);
      } finally {
        setIsLoadingMaterials(false);
        setRefreshing(false);
      }
    },
    [buildQueryParams],
  );

  // 7. Infinite Scroll Load More function
  const loadMoreStudyMaterials = useCallback(async () => {
    if (loadingMore || !hasMore || isLoadingMaterials || studyMaterials.length === 0) {
      return;
    }

    setLoadingMore(true);
    const nextPage = Math.floor(studyMaterials.length / 10) + 1;
    const queryString = buildQueryParams(nextPage);
    const url = `/teacher/academics/study-materials${queryString}`;

    try {
      const response = await apiClient.get<any>(url);
      const raw = response?.data?.data ?? response?.data;
      const dataList = Array.isArray(raw?.study_materials)
        ? raw.study_materials
        : Array.isArray(raw)
        ? raw
        : [];

      if (dataList.length > 0) {
        setStudyMaterials((prev) => [...prev, ...dataList]);
        setHasMore(dataList.length >= 10);
      } else {
        setHasMore(false);
      }
    } catch (e: any) {
      console.warn("loadMoreStudyMaterials error:", e?.message);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [
    loadingMore,
    hasMore,
    isLoadingMaterials,
    studyMaterials,
    buildQueryParams,
  ]);

  // 8. Fetch Detailed Study Material information
  const fetchMaterialDetails = useCallback(
    async (materialId: string, initialItem?: StudyMaterialItem) => {
      if (!materialId) return;

      setSelectedMaterialDetails(initialItem || null);
      setIsLoadingDetails(true);
      detailsSheetRef.current?.present();

      try {
        const response = await apiClient.get<any>(`/teacher/academics/study-materials/${materialId}`);
        const raw = response?.data?.data ?? response?.data;
        if (raw && typeof raw === "object") {
          setSelectedMaterialDetails((prev) => ({
            ...(prev || {}),
            ...raw,
          }));
        }
      } catch (e: any) {
        console.warn("fetchMaterialDetails error:", e?.message);
      } finally {
        setIsLoadingDetails(false);
      }
    },
    [],
  );

  // 9. Delete Study Material API call
  const executeDeleteMaterial = useCallback(async () => {
    const targetId = deletingMaterialId || selectedMaterialDetails?.id;
    if (!targetId) return;

    setIsDeleting(true);
    try {
      const resData: any = await apiClient.delete(`/teacher/academics/study-materials/${targetId}`);

      const isSuccess =
        resData?.data?.success === true ||
        resData?.data?.status === true ||
        resData?.status === 200 ||
        resData?.status === 204 ||
        resData?.success === true ||
        resData?.status === true;

      if (isSuccess) {
        Toast.show({
          type: "success",
          text1: "Success",
          text2: resData?.data?.message || resData?.message || "Study material deleted successfully",
        });
        detailsSheetRef.current?.dismiss();
        fetchStudyMaterials();
      } else {
        Toast.show({
          type: "error",
          text1: "Delete Failed",
          text2: resData?.data?.message || resData?.message || "Could not delete study material.",
        });
      }
    } catch (e: any) {
      console.warn("executeDeleteMaterial error:", e?.message);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e?.message || "Failed to delete study material.",
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirmModal(false);
      setDeletingMaterialId(null);
    }
  }, [deletingMaterialId, selectedMaterialDetails?.id, fetchStudyMaterials]);

  // Prompt delete confirmation modal
  const handleDeleteConfirmPrompt = (materialId: string) => {
    setDeletingMaterialId(materialId);
    setShowDeleteConfirmModal(true);
  };

  // Dummy Edit handler
  const handleEditMaterial = () => {
    Toast.show({
      type: "info",
      text1: "Edit Study Material",
      text2: "Edit feature coming soon",
    });
  };

  // Initial Load of Initial Filters
  useEffect(() => {
    if (token) {
      fetchAcademicYears();
      fetchMaterialTypes();
      fetchClasses();
    }
  }, [token, fetchAcademicYears, fetchMaterialTypes, fetchClasses]);

  // When class selection changes, fetch sections & subjects, and reset dependent selections
  const handleClassSelect = (item: any) => {
    const classId = item.class_id || item.id;
    if (classId !== selectedClass) {
      setSelectedClass(classId);
      setSelectedSection("all");
      setSelectedSubject("all");
      if (classId && classId !== "all") {
        fetchSections(classId);
        fetchSubjects(classId);
      } else {
        setSections([]);
        setSubjects([]);
      }
    }
  };

  // Fetch Study Materials whenever filters change
  useEffect(() => {
    if (token) {
      fetchStudyMaterials();
    }
  }, [token, fetchStudyMaterials]);

  // Auto-refresh study materials and material types on focus (e.g. returning from Add/Edit or Material Types)
  useFocusEffect(
    useCallback(() => {
      if (token) {
        fetchMaterialTypes();
        fetchStudyMaterials(true);
      }
    }, [token, fetchMaterialTypes, fetchStudyMaterials])
  );

  // Pull to refresh handler
  const handleRefresh = () => {
    setRefreshing(true);
    fetchStudyMaterials(true);
  };

  // Reset all 6 filters to default "all"
  const handleResetFilters = () => {
    setSelectedAcademicYear("all");
    setSelectedMaterialType("all");
    setSelectedClass("all");
    setSelectedSection("all");
    setSelectedSubject("all");
    setSelectedStatus("all");
    setSections([]);
    setSubjects([]);
  };

  // Count active filters (not equal to 'all')
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedAcademicYear !== "all") count++;
    if (selectedMaterialType !== "all") count++;
    if (selectedClass !== "all") count++;
    if (selectedSection !== "all") count++;
    if (selectedSubject !== "all") count++;
    if (selectedStatus !== "all") count++;
    return count;
  }, [
    selectedAcademicYear,
    selectedMaterialType,
    selectedClass,
    selectedSection,
    selectedSubject,
    selectedStatus,
  ]);

  // Display label helpers for filter trigger buttons
  const getAcademicYearLabel = () => {
    if (selectedAcademicYear === "all") return "Academic Year";
    const found = academicYears.find((y) => String(y.id) === String(selectedAcademicYear));
    return found ? found.academic_year : "Academic Year";
  };

  const getMaterialTypeLabel = () => {
    if (selectedMaterialType === "all") return "Material Type";
    const found = materialTypes.find((m) => String(m.id) === String(selectedMaterialType));
    return found ? found.material_type_name : "Material Type";
  };

  const getClassLabel = () => {
    if (selectedClass === "all") return "Class";
    const found = classes.find((c) => String(c.class_id || c.id) === String(selectedClass));
    return found ? `Class ${found.class_name}` : "Class";
  };

  const getSectionLabel = () => {
    if (selectedSection === "all") return "Section";
    const found = sections.find((s) => String(s.id) === String(selectedSection));
    return found ? `Sec ${found.section_name}` : "Section";
  };

  const getSubjectLabel = () => {
    if (selectedSubject === "all") return "Subject";
    const found = subjects.find((sb) => String(sb.id) === String(selectedSubject));
    return found ? found.subject_name : "Subject";
  };

  const getStatusLabel = () => {
    if (selectedStatus === "all") return "Status";
    const found = statusOptions.find((s) => String(s.id) === String(selectedStatus));
    return found ? found.name : "Status";
  };

  // Helper to format attachment relative path to absolute URL
  const getFullAttachmentUrl = (path?: string) => {
    if (!path) return null;
    return getFileUrl(path);
  };

  // Helper to format attachment file size
  const formatFileSize = (sizeStr?: string | number) => {
    if (!sizeStr) return "";
    const bytes = typeof sizeStr === "string" ? parseInt(sizeStr, 10) : sizeStr;
    if (isNaN(bytes) || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // BottomSheet datasets with "All" option prepended
  const academicYearsWithAll = useMemo(
    () => [{ id: "all", academic_year: "All Academic Years" }, ...academicYears],
    [academicYears],
  );

  const materialTypesWithAll = useMemo(
    () => [{ id: "all", material_type_name: "All Material Types" }, ...materialTypes],
    [materialTypes],
  );

  const classesWithAll = useMemo(
    () => [{ id: "all", class_name: "All Classes", class_id: "all" }, ...classes],
    [classes],
  );

  const sectionsWithAll = useMemo(
    () => [{ id: "all", section_name: "All Sections" }, ...sections],
    [sections],
  );

  const subjectsWithAll = useMemo(
    () => [{ id: "all", subject_name: "All Subjects" }, ...subjects],
    [subjects],
  );

  // Render Backdrop for Details BottomSheet
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  // Render individual Study Material Item Card (Without Eye Icon)
  const renderStudyMaterialCard = ({ item }: { item: StudyMaterialItem }) => {
    const title = item.title || item.material_name || item.name || "Untitled Material";
    const description = item.description || item.details || "";
    const chapter = item.chapter || "";
    const materialType = item.material_type_name;
    const className = item.class_name;
    const sectionName = item.section_name;
    const subjectName = item.subject_name;
    const academicYear = item.academic_year;
    const uploadedByName = item.uploaded_by_name;
    const uploaderType = item.uploader_type;
    const publishDate = item.publish_date;
    const isActive = String(item.status) === "1";

    return (
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
        onPress={() => fetchMaterialDetails(String(item.id), item)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
            {materialType ? (
              <View style={[styles.badge, { backgroundColor: colors.primary + "15" }]}>
                <Text style={[styles.badgeText, { color: colors.primary }]}>{materialType}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.headerRightGroup}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isActive ? "#10B98115" : "#EF444415" },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isActive ? "#10B981" : "#EF4444" },
                ]}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: isActive ? "#10B981" : "#EF4444" },
                ]}
              >
                {isActive ? "Active" : "Inactive"}
              </Text>
            </View>
          </View>
        </View>

        {chapter ? (
          <View style={styles.chapterRow}>
            <Ionicons name="bookmark-outline" size={14} color={colors.primary} />
            <Text style={[styles.chapterText, { color: colors.primary }]}>{chapter}</Text>
          </View>
        ) : null}

        {description ? (
          <Text
            style={[styles.cardDescription, { color: colors.textMuted }]}
            numberOfLines={2}
          >
            {description}
          </Text>
        ) : null}

        <View style={styles.tagsContainer}>
          {className ? (
            <View style={[styles.tag, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="school-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.tagText, { color: colors.text }]}>
                Class {className} {sectionName ? `(${sectionName})` : ""}
              </Text>
            </View>
          ) : null}

          {subjectName ? (
            <View style={[styles.tag, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="book-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.tagText, { color: colors.text }]}>{subjectName}</Text>
            </View>
          ) : null}

          {academicYear ? (
            <View style={[styles.tag, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.tagText, { color: colors.text }]}>{academicYear}</Text>
            </View>
          ) : null}
        </View>

        {uploadedByName || publishDate ? (
          <View style={[styles.metaFooter, { marginBottom: 0 }]}>
            {uploadedByName ? (
              <View style={styles.metaItem}>
                <Ionicons name="person-outline" size={13} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>
                  {uploadedByName} {uploaderType ? `(${uploaderType})` : ""}
                </Text>
              </View>
            ) : null}
            {publishDate ? (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                <Text style={[styles.metaText, { color: colors.textMuted }]}>{publishDate}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  // Footer loader component for infinite scrolling
  const renderListFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.footerLoaderText, { color: colors.textMuted }]}>
          Loading more...
        </Text>
      </View>
    );
  };

  // Details Modal Content Renderer
  const renderDetailsContent = () => {
    if (isLoadingDetails && !selectedMaterialDetails) {
      return (
        <View style={styles.detailsLoadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Fetching study material details...
          </Text>
        </View>
      );
    }

    if (!selectedMaterialDetails) {
      return (
        <View style={styles.detailsEmptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Unable to load details.
          </Text>
        </View>
      );
    }

    const d = selectedMaterialDetails;
    const title = d.title || d.material_name || d.name || "Study Material Details";
    const description = d.description || d.details || "No description provided.";
    const chapter = d.chapter || "";
    const materialType = d.material_type_name;
    const className = d.class_name;
    const sectionName = d.section_name;
    const subjectName = d.subject_name;
    const academicYear = d.academic_year;
    const uploadedByName = d.uploaded_by_name;
    const uploaderType = d.uploader_type;
    const publishDate = d.publish_date;
    const expiryDate = d.expiry_date;
    const createdAt = d.created_at;
    const updatedAt = d.updated_at;
    const isActive = String(d.status) === "1";

    const rawAttachment = d.attachment || d.file || d.file_path || d.document;
    const attachmentUrl = getFullAttachmentUrl(rawAttachment);
    const attachmentName = d.attachment_original_name || (rawAttachment ? rawAttachment.split("/").pop() : "Attachment");
    const formattedSize = formatFileSize(d.attachment_size);
    const ext = (d.attachment_extension || (attachmentName ? attachmentName.split(".").pop() : "") || "").toUpperCase();

    return (
      <BottomSheetScrollView contentContainerStyle={styles.detailsScrollContent}>
        {/* Title Header */}
        <View style={styles.detailsHeaderRow}>
          <Text style={[styles.detailsTitle, { color: colors.text }]}>{title}</Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: isActive ? "#10B98115" : "#EF444415" },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isActive ? "#10B981" : "#EF4444" },
              ]}
            />
            <Text
              style={[
                styles.statusBadgeText,
                { color: isActive ? "#10B981" : "#EF4444" },
              ]}
            >
              {isActive ? "Active" : "Inactive"}
            </Text>
          </View>
        </View>

        {/* Badges Row */}
        <View style={styles.detailsBadgesRow}>
          {materialType ? (
            <View style={[styles.badge, { backgroundColor: colors.primary + "15" }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>{materialType}</Text>
            </View>
          ) : null}
          {chapter ? (
            <View style={[styles.chapterRow, { marginTop: 0 }]}>
              <Ionicons name="bookmark-outline" size={14} color={colors.primary} />
              <Text style={[styles.chapterText, { color: colors.primary }]}>{chapter}</Text>
            </View>
          ) : null}
        </View>

        {/* Description Section */}
        <View style={[styles.detailsSectionBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Description</Text>
          <Text style={[styles.sectionBodyText, { color: colors.textMuted }]}>
            {description}
          </Text>
        </View>

        {/* Info Grid */}
        <View style={[styles.detailsSectionBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
          <Text style={[styles.sectionHeading, { color: colors.text, marginBottom: 12 }]}>Material Details</Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Class & Section</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {className ? `Class ${className}` : "N/A"} {sectionName ? `(${sectionName})` : ""}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Subject</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{subjectName || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Academic Year</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{academicYear || "N/A"}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Uploaded By</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {uploadedByName || "N/A"} {uploaderType ? `(${uploaderType})` : ""}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Publish Date</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{publishDate || "N/A"}</Text>
          </View>

          {expiryDate ? (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Expiry Date</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{expiryDate}</Text>
            </View>
          ) : null}

          {createdAt ? (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Created At</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{createdAt}</Text>
            </View>
          ) : null}

          {updatedAt ? (
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Updated At</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{updatedAt}</Text>
            </View>
          ) : null}
        </View>

        {/* Attachment Card Button */}
        {attachmentUrl ? (
          <View style={[styles.attachmentBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.attachmentLeft}>
              <View style={[styles.extIconBg, { backgroundColor: colors.primary + "15" }]}>
                <Text style={[styles.extIconText, { color: colors.primary }]}>{ext || "FILE"}</Text>
              </View>
              <View style={styles.attachmentTextCol}>
                <Text style={[styles.attachmentName, { color: colors.text }]} numberOfLines={1}>
                  {attachmentName}
                </Text>
                {formattedSize ? (
                  <Text style={[styles.attachmentMeta, { color: colors.textMuted }]}>
                    {formattedSize}
                  </Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity
              style={[styles.downloadActionButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                Linking.openURL(attachmentUrl).catch((err) =>
                  console.warn("Could not open URL:", err),
                );
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="cloud-download-outline" size={18} color="#FFFFFF" />
              <Text style={styles.downloadActionText}>Download</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Action Buttons: Edit (Dummy) & Delete */}
        <View style={styles.detailsActionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton, { borderColor: colors.primary }]}
            onPress={handleEditMaterial}
            activeOpacity={0.75}
          >
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionButtonText, { color: colors.primary }]}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteConfirmPrompt(String(d.id))}
            activeOpacity={0.75}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
                <Text style={[styles.actionButtonText, { color: "#FFFFFF" }]}>Delete</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    );
  };

  const headerRightActions = (
    <View style={styles.headerActionsRow}>
      <TouchableOpacity
        style={[
          styles.headerIconButton,
          { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" },
        ]}
        onPress={handleNavigateToMaterialTypes}
        activeOpacity={0.7}
      >
        <Ionicons name="layers-outline" size={16} color={colors.primary} />
        <Text style={[styles.headerIconBtnText, { color: colors.primary }]}>Types</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.headerAddBtn, { backgroundColor: colors.primary }]}
        onPress={handleNavigateToAddMaterial}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={16} color="#FFFFFF" />
        <Text style={styles.headerAddBtnText}>Add</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Study Material" rightAction={headerRightActions} />

      {/* Collapsible Filter Section */}
      <View style={[styles.filterSection, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={styles.filterSectionHeader}
          onPress={() => setIsFilterExpanded(!isFilterExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.filterTitleRow}>
            <Ionicons name="funnel-outline" size={18} color={colors.primary} />
            <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Filters</Text>
            {activeFilterCount > 0 && (
              <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.activeBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </View>

          <View style={styles.headerRightActions}>
            {activeFilterCount > 0 && (
              <TouchableOpacity onPress={handleResetFilters} activeOpacity={0.7} style={{ marginRight: 12 }}>
                <Text style={[styles.resetText, { color: colors.primary }]}>Reset All</Text>
              </TouchableOpacity>
            )}
            <Ionicons
              name={isFilterExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={colors.textMuted}
            />
          </View>
        </TouchableOpacity>

        {/* Collapsible Non-Scrollable 2-Column Grid Layout */}
        {isFilterExpanded && (
          <View style={styles.filterGridContainer}>
            {/* 1. Academic Year Filter */}
            <TouchableOpacity
              style={[
                styles.gridFilterChip,
                {
                  backgroundColor: selectedAcademicYear !== "all" ? colors.primary + "15" : colors.surfaceSubtle,
                  borderColor: selectedAcademicYear !== "all" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => academicYearSheetRef.current?.present()}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedAcademicYear !== "all" ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
              >
                {getAcademicYearLabel()}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={selectedAcademicYear !== "all" ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>

            {/* 2. Material Type Filter */}
            <TouchableOpacity
              style={[
                styles.gridFilterChip,
                {
                  backgroundColor: selectedMaterialType !== "all" ? colors.primary + "15" : colors.surfaceSubtle,
                  borderColor: selectedMaterialType !== "all" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => materialTypeSheetRef.current?.present()}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedMaterialType !== "all" ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
              >
                {getMaterialTypeLabel()}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={selectedMaterialType !== "all" ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>

            {/* 3. Class Filter */}
            <TouchableOpacity
              style={[
                styles.gridFilterChip,
                {
                  backgroundColor: selectedClass !== "all" ? colors.primary + "15" : colors.surfaceSubtle,
                  borderColor: selectedClass !== "all" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => classSheetRef.current?.present()}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedClass !== "all" ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
              >
                {getClassLabel()}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={selectedClass !== "all" ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>

            {/* 4. Section Filter */}
            <TouchableOpacity
              style={[
                styles.gridFilterChip,
                {
                  backgroundColor: selectedSection !== "all" ? colors.primary + "15" : colors.surfaceSubtle,
                  borderColor: selectedSection !== "all" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => sectionSheetRef.current?.present()}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedSection !== "all" ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
              >
                {getSectionLabel()}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={selectedSection !== "all" ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>

            {/* 5. Subject Filter */}
            <TouchableOpacity
              style={[
                styles.gridFilterChip,
                {
                  backgroundColor: selectedSubject !== "all" ? colors.primary + "15" : colors.surfaceSubtle,
                  borderColor: selectedSubject !== "all" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => subjectSheetRef.current?.present()}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedSubject !== "all" ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
              >
                {getSubjectLabel()}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={selectedSubject !== "all" ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>

            {/* 6. Status Filter */}
            <TouchableOpacity
              style={[
                styles.gridFilterChip,
                {
                  backgroundColor: selectedStatus !== "all" ? colors.primary + "15" : colors.surfaceSubtle,
                  borderColor: selectedStatus !== "all" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => statusSheetRef.current?.present()}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: selectedStatus !== "all" ? colors.primary : colors.text },
                ]}
                numberOfLines={1}
              >
                {getStatusLabel()}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={selectedStatus !== "all" ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Study Materials List View with Infinite Scroll */}
      {isLoadingMaterials ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading study materials...
          </Text>
        </View>
      ) : studyMaterials.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="document-text-outline" size={60} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Study Materials Found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {error || "Try adjusting your filter selection."}
          </Text>
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={handleResetFilters}
            >
              <Text style={styles.retryButtonText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={studyMaterials}
          keyExtractor={(item, index) => String(item.id || index)}
          renderItem={renderStudyMaterialCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 20 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={loadMoreStudyMaterials}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderListFooter}
        />
      )}

      {/* Details BottomSheet Modal */}
      <BottomSheetModal
        ref={detailsSheetRef}
        index={0}
        snapPoints={["68%", "92%"]}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={[styles.handleIndicator, { backgroundColor: colors.border }]}
        enablePanDownToClose
      >
        <View style={styles.detailsModalContainer}>
          <View style={[styles.detailsModalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>
              Study Material Details
            </Text>
            <TouchableOpacity
              onPress={() => detailsSheetRef.current?.dismiss()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {renderDetailsContent()}
        </View>
      </BottomSheetModal>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.deleteIconBg, { backgroundColor: "#EF444415" }]}>
              <Ionicons name="trash-outline" size={28} color="#EF4444" />
            </View>
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Delete Study Material?</Text>
            <Text style={[styles.confirmSubTitle, { color: colors.textMuted }]}>
              Are you sure you want to delete this study material? This action cannot be undone.
            </Text>

            <View style={styles.confirmButtonRow}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelConfirmBtn, { borderColor: colors.border }]}
                onPress={() => setShowDeleteConfirmModal(false)}
                activeOpacity={0.7}
                disabled={isDeleting}
              >
                <Text style={[styles.confirmBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, styles.deleteConfirmBtn, { backgroundColor: "#EF4444" }]}
                onPress={executeDeleteMaterial}
                activeOpacity={0.7}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={[styles.confirmBtnText, { color: "#FFFFFF" }]}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* BottomSheet 1: Academic Year */}
      <SelectionBottomSheet
        ref={academicYearSheetRef} //56.00
        title="Select Academic Year"
        data={academicYearsWithAll}
        selectedId={selectedAcademicYear}
        onSelect={(item) => setSelectedAcademicYear(String(item.id))}
        labelExtractor={(item) =>
          item.id === "all" ? "All Academic Years" : item.academic_year
        }
        isLoading={isLoadingYears}
        showSearch
      />

      {/* BottomSheet 2: Material Type */}
      <SelectionBottomSheet
        ref={materialTypeSheetRef}
        title="Select Material Type"
        data={materialTypesWithAll}
        selectedId={selectedMaterialType}
        onSelect={(item) => setSelectedMaterialType(String(item.id))}
        labelExtractor={(item) =>
          item.id === "all" ? "All Material Types" : item.material_type_name
        }
        isLoading={isLoadingTypes}
        showSearch
      />

      {/* BottomSheet 3: Class */}
      <SelectionBottomSheet
        ref={classSheetRef}
        title="Select Class"
        data={classesWithAll}
        selectedId={selectedClass}
        onSelect={handleClassSelect}
        labelExtractor={(item) =>
          item.id === "all" ? "All Classes" : `Class ${item.class_name}`
        }
        isLoading={isLoadingClasses}
        showSearch
      />

      {/* BottomSheet 4: Section */}
      <SelectionBottomSheet
        ref={sectionSheetRef}
        title="Select Section"
        data={sectionsWithAll}
        selectedId={selectedSection}
        onSelect={(item) => setSelectedSection(String(item.id))}
        labelExtractor={(item) =>
          item.id === "all" ? "All Sections" : `Section ${item.section_name}`
        }
        isLoading={isLoadingSections}
        showSearch
      />

      {/* BottomSheet 5: Subject */}
      <SelectionBottomSheet
        ref={subjectSheetRef}
        title="Select Subject"
        data={subjectsWithAll}
        selectedId={selectedSubject}
        onSelect={(item) => setSelectedSubject(String(item.id))}
        labelExtractor={(item) =>
          item.id === "all" ? "All Subjects" : item.subject_name
        }
        isLoading={isLoadingSubjects}
        showSearch
      />

      {/* BottomSheet 6: Status */}
      <SelectionBottomSheet
        ref={statusSheetRef}
        title="Select Status"
        data={statusOptions}
        selectedId={selectedStatus}
        onSelect={(item) => setSelectedStatus(String(item.id))}
        labelExtractor={(item) => item.name}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  handleIndicator: {
    width: 44,
    height: 4,
    borderRadius: 2,
    marginTop: 6,
  },
  filterSection: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  filterSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  filterTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  filterSectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  activeBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  activeBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  resetText: {
    fontSize: 13,
    fontWeight: "600",
  },
  filterGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  gridFilterChip: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    marginRight: 4,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  titleContainer: {
    flex: 1,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  headerRightGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  chapterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  chapterText: {
    fontSize: 13,
    fontWeight: "600",
  },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "500",
  },
  metaFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 13,
  },

  // Details Modal Styles
  detailsModalContainer: {
    flex: 1,
  },
  detailsModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  detailsLoadingContainer: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsEmptyContainer: {
    padding: 40,
    alignItems: "center",
  },
  detailsScrollContent: {
    padding: 20,
    gap: 16,
  },
  detailsHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: "700",
    flex: 1,
    marginRight: 10,
    lineHeight: 24,
  },
  detailsBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
  },
  detailsSectionBox: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  sectionBodyText: {
    fontSize: 13,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(150, 150, 150, 0.2)",
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    maxWidth: "55%",
    textAlign: "right",
  },
  attachmentBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  attachmentLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  extIconBg: {
    width: 42,
    height: 42,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  extIconText: {
    fontSize: 11,
    fontWeight: "800",
  },
  attachmentTextCol: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 13,
    fontWeight: "600",
  },
  attachmentMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  downloadActionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  downloadActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  detailsActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  editButton: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  deleteButton: {
    backgroundColor: "#EF4444",
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Confirm Modal Overlay
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  confirmCard: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  deleteIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  confirmSubTitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelConfirmBtn: {
    borderWidth: 1,
  },
  deleteConfirmBtn: {
    elevation: 2,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  headerActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  headerIconBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  headerAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 2,
  },
  headerAddBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
