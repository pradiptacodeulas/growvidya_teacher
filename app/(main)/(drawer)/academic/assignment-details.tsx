import InternalHeader from "@/components/InternalHeader";
import { useAppTheme } from "@/constants/theme";
import { useAppSelector } from "@/redux/hooks";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "@/services/apiClient";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export interface AnswerItem {
  id?: string;
  school_id?: string;
  question_id?: string;
  answer?: string;
  text?: string;
  is_correct?: string | number;
  status?: string;
  created_at?: string;
}

export interface QuestionItem {
  id?: string;
  school_id?: string;
  assignment_id?: string;
  question?: string;
  title?: string;
  correct_answer?: string | number;
  status?: string;
  created_at?: string;
  answers?: AnswerItem[];
}

export interface AssignmentItem {
  id: string;
  school_id?: string;
  class_id?: string;
  section_id?: string;
  subject_id?: string;
  title: string;
  assignment_type_id?: string;
  type_name?: string;
  assigned_date?: string;
  due_date?: string;
  publish_now?: string;
  status?: string;
  is_published?: string;
  created_on?: string;
  question_count?: number | string;
  questions?: QuestionItem[];
}

const getOptionLabel = (index: number) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < 26) {
    return alphabet[index];
  }
  const first = alphabet[Math.floor(index / 26) - 1];
  const second = alphabet[index % 26];
  return `${first}${second}`;
};

const formatDisplayDate = (dateStr?: string) => {
  if (!dateStr) return "";
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
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parts[2];
    if (monthIdx >= 0 && monthIdx < 12) {
      return `${day} ${months[monthIdx]} ${year}`;
    }
  }
  return dateStr;
};

export default function AssignmentDetailsScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const params = useLocalSearchParams<{
    classId?: string;
    sectionId?: string;
    subjectId?: string;
    subjectName?: string;
    className?: string;
    sectionName?: string;
    shiftName?: string;
  }>();

  const { colors, isDark } = useAppTheme();

  const classId = params.classId || "1";
  const sectionId = params.sectionId || "1";
  const subjectId = params.subjectId || "1";
  const className = params.className || "I";
  const sectionName = params.sectionName || "A";
  const subjectName = params.subjectName || "Subject";

  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const hasLoadedRef = useRef<boolean>(false);

  // BottomSheet modal state for showing questions under an assignment
  const questionsBottomSheetRef = useRef<BottomSheetModal>(null);
  const [selectedAssignmentForQuestions, setSelectedAssignmentForQuestions] =
    useState<AssignmentItem | null>(null);
  const [sheetQuestions, setSheetQuestions] = useState<QuestionItem[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState<boolean>(false);
  const [questionSearchQuery, setQuestionSearchQuery] = useState<string>("");

  const questionsSnapPoints = useMemo(() => ["70%", "92%"], []);
  const insets = useSafeAreaInsets();

  const handleOpenQuestionsSheet = useCallback(async (item: AssignmentItem) => {
    setSelectedAssignmentForQuestions(item);
    setQuestionSearchQuery("");
    setSheetQuestions(item.questions || []);
    questionsBottomSheetRef.current?.present();

    try {
      setLoadingQuestions(true);
      const response = await apiClient.get<any>(
        `/teacher/academics/assignments/${item.id}/questions`
      );
      const list = Array.isArray(response.data?.data)
        ? response.data.data
        : Array.isArray(response.data)
          ? response.data
          : [];
      setSheetQuestions(list);
      setAssignments((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, questions: list } : a))
      );
    } catch (err: any) {
      console.warn("Failed to fetch assignment questions:", err.message);
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  const filteredSheetQuestions = useMemo(() => {
    if (!questionSearchQuery.trim()) return sheetQuestions;
    const q = questionSearchQuery.toLowerCase().trim();
    return sheetQuestions.filter((item) => {
      const qText = (item.question || item.title || "").toLowerCase();
      if (qText.includes(q)) return true;
      if (Array.isArray(item.answers)) {
        return item.answers.some((ans) =>
          (ans.answer || ans.text || "").toLowerCase().includes(q)
        );
      }
      return false;
    });
  }, [sheetQuestions, questionSearchQuery]);

  const renderQuestionsBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  const fetchAssignments = useCallback(
    async (isSilent = false) => {
      if (!isSilent) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await apiClient.get<any>(
          `/teacher/academics/assignments?class_id=${classId}&section_id=${sectionId}&subject_id=${subjectId}`
        );

        const resData = response?.data;
        const list =
          resData?.data?.assignments ||
          resData?.assignments ||
          (Array.isArray(resData?.data) ? resData.data : []) ||
          (Array.isArray(resData) ? resData : []);

        if (Array.isArray(list)) {
          setAssignments(list);
        } else {
          setAssignments([]);
          if (resData?.message) {
            setError(resData.message);
          }
        }
      } catch (err: any) {
        console.warn("fetchAssignments exception:", err.message);
        setError(err.message || "An error occurred while loading assignments.");
      } finally {
        setLoading(false);
      }
    },
    [classId, sectionId, subjectId],
  );

  const handleBackToSubjects = useCallback(() => {
    router.replace({
      pathname: "/(main)/(drawer)/academic/assignment-subjects",
      params: {
        classId,
        sectionId,
        className,
        sectionName,
        shiftName: params.shiftName,
      },
    });
  }, [router, classId, sectionId, className, sectionName, params.shiftName]);

  useFocusEffect(
    useCallback(() => {
      fetchAssignments(hasLoadedRef.current);
      hasLoadedRef.current = true;

      const onBackPress = () => {
        handleBackToSubjects();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );
      return () => subscription.remove();
    }, [fetchAssignments, handleBackToSubjects]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAssignments(true);
    setRefreshing(false);
  }, [fetchAssignments]);

  // Live client-side search filter
  const filteredAssignments = useMemo(() => {
    if (!searchQuery.trim()) return assignments;
    const q = searchQuery.toLowerCase().trim();
    return assignments.filter((item) => {
      const titleMatch = item.title?.toLowerCase().includes(q);
      const typeMatch = item.type_name?.toLowerCase().includes(q);
      const assignedDateMatch = item.assigned_date?.toLowerCase().includes(q);
      const dueDateMatch = item.due_date?.toLowerCase().includes(q);
      const statusText =
        String(item.is_published) === "1" || String(item.publish_now) === "1"
          ? "published"
          : "draft";
      const statusMatch = statusText.includes(q);
      return (
        titleMatch ||
        typeMatch ||
        assignedDateMatch ||
        dueDateMatch ||
        statusMatch
      );
    });
  }, [assignments, searchQuery]);

  const handleAddNew = () => {
    router.push({
      pathname: "/(main)/(drawer)/academic/add-assignment",
      params: {
        classId,
        sectionId,
        subjectId,
        className,
        sectionName,
        subjectName,
        shiftName: params.shiftName,
      },
    });
  };

  const handlePublish = (item: AssignmentItem) => {
    Alert.alert(
      "Publish Assignment",
      `Are you sure you want to publish "${item.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Publish",
          style: "default",
          onPress: async () => {
            try {
              await apiClient.post(`/teacher/academics/assignments/${item.id}/publish`, {});

              setAssignments((prev) =>
                prev.map((a) =>
                  a.id === item.id
                    ? { ...a, is_published: "1", publish_now: "1", status: "1" }
                    : a,
                ),
              );

              Toast.show({
                type: "success",
                text1: "Assignment Published",
                text2: `"${item.title}" is now published.`,
              });
            } catch (err: any) {
              console.warn("handlePublish exception:", err.message);
              Toast.show({
                type: "error",
                text1: "Publish Failed",
                text2: err.message || "Failed to publish assignment.",
              });
            }
          },
        },
      ],
    );
  };

  const handleEdit = (item: AssignmentItem) => {
    router.push({
      pathname: "/(main)/(drawer)/academic/add-assignment",
      params: {
        classId,
        sectionId,
        subjectId,
        className,
        sectionName,
        subjectName,
        shiftName: params.shiftName,
        assignmentId: String(item.id),
        assignmentData: JSON.stringify(item),
      },
    });
  };

  const handleDelete = (item: AssignmentItem) => {
    Alert.alert(
      "Delete Assignment",
      `Are you sure you want to delete "${item.title}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await apiClient.delete(`/teacher/academics/assignments/${item.id}`);

              setAssignments((prev) => prev.filter((a) => a.id !== item.id));

              Toast.show({
                type: "success",
                text1: "Assignment Deleted",
                text2: `"${item.title}" has been deleted successfully.`,
              });
            } catch (err: any) {
              console.warn("handleDelete exception:", err.message);
              Toast.show({
                type: "error",
                text1: "Delete Failed",
                text2: err.message || "Failed to delete assignment.",
              });
            }
          },
        },
      ],
    );
  };

  const renderAssignmentCard = ({
    item,
    index,
  }: {
    item: AssignmentItem;
    index: number;
  }) => {
    const questionsList = item.questions || [];
    const questionsCount =
      item.question_count !== undefined && item.question_count !== null
        ? Number(item.question_count)
        : questionsList.length;

    // Strict check for is_published (1 = Published, 0 = Draft)
    const isPublished =
      String(item.is_published) === "1" || String(item.publish_now) === "1";

    return (
      <View
        style={[
          styles.assignmentCard,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
            shadowColor: colors.shadowColor,
          },
        ]}
      >
        {/* Top Header Row */}
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <View
                style={[
                  styles.indexBadge,
                  { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
                ]}
              >
                <Text
                  style={[styles.indexBadgeText, { color: colors.textMuted }]}
                >
                  #{index + 1}
                </Text>
              </View>
              <Text style={[styles.assignmentTitle, { color: colors.text }]}>
                {item.title}
              </Text>
            </View>
            {item.type_name ? (
              <View
                style={[
                  styles.typeBadge,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <Ionicons
                  name="pricetag-outline"
                  size={12}
                  color={colors.primary}
                />
                <Text
                  style={[styles.typeBadgeText, { color: colors.primary }]}
                >
                  {item.type_name}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Status Badge: 1 = Published (Green), 0 = Draft (Amber) */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isPublished
                  ? isDark
                    ? "#064E3B"
                    : "#ECFDF5"
                  : isDark
                    ? "#451A03"
                    : "#FEF3C7",
              },
            ]}
          >
            <Ionicons
              name={isPublished ? "paper-plane-outline" : "create-outline"}
              size={12}
              color={isPublished ? "#10B981" : "#D97706"}
            />
            <Text
              style={[
                styles.statusBadgeText,
                { color: isPublished ? "#10B981" : "#D97706" },
              ]}
            >
              {isPublished ? "Published" : "Draft"}
            </Text>
          </View>
        </View>

        {/* Dates Meta Row */}
        <View style={styles.datesMetaRow}>
          {item.assigned_date ? (
            <View style={styles.dateMetaItem}>
              <Ionicons name="calendar-outline" size={13} color="#10B981" />
              <Text style={[styles.dateMetaText, { color: colors.textMuted }]}>
                Assigned:{" "}
                <Text style={{ color: "#10B981", fontWeight: "700" }}>
                  {formatDisplayDate(item.assigned_date)}
                </Text>
              </Text>
            </View>
          ) : null}

          {item.due_date ? (
            <View style={styles.dateMetaItem}>
              <Ionicons name="alarm-outline" size={13} color="#EF4444" />
              <Text style={[styles.dateMetaText, { color: colors.textMuted }]}>
                Due:{" "}
                <Text style={{ color: "#EF4444", fontWeight: "700" }}>
                  {formatDisplayDate(item.due_date)}
                </Text>
              </Text>
            </View>
          ) : null}
        </View>

        {/* Action Row & Action Buttons */}
        <View style={[styles.actionRow, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.showQuestionsBtn,
              {
                backgroundColor: colors.primaryLight,
                borderColor: colors.primary,
              },
            ]}
            onPress={() => handleOpenQuestionsSheet(item)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="eye-outline"
              size={15}
              color={colors.primary}
            />
            <Text
              style={[styles.showQuestionsBtnText, { color: colors.primary }]}
            >
              View Questions
            </Text>
            <View style={[styles.qCountPill, { backgroundColor: colors.primary }]}>
              <Text style={styles.qCountPillText}>{questionsCount}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.actionButtonsGroup}>
            {isPublished ? (
              <View
                style={[
                  styles.lockedBadge,
                  {
                    backgroundColor: isDark ? "#334155" : "#F1F5F9",
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
                <Text style={[styles.lockedBadgeText, { color: colors.textMuted }]}>
                  Locked
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.actionIconButton,
                    { backgroundColor: "#ECFDF5", borderColor: "#10B981" },
                  ]}
                  onPress={() => handlePublish(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="paper-plane" size={13} color="#10B981" />
                  <Text style={[styles.actionBtnLabel, { color: "#10B981" }]}>
                    Publish
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionIconButton,
                    { backgroundColor: "#FFFBEB", borderColor: "#F59E0B" },
                  ]}
                  onPress={() => handleEdit(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="pencil" size={13} color="#D97706" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionIconButton,
                    { backgroundColor: "#FEF2F2", borderColor: "#EF4444" },
                  ]}
                  onPress={() => handleDelete(item)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={13} color="#EF4444" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => {
    if (loading) return null;

    if (searchQuery.trim().length > 0) {
      return (
        <View style={styles.emptyContainer}>
          <View
            style={[
              styles.emptyIconCircle,
              { backgroundColor: colors.surfaceSubtle },
            ]}
          >
            <Ionicons name="search" size={40} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No Matching Assignments
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            No assignment found matching "{searchQuery}".
          </Text>
          <TouchableOpacity
            style={[styles.addFirstBtn, { backgroundColor: colors.primary }]}
            onPress={() => setSearchQuery("")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="close-circle-outline"
              size={18}
              color="#FFFFFF"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.addFirstBtnText}>Clear Search Filter</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <View
          style={[
            styles.emptyIconCircle,
            { backgroundColor: colors.surfaceSubtle },
          ]}
        >
          <Ionicons
            name="document-text-outline"
            size={48}
            color={colors.textMuted}
          />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {error ? "No Assignments Found" : "No Assignments Created"}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          {error ||
            `There are no assignments for ${subjectName} in Class ${className} - Sec ${sectionName}.`}
        </Text>

        <TouchableOpacity
          style={[styles.addFirstBtn, { backgroundColor: colors.primary }]}
          onPress={handleAddNew}
          activeOpacity={0.8}
        >
          <Ionicons
            name="add-circle-outline"
            size={18}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.addFirstBtnText}>Create First Assignment</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader
        title={`${subjectName} Assignments`}
        onBack={handleBackToSubjects}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading assignments...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAssignments}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderAssignmentCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              {/* Sleek Dark Gradient Header Info Banner */}
              <LinearGradient
                colors={["#1E293B", "#334155"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.headerBannerGradient}
              >
                <View style={styles.bannerMainRow}>
                  <View style={styles.bannerLeftSection}>
                    <View style={styles.bookIconContainer}>
                      <Ionicons name="book-outline" size={24} color="#F59E0B" />
                    </View>
                    <View style={styles.bannerInfo}>
                      <Text style={styles.bannerTitle}>{subjectName}</Text>
                      <Text style={styles.bannerSubtitle}>
                        Class:{" "}
                        <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                          {className}
                        </Text>{" "}
                        | Section:{" "}
                        <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                          {sectionName}
                        </Text>
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.addAssignmentTopBtn}
                    onPress={handleAddNew}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={16} color="#FFFFFF" />
                    <Text style={styles.addAssignmentTopBtnText}>Add New</Text>
                  </TouchableOpacity>
                </View>

                {/* Total Assignments Badge */}
                <View style={styles.totalBadgeRow}>
                  <View style={styles.totalBadge}>
                    <Ionicons name="layers-outline" size={14} color="#78350F" />
                    <Text style={styles.totalBadgeText}>
                      Total Assignments: {assignments.length}
                    </Text>
                  </View>
                </View>
              </LinearGradient>

              {/* Interactive Search Bar Input */}
              {assignments.length > 0 && (
                <View
                  style={[
                    styles.searchBarContainer,
                    {
                      backgroundColor: colors.cardBg,
                      borderColor: colors.border,
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
                    placeholder="Search assignments by title, type, date..."
                    placeholderTextColor={colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSearchQuery("")}
                      activeOpacity={0.7}
                      style={styles.clearSearchBtn}
                    >
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={colors.textMuted}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {assignments.length > 0 && (
                <View style={styles.listSectionTitleRow}>
                  <View style={styles.listTitleLeft}>
                    <Ionicons name="list" size={18} color={colors.primary} />
                    <Text
                      style={[styles.listSectionTitle, { color: colors.text }]}
                    >
                      Subject Assignments List
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.itemCountBadge,
                      { backgroundColor: colors.primaryLight },
                    ]}
                  >
                    <Text
                      style={[styles.itemCountText, { color: colors.primary }]}
                    >
                      {filteredAssignments.length} Item(s)
                    </Text>
                  </View>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {/* Questions BottomSheet Modal */}
      <BottomSheetModal
        ref={questionsBottomSheetRef}
        index={0}
        snapPoints={questionsSnapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderQuestionsBackdrop}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={[
          styles.handleIndicator,
          { backgroundColor: colors.border },
        ]}
        enablePanDownToClose
        onDismiss={() => {
          setSelectedAssignmentForQuestions(null);
          setSheetQuestions([]);
          setQuestionSearchQuery("");
        }}
      >
        {selectedAssignmentForQuestions && (
          <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.sheetHeaderLeft}>
                <View style={styles.sheetHeaderTitleRow}>
                  <Text style={[styles.sheetTitle, { color: colors.text }]} numberOfLines={1}>
                    {selectedAssignmentForQuestions.title}
                  </Text>
                  {selectedAssignmentForQuestions.type_name ? (
                    <View
                      style={[
                        styles.typeBadge,
                        { backgroundColor: colors.primaryLight },
                      ]}
                    >
                      <Ionicons
                        name="pricetag-outline"
                        size={11}
                        color={colors.primary}
                      />
                      <Text
                        style={[styles.typeBadgeText, { color: colors.primary }]}
                      >
                        {selectedAssignmentForQuestions.type_name}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.sheetSubHeaderRow}>
                  {selectedAssignmentForQuestions.assigned_date ? (
                    <View style={styles.sheetMetaItem}>
                      <Ionicons name="calendar-outline" size={12} color={colors.primary} />
                      <Text style={[styles.sheetMetaText, { color: colors.textMuted }]}>
                        Assigned:{" "}
                        <Text style={{ color: colors.text, fontWeight: "600" }}>
                          {formatDisplayDate(selectedAssignmentForQuestions.assigned_date)}
                        </Text>
                      </Text>
                    </View>
                  ) : null}
                  {selectedAssignmentForQuestions.due_date ? (
                    <View style={styles.sheetMetaItem}>
                      <Ionicons name="time-outline" size={12} color="#EF4444" />
                      <Text style={[styles.sheetMetaText, { color: colors.textMuted }]}>
                        Due:{" "}
                        <Text style={{ color: colors.text, fontWeight: "600" }}>
                          {formatDisplayDate(selectedAssignmentForQuestions.due_date)}
                        </Text>
                      </Text>
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.qCountPill,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text style={styles.qCountPillText}>
                      {filteredSheetQuestions.length} Question{filteredSheetQuestions.length === 1 ? "" : "s"}
                      {questionSearchQuery ? ` (of ${sheetQuestions.length})` : ""}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => questionsBottomSheetRef.current?.dismiss()}
                style={styles.sheetCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={26}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            {/* Questions Search Bar */}
            {(sheetQuestions.length > 0 || questionSearchQuery.length > 0) && (
              <View
                style={[
                  styles.sheetSearchBar,
                  { backgroundColor: colors.cardBg, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={16}
                  color={colors.textMuted}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={[styles.sheetSearchInput, { color: colors.text }]}
                  placeholder="Search questions or options..."
                  placeholderTextColor={colors.textMuted}
                  value={questionSearchQuery}
                  onChangeText={setQuestionSearchQuery}
                  clearButtonMode="while-editing"
                />
                {questionSearchQuery.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setQuestionSearchQuery("")}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <BottomSheetScrollView
              contentContainerStyle={[
                styles.sheetScrollContent,
                { paddingBottom: insets.bottom + 36 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {loadingQuestions ? (
                <View style={styles.sheetLoadingBox}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.sheetLoadingText, { color: colors.textMuted }]}>
                    Loading questions & options...
                  </Text>
                </View>
              ) : sheetQuestions.length === 0 ? (
                <View style={styles.sheetEmptyBox}>
                  <Ionicons
                    name="help-circle-outline"
                    size={44}
                    color={colors.textMuted}
                  />
                  <Text
                    style={[styles.sheetEmptyText, { color: colors.textMuted }]}
                  >
                    No questions have been attached to this assignment yet.
                  </Text>
                </View>
              ) : filteredSheetQuestions.length === 0 ? (
                <View style={styles.sheetEmptyBox}>
                  <Ionicons
                    name="search-outline"
                    size={44}
                    color={colors.textMuted}
                  />
                  <Text
                    style={[styles.sheetEmptyText, { color: colors.textMuted }]}
                  >
                    No questions found matching "{questionSearchQuery}".
                  </Text>
                  <TouchableOpacity
                    style={[styles.clearFilterBtn, { backgroundColor: colors.primaryLight }]}
                    onPress={() => setQuestionSearchQuery("")}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.clearFilterBtnText, { color: colors.primary }]}>
                      Clear Search
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredSheetQuestions.map((q, qIndex) => {
                  const originalIndex = sheetQuestions.findIndex((orig) => orig.id === q.id);
                  const displayNum = originalIndex >= 0 ? originalIndex + 1 : qIndex + 1;
                  const questionText = q.question || q.title || `Question ${displayNum}`;
                  const answersList = q.answers || [];

                  return (
                    <View
                      key={q.id || qIndex}
                      style={[
                        styles.sheetQBlock,
                        {
                          backgroundColor: colors.cardBg,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      {/* Question Header: Exactly 14px gap between badge pill and question text */}
                      <View style={styles.sheetQHeaderRow}>
                        <View style={styles.sheetQHeaderLeft}>
                          <View
                            style={[
                              styles.questionBadgePill,
                              {
                                backgroundColor: isDark ? "#312E81" : "#EEF2FF",
                                borderColor: isDark ? "#4338CA" : "#C7D2FE",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.questionBadgeText,
                                { color: isDark ? "#A5B4FC" : "#4F46E5" },
                              ]}
                            >
                              Question #{displayNum}
                            </Text>
                          </View>
                          <Text
                            style={[styles.sheetQTitle, { color: colors.text }]}
                          >
                            {questionText}
                          </Text>
                        </View>
                        {(q as any).marks ? (
                          <View
                            style={[
                              styles.marksPill,
                              {
                                backgroundColor: isDark ? "#334155" : "#F1F5F9",
                                borderColor: colors.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.marksPillText,
                                { color: colors.textMuted },
                              ]}
                            >
                              {(q as any).marks} Mark{Number((q as any).marks) !== 1 ? "s" : ""}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Answers / Options */}
                      {answersList.length > 0 ? (
                        <View style={styles.sheetAnswersList}>
                          {answersList.map((ans, aIndex) => {
                            const isCorrect =
                              String(ans.is_correct) === "1" ||
                              ans.is_correct === 1 ||
                              (q.correct_answer !== undefined &&
                                q.correct_answer !== null &&
                                (String(q.correct_answer) === String(aIndex) ||
                                  String(q.correct_answer) === String(ans.id)));

                            const letter = String.fromCharCode(65 + aIndex);
                            const answerText = ans.answer || ans.text || "";

                            return (
                              <View
                                key={ans.id || aIndex}
                                style={[
                                  styles.sheetAnsRow,
                                  {
                                    backgroundColor: isCorrect
                                      ? isDark
                                        ? "#064E3B"
                                        : "#F0FDF4"
                                      : colors.inputBg,
                                    borderColor: isCorrect
                                      ? isDark
                                        ? "#059669"
                                        : "#86EFAC"
                                      : colors.inputBorder,
                                  },
                                ]}
                              >
                                {/* Option content with centered horizontal alignment and 12px gap */}
                                <View style={styles.optionContentLeft}>
                                  <View
                                    style={[
                                      styles.optionLetterCircle,
                                      {
                                        backgroundColor: isCorrect
                                          ? "#16A34A"
                                          : isDark
                                            ? "#334155"
                                            : "#F1F5F9",
                                        borderColor: isCorrect
                                          ? "#16A34A"
                                          : colors.border,
                                      },
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.optionLetterText,
                                        {
                                          color: isCorrect
                                            ? "#FFFFFF"
                                            : colors.textMuted,
                                        },
                                      ]}
                                    >
                                      {letter}
                                    </Text>
                                  </View>

                                  <Text
                                    style={[
                                      styles.sheetAnsText,
                                      {
                                        color: isCorrect
                                          ? isDark
                                            ? "#A7F3D0"
                                            : "#15803D"
                                          : colors.text,
                                        fontWeight: isCorrect ? "600" : "500",
                                      },
                                    ]}
                                  >
                                    {answerText}
                                  </Text>
                                </View>

                                {isCorrect && (
                                  <View
                                    style={[
                                      styles.sheetCorrectBadge,
                                      {
                                        backgroundColor: isDark
                                          ? "#064E3B"
                                          : "#DCFCE7",
                                        borderColor: isDark
                                          ? "#059669"
                                          : "#BBF7D0",
                                      },
                                    ]}
                                  >
                                    <Ionicons
                                      name="checkmark"
                                      size={12}
                                      color="#16A34A"
                                    />
                                    <Text style={styles.sheetCorrectBadgeText}>
                                      Correct
                                    </Text>
                                  </View>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.noAnswersText,
                            { color: colors.textMuted },
                          ]}
                        >
                          No options recorded for this question.
                        </Text>
                      )}
                    </View>
                  );
                })
              )}
            </BottomSheetScrollView>
          </View>
        )}
      </BottomSheetModal>
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
  headerContainer: {
    marginBottom: 14,
  },
  headerBannerGradient: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bannerLeftSection: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
    gap: 12,
  },
  bookIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerInfo: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "500",
  },
  addAssignmentTopBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  addAssignmentTopBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  totalBadgeRow: {
    marginTop: 14,
    flexDirection: "row",
  },
  totalBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  totalBadgeText: {
    color: "#78350F",
    fontSize: 12,
    fontWeight: "800",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 4,
  },
  listSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  listTitleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  listSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  itemCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemCountText: {
    fontSize: 12,
    fontWeight: "700",
  },
  assignmentCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerLeft: {
    flex: 1,
    marginRight: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  indexBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  indexBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  assignmentTitle: {
    fontSize: 16,
    fontWeight: "800",
    flex: 1,
  },
  typeBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  datesMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 14,
    marginBottom: 14,
  },
  dateMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dateMetaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    flexWrap: "wrap",
    gap: 8,
  },
  showQuestionsBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  showQuestionsBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  qCountPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  qCountPillText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  actionButtonsGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionIconButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  actionBtnLabel: {
    fontSize: 11,
    fontWeight: "700",
  },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  lockedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  expandedQuestionsContainer: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  noQuestionsText: {
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 8,
  },
  expandedQBlock: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  expandedQTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 8,
  },
  answersList: {
    gap: 6,
  },
  ansRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  ansOptText: {
    fontSize: 12,
    fontWeight: "700",
    marginRight: 6,
  },
  ansText: {
    fontSize: 12,
    flex: 1,
  },
  correctBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginLeft: 6,
  },
  correctBadgeText: {
    color: "#10B981",
    fontSize: 11,
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
    marginBottom: 20,
  },
  addFirstBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addFirstBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: 6,
  },
  sheetContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  sheetHeaderLeft: {
    flex: 1,
    marginRight: 10,
  },
  sheetHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sheetSubHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  sheetMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sheetMetaText: {
    fontSize: 11,
  },
  sheetCloseBtn: {
    padding: 2,
  },
  sheetSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  sheetSearchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  sheetScrollContent: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  sheetLoadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  sheetLoadingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  sheetQBlock: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  sheetQHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 14,
  },
  sheetQHeaderLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    flex: 1,
    gap: 14,
  },
  questionBadgePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 1,
  },
  questionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  sheetQTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 1,
  },
  marksPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 1,
  },
  marksPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sheetAnswersList: {
    gap: 6,
  },
  sheetAnsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    gap: 12,
    marginBottom: 6,
  },
  optionContentLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  optionLetterCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  optionLetterText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sheetAnsText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  sheetCorrectBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  sheetCorrectBadgeText: {
    color: "#16A34A",
    fontSize: 11,
    fontWeight: "700",
  },
  noAnswersText: {
    fontSize: 12,
    fontStyle: "italic",
    paddingVertical: 4,
  },
  sheetEmptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  sheetEmptyText: {
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },
  clearFilterBtn: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearFilterBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
