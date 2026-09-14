import InternalHeader from "@/components/InternalHeader";
import SelectionBottomSheet from "@/components/common/SelectionBottomSheet";
import apiClient from "@/services/apiClient";
import { fetchClasses } from "@/redux/features/students/thunks";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useAppTheme } from "@/constants/theme";
import { useFocusEffect } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface ExamItem {
  id: string;
  academic_year: string;
  school_id: string;
  exam: string;
  status: string;
  created_on?: string;
}

interface ExamScheduleItem {
  id: string;
  school_id: string;
  academic_year_id: string;
  exam_id: string;
  class_id: string;
  subject_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_on?: string;
  subject_name: string;
  exam_name?: string;
  class_name?: string;
  academic_year_name?: string;
}

interface AcademicYearItem {
  id: string | number;
  academic_year: string;
  is_current?: number | boolean;
  status?: number;
}

// Safer date formatting function to avoid timezone shifts
const formatScheduleDate = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-");
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const date = new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
    );
    return `${days[date.getDay()]}, ${parseInt(day, 10)} ${months[date.getMonth()]} ${year}`;
  } catch (e) {
    return dateStr;
  }
};

const formatTimeStr = (timeStr: string) => {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  const minutesStr = parts[1];
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  const padHours = displayHours < 10 ? `0${displayHours}` : displayHours;
  return `${padHours}:${minutesStr} ${ampm}`;
};

const getSubjectColor = (subjectName: string, isDark: boolean = false) => {
  const name = (subjectName || "").toLowerCase();
  if (name.includes("bengali") || name.includes("bangla")) {
    return { bg: isDark ? "#1e3a8a" : "#eff6ff", text: isDark ? "#93c5fd" : "#2563eb", border: "#3b82f6" }; // Soft Blue
  }
  if (name.includes("english") || name.includes("lang")) {
    return { bg: isDark ? "#4c1d95" : "#f5f3ff", text: isDark ? "#c4b5fd" : "#7c3aed", border: "#8b5cf6" }; // Soft Purple
  }
  if (name.includes("math") || name.includes("arithmetic")) {
    return { bg: isDark ? "#064e3b" : "#ecfdf5", text: isDark ? "#6ee7b7" : "#059669", border: "#10b981" }; // Soft Green
  }
  if (
    name.includes("science") ||
    name.includes("phys") ||
    name.includes("chem") ||
    name.includes("bio")
  ) {
    return { bg: isDark ? "#7c2d12" : "#fff7ed", text: isDark ? "#fdba74" : "#ea580c", border: "#f97316" }; // Soft Orange
  }
  // Default color
  return { bg: isDark ? "#831843" : "#fdf2f8", text: isDark ? "#f472b6" : "#db2777", border: "#ec4899" }; // Soft Pink
};

export default function ExamScheduleScreen() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const { colors, isDark } = useAppTheme();
  const { classes, isLoadingClasses } = useAppSelector(
    (state) => state.students,
  );

  // Component State
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [isLoadingYears, setIsLoadingYears] = useState(false);

  const [exams, setExams] = useState<ExamItem[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [isLoadingExams, setIsLoadingExams] = useState(false);

  const [selectedClass, setSelectedClass] = useState<string>("");

  const [schedule, setSchedule] = useState<ExamScheduleItem[]>([]);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bottom Sheets Refs
  const yearBottomSheetRef = useRef<BottomSheetModal>(null);
  const examBottomSheetRef = useRef<BottomSheetModal>(null);
  const classBottomSheetRef = useRef<BottomSheetModal>(null);

  // Ref to prevent initial useFocusEffect loop
  const hasLoadedRef = useRef(false);

  // 1. Load classes if empty
  useEffect(() => {
    if (classes.length === 0) {
      dispatch(fetchClasses());
    }
  }, [classes, dispatch]);

  // 2. Set default class on load
  useEffect(() => {
    if (classes.length > 0 && !selectedClass) {
      const activeClasses = classes.filter(
        (c) => c.status === undefined || String(c.status) === "1",
      );
      const defaultClass = activeClasses[0] || classes[0];
      if (defaultClass) {
        setSelectedClass(String(defaultClass.id));
      }
    }
  }, [classes, selectedClass]);

  // 3. Fetch Academic Years
  const fetchYears = useCallback(async () => {
    setIsLoadingYears(true);
    try {
      const res = await apiClient.get("/teacher/academics/years");
      const resData = res.data;
      const list =
        (Array.isArray(resData?.data) ? resData.data : null) ||
        (Array.isArray(resData) ? resData : null) ||
        resData?.academic_years ||
        [];

      if (Array.isArray(list) && list.length > 0) {
        setAcademicYears(list);
        setSelectedYear((prev) => {
          if (prev) return prev;
          const current = list.find(
            (y: any) => Number(y.is_current) === 1 || String(y.is_current) === "1"
          );
          return current ? String(current.id) : String(list[0].id);
        });
      } else {
        setAcademicYears([]);
      }
    } catch (e: any) {
      console.warn("fetchYears exception:", e?.message);
    } finally {
      setIsLoadingYears(false);
    }
  }, []);

  // 4. Fetch Exams list from API for selected academic year
  const fetchExams = useCallback(async (yearId?: string) => {
    setIsLoadingExams(true);
    try {
      const params: Record<string, any> = { status: 1 };
      if (yearId) {
        params.academic_year_id = yearId;
      }
      const res = await apiClient.get("/admin/examinations/exams", { params });
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
          exam: e.exam_name || e.exam || "Exam",
          academic_year: String(e.academic_year || ""),
          status: String(e.status ?? "1"),
        }));
        setExams(normalized);
        return normalized;
      } else {
        setExams([]);
        return [];
      }
    } catch (e: any) {
      console.warn("fetchExams exception:", e?.message);
      setExams([]);
      return [];
    } finally {
      setIsLoadingExams(false);
    }
  }, []);

  // 5. Fetch Exam Schedule based on selection
  const fetchSchedule = useCallback(
    async (examId?: string, classId?: string, yearId?: string, isRefresh = false) => {
      const activeExam = examId !== undefined ? examId : selectedExam;
      const activeClass = classId !== undefined ? classId : selectedClass;
      const activeYear = yearId !== undefined ? yearId : selectedYear;

      if (!activeExam || !activeClass) {
        setSchedule([]);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setIsLoadingSchedule(true);
      }
      setError(null);

      try {
        const params: Record<string, any> = {
          exam_id: activeExam,
          class_id: activeClass,
        };
        if (activeYear) {
          params.academic_year_id = activeYear;
        }

        const res = await apiClient.get(`/admin/examinations/schedules`, { params });
        const resData = res.data;
        const scheduleList =
          resData?.data?.schedules ||
          resData?.schedules ||
          (Array.isArray(resData?.data) ? resData.data : null) ||
          (Array.isArray(resData) ? resData : null) ||
          [];

        if (Array.isArray(scheduleList)) {
          // Sort chronologically by date and start_time
          const sorted = [...scheduleList].sort((a, b) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return String(a.start_time || "").localeCompare(String(b.start_time || ""));
          });
          setSchedule(sorted);
        } else {
          setSchedule([]);
        }
      } catch (e: any) {
        console.warn("fetchSchedule exception:", e?.message);
        setError(e?.message || "An error occurred while loading schedule.");
        setSchedule([]);
      } finally {
        setIsLoadingSchedule(false);
        setRefreshing(false);
      }
    },
    [selectedExam, selectedClass, selectedYear],
  );

  // Initial load of years
  useEffect(() => {
    if (token) {
      fetchYears();
    }
  }, [token, fetchYears]);

  // When selectedYear changes, fetch exams for that year
  useEffect(() => {
    if (selectedYear && token) {
      fetchExams(selectedYear).then((loadedExams) => {
        if (loadedExams && loadedExams.length > 0) {
          setSelectedExam((prev) => {
            const exists = loadedExams.some((e) => String(e.id) === String(prev));
            return exists ? prev : String(loadedExams[0].id);
          });
        } else {
          setSelectedExam("");
          setSchedule([]);
        }
      });
    }
  }, [selectedYear, token, fetchExams]);

  // Fetch schedule when filters are selected
  useEffect(() => {
    if (selectedExam && selectedClass && token) {
      fetchSchedule(selectedExam, selectedClass, selectedYear);
    }
  }, [selectedExam, selectedClass, selectedYear, token, fetchSchedule]);

  // Auto-refresh exam schedule on focus (prevent loop via hasLoadedRef)
  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) {
        hasLoadedRef.current = true;
        return;
      }
      if (selectedExam && selectedClass && token) {
        fetchSchedule(selectedExam, selectedClass, selectedYear, true);
      }
    }, [selectedExam, selectedClass, selectedYear, token, fetchSchedule])
  );

  const onRefresh = useCallback(async () => {
    if (selectedExam && selectedClass) {
      await fetchSchedule(selectedExam, selectedClass, selectedYear, true);
    } else if (selectedYear) {
      await fetchExams(selectedYear);
    } else {
      await fetchYears();
    }
  }, [selectedExam, selectedClass, selectedYear, fetchSchedule, fetchExams, fetchYears]);

  // Format selection options for BottomSheets
  const yearData = useMemo(() => {
    return academicYears.map((y) => ({
      id: y.id,
      name: y.academic_year,
    }));
  }, [academicYears]);

  const classData = useMemo(() => {
    return classes
      .filter((c) => c.status === undefined || String(c.status) === "1")
      .map((c) => ({
        id: c.id,
        name: c.class_name ? `Class ${c.class_name}` : `Class ${c.id}`,
      }));
  }, [classes]);

  const examData = useMemo(() => {
    return exams
      .filter((e) => e.status === undefined || String(e.status) === "1")
      .map((e) => ({
        id: e.id,
        name: e.exam,
      }));
  }, [exams]);

  const selectedYearObj = academicYears.find(
    (y) => String(y.id) === String(selectedYear),
  );
  const selectedClassObj = classes.find(
    (c) => String(c.id) === String(selectedClass),
  );
  const selectedExamObj = exams.find(
    (e) => String(e.id) === String(selectedExam),
  );

  // Render Schedule Card Item
  const renderScheduleItem = ({ item }: { item: ExamScheduleItem }) => {
    const subjectTheme = getSubjectColor(item.subject_name, isDark);

    return (
      <View style={[styles.scheduleCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <View
          style={[styles.accentStrip, { backgroundColor: subjectTheme.border }]}
        />
        <View style={styles.cardContent}>
          <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
            <View style={[styles.subjectBadge, { backgroundColor: subjectTheme.bg }]}>
              <Text style={[styles.subjectText, { color: subjectTheme.text }]}>
                {item.subject_name}
              </Text>
            </View>
            <View style={styles.statusContainer}>
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text style={[styles.statusText, { color: colors.textMuted }]}>Active</Text>
            </View>
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.textMuted}
                style={styles.detailIcon}
              />
              <View>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>DATE</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {formatScheduleDate(item.date)}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons
                name="time-outline"
                size={16}
                color={colors.textMuted}
                style={styles.detailIcon}
              />
              <View>
                <Text style={[styles.detailLabel, { color: colors.textMuted }]}>TIME</Text>
                <Text style={[styles.detailValue, { color: colors.text }]}>
                  {formatTimeStr(item.start_time)} - {formatTimeStr(item.end_time)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (isLoadingSchedule) return null;

    if (!selectedYear) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSubtle }]}>
            <Ionicons name="calendar-clear-outline" size={48} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Select Academic Year</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Please select an academic year from the filters above.
          </Text>
        </View>
      );
    }

    if (exams.length === 0 && !isLoadingExams) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSubtle }]}>
            <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Exams Available</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            There are currently no exams created for {selectedYearObj?.academic_year || "this academic year"}.
          </Text>
        </View>
      );
    }

    if (!selectedExam || !selectedClass) {
      const missing = [];
      if (!selectedExam) missing.push("Exam");
      if (!selectedClass) missing.push("Class");
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSubtle }]}>
            <Ionicons name="funnel-outline" size={48} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Select {missing.join(" & ")}</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Please choose {missing.length === 1 ? `a ${missing[0].toLowerCase()}` : "an exam and a class"} from the filters above to load the schedule.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSubtle }]}>
          <Ionicons name="calendar-clear-outline" size={48} color={colors.textMuted} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Schedule Found</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          There are no exam timings scheduled for {selectedExamObj?.exam || "this exam"} in {selectedClassObj?.class_name ? `Class ${selectedClassObj.class_name}` : "this class"}.
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Exam Schedule" />

      {/* Filter Section */}
      <View style={[styles.filterCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        {/* Row 1: Academic Year & Class */}
        <View style={styles.filterRow}>
          {/* Academic Year Dropdown */}
          <TouchableOpacity
            style={[styles.filterSelector, { marginRight: 8 }]}
            onPress={() => yearBottomSheetRef.current?.present()}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Academic Year</Text>
            <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Text style={[styles.selectorValue, { color: colors.text }]} numberOfLines={1}>
                {selectedYearObj ? selectedYearObj.academic_year : (isLoadingYears ? "Loading..." : "Select Year")}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* Class Dropdown */}
          <TouchableOpacity
            style={[styles.filterSelector, { marginLeft: 8 }]}
            onPress={() => classBottomSheetRef.current?.present()}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Class</Text>
            <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Text style={[styles.selectorValue, { color: colors.text }]} numberOfLines={1}>
                {selectedClassObj
                  ? selectedClassObj.class_name
                    ? `Class ${selectedClassObj.class_name}`
                    : `Class ${selectedClassObj.id}`
                  : (isLoadingClasses ? "Loading..." : "Select Class")}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Row 2: Exam Dropdown */}
        <View style={[styles.filterRow, { marginTop: 12 }]}>
          <TouchableOpacity
            style={styles.filterSelector}
            onPress={() => examBottomSheetRef.current?.present()}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Exam</Text>
            <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Text style={[styles.selectorValue, { color: colors.text }]} numberOfLines={1}>
                {selectedExamObj
                  ? selectedExamObj.exam
                  : (isLoadingExams
                      ? "Loading Exams..."
                      : (exams.length === 0 ? "No Exams Available" : "Select Exam"))}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Body */}
      {isLoadingSchedule && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Fetching Exam Schedule...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Error Loading Schedule</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textMuted }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => fetchSchedule(selectedExam, selectedClass, selectedYear)}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={schedule}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderScheduleItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#3d5ee1", "#10b981", "#f97316"]}
            />
          }
        />
      )}

      {/* Bottom Sheets for Selection */}
      <SelectionBottomSheet
        ref={yearBottomSheetRef}
        title="Select Academic Year"
        data={yearData}
        selectedId={selectedYear}
        onSelect={(item) => {
          setSelectedYear(String(item.id));
        }}
        loading={isLoadingYears}
      />

      <SelectionBottomSheet
        ref={classBottomSheetRef}
        title="Select Class"
        data={classData}
        selectedId={selectedClass}
        onSelect={(item) => {
          setSelectedClass(String(item.id));
        }}
        loading={isLoadingClasses}
      />

      <SelectionBottomSheet
        ref={examBottomSheetRef}
        title="Select Exam"
        data={examData}
        selectedId={selectedExam}
        onSelect={(item) => {
          setSelectedExam(String(item.id));
        }}
        loading={isLoadingExams}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  filterCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
    borderWidth: 1,
    borderColor: "#f0f0f0",
  },
  filterRow: {
    flexDirection: "row",
  },
  filterSelector: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7a869a",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectorValueBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f4f5f7",
    borderWidth: 1,
    borderColor: "#dfe1e6",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  selectorValue: {
    fontSize: 14,
    color: "#172b4d",
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
    flexGrow: 1,
  },
  scheduleCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: "row",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#f0f0f0",
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
  accentStrip: {
    width: 6,
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f8f9fa",
  },
  subjectBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  subjectText: {
    fontSize: 14,
    fontWeight: "700",
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    color: "#10b981",
    fontWeight: "600",
  },
  detailsRow: {
    marginBottom: 10,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailIcon: {
    marginRight: 10,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#7a869a",
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#202c4b",
    marginTop: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f4f5f7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#202c4b",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#7a869a",
    textAlign: "center",
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#991b1b",
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: "#7f1d1d",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  retryBtn: {
    backgroundColor: "#3d5ee1",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
