import InternalHeader from "@/components/InternalHeader";
import { useAppTheme } from "@/constants/theme";
import { useAppSelector } from "@/redux/hooks";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export interface ClassItem {
  id: string;
  school_id: string;
  shift_id: string;
  class_name: string;
  sort_order: string;
  status: string;
  created_on: string;
}

export interface ShiftItem {
  id: string;
  school_id: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  status: string;
  class: ClassItem[];
}

const formatTime = (timeStr: string) => {
  if (!timeStr) return "";
  try {
    const parts = timeStr.split(":");
    let hour = parseInt(parts[0], 10);
    const minute = parts[1] || "00";
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const formattedHour = String(hour).padStart(2, "0");
    return `${formattedHour}:${minute} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

export default function AssignmentScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  const [shifts, setShifts] = useState<ShiftItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef<boolean>(false);

  // Fetch Assignment Shifts from API
  const fetchAssignmentShifts = useCallback(
    async (isSilent = false) => {
      if (!isSilent) {
        setLoading(true);
      }
      setError(null);

      try {
        const [classesRes, shiftsRes] = await Promise.all([
          apiClient.get<any>('/teacher/academics/classes'),
          apiClient.get<any>('/teacher/academics/shifts'),
        ]);

        const classesList = Array.isArray(classesRes?.data?.data)
          ? classesRes.data.data
          : Array.isArray(classesRes.data)
          ? classesRes.data
          : classesRes.data?.classes || [];
        const shiftsList = Array.isArray(shiftsRes?.data?.data)
          ? shiftsRes.data.data
          : Array.isArray(shiftsRes.data)
          ? shiftsRes.data
          : shiftsRes.data?.shifts || [];

        const activeClasses = classesList.filter((c: any) => c.status === undefined || Number(c.status) === 1);
        const activeShifts = shiftsList.filter((s: any) => s.status === undefined || Number(s.status) === 1);

        const groupedShifts: ShiftItem[] = activeShifts
          .map((shift: any) => {
            const shiftClasses: ClassItem[] = activeClasses
              .filter(
                (c: any) =>
                  String(c.shift_id) === String(shift.id) ||
                  (c.shift_name &&
                    shift.shift_name &&
                    c.shift_name.trim().toLowerCase() === shift.shift_name.trim().toLowerCase())
              )
              .map((c: any) => ({
                id: String(c.id || c.class_id),
                school_id: String(c.school_id || ""),
                shift_id: String(shift.id),
                class_name: c.class_name || c.name || "",
                sort_order: String(c.sort_order || "0"),
                status: "1",
                created_on: "",
              }));

            return {
              ...shift,
              id: String(shift.id),
              shift_name: shift.shift_name || shift.name || "Shift",
              start_time: shift.start_time || "",
              end_time: shift.end_time || "",
              status: "1",
              class: shiftClasses,
            };
          })
          .filter((shift: any) => shift.class.length > 0);

        const unassigned = activeClasses
          .filter(
            (c: any) =>
              !activeShifts.some(
                (s: any) =>
                  String(s.id) === String(c.shift_id) ||
                  (c.shift_name &&
                    s.shift_name &&
                    c.shift_name.trim().toLowerCase() === s.shift_name.trim().toLowerCase())
              )
          )
          .map((c: any) => ({
            id: String(c.id || c.class_id),
            school_id: String(c.school_id || ""),
            shift_id: "0",
            class_name: c.class_name || c.name || "",
            sort_order: String(c.sort_order || "0"),
            status: "1",
            created_on: "",
          }));

        if (unassigned.length > 0) {
          groupedShifts.push({
            id: "general",
            school_id: "",
            shift_name: "General Classes",
            start_time: "",
            end_time: "",
            status: "1",
            class: unassigned,
          });
        }

        setShifts(groupedShifts);
      } catch (err: any) {
        console.warn("fetchAssignmentShifts error:", err.message);
        setError(err.message || "Failed to load assignments.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      fetchAssignmentShifts(hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [fetchAssignmentShifts])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAssignmentShifts(true);
    setRefreshing(false);
  }, [fetchAssignmentShifts]);

  const handleClassPress = (classItem: ClassItem, shiftItem: ShiftItem) => {
    router.push({
      pathname: "/(main)/(drawer)/academic/assignment-sections",
      params: {
        classId: classItem.id,
        className: classItem.class_name,
        shiftId: shiftItem.id,
        shiftName: shiftItem.shift_name.trim(),
      },
    });
  };

  const renderShiftItem = ({ item: shift }: { item: ShiftItem }) => {
    const shiftClasses = shift.class || [];
    const hasClasses = shiftClasses.length > 0;
    const formattedStartTime = formatTime(shift.start_time);
    const formattedEndTime = formatTime(shift.end_time);

    return (
      <View
        style={[
          styles.shiftCard,
          {
            backgroundColor: colors.cardBg,
            borderColor: colors.border,
            shadowColor: colors.shadowColor,
          },
        ]}
      >
        {/* Shift Card Header */}
        <View style={styles.shiftHeader}>
          <View style={styles.shiftHeaderLeft}>
            <View
              style={[
                styles.iconBadge,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Ionicons name="time-outline" size={20} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.shiftName, { color: colors.text }]}>
                {shift.shift_name.trim()} Shift
              </Text>
              {(formattedStartTime || formattedEndTime) && (
                <Text style={[styles.shiftTime, { color: colors.textMuted }]}>
                  {formattedStartTime} - {formattedEndTime}
                </Text>
              )}
            </View>
          </View>

          <View
            style={[
              styles.countBadge,
              {
                backgroundColor: hasClasses
                  ? colors.primaryLight
                  : isDark
                    ? colors.surfaceSubtle
                    : "#F3F4F6",
              },
            ]}
          >
            <Text
              style={[
                styles.countText,
                {
                  color: hasClasses ? colors.primary : colors.textMuted,
                },
              ]}
            >
              {shiftClasses.length}{" "}
              {shiftClasses.length === 1 ? "Class" : "Classes"}
            </Text>
          </View>
        </View>

        <View
          style={[styles.divider, { backgroundColor: colors.border }]}
        />

        {/* Classes List / Grid or Empty State */}
        {!hasClasses ? (
          <View style={styles.emptyShiftContainer}>
            <Ionicons
              name="albums-outline"
              size={32}
              color={colors.textMuted}
              style={{ marginBottom: 6 }}
            />
            <Text style={[styles.emptyShiftTitle, { color: colors.textMuted }]}>
              No classes in this shift
            </Text>
            <Text
              style={[styles.emptyShiftSubtitle, { color: colors.textMuted }]}
            >
              There are currently no classes assigned to the{" "}
              {shift.shift_name.trim()} shift.
            </Text>
          </View>
        ) : (
          <View style={styles.classesGrid}>
            {shiftClasses.map((cls) => (
              <TouchableOpacity
                key={cls.id}
                style={[
                  styles.classCard,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
                onPress={() => handleClassPress(cls, shift)}
                activeOpacity={0.7}
              >
                <View style={styles.classCardContent}>
                  <View
                    style={[
                      styles.classIconCircle,
                      { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text style={styles.classIconText}>
                      {cls.class_name.substring(0, 2)}
                    </Text>
                  </View>

                  <View style={styles.classInfo}>
                    <Text style={[styles.className, { color: colors.text }]}>
                      Class {cls.class_name}
                    </Text>
                    <Text
                      style={[styles.classSubtext, { color: colors.textMuted }]}
                    >
                      Tap to view assignments
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.primary}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderEmptyContainer = () => {
    if (loading) return null;

    return (
      <View style={styles.emptyScreenContainer}>
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
        <Text style={[styles.emptyScreenTitle, { color: colors.text }]}>
          {error ? "Unable to Load Assignments" : "No Shift Data Available"}
        </Text>
        <Text style={[styles.emptyScreenSubtitle, { color: colors.textMuted }]}>
          {error || "There are no shifts or classes configured at this time."}
        </Text>
        {error && (
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => fetchAssignmentShifts()}
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
      <InternalHeader title="Assignments" />

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading shift assignments...
          </Text>
        </View>
      ) : (
        <FlatList
          data={shifts}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderShiftItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmptyContainer}
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
  shiftCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  shiftHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shiftHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  shiftName: {
    fontSize: 16,
    fontWeight: "700",
  },
  shiftTime: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: "700",
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  emptyShiftContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    paddingHorizontal: 12,
  },
  emptyShiftTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 4,
  },
  emptyShiftSubtitle: {
    fontSize: 12,
    textAlign: "center",
  },
  classesGrid: {
    gap: 10,
  },
  classCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  classCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  classIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  classIconText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 14,
    fontWeight: "700",
  },
  classSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyScreenContainer: {
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
  emptyScreenTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyScreenSubtitle: {
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
