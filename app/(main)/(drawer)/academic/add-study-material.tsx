import InternalHeader from "@/components/InternalHeader";
import SelectionBottomSheet from "@/components/common/SelectionBottomSheet";
import { useAppTheme } from "@/constants/theme";
import { useAppSelector } from "@/redux/hooks";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/services/apiClient";
import { ActivityIndicator, Alert, BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

// Data Interfaces
export interface AcademicYearItem {
  id: string;
  academic_year: string;
}

export interface MaterialTypeItem {
  id: string;
  material_type_name: string;
}

export interface ClassItem {
  id: string;
  class_id?: string;
  class_name: string;
}

export interface SectionItem {
  id: string;
  section_name: string;
}

export interface SubjectItem {
  id: string;
  subject_name: string;
}

export interface SelectedAttachment {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

const formatDateToYYYYMMDD = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatFileSize = (sizeBytes?: number): string => {
  if (!sizeBytes) return "";
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function AddStudyMaterialScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // BottomSheet References
  const academicYearSheetRef = useRef<BottomSheetModal>(null);
  const classSheetRef = useRef<BottomSheetModal>(null);
  const sectionSheetRef = useRef<BottomSheetModal>(null);
  const subjectSheetRef = useRef<BottomSheetModal>(null);
  const materialTypeSheetRef = useRef<BottomSheetModal>(null);

  // Filter Data States
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [materialTypes, setMaterialTypes] = useState<MaterialTypeItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  // Filter Loading States
  const [isLoadingYears, setIsLoadingYears] = useState<boolean>(false);
  const [isLoadingClasses, setIsLoadingClasses] = useState<boolean>(false);
  const [isLoadingSections, setIsLoadingSections] = useState<boolean>(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState<boolean>(false);
  const [isLoadingTypes, setIsLoadingTypes] = useState<boolean>(false);

  // Selected Options
  const [selectedAcademicYear, setSelectedAcademicYear] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedMaterialType, setSelectedMaterialType] = useState<string>("");

  // Form Field States
  const [title, setTitle] = useState<string>("");
  const [chapter, setChapter] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [selectedAttachment, setSelectedAttachment] = useState<SelectedAttachment | null>(null);

  // Date States
  const [publishDate, setPublishDate] = useState<Date>(new Date());
  const [showPublishDatePicker, setShowPublishDatePicker] = useState<boolean>(false);

  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showExpiryDatePicker, setShowExpiryDatePicker] = useState<boolean>(false);

  // Controls & Options
  const [allowDownload, setAllowDownload] = useState<string>("1"); // "1" = Yes, "0" = No
  const [displayOrder, setDisplayOrder] = useState<string>("1");
  const [status, setStatus] = useState<string>("1"); // "1" = Active, "2" = Inactive

  // Submit Loading & Inline Errors
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Navigation Back Handler
  const handleBack = useCallback(() => {
    router.replace("/(main)/(drawer)/academic/study-material");
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleBack();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        onBackPress,
      );

      return () => subscription.remove();
    }, [handleBack]),
  );

  // 1. Fetch Academic Years
  const fetchAcademicYears = useCallback(async () => {
    setIsLoadingYears(true);
    try {
      const response = await apiClient.get<any>('/teacher/academics/years');
      const raw = response?.data?.data ?? response?.data;
      const list = Array.isArray(raw?.years)
        ? raw.years
        : Array.isArray(raw)
        ? raw
        : [];
      setAcademicYears(list);
    } catch (e: any) {
      console.warn("fetchAcademicYears error:", e?.message);
    } finally {
      setIsLoadingYears(false);
    }
  }, []);

  // 2. Fetch Classes
  const fetchClasses = useCallback(async () => {
    setIsLoadingClasses(true);
    try {
      const response = await apiClient.get<any>('/teacher/academics/classes');
      const raw = response?.data?.data ?? response?.data;
      const rawClasses = Array.isArray(raw?.classes)
        ? raw.classes
        : Array.isArray(raw)
        ? raw
        : [];
      setClasses(rawClasses);
    } catch (e: any) {
      console.warn("fetchClasses error:", e?.message);
    } finally {
      setIsLoadingClasses(false);
    }
  }, []);

  // 3. Fetch Material Types
  const fetchMaterialTypes = useCallback(async () => {
    setIsLoadingTypes(true);
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
    } catch (e: any) {
      console.warn("fetchMaterialTypes error:", e?.message);
    } finally {
      setIsLoadingTypes(false);
    }
  }, []);

  // 4. Fetch Sections by class_id
  const fetchSections = useCallback(
    async (classId: string) => {
      if (!classId) {
        setSections([]);
        return;
      }
      setIsLoadingSections(true);
      try {
        const response = await apiClient.get<any>(`/teacher/academics/sections/${classId}`);
        const raw = response?.data?.data ?? response?.data;
        const dataList = Array.isArray(raw?.sections)
          ? raw.sections
          : Array.isArray(raw)
          ? raw
          : [];
        setSections(dataList);
      } catch (e: any) {
        console.warn("fetchSections error:", e?.message);
        setSections([]);
      } finally {
        setIsLoadingSections(false);
      }
    },
    [],
  );

  // 5. Fetch Subjects by class_id
  const fetchSubjects = useCallback(
    async (classId: string) => {
      if (!classId) {
        setSubjects([]);
        return;
      }
      setIsLoadingSubjects(true);
      try {
        const response = await apiClient.get<any>(`/teacher/academics/subjects?class_id=${classId}`);
        const raw = response?.data?.data ?? response?.data;
        const dataList = Array.isArray(raw?.subjects)
          ? raw.subjects
          : Array.isArray(raw)
          ? raw
          : [];
        setSubjects(dataList);
      } catch (e: any) {
        console.warn("fetchSubjects error:", e?.message);
        setSubjects([]);
      } finally {
        setIsLoadingSubjects(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchAcademicYears();
    fetchClasses();
    fetchMaterialTypes();
  }, [fetchAcademicYears, fetchClasses, fetchMaterialTypes]);

  // Handle Class Change
  const handleClassSelect = (item: ClassItem) => {
    const classId = String(item.class_id || item.id);
    if (classId !== selectedClass) {
      setSelectedClass(classId);
      setSelectedSection("");
      setSelectedSubject("");
      fetchSections(classId);
      fetchSubjects(classId);
      setErrors((prev) => ({ ...prev, class: "", section: "", subject: "" }));
    }
  };

  const handlePickAttachment = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];

        // Check Max Size 10MB
        if (asset.size && asset.size > 10 * 1024 * 1024) {
          Alert.alert("File Too Large", "Please select a file smaller than 10MB.");
          return;
        }

        setSelectedAttachment({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || "application/octet-stream",
          size: asset.size,
        });
        setErrors((prev) => ({ ...prev, attachment: "" }));
      }
    } catch (err: any) {
      console.warn("DocumentPicker error:", err);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Failed to select attachment.",
      });
    }
  };

  // Form Validation & Submission
  const handleSubmit = async () => {
    const newErrors: { [key: string]: string } = {};

    if (!selectedAcademicYear) newErrors.academicYear = "Academic Year is required";
    if (!selectedClass) newErrors.class = "Class is required";
    if (!selectedSection) newErrors.section = "Section is required";
    if (!selectedSubject) newErrors.subject = "Subject is required";
    if (!selectedMaterialType) newErrors.materialType = "Material Type is required";
    if (!title.trim()) newErrors.title = "Title is required";
    if (!selectedAttachment) newErrors.attachment = "Attachment file is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please fill in all required fields marked with *",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      let attachmentUrl = "";
      if (selectedAttachment) {
        const uploadData = new FormData();
        uploadData.append("file", {
          uri: selectedAttachment.uri,
          name: selectedAttachment.name,
          type: selectedAttachment.mimeType || "application/octet-stream",
        } as any);
        const uploadRes: any = await apiClient.post("/upload/single?folder=studymaterial", uploadData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const uploadRaw = uploadRes?.data?.data ?? uploadRes?.data;
        attachmentUrl = uploadRaw?.file_path || uploadRaw?.url || "";
      }

      const payload = {
        academic_year_id: selectedAcademicYear,
        class_id: selectedClass,
        section_id: selectedSection,
        subject_id: selectedSubject,
        material_type_id: selectedMaterialType,
        title: title.trim(),
        chapter: chapter.trim(),
        description: description.trim(),
        publish_date: formatDateToYYYYMMDD(publishDate),
        expiry_date: expiryDate ? formatDateToYYYYMMDD(expiryDate) : null,
        allow_download: allowDownload,
        display_order: displayOrder.trim() ? Number(displayOrder.trim()) : 0,
        status: status,
        attachment: attachmentUrl,
      };

      const resData: any = await apiClient.post("/teacher/academics/study-materials", payload);

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
          text2: resData?.data?.message || resData?.message || "Study material uploaded successfully",
        });
        handleBack();
      } else {
        Toast.show({
          type: "error",
          text1: "Upload Failed",
          text2: resData?.data?.message || resData?.message || "Failed to save study material.",
        });
      }
    } catch (e: any) {
      console.warn("handleSubmit error:", e?.message);
      Toast.show({
        type: "error",
        text1: "Error",
        text2: e?.message || "Network error. Failed to upload study material.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Label Helpers for Select Buttons
  const getAcademicYearLabel = () => {
    if (!selectedAcademicYear) return "Select Academic Year";
    const found = academicYears.find((y) => String(y.id) === selectedAcademicYear);
    return found ? found.academic_year : "Select Academic Year";
  };

  const getClassLabel = () => {
    if (!selectedClass) return "Select Class";
    const found = classes.find((c) => String(c.class_id || c.id) === selectedClass);
    return found ? `Class ${found.class_name}` : "Select Class";
  };

  const getSectionLabel = () => {
    if (!selectedSection) return "Select Section";
    const found = sections.find((s) => String(s.id) === selectedSection);
    return found ? `Section ${found.section_name}` : "Select Section";
  };

  const getSubjectLabel = () => {
    if (!selectedSubject) return "Select Subject";
    const found = subjects.find((sb) => String(sb.id) === selectedSubject);
    return found ? found.subject_name : "Select Subject";
  };

  const getMaterialTypeLabel = () => {
    if (!selectedMaterialType) return "Select Material Type";
    const found = materialTypes.find((m) => String(m.id) === selectedMaterialType);
    return found ? found.material_type_name : "Select Material Type";
  };

  const headerRightAction = (
    <TouchableOpacity
      style={styles.headerCancelBtn}
      onPress={handleBack}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Text style={[styles.headerCancelBtnText, { color: colors.textMuted }]}>
        Cancel
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader
        title="Add Study Material"
        onBack={handleBack}
        rightAction={headerRightAction}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 40 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Section 1: Academic & Class Selection */}
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            Target Audience & Type
          </Text>

          {/* 1. Academic Year */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Academic Year <Text style={styles.asterisk}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.selectButton,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: errors.academicYear ? "#EF4444" : colors.inputBorder,
                },
              ]}
              onPress={() => academicYearSheetRef.current?.present()}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.selectText,
                  { color: selectedAcademicYear ? colors.text : colors.textMuted },
                ]}
              >
                {getAcademicYearLabel()}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {errors.academicYear ? (
              <Text style={styles.errorText}>{errors.academicYear}</Text>
            ) : null}
          </View>

          {/* 2. Class */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Class <Text style={styles.asterisk}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.selectButton,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: errors.class ? "#EF4444" : colors.inputBorder,
                },
              ]}
              onPress={() => classSheetRef.current?.present()}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.selectText,
                  { color: selectedClass ? colors.text : colors.textMuted },
                ]}
              >
                {getClassLabel()}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {errors.class ? (
              <Text style={styles.errorText}>{errors.class}</Text>
            ) : null}
          </View>

          {/* 3. Section & 4. Subject Row */}
          <View style={styles.twoColRow}>
            {/* Section */}
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.text }]}>
                Section <Text style={styles.asterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.selectButton,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: errors.section ? "#EF4444" : colors.inputBorder,
                  },
                ]}
                onPress={() => {
                  if (!selectedClass) {
                    Toast.show({
                      type: "info",
                      text1: "Select Class First",
                      text2: "Please select a class before selecting section.",
                    });
                    return;
                  }
                  sectionSheetRef.current?.present();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.selectText,
                    { color: selectedSection ? colors.text : colors.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {getSectionLabel()}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              {errors.section ? (
                <Text style={styles.errorText}>{errors.section}</Text>
              ) : null}
            </View>

            {/* Subject */}
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.text }]}>
                Subject <Text style={styles.asterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.selectButton,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: errors.subject ? "#EF4444" : colors.inputBorder,
                  },
                ]}
                onPress={() => {
                  if (!selectedClass) {
                    Toast.show({
                      type: "info",
                      text1: "Select Class First",
                      text2: "Please select a class before selecting subject.",
                    });
                    return;
                  }
                  subjectSheetRef.current?.present();
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.selectText,
                    { color: selectedSubject ? colors.text : colors.textMuted },
                  ]}
                  numberOfLines={1}
                >
                  {getSubjectLabel()}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              {errors.subject ? (
                <Text style={styles.errorText}>{errors.subject}</Text>
              ) : null}
            </View>
          </View>

          {/* 5. Material Type */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Material Type <Text style={styles.asterisk}>*</Text>
            </Text>
            <TouchableOpacity
              style={[
                styles.selectButton,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: errors.materialType ? "#EF4444" : colors.inputBorder,
                },
              ]}
              onPress={() => materialTypeSheetRef.current?.present()}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.selectText,
                  { color: selectedMaterialType ? colors.text : colors.textMuted },
                ]}
              >
                {getMaterialTypeLabel()}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            {errors.materialType ? (
              <Text style={styles.errorText}>{errors.materialType}</Text>
            ) : null}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Section 2: Material Details */}
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            Content Details
          </Text>

          {/* 6. Title */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Title <Text style={styles.asterisk}>*</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: errors.title ? "#EF4444" : colors.inputBorder,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. Chapter 4 Practice Questions"
              placeholderTextColor={colors.textMuted}
              value={title}
              onChangeText={(val) => {
                setTitle(val);
                if (errors.title) setErrors((prev) => ({ ...prev, title: "" }));
              }}
            />
            {errors.title ? (
              <Text style={styles.errorText}>{errors.title}</Text>
            ) : null}
          </View>

          {/* 7. Chapter / Topic */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Chapter / Topic
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. Quadratic Equations"
              placeholderTextColor={colors.textMuted}
              value={chapter}
              onChangeText={setChapter}
            />
          </View>

          {/* 8. Description */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Description <Text style={styles.optionalText}>(Optional)</Text>
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.multilineInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              placeholder="Add extra instructions or context for students..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* 9. Attachment */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Attachment <Text style={styles.asterisk}>*</Text>
            </Text>

            {selectedAttachment ? (
              <View
                style={[
                  styles.attachmentCard,
                  { backgroundColor: colors.primary + "0D", borderColor: colors.primary },
                ]}
              >
                <View style={styles.attachmentInfoLeft}>
                  <View
                    style={[
                      styles.fileIconBg,
                      { backgroundColor: colors.primary + "20" },
                    ]}
                  >
                    <Ionicons
                      name="document-attach"
                      size={22}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.fileMetaCol}>
                    <Text
                      style={[styles.fileName, { color: colors.text }]}
                      numberOfLines={1}
                    >
                      {selectedAttachment.name}
                    </Text>
                    {selectedAttachment.size ? (
                      <Text
                        style={[styles.fileSize, { color: colors.textMuted }]}
                      >
                        {formatFileSize(selectedAttachment.size)}
                      </Text>
                    ) : null}
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedAttachment(null)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={22} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[
                  styles.uploadBox,
                  {
                    backgroundColor: colors.surfaceSubtle,
                    borderColor: errors.attachment ? "#EF4444" : colors.border,
                  },
                ]}
                onPress={handlePickAttachment}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="cloud-upload-outline"
                  size={32}
                  color={colors.primary}
                />
                <Text style={[styles.uploadTitle, { color: colors.text }]}>
                  Upload File Attachment
                </Text>
                <Text
                  style={[styles.uploadSubtext, { color: colors.textMuted }]}
                >
                  Supported: PDF, DOC, DOCX, PPT, PPTX, TXT, ZIP (Max: 10MB)
                </Text>
              </TouchableOpacity>
            )}
            {errors.attachment ? (
              <Text style={styles.errorText}>{errors.attachment}</Text>
            ) : null}
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Section 3: Dates & Publishing Controls */}
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            Publishing Controls
          </Text>

          {/* 10. Publish Date & 11. Expiry Date Row */}
          <View style={styles.twoColRow}>
            {/* Publish Date */}
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.text }]}>
                Publish Date <Text style={styles.asterisk}>*</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.selectButton,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
                onPress={() => setShowPublishDatePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={colors.primary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.selectText, { color: colors.text }]}>
                  {formatDateToYYYYMMDD(publishDate)}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Expiry Date */}
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.text }]}>
                Expiry Date <Text style={styles.optionalText}>(Opt)</Text>
              </Text>
              <TouchableOpacity
                style={[
                  styles.selectButton,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                  },
                ]}
                onPress={() => setShowExpiryDatePicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color={colors.textMuted}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.selectText,
                    { color: expiryDate ? colors.text : colors.textMuted },
                  ]}
                >
                  {expiryDate ? formatDateToYYYYMMDD(expiryDate) : "YYYY-MM-DD"}
                </Text>
                {expiryDate ? (
                  <TouchableOpacity
                    onPress={() => setExpiryDate(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>

          {/* DateTimePicker Modals */}
          {showPublishDatePicker && (
            <DateTimePicker
              value={publishDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => {
                setShowPublishDatePicker(false);
                if (selectedDate) setPublishDate(selectedDate);
              }}
            />
          )}

          {showExpiryDatePicker && (
            <DateTimePicker
              value={expiryDate || new Date()}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, selectedDate) => {
                setShowExpiryDatePicker(false);
                if (selectedDate) setExpiryDate(selectedDate);
              }}
            />
          )}

          {/* 12. Allow Download? */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Allow Download? <Text style={styles.asterisk}>*</Text>
            </Text>
            <View style={styles.radioToggleRow}>
              <TouchableOpacity
                style={[
                  styles.radioBtn,
                  {
                    backgroundColor:
                      allowDownload === "1" ? colors.primary + "15" : colors.surfaceSubtle,
                    borderColor: allowDownload === "1" ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setAllowDownload("1")}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.radioOuter,
                    { borderColor: allowDownload === "1" ? colors.primary : colors.textMuted },
                  ]}
                >
                  {allowDownload === "1" ? (
                    <View
                      style={[
                        styles.radioInner,
                        { backgroundColor: colors.primary },
                      ]}
                    />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.radioText,
                    { color: allowDownload === "1" ? colors.primary : colors.text },
                  ]}
                >
                  Yes (Allowed)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.radioBtn,
                  {
                    backgroundColor:
                      allowDownload === "0" ? colors.primary + "15" : colors.surfaceSubtle,
                    borderColor: allowDownload === "0" ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setAllowDownload("0")}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.radioOuter,
                    { borderColor: allowDownload === "0" ? colors.primary : colors.textMuted },
                  ]}
                >
                  {allowDownload === "0" ? (
                    <View
                      style={[
                        styles.radioInner,
                        { backgroundColor: colors.primary },
                      ]}
                    />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.radioText,
                    { color: allowDownload === "0" ? colors.primary : colors.text },
                  ]}
                >
                  No (View Only)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 13. Display Order */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Display Order
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.inputBorder,
                  color: colors.text,
                },
              ]}
              placeholder="1"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              value={displayOrder}
              onChangeText={setDisplayOrder}
            />
          </View>

          {/* 14. Status */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              Status <Text style={styles.asterisk}>*</Text>
            </Text>
            <View style={styles.radioToggleRow}>
              <TouchableOpacity
                style={[
                  styles.radioBtn,
                  {
                    backgroundColor:
                      status === "1" ? "#10B98115" : colors.surfaceSubtle,
                    borderColor: status === "1" ? "#10B981" : colors.border,
                  },
                ]}
                onPress={() => setStatus("1")}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.statusDotSmall,
                    { backgroundColor: status === "1" ? "#10B981" : colors.textMuted },
                  ]}
                />
                <Text
                  style={[
                    styles.radioText,
                    { color: status === "1" ? "#10B981" : colors.text },
                  ]}
                >
                  Active
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.radioBtn,
                  {
                    backgroundColor:
                      status === "2" ? "#EF444415" : colors.surfaceSubtle,
                    borderColor: status === "2" ? "#EF4444" : colors.border,
                  },
                ]}
                onPress={() => setStatus("2")}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.statusDotSmall,
                    { backgroundColor: status === "2" ? "#EF4444" : colors.textMuted },
                  ]}
                />
                <Text
                  style={[
                    styles.radioText,
                    { color: status === "2" ? "#EF4444" : colors.text },
                  ]}
                >
                  Inactive
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Form Submit Button */}
          <TouchableOpacity
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primary },
            ]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload" size={20} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>Save & Upload Study Material</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Selection BottomSheets */}

      {/* 1. Academic Year */}
      <SelectionBottomSheet
        ref={academicYearSheetRef}
        title="Select Academic Year"
        data={academicYears}
        selectedId={selectedAcademicYear}
        onSelect={(item) => {
          setSelectedAcademicYear(String(item.id));
          setErrors((prev) => ({ ...prev, academicYear: "" }));
        }}
        labelExtractor={(item) => item.academic_year}
        isLoading={isLoadingYears}
      />

      {/* 2. Class */}
      <SelectionBottomSheet
        ref={classSheetRef}
        title="Select Class"
        data={classes}
        selectedId={selectedClass}
        onSelect={handleClassSelect}
        labelExtractor={(item) => `Class ${item.class_name}`}
        isLoading={isLoadingClasses}
        showSearch
      />

      {/* 3. Section */}
      <SelectionBottomSheet
        ref={sectionSheetRef}
        title="Select Section"
        data={sections}
        selectedId={selectedSection}
        onSelect={(item) => {
          setSelectedSection(String(item.id));
          setErrors((prev) => ({ ...prev, section: "" }));
        }}
        labelExtractor={(item) => `Section ${item.section_name}`}
        isLoading={isLoadingSections}
        showSearch
      />

      {/* 4. Subject */}
      <SelectionBottomSheet
        ref={subjectSheetRef}
        title="Select Subject"
        data={subjects}
        selectedId={selectedSubject}
        onSelect={(item) => {
          setSelectedSubject(String(item.id));
          setErrors((prev) => ({ ...prev, subject: "" }));
        }}
        labelExtractor={(item) => item.subject_name}
        isLoading={isLoadingSubjects}
        showSearch
      />

      {/* 5. Material Type */}
      <SelectionBottomSheet
        ref={materialTypeSheetRef}
        title="Select Material Type"
        data={materialTypes}
        selectedId={selectedMaterialType}
        onSelect={(item) => {
          setSelectedMaterialType(String(item.id));
          setErrors((prev) => ({ ...prev, materialType: "" }));
        }}
        labelExtractor={(item) => item.material_type_name}
        isLoading={isLoadingTypes}
        showSearch
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fieldGroup: {
    gap: 6,
  },
  twoColRow: {
    flexDirection: "row",
    gap: 12,
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
  selectButton: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectText: {
    fontSize: 14,
    flex: 1,
    marginRight: 6,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  uploadBox: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
  },
  uploadSubtext: {
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  attachmentCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  attachmentInfoLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  fileIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  fileMetaCol: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: "600",
  },
  fileSize: {
    fontSize: 12,
    marginTop: 2,
  },
  radioToggleRow: {
    flexDirection: "row",
    gap: 12,
  },
  radioBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  radioText: {
    fontSize: 13,
    fontWeight: "600",
  },
  statusDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  submitBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  headerCancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
