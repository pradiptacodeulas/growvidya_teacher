import InternalHeader from "@/components/InternalHeader";
import SelectionBottomSheet from "@/components/common/SelectionBottomSheet";
import { SyllabusItem as ApiSyllabusItem } from "@/redux/features/dashboard/types";
import { fetchClasses } from "@/redux/features/students/thunks";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
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
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View
} from "react-native";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "@/constants/theme";
import { apiClient } from "@/services/apiClient";
import Toast from "react-native-toast-message";

interface SyllabusItem extends ApiSyllabusItem {
  slNo: number;
  isSelected?: boolean;
}

export default function SyllabusScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const { classes, isLoadingClasses } = useAppSelector(
    (state) => state.students,
  );
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  const [rawSyllabus, setRawSyllabus] = useState<ApiSyllabusItem[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);

  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [isLoadingSyllabus, setIsLoadingSyllabus] = useState(true);
  const [isLoadingYears, setIsLoadingYears] = useState(false);
  const [errorSyllabus, setErrorSyllabus] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Pagination states for load more
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  const classBottomSheetRef = useRef<BottomSheetModal>(null);
  const yearBottomSheetRef = useRef<BottomSheetModal>(null);

  // Load classes if not loaded yet
  useEffect(() => {
    if (classes.length === 0) {
      dispatch(fetchClasses());
    }
  }, [classes, dispatch]);

  // Make the first class default one
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
      console.warn("fetchAcademicYears exception:", e?.message);
    } finally {
      setIsLoadingYears(false);
    }
  }, []);

  const fetchSyllabus = useCallback(
    async (isRefresh = false) => {
      if (!selectedClass || !selectedYear) return;

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setIsLoadingSyllabus(true);
      }
      setErrorSyllabus(null);
      setHasMore(true);
      setPage(1);

      try {
        const response = await apiClient.get('/teacher/academics/syllabus', {
          params: {
            academic_year: selectedYear,
            class_id: selectedClass,
            page: 1,
            limit: 20,
          },
        });

        const resData = response.data;
        const list = Array.isArray(resData?.data)
          ? resData.data
          : Array.isArray(resData?.data?.syllabus)
          ? resData.data.syllabus
          : Array.isArray(resData?.syllabus)
          ? resData.syllabus
          : [];

        setRawSyllabus(list);
        if (list.length < 20) {
          setHasMore(false);
        }
      } catch (e: any) {
        console.warn("fetchSyllabus exception:", e?.message);
        setErrorSyllabus(e?.message || "Failed to fetch syllabus");
        setHasMore(false);
      } finally {
        setIsLoadingSyllabus(false);
        setRefreshing(false);
      }
    },
    [selectedClass, selectedYear]
  );

  // Load more paginated syllabus items
  const loadMoreSyllabus = useCallback(async () => {
    if (loadingMore || !hasMore || rawSyllabus.length === 0) {
      return;
    }

    setLoadingMore(true);
    const nextPage = page + 1;

    try {
      const response = await apiClient.get('/teacher/academics/syllabus', {
        params: {
          academic_year: selectedYear,
          class_id: selectedClass,
          page: nextPage,
          limit: 20,
        },
      });

      const resData = response.data;
      const newItems = Array.isArray(resData?.data)
        ? resData.data
        : Array.isArray(resData?.data?.syllabus)
        ? resData.data.syllabus
        : Array.isArray(resData?.syllabus)
        ? resData.syllabus
        : [];

      if (newItems.length === 0) {
        setHasMore(false);
      } else {
        setPage(nextPage);
        setRawSyllabus((prev) => {
          const existingIds = new Set(prev.map((s) => String(s.id)));
          const uniqueItems = newItems.filter(
            (item: any) => !existingIds.has(String(item.id))
          );
          if (uniqueItems.length === 0) {
            setHasMore(false);
          }
          return [...prev, ...uniqueItems];
        });
        if (newItems.length < 20) {
          setHasMore(false);
        }
      }
    } catch (e: any) {
      console.warn("loadMoreSyllabus exception:", e?.message);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [selectedClass, selectedYear, rawSyllabus, loadingMore, hasMore, page]);

  // Fetch Academic Years on load
  useEffect(() => {
    if (token) {
      fetchYears();
    }
  }, [token, fetchYears]);

  // Fetch Syllabus on change of class/year selection or handle empty state
  useEffect(() => {
    if (token) {
      if (selectedClass && selectedYear) {
        fetchSyllabus();
      } else if (!isLoadingClasses && !isLoadingYears) {
        setIsLoadingSyllabus(false);
      }
    }
  }, [
    token,
    selectedClass,
    selectedYear,
    isLoadingClasses,
    isLoadingYears,
    fetchSyllabus,
  ]);

  // Auto-refresh syllabus when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (token && selectedClass && selectedYear) {
        fetchSyllabus(rawSyllabus.length > 0);
      }
    }, [token, selectedClass, selectedYear, fetchSyllabus, rawSyllabus.length])
  );

  const onRefresh = useCallback(() => {
    fetchSyllabus(true);
  }, [fetchSyllabus]);

  const syllabusList = useMemo(() => {
    const selectedClassObj = classes.find(
      (c) => String(c.id) === String(selectedClass),
    );
    const selectedClassName = selectedClassObj?.class_name || selectedClass;

    let list = rawSyllabus.filter(
      (item) =>
        String(item.class_id) === String(selectedClass) &&
        String(item.academic_year) === String(selectedYear),
    );

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      list = list.filter(
        (item) =>
          (item.subject_name &&
            item.subject_name.toLowerCase().includes(query)) ||
          (item.lession && item.lession.toLowerCase().includes(query)),
      );
    }

    return list.map((item, index) => ({
      ...item,
      slNo: index + 1,
      isSelected: selectedIds.includes(item.id),
    }));
  }, [
    rawSyllabus,
    selectedClass,
    selectedYear,
    searchQuery,
    selectedIds,
    classes,
  ]);

  const normalizeStatus = (status: any): string => {
    if (status === null || status === undefined) return "1";
    const s = String(status).trim().toLowerCase();
    if (s === "3" || s === "completed" || s === "complete" || s === "done") return "3";
    if (s === "2" || s === "progress" || s === "in progress" || s === "in-progress") return "2";
    if (s === "1" || s === "pending") return "1";
    return "1";
  };

  const getStatusLabel = (status: any) => {
    const s = normalizeStatus(status);
    switch (s) {
      case "3":
        return "Completed";
      case "2":
        return "Progress";
      case "1":
      default:
        return "Pending";
    }
  };

  const getStatusColor = (status: any) => {
    const s = normalizeStatus(status);
    switch (s) {
      case "3":
        return "#10b981";
      case "2":
        return "#3d5ee1";
      case "1":
      default:
        return "#ef4444";
    }
  };

  const getStatusBgColor = (status: any) => {
    const s = normalizeStatus(status);
    switch (s) {
      case "3":
        return isDark ? "#064e3b30" : "#e8f5e9";
      case "2":
        return isDark ? "#1e1b4b30" : "#e8eaf6";
      case "1":
      default:
        return isDark ? "#7f1d1d30" : "#ffebee";
    }
  };

  const handleStatusUpdate = async (id: string, newStatus: string) => {
    setRawSyllabus((prev) =>
      prev.map((item) =>
        String(item.id) === String(id) ? { ...item, status: newStatus } : item,
      ),
    );
    try {
      const res = await apiClient.put(`/teacher/academics/syllabus/${id}/status`, { status: Number(newStatus) });
      const resData = res?.data;
      if (resData?.success || resData?.status || res?.status === 200) {
        Toast.show({
          type: "success",
          text1: "Status Updated",
          text2: `Status changed to ${getStatusLabel(newStatus)}`,
        });
      }
    } catch (err: any) {
      console.warn("Failed to update syllabus status on server:", err?.message);
      Toast.show({
        type: "error",
        text1: "Update Failed",
        text2: err?.message || "Could not update status",
      });
      fetchSyllabus(true);
    }
  };

  const toggleItemSelection = (id: string) => {
    Vibration.vibrate(40);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const isSelectionMode = selectedIds.length > 0;

  const handlePress = (id: string) => {
    if (isSelectionMode) {
      toggleItemSelection(id);
    }
  };

  const handleLongPress = (id: string) => {
    toggleItemSelection(id);
  };

  const toggleSelectAll = () => {
    const allSelected = syllabusList.every((item) => item.isSelected);
    if (allSelected) {
      const listIds = syllabusList.map((item) => item.id);
      setSelectedIds((prev) => prev.filter((id) => !listIds.includes(id)));
    } else {
      const listIds = syllabusList.map((item) => item.id);
      setSelectedIds((prev) => Array.from(new Set([...prev, ...listIds])));
    }
  };

  const renderSyllabusItem = ({
    item,
    index,
  }: {
    item: SyllabusItem;
    index: number;
  }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => handlePress(item.id)}
      onLongPress={() => handleLongPress(item.id)}
      style={[
        styles.tableRowContainer,
        { backgroundColor: colors.cardBg, borderBottomColor: colors.border },
        item.isSelected && { backgroundColor: colors.primaryLight },
        index === syllabusList.length - 1 && { borderBottomWidth: 0 },
      ]}
    >
      <View style={styles.tableRowTop}>
        <View style={styles.colSlNo}>
          {item.isSelected ? (
            <Ionicons name="checkbox" size={18} color={colors.primary} />
          ) : (
            <Text style={[styles.cellText, { color: colors.textSecondary }]}>{item.slNo}</Text>
          )}
        </View>

        <View style={styles.colSubject}>
          <Text style={[styles.cellTextBold, { color: colors.text }]}>{item.subject_name}</Text>
          <Text style={[styles.cellText, { fontSize: 11, color: colors.textMuted }]}>
            Class {item.class_name}
          </Text>
        </View>

        <View style={styles.colStatus}>
          <Menu>
            <MenuTrigger disabled={isSelectionMode}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusBgColor(item.status) },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(item.status) },
                  ]}
                >
                  {getStatusLabel(item.status) === "Completed"
                    ? "Done"
                    : getStatusLabel(item.status)}
                </Text>
                <Ionicons
                  name="chevron-down"
                  size={12}
                  color={getStatusColor(item.status)}
                  style={{ marginLeft: 4 }}
                />
              </View>
            </MenuTrigger>
            <MenuOptions
              customStyles={{ optionsContainer: [styles.dropdownContainer, { backgroundColor: colors.surface, borderColor: colors.border }] }}
            >
              <MenuOption
                onSelect={() => handleStatusUpdate(item.id, "1")}
                style={styles.dropdownOption}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>Pending</Text>
              </MenuOption>
              <MenuOption
                onSelect={() => handleStatusUpdate(item.id, "2")}
                style={styles.dropdownOption}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>Progress</Text>
              </MenuOption>
              <MenuOption
                onSelect={() => handleStatusUpdate(item.id, "3")}
                style={styles.dropdownOption}
              >
                <Text style={[styles.optionText, { color: colors.text }]}>Completed</Text>
              </MenuOption>
            </MenuOptions>
          </Menu>
        </View>
      </View>

      <View style={styles.tableRowBottom}>
        <View style={styles.colIndent} />
        <View style={styles.colLessonFull}>
          <Text style={[styles.lessonText, { color: colors.textMuted }]}>{item.lession}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const TableHeader = () => (
    <View style={[styles.tableHeader, { backgroundColor: colors.surfaceSubtle, borderBottomColor: colors.border }]}>
      <View style={styles.colSlNo}>
        {isSelectionMode ? (
          <TouchableOpacity onPress={toggleSelectAll}>
            <Ionicons
              name={
                syllabusList.every((i) => i.isSelected)
                  ? "checkbox"
                  : "square-outline"
              }
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
        ) : (
          <Text style={[styles.headerLabel, { color: colors.text }]}>No.</Text>
        )}
      </View>
      <View style={styles.colSubject}>
        <Text style={[styles.headerLabel, { color: colors.text }]}>Subject</Text>
      </View>
      <View style={styles.colStatus}>
        <Text style={[styles.headerLabel, { color: colors.text }]}>Status</Text>
      </View>
    </View>
  );

  const selectedClassObj = classes.find(
    (c) => String(c.id) === String(selectedClass),
  );
  const selectedYearObj = academicYears.find(
    (y) => String(y.id) === String(selectedYear),
  );

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

  const handleSelectClass = (item: { id: string | number; name: string }) => {
    setSelectedClass(String(item.id));
    setSelectedIds([]);
    setRawSyllabus([]);
  };

  const handleSelectYear = (item: { id: string | number; name: string }) => {
    setSelectedYear(String(item.id));
    setSelectedIds([]);
    setRawSyllabus([]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Syllabus List" />

      <View
        style={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        <View style={[styles.filterContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.filterRow}>
            {/* Academic Year Selector */}
            <View style={[styles.filterItem, { flex: 1 }]}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Academic Year</Text>
              <TouchableOpacity
                style={[styles.selectBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                activeOpacity={0.8}
                onPress={() => yearBottomSheetRef.current?.present()}
              >
                <Text style={[styles.selectText, { color: colors.text }]} numberOfLines={1}>
                  {selectedYearObj
                    ? `Academic Year ${selectedYearObj.academic_year}`
                    : "Select"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Class Selector */}
            <View style={[styles.filterItem, { flex: 0.8 }]}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Class</Text>
              <TouchableOpacity
                style={[styles.selectBox, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                activeOpacity={0.8}
                onPress={() => classBottomSheetRef.current?.present()}
              >
                <Text style={[styles.selectText, { color: colors.text }]} numberOfLines={1}>
                  {selectedClassObj
                    ? selectedClassObj.class_name
                      ? `Class ${selectedClassObj.class_name}`
                      : `Class ${selectedClassObj.id}`
                    : "Select"}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.searchAndActions}>
          <View style={[styles.searchContainer, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
            <Ionicons
              name="search-outline"
              size={20}
              color={colors.textMuted}
              style={styles.searchIcon}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.iconActions}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.cardBg, borderColor: colors.border }]} onPress={onRefresh}>
              <Ionicons name="refresh-outline" size={20} color={colors.icon} />
            </TouchableOpacity>
            <Menu>
              <MenuTrigger>
                <View style={[styles.exportBtn, { backgroundColor: colors.primary }]}>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                </View>
              </MenuTrigger>
              <MenuOptions
                customStyles={{ optionsContainer: [styles.exportDropdown, { backgroundColor: colors.surface, borderColor: colors.border }] }}
              >
                <MenuOption
                  onSelect={() =>
                    Alert.alert(
                      "Export",
                      "PDF exporting is not available right now",
                    )
                  }
                  style={styles.dropdownOption}
                >
                  <View style={styles.exportOption}>
                    <Ionicons
                      name="document-outline"
                      size={18}
                      color="#ef4444"
                    />
                    <Text style={[styles.optionText, { color: colors.text }]}>Export PDF</Text>
                  </View>
                </MenuOption>
                <MenuOption
                  onSelect={() =>
                    Alert.alert(
                      "Export",
                      "Excel exporting is not available right now",
                    )
                  }
                  style={styles.dropdownOption}
                >
                  <View style={styles.exportOption}>
                    <Ionicons name="list-outline" size={18} color="#10b981" />
                    <Text style={[styles.optionText, { color: colors.text }]}>Export Excel</Text>
                  </View>
                </MenuOption>
              </MenuOptions>
            </Menu>
          </View>
        </View>

        <View style={[styles.tableWrapper, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.tableInner}>
            {isLoadingSyllabus && !syllabusList.length ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color="#3d5ee1" />
              </View>
            ) : (
              <FlatList
                data={syllabusList}
                renderItem={renderSyllabusItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                ListHeaderComponent={<TableHeader />}
                stickyHeaderIndices={[0]}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={["#3d5ee1"]}
                  />
                }
                onEndReached={loadMoreSyllabus}
                onEndReachedThreshold={0.5} 
                ListFooterComponent={
                  loadingMore ? (
                    <View style={styles.footerLoader}>
                      <ActivityIndicator size="small" color="#3d5ee1" />
                      <Text style={styles.footerLoaderText}>
                        Loading more...
                      </Text>
                    </View>
                  ) : null
                }
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons
                      name="document-text-outline"
                      size={48}
                      color="#ccc"
                    />
                    <Text style={styles.emptyText}>
                      {errorSyllabus || "No syllabus found"}
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </View>

      {/* Academic Year Selector Bottom Sheet */}
      <SelectionBottomSheet
        ref={yearBottomSheetRef}
        title="Select Academic Year"
        data={yearData}
        onSelect={handleSelectYear}
        loading={isLoadingYears}
      />

      {/* Class Selector Bottom Sheet */}
      <SelectionBottomSheet
        ref={classBottomSheetRef}
        title="Select Class"
        data={classData}
        onSelect={handleSelectClass}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  filterContainer: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  filterRow: {
    flexDirection: "row",
    gap: 12,
  },
  filterItem: {},
  filterLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#202c4b",
    marginBottom: 6,
  },
  readOnlyBox: {
    height: 42,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  readOnlyText: {
    fontSize: 13,
    color: "#4b5563",
    fontWeight: "500",
  },
  selectBox: {
    height: 42,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  selectText: {
    fontSize: 13,
    color: "#202c4b",
    fontWeight: "500",
  },
  searchAndActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 14,
    color: "#202c4b",
  },
  iconActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    justifyContent: "center",
    alignItems: "center",
  },
  exportBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#3d5ee1",
    justifyContent: "center",
    alignItems: "center",
  },
  tableWrapper: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
    marginBottom: 10,
  },
  tableInner: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8faff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#202c4b",
    textTransform: "uppercase",
  },
  tableRowContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: "#fff",
  },
  tableRowTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  tableRowBottom: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  rowSelected: {
    backgroundColor: "#f5f7ff",
  },
  colSelect: {
    width: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  colSlNo: {
    width: 35,
    justifyContent: "center",
    alignItems: "center",
  },
  colSubject: {
    flex: 1,
    paddingHorizontal: 4,
  },
  colStatus: {
    width: 90,
    alignItems: "flex-end",
  },
  colIndent: {
    width: 35,
  },
  colLessonFull: {
    flex: 1,
    paddingHorizontal: 4,
  },
  cellText: {
    fontSize: 12,
    color: "#4b5563",
  },
  cellTextBold: {
    fontSize: 13,
    fontWeight: "700",
    color: "#202c4b",
  },
  lessonText: {
    fontSize: 13,
    color: "#4b5563",
    lineHeight: 18,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 80,
    justifyContent: "center",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  dropdownContainer: {
    borderRadius: 10,
    padding: 4,
    width: 140,
    marginTop: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  exportDropdown: {
    borderRadius: 10,
    padding: 4,
    width: 160,
    marginTop: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  dropdownOption: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  optionText: {
    fontSize: 13,
    color: "#202c4b",
    fontWeight: "500",
  },
  exportOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: "#7a869a",
    fontWeight: "500",
  },
  footerLoader: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  footerLoaderText: {
    fontSize: 12,
    color: "#7a869a",
    fontWeight: "500",
    marginLeft: 8,
  },
});
