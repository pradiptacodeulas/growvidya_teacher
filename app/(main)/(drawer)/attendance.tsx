import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  TextInput, 
  RefreshControl,
  Alert 
} from 'react-native';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useFocusEffect } from 'expo-router';

import InternalHeader from '@/components/InternalHeader';
import { getAvatarUrl, formatGender } from '@/services/apiClient';
import SelectionBottomSheet from '@/components/common/SelectionBottomSheet';
import { fetchClasses, fetchSections } from '@/redux/features/students/thunks';
import { useAppTheme } from '@/constants/theme';
import { apiClient } from '@/services/apiClient';

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateDisplay = (dateStr: string) => {
  if (!dateStr) return 'Select Date';
  try {
    const [year, month, day] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
  } catch (e) {
    return dateStr;
  }
};

export default function AttendanceScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const { classes, sections, isLoadingClasses, isLoadingSections } = useAppSelector((state) => state.students);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  // State variables for form filters
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayDateString());

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
  const [localSearch, setLocalSearch] = useState('');

  // Refs for bottom sheets
  const yearBottomSheetRef = useRef<BottomSheetModal>(null);
  const classBottomSheetRef = useRef<BottomSheetModal>(null);
  const sectionBottomSheetRef = useRef<BottomSheetModal>(null);
  const hasLoadedRef = useRef<boolean>(false);

  // Load classes if empty
  useEffect(() => {
    if (classes.length === 0) {
      dispatch(fetchClasses());
    }
  }, [classes, dispatch]);

  // Set default class
  useEffect(() => {
    if (classes.length > 0 && !selectedClass) {
      const activeClasses = classes.filter(c => c.status === undefined || String(c.status) === '1');
      const defaultClass = activeClasses[0] || classes[0];
      if (defaultClass) {
        setSelectedClass(String(defaultClass.id));
      }
    }
  }, [classes, selectedClass]);

  // Load sections when class changes
  useEffect(() => {
    if (selectedClass) {
      hasLoadedRef.current = false;
      dispatch(fetchSections(selectedClass));
      setSelectedSection(''); // Reset section selection
      setAttendanceData([]); // Clear previous class data
      setHasMore(true); // Reset hasMore
      setLocalSearch(''); // Reset local search query
    }
  }, [selectedClass, dispatch]);

  // Set default section when sections load
  useEffect(() => {
    if (sections.length > 0 && !selectedSection) {
      const activeSections = sections.filter(s => s.status === undefined || String(s.status) === '1');
      const defaultSection = activeSections[0] || sections[0];
      if (defaultSection) {
        setSelectedSection(String(defaultSection.id));
      }
    }
  }, [sections, selectedSection]);

  // Reset list data when section changes manually
  useEffect(() => {
    if (selectedSection) {
      hasLoadedRef.current = false;
      setAttendanceData([]);
      setHasMore(true);
      setLocalSearch('');
    }
  }, [selectedSection]);

  // Reset list data when year or date changes
  useEffect(() => {
    if (selectedYear || selectedDate) {
      hasLoadedRef.current = false;
      setAttendanceData([]);
      setHasMore(true);
      setLocalSearch('');
    }
  }, [selectedYear, selectedDate]);

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
        // Auto-select current or first academic year
        const currentYear = data.find((y: any) => String(y.is_current) === '1') || data[0];
        if (currentYear) {
          setSelectedYear(String(currentYear.id));
        }
      }
    } catch (e: any) {
      console.warn('fetchYears exception:', e?.message);
    } finally {
      setIsLoadingYears(false);
    }
  }, []);

  useEffect(() => {
    fetchYears();
  }, [fetchYears]);

  // Fetch student attendance list
  const fetchAttendance = useCallback(async (isSilent = false) => {
    if (!selectedClass || !selectedSection || !selectedYear || !selectedDate) {
      return;
    }

    if (!isSilent) {
      setLoadingAttendance(true);
    }
    setErrorAttendance(null);
    setHasMore(true);

    try {
      const response = await apiClient.get('/teacher/attendance/student/list', {
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
        setErrorAttendance(null);
      } else {
        setAttendanceData([]);
        setErrorAttendance(null);
        setHasMore(false);
      }
    } catch (e: any) {
      console.warn('fetchAttendance exception:', e?.message);
      setErrorAttendance(e?.response?.data?.message || e?.message || 'An error occurred while fetching attendance records.');
      setHasMore(false);
    } finally {
      setLoadingAttendance(false);
    }
  }, [selectedClass, selectedSection, selectedYear, selectedDate]);

  // Load more paginated student attendance records
  const loadMoreAttendance = useCallback(async () => {
    setHasMore(false);
    setLoadingMore(false);
  }, []);

  // Auto-fetch attendance when all selections are ready & on screen focus
  useFocusEffect(
    useCallback(() => {
      if (selectedClass && selectedSection && selectedYear && selectedDate) {
        fetchAttendance(hasLoadedRef.current);
        hasLoadedRef.current = true;
      }
    }, [selectedClass, selectedSection, selectedYear, selectedDate, fetchAttendance])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAttendance(true);
    setRefreshing(false);
  }, [fetchAttendance]);

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
    }
  };

  // Setup options for bottom sheets
  const yearData = useMemo(() => {
    return academicYears.map(y => ({
      id: y.id,
      name: `Academic Year ${y.academic_year}`
    }));
  }, [academicYears]);

  const classData = useMemo(() => {
    return classes
      .filter(c => c.status === undefined || String(c.status) === '1')
      .map(c => ({
        id: c.id,
        name: c.class_name ? `Class ${c.class_name}` : `Class ${c.id}`
      }));
  }, [classes]);

  const sectionData = useMemo(() => {
    return sections
      .filter(s => s.status === undefined || String(s.status) === '1')
      .map(s => ({
        id: s.id,
        name: `Section ${s.section_name}`
      }));
  }, [sections]);

  // Dropdown search values description text
  const selectedYearObj = academicYears.find(y => String(y.id) === String(selectedYear));
  const selectedClassObj = classes.find(c => String(c.id) === String(selectedClass));
  const selectedSectionObj = sections.find(s => String(s.id) === String(selectedSection));

  // Compute metrics summary
  const stats = useMemo(() => {
    const total = attendanceData.length;
    const absent = attendanceData.filter(s => String(s.attendance) === '0').length;
    const present = attendanceData.filter(s => String(s.attendance) === '1').length;
    const late = attendanceData.filter(s => String(s.attendance) === '2').length;
    const halfday = attendanceData.filter(s => String(s.attendance) === '3').length;
    
    // Attendance rate is calculated only based on students who have been marked (excluding 'Not Marked')
    const markedAttended = present + late + halfday;
    const totalMarked = markedAttended + absent;
    const rate = totalMarked > 0 ? ((markedAttended / totalMarked) * 100).toFixed(1) : '0';
    return { total, present, absent, late, halfday, rate };
  }, [attendanceData]);

  // Locally filtered list based on query
  const filteredStudents = useMemo(() => {
    if (!localSearch) return attendanceData;
    const query = localSearch.toLowerCase().trim();
    return attendanceData.filter((s: any) => {
      const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
      const rollNum = String(s.roll_number || '').toLowerCase();
      const admNum = String(s.admission_number || '').toLowerCase();
      return fullName.includes(query) || rollNum.includes(query) || admNum.includes(query);
    });
  }, [attendanceData, localSearch]);

  const renderStudentItem = ({ item }: { item: any }) => {
    const avatarSource = { uri: getAvatarUrl(item.picture, item.gender) };

    // Dynamic colors for status badges
    let statusColor = colors.textMuted;
    let statusBg = colors.surfaceSubtle;
    let statusText = 'Not Marked';

    const attVal = String(item.attendance);
    if (attVal === '0' || attVal === 'a' || attVal === 'absent') {
      statusColor = '#ef4444'; // Red for Absent
      statusBg = isDark ? '#7f1d1d' : '#fef2f2';
      statusText = 'Absent';
    } else if (attVal === '1' || attVal === 'p' || attVal === 'present') {
      statusColor = '#10b981'; // Green for Present
      statusBg = isDark ? '#064e3b' : '#ecfdf5';
      statusText = 'Present';
    } else if (attVal === '2' || attVal === 'l' || attVal === 'late') {
      statusColor = '#f59e0b'; // Yellow/Orange for Late
      statusBg = isDark ? '#78350f' : '#fffbeb';
      statusText = 'Late';
    } else if (attVal === '3' || attVal === 'hd' || attVal === 'halfday') {
      statusColor = colors.primary; // Blue for Halfday
      statusBg = isDark ? '#1e1b4b' : '#eff6ff';
      statusText = 'Halfday';
    }

    return (
      <View style={[styles.studentCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Image source={avatarSource} style={styles.studentAvatar} />
        <View style={styles.studentInfo}>
          <Text style={[styles.studentName, { color: colors.text }]}>{`${item.first_name || ''} ${item.last_name || ''}`.trim()}</Text>
          <Text style={[styles.studentDetails, { color: colors.textMuted }]}>
            Roll {item.roll_number || 'N/A'} • ID: {item.admission_number || 'N/A'}
          </Text>
          <Text style={[styles.studentSubText, { color: colors.textMuted }]}>Gender: {formatGender(item.gender, item.gender_name)}</Text>
          {item.notes ? (
            <View style={[styles.notesContainer, { backgroundColor: colors.surfaceSubtle }]}>
              <Ionicons name="document-text-outline" size={13} color={colors.textMuted} style={{ marginRight: 4 }} />
              <Text style={[styles.notesText, { color: colors.textMuted }]}>{item.notes}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor }]}>
          <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusText}</Text>
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
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Error Loading Records</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{errorAttendance}</Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => fetchAttendance()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const className = selectedClassObj?.class_name || selectedClass || '';
    const sectionName = selectedSectionObj?.section_name || selectedSection || '';

    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.iconCircle, { backgroundColor: colors.surfaceSubtle }]}>
          <Ionicons name="calendar-outline" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {!selectedClass || !selectedSection ? 'Select Class & Section' : 'Attendance Not Marked'}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          {!selectedClass || !selectedSection 
            ? 'Please choose class, section, and date above to view student attendance records.'
            : `Attendance has not been recorded for Class ${className} - Section ${sectionName} on ${formatDateDisplay(selectedDate)}.`}
        </Text>
        {selectedClass && selectedSection ? (
          <TouchableOpacity
            style={[styles.markAttendanceBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
            onPress={() =>
              router.push({
                pathname: '/(main)/(drawer)/take-attendance',
                params: {
                  classId: selectedClass,
                  sectionId: selectedSection,
                  yearId: selectedYear,
                  date: selectedDate,
                },
              })
            }
            activeOpacity={0.8}
          >
            <Ionicons name="checkbox-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.markAttendanceBtnText}>Take Attendance</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };
//Now we have to seperate 
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Student Attendance" />
      {/* Filter Options Selector Header Card */}
      <View style={[styles.filterCard, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }]}>
        {/* Row 1: Academic Year and Date */}
        <View style={styles.filterRow}>
          <TouchableOpacity 
            style={[styles.filterSelector, { marginRight: 8 }]} 
            onPress={() => yearBottomSheetRef.current?.present()}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Academic Year</Text>
            <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Text style={[styles.selectorValue, { color: colors.text }]} numberOfLines={1}>
                {selectedYearObj ? `Academic Year ${selectedYearObj.academic_year}` : 'Select Year'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterSelector, { marginLeft: 8 }]} 
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Date</Text>
            <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.selectorValue, { color: colors.text }]} numberOfLines={1}>
                {formatDateDisplay(selectedDate)}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
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
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Class</Text>
            <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Text style={[styles.selectorValue, { color: colors.text }]} numberOfLines={1}>
                {selectedClassObj ? `Class ${selectedClassObj.class_name || selectedClassObj.id}` : 'Select Class'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.filterSelector, { marginLeft: 8 }, !selectedClass && styles.disabledSelector]} 
            onPress={() => selectedClass && sectionBottomSheetRef.current?.present()}
            activeOpacity={0.8}
            disabled={!selectedClass}
          >
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Section</Text>
            <View style={[styles.selectorValueBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
              <Text style={[styles.selectorValue, { color: colors.text }, !selectedClass && styles.disabledText]} numberOfLines={1}>
                {selectedSectionObj ? `Section ${selectedSectionObj.section_name}` : 'Select Section'}
              </Text>
              <Ionicons name="chevron-down" size={14} color={selectedClass ? colors.textMuted : "#ccc"} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main content body */}
      {loadingAttendance ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#3d5ee1" />
          <Text style={styles.loadingText}>Fetching Attendance Records...</Text>
        </View>
      ) : (
        <FlatList
          key={`${selectedClass}-${selectedSection}-${selectedYear}-${selectedDate}`}
          data={filteredStudents}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderStudentItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            attendanceData.length > 0 ? (
              <View>
                {/* Stats Overview */}
                <View style={[styles.statsCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <View style={styles.statsMain}>
                    <Text style={[styles.statsRateText, { color: colors.primary }]}>{stats.rate}%</Text>
                    <Text style={[styles.statsRateLabel, { color: colors.textMuted }]}>Attendance Rate</Text>
                  </View>
                  <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.statsGrid}>
                    <View style={styles.statsColumn}>
                      <View style={styles.statsItem}>
                        <View style={[styles.statsDot, { backgroundColor: '#10b981' }]} />
                        <Text style={[styles.statsCount, { color: colors.text }]}>{stats.present} <Text style={[styles.statsLabel, { color: colors.textMuted }]}>Present</Text></Text>
                      </View>
                      <View style={[styles.statsItem, { marginTop: 6 }]}>
                        <View style={[styles.statsDot, { backgroundColor: '#ef4444' }]} />
                        <Text style={[styles.statsCount, { color: colors.text }]}>{stats.absent} <Text style={[styles.statsLabel, { color: colors.textMuted }]}>Absent</Text></Text>
                      </View>
                    </View>
                    <View style={[styles.statsColumn, { marginLeft: 16 }]}>
                      <View style={styles.statsItem}>
                        <View style={[styles.statsDot, { backgroundColor: '#f59e0b' }]} />
                        <Text style={[styles.statsCount, { color: colors.text }]}>{stats.late} <Text style={[styles.statsLabel, { color: colors.textMuted }]}>Late</Text></Text>
                      </View>
                      <View style={[styles.statsItem, { marginTop: 6 }]}>
                        <View style={[styles.statsDot, { backgroundColor: colors.primary }]} />
                        <Text style={[styles.statsCount, { color: colors.text }]}>{stats.halfday} <Text style={[styles.statsLabel, { color: colors.textMuted }]}>Halfday</Text></Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Mark Attendance Button */}
                <TouchableOpacity
                  style={[styles.markAttendanceBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push('/(main)/(drawer)/take-attendance')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkbox-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.markAttendanceBtnText}>Mark Attendance</Text>
                </TouchableOpacity>

                {/* Local search bar */}
                <View style={[styles.searchBarContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                  <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.searchIcon} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search by name, roll, ID..."
                    value={localSearch}
                    onChangeText={setLocalSearch}
                    placeholderTextColor={colors.textMuted}
                  />
                  {localSearch !== '' && (
                    <TouchableOpacity onPress={() => setLocalSearch('')}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
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
              colors={["#3d5ee1"]}
            />
          }
          onEndReached={() => {
            loadMoreAttendance();
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#3d5ee1" />
                <Text style={styles.footerLoaderText}>Loading more students...</Text>
              </View>
            ) : null
          }
        />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  filterCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterSelector: {
    flex: 1,
  },
  disabledSelector: {
    opacity: 0.6,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7a869a',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  selectorValueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectorValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#202c4b',
    flex: 1,
  },
  disabledText: {
    color: '#9ca3af',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#7a869a',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  studentAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#f0f2f5',
  },
  studentInfo: {
    flex: 1,
    marginRight: 8,
  },
  studentName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#202c4b',
    marginBottom: 2,
  },
  studentDetails: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7a869a',
    marginBottom: 4,
  },
  studentSubText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9ca3af',
  },
  notesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
  },
  notesText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4b5563',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    alignItems: 'center',
  },
  statsMain: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 16,
  },
  statsRateText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#3d5ee1',
  },
  statsRateLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7a869a',
    marginTop: 2,
  },
  statsDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e5e7eb',
    marginRight: 16,
  },
  statsGrid: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsColumn: {
    flex: 1,
  },
  statsItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statsCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#202c4b',
  },
  statsLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#7a869a',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
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
    color: '#202c4b',
    height: '100%',
    padding: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f2f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  errorIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fdf2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202c4b',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#7a869a',
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: '#3d5ee1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerLoaderText: {
    fontSize: 12,
    color: '#7a869a',
    fontWeight: '500',
    marginLeft: 8,
  },
  markAttendanceBtn: {
    flexDirection: 'row',
    backgroundColor: '#3d5ee1',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  markAttendanceBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
