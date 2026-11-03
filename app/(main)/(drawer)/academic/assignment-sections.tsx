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

export interface SectionItem {
  id: string;
  school_id: string;
  class_id: string;
  section_name: string;
  capacity: string;
  note: string;
  sort_order: string;
  status: string;
}

export interface AssignmentSectionResponseData {
  class_details: ClassDetails;
  class_section: SectionItem[];
}

export default function AssignmentSectionsScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const params = useLocalSearchParams<{
    classId?: string;
    className?: string;
    shiftId?: string;
    shiftName?: string;
  }>();

  const { colors, isDark } = useAppTheme();

  const [data, setData] = useState<AssignmentSectionResponseData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef<boolean>(false);

  const targetClassId = params.classId || "1";

  const formatClassName = (name?: string) => {
    if (!name) return "";
    const trimmed = name.trim();
    return trimmed.toLowerCase().startsWith("class") ? trimmed : `Class ${trimmed}`;
  };

  const displayClassName =
    formatClassName(params.className) ||
    formatClassName(data?.class_details?.class_name) ||
    "Class Sections";

  // Fetch sections under class from API
  const fetchAssignmentSections = useCallback(
    async (isSilent = false) => {
      if (!isSilent) {
        setLoading(true);
      }
      setError(null);

      try {
        const [secRes, classRes] = await Promise.all([
          apiClient.get<any>(`/teacher/academics/sections/${targetClassId}`),
          !params.className
            ? apiClient.get<any>(`/teacher/academics/classes/${targetClassId}`).catch(() => null)
            : Promise.resolve(null),
        ]);

        const resData = secRes?.data;
        const sectionsList: any[] = Array.isArray(resData?.data)
          ? resData.data
          : Array.isArray(resData)
          ? resData
          : resData?.data?.sections || resData?.sections || [];

        const resolvedClassName =
          params.className ||
          classRes?.data?.data?.class_name ||
          classRes?.data?.class_name ||
          "";

        setData({
          class_details: {
            id: String(targetClassId),
            school_id: "",
            shift_id: String(params.shiftId || ""),
            class_name: resolvedClassName,
            sort_order: "0",
            status: "1",
            created_on: "",
            shift_name: params.shiftName || "",
          },
          class_section: sectionsList.map((sec: any) => ({
            id: String(sec.id),
            school_id: String(sec.school_id || ""),
            class_id: String(sec.class_id || targetClassId),
            section_name: sec.section_name || sec.name || "",
            capacity: String(sec.capacity ?? "0"),
            note: sec.note || "",
            sort_order: String(sec.sort_order || "0"),
            status: String(sec.status || "1"),
          })),
        });
      } catch (err: any) {
        console.warn("fetchAssignmentSections exception:", err.message);
        setError(err.message || "An error occurred while loading sections.");
      } finally {
        setLoading(false);
      }
    },
    [targetClassId, params.className, params.shiftId, params.shiftName],
  );

  const handleBackToAssignments = useCallback(() => {
    router.replace("/(main)/(drawer)/academic/assignment");
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleBackToAssignments();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => subscription.remove();
    }, [handleBackToAssignments]),
  );

  useFocusEffect(
    useCallback(() => {
      fetchAssignmentSections(hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [fetchAssignmentSections])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAssignmentSections(true);
    setRefreshing(false);
  }, [fetchAssignmentSections]);

  const handleSectionPress = (section: SectionItem) => {
    const classNameVal =
      data?.class_details?.class_name || params.className || "";
    const shiftNameVal =
      data?.class_details?.shift_name?.trim() || params.shiftName || "";

    router.push({
      pathname: "/(main)/(drawer)/academic/assignment-subjects",
      params: {
        classId: section.class_id || targetClassId,
        sectionId: section.id,
        className: classNameVal,
        sectionName: section.section_name,
        shiftName: shiftNameVal,
      },
    });
  };

  const sectionsList = data?.class_section || [];
  const classDetails = data?.class_details;

  const renderSectionCard = ({ item: section }: { item: SectionItem }) => {
    // const hasNote = Boolean(section.note && section.note.trim().length > 0);

    return (
      <TouchableOpacity
        style={[
          styles.sectionCard,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
            shadowColor: colors.shadowColor,
          },
        ]}
        onPress={() => handleSectionPress(section)}
        activeOpacity={0.75}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            <View
              style={[
                styles.sectionAvatar,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.sectionAvatarText}>
                {section.section_name}
              </Text>
            </View>

            <View style={styles.sectionInfo}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Section {section.section_name}
              </Text>
              <Text
                style={[styles.sectionSubtitle, { color: colors.textMuted }]}
              >
                {section.capacity && section.capacity !== "0"
                  ? `Capacity: ${section.capacity} Students`
                  : `Manage assignments for Section ${section.section_name}`}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.chevronCircle,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.primary}
            />
          </View>
        </View>

        {/* {hasNote && (
          <View
            style={[
              styles.noteBox,
              { backgroundColor: colors.surfaceSubtle },
            ]}
          >
            <Ionicons
              name="document-text-outline"
              size={14}
              color={colors.textMuted}
              style={{ marginRight: 6 }}
            />
            <Text style={[styles.noteText, { color: colors.textMuted }]}>
              {section.note.trim()}
            </Text>
          </View>
        )} */}
      </TouchableOpacity>
    );
  };

  const renderEmptySections = () => {
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
            name="layers-outline"
            size={48}
            color={colors.textMuted}
          />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {error ? "Error Loading Sections" : "No Sections Found"}
        </Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          {error ||
            `There are no sections available for ${displayClassName} at this time.`}
        </Text>
        {error && (
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => fetchAssignmentSections()}
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
        title={displayClassName}
        onBack={handleBackToAssignments}
      />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading class sections...
          </Text>
        </View>
      ) : (
        <FlatList
          data={sectionsList}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderSectionCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            classDetails || sectionsList.length > 0 ? (
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
                      {displayClassName}
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
                      styles.sectionCountPill,
                      { backgroundColor: colors.primaryLight },
                    ]}
                  >
                    <Text
                      style={[
                        styles.sectionCountText,
                        { color: colors.primary },
                      ]}
                    >
                      {sectionsList.length}{" "}
                      {sectionsList.length === 1 ? "Section" : "Sections"}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null
          }
          ListEmptyComponent={renderEmptySections}
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
  sectionCountPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  sectionCountText: {
    fontSize: 12,
    fontWeight: "800",
  },
  sectionCard: {
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
  sectionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sectionAvatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  sectionInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  chevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  noteBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  noteText: {
    fontSize: 12,
    flex: 1,
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
