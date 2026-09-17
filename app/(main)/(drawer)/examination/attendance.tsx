import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  ScrollView,
  Platform,
} from "react-native";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter, useFocusEffect } from "expo-router";
import InternalHeader from "@/components/InternalHeader";
import SelectionBottomSheet from "@/components/common/SelectionBottomSheet";
import apiClient from "@/services/apiClient";
import { fetchClasses, fetchSections } from "@/redux/features/students/thunks";
import { useAppTheme } from "@/constants/theme";

// Helper to parse subject attendance values
const getStatusInfo = (status: string | undefined | null, isDark: boolean = false) => {
  if (status === undefined || status === null || String(status).trim() === "") {
    return {
      label: "N/A",
      color: isDark ? "#6B7280" : "#9CA3AF",
      bg: isDark ? "#1C2230" : "#F1F4F9",
    };
  }
  const val = String(status || "").trim().toLowerCase();
  if (val === "1" || val === "p" || val === "present") {
    return {
      label: "Present",
      color: "#10B981",
      bg: isDark ? "#064E3B" : "#ECFDF5",
    };
  }
  if (val === "0" || val === "2" || val === "a" || val === "absent") {
    return {
      label: "Absent",
      color: "#EF4444",
      bg: isDark ? "#7F1D1D" : "#FEE2E2",
    };
  }
  if (val === "3" || val === "l" || val === "leave") {
    return {
      label: "Leave",
      color: "#F59E0B",
      bg: isDark ? "#78350F" : "#FEF3C7",
    };
  }
  return {
    label: "N/A",
    color: isDark ? "#6B7280" : "#9CA3AF",
    bg: isDark ? "#1C2230" : "#F1F4F9",
  };
};

interface ExamItem {
  id: string | number;
  academic_year: string | number;
  school_id: string | number;
  exam: string;
  status: string;
  created_on?: string;
}

interface AttendanceItem {
  id: string | number;
  first_name: string;
  last_name: string;
  roll_number: string;
  admission_number: string;
  subjects: Record<string, string>;
}

export default function ExamAttendanceScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const { colors, isDark } = useAppTheme();
  const { classes, sections, isLoadingClasses, isLoadingSections } =
    useAppSelector((state) => state.students);
  const dispatch = useAppDispatch();
  const router = useRouter();

  // Filter state variables
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedExam, setSelectedExam] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSection, setSelectedSection] = useState("all");
  const [apiSubjects, setApiSubjects] = useState<string[]>([]);

  // Loading states
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Main data and search
  const [attendance, setAttendance] = useState<AttendanceItem[]>([]);
  const [localSearch, setLocalSearch] = useState("");

  // Pagination states
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const totalPagesRef = useRef(1);

  // Refs for bottom sheets
  const examBottomSheetRef = useRef<BottomSheetModal>(null);
  const classBottomSheetRef = useRef<BottomSheetModal>(null);
  const sectionBottomSheetRef = useRef<BottomSheetModal>(null);

  // Ref to track initial loading of defaults
  const isFirstLoad = useRef(true);

  // 1. Fetch classes if list is empty
  useEffect(() => {
    if (classes.length === 0) {
      dispatch(fetchClasses());
    }
  }, [classes, dispatch]);

  // 2. Set default class on initial load
  useEffect(() => {
    if (classes.length > 0 && !selectedClass && isFirstLoad.current) {
      const activeClasses = classes.filter(
        (c) => c.status === undefined || String(c.status) === "1",
      );
      const defaultClass = activeClasses[0] || classes[0];
      if (defaultClass) {
        setSelectedClass(String(defaultClass.id));
      }
    }
  }, [classes, selectedClass]);

  // 3. Load sections when selected class changes (internal side-effect)
  useEffect(() => {
    if (selectedClass) {
      dispatch(fetchSections(selectedClass));
    }
  }, [selectedClass, dispatch]);

  // 4. Set default section when sections load on initial load
  useEffect(() => {
    if (sections.length > 0 && (!selectedSection || selectedSection === "") && isFirstLoad.current) {
      setSelectedSection("all");
    }
  }, [sections, selectedSection]);

  // 5. Fetch Exams list from API
  const fetchExams = useCallback(async () => {
    setIsLoadingExams(true);
    try {
      const res = await apiClient.get('/admin/examinations/exams');
      const resData = res.data;
      const examsList =
        resData?.data?.exams ||
        resData?.exams ||
        (Array.isArray(resData?.data) ? resData.data : null) ||
        (Array.isArray(resData) ? resData : null) ||
        [];
      if (Array.isArray(examsList)) {
        const normalized: ExamItem[] = examsList.map((e: any) => ({
          ...e,
          id: String(e.id),
          exam: e.exam_name || e.exam || 'Exam',
          academic_year: e.academic_year || '',
          school_id: e.school_id || '',
          status: String(e.status ?? '1'),
        }));
        setExams(normalized);
      } else {
        setExams([]);
      }
    } catch (e: any) {
      console.warn("fetchExams exception:", e.message);
    } finally {
      setIsLoadingExams(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchExams();
    }
  }, [token, fetchExams]);

  // Set default exam on initial load
  useEffect(() => {
    if (exams.length > 0 && !selectedExam && isFirstLoad.current) {
      const activeExams = exams.filter(
        (e) => e.status === undefined || String(e.status) === "1",
      );
      const defaultExam = activeExams[0] || exams[0];
      if (defaultExam) {
        setSelectedExam(String(defaultExam.id));
      }
    }
  }, [exams, selectedExam]);

  // Disable initial load auto-selection once class and exam filters are loaded
  useEffect(() => {
    if (selectedClass && selectedExam) {
      isFirstLoad.current = false;
    }
  }, [selectedClass, selectedExam]);

  // 6. Fetch Exam Attendance list
  const fetchExamAttendance = useCallback(
    async (isSilent = false) => {
      if (!selectedExam || !selectedClass) {
        return;
      }

      if (!isSilent) {
        setIsLoadingAttendance(true);
      }
      setError(null);
      setHasMore(true);

      try {
        const queryParams: any = {
          exam_id: selectedExam,
          class_id: selectedClass,
          page: 1,
          limit: 20,
        };
        if (selectedSection && selectedSection !== "all") {
          queryParams.section_id = selectedSection;
        }

        const res = await apiClient.get('/admin/examinations/attendance', {
          params: queryParams,
        });

        const rawData = res.data?.data || res.data || {};
        const studentsList = rawData.students || [];
        const subjectsList = rawData.subjects || [];
        const totalPages = rawData.totalPages || 1;

        if (Array.isArray(subjectsList)) {
          const subNames = subjectsList.map((s: any) => s.subject_name || `Subject #${s.subject_id}`);
          setApiSubjects(subNames);
        }

        if (Array.isArray(studentsList) && studentsList.length > 0) {
          const mapped: AttendanceItem[] = studentsList.map((st: any) => {
            const subjectsMap: Record<string, string> = {};
            if (st.subjectAttendance) {
              Object.entries(st.subjectAttendance).forEach(([subId, statusVal]) => {
                const foundSub = subjectsList.find(
                  (s: any) => String(s.subject_id) === String(subId),
                );
                const subName = foundSub?.subject_name || `Sub ${subId}`;
                subjectsMap[subName] = String(statusVal);
              });
            } else if (st.subjects) {
              Object.assign(subjectsMap, st.subjects);
            }
            return {
              id: st.student_id || st.id,
              first_name: st.first_name || '',
              last_name: st.last_name || '',
              roll_number: String(st.roll_no || st.roll_number || ''),
              admission_number: String(st.admission_no || st.admission_number || ''),
              subjects: subjectsMap,
            };
          });

          setAttendance(mapped);
          pageRef.current = 1;
          totalPagesRef.current = totalPages;
          setHasMore(1 < totalPages);
        } else {
          setAttendance([]);
          setHasMore(false);
        }
      } catch (e: any) {
        console.warn("fetchExamAttendance exception:", e.message);
        setError(
          e.message || "An error occurred while fetching exam attendance.",
        );
        setHasMore(false);
      } finally {
        setIsLoadingAttendance(false);
      }
    },
    [selectedExam, selectedClass, selectedSection],
  );

  // Auto fetch attendance when exam and class are selected
  useEffect(() => {
    if (selectedExam && selectedClass) {
      fetchExamAttendance();
    }
  }, [selectedExam, selectedClass, selectedSection, fetchExamAttendance]);

  // Auto-refresh exam attendance on focus
  useFocusEffect(
    useCallback(() => {
      if (selectedExam && selectedClass) {
        fetchExamAttendance(attendance.length > 0);
      }
    }, [selectedExam, selectedClass, selectedSection, fetchExamAttendance, attendance.length])
  );

  // 7. Pull to Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedExam && selectedClass) {
      await fetchExamAttendance(true);
    } else {
      await fetchExams();
    }
    setRefreshing(false);
  }, [
    selectedExam,
    selectedClass,
    selectedSection,
    fetchExamAttendance,
    fetchExams,
  ]);

  // 8. Pagination load more handler
  const loadMoreAttendance = useCallback(async () => {
    if (
      loadingMore ||
      !hasMore ||
      attendance.length === 0 ||
      localSearch !== ""
    ) {
      return;
    }

    const nextPage = pageRef.current + 1;
    if (nextPage > totalPagesRef.current) {
      setHasMore(false);
      return;
    }

    setLoadingMore(true);

    try {
      const queryParams: any = {
        exam_id: selectedExam,
        class_id: selectedClass,
        page: nextPage,
        limit: 20,
      };
      if (selectedSection && selectedSection !== "all") {
        queryParams.section_id = selectedSection;
      }

      const res = await apiClient.get('/admin/examinations/attendance', {
        params: queryParams,
      });

      const rawData = res.data?.data || res.data || {};
      const newStudents = rawData.students || [];
      const subjectsList = rawData.subjects || [];
      const totalPages = rawData.totalPages || 1;
      totalPagesRef.current = totalPages;

      if (Array.isArray(newStudents) && newStudents.length > 0) {
        const mapped: AttendanceItem[] = newStudents.map((st: any) => {
          const subjectsMap: Record<string, string> = {};
          if (st.subjectAttendance) {
            Object.entries(st.subjectAttendance).forEach(([subId, statusVal]) => {
              const foundSub = subjectsList.find(
                (s: any) => String(s.subject_id) === String(subId),
              );
              const subName = foundSub?.subject_name || `Sub ${subId}`;
              subjectsMap[subName] = String(statusVal);
            });
          } else if (st.subjects) {
            Object.assign(subjectsMap, st.subjects);
          }
          return {
            id: st.student_id || st.id,
            first_name: st.first_name || '',
            last_name: st.last_name || '',
            roll_number: String(st.roll_no || st.roll_number || ''),
            admission_number: String(st.admission_no || st.admission_number || ''),
            subjects: subjectsMap,
          };
        });

        setAttendance((prev) => {
          const existingIds = new Set(prev.map((s) => String(s.id)));
          const filteredNew = mapped.filter((s) => !existingIds.has(String(s.id)));
          return [...prev, ...filteredNew];
        });

        pageRef.current = nextPage;
        if (nextPage >= totalPages) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (e: any) {
      console.warn("loadMoreAttendance exception:", e.message);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [
    selectedExam,
    selectedClass,
    selectedSection,
    attendance,
    loadingMore,
    hasMore,
    localSearch,
  ]);

  // Options formatting for bottom sheets
  const examData = useMemo(() => {
    return exams
      .filter((e) => e.status === undefined || String(e.status) === "1")
      .map((e) => ({
        id: e.id,
        name: e.exam,
      }));
  }, [exams]);

  const classData = useMemo(() => {
    return classes
      .filter((c) => c.status === undefined || String(c.status) === "1")
      .map((c) => ({
        id: c.id,
        name: c.class_name ? `Class ${c.class_name}` : `Class ${c.id}`,
      }));
  }, [classes]);

  const sectionData = useMemo(() => {
    const list = sections
      .filter((s) => s.status === undefined || String(s.status) === "1")
      .map((s) => ({
        id: String(s.id),
        name: `Section ${s.section_name}`,
      }));
    return [{ id: "all", name: "All Sections" }, ...list];
  }, [sections]);

  const selectedExamObj = exams.find(
    (e) => String(e.id) === String(selectedExam),
  );
  const selectedClassObj = classes.find(
    (c) => String(c.id) === String(selectedClass),
  );
  const selectedSectionObj = sectionData.find(
    (s) => String(s.id) === String(selectedSection),
  );

  // Search filter list locally
  const filteredStudents = useMemo(() => {
    if (!localSearch) return attendance;
    const query = localSearch.toLowerCase().trim();
    return attendance.filter((s: AttendanceItem) => {
      const fullName = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
      const rollNum = String(s.roll_number || "").toLowerCase();
      const admNum = String(s.admission_number || "").toLowerCase();
      return (fullName.includes(query) ||rollNum.includes(query) ||admNum.includes(query));
    });
  }, [attendance, localSearch]);

  // Dynamically extract all unique subjects from current students roster and API response
  const uniqueSubjects = useMemo(() => {
    const subjectsSet = new Set<string>(apiSubjects);
    attendance.forEach((student) => {
      if (student.subjects) {
        Object.keys(student.subjects).forEach((sub) => {
          subjectsSet.add(sub);
        });
      }
    });
    return Array.from(subjectsSet).sort();
  }, [attendance, apiSubjects]);

  // Render individual table row for a student
  const renderTableRow = ({ item, index }: { item: AttendanceItem; index: number }) => {
    const isEven = index % 2 === 0;
    const rowBg = isEven ? colors.cardBg : colors.surfaceSubtle;

    return (
      <View
        style={[
          styles.tableRow,
          {
            backgroundColor: rowBg,
            borderBottomColor: colors.border,
          },
        ]}
      >
        {/* Student Column */}
        <View style={styles.studentCell}>
          <Text style={[styles.studentNameText, { color: colors.text }]} numberOfLines={1}>
            {`${item.first_name || ""} ${item.last_name || ""}`.trim()}
          </Text>
          <View style={styles.studentMetaRow}>
            <Text style={[styles.studentMetaText, { color: colors.textMuted }]}>
              Roll: {item.roll_number || "N/A"}
            </Text>
            <Text style={[styles.metaDivider, { color: colors.border }]}>•</Text>
            <Text style={[styles.studentMetaText, { color: colors.textMuted }]}>
              ID: {item.admission_number || "N/A"}
            </Text>
          </View>
        </View>

        {/* Subject columns */}
        {uniqueSubjects.map((sub) => {
          const status = item.subjects ? item.subjects[sub] : undefined;
          const info = getStatusInfo(status, isDark);
          return (
            <View
              key={sub}
              style={[
                styles.subjectCell,
                { borderLeftColor: colors.border },
              ]}
            >
              <View style={[styles.statusCircle, { backgroundColor: info.bg }]}>
                {status !== undefined ? (
                  <Text style={[styles.statusLetter, { color: info.color }]}>
                    {info.label.charAt(0)}
                  </Text>
                ) : (
                  <Text style={[styles.statusLetter, { color: colors.textMuted }]}>-</Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoadingAttendance) return null;

    return (
      <View style={styles.emptyContainer}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: colors.surfaceSubtle },
          ]}
        >
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {!selectedExam || !selectedClass
            ? "Select Filters"
            : "No Records Found"}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          {!selectedExam || !selectedClass
            ? "Please configure the filters above to load the examination attendance sheet."
            : "There are no exam attendance records matching the selected criteria. Tap below to add or mark attendance."}
        </Text>
        <TouchableOpacity
          style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
          onPress={() =>
            router.push({
              pathname: "/(main)/(drawer)/examination/add-attendance" as any,
              params: {
                ...(selectedExam ? { exam_id: selectedExam } : {}),
                ...(selectedClass ? { class_id: selectedClass } : {}),
                ...(selectedSection && selectedSection !== "all"
                  ? { section_id: selectedSection }
                  : {}),
              },
            })
          }
          activeOpacity={0.8}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color="#fff"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.emptyAddBtnText}>Add Attendance</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader
        title="Exam Attendance"
        onBack={() => router.back()}
        rightAction={
          <TouchableOpacity
            style={[styles.headerAddBtn, { backgroundColor: colors.primary }]}
            onPress={() =>
              router.push({
                pathname: "/(main)/(drawer)/examination/add-attendance" as any,
                params: {
                  ...(selectedExam ? { exam_id: selectedExam } : {}),
                  ...(selectedClass ? { class_id: selectedClass } : {}),
                  ...(selectedSection && selectedSection !== "all"
                    ? { section_id: selectedSection }
                    : {}),
                },
              })
            }
            activeOpacity={0.8}
          >
            <Ionicons
              name="add-circle-outline"
              size={16}
              color="#fff"
              style={{ marginRight: 4 }}
            />
            <Text style={styles.headerAddBtnText}>Add</Text>
          </TouchableOpacity>
        }
      />

      {/* Filter Section */}
      <View style={[styles.filterCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        {/* Row 1: Exam Selector */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={styles.filterSelector}
            onPress={() => examBottomSheetRef.current?.present()}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Select Exam</Text>
            <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Text style={[styles.selectorValue, { color: colors.text }]} numberOfLines={1}>
                {selectedExamObj ? selectedExamObj.exam : "Choose Exam"}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Row 2: Class & Section Selector */}
        <View style={[styles.filterRow, { marginTop: 12 }]}>
          <TouchableOpacity
            style={[styles.filterSelector, { marginRight: 8 }]}
            onPress={() => classBottomSheetRef.current?.present()}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Class</Text>
            <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Text style={[styles.selectorValue, { color: colors.text }]} numberOfLines={1}>
                {selectedClassObj
                  ? `Class ${selectedClassObj.class_name || selectedClassObj.id}`
                  : "Choose Class"}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterSelector,
              { marginLeft: 8 },
              !selectedClass && styles.disabledSelector,
            ]}
            onPress={() =>
              selectedClass && sectionBottomSheetRef.current?.present()
            }
            activeOpacity={0.8}
            disabled={!selectedClass}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Section</Text>
            <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Text
                style={[
                  styles.selectorValue,
                  { color: colors.text },
                  !selectedClass && styles.disabledText,
                ]}
                numberOfLines={1}
              >
                {selectedSectionObj
                  ? selectedSectionObj.name
                  : "All Sections"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={selectedClass ? colors.textMuted : colors.border}
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Body content */}
      {isLoadingAttendance && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Fetching Attendance Sheet...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <View
            style={[
              styles.errorIconCircle,
              { backgroundColor: isDark ? "rgba(239, 68, 68, 0.15)" : "#fee2e2" },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          </View>
          <Text style={[styles.errorTitle, { color: isDark ? "#F87171" : "#991b1b" }]}>Failed to Load</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textMuted }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => fetchExamAttendance()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : attendance.length === 0 ? (
        renderEmptyState()
      ) : (
        <View style={{ flex: 1 }}>
          {/* Local Search input */}
          <View style={styles.searchBarContainer}>
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="search-outline"
                size={18}
                color={colors.textMuted}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search student by name, roll, or ID..."
                value={localSearch}
                onChangeText={setLocalSearch}
                placeholderTextColor={colors.textMuted}
              />
              {localSearch !== "" && (
                <TouchableOpacity onPress={() => setLocalSearch("")}>
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Meta & Legend Container */}
          <View style={styles.metaContainer}>
            <View style={styles.summaryBar}>
              <Ionicons name="people-outline" size={16} color={colors.primary} />
              <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                Showing{" "}
                <Text style={[styles.summaryCount, { color: colors.primary }]}>
                  {filteredStudents.length}
                </Text>{" "}
                student(s)
              </Text>
            </View>

            {/* Table Legend */}
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendCircle,
                    { backgroundColor: isDark ? "#064E3B" : "#ECFDF5" },
                  ]}
                >
                  <Text style={[styles.legendLetter, { color: "#10B981" }]}>P</Text>
                </View>
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Present</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendCircle,
                    { backgroundColor: isDark ? "#7F1D1D" : "#FEE2E2" },
                  ]}
                >
                  <Text style={[styles.legendLetter, { color: "#EF4444" }]}>A</Text>
                </View>
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Absent</Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendCircle,
                    { backgroundColor: isDark ? "#78350F" : "#FEF3C7" },
                  ]}
                >
                  <Text style={[styles.legendLetter, { color: "#F59E0B" }]}>L</Text>
                </View>
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>Leave</Text>
              </View>
            </View>
          </View>

          {/* Tabular Attendance View */}
          <View
            style={[
              styles.tableWrapper,
              {
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
              },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={true}
              contentContainerStyle={styles.horizontalScroll}
            >
              <View style={styles.tableContainer}>
                {/* Table Header Row */}
                <View
                  style={[
                    styles.tableHeaderRow,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.headerStudentCell}>
                    <Text style={[styles.headerCellText, { color: colors.text }]}>Student</Text>
                  </View>
                  {uniqueSubjects.map((sub) => (
                    <View
                      key={sub}
                      style={[
                        styles.headerSubjectCell,
                        { borderLeftColor: colors.border },
                      ]}
                    >
                      <Text
                        style={[styles.headerCellText, { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {sub}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Table Body Rows */}
                <FlatList
                  data={filteredStudents}
                  keyExtractor={(item) => String(item.id)}
                  renderItem={renderTableRow}
                  contentContainerStyle={styles.tableBody}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      colors={[colors.primary]}
                      tintColor={colors.primary}
                    />
                  }
                  onEndReached={loadMoreAttendance}
                  onEndReachedThreshold={0.4}
                  ListFooterComponent={
                    loadingMore ? (
                      <View style={styles.footerLoader}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={[styles.footerLoaderText, { color: colors.textMuted }]}>
                          Loading more...
                        </Text>
                      </View>
                    ) : null
                  }
                />
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* Bottom Sheet Selection Modals */}
      <SelectionBottomSheet
        ref={examBottomSheetRef}
        title="Select Exam"
        data={examData}
        onSelect={(item) => {
          setSelectedExam(String(item.id));
          setAttendance([]);
          setHasMore(true);
          setLocalSearch("");
          isFirstLoad.current = false; // Any manual change disables first load defaults
        }}
        loading={isLoadingExams}
      />

      <SelectionBottomSheet
        ref={classBottomSheetRef}
        title="Select Class"
        data={classData}
        onSelect={(item) => {
          setSelectedClass(String(item.id));
          setSelectedSection("all");
          setAttendance([]);
          setHasMore(true);
          setLocalSearch("");
          isFirstLoad.current = false; // Any manual change disables first load defaults
          dispatch(fetchSections(String(item.id)));
        }}
        loading={isLoadingClasses}
      />

      <SelectionBottomSheet
        ref={sectionBottomSheetRef}
        title="Select Section"
        data={sectionData}
        onSelect={(item) => {
          setSelectedSection(String(item.id));
          setAttendance([]);
          setHasMore(true);
          setLocalSearch("");
          isFirstLoad.current = false; // Any manual change disables first load defaults
        }}
        loading={isLoadingSections}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterCard: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  filterRow: {
    flexDirection: "row",
  },
  filterSelector: {
    flex: 1,
  },
  disabledSelector: {
    opacity: 0.65,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectorValueBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  selectorValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  disabledText: {
    opacity: 0.6,
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    height: "100%",
  },
  metaContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    flexWrap: "wrap",
    gap: 8,
  },
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: "500",
  },
  summaryCount: {
    fontWeight: "700",
  },
  legendContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  legendLetter: {
    fontSize: 9,
    fontWeight: "800",
  },
  legendText: {
    fontSize: 11,
    fontWeight: "600",
  },
  tableWrapper: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  horizontalScroll: {
    flexGrow: 1,
  },
  tableContainer: {
    flex: 1,
  },
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    height: 48,
    alignItems: "center",
  },
  headerStudentCell: {
    width: 160,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  headerSubjectCell: {
    width: 90,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
  },
  headerCellText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableBody: {
    flexGrow: 1,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    height: 52,
    alignItems: "center",
  },
  studentCell: {
    width: 160,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  studentNameText: {
    fontSize: 13,
    fontWeight: "700",
  },
  studentMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  studentMetaText: {
    fontSize: 11,
    fontWeight: "500",
  },
  metaDivider: {
    fontSize: 9,
    marginHorizontal: 4,
  },
  subjectCell: {
    width: 90,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    height: "100%",
  },
  statusCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  statusLetter: {
    fontSize: 12,
    fontWeight: "800",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 18,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  footerLoader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 12,
    fontWeight: "500",
  },
  headerAddBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  headerAddBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyAddBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emptyAddBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
