import InternalHeader from "@/components/InternalHeader";
import StudentCard from "@/components/StudentCard";
import StudentFilter from "@/components/StudentFilter";
import SelectionBottomSheet from "@/components/common/SelectionBottomSheet";
import {
  clearSections,
  resetStudentState,
} from "@/redux/features/students/slice";
import {
  fetchClasses,
  fetchInitialStudents,
  fetchSections,
  loadMoreStudents,
} from "@/redux/features/students/thunks";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAppTheme } from "@/constants/theme";

export default function WardScreen() {
  const router = useRouter();
  const token = useAppSelector((state) => state.auth.token);
  const { colors } = useAppTheme();
  const {
    students,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    classes,
    sections,
    isLoadingClasses,
    isLoadingSections,
  } = useAppSelector((state) => state.students);
  const dispatch = useAppDispatch();
  const [refreshing, setRefreshing] = useState(false);

  const [filters, setFilters] = useState({
    name: "",
    class: "",
    section: "",
    status: "",
    date: "",
  });

  const classBottomSheetRef = useRef<BottomSheetModal>(null);
  const sectionBottomSheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (token) {
      dispatch(fetchClasses());
      dispatch(fetchInitialStudents(filters));
    }
    return () => {
      dispatch(resetStudentState());
    };
  }, [token]);

  const handleOpenClass = () => {
    classBottomSheetRef.current?.present();
  };

  const handleOpenSection = () => {
    if (!filters.class) {
      Alert.alert("Class Required", "Please select a class first.");
      return;
    }
    sectionBottomSheetRef.current?.present();
  };

  const handleSelectClass = (item: any) => {
    classBottomSheetRef.current?.dismiss();
    const newClassId = String(item.id);
    setFilters((prev) => ({
      ...prev,
      class: newClassId,
      section: "",
    }));
    dispatch(clearSections());
    dispatch(fetchSections(newClassId));
  };

  const handleSelectSection = (item: any) => {
    sectionBottomSheetRef.current?.dismiss();
    setFilters((prev) => ({
      ...prev,
      section: String(item.id),
    }));
  };

  const handleSearch = () => {
    if (token) {
      dispatch(fetchInitialStudents(filters));
    }
  };

  const handleClear = () => {
    const emptyFilters = {
      name: "",
      class: "",
      section: "",
      status: "",
      date: "",
    };
    setFilters(emptyFilters);
    dispatch(clearSections());
    if (token) {
      dispatch(fetchInitialStudents(emptyFilters));
    }
  };

  const handleRefresh = async () => {
    if (token) {
      setRefreshing(true);
      await dispatch(fetchInitialStudents(filters));
      setRefreshing(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !isLoading && !isLoadingMore && token && students.length > 0) {
      const lastId = students[students.length - 1].id;
      dispatch(loadMoreStudents({ lastId, ...filters }));
    }
  };

  const handlePress = (id: string) => {
    router.push(`/(main)/(drawer)/student/${id}`);
  };

  const renderFooter = () => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.footerLoaderText, { color: colors.textMuted }]}>Loading more students...</Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Students" />

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#dc3545" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={handleSearch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading students...</Text>
        </View>
      ) : (
        <FlatList
          data={students}
          extraData={filters}
          keyExtractor={(item, index) => (item?.id !== undefined ? String(item.id) : `student-${index}`)}
          renderItem={({ item }) => (
            <StudentCard
              student={item}
              onPress={() => handlePress(item.id)}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <StudentFilter
              filters={filters}
              onChangeFilters={setFilters}
              onSearch={handleSearch}
              onOpenClass={handleOpenClass}
              onOpenSection={handleOpenSection}
              onClear={handleClear}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No students found</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}

      {/* Class Selector Bottom Sheet */}
      <SelectionBottomSheet
        ref={classBottomSheetRef}
        title="Select Class"
        data={classes}
        selectedId={filters.class}
        onSelect={handleSelectClass}
        keyExtractor={(item) => String(item.id)}
        labelExtractor={(item) =>
          item.class_name ? `Class ${item.class_name}` : `Class ${item.id}`
        }
        isLoading={isLoadingClasses}
      />

      {/* Section Selector Bottom Sheet */}
      <SelectionBottomSheet
        ref={sectionBottomSheetRef}
        title="Select Section"
        data={sections}
        selectedId={filters.section}
        onSelect={handleSelectSection}
        keyExtractor={(item) => String(item.id)}
        labelExtractor={(item) => `Section ${item.section_name}`}
        isLoading={isLoadingSections}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    paddingBottom: 30,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    fontSize: 14,
    color: "#dc3545",
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 15,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyContainer: {
    padding: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  footerLoader: {
    paddingVertical: 20,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
  },
  footerLoaderText: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "600",
  },
});
