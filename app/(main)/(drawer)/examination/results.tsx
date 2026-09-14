import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, TextInput, RefreshControl, FlatList, Platform} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import InternalHeader from '@/components/InternalHeader';
import SelectionBottomSheet from '@/components/common/SelectionBottomSheet';
import apiClient from '@/services/apiClient';
import { fetchClasses } from '@/redux/features/students/thunks';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/constants/theme';

interface StudentResultItem {
  id: string;
  admission_number: string;
  roll_no: string;
  student_name: string;
  marks: {
    subject: string;
    marks: number;
    max_marks: number;
    grade: string;
  }[];
  total_obtained: number;
  total_max: number;
  percentage: string;
  grade: string;
  status: string;
}

interface AcademicYearItem {
  id: string | number;
  academic_year: string;
  is_current: string;
  status: string;
}

interface ExamItem {
  id: string | number;
  academic_year: string | number;
  school_id: string | number;
  exam: string;
  status: string;
  created_on?: string;
}

interface ApiSubject {
  total_marks: number | string;
  grade: string;
}

interface ApiStudent {
  admission_number: string;
  first_name: string;
  last_name: string;
  roll_number: string;
  class_name: string;
  total_marks: number | string;
  subjects: Record<string, ApiSubject>;
}

export default function ExamResultsScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const { classes, isLoadingClasses } = useAppSelector((state) => state.students);

  // Selector list states
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);

  // Selected values
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedExam, setSelectedExam] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [results, setResults] = useState<StudentResultItem[]>([]);

  // Loading & UX states
  const [isLoadingYears, setIsLoadingYears] = useState(false);
  const [isLoadingExams, setIsLoadingExams] = useState(false);
  const [isLoadingResults, setIsLoadingResults] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Expansion
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  // Bottom Sheet Refs
  const yearBottomSheetRef = useRef<BottomSheetModal>(null);
  const examBottomSheetRef = useRef<BottomSheetModal>(null);
  const classBottomSheetRef = useRef<BottomSheetModal>(null);

  // 1. Fetch Classes if empty
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
    setError(null);
    try {
      const res = await apiClient.get('/teacher/academics/years');
      const list = res.data || [];
      if (Array.isArray(list)) {
        setAcademicYears(list);
        const currentYear = list.find((y: AcademicYearItem) => String(y.is_current) === "1") || list[0];
        if (currentYear) {
          setSelectedYear(String(currentYear.id));
        }
      } else {
        setError("Failed to fetch academic years.");
      }
    } catch (e: any) {
      console.warn("results.tsx: fetchYears exception:", e.message);
      setError("An error occurred while loading academic years.");
    } finally {
      setIsLoadingYears(false);
    }
  }, []);

  // 4. Fetch Exams
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
      console.warn("results.tsx: fetchExams exception:", e.message);
    } finally {
      setIsLoadingExams(false);
    }
  }, []);

  // Initial data loading
  useEffect(() => {
    if (token) {
      fetchYears();
      fetchExams();
    }
  }, [token, fetchYears, fetchExams]);

  // Handle auto-exam selection when year changes or exams load
  useEffect(() => {
    if (exams.length > 0) {
      const activeExams = exams.filter(
        (e) => e.status === undefined || String(e.status) === "1"
      );
      const matchingExams = activeExams.filter(
        (e) => !selectedYear || String(e.academic_year) === String(selectedYear)
      );
      const finalExams = matchingExams.length > 0 ? matchingExams : activeExams;
      
      const isCurrentExamValid = finalExams.some(e => String(e.id) === String(selectedExam));
      if (!isCurrentExamValid) {
        if (finalExams.length > 0) {
          setSelectedExam(String(finalExams[0].id));
        } else {
          setSelectedExam("");
        }
      }
    }
  }, [selectedYear, exams, selectedExam]);

  // Fetch real exam results list from API
  const fetchResults = useCallback(async (isSilent = false) => {
    if (!selectedYear || !selectedExam || !selectedClass) return;
    
    if (!isSilent) {
      setIsLoadingResults(true);
    }
    setError(null);

    try {
      const res = await apiClient.get('/admin/examinations/results', {
        params: {
          academic_year_id: selectedYear,
          exam_id: selectedExam,
          class_id: selectedClass,
        },
      });

      const resData = res.data;
      if (resData && (resData.results || resData.students)) {
        if (Array.isArray(resData.results)) {
          const subjectsList = resData.subjects || [];
          const formattedList: StudentResultItem[] = resData.results.map((r: any) => {
            let marksList: any[] = [];
            if (r.subjectTotals && Object.keys(r.subjectTotals).length > 0) {
              marksList = Object.entries(r.subjectTotals).map(([subId, info]: [string, any]) => {
                const foundSub = subjectsList.find((s: any) => String(s.subject_id) === String(subId));
                return {
                  subject: foundSub?.subject_name || `Subject #${subId}`,
                  marks: Number(info.total_marks || 0),
                  max_marks: Number(foundSub?.max_marks || 100),
                  grade: info.grade_name || "N/A",
                };
              });
            } else if (Array.isArray(r.subjectMarks)) {
              marksList = r.subjectMarks.map((m: any) => ({
                subject: m.subject_name || `Subject #${m.subject_id}`,
                marks: Number(m.marks || 0),
                max_marks: 100,
                grade: m.grade_name || "N/A",
              }));
            }

            const totalObtained = Number(r.grandTotal ?? r.total_marks_obtained ?? 0);
            const totalMax = Number(r.maxMarks || (marksList.length > 0 ? marksList.length * 100 : 100));
            const pctVal = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
            const percentage = (typeof r.percentage === 'number' ? r.percentage : pctVal).toFixed(1) + "%";
            const status = r.result_status || (pctVal >= 33 ? "Pass" : "Fail");

            let grade = "F";
            if (pctVal >= 90) grade = "A+";
            else if (pctVal >= 80) grade = "A";
            else if (pctVal >= 70) grade = "B+";
            else if (pctVal >= 60) grade = "B";
            else if (pctVal >= 50) grade = "C";
            else if (pctVal >= 40) grade = "D";

            return {
              id: String(r.id || r.student_id),
              roll_no: String(r.roll_no || r.roll_number || "N/A"),
              admission_number: String(r.admission_no || r.admission_number || "N/A"),
              student_name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || "Unknown",
              marks: marksList,
              total_obtained: totalObtained,
              total_max: totalMax,
              percentage,
              grade,
              status,
            };
          });
          setResults(formattedList);
        } else {
          // Legacy student map object
          const studentsObj = resData.students || {};
          const formattedList = Object.entries(studentsObj).map(([id, studentData]) => {
            const s = studentData as ApiStudent;
            const marksList = Object.entries(s.subjects || {}).map(([subjectName, subjectInfo]) => {
              const subjData = subjectInfo as ApiSubject;
              return {
                subject: subjectName,
                marks: Number(subjData.total_marks || 0),
                max_marks: 100,
                grade: subjData.grade || "N/A",
              };
            });

            const totalObtained = Number(s.total_marks || 0);
            const totalMax = marksList.length * 100;
            const pctVal = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
            const percentage = pctVal.toFixed(1) + "%";
            const hasFail = marksList.some(m => m.grade.toUpperCase() === "F" || m.grade.toUpperCase() === "FAIL");
            const status = (pctVal >= 35 && !hasFail) ? "Pass" : "Fail";

            let grade = "F";
            if (pctVal >= 90) grade = "A+";
            else if (pctVal >= 80) grade = "A";
            else if (pctVal >= 70) grade = "B+";
            else if (pctVal >= 60) grade = "B";
            else if (pctVal >= 50) grade = "C";
            else if (pctVal >= 40) grade = "D";

            return {
              id: String(id),
              roll_no: s.roll_number || "N/A",
              admission_number: s.admission_number || "N/A",
              student_name: `${s.first_name || ""} ${s.last_name || ""}`.trim() || "Unknown",
              marks: marksList,
              total_obtained: totalObtained,
              total_max: totalMax,
              percentage,
              grade,
              status,
            };
          });
          setResults(formattedList);
        }
      } else {
        setError(resData?.message || "Failed to load exam results.");
        setResults([]);
      }
    } catch (e: any) {
      console.warn("results.tsx: fetchResults exception:", e.message);
      setError(e.message || "An error occurred while loading exam results.");
      setResults([]);
    } finally {
      setIsLoadingResults(false);
      setRefreshing(false);
    }
  }, [selectedYear, selectedExam, selectedClass]);

  useEffect(() => {
    if (selectedYear && selectedExam && selectedClass) {
      fetchResults();
    }
  }, [selectedYear, selectedExam, selectedClass, fetchResults]);

  // Auto-refresh results on focus (e.g. after returning from add-marks)
  useFocusEffect(
    useCallback(() => {
      if (selectedYear && selectedExam && selectedClass) {
        fetchResults(results.length > 0);
      }
    }, [selectedYear, selectedExam, selectedClass, fetchResults, results.length])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedYear && selectedExam && selectedClass) {
      await fetchResults(true);
    } else {
      await Promise.all([fetchYears(), fetchExams()]);
      setRefreshing(false);
    }
  }, [selectedYear, selectedExam, selectedClass, fetchResults, fetchYears, fetchExams]);

  // Formatted options for SelectionBottomSheets
  const yearData = useMemo(() => {
    return academicYears.map((y) => ({
      id: String(y.id),
      name: y.academic_year ? `Academic Year ${y.academic_year}` : `Year ${y.id}`,
    }));
  }, [academicYears]);

  const classData = useMemo(() => {
    return classes
      .filter((c) => c.status === undefined || String(c.status) === "1")
      .map((c) => ({
        id: String(c.id),
        name: c.class_name ? `Class ${c.class_name}` : `Class ${c.id}`,
      }));
  }, [classes]);

  const examData = useMemo(() => {
    const activeExams = exams.filter(
      (e) => e.status === undefined || String(e.status) === "1"
    );
    const filteredByYear = activeExams.filter(
      (e) => !selectedYear || String(e.academic_year) === String(selectedYear)
    );
    const finalExams = filteredByYear.length > 0 ? filteredByYear : activeExams;

    return finalExams.map((e) => ({
      id: String(e.id),
      name: e.exam,
    }));
  }, [exams, selectedYear]);

  // Finder helpers
  const selectedYearObj = useMemo(() => {
    return academicYears.find((y) => String(y.id) === String(selectedYear));
  }, [academicYears, selectedYear]);

  const selectedClassObj = useMemo(() => {
    return classes.find((c) => String(c.id) === String(selectedClass));
  }, [classes, selectedClass]);

  const selectedExamObj = useMemo(() => {
    return exams.find((e) => String(e.id) === String(selectedExam));
  }, [exams, selectedExam]);

  // Filter students based on search input
  const filteredResults = useMemo(() => {
    if (!searchQuery) return results;
    const query = searchQuery.toLowerCase().trim();
    return results.filter(
      (r) =>
        r.student_name.toLowerCase().includes(query) ||
        r.roll_no.toLowerCase().includes(query)
    );
  }, [results, searchQuery]);

  // Render individual student card
  const renderResultItem = ({ item }: { item: StudentResultItem }) => {
    const isExpanded = expandedStudentId === item.id;
    const isPassed = item.status.toLowerCase() === 'pass';

    return (
      <View style={[styles.resultCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.cardHeader}
          activeOpacity={0.7}
          onPress={() => setExpandedStudentId(isExpanded ? null : item.id)}
        >
          {/* Student Avatar / Initials */}
          <View style={[styles.avatar, { backgroundColor: isPassed ? (isDark ? '#064e3b' : '#ecfdf5') : (isDark ? '#7f1d1d' : '#fee2e2') }]}>
            <Text style={[styles.avatarText, { color: isPassed ? '#10b981' : '#ef4444' }]}>
              {item.student_name.split(' ').map(n => n[0]).join('')}
            </Text>
          </View>

          <View style={styles.studentInfo}>
            <Text style={[styles.studentName, { color: colors.text }]}>{item.student_name}</Text>
            <Text style={[styles.rollNo, { color: colors.textMuted }]}>Roll No: {item.roll_no}</Text>
          </View>

          <View style={styles.rightSection}>
            <View style={styles.scoreContainer}>
              <Text style={[styles.percentageText, { color: colors.text }]}>{item.percentage}</Text>
              <Text style={[styles.gradeText, { color: colors.textMuted }]}>Grade {item.grade}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isPassed ? '#10b981' : '#ef4444' }]}>
              <Text style={styles.statusBadgeText}>{item.status}</Text>
            </View>
            <Ionicons
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textMuted}
              style={styles.chevron}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.detailsTitle, { color: colors.text }]}>Subject Breakdown</Text>
            
            {/* Table Header */}
            <View style={[styles.tableHeader, { backgroundColor: colors.surfaceSubtle }]}>
              <Text style={[styles.tableHeaderCell, { flex: 2, color: colors.text }]}>Subject</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'center', color: colors.text }]}>Marks</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'center', color: colors.text }]}>Grade</Text>
            </View>

            {/* Table Rows */}
            {item.marks.map((m, idx) => (
              <View key={idx} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.tableCell, { flex: 2, fontWeight: '500', color: colors.text }]}>{m.subject}</Text>
                <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'center', color: colors.textMuted }]}>
                  {m.marks} / {m.max_marks}
                </Text>
                <Text style={[
                  styles.tableCell,
                  { 
                    flex: 1, 
                    textAlign: 'center', 
                    fontWeight: '700',
                    color: m.grade.includes('A') ? '#10b981' : m.grade === 'F' ? '#ef4444' : '#f59e0b'
                  }
                ]}>
                  {m.grade}
                </Text>
              </View>
            ))}

            {/* Total Row */}
            <View style={[styles.summaryRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.text }]}>Total:</Text>
              <Text style={[styles.summaryValue, { color: colors.primary }]}>{item.total_obtained} / {item.total_max}</Text>
            </View>
          </View>
        )}
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    if (isLoadingResults) return null;

    const missing = [];
    if (!selectedYear) missing.push("Academic Year");
    if (!selectedClass) missing.push("Class");
    if (!selectedExam) missing.push("Exam");

    if (missing.length > 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="funnel-outline" size={48} color="#94a3b8" />
          </View>
          <Text style={styles.emptyTitle}>Select Search Filters</Text>
          <Text style={styles.emptySubtitle}>
            Please select the {missing.join(", ")} above to load student exam results.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View style={styles.iconCircle}>
          <Ionicons name="search-outline" size={48} color="#94a3b8" />
        </View>
        <Text style={styles.emptyTitle}>No Results Found</Text>
        <Text style={styles.emptySubtitle}>
          No students found matching your search query "{searchQuery}".
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader 
        title="Exam Results" 
        rightAction={
          <TouchableOpacity 
            style={{ 
              backgroundColor: colors.primary, 
              paddingHorizontal: 12, 
              paddingVertical: 8, 
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
            }}
            onPress={() => router.push('/(main)/(drawer)/examination/add-marks')}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle-outline" size={16} color="#fff" style={{ marginRight: 4 }} />
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Add Marks</Text>
          </TouchableOpacity>
        }
      />

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
                {selectedYearObj ? selectedYearObj.academic_year : "Choose Year"}
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

        {/* Row 2: Exam Selector */}
        <View style={[styles.filterRow, { marginTop: 12 }]}>
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
      </View>

      {/* Notice Banner is removed since live API is integrated */}

      {/* Local Search Input */}
      {selectedYear && selectedExam && selectedClass && !isLoadingResults && (
        <View
          style={[
            styles.searchContainer,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
            },
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={colors.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search student by name or roll no..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCorrect={false}
          />
          {searchQuery !== "" && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Main Content Area */}
      {isLoadingResults && !refreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3d5ee1" />
          <Text style={styles.loadingText}>Fetching Exam Results...</Text>
        </View>
      ) : (
        <FlatList
          data={selectedYear && selectedExam && selectedClass ? filteredResults : []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderResultItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#3d5ee1", "#10b981"]}
            />
          }
        />
      )}

      {/* Selection Bottom Sheets */}
      <SelectionBottomSheet
        ref={yearBottomSheetRef}
        title="Select Academic Year"
        data={yearData}
        onSelect={(item) => setSelectedYear(String(item.id))}
        loading={isLoadingYears}
      />

      <SelectionBottomSheet
        ref={classBottomSheetRef}
        title="Select Class"
        data={classData}
        onSelect={(item) => setSelectedClass(String(item.id))}
        loading={isLoadingClasses}
      />

      <SelectionBottomSheet
        ref={examBottomSheetRef}
        title="Select Exam"
        data={examData}
        onSelect={(item) => setSelectedExam(String(item.id))}
        loading={isLoadingExams}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  filterCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
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
    flexDirection: 'row',
  },
  filterSelector: {
    flex: 1,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectorValueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  selectorValue: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    height: 48,
    marginBottom: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  noticeBox: {
    flexDirection: 'row',
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  noticeIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: '#0369a1',
    lineHeight: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  rollNo: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreContainer: {
    alignItems: 'flex-end',
    marginRight: 10,
  },
  percentageText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  gradeText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  chevron: {
    marginLeft: 8,
  },
  expandedContent: {
    backgroundColor: '#f8fafc',
    padding: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginBottom: 12,
  },
  detailsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingBottom: 6,
    marginBottom: 8,
  },
  tableHeaderCell: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tableCell: {
    fontSize: 13,
    color: '#475569',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginRight: 6,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    marginTop: 50,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 10,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
});
