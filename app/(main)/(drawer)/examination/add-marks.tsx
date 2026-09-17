import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl, FlatList, Platform, Alert, KeyboardAvoidingView, Modal, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import InternalHeader from "@/components/InternalHeader";
import SelectionBottomSheet from "@/components/common/SelectionBottomSheet";
import apiClient from "@/services/apiClient";
import { fetchClasses } from "@/redux/features/students/thunks";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { useAppTheme } from "@/constants/theme";

interface StudentItem {
  id: string;
  school_id: string;
  exam_id: string;
  class_id: string;
  academic_year_id: string;
  student_id: string;
  subject_id: string;
  exam_schedule_id: string;
  attendance_status: string;
  status: string;
  created_on: string;
  class_name: string;
  section_name: string;
  class: string;
  stu_id: string;
  academic_year: string;
  admission_number: string;
  last_name: string;
  first_name: string;
  roll_number: string;
  // Dynamic fields
  enteredMarks?: string;
}

interface ExamItem {
  id: string | number;
  academic_year: string | number;
  school_id: string | number;
  exam: string;
  status: string;
  created_on?: string;
}

interface SubjectMarkEntry {
  subject_id: string;
  subject_name: string;
  marks: Record<string, string>; // exam_type_id -> mark
  total_marks: string;
  grade_id: string;
}

interface ExamType {
  id: string;
  exam_type: string;
  mark: string;
}

interface GradeItem {
  id: string;
  school_id: string;
  grade_name: string;
  min_percentage: string;
  max_percentage: string;
  status: string;
}

const getGradeBadgeColors = (gradeName: string, isDark: boolean) => {
  const upper = (gradeName || "").toUpperCase();
  if (upper.includes("A") || upper.includes("DIST")) {
    return { bg: isDark ? "#064E3B" : "#ECFDF5", text: "#10B981", border: "#10B981" };
  }
  if (upper.includes("B") || upper.includes("C") || upper.includes("PASS")) {
    return { bg: isDark ? "#451A03" : "#FEF3C7", text: "#D97706", border: "#F59E0B" };
  }
  if (upper.includes("F") || upper.includes("FAIL")) {
    return { bg: isDark ? "#7F1D1D" : "#FEF2F2", text: "#EF4444", border: "#EF4444" };
  }
  return { bg: isDark ? "#1E293B" : "#F0F9FF", text: "#0284C7", border: "#0284C7" };
};

export default function AddMarksScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { classes, isLoadingClasses } = useAppSelector((state) => state.students);

  // Filter list states
  const [exams, setExams] = useState<ExamItem[]>([]);

  // Selected values
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");

  // Loading & UI states
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Student list & search state
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Individual student marks entry modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [isLoadingExamData, setIsLoadingExamData] = useState(false);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [formMarks, setFormMarks] = useState<SubjectMarkEntry[]>([]);
  const [academicYearId, setAcademicYearId] = useState<string>("");
  const [dbGrades, setDbGrades] = useState<GradeItem[]>([]);
  const [isFormDisabled, setIsFormDisabled] = useState(false);

  // Refs for bottom sheets
  const examBottomSheetRef = useRef<BottomSheetModal>(null);
  const classBottomSheetRef = useRef<BottomSheetModal>(null);

  // Ref to track initial load of defaults
  const isFirstLoad = useRef(true);

  // 1. Fetch Classes if empty
  useEffect(() => {
    if (classes.length === 0) {
      dispatch(fetchClasses());
    }
  }, [classes, dispatch]);

  // Set default class on initial load
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

  // 2. Fetch Exams list from API
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
          academic_year: e.academic_year || e.academic_year_id || '',
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

  // Fetch grades list from API
  const fetchGrades = useCallback(async () => {
    try {
      const res = await apiClient.get('/admin/examinations/grades');
      const gradesData = res.data?.data || res.data || {};
      const gradesList = Array.isArray(gradesData?.grades)
        ? gradesData.grades
        : Array.isArray(gradesData)
        ? gradesData
        : Array.isArray(res.data?.grades)
        ? res.data.grades
        : [];
      if (Array.isArray(gradesList)) {
        setDbGrades(gradesList);
      }
    } catch (e: any) {
      console.warn("fetchGrades exception:", e.message);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchExams();
      fetchGrades();
    }
  }, [token, fetchExams, fetchGrades]);

  // Set default exam on initial load
  useEffect(() => {
    if (exams.length > 0 && !selectedExam && isFirstLoad.current) {
      const activeExams = exams.filter(
        (e) => e.status === undefined || String(e.status) === "1"
      );
      const defaultExam = activeExams[0] || exams[0];
      if (defaultExam) {
        setSelectedExam(String(defaultExam.id));
      }
    }
  }, [exams, selectedExam]);

  // Disable initial load auto-selection once all filters are loaded
  useEffect(() => {
    if (selectedClass && selectedExam) {
      isFirstLoad.current = false;
    }
  }, [selectedClass, selectedExam]);

  // 3. Fetch Students for Marks Entry
  const fetchStudents = useCallback(async (isSilent = false) => {
    if (!selectedExam || !selectedClass) return;

    if (!isSilent) {
      setIsLoadingStudents(true);
    }
    setError(null);
    
    try {
      const [studentsRes, resultsRes] = await Promise.all([
        apiClient.get('/admin/students', {
          params: { class_id: selectedClass, limit: 500 }
        }),
        apiClient.get('/admin/examinations/results', {
          params: { exam_id: selectedExam, class_id: selectedClass }
        })
      ]);

      const studentsPayload = studentsRes.data?.data || studentsRes.data || {};
      const rawStudents = Array.isArray(studentsPayload?.students)
        ? studentsPayload.students
        : Array.isArray(studentsPayload)
        ? studentsPayload
        : Array.isArray(studentsRes.data?.students)
        ? studentsRes.data.students
        : [];

      const resultsPayload = resultsRes.data?.data || resultsRes.data || {};
      const resultsData = Array.isArray(resultsPayload?.results)
        ? resultsPayload.results
        : Array.isArray(resultsPayload?.students)
        ? resultsPayload.students
        : Array.isArray(resultsPayload)
        ? resultsPayload
        : [];

      if (Array.isArray(rawStudents)) {
        const list: StudentItem[] = rawStudents.map((s: any) => {
          let existingMarks = "";
          if (Array.isArray(resultsData)) {
            const foundResult = resultsData.find(
              (r: any) => String(r.student_id || r.id) === String(s.id)
            );
            if (foundResult) {
              const val = foundResult.grandTotal ?? foundResult.total_marks_obtained ?? foundResult.total_marks;
              if (val !== undefined && val !== null && val !== "") {
                existingMarks = String(val);
              }
            }
          } else if (typeof resultsData === 'object' && resultsData !== null) {
            const found = resultsData[s.id];
            if (found) {
              const val = found.grandTotal ?? found.total_marks_obtained ?? found.total_marks;
              if (val !== undefined && val !== null && val !== "") {
                existingMarks = String(val);
              }
            }
          }

          return {
            id: String(s.id),
            school_id: String(s.school_id || ""),
            exam_id: String(selectedExam),
            class_id: String(selectedClass),
            academic_year_id: String(s.academic_year_id || ""),
            student_id: String(s.id),
            subject_id: "",
            exam_schedule_id: "",
            attendance_status: "",
            status: String(s.status || "1"),
            created_on: s.created_on || "",
            class_name: s.class_name || "",
            section_name: s.section_name || "",
            class: String(s.class || s.class_id || selectedClass),
            stu_id: String(s.id),
            academic_year: String(s.academic_year || ""),
            admission_number: s.admission_no || s.admission_number || "",
            last_name: s.last_name || "",
            first_name: s.first_name || "",
            roll_number: String(s.roll_no || s.roll_number || ""),
            enteredMarks: existingMarks,
          };
        });
        setStudents(list);
      } else {
        setStudents([]);
        setError("Failed to load student list.");
      }
    } catch (e: any) {
      console.warn("fetchStudents exception:", e.message);
      const errMsg = e.response?.data?.message || e.message || "An error occurred while loading student list.";
      setError(errMsg);
      setStudents([]);
    } finally {
      setIsLoadingStudents(false);
      setRefreshing(false);
    }
  }, [selectedExam, selectedClass]);

  useEffect(() => {
    if (selectedExam && selectedClass) {
      fetchStudents();
    }
  }, [selectedExam, selectedClass, fetchStudents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStudents(true);
  }, [fetchStudents]);

  // Dynamically calculate grade ID based on percentage and dbGrades database config
  const getGradeIdFromPercent = useCallback((pct: number) => {
    if (dbGrades.length === 0) {
      return "";
    }

    const matches = dbGrades.filter((g) => {
      const min = Number(g.min_percentage) || 0;
      const max = Number(g.max_percentage) || 0;
      return pct >= min && pct <= max;
    });

    if (matches.length === 0) {
      return String(dbGrades[dbGrades.length - 1]?.id || "");
    }

    if (matches.length > 1) {
      matches.sort((a, b) => {
        const maxA = Number(a.max_percentage) || 0;
        const maxB = Number(b.max_percentage) || 0;
        return maxA - maxB;
      });
    }

    return String(matches[0].id);
  }, [dbGrades]);

  // Translate grade ID to display name using dbGrades
  const getGradeNameFromId = useCallback((gradeId: string) => {
    const found = dbGrades.find((g) => String(g.id) === String(gradeId));
    if (found) return found.grade_name;
    return "-";
  }, [dbGrades]);

  // Fetch exam types and subject marks from the server
  const fetchStudentExamData = async (student: StudentItem) => {
    setIsLoadingExamData(true);
    try {
      const [configRes, marksheetRes] = await Promise.all([
        apiClient.get('/admin/examinations/exam-subjects/config', {
          params: {
            exam_id: selectedExam,
            class_id: selectedClass,
          }
        }),
        apiClient.get(`/admin/examinations/results/student/${student.student_id || student.id}`, {
          params: { exam_id: selectedExam }
        }).catch(() => null)
      ]);

      const configData = configRes.data?.data || configRes.data || {};
      const rawExamTypes = Array.isArray(configData.examTypes) ? configData.examTypes : [];
      const types: ExamType[] = rawExamTypes.map((et: any) => ({
        id: String(et.exam_type_id || et.id),
        exam_type: et.exam_type_name || et.exam_type || 'Exam',
        mark: String(et.mark || 100),
      }));
      setExamTypes(types);

      const max = types.reduce((acc: number, et: any) => acc + (Number(et.mark) || 0), 0);

      // Student existing marksheet
      const studentMarksheet = marksheetRes?.data?.data || marksheetRes?.data || null;
      const existingMarksList: any[] = Array.isArray(studentMarksheet?.marks)
        ? studentMarksheet.marks
        : Array.isArray(studentMarksheet?.subjectMarks)
        ? studentMarksheet.subjectMarks
        : [];
      const hasSavedMarks = existingMarksList.length > 0;
      setIsFormDisabled(hasSavedMarks);

      // Map: `${subject_id}_${exam_type_id}` -> marks
      const marksMapByKey: Record<string, string> = {};
      existingMarksList.forEach((m: any) => {
        const key = `${m.subject_id}_${m.exam_type_id}`;
        marksMapByKey[key] = String(m.marks ?? "");
      });

      const subjectsList: any[] = Array.isArray(configData.subjects) ? configData.subjects : [];
      const entries: SubjectMarkEntry[] = subjectsList.map((subj: any) => {
        const subId = String(subj.subject_id || subj.id);
        const subName = subj.subject_name || subj.name || `Subject ${subId}`;

        const marksMap: Record<string, string> = {};
        let totalObtained = 0;
        types.forEach((et: any) => {
          const key = `${subId}_${et.id}`;
          const existingVal = marksMapByKey[key] || "";
          marksMap[et.id] = existingVal;
          totalObtained += parseFloat(existingVal) || 0;
        });

        const pct = max > 0 ? (totalObtained / max) * 100 : 0;
        const calculatedGradeId = getGradeIdFromPercent(pct);

        return {
          subject_id: subId,
          subject_name: subName,
          marks: marksMap,
          total_marks: String(totalObtained),
          grade_id: calculatedGradeId,
        };
      });

      setFormMarks(entries);
      const dynamicYear = String(
        configData.academic_year_id ||
        student.academic_year_id ||
        exams.find((e) => String(e.id) === String(selectedExam))?.academic_year ||
        ""
      );
      setAcademicYearId(dynamicYear);
    } catch (e: any) {
      console.warn("fetchStudentExamData exception:", e.message);
      const errMsg = e.response?.data?.message || e.message || "Failed to load exam details.";
      Alert.alert("Error", errMsg);
      setIsModalOpen(false);
    } finally {
      setIsLoadingExamData(false);
    }
  };

  // Open the individual entry modal
  const handleOpenModal = (student: StudentItem) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
    fetchStudentExamData(student);
  };

  // Restrict marks input to numbers and max mark limits
  const handleMarkChange = (subjectId: string, examTypeId: string, value: string, maxMark: number) => {
    let cleanVal = value.replace(/[^0-9]/g, ""); // whole numbers only
    if (cleanVal !== "") {
      const valNum = parseInt(cleanVal, 10);
      if (isNaN(valNum)) cleanVal = "";
      else if (valNum > maxMark) {
        cleanVal = String(maxMark); // Cap at max mark
      } else {
        cleanVal = String(valNum);
      }
    }

    setFormMarks((prev) =>
      prev.map((item) => {
        if (item.subject_id !== subjectId) return item;

        // Update marks map
        const updatedMarks = { ...item.marks, [examTypeId]: cleanVal };

        // Recalculate total marks
        const newTotal = Object.values(updatedMarks).reduce(
          (sum, m) => sum + (parseFloat(m) || 0),
          0
        );

        // Auto calculate grade based on percentage
        const max = examTypes.reduce((acc, et) => acc + (Number(et.mark) || 0), 0);
        const pct = max > 0 ? (newTotal / max) * 100 : 0;
        const newGradeId = getGradeIdFromPercent(pct);

        return {
          ...item,
          marks: updatedMarks,
          total_marks: String(newTotal),
          grade_id: newGradeId
        };
      })
    );
  };

  // Submit complete marks form
  const handleSubmitMarksForm = async () => {
    if (!selectedStudent || formMarks.length === 0) return;

    setIsSubmittingSingle(true);

    const items: any[] = [];
    formMarks.forEach((item) => {
      examTypes.forEach((et) => {
        const markVal = item.marks[et.id];
        if (markVal !== undefined && markVal !== "") {
          items.push({
            subject_id: parseInt(item.subject_id, 10),
            exam_type_id: parseInt(et.id, 10),
            marks: parseFloat(markVal),
            grade_id: item.grade_id ? parseInt(item.grade_id, 10) : undefined,
          });
        }
      });
    });

    if (items.length === 0) {
      Alert.alert("Warning", "Please enter marks for at least one subject.");
      setIsSubmittingSingle(false);
      return;
    }

    const payload: any = {
      exam_id: parseInt(selectedExam, 10),
      class_id: parseInt(selectedClass, 10),
      student_id: parseInt(selectedStudent.student_id || selectedStudent.id, 10),
      items,
    };
    if (academicYearId) {
      payload.academic_year_id = parseInt(academicYearId, 10);
    }

    try {
      const res = await apiClient.post('/admin/examinations/results/save-marks', payload);
      if (res.status === 200 || res.data?.success) {
        Alert.alert("Success", "Marks saved successfully!");
        
        // Update local student array so the UI reflects that marks are saved
        const totalMarksSum = formMarks.reduce(
          (sum, item) => sum + (Number(item.total_marks) || 0),
          0
        );
        setStudents((prev) =>
          prev.map((s) =>
            (s.student_id === selectedStudent.student_id || s.id === selectedStudent.id)
              ? { ...s, enteredMarks: String(totalMarksSum) }
              : s
          )
        );

        setIsModalOpen(false);
      } else {
        Alert.alert("Error", res.data?.message || "Failed to save marks.");
      }
    } catch (e: any) {
      console.warn("savestudentmarks exception:", e.message);
      const errMsg = e.response?.data?.message || e.message || "Failed to save marks.";
      Alert.alert("Error", errMsg);
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  // Memoized dropdown data
  const classData = useMemo(() => {
    return classes
      .filter((c) => c.status === undefined || String(c.status) === "1")
      .map((c) => ({
        id: String(c.id),
        name: c.class_name ? `Class ${c.class_name}` : `Class ${c.id}`,
      }));
  }, [classes]);

  const examData = useMemo(() => {
    return exams
      .filter((e) => e.status === undefined || String(e.status) === "1")
      .map((e) => ({
        id: String(e.id),
        name: e.exam,
      }));
  }, [exams]);


  const selectedClassObj = classes.find((c) => String(c.id) === String(selectedClass));
  const selectedExamObj = exams.find((e) => String(e.id) === String(selectedExam));

  // Filter students based on search input
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => {
      const name = `${s.first_name || ""} ${s.last_name || ""}`.toLowerCase();
      const roll = String(s.roll_number || "").toLowerCase();
      const adm = String(s.admission_number || "").toLowerCase();
      return name.includes(q) || roll.includes(q) || adm.includes(q);
    });
  }, [students, searchQuery]);

  // Aggregate stats
  const studentStats = useMemo(() => {
    const total = students.length;
    const entered = students.filter(
      (s) => s.enteredMarks !== undefined && s.enteredMarks !== "" && s.enteredMarks !== "null"
    ).length;
    const pending = total - entered;
    return { total, entered, pending };
  }, [students]);

  const renderStudentRow = ({ item }: { item: StudentItem }) => {
    const fullName = `${item.first_name || ""} ${item.last_name || ""}`.trim() || "Student";
    const initials = (fullName.split(" ").map((n) => n[0]).join("") || "ST").substring(0, 2).toUpperCase();
    const hasMarks = item.enteredMarks !== undefined && item.enteredMarks !== "" && item.enteredMarks !== "null";

    return (
      <TouchableOpacity
        style={[
          styles.studentCard,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
            borderLeftColor: hasMarks ? "#10B981" : colors.primary,
          },
        ]}
        onPress={() => handleOpenModal(item)}
        activeOpacity={0.7}
      >
        {/* Top Header: Avatar + Student Info + Status Pill */}
        <View style={styles.cardHeaderRow}>
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: hasMarks
                  ? isDark
                    ? "#064E3B"
                    : "#ECFDF5"
                  : isDark
                    ? "#1E293B"
                    : colors.primaryLight,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                { color: hasMarks ? "#10B981" : colors.primary },
              ]}
            >
              {initials}
            </Text>
          </View>

          <View style={styles.studentInfoCol}>
            <Text style={[styles.studentName, { color: colors.text }]} numberOfLines={1}>
              {fullName}
            </Text>
            <View style={styles.badgeRow}>
              {item.roll_number ? (
                <View style={[styles.metaChip, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                  <Text style={[styles.metaChipText, { color: colors.textMuted }]}>
                    Roll: {item.roll_number}
                  </Text>
                </View>
              ) : null}

              {item.admission_number ? (
                <View style={[styles.metaChip, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                  <Text style={[styles.metaChipText, { color: colors.textMuted }]}>
                    Adm: {item.admission_number}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Status Badge */}
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: hasMarks
                  ? isDark
                    ? "#064E3B"
                    : "#ECFDF5"
                  : isDark
                    ? "#451A03"
                    : "#FFFBEB",
                borderColor: hasMarks ? "#10B981" : "#F59E0B",
              },
            ]}
          >
            <Ionicons
              name={hasMarks ? "checkmark-circle" : "time-outline"}
              size={12}
              color={hasMarks ? "#10B981" : "#D97706"}
              style={{ marginRight: 4 }}
            />
            <Text
              style={[
                styles.statusPillText,
                { color: hasMarks ? "#10B981" : "#D97706" },
              ]}
            >
              {hasMarks ? "Entered" : "Pending"}
            </Text>
          </View>
        </View>

        {/* Subtle Horizontal Divider */}
        <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

        {/* Bottom Action Footer */}
        <View style={styles.cardFooterRow}>
          <View style={styles.marksSummaryBox}>
            {hasMarks ? (
              <View style={styles.marksSummaryInner}>
                <Ionicons name="ribbon-outline" size={15} color="#10B981" style={{ marginRight: 5 }} />
                <Text style={[styles.marksLabel, { color: colors.textMuted }]}>
                  Total:
                </Text>
                <Text style={[styles.marksScoreHighlight, { color: colors.text }]}>
                  {item.enteredMarks}
                </Text>
              </View>
            ) : (
              <View style={styles.marksSummaryInner}>
                <Ionicons name="create-outline" size={15} color={colors.textMuted} style={{ marginRight: 5 }} />
                <Text style={[styles.marksPendingText, { color: colors.textMuted }]}>
                  No marks entered
                </Text>
              </View>
            )}
          </View>

          <View
            style={[
              styles.actionBtn,
              hasMarks
                ? {
                    backgroundColor: isDark ? "#064E3B" : "#F0FDF4",
                    borderColor: "#10B981",
                  }
                : {
                    backgroundColor: colors.primary,
                    borderColor: colors.primary,
                  },
            ]}
          >
            <Text
              style={[
                styles.actionBtnText,
                { color: hasMarks ? "#10B981" : "#FFFFFF" },
              ]}
            >
              {hasMarks ? "View Marks" : "Add Marks"}
            </Text>
            <Ionicons
              name={hasMarks ? "eye-outline" : "add-circle-outline"}
              size={13}
              color={hasMarks ? "#10B981" : "#FFFFFF"}
              style={{ marginLeft: 4 }}
            />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (isLoadingStudents) return null;

    if (students.length > 0 && filteredStudents.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSubtle }]}>
            <Ionicons name="search-outline" size={44} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Students Found</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            No students match "{searchQuery}".
          </Text>
          <TouchableOpacity
            style={[styles.clearSearchBtn, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}
            onPress={() => setSearchQuery("")}
            activeOpacity={0.8}
          >
            <Text style={[styles.clearSearchBtnText, { color: colors.primary }]}>Clear Search</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: colors.surfaceSubtle },
          ]}
        >
          <Ionicons name="create-outline" size={48} color={colors.textMuted} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {!selectedExam || !selectedClass ? "Select Filters" : "No Students Found"}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          {!selectedExam || !selectedClass
            ? "Please configure the filters above to load the student list."
            : "No students are registered for the selected exam and class."}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <InternalHeader title="Add Student Marks" onBack={() => router.back()} />

        {/* Filter Section */}
        <View style={[styles.filterCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.filterRow}>
            {/* Exam Dropdown */}
            <TouchableOpacity
              style={[styles.filterSelector, { marginRight: 8 }]}
              onPress={() => examBottomSheetRef.current?.present()}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Exam</Text>
              <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                <Text style={[styles.selectorValue, { color: colors.text }]} numberOfLines={1}>
                  {selectedExamObj ? selectedExamObj.exam : "Choose Exam"}
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
                    ? `Class ${selectedClassObj.class_name || selectedClassObj.id}`
                    : "Choose Class"}
                </Text>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search & Stats Bar when students are available */}
        {selectedExam && selectedClass && students.length > 0 && (
          <View style={styles.searchAndStatsContainer}>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.cardBg, borderColor: colors.border },
              ]}
            >
              <Ionicons name="search-outline" size={17} color={colors.textMuted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search student by name or roll no..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.statsRow}>
              <Text style={[styles.statsTitle, { color: colors.textMuted }]}>
                {filteredStudents.length} {filteredStudents.length === 1 ? "Student" : "Students"}
              </Text>
              <View style={styles.statsPillsGroup}>
                <View
                  style={[
                    styles.statBadge,
                    {
                      backgroundColor: isDark ? "#064E3B" : "#ECFDF5",
                      borderColor: "#10B981",
                    },
                  ]}
                >
                  <View style={[styles.statDot, { backgroundColor: "#10B981" }]} />
                  <Text style={[styles.statBadgeText, { color: "#10B981" }]}>
                    {studentStats.entered} Entered
                  </Text>
                </View>
                <View
                  style={[
                    styles.statBadge,
                    {
                      backgroundColor: isDark ? "#451A03" : "#FFFBEB",
                      borderColor: "#F59E0B",
                    },
                  ]}
                >
                  <View style={[styles.statDot, { backgroundColor: "#F59E0B" }]} />
                  <Text style={[styles.statBadgeText, { color: "#D97706" }]}>
                    {studentStats.pending} Pending
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {isLoadingStudents && !refreshing ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading student list...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#ef4444" style={{ marginBottom: 12 }} />
            <Text style={styles.errorTitle}>Error Loading List</Text>
            <Text style={[styles.errorSubtitle, { color: colors.textMuted }]}>{error}</Text>
            <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => fetchStudents()}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredStudents}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderStudentRow}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primary, "#10b981"]}
              />
            }
          />
        )}

        {/* Modal for adding/editing student marks */}
        <Modal
          visible={isModalOpen}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                { backgroundColor: colors.surface },
              ]}
            >
              <View style={[styles.handleIndicator, { backgroundColor: colors.border }]} />
              <View
                style={[
                  styles.modalHeader,
                  { borderBottomColor: colors.border },
                ]}
              >
                <View style={styles.modalHeaderTitleRow}>
                  <View style={[styles.modalTitleIconBox, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="journal" size={20} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      Exam Results Entry
                    </Text>
                    {selectedStudent && (
                      <Text
                        style={[styles.modalSubTitle, { color: colors.textMuted }]}
                      >
                        {`${selectedStudent.first_name || ""} ${selectedStudent.last_name || ""}`.trim()}
                      </Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setIsModalOpen(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close-circle" size={26} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {isLoadingExamData ? (
                <View style={styles.modalCentered}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                    Fetching exam data & marks...
                  </Text>
                </View>
              ) : selectedStudent ? (
                <View style={{ flex: 1 }}>
                  {/* Vibrant Gradient Student Details Card */}
                  <LinearGradient
                    colors={isDark ? ["#1E293B", "#0F172A"] : ["#312E81", "#4338CA"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.modalStudentBannerGradient}
                  >
                    <View style={styles.bannerHeaderRow}>
                      <Ionicons name="person-circle-outline" size={22} color="#F59E0B" style={{ marginRight: 8 }} />
                      <Text style={styles.bannerStudentName}>
                        {`${selectedStudent.first_name || ""} ${selectedStudent.last_name || ""}`.trim() || "Student Marks Sheet"}
                      </Text>
                    </View>
                    <View style={styles.modalStudentInfoRow}>
                      <View style={styles.bannerMetaChip}>
                        <Text style={styles.bannerMetaLabel}>Roll No</Text>
                        <Text style={styles.bannerMetaValue}>{selectedStudent.roll_number || "N/A"}</Text>
                      </View>
                      <View style={styles.bannerMetaChip}>
                        <Text style={styles.bannerMetaLabel}>Admission No</Text>
                        <Text style={styles.bannerMetaValue}>{selectedStudent.admission_number || "N/A"}</Text>
                      </View>
                      <View style={styles.bannerMetaChip}>
                        <Text style={styles.bannerMetaLabel}>Class</Text>
                        <Text style={styles.bannerMetaValue}>{selectedStudent.class_name || selectedClass}</Text>
                      </View>
                    </View>
                  </LinearGradient>

                  {/* Scrollable Subjects Form */}
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.modalFormContent}
                  >
                    {formMarks.map((item) => {
                      const subjectMaxMarks = examTypes.reduce(
                        (acc, et) => acc + (Number(et.mark) || 0),
                        0,
                      );
                      const gradeName = getGradeNameFromId(item.grade_id);
                      const gradeStyle = getGradeBadgeColors(gradeName, isDark);

                      return (
                        <View
                          key={item.subject_id}
                          style={[
                            styles.subjectMarkCard,
                            {
                              backgroundColor: colors.cardBg,
                              borderColor: colors.border,
                              borderLeftColor: colors.primary,
                            },
                          ]}
                        >
                          <View style={styles.subjectCardTitleRow}>
                            <Ionicons name="book" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                            <Text
                              style={[
                                styles.subjectHeaderName,
                                { color: colors.text },
                              ]}
                            >
                              {item.subject_name}
                            </Text>
                          </View>

                          {/* Exam Type Inputs Row */}
                          <View style={styles.marksInputsRow}>
                            {examTypes.map((et) => (
                              <View key={et.id} style={styles.markInputCol}>
                                <Text
                                  style={[
                                    styles.markInputLabel,
                                    { color: colors.textMuted },
                                  ]}
                                  numberOfLines={1}
                                >
                                  {et.exam_type} ({et.mark})
                                </Text>
                                <TextInput
                                  style={[
                                    styles.markTextInput,
                                    {
                                      backgroundColor: colors.inputBg,
                                      borderColor: colors.inputBorder,
                                      color: colors.text,
                                    },
                                    isFormDisabled && [
                                      styles.disabledMarkTextInput,
                                      {
                                        backgroundColor: isDark
                                          ? "#334155"
                                          : "#f1f5f9",
                                        borderColor: colors.border,
                                        color: colors.textMuted,
                                      },
                                    ],
                                  ]}
                                  keyboardType="numeric"
                                  placeholder="0"
                                  placeholderTextColor={colors.textMuted}
                                  value={item.marks[et.id] || ""}
                                  onChangeText={(val) =>
                                    handleMarkChange(
                                      item.subject_id,
                                      et.id,
                                      val,
                                      Number(et.mark),
                                    )
                                  }
                                  maxLength={3}
                                  editable={!isFormDisabled}
                                />
                              </View>
                            ))}
                          </View>

                          {/* Calculated Total & Grade Display */}
                          <View
                            style={[
                              styles.subjectScoreRow,
                              { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                            ]}
                          >
                            <View style={styles.totalScoreBox}>
                              <Ionicons name="calculator-outline" size={15} color={colors.primary} style={{ marginRight: 5 }} />
                              <Text
                                style={[
                                  styles.subjectTotalText,
                                  { color: colors.textMuted },
                                ]}
                              >
                                Total:{" "}
                                <Text
                                  style={[
                                    styles.subjectTotalVal,
                                    { color: colors.primary },
                                  ]}
                                >
                                  {item.total_marks}
                                </Text>{" "}
                                / {subjectMaxMarks}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.autoGradeBadge,
                                {
                                  backgroundColor: gradeStyle.bg,
                                  borderColor: gradeStyle.border,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.autoGradeText,
                                  { color: gradeStyle.text },
                                ]}
                              >
                                Grade: {gradeName}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>

                  {/* Sticky Save Button */}
                  <View
                    style={[
                      styles.modalFooterBar,
                      {
                        backgroundColor: colors.surface,
                        borderTopColor: colors.border,
                      },
                    ]}
                  >
                    {isFormDisabled ? (
                      <View
                        style={[
                          styles.disabledSubmitContainer,
                          {
                            backgroundColor: isDark ? "#334155" : "#f1f5f9",
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Ionicons
                          name="lock-closed-outline"
                          size={18}
                          color={colors.textMuted}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.disabledSubmitText,
                            { color: colors.textMuted },
                          ]}
                        >
                          Marks Already Submitted
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        disabled={isSubmittingSingle}
                        onPress={handleSubmitMarksForm}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={["#4F46E5", "#3B82F6"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.modalSubmitBtnGradient}
                        >
                          {isSubmittingSingle ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons
                                name="checkmark-circle-outline"
                                size={20}
                                color="#fff"
                                style={{ marginRight: 6 }}
                              />
                              <Text style={styles.modalSubmitBtnText}>
                                Save All Marks
                              </Text>
                            </>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* Selection Bottom Sheets */}
        <SelectionBottomSheet
          ref={examBottomSheetRef}
          title="Select Exam"
          data={examData}
          onSelect={(item) => {
            setSelectedExam(String(item.id));
            isFirstLoad.current = false;
          }}
          loading={isLoadingExams}
        />

        <SelectionBottomSheet
          ref={classBottomSheetRef}
          title="Select Class"
          data={classData}
          onSelect={(item) => {
            setSelectedClass(String(item.id));
            isFirstLoad.current = false;
          }}
          loading={isLoadingClasses}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  filterCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
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
    color: "#64748b",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectorValueBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  selectorValue: {
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  searchAndStatsContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    fontWeight: "500",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  statsTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  statsPillsGroup: {
    flexDirection: "row",
    gap: 6,
  },
  statBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  clearSearchBtn: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  clearSearchBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  studentCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    fontWeight: "800",
    fontSize: 15,
  },
  studentInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  studentName: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  metaChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  metaChipText: {
    fontSize: 10,
    fontWeight: "600",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    marginVertical: 10,
  },
  cardFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  marksSummaryBox: {
    flex: 1,
    marginRight: 8,
  },
  marksSummaryInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  marksLabel: {
    fontSize: 12,
    fontWeight: "500",
    marginRight: 4,
  },
  marksScoreHighlight: {
    fontSize: 14,
    fontWeight: "800",
  },
  marksPendingText: {
    fontSize: 12,
    fontWeight: "500",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    marginTop: 50,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 10,
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    marginTop: 40,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ef4444",
    marginTop: 12,
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "flex-end",
  },
  handleIndicator: {
    width: 44,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    width: "100%",
    height: "92%",
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalSubTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  modalCentered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modalTitleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalStudentBannerGradient: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  bannerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  bannerStudentName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  bannerMetaChip: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flex: 1,
    marginHorizontal: 3,
  },
  bannerMetaLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#93C5FD",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  bannerMetaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  modalStudentCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  modalStudentInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modalMetaLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  modalMetaValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalFormContent: {
    paddingBottom: 40,
  },
  subjectMarkCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  subjectCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  subjectHeaderName: {
    fontSize: 15,
    fontWeight: "700",
  },
  marksInputsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  markInputCol: {
    flex: 1,
    marginHorizontal: 4,
  },
  markInputLabel: {
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  markTextInput: {
    height: 42,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
  },
  subjectScoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  totalScoreBox: {
    flexDirection: "row",
    alignItems: "center",
  },
  subjectTotalText: {
    fontSize: 12,
    fontWeight: "600",
  },
  subjectTotalVal: {
    fontSize: 15,
    fontWeight: "800",
  },
  autoGradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  autoGradeText: {
    fontSize: 11,
    fontWeight: "800",
  },

  modalFooterBar: {
    borderTopWidth: 1,
    paddingTop: 12,
  },
  modalSubmitBtnGradient: {
    borderRadius: 14,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  modalSubmitBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  disabledMarkTextInput: {},
  disabledSubmitContainer: {
    borderRadius: 12,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    borderWidth: 1,
  },
  disabledSubmitText: {
    fontWeight: "700",
    fontSize: 15,
  },
});
