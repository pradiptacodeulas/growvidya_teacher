import InternalHeader from "@/components/InternalHeader";
import SelectionBottomSheet from "@/components/common/SelectionBottomSheet";
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
import DateTimePicker from "@react-native-community/datetimepicker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

export interface AnswerOption {
  text: string;
}

export interface QuestionData {
  title: string;
  correct_answer: number;
  answers: AnswerOption[];
}

const getTodayDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getFutureDateString = (daysToAdd = 7) => {
  const future = new Date();
  future.setDate(future.getDate() + daysToAdd);
  const year = future.getFullYear();
  const month = String(future.getMonth() + 1).padStart(2, "0");
  const day = String(future.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getOptionLabel = (index: number) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < 26) {
    return alphabet[index];
  }
  const first = alphabet[Math.floor(index / 26) - 1];
  const second = alphabet[index % 26];
  return `${first}${second}`;
};

export interface AssignmentTypeItem {
  id: string;
  school_id: string;
  type_name: string;
  status: string;
  created_on: string;
}

export default function AddAssignmentScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();

  const params = useLocalSearchParams<{
    classId?: string;
    sectionId?: string;
    subjectId?: string;
    subjectName?: string;
    className?: string;
    sectionName?: string;
    shiftName?: string;
    assignmentId?: string;
    assignmentData?: string;
  }>();

  // Form Fields
  const classId = params.classId || "1";
  const sectionId = params.sectionId || "1";
  const subjectId = params.subjectId || "1";
  const className = params.className || "I";
  const sectionName = params.sectionName || "A";
  const subjectName = params.subjectName || "Subject";

  const handleBack = useCallback(() => {
    router.replace({
      pathname: "/(main)/(drawer)/academic/assignment-details",
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
  }, [router, classId, sectionId, subjectId, className, sectionName, subjectName, params.shiftName]);

  // Intercept Hardware & Gesture Back Actions
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

  const [title, setTitle] = useState("");
  const [assignmentTypeId, setAssignmentTypeId] = useState("1"); // Default 1: Homework
  const [assignmentTypes, setAssignmentTypes] = useState<AssignmentTypeItem[]>([
    { id: "1", school_id: "1", type_name: "Homework", status: "1", created_on: "" },
    { id: "2", school_id: "1", type_name: "Classwork", status: "1", created_on: "" },
  ]);
  const [loadingTypes, setLoadingTypes] = useState<boolean>(true);

  const [assignedDate, setAssignedDate] = useState(getTodayDateString());
  const [dueDate, setDueDate] = useState(getFutureDateString(7));

  // Fetch Assignment Types dynamically from API
  useEffect(() => {
    let isMounted = true;
    const fetchAssignmentTypes = async () => {
      try {
        const response = await apiClient.get<any>('/teacher/academics/assignment-types');
        const resData = response?.data;
        const list = Array.isArray(resData?.data?.assignment_types)
          ? resData.data.assignment_types
          : Array.isArray(resData?.data)
          ? resData.data
          : Array.isArray(resData)
          ? resData
          : resData?.assignment_types || resData?.types || [];

        if (isMounted && Array.isArray(list) && list.length > 0) {
          setAssignmentTypes(list);
          setAssignmentTypeId(String(list[0].id));
        }
      } catch (err: any) {
        console.warn("fetchAssignmentTypes exception:", err.message);
      } finally {
        if (isMounted) {
          setLoadingTypes(false);
        }
      }
    };

    fetchAssignmentTypes();
    return () => {
      isMounted = false;
    };
  }, []);

  // Load existing assignment data when in edit mode
  useEffect(() => {
    const loadAssignmentData = async () => {
      let currentItem: any = null;
      if (params.assignmentData) {
        try {
          currentItem = JSON.parse(params.assignmentData);
        } catch (e) {
          console.warn("Error parsing assignmentData:", e);
        }
      }

      if (!currentItem && params.assignmentId) {
        try {
          const response = await apiClient.get<any>(`/teacher/academics/assignments/${params.assignmentId}`);
          currentItem = response.data?.data || response.data;
        } catch (err: any) {
          console.warn("fetchAssignmentDetails exception:", err.message);
        }
      }

      if (currentItem) {
        if (currentItem.title) setTitle(currentItem.title);
        if (currentItem.assignment_type_id) {
          setAssignmentTypeId(String(currentItem.assignment_type_id));
        }
        if (currentItem.assigned_date) setAssignedDate(currentItem.assigned_date);
        if (currentItem.due_date) setDueDate(currentItem.due_date);
      }

      // If assignmentId exists, fetch actual questions from the dedicated endpoint
      if (params.assignmentId) {
        try {
          const qResponse = await apiClient.get<any>(`/teacher/academics/assignments/${params.assignmentId}/questions`);
          const qList = Array.isArray(qResponse.data?.data)
            ? qResponse.data.data
            : Array.isArray(qResponse.data)
              ? qResponse.data
              : [];

          if (qList.length > 0) {
            const loadedQs: QuestionData[] = qList.map((q: any) => {
              const rawAnswers = q.answers || [];
              const answersList = rawAnswers.map((a: any) => ({
                text: a.answer || a.text || "",
              }));
              while (answersList.length < 4) {
                answersList.push({ text: "" });
              }

              let correctIdx = 0;
              if (q.correct_answer !== undefined && q.correct_answer !== null) {
                const parsedIdx = parseInt(String(q.correct_answer), 10);
                if (!isNaN(parsedIdx)) correctIdx = parsedIdx;
              } else {
                const foundIdx = rawAnswers.findIndex(
                  (a: any) => String(a.is_correct) === "1" || a.is_correct === 1,
                );
                if (foundIdx >= 0) correctIdx = foundIdx;
              }

              return {
                title: q.question || q.title || "",
                correct_answer: correctIdx,
                answers: answersList,
              };
            });
            setQuestions(loadedQs);
          }
        } catch (err: any) {
          console.warn("fetchAssignmentQuestions exception:", err.message);
        }
      }
    };

    if (params.assignmentData || params.assignmentId) {
      loadAssignmentData();
    } else {
      // Reset form fields for Add New mode
      setTitle("");
      setAssignedDate(getTodayDateString());
      setDueDate(getFutureDateString(7));
      setQuestions([
        {
          title: "",
          correct_answer: 0,
          answers: [
            { text: "" },
            { text: "" },
            { text: "" },
            { text: "" },
          ],
        },
      ]);
    }
  }, [params.assignmentData, params.assignmentId, token, classId, sectionId, subjectId]);

  // Date picker states
  const [showAssignedDatePicker, setShowAssignedDatePicker] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);

  // Questions List State
  const [questions, setQuestions] = useState<QuestionData[]>([
    {
      title: "",
      correct_answer: 0,
      answers: [
        { text: "" },
        { text: "" },
        { text: "" },
        { text: "" },
      ],
    },
  ]);

  // BottomSheet Modal State for Assignment Type & Question Editing
  const typeBottomSheetRef = useRef<BottomSheetModal>(null);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ["85%", "95%"], []);

  const selectedTypeItem = useMemo(() => {
    return assignmentTypes.find(
      (t) => String(t.id) === String(assignmentTypeId),
    );
  }, [assignmentTypes, assignmentTypeId]);

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [sheetQTitle, setSheetQTitle] = useState("");
  const [sheetCorrectAns, setSheetCorrectAns] = useState<number>(0);
  const [sheetAnswers, setSheetAnswers] = useState<AnswerOption[]>([
    { text: "" },
    { text: "" },
    { text: "" },
    { text: "" },
  ]);

  // Open BottomSheet to Add New Question
  const handleOpenAddQuestion = () => {
    setEditingIndex(null);
    setSheetQTitle("");
    setSheetCorrectAns(0);
    setSheetAnswers([
      { text: "" },
      { text: "" },
      { text: "" },
      { text: "" },
    ]);
    bottomSheetRef.current?.present();
  };

  // Open BottomSheet to Edit Existing Question
  const handleOpenEditQuestion = (index: number) => {
    const q = questions[index];
    if (q) {
      setEditingIndex(index);
      setSheetQTitle(q.title);
      setSheetCorrectAns(q.correct_answer);
      setSheetAnswers(
        q.answers.length > 0
          ? q.answers.map((a) => ({ ...a }))
          : [{ text: "" }, { text: "" }],
      );
      bottomSheetRef.current?.present();
    }
  };

  // Remove Question from list
  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 1) {
      Alert.alert("Notice", "Assignment must contain at least one question.");
      return;
    }
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  // Save Question from BottomSheet
  const handleSaveQuestionFromSheet = () => {
    if (!sheetQTitle.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please enter the question statement.",
      });
      return;
    }

    const validAnswers = sheetAnswers.filter((a) => a.text.trim().length > 0);
    if (validAnswers.length < 2) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please fill in at least 2 options for the question.",
      });
      return;
    }

    const newQuestion: QuestionData = {
      title: sheetQTitle.trim(),
      correct_answer: sheetCorrectAns < sheetAnswers.length ? sheetCorrectAns : 0,
      answers: sheetAnswers.map((a) => ({ text: a.text.trim() })),
    };

    if (editingIndex === null) {
      // Adding new question
      setQuestions((prev) => [...prev, newQuestion]);
    } else {
      // Updating existing question
      setQuestions((prev) => {
        const updated = [...prev];
        updated[editingIndex] = newQuestion;
        return updated;
      });
    }

    bottomSheetRef.current?.dismiss();
  };

  // BottomSheet option helpers
  const handleAddSheetOption = () => {
    setSheetAnswers((prev) => [...prev, { text: "" }]);
  };

  const handleRemoveSheetOption = (optIndex: number) => {
    if (sheetAnswers.length <= 2) {
      Toast.show({
        type: "error",
        text1: "Notice",
        text2: "Minimum 2 options required.",
      });
      return;
    }
    setSheetAnswers((prev) => prev.filter((_, i) => i !== optIndex));
    if (sheetCorrectAns === optIndex) {
      setSheetCorrectAns(0);
    } else if (sheetCorrectAns > optIndex) {
      setSheetCorrectAns((prev) => prev - 1);
    }
  };

  const handleSheetOptionTextChange = (optIndex: number, text: string) => {
    setSheetAnswers((prev) => {
      const updated = [...prev];
      updated[optIndex] = { text };
      return updated;
    });
  };

  // Submit Form (Draft or Publish)
  const handleSubmitForm = async (publishNow: "0" | "1") => {
    if (!title.trim()) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please enter assignment title.",
      });
      return;
    }

    if (questions.length === 0) {
      Toast.show({
        type: "error",
        text1: "Validation Error",
        text2: "Please add at least one question.",
      });
      return;
    }

    setSubmitting(true);

    const bodyPayload: any = {
      subject_id: subjectId,
      class_id: classId,
      section_id: sectionId,
      title: title.trim(),
      assignment_type_id: assignmentTypeId,
      assigned_date: assignedDate,
      due_date: dueDate,
      is_published: publishNow === "1" ? 1 : 0,
      questions: questions.map((q) => ({
        title: q.title,
        question: q.title,
        correct_answer: Number(q.correct_answer),
        answers: q.answers.map((a, idx) => ({
          answer: a.text,
          text: a.text,
          is_correct: idx === Number(q.correct_answer) ? 1 : 0,
        })),
      })),
    };

    try {
      let response: any;
      if (params.assignmentId) {
        response = await apiClient.put(`/teacher/academics/assignments/${params.assignmentId}`, bodyPayload);
      } else {
        response = await apiClient.post('/teacher/academics/assignments', bodyPayload);
      }

      const resData = response?.data || response;
      const isOk =
        response?.status === 200 ||
        response?.status === 201 ||
        resData?.status === true ||
        resData?.success === true;

      if (isOk) {
        Toast.show({
          type: "success",
          text1: params.assignmentId
            ? "Assignment Updated!"
            : publishNow === "1"
              ? "Published!"
              : "Draft Saved!",
          text2: resData?.message || "Assignment saved successfully.",
        });
        router.replace({
          pathname: "/(main)/(drawer)/academic/assignment-details",
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
      } else {
        Alert.alert(
          "Error",
          resData?.message || "Failed to save assignment data.",
        );
      }
    } catch (err: any) {
      console.warn("handleSubmitForm exception:", err.message);
      Alert.alert(
        "Submission Error",
        err.message || "An unexpected network error occurred.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader
        title={params.assignmentId ? "Edit Assignment" : "Add New Assignment"}
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom + 20, 30) },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Summary Badges Header Card */}
        <View
          style={[
            styles.summaryCard,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="school-outline" size={13} color={colors.primary} />
              <Text style={[styles.badgeText, { color: colors.primary }]}>
                Class: {className}
              </Text>
            </View>

            <View style={[styles.badge, { backgroundColor: isDark ? "#1E293B" : "#E0F2FE" }]}>
              <Ionicons name="layers-outline" size={13} color="#0284C7" />
              <Text style={[styles.badgeText, { color: "#0284C7" }]}>
                Section: {sectionName}
              </Text>
            </View>

            <View style={[styles.badge, { backgroundColor: isDark ? "#064E3B" : "#ECFDF5" }]}>
              <Ionicons name="book-outline" size={13} color="#10B981" />
              <Text style={[styles.badgeText, { color: "#10B981" }]}>
                Subject: {subjectName}
              </Text>
            </View>
          </View>
        </View>

        {/* Card 1: Assignment Overview */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.cardHeader,
              { backgroundColor: colors.primary },
            ]}
          >
            <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
            <Text style={styles.cardHeaderTitle}>Assignment Overview</Text>
          </View>

          <View style={styles.cardBody}>
            {/* Title */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Assignment Title <Text style={styles.required}>*</Text>
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
                placeholder="e.g. Chapter 3 Quadratic Equations Practice"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Dynamic Assignment Type Dropdown */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Assignment Type <Text style={styles.required}>*</Text>
              </Text>

              {loadingTypes ? (
                <View style={styles.typesLoadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text
                    style={[
                      styles.typesLoadingText,
                      { color: colors.textMuted },
                    ]}
                  >
                    Loading types...
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.dropdownBox,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                  onPress={() => typeBottomSheetRef.current?.present()}
                  activeOpacity={0.8}
                >
                  <View style={styles.dropdownLeft}>
                    <Ionicons
                      name="pricetag-outline"
                      size={18}
                      color={colors.primary}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[styles.dropdownValueText, { color: colors.text }]}
                    >
                      {selectedTypeItem
                        ? selectedTypeItem.type_name
                        : "-- Select Type --"}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-down-outline"
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Dates Row */}
            <View style={styles.dateRow}>
              {/* Assigned Date */}
              <TouchableOpacity
                style={[styles.dateSelector, { marginRight: 6 }]}
                onPress={() => setShowAssignedDatePicker(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.label, { color: colors.text }]}>
                  Assigned Date <Text style={styles.required}>*</Text>
                </Text>
                <View
                  style={[
                    styles.dateValueBox,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={colors.primary}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[styles.dateValueText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {assignedDate}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Due Date */}
              <TouchableOpacity
                style={[styles.dateSelector, { marginLeft: 6 }]}
                onPress={() => setShowDueDatePicker(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.label, { color: colors.text }]}>
                  Due Date <Text style={styles.required}>*</Text>
                </Text>
                <View
                  style={[
                    styles.dateValueBox,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.inputBorder,
                    },
                  ]}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color="#EF4444"
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[styles.dateValueText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {dueDate}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Card 2: Questions & Options Section */}
        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.cardBg,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.cardHeader,
              {
                backgroundColor: isDark ? "#1E293B" : "#1E293B",
                justifyContent: "space-between",
              },
            ]}
          >
            <View style={styles.headerTitleRow}>
              <Ionicons
                name="checkbox-outline"
                size={18}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.cardHeaderTitle}>Questions & Options</Text>
            </View>

            <TouchableOpacity
              style={styles.addQBtn}
              onPress={handleOpenAddQuestion}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={16} color="#FFFFFF" />
              <Text style={styles.addQBtnText}>Add Question</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cardBody}>
            {questions.length === 0 ? (
              <View style={styles.emptyQuestionsBox}>
                <Ionicons
                  name="help-circle-outline"
                  size={36}
                  color={colors.textMuted}
                />
                <Text
                  style={[
                    styles.emptyQuestionsTitle,
                    { color: colors.textMuted },
                  ]}
                >
                  No questions added yet.
                </Text>
                <TouchableOpacity
                  style={[
                    styles.addQBtnLarge,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={handleOpenAddQuestion}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add" size={18} color="#FFFFFF" />
                  <Text style={styles.addQBtnLargeText}>
                    Add First Question
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              questions.map((q, qIndex) => (
                <View
                  key={qIndex}
                  style={[
                    styles.questionBlock,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.questionBlockHeader}>
                    <Text style={[styles.qNumberTitle, { color: colors.primary }]}>
                      Question #{qIndex + 1}
                    </Text>

                    <View style={styles.qHeaderActions}>
                      <TouchableOpacity
                        style={[
                          styles.actionIconBtn,
                          { backgroundColor: colors.primaryLight },
                        ]}
                        onPress={() => handleOpenEditQuestion(qIndex)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color={colors.primary}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.actionIconBtn,
                          { backgroundColor: isDark ? "#451A1A" : "#FEE2E2" },
                        ]}
                        onPress={() => handleRemoveQuestion(qIndex)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={[styles.qStatementText, { color: colors.text }]}>
                    {q.title || "No question statement entered yet."}
                  </Text>

                  {/* Options Summary */}
                  <View style={styles.optionsListSummary}>
                    {q.answers.map((ans, aIndex) => {
                      const isCorrect = q.correct_answer === aIndex;
                      return (
                        <View
                          key={aIndex}
                          style={[
                            styles.optionSummaryRow,
                            {
                              backgroundColor: isCorrect
                                ? isDark
                                  ? "#064E3B"
                                  : "#ECFDF5"
                                : colors.inputBg,
                              borderColor: isCorrect
                                ? "#10B981"
                                : colors.inputBorder,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.optLabelText,
                              {
                                color: isCorrect
                                  ? "#10B981"
                                  : colors.textSecondary,
                              },
                            ]}
                          >
                            Option {getOptionLabel(aIndex)}:
                          </Text>
                          <Text
                            style={[
                              styles.optValueText,
                              { color: colors.text },
                            ]}
                            numberOfLines={1}
                          >
                            {ans.text || "—"}
                          </Text>
                          {isCorrect && (
                            <View style={styles.correctBadge}>
                              <Ionicons
                                name="checkmark-circle"
                                size={14}
                                color="#10B981"
                              />
                              <Text style={styles.correctBadgeText}>
                                Correct
                              </Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Footer Submit Buttons */}
        <View style={styles.footerButtonsRow}>
          <TouchableOpacity
            style={[
              styles.footerBtn,
              styles.cancelBtn,
              {
                backgroundColor: colors.surfaceSubtle,
                borderColor: colors.border,
              },
            ]}
            onPress={handleBack}
            disabled={submitting}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelBtnText, { color: colors.text }]}>
              Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.footerBtn,
              styles.draftBtn,
              {
                backgroundColor: isDark ? "#334155" : "#FEF08A",
                borderColor: "#F59E0B",
              },
            ]}
            onPress={() => handleSubmitForm("0")}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#D97706" />
            ) : (
              <>
                <Ionicons
                  name="bookmark-outline"
                  size={16}
                  color={isDark ? "#FBBF24" : "#B45309"}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.draftBtnText,
                    { color: isDark ? "#FBBF24" : "#B45309" },
                  ]}
                >
                  Draft
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.footerBtn,
              styles.publishBtn,
              { backgroundColor: colors.primary },
              submitting && styles.disabledBtn,
            ]}
            onPress={() => handleSubmitForm("1")}
            disabled={submitting}
            activeOpacity={0.85}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="paper-plane-outline"
                  size={16}
                  color="#FFFFFF"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.publishBtnText}>Publish</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Date Pickers */}
      {showAssignedDatePicker && (
        <DateTimePicker
          value={assignedDate ? new Date(assignedDate) : new Date()}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(event: any, date?: Date) => {
            setShowAssignedDatePicker(false);
            if (date) {
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, "0");
              const d = String(date.getDate()).padStart(2, "0");
              setAssignedDate(`${y}-${m}-${d}`);
            }
          }}
        />
      )}

      {showDueDatePicker && (
        <DateTimePicker
          value={dueDate ? new Date(dueDate) : new Date()}
          mode="date"
          minimumDate={assignedDate ? new Date(assignedDate) : undefined}
          display="default"
          onChange={(event: any, date?: Date) => {
            setShowDueDatePicker(false);
            if (date) {
              const y = date.getFullYear();
              const m = String(date.getMonth() + 1).padStart(2, "0");
              const d = String(date.getDate()).padStart(2, "0");
              setDueDate(`${y}-${m}-${d}`);
            }
          }}
        />
      )}

      {/* Question Form Bottom Sheet Modal */}
      <BottomSheetModal
        ref={bottomSheetRef}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: colors.surface }}
        handleIndicatorStyle={[
          styles.handleIndicator,
          { backgroundColor: colors.border },
        ]}
        enablePanDownToClose
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
      >
        <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {editingIndex === null
                ? "Add New Question"
                : `Edit Question #${editingIndex + 1}`}
            </Text>
            <TouchableOpacity
              onPress={() => bottomSheetRef.current?.dismiss()}
            >
              <Ionicons
                name="close-circle-outline"
                size={24}
                color={colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <BottomSheetScrollView
            contentContainerStyle={[
              styles.sheetScrollContent,
              { paddingBottom: Math.max(insets.bottom + 20, 30) },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Question Statement */}
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                Question Statement <Text style={styles.required}>*</Text>
              </Text>
              <BottomSheetTextInput
                style={[
                  styles.sheetInput,
                  styles.sheetTextArea,
                  {
                    backgroundColor: colors.inputBg,
                    borderColor: colors.inputBorder,
                    color: colors.text,
                  },
                ]}
                placeholder="Enter question statement here..."
                value={sheetQTitle}
                onChangeText={setSheetQTitle}
                
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            {/* Options Section */}
            <View style={styles.sheetOptionsHeader}>
              <Text style={[styles.label, { color: colors.text, marginBottom: 2 }]}>
                Options <Text style={styles.required}>*</Text>
              </Text>
              <Text style={[styles.optionsSublabel, { color: colors.textMuted }]}>
                Select the radio button next to the correct answer
              </Text>
            </View>

            {/* Options List */}
            <View style={styles.sheetOptionsList}>
              {sheetAnswers.map((opt, optIndex) => {
                const isCorrect = sheetCorrectAns === optIndex;

                return (
                  <View
                    key={optIndex}
                    style={[
                      styles.sheetOptionItem,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: isCorrect
                          ? "#10B981"
                          : colors.inputBorder,
                        borderWidth: isCorrect ? 1.5 : 1,
                      },
                    ]}
                  >
                    <View style={styles.sheetOptionHeaderRow}>
                      <Text
                        style={[
                          styles.sheetOptLabelText,
                          { color: colors.primary },
                        ]}
                      >
                        Option {getOptionLabel(optIndex)}
                      </Text>

                      {/* Radio Selection for Correct Answer */}
                      <TouchableOpacity
                        style={styles.radioContainer}
                        onPress={() => setSheetCorrectAns(optIndex)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={
                            isCorrect ? "radio-button-on" : "radio-button-off"
                          }
                          size={18}
                          color={isCorrect ? "#10B981" : colors.textMuted}
                        />
                        <Text
                          style={[
                            styles.radioText,
                            {
                              color: isCorrect ? "#10B981" : colors.textMuted,
                            },
                          ]}
                        >
                          {isCorrect ? "Correct Answer" : "Mark Correct"}
                        </Text>
                      </TouchableOpacity>

                      {/* Remove Option Button */}
                      <TouchableOpacity
                        onPress={() => handleRemoveSheetOption(optIndex)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>

                    <BottomSheetTextInput
                      style={[
                        styles.sheetInput,
                        {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder={`Enter Option ${getOptionLabel(optIndex)} text...`}
                      value={opt.text}
                      onChangeText={(text) =>
                        handleSheetOptionTextChange(optIndex, text)
                      }
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                );
              })}
            </View>

            {/* Add Option Button positioned cleanly below options list */}
            <TouchableOpacity
              style={[
                styles.addOptionBtnBottom,
                {
                  backgroundColor: isDark
                    ? colors.surfaceSubtle
                    : colors.primaryLight,
                  borderColor: colors.primary,
                },
              ]}
              onPress={handleAddSheetOption}
              activeOpacity={0.8}
            >
              <Ionicons
                name="add-circle-outline"
                size={18}
                color={colors.primary}
              />
              <Text
                style={[styles.addOptionBtnBottomText, { color: colors.primary }]}
              >
                + Add New Option ({sheetAnswers.length})
              </Text>
            </TouchableOpacity>

            {/* Save Question Button */}
            <TouchableOpacity
              style={[
                styles.saveQuestionBtn,
                { backgroundColor: colors.primary },
              ]}
              onPress={handleSaveQuestionFromSheet}
              activeOpacity={0.85}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={20}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.saveQuestionBtnText}>
                {editingIndex === null ? "Add Question" : "Update Question"}
              </Text>
            </TouchableOpacity>
          </BottomSheetScrollView>
        </View>
      </BottomSheetModal>

      {/* Assignment Type Dropdown BottomSheet */}
      <SelectionBottomSheet
        ref={typeBottomSheetRef}
        title="Select Assignment Type"
        data={assignmentTypes}
        selectedId={assignmentTypeId}
        onSelect={(item: AssignmentTypeItem) =>
          setAssignmentTypeId(String(item.id))
        }
        labelExtractor={(item: AssignmentTypeItem) => item.type_name}
        isLoading={loadingTypes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardHeaderTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  addQBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 4,
  },
  addQBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  cardBody: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  required: {
    color: "#EF4444",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
  },
  typesLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 8,
  },
  typesLoadingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  dropdownBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
  },
  dropdownLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  dropdownValueText: {
    fontSize: 14,
    fontWeight: "600",
  },
  dateRow: {
    flexDirection: "row",
  },
  dateSelector: {
    flex: 1,
  },
  dateValueBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  dateValueText: {
    fontSize: 13,
    fontWeight: "600",
  },
  emptyQuestionsBox: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyQuestionsTitle: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 8,
    marginBottom: 12,
  },
  addQBtnLarge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  addQBtnLargeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  questionBlock: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  questionBlockHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  qNumberTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  qHeaderActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  qStatementText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    lineHeight: 20,
  },
  optionsListSummary: {
    gap: 6,
  },
  optionSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  optLabelText: {
    fontSize: 12,
    fontWeight: "700",
    marginRight: 6,
  },
  optValueText: {
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
  footerButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  footerBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  draftBtn: {
    borderWidth: 1,
  },
  draftBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  publishBtn: {},
  publishBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  disabledBtn: {
    opacity: 0.6,
  },
  handleIndicator: {
    width: 50,
  },
  sheetContainer: {
    flex: 1,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  sheetScrollContent: {
    padding: 18,
  },
  sheetInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
  },
  sheetTextArea: {
    height: 80,
    paddingTop: 10,
  },
  sheetOptionsHeader: {
    marginBottom: 12,
    marginTop: 4,
  },
  optionsSublabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  sheetOptionsList: {
    gap: 12,
    marginBottom: 14,
  },
  sheetOptionItem: {
    borderRadius: 12,
    padding: 12,
  },
  sheetOptionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sheetOptLabelText: {
    fontSize: 13,
    fontWeight: "700",
  },
  radioContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  radioText: {
    fontSize: 12,
    fontWeight: "600",
  },
  addOptionBtnBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 20,
    gap: 6,
  },
  addOptionBtnBottomText: {
    fontSize: 14,
    fontWeight: "700",
  },
  saveQuestionBtn: {
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveQuestionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
