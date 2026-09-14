import InternalHeader from "@/components/InternalHeader";
import SelectionBottomSheet from "@/components/common/SelectionBottomSheet";
import { useAppTheme } from "@/constants/theme";
import { getAvatarUrl } from "@/services/apiClient";
import { fetchClasses, fetchSections } from "@/redux/features/students/thunks";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { apiClient } from "@/services/apiClient";

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return "Select Date";
  try {
    const [year, month, day] = dateStr.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
  } catch (e) {
    return dateStr;
  }
};

export default function TakeAttendanceScreen() {
  const params = useLocalSearchParams<{
    classId?: string;
    sectionId?: string;
    yearId?: string;
    date?: string;
  }>();

  const token = useAppSelector((state) => state.auth.token);
  const { classes, sections, isLoadingClasses, isLoadingSections } =
    useAppSelector((state) => state.students);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  // State variables for form filters
  const [selectedYear, setSelectedYear] = useState(params.yearId || "");
  const [selectedClass, setSelectedClass] = useState(params.classId || "");
  const [selectedSection, setSelectedSection] = useState(params.sectionId || "");
  const [selectedDate, setSelectedDate] = useState(params.date || getTodayDateString());

  // Academic years state
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [isLoadingYears, setIsLoadingYears] = useState(false);

  // Date picker state
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Attendance data states
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorAttendance, setErrorAttendance] = useState<string | null>(null);

  // Pagination states
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Local list search state
  const [localSearch, setLocalSearch] = useState("");

  // Edit states for taking attendance
  const [editedAttendance, setEditedAttendance] = useState<
    Record<string, string>
  >({});
  const [editedNotes, setEditedNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Refs for bottom sheets
  const yearBottomSheetRef = useRef<BottomSheetModal>(null);
  const classBottomSheetRef = useRef<BottomSheetModal>(null);
  const sectionBottomSheetRef = useRef<BottomSheetModal>(null);

  // Load classes if empty
  useEffect(() => {
    if (classes.length === 0) {
      dispatch(fetchClasses());
    }
  }, [classes, dispatch]);

  // Set default class when classes load
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

  // Load sections when selectedClass changes
  useEffect(() => {
    if (selectedClass) {
      dispatch(fetchSections(selectedClass));
      setSelectedSection(""); // Reset section selection
      setAttendanceData([]);
      setEditedAttendance({});
      setEditedNotes({});
      setHasMore(true);
      setLocalSearch("");
    }
  }, [selectedClass, dispatch]);

  // Set default section when sections load
  useEffect(() => {
    if (sections.length > 0 && !selectedSection) {
      const activeSections = sections.filter(
        (s) => s.status === undefined || String(s.status) === "1",
      );
      const defaultSection = activeSections[0] || sections[0];
      if (defaultSection) {
        setSelectedSection(String(defaultSection.id));
      }
    }
  }, [sections, selectedSection]);

  // Fetch Academic Years from API
  const fetchYears = useCallback(async () => {
    setIsLoadingYears(true);
    try {
      const response = await apiClient.get('/teacher/academics/years');
      const data = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
        ? response.data
        : [];
      if (data.length > 0) {
        setAcademicYears(data);
        const currentYear =
          data.find((y: any) => String(y.is_current) === "1") || data[0];
        if (currentYear) {
          setSelectedYear(String(currentYear.id));
        }
      }
    } catch (e: any) {
      console.warn("fetchYears exception:", e?.message);
    } finally {
      setIsLoadingYears(false);
    }
  }, []);

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  // Fetch student attendance list
  const fetchAttendance = useCallback(
    async (isSilent = false) => {
      if (
        !selectedClass ||
        !selectedSection ||
        !selectedYear ||
        !selectedDate
      ) {
        return;
      }

      if (!isSilent) {
        setLoadingAttendance(true);
      }
      setErrorAttendance(null);
      setHasMore(true);

      try {
        const response = await apiClient.get('/teacher/attendance/student/roster', {
          params: {
            class_id: selectedClass,
            section_id: selectedSection,
            academic_year: selectedYear,
            date: selectedDate,
            limit: 100,
          },
        });

        const resData = response.data;
        const studentsList =
          resData?.data?.students ||
          resData?.students ||
          (Array.isArray(resData?.data) ? resData.data : []);

        if (Array.isArray(studentsList) && studentsList.length > 0) {
          setAttendanceData(studentsList);

          // Initialize edit states for each student
          const initialAtt: Record<string, string> = {};
          const initialNotes: Record<string, string> = {};
          studentsList.forEach((s: any) => {
            const att = s.attendance;
            initialAtt[String(s.id)] =
              att !== null && att !== undefined && att !== ""
                ? String(att)
                : "";
            initialNotes[String(s.id)] = s.notes || "";
          });
          setEditedAttendance(initialAtt);
          setEditedNotes(initialNotes);
          setErrorAttendance(null);
        } else {
          setAttendanceData([]);
          setEditedAttendance({});
          setEditedNotes({});
          setErrorAttendance(null);
          setHasMore(false);
        }
      } catch (e: any) {
        console.warn("fetchAttendance exception:", e?.message);
        setErrorAttendance(
          e?.response?.data?.message ||
            e?.message ||
            "An error occurred while fetching attendance records."
        );
        setHasMore(false);
      } finally {
        setLoadingAttendance(false);
      }
    },
    [selectedClass, selectedSection, selectedYear, selectedDate]
  );

  // Auto-fetch attendance when all selections are ready
  useEffect(() => {
    if (selectedClass && selectedSection && selectedYear && selectedDate) {
      fetchAttendance();
    }
  }, [
    selectedClass,
    selectedSection,
    selectedYear,
    selectedDate,
    fetchAttendance,
  ]);

  // Handler for changing attendance status for a single student
  const handleAttendanceChange = useCallback(
    (studentId: string, value: string) => {
      setEditedAttendance((prev) => ({ ...prev, [String(studentId)]: value }));
    },
    [],
  );

  // Handler for changing notes for a single student
  const handleNoteChange = useCallback((studentId: string, text: string) => {
    setEditedNotes((prev) => ({ ...prev, [String(studentId)]: text }));
  }, []);

  // Submit attendance to API
  const submitAttendance = useCallback(async () => {
    const records: Array<{ student_id: number; attendance: number; notes: string }> = [];

    Object.keys(editedAttendance).forEach((key) => {
      const val = editedAttendance[key];
      if (val !== null && val !== undefined && val !== "") {
        records.push({
          student_id: Number(key),
          attendance: Number(val),
          notes: editedNotes[key] || "",
        });
      }
    });

    if (records.length === 0) {
      Alert.alert(
        "Validation Error",
        "Please mark attendance status for at least one student before submitting.",
      );
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiClient.post('/teacher/attendance/student/save', {
        attendanceDate: selectedDate,
        academic_year: selectedYear,
        attendanceRecords: records,
      });

      Alert.alert(
        "Success",
        response.data?.message || "Attendance saved successfully.",
      );
      fetchAttendance(true);
    } catch (e: any) {
      console.warn("submitAttendance exception:", e?.message);
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "An error occurred while submitting attendance.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  }, [editedAttendance, editedNotes, selectedDate, selectedYear, fetchAttendance]);

  // Load more paginated student attendance records
  const loadMoreAttendance = useCallback(async () => {
    // Roster is fully fetched
    setHasMore(false);
    setLoadingMore(false);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAttendance(true);
    setRefreshing(false);
  }, [fetchAttendance]);

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      setSelectedDate(`${year}-${month}-${day}`);
    }
  };

  // Setup options for bottom sheets
  const yearData = useMemo(() => {
    return academicYears.map((y) => ({
      id: y.id,
      name: `Academic Year ${y.academic_year}`,
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

  const sectionData = useMemo(() => {
    return sections
      .filter((s) => s.status === undefined || String(s.status) === "1")
      .map((s) => ({
        id: s.id,
        name: `Section ${s.section_name}`,
      }));
  }, [sections]);

  const selectedYearObj = academicYears.find(
    (y) => String(y.id) === String(selectedYear),
  );
  const selectedClassObj = classes.find(
    (c) => String(c.id) === String(selectedClass),
  );
  const selectedSectionObj = sections.find(
    (s) => String(s.id) === String(selectedSection),
  );

  // Locally filtered list based on search query
  const filteredStudents = useMemo(() => {
    if (!localSearch) return attendanceData;
    const query = localSearch.toLowerCase().trim();
    return attendanceData.filter((s: any) => {
      const fullName =
        `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
      const rollNum = String(s.roll_number || "").toLowerCase();
      const admNum = String(s.admission_number || "").toLowerCase();
      return (
        fullName.includes(query) ||
        rollNum.includes(query) ||
        admNum.includes(query)
      );
    });
  }, [attendanceData, localSearch]);

  const statusOptions = [
    { value: "1", label: "P", color: "#10b981" },
    { value: "2", label: "L", color: "#f59e0b" },
    { value: "3", label: "H", color: "#3d5ee1" },
    { value: "0", label: "A", color: "#ef4444" },
  ];

  const renderStudentItem = ({ item }: { item: any }) => {
    const avatarSource = { uri: getAvatarUrl(item.picture, item.gender) };

    const currentAtt = editedAttendance[String(item.id)];

    return (
      <View
        style={[
          styles.studentCardVertical,
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        <View style={styles.studentCardHeader}>
          <Image
            source={avatarSource}
            style={[styles.studentAvatar, { borderColor: colors.border }]}
          />
          <View style={styles.studentInfo}>
            <Text style={[styles.studentName, { color: colors.text }]}>
              {`${item.first_name || ""} ${item.last_name || ""}`.trim()}
            </Text>
            <Text style={[styles.studentDetails, { color: colors.textMuted }]}>
              Roll {item.roll_number || "N/A"} • ID:{" "}
              {item.admission_number || "N/A"}
            </Text>
            <Text style={[styles.studentSubText, { color: colors.textMuted }]}>
              Gender: {item.gender || "N/A"}
            </Text>
          </View>
        </View>

        <View style={styles.editControlsContainer}>
          <View
            style={[styles.editDivider, { backgroundColor: colors.border }]}
          />
          <View style={styles.editRow}>
            <TextInput
              style={[
                styles.studentNoteInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              placeholder="Add note..."
              value={editedNotes[String(item.id)] || ""}
              onChangeText={(text) => handleNoteChange(String(item.id), text)}
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.attendanceButtonsContainer}>
              {statusOptions.map((opt) => {
                const isSelected = String(currentAtt) === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.attButton,
                      {
                        borderColor: opt.color,
                        backgroundColor: isDark ? colors.surfaceSubtle : "#fff",
                      },
                      isSelected && { backgroundColor: opt.color },
                    ]}
                    onPress={() =>
                      handleAttendanceChange(String(item.id), opt.value)
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.attButtonText,
                        { color: isSelected ? "#fff" : opt.color },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loadingAttendance) return null;
    if (errorAttendance) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.errorIconCircle}>
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Error Loading Records
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {errorAttendance}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => fetchAttendance()}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View
          style={[styles.iconCircle, { backgroundColor: colors.surfaceSubtle }]}
        >
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {!selectedClass || !selectedSection
            ? "Select Class & Section"
            : "No Student Records Found"}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          {!selectedClass || !selectedSection
            ? "Please choose class, section, and date above to fetch the student list."
            : "No student records were found for the selected filters."}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <InternalHeader
        title="Take Attendance"
        onBack={() => router.replace("/(main)/(drawer)/attendance")}
      />

      {/* Filter Options Selector Header Card */}
      <View
        style={[
          styles.filterCard,
          { backgroundColor: colors.cardBg, borderBottomColor: colors.border },
        ]}
      >
        {/* Row 1: Academic Year and Date */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterSelector, { marginRight: 8 }]}
            onPress={() => yearBottomSheetRef.current?.present()}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>
              Academic Year
            </Text>
            <View
              style={[
                styles.selectorValueBox,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <Text
                style={[styles.selectorValue, { color: colors.text }]}
                numberOfLines={1}
              >
                {selectedYearObj
                  ? `Academic Year ${selectedYearObj.academic_year}`
                  : "Select Year"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={colors.textMuted}
              />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterSelector, { marginLeft: 8 }]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>
              Date
            </Text>
            <View
              style={[
                styles.selectorValueBox,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <Ionicons
                name="calendar-outline"
                size={16}
                color={colors.primary}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[styles.selectorValue, { color: colors.text }]}
                numberOfLines={1}
              >
                {formatDateDisplay(selectedDate)}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={colors.textMuted}
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Row 2: Class and Section */}
        <View style={[styles.filterRow, { marginTop: 12 }]}>
          <TouchableOpacity
            style={[styles.filterSelector, { marginRight: 8 }]}
            onPress={() => classBottomSheetRef.current?.present()}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>
              Class
            </Text>
            <View
              style={[
                styles.selectorValueBox,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <Text
                style={[styles.selectorValue, { color: colors.text }]}
                numberOfLines={1}
              >
                {selectedClassObj
                  ? `Class ${selectedClassObj.class_name || selectedClassObj.id}`
                  : "Select Class"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={colors.textMuted}
              />
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
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>
              Section
            </Text>
            <View
              style={[
                styles.selectorValueBox,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.selectorValue,
                  { color: colors.text },
                  !selectedClass && styles.disabledText,
                ]}
                numberOfLines={1}
              >
                {selectedSectionObj
                  ? `Section ${selectedSectionObj.section_name}`
                  : "Select Section"}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={selectedClass ? colors.textMuted : "#ccc"}
              />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content body */}
      {loadingAttendance ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Fetching Student Records...
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            key={`${selectedClass}-${selectedSection}-${selectedYear}-${selectedDate}`}
            data={filteredStudents}
            keyExtractor={(item, index) =>
              item?.id ? String(item.id) : `student-${index}`
            }
            renderItem={renderStudentItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              attendanceData.length > 0 ? (
                <View>
                  {/* Local search bar */}
                  <View
                    style={[
                      styles.searchBarContainer,
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
                      placeholder="Search by name, roll, ID..."
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
              ) : null
            }
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary]}
              />
            }
            onEndReached={() => {
              loadMoreAttendance();
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    style={[
                      styles.footerLoaderText,
                      { color: colors.textMuted },
                    ]}
                  >
                    Loading more students...
                  </Text>
                </View>
              ) : null
            }
          />

          {/* Sticky footer submit bar */}
          {attendanceData.length > 0 && (
            <View
              style={[
                styles.submitBar,
                {
                  backgroundColor: colors.cardBg,
                  borderTopColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, 14),
                },
              ]}
            >
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => router.replace("/(main)/(drawer)/attendance")}
                disabled={submitting}
                activeOpacity={0.8}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  { backgroundColor: colors.primary },
                  submitting && styles.disabledBtn,
                ]}
                onPress={submitAttendance}
                disabled={submitting}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitBtnText}>Submit Attendance</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate ? new Date(selectedDate) : new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {/* Year bottom sheet */}
      <SelectionBottomSheet
        ref={yearBottomSheetRef}
        title="Select Academic Year"
        data={yearData}
        onSelect={(item) => setSelectedYear(String(item.id))}
        loading={isLoadingYears}
      />

      {/* Class bottom sheet */}
      <SelectionBottomSheet
        ref={classBottomSheetRef}
        title="Select Class"
        data={classData}
        onSelect={(item) => setSelectedClass(String(item.id))}
        loading={isLoadingClasses}
      />

      {/* Section bottom sheet */}
      <SelectionBottomSheet
        ref={sectionBottomSheetRef}
        title="Select Section"
        data={sectionData}
        onSelect={(item) => setSelectedSection(String(item.id))}
        loading={isLoadingSections}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterCard: {
    padding: 16,
    borderBottomWidth: 1,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  filterSelector: {
    flex: 1,
  },
  disabledSelector: {
    opacity: 0.6,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  selectorValueBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectorValue: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  disabledText: {
    opacity: 0.6,
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100,
  },
  studentCardVertical: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  studentCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  studentAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
    borderWidth: 1,
  },
  studentInfo: {
    flex: 1,
    marginRight: 8,
  },
  studentName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  studentDetails: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  studentSubText: {
    fontSize: 11,
    fontWeight: "500",
  },
  editControlsContainer: {
    marginTop: 12,
  },
  editDivider: {
    height: 1,
    marginBottom: 12,
  },
  editRow: {
    flexDirection: "column",
    gap: 12,
  },
  studentNoteInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  attendanceButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  attButton: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  attButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: "100%",
    padding: 0,
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
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#fdf2f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  footerLoaderText: {
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 8,
  },
  submitBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cancelBtn: {
    flex: 1,
    marginRight: 8,
    borderWidth: 1,
    borderRadius: 10,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  submitBtn: {
    flex: 1,
    marginLeft: 8,
    borderRadius: 10,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  disabledBtn: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
