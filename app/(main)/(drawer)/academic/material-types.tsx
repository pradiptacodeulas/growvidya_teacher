import InternalHeader from "@/components/InternalHeader";
import { useAppTheme } from "@/constants/theme";
import { useAppSelector } from "@/redux/hooks";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "@/services/apiClient";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Menu, MenuOption, MenuOptions, MenuTrigger } from "react-native-popup-menu";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import Toast from "react-native-toast-message";

export interface MaterialTypeItem {
  id: string;
  school_id?: string;
  material_type_name: string;
  description?: string;
  display_order?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export default function MaterialTypesScreen() {
  const router = useRouter();
  const token = useAppSelector((state) => state.auth.token);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const handleBack = useCallback(() => {
    router.replace("/(main)/(drawer)/academic/study-material");
  }, [router]);

  // BottomSheet reference for Add / Edit
  const addTypeSheetRef = useRef<BottomSheetModal>(null);

  // List States
  const [materialTypes, setMaterialTypes] = useState<MaterialTypeItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [listError, setListError] = useState<string | null>(null);



  // Form States (Supports both Add & Edit)
  const [editingItem, setEditingItem] = useState<MaterialTypeItem | null>(null);
  const [typeName, setTypeName] = useState<string>("");
  const [displayOrder, setDisplayOrder] = useState<string>("1");
  const [status, setStatus] = useState<string>("1"); // "1" = Active, "2" = Inactive
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Inline Errors
  const [typeNameError, setTypeNameError] = useState<string | null>(null);
  const [displayOrderError, setDisplayOrderError] = useState<string | null>(null);

  const isEditing = editingItem !== null;

  // 1. Fetch Material Types List
  const fetchMaterialTypes = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setIsLoadingList(true);
      setListError(null);

      try {
        const response = await apiClient.get<any>('/teacher/academics/material-types');
        const raw = response?.data?.data ?? response?.data;
        const list = Array.isArray(raw?.material_types)
          ? raw.material_types
          : Array.isArray(raw)
          ? raw
          : Array.isArray(response?.data?.material_types)
          ? response.data.material_types
          : [];

        setMaterialTypes(list);
        if (list.length === 0 && response?.data && response.data.success === false) {
          setListError(response.data.message || "Failed to load material types");
        }
      } catch (e: any) {
        console.warn("fetchMaterialTypes error:", e?.message);
        setListError(e?.message || "Failed to load material types");
        setMaterialTypes([]);
      } finally {
        setIsLoadingList(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      fetchMaterialTypes(materialTypes.length > 0);

      const onBackPress = () => {
        handleBack();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => subscription.remove();
    }, [handleBack, fetchMaterialTypes, materialTypes.length]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMaterialTypes(true);
  };

  // Open Add Material Type BottomSheet
  const handleOpenAddSheet = () => {
    setEditingItem(null);
    setTypeName("");
    setDisplayOrder(String(materialTypes.length + 1 || 1));
    setStatus("1");
    setDescription("");
    setTypeNameError(null);
    setDisplayOrderError(null);
    addTypeSheetRef.current?.present();
  };

  // Open Edit Material Type BottomSheet
  const handleOpenEditSheet = (item: MaterialTypeItem) => {
    setEditingItem(item);
    setTypeName(item.material_type_name || "");
    setDisplayOrder(String(item.display_order || "1"));
    setStatus(String(item.status || "1"));
    setDescription(item.description || "");
    setTypeNameError(null);
    setDisplayOrderError(null);
    addTypeSheetRef.current?.present();
  };

  // Close BottomSheet
  const handleCloseAddSheet = () => {
    addTypeSheetRef.current?.dismiss();
  };

  // Submit Form (Save New or Update Existing)
  const handleSaveMaterialType = async () => {
    let hasError = false;
    setTypeNameError(null);
    setDisplayOrderError(null);

    const trimmedName = typeName.trim();
    const trimmedOrder = displayOrder.trim();

    if (!trimmedName) {
      setTypeNameError("Material Type Name is required");
      hasError = true;
    }

    if (!trimmedOrder) {
      setDisplayOrderError("Display Order is required");
      hasError = true;
    } else if (isNaN(Number(trimmedOrder))) {
      setDisplayOrderError("Display Order must be a valid number");
      hasError = true;
    }

    if (hasError) return;

    setIsSubmitting(true);

    const isEditMode = editingItem !== null;
    const payload: any = {
      material_type_name: trimmedName,
      type_name: trimmedName,
      description: description.trim(),
      display_order: trimmedOrder,
      status: status,
    };

    try {
      let resData: any;
      if (isEditMode) {
        resData = await apiClient.put(`/teacher/academics/material-types/${editingItem.id}`, payload);
      } else {
        resData = await apiClient.post('/teacher/academics/material-types', payload);
      }

      const isSuccess =
        resData?.data?.success === true ||
        resData?.data?.status === true ||
        resData?.status === 200 ||
        resData?.status === 201 ||
        resData?.success === true ||
        resData?.status === true;

      if (isSuccess) {
        Toast.show({
          type: "success",
          text1: "Success",
          text2:
            resData?.data?.message ||
            resData?.message ||
            (isEditMode
              ? "Material type updated successfully"
              : "Material type saved successfully"),
        });
        handleCloseAddSheet();
        fetchMaterialTypes(true);
      } else {
        Toast.show({
          type: "error",
          text1: isEditMode ? "Update Failed" : "Save Failed",
          text2: resData?.data?.message || resData?.message || "Operation failed",
        });
      }
    } catch (e: any) {
      console.warn("handleSaveMaterialType error:", e?.message);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e?.message || "Failed to process request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Confirmation Alert Handler
  const handlePromptDelete = (item: MaterialTypeItem) => {
    Alert.alert(
      "Delete Material Type",
      `Are you sure you want to delete "${item.material_type_name}"? This action cannot be undone.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => executeDeleteMaterialType(item),
        },
      ],
      { cancelable: true },
    );
  };

  // Delete Material Type API Call
  const executeDeleteMaterialType = async (targetItem: MaterialTypeItem) => {
    if (!targetItem) return;

    try {
      const resData: any = await apiClient.delete(`/teacher/academics/material-types/${targetItem.id}`);

      const isSuccess =
        resData?.data?.success === true ||
        resData?.data?.status === true ||
        resData?.status === 200 ||
        resData?.status === 204 ||
        resData?.success === true ||
        resData?.status === true;

      if (isSuccess) {
        Toast.show({
          type: "success",
          text1: "Success",
          text2: resData?.data?.message || resData?.message || "Material type deleted successfully",
        });
        fetchMaterialTypes(true);
      } else {
        Toast.show({
          type: "error",
          text1: "Delete Failed",
          text2: resData?.data?.message || resData?.message || "Could not delete material type",
        });
      }
    } catch (e: any) {
      console.warn("executeDeleteMaterialType error:", e?.message);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e?.message || "Failed to delete material type.",
      });
    }
  };

  // Backdrop renderer for BottomSheetModal
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  // Render individual material type item
  const renderMaterialTypeCard = ({ item }: { item: MaterialTypeItem }) => {
    const isActive = String(item.status) === "1";

    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <View style={styles.cardLeftGroup}>
            <View
              style={[
                styles.typeIconBg,
                { backgroundColor: colors.primary + "15" },
              ]}
            >
              <Ionicons name="layers-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.titleCol}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {item.material_type_name}
              </Text>
              {item.display_order ? (
                <Text style={[styles.orderText, { color: colors.textMuted }]}>
                  Order: #{item.display_order}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.rightBadgeRow}>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: isActive ? "#10B98115" : "#EF444415" },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isActive ? "#10B981" : "#EF4444" },
                ]}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: isActive ? "#10B981" : "#EF4444" },
                ]}
              >
                {isActive ? "Active" : "Inactive"}
              </Text>
            </View>

            {/* react-native-popup-menu Trigger & Options */}
            <Menu>
              <MenuTrigger>
                <View
                  style={[
                    styles.threeDotsBtn,
                    { backgroundColor: colors.surfaceSubtle, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="ellipsis-vertical" size={18} color={colors.text} />
                </View>
              </MenuTrigger>

              <MenuOptions
                customStyles={{
                  optionsContainer: [
                    styles.popupMenuContainer,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      shadowColor: colors.shadowColor,
                    },
                  ],
                }}
              >
                <MenuOption onSelect={() => handleOpenEditSheet(item)}>
                  <View style={styles.popupOptionRow}>
                    <View
                      style={[styles.popupIconBg, { backgroundColor: colors.primary + "15" }]}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.primary} />
                    </View>
                    <Text style={[styles.popupOptionText, { color: colors.text }]}>Edit</Text>
                  </View>
                </MenuOption>

                <MenuOption onSelect={() => handlePromptDelete(item)}>
                  <View style={styles.popupOptionRow}>
                    <View
                      style={[styles.popupIconBg, { backgroundColor: "#EF444415" }]}
                    >
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </View>
                    <Text style={[styles.popupOptionText, { color: "#EF4444" }]}>Delete</Text>
                  </View>
                </MenuOption>
              </MenuOptions>
            </Menu>
          </View>
        </View>

        {item.description ? (
          <Text style={[styles.cardDescription, { color: colors.textMuted }]}>
            {item.description}
          </Text>
        ) : null}
      </View>
    );
  };

  const headerRightAction = (
    <TouchableOpacity
      style={[styles.headerAddBtn, { backgroundColor: colors.primary }]}
      onPress={handleOpenAddSheet}
      activeOpacity={0.8}
    >
      <Ionicons name="add" size={18} color="#FFFFFF" />
      <Text style={styles.headerAddBtnText}>Add Type</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Material Types" onBack={handleBack} rightAction={headerRightAction} />

      {/* Main Material Types List View */}
      {isLoadingList && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Loading material types...
          </Text>
        </View>
      ) : listError && materialTypes.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={56} color="#EF4444" />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Failed to load
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {listError}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => fetchMaterialTypes()}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : materialTypes.length === 0 ? (
        <View style={styles.centerContainer}>
          <View
            style={[
              styles.emptyIconBg,
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
            No Material Types Found
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Tap "Add Type" button in the header to create a new material type.
          </Text>
          <TouchableOpacity
            style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
            onPress={handleOpenAddSheet}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.emptyAddBtnText}>Add Material Type</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={materialTypes}
          keyExtractor={(item, idx) => String(item.id || idx)}
          renderItem={renderMaterialTypeCard}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />
      )}

      {/* Add / Edit Material Type BottomSheet Modal */}
      <BottomSheetModal
        ref={addTypeSheetRef}
        index={0}
        snapPoints={["68%", "90%"]}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={[
          styles.handleIndicator,
          { backgroundColor: colors.border },
        ]}
        enablePanDownToClose
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View
            style={[styles.modalHeader, { borderBottomColor: colors.border }]}
          >
            <View style={styles.modalHeaderTitleRow}>
              <Ionicons name="layers-outline" size={20} color={colors.primary} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {isEditing ? "Edit Material Type" : "Add Material Type"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.headerSaveBtn, { backgroundColor: colors.primary }]}
              onPress={handleSaveMaterialType}
              activeOpacity={0.8}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.headerSaveBtnText}>
                    {isEditing ? "Update" : "Save"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Form ScrollView */}
          <BottomSheetScrollView
            contentContainerStyle={styles.formScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* 1. Material Type Name (Required) */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: colors.text }]}>
                Material Type Name <Text style={styles.asterisk}>*</Text>
              </Text>
              <BottomSheetTextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: typeNameError ? "#EF4444" : colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                placeholder="e.g. Reference Book, Worksheets, QB"
                placeholderTextColor={colors.textMuted}
                value={typeName}
                onChangeText={(val) => {
                  setTypeName(val);
                  if (typeNameError) setTypeNameError(null);
                }}
              />
              {typeNameError ? (
                <Text style={styles.errorText}>{typeNameError}</Text>
              ) : null}
            </View>

            {/* 2. Display Order (Required Number) */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: colors.text }]}>
                Display Order <Text style={styles.asterisk}>*</Text>
              </Text>
              <BottomSheetTextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: displayOrderError
                      ? "#EF4444"
                      : colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                placeholder="e.g. 1"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={displayOrder}
                onChangeText={(val) => {
                  setDisplayOrder(val);
                  if (displayOrderError) setDisplayOrderError(null);
                }}
              />
              {displayOrderError ? (
                <Text style={styles.errorText}>{displayOrderError}</Text>
              ) : null}
            </View>

            {/* 3. Status Selection (Active=1 / Inactive=2) */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: colors.text }]}>Status</Text>
              <View style={styles.statusToggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.statusOptionBtn,
                    {
                      backgroundColor:
                        status === "1"
                          ? "#10B98115"
                          : colors.surfaceSubtle,
                      borderColor: status === "1" ? "#10B981" : colors.border,
                    },
                  ]}
                  onPress={() => setStatus("1")}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: status === "1" ? "#10B981" : colors.textMuted },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusOptionText,
                      { color: status === "1" ? "#10B981" : colors.textMuted },
                    ]}
                  >
                    Active
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.statusOptionBtn,
                    {
                      backgroundColor:
                        status === "2"
                          ? "#EF444415"
                          : colors.surfaceSubtle,
                      borderColor: status === "2" ? "#EF4444" : colors.border,
                    },
                  ]}
                  onPress={() => setStatus("2")}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: status === "2" ? "#EF4444" : colors.textMuted },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusOptionText,
                      { color: status === "2" ? "#EF4444" : colors.textMuted },
                    ]}
                  >
                    Inactive
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 4. Description (Optional) */}
            <View style={styles.fieldContainer}>
              <Text style={[styles.label, { color: colors.text }]}>
                Description <Text style={styles.optionalText}>(Optional)</Text>
              </Text>
              <BottomSheetTextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                placeholder="Add optional notes or details about this material type..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />
            </View>
          </BottomSheetScrollView>
        </View>
      </BottomSheetModal>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  headerAddBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  centerContainer: {
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
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
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
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  emptyAddBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLeftGroup: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  typeIconBg: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  titleCol: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  orderText: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: "500",
  },
  rightBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  threeDotsBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  popupMenuContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 4,
    width: 120,
    elevation: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  popupOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 8,
  },
  popupIconBg: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  popupOptionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  cardDescription: {
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  modalHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  formScrollContent: {
    padding: 20,
    gap: 16,
  },
  fieldContainer: {
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
  },
  asterisk: {
    color: "#EF4444",
  },
  optionalText: {
    fontSize: 12,
    fontWeight: "400",
    color: "#8E8E93",
  },
  input: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  multilineInput: {
    height: 90,
    paddingTop: 12,
    paddingBottom: 12,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  statusToggleContainer: {
    flexDirection: "row",
    gap: 12,
  },
  statusOptionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  statusOptionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  headerSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  headerSaveBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  confirmCard: {
    width: "88%",
    maxWidth: 340,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
  },
  deleteIconBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  confirmSubTitle: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  confirmButtonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: "100%",
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelConfirmBtn: {
    borderWidth: 1,
  },
  deleteConfirmBtn: {
    elevation: 2,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
