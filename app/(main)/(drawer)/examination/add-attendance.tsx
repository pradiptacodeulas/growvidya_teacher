import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRouter, useLocalSearchParams } from "expo-router";
import InternalHeader from "@/components/InternalHeader";
import SelectionBottomSheet from "@/components/common/SelectionBottomSheet";
import apiClient from "@/services/apiClient";
import { fetchClasses, fetchSections } from "@/redux/features/students/thunks";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useAppTheme } from "@/constants/theme";
import Toast from "react-native-toast-message";

interface ExamItem {
  id: string | number;
  academic_year: string | number;
  school_id: string | number;
  exam: string;
  status: string;
}

interface ScheduledSubject {
  id: string | number;
  subject_id: string | number;
  subject_name: string;
  schedule_id: string | number;
  date: string;
  start_time?: string;
  end_time?: string;
  isEditable?: boolean;
}

interface StudentRosterItem {
  student_id: string | number;
  admission_no: string;
  roll_no: string;
  first_name: string;
  last_name: string;
  class_name: string;
  section_name: string;
  attendance_status: number; // 1 = Present, 0 = Absent, 2 = Leave
}

export default function AddExamAttendanceScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { colors, isDark } = useAppTheme();
  const { classes, sections, isLoadingClasses, isLoadingSections } =
    useAppSelector((state) => state.students);

  // Filter list states
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [scheduledSubjects, setScheduledSubjects] = useState<ScheduledSubject[]>([]);

  // Selected values
  const [selectedExam, setSelectedExam] = useState<string>(
    typeof params.exam_id === "string" ? params.exam_id : ""
  );
  const [selectedClass, setSelectedClass] = useState<string>(
    typeof params.class_id === "string" ? params.class_id : ""
  );
  const [selectedSection, setSelectedSection] = useState<string>(
    typeof params.section_id === "string" ? params.section_id : "all"
  );
  const [selectedSubject, setSelectedSubject] = useState<string>(
    typeof params.subject_id === "string" ? params.subject_id : ""
  );
  const [currentScheduleId, setCurrentScheduleId] = useState<string>("");

  // Loading & UI states
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingRoster, setIsLoadingRoster] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [examScheduleInfo, setExamScheduleInfo] = useState<any>(null);
  const [isAttendanceLocked, setIsAttendanceLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState<string | null>(null);

  // Student roster state
  const [students, setStudents] = useState<StudentRosterItem[]>([]);

  // BottomSheet refs
  const examBottomSheetRef = useRef<BottomSheetModal>(null);
  const classBottomSheetRef = useRef<BottomSheetModal>(null);
  const sectionBottomSheetRef = useRef<BottomSheetModal>(null);
  const subjectBottomSheetRef = useRef<BottomSheetModal>(null);

  const isFirstLoad = useRef(true);

  // 1. Fetch classes if list is empty
  useEffect(() => {
    if (classes.length === 0) {
      dispatch(fetchClasses());
    }
  }, [classes, dispatch]);

  // Set default class if not passed in params
  useEffect(() => {
    if (classes.length > 0 && !selectedClass && isFirstLoad.current) {
      const activeClasses = classes.filter(
        (c) => c.status === undefined || String(c.status) === "1"
      );
      const defaultClass = activeClasses[0] || classes[0];
      if (defaultClass) {
        setSelectedClass(String(defaultClass.id));
      }
    }
  }, [classes, selectedClass]);

  // 2. Fetch sections when class changes
  useEffect(() => {
    if (selectedClass) {
      dispatch(fetchSections(selectedClass));
    }
  }, [selectedClass, dispatch]);

  // 3. Fetch Exams list from API
  const fetchExams = useCallback(async () => {
    setIsLoadingExams(true);
    try {
      const res = await apiClient.get("/admin/examinations/exams");
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
          academic_year: e.academic_year || "",
          school_id: e.school_id || "",
          status: String(e.status ?? "1"),
        }));
        setExams(normalized);

        // Set default exam if not selected
        if (!selectedExam && isFirstLoad.current) {
          const activeExams = normalized.filter(
            (e) => e.status === undefined || String(e.status) === "1"
          );
          const defaultExam = activeExams[0] || normalized[0];
          if (defaultExam) {
            setSelectedExam(String(defaultExam.id));
          }
        }
      } else {
        setExams([]);
      }
    } catch (e: any) {
      console.warn("fetchExams exception:", e.message);
    } finally {
      setIsLoadingExams(false);
    }
  }, [selectedExam]);

  useEffect(() => {
    if (token) {
      fetchExams();
    }
  }, [token, fetchExams]);

  // 4. Fetch Scheduled Subjects for chosen Exam and Class
  const fetchScheduledSubjects = useCallback(
    async (examId: string, classId: string) => {
      if (!examId || !classId) {
        setScheduledSubjects([]);
        setSelectedSubject("");
        setCurrentScheduleId("");
        return;
      }

      setIsLoadingSubjects(true);
      try {
        const res = await apiClient.get("/admin/examinations/exam-schedules", {
          params: {
            exam_id: examId,
            class_id: classId,
            assigned_only: 1,
          },
        });

        const rawData = res.data?.data || res.data || {};
        const schedList = (rawData.schedules || rawData || []).filter(Boolean);

        if (Array.isArray(schedList) && schedList.length > 0) {
          const subjectsMap = new Map<string, ScheduledSubject>();
          schedList.forEach((s: any) => {
            const subId = String(s.subject_id || "");
            if (subId && !subjectsMap.has(subId)) {
              subjectsMap.set(subId, {
                id: subId,
                subject_id: subId,
                subject_name: s.subject_name || `Subject #${subId}`,
                schedule_id: String(s.id),
                date: s.date || "",
                start_time: s.start_time || "",
                end_time: s.end_time || "",
                isEditable: s.isEditable !== false,
              });
            }
          });

          const uniqueList = Array.from(subjectsMap.values());
          setScheduledSubjects(uniqueList);

          // If subject was passed in params or none selected, pick first
          if (uniqueList.length > 0) {
            const preselect = uniqueList.find(
              (sub) => String(sub.subject_id) === String(params.subject_id)
            ) || uniqueList[0];
            setSelectedSubject(String(preselect.subject_id));
            setCurrentScheduleId(String(preselect.schedule_id));
          } else {
            setSelectedSubject("");
            setCurrentScheduleId("");
          }
        } else {
          setScheduledSubjects([]);
          setSelectedSubject("");
          setCurrentScheduleId("");
        }
      } catch (e: any) {
        console.warn("fetchScheduledSubjects error:", e.message);
        setScheduledSubjects([]);
      } finally {
        setIsLoadingSubjects(false);
      }
    },
    [params.subject_id]
  );

  useEffect(() => {
    if (selectedExam && selectedClass) {
      fetchScheduledSubjects(selectedExam, selectedClass);
    }
  }, [selectedExam, selectedClass, fetchScheduledSubjects]);

  // 5. Fetch Students Roster for marking attendance
  const fetchRoster = useCallback(
    async (examId: string, classId: string, subjectId: string, sectionId: string) => {
      if (!examId || !classId || !subjectId) {
        setStudents([]);
        return;
      }

      setIsLoadingRoster(true);
      setLockMessage(null);

      try {
        const queryParams: any = {
          exam_id: examId,
          class_id: classId,
          subject_id: subjectId,
          roster: 1,
        };
        if (sectionId && sectionId !== "all") {
          queryParams.section_id = sectionId;
        }

        const res = await apiClient.get("/admin/examinations/attendance", {
          params: queryParams,
        });

        const rawData = res.data?.data || res.data || {};
        const studentsList = rawData.students || [];
        const sched = rawData.examSchedule;
        const locked = Boolean(rawData.isLocked);

        setExamScheduleInfo(sched);
        setIsAttendanceLocked(locked);

        // Check if date has passed
        if (sched?.date) {
          const now = new Date();
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
          const examDateStr = String(sched.date).slice(0, 10);
          if (todayStr > examDateStr) {
            setIsAttendanceLocked(true);
            setLockMessage(
              `The scheduled exam date (${examDateStr}) has passed. Staff and teachers cannot alter past exam attendance.`
            );
          }
        }

        if (Array.isArray(studentsList) && studentsList.length > 0) {
          const mapped: StudentRosterItem[] = studentsList.map((st: any) => {
            let initialStatus = 1; // Default Present
            if (st.attendance_status !== undefined && st.attendance_status !== null) {
              initialStatus = Number(st.attendance_status);
            }
            return {
              student_id: st.student_id || st.id,
              admission_no: String(st.admission_no || st.admission_number || ""),
              roll_no: String(st.roll_no || st.roll_number || ""),
              first_name: st.first_name || "",
              last_name: st.last_name || "",
              class_name: st.class_name || "",
              section_name: st.section_name || "",
              attendance_status: initialStatus,
            };
          });
          setStudents(mapped);
        } else {
          setStudents([]);
        }
      } catch (e: any) {
        console.warn("fetchRoster error:", e.message);
        setStudents([]);
        Toast.show({
          type: "error",
          text1: "Error loading students",
          text2: e.message || "Failed to fetch exam attendance roster.",
        });
      } finally {
        setIsLoadingRoster(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedExam && selectedClass && selectedSubject) {
      fetchRoster(selectedExam, selectedClass, selectedSubject, selectedSection);
    }
  }, [selectedExam, selectedClass, selectedSubject, selectedSection, fetchRoster]);

  // Bulk actions: Mark All Present / Absent
  const markAll = (status: number) => {
    if (isAttendanceLocked) return;
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        attendance_status: status,
      }))
    );
  };

  // Toggle individual student attendance status
  const setStudentStatus = (studentId: string | number, status: number) => {
    if (isAttendanceLocked) return;
    setStudents((prev) =>
      prev.map((s) =>
        s.student_id === studentId
          ? { ...s, attendance_status: status }
          : s
      )
    );
  };

  // Submit attendance to backend
  const handleSaveAttendance = async () => {
    if (isAttendanceLocked) {
      Alert.alert(
        "Attendance Locked",
        lockMessage || "Past exam attendance cannot be modified."
      );
      return;
    }

    if (!selectedExam || !selectedClass || !selectedSubject) {
      Alert.alert("Missing Selection", "Please select Exam, Class, and Subject.");
      return;
    }

    if (students.length === 0) {
      Alert.alert("No Students", "There are no students to save attendance for.");
      return;
    }

    setIsSaving(true);
    try {
      const records = students.map((s) => ({
        student_id: s.student_id,
        attendance_status: s.attendance_status,
      }));

      const payload: any = {
        exam_id: selectedExam,
        class_id: selectedClass,
        subject_id: selectedSubject,
        exam_schedule_id: currentScheduleId || examScheduleInfo?.id || undefined,
        records,
      };

      if (selectedSection && selectedSection !== "all") {
        payload.section_id = selectedSection;
      }

      const res = await apiClient.post("/admin/examinations/attendance", payload);

      if (res.data?.success !== false) {
        Toast.show({
          type: "success",
          text1: "Success",
          text2: res.data?.message || "Exam attendance saved successfully.",
        });
        setTimeout(() => {
          router.back();
        }, 600);
      } else {
        Alert.alert("Submission Failed", res.data?.message || "Could not save exam attendance.");
      }
    } catch (e: any) {
      const msg =
        e.response?.data?.message ||
        e.message ||
        "An unexpected error occurred while saving attendance.";
      Alert.alert("Error", msg);
    } finally {
      setIsSaving(false);
    }
  };

  // Dropdown list options
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
        id: s.id,
        name: `Section ${s.section_name}`,
      }));
    return [{ id: "all", name: "All Sections" }, ...list];
  }, [sections]);

  const subjectData = useMemo(() => {
    return scheduledSubjects.map((s) => ({
      id: s.subject_id,
      name: `${s.subject_name} (${s.date || "Scheduled"})`,
    }));
  }, [scheduledSubjects]);

  const selectedExamObj = exams.find((e) => String(e.id) === String(selectedExam));
  const selectedClassObj = classes.find((c) => String(c.id) === String(selectedClass));
  const selectedSectionObj = sectionData.find(
    (s) => String(s.id) === String(selectedSection)
  );
  const selectedSubjectObj = scheduledSubjects.find(
    (s) => String(s.subject_id) === String(selectedSubject)
  );

  // Attendance summary counts
  const stats = useMemo(() => {
    let p = 0;
    let a = 0;
    let l = 0;
    students.forEach((s) => {
      if (s.attendance_status === 1) p++;
      else if (s.attendance_status === 0) a++;
      else if (s.attendance_status === 2) l++;
    });
    return { total: students.length, present: p, absent: a, leave: l };
  }, [students]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Add Exam Attendance" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Filters Card */}
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

          {/* Row 2: Class & Section */}
          <View style={[styles.filterRow, { marginTop: 12 }]}>
            <TouchableOpacity
              style={[styles.filterSelector, { marginRight: 8 }]}
              onPress={() => classBottomSheetRef.current?.present()}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Class</Text>
              <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                <Text style={[styles.selectorValue, { color: colors.text }]} numberOfLines={1}>
                  {selectedClassObj ? `Class ${selectedClassObj.class_name || selectedClassObj.id}` : "Choose Class"}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterSelector, { marginLeft: 8 }]}
              onPress={() => sectionBottomSheetRef.current?.present()}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Section</Text>
              <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                <Text style={[styles.selectorValue, { color: colors.text }]} numberOfLines={1}>
                  {selectedSectionObj ? selectedSectionObj.name : "All Sections"}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Row 3: Scheduled Subject Selector */}
          <View style={[styles.filterRow, { marginTop: 12 }]}>
            <TouchableOpacity
              style={styles.filterSelector}
              onPress={() => subjectBottomSheetRef.current?.present()}
              activeOpacity={0.8}
              disabled={scheduledSubjects.length === 0}
            >
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>
                Scheduled Subject
              </Text>
              <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                {isLoadingSubjects ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Text style={[styles.selectorValue, { color: colors.text }]} numberOfLines={1}>
                      {selectedSubjectObj
                        ? `${selectedSubjectObj.subject_name} (${selectedSubjectObj.date || "Scheduled"})`
                        : scheduledSubjects.length === 0
                        ? "No Schedules Found"
                        : "Choose Subject"}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Lock Warning Banner */}
        {isAttendanceLocked && (
          <View style={[styles.alertBanner, { backgroundColor: isDark ? "#450a0a" : "#fee2e2", borderColor: "#ef4444" }]}>
            <Ionicons name="lock-closed" size={18} color="#ef4444" style={{ marginRight: 8 }} />
            <Text style={[styles.alertBannerText, { color: isDark ? "#fca5a5" : "#991b1b" }]}>
              {lockMessage || "Attendance is locked for this exam. Past exam attendance cannot be edited."}
            </Text>
          </View>
        )}

        {/* Schedule Info Card */}
        {selectedSubjectObj && (
          <View style={[styles.scheduleCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.scheduleRow}>
              <View style={styles.scheduleInfoItem}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={[styles.scheduleInfoText, { color: colors.text }]}>
                  {selectedSubjectObj.date || "Date N/A"}
                </Text>
              </View>
              {selectedSubjectObj.start_time ? (
                <View style={styles.scheduleInfoItem}>
                  <Ionicons name="time-outline" size={16} color={colors.primary} />
                  <Text style={[styles.scheduleInfoText, { color: colors.text }]}>
                    {selectedSubjectObj.start_time} - {selectedSubjectObj.end_time || ""}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* Summary Stats & Bulk Actions Bar */}
        {students.length > 0 && (
          <View style={[styles.metaBar, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.countsRow}>
              <View style={styles.countBadge}>
                <Text style={[styles.countNum, { color: colors.text }]}>{stats.total}</Text>
                <Text style={[styles.countLabel, { color: colors.textMuted }]}>Total</Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: isDark ? "#064e3b" : "#ecfdf5" }]}>
                <Text style={[styles.countNum, { color: "#10b981" }]}>{stats.present}</Text>
                <Text style={[styles.countLabel, { color: "#10b981" }]}>Present</Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: isDark ? "#7f1d1d" : "#fee2e2" }]}>
                <Text style={[styles.countNum, { color: "#ef4444" }]}>{stats.absent}</Text>
                <Text style={[styles.countLabel, { color: "#ef4444" }]}>Absent</Text>
              </View>
              <View style={[styles.countBadge, { backgroundColor: isDark ? "#78350f" : "#fef3c7" }]}>
                <Text style={[styles.countNum, { color: "#f59e0b" }]}>{stats.leave}</Text>
                <Text style={[styles.countLabel, { color: "#f59e0b" }]}>Leave</Text>
              </View>
            </View>

            {!isAttendanceLocked && (
              <View style={styles.bulkActionsRow}>
                <TouchableOpacity
                  style={[styles.bulkBtn, { backgroundColor: isDark ? "#064e3b" : "#ecfdf5", borderColor: "#10b981" }]}
                  onPress={() => markAll(1)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.bulkBtnText, { color: "#10b981" }]}>All Present</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bulkBtn, { backgroundColor: isDark ? "#7f1d1d" : "#fee2e2", borderColor: "#ef4444" }]}
                  onPress={() => markAll(0)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.bulkBtnText, { color: "#ef4444" }]}>All Absent</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Student Roster List */}
        {isLoadingRoster ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Loading student roster...
            </Text>
          </View>
        ) : students.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="school-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Students Found</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {!selectedSubject
                ? "Please select a scheduled subject to load student roster."
                : "No active students enrolled for the selected class and section."}
            </Text>
          </View>
        ) : (
          <View style={styles.rosterContainer}>
            {students.map((student, idx) => {
              const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Student";
              const initials = (student.first_name?.charAt(0) || "S") + (student.last_name?.charAt(0) || "");

              return (
                <View
                  key={student.student_id}
                  style={[
                    styles.studentCard,
                    { backgroundColor: colors.cardBg, borderColor: colors.border },
                  ]}
                >
                  {/* Student Info */}
                  <View style={styles.studentLeft}>
                    <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
                      <Text style={[styles.avatarText, { color: colors.primary }]}>
                        {initials.toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.studentDetails}>
                      <Text style={[styles.studentName, { color: colors.text }]} numberOfLines={1}>
                        {fullName}
                      </Text>
                      <View style={styles.metaLine}>
                        <Text style={[styles.studentMeta, { color: colors.textMuted }]}>
                          Roll: {student.roll_no || "N/A"}
                        </Text>
                        <Text style={[styles.metaDivider, { color: colors.textMuted }]}>•</Text>
                        <Text style={[styles.studentMeta, { color: colors.textMuted }]}>
                          ID: {student.admission_no || "N/A"}
                        </Text>
                        {student.section_name ? (
                          <>
                            <Text style={[styles.metaDivider, { color: colors.textMuted }]}>•</Text>
                            <Text style={[styles.studentMeta, { color: colors.textMuted }]}>
                              Sec {student.section_name}
                            </Text>
                          </>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {/* Attendance Status Buttons */}
                  <View style={styles.statusButtonsContainer}>
                    {/* Present */}
                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        student.attendance_status === 1
                          ? { backgroundColor: "#10b981", borderColor: "#10b981" }
                          : { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                      ]}
                      onPress={() => setStudentStatus(student.student_id, 1)}
                      disabled={isAttendanceLocked}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusBtnText,
                          { color: student.attendance_status === 1 ? "#fff" : colors.textMuted },
                        ]}
                      >
                        P
                      </Text>
                    </TouchableOpacity>

                    {/* Absent */}
                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        student.attendance_status === 0
                          ? { backgroundColor: "#ef4444", borderColor: "#ef4444" }
                          : { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                      ]}
                      onPress={() => setStudentStatus(student.student_id, 0)}
                      disabled={isAttendanceLocked}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusBtnText,
                          { color: student.attendance_status === 0 ? "#fff" : colors.textMuted },
                        ]}
                      >
                        A
                      </Text>
                    </TouchableOpacity>

                    {/* Leave */}
                    <TouchableOpacity
                      style={[
                        styles.statusBtn,
                        student.attendance_status === 2
                          ? { backgroundColor: "#f59e0b", borderColor: "#f59e0b" }
                          : { backgroundColor: colors.inputBg, borderColor: colors.inputBorder },
                      ]}
                      onPress={() => setStudentStatus(student.student_id, 2)}
                      disabled={isAttendanceLocked}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.statusBtnText,
                          { color: student.attendance_status === 2 ? "#fff" : colors.textMuted },
                        ]}
                      >
                        L
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Bottom Save Action Button */}
      {students.length > 0 && !isAttendanceLocked && (
        <View style={[styles.bottomBar, { backgroundColor: colors.cardBg, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSaveAttendance}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>Save Exam Attendance</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Bottom Sheets */}
      <SelectionBottomSheet
        ref={examBottomSheetRef}
        title="Select Exam"
        data={examData}
        onSelect={(item) => {
          setSelectedExam(String(item.id));
          setSelectedSubject("");
          setCurrentScheduleId("");
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
          setSelectedSubject("");
          setCurrentScheduleId("");
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
        }}
        loading={isLoadingSections}
      />

      <SelectionBottomSheet
        ref={subjectBottomSheetRef}
        title="Select Scheduled Subject"
        data={subjectData}
        onSelect={(item) => {
          const subId = String(item.id);
          setSelectedSubject(subId);
          const found = scheduledSubjects.find((s) => String(s.subject_id) === subId);
          if (found) {
            setCurrentScheduleId(String(found.schedule_id));
          }
        }}
        loading={isLoadingSubjects}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  filterCard: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
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
  filterLabel: {
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectorValueBox: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorValue: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 6,
  },
  alertBanner: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  alertBannerText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    lineHeight: 18,
  },
  scheduleCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scheduleInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scheduleInfoText: {
    fontSize: 13,
    fontWeight: "600",
  },
  metaBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  countsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  countBadge: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  countNum: {
    fontSize: 15,
    fontWeight: "800",
  },
  countLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
    textTransform: "uppercase",
  },
  bulkActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    gap: 8,
  },
  bulkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  bulkBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  rosterContainer: {
    marginHorizontal: 16,
    gap: 8,
  },
  studentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  studentLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  avatarText: {
    fontSize: 13,
    fontWeight: "700",
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  metaLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  studentMeta: {
    fontSize: 11,
    fontWeight: "500",
  },
  metaDivider: {
    marginHorizontal: 4,
    fontSize: 10,
  },
  statusButtonsContainer: {
    flexDirection: "row",
    gap: 6,
  },
  statusBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  statusBtnText: {
    fontSize: 13,
    fontWeight: "800",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  saveBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  centered: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: 50,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});
