import InternalHeader from "@/components/InternalHeader";
import { useAppTheme } from "@/constants/theme";
import { useAppSelector } from "@/redux/hooks";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/apiClient";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export interface ClassDetails {
  id: string;
  school_id: string;
  shift_id: string;
  class_name: string;
  sort_order: string;
  status: string;
  created_on: string;
  shift_name: string;
}

export interface SectionDetails {
  id: string;
  school_id: string;
  class_id: string;
  section_name: string;
  capacity: string;
  note: string;
  sort_order: string;
  status: string;
}

export interface SubjectItem {
  id: string;
  school_id: string;
  class_id: string;
  subject_name: string;
  status: string;
  sort_order: string;
  created_on: string;
  assignment_count: number;
}

export interface AssignmentSubjectResponseData {
  class_details: ClassDetails;
  section_details: SectionDetails;
  class_subject: SubjectItem[];
}

export default function AssignmentSubjectsScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const params = useLocalSearchParams<{
    classId?: string;
    sectionId?: string;
    className?: string;
    sectionName?: string;
    shiftId?: string;
    shiftName?: string;
  }>();

  const { colors, isDark } = useAppTheme();

  const [data, setData] = useState<AssignmentSubjectResponseData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef<boolean>(false);

  const targetClassId = params.classId || "2";
  const targetSectionId = params.sectionId || "4";

  const displayClassName = data?.class_details?.class_name
    ? `Class ${data.class_details.class_name}`
    : params.className
      ? `Class ${params.className}`
      : "Class";

  const displaySectionName = data?.section_details?.section_name
    ? `Sec ${data.section_details.section_name}`
    : params.sectionName
      ? `Sec ${params.sectionName}`
      : "Section";

  const headerTitle = `${displayClassName} - ${displaySectionName}`;

  // Fetch Subjects for Class and Section from API
  const fetchAssignmentSubjects = useCallback(
    async (isSilent = false) => {
      if (!isSilent) {
        setLoading(true);
      }
      setError(null);

      try {
        const [subjectsRes, assignmentsRes] = await Promise.all([
          apiClient.get<any>(`/teacher/academics/subjects?class_id=${targetClassId}`),
          apiClient.get<any>(`/teacher/academics/assignments?class_id=${targetClassId}&section_id=${targetSectionId}&status=1`).catch(() => ({ data: [] })),
        ]);

        const subjectsList = Array.isArray(subjectsRes?.data?.data)
          ? subjectsRes.data.data
          : Array.isArray(subjectsRes.data)
          ? subjectsRes.data
          : subjectsRes.data?.subjects || [];

        const rawAsgs = Array.isArray(assignmentsRes?.data?.data)
          ? assignmentsRes.data.data
          : Array.isArray(assignmentsRes?.data?.data?.assignments)
          ? assignmentsRes.data.data.assignments
          : Array.isArray(assignmentsRes?.data?.assignments)
          ? assignmentsRes.data.assignments
          : Array.isArray(assignmentsRes?.data)
          ? assignmentsRes.data
          : [];

        if (Array.isArray(subjectsList)) {
          setData({
            class_details: {
              id: String(targetClassId),
              school_id: "",
              shift_id: "",
              class_name: params.className || "",
              sort_order: "0",
              status: "1",
              created_on: "",
              shift_name: params.shiftName || "",
            },
            section_details: {
              id: String(targetSectionId),
              school_id: "",
              class_id: String(targetClassId),
              section_name: params.sectionName || "",
              capacity: "",
              note: "",
              sort_order: "0",
              status: "1",
            },
            class_subject: subjectsList.map((sub: any) => {
              const subId = String(sub.id);
              const count = rawAsgs.filter(
                (a: any) => String(a.subject_id) === subId
              ).length;
              return {
                id: subId,
                school_id: String(sub.school_id || ""),
                class_id: String(targetClassId),
                subject_name: sub.subject_name || sub.name || "",
                status: "1",
                sort_order: String(sub.sort_order || "0"),
                created_on: "",
                assignment_count: count,
              };
            }),
          });
        } else {
          setError(
            subjectsRes.data?.message || "No subject data found for this section.",
          );
        }
      } catch (err: any) {
        console.warn("fetchAssignmentSubjects exception:", err.message);
        setError(err.message || "An error occurred while loading subjects.");
      } finally {
        setLoading(false);
      }
    },
    [targetClassId, targetSectionId, params.className, params.sectionName, params.shiftName],
  );

  const handleBackToSections = useCallback(() => {
    router.replace({
      pathname: "/(main)/(drawer)/academic/assignment-sections",
      params: {
        classId: targetClassId,
        className: params.className,
        shiftId: params.shiftId,
        shiftName: params.shiftName,
      },
    });
  }, [router, targetClassId, params.className, params.shiftId, params.shiftName]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleBackToSections();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => subscription.remove();
    }, [handleBackToSections]),
  );

  // Auto-fetch and refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      fetchAssignmentSubjects(hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [fetchAssignmentSubjects])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAssignmentSubjects(true);
    setRefreshing(false);
  }, [fetchAssignmentSubjects]);

  const handleAddNew = (subject: SubjectItem) => {
    const classNameVal =
      data?.class_details?.class_name || params.className || "";
    const sectionNameVal =
      data?.section_details?.section_name || params.sectionName || "";
    const shiftNameVal =
      data?.class_details?.shift_name?.trim() || params.shiftName || "";

    router.push({
      pathname: "/(main)/(drawer)/academic/add-assignment",
      params: {
        classId: targetClassId,
        sectionId: targetSectionId,
        subjectId: subject.id,
        subjectName: subject.subject_name,
        className: classNameVal,
        sectionName: sectionNameVal,
        shiftName: shiftNameVal,
      },
    });
  };

  const handleViewAll = (subject: SubjectItem) => {
    const classNameVal =
      data?.class_details?.class_name || params.className || "";
    const sectionNameVal =
      data?.section_details?.section_name || params.sectionName || "";
    const shiftNameVal =
      data?.class_details?.shift_name?.trim() || params.shiftName || "";

    router.push({
      pathname: "/(main)/(drawer)/academic/assignment-details",
      params: {
        classId: targetClassId,
        sectionId: targetSectionId,
        subjectId: subject.id,
        subjectName: subject.subject_name,
        className: classNameVal,
        sectionName: sectionNameVal,
        shiftName: shiftNameVal,
      },
    });
  };

  const subjectsList = data?.class_subject || [];
  const classDetails = data?.class_details;
  const sectionDetails = data?.section_details;

  const renderSubjectCard = ({ item: subject }: { item: SubjectItem }) => {
    return (
      <View
        style={[
          styles.subjectCard,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
            shadowColor: colors.shadowColor,
          },
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View
              style={[
                styles.subjectAvatar,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Ionicons
                name="book-outline"
                size={22}
                color={colors.primary}
              />
            </View>

            <View style={styles.subjectInfo}>
              <Text style={[styles.subjectTitle, { color: colors.text }]}>
                {subject.subject_name}
              </Text>
              <Text
                style={[styles.subjectSubtitle, { color: colors.textMuted }]}
              >
                Sort Order: {subject.sort_order || "1"}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.countPill,
              {
                backgroundColor:
                  subject.assignment_count > 0
                    ? colors.primaryLight
                    : isDark
                      ? colors.surfaceSubtle
                      : "#F3F4F6",
              },
            ]}
          >
            <Text
              style={[
                styles.countPillText,
                {
                  color:
                    subject.assignment_count > 0
                      ? colors.primary
                      : colors.textMuted,
                },
              ]}
            >
              {subject.assignment_count}{" "}
              {subject.assignment_count === 1 ? "Assignment" : "Assignments"}
            </Text>
          </View>
        </View>

        <View
          style={[styles.cardDivider, { backgroundColor: colors.border }]}
        />

        {/* Two Action Buttons: Add New and View All */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.addNewBtn,
              {
                backgroundColor: isDark
                  ? colors.surfaceSubtle
                  : colors.primaryLight,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => handleAddNew(subject)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="add-circle-outline"
              size={18}
              color={colors.primary}
            />
            <Text style={[styles.addNewBtnText, { color: colors.primary }]}>
              Add New
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionBtn,
              styles.viewAllBtn,
              { backgroundColor: colors.primary },
            ]}
            onPress={() => handleViewAll(subject)}
            activeOpacity={0.8}
          >
            <Ionicons name="eye-outline" size={18} color="#FFFFFF" />
            <Text style={styles.viewAllBtnText}>View All</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptySubjects = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyContainer}>
        <View
          style={[
            styles.emptyIconCircle,
            { backgroundColor: colors.surfaceSubtle },
          ]}
        >
          <Ionicons
            name="journal-outline"
            size={48}
            color={colors.textMuted}
          />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {error ? "Error Loading Subjects" : "No Subjects Found"}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          {error ||
            `There are no subjects assigned to ${headerTitle} at this time.`}
        </Text>
        {error && (
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => fetchAssignmentSubjects()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader
        title={headerTitle}
        onBack={handleBackToSections}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading section subjects...
          </Text>
        </View>
      ) : (
        <FlatList
          data={subjectsList}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderSubjectCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            classDetails || sectionDetails || subjectsList.length > 0 ? (
              <View
                style={[
                  styles.headerBanner,
                  {
                    backgroundColor: colors.cardBg,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.bannerRow}>
                  <View style={styles.bannerInfo}>
                    <Text style={[styles.bannerTitle, { color: colors.text }]}>
                      {headerTitle}
                    </Text>
                    {classDetails?.shift_name ? (
                      <View style={styles.shiftPill}>
                        <Ionicons
                          name="time-outline"
                          size={13}
                          color={colors.primary}
                        />
                        <Text
                          style={[
                            styles.shiftPillText,
                            { color: colors.primary },
                          ]}
                        >
                          {classDetails.shift_name.trim()} Shift
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View
                    style={[
                      styles.subjectCountBadge,
                      { backgroundColor: colors.primaryLight },
                    ]}
                  >
                    <Text
                      style={[
                        styles.subjectCountText,
                        { color: colors.primary },
                      ]}
                    >
                      {subjectsList.length}{" "}
                      {subjectsList.length === 1 ? "Subject" : "Subjects"}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmptySubjects}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    padding: 16,
    paddingBottom: 32,
  },
  headerBanner: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerInfo: {
    flex: 1,
    marginRight: 10,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  shiftPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  shiftPillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  subjectCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  subjectCountText: {
    fontSize: 12,
    fontWeight: "800",
  },
  subjectCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  subjectAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  subjectSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  cardRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  countPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  cardDivider: {
    height: 1,
    marginVertical: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addNewBtn: {
    borderWidth: 1,
  },
  addNewBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  viewAllBtn: {},
  viewAllBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
