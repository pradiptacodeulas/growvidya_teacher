import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  BackHandler,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import InternalHeader from '@/components/InternalHeader';
import { apiClient } from '@/services/apiClient';
import { useAppTheme } from '@/constants/theme';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return 'N/A';
  try {
    const datePart = dateStr.split('T')[0].split(' ')[0];
    const [year, month, day] = datePart.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthIndex = parseInt(month, 10) - 1;
    if (months[monthIndex]) {
      return `${parseInt(day, 10)} ${months[monthIndex]} ${year}`;
    }
    return datePart;
  } catch (e) {
    return String(dateStr);
  }
};

const formatDateToYMD = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function StudentActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const students = useAppSelector((state) => state.students.students);
  const studentFromState = students.find((s) => String(s.id) === String(id));

  const [studentDetails, setStudentDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Activity Modal State
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [activityDate, setActivityDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activityDesc, setActivityDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Deleting State
  const [deletingId, setDeletingId] = useState<number | string | null>(null);

  const handleBack = () => {
    router.navigate({
      pathname: '/(main)/(drawer)/student/[id]',
      params: { id },
    });
  };

  useEffect(() => {
    const handleHardwareBack = () => {
      handleBack();
      return true;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleHardwareBack);
    return () => {
      subscription.remove();
    };
  }, [router, id]);

  const loadActivities = useCallback(
    async (isRefresh = false) => {
      if (!isRefresh) setLoading(true);
      try {
        const res = await apiClient.get(`/admin/students/${id}`);
        const st = res.data?.data?.student || res.data?.student || res.data?.data || res.data;
        if (st) {
          setStudentDetails(st);
        }
      } catch (e) {
        console.warn('loadActivities error:', e);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useEffect(() => {
    if (id) loadActivities();
  }, [id, loadActivities]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadActivities(true);
  }, [loadActivities]);

  const student = studentDetails || studentFromState;
  const activities: any[] = student?.activities || [];

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setActivityDate(selectedDate);
    }
  };

  const handleAddActivity = async () => {
    if (!activityDesc.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Description Required',
        text2: 'Please enter a description for the activity.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        activities: [
          {
            date: formatDateToYMD(activityDate),
            activity_description: activityDesc.trim(),
          },
        ],
      };

      const res = await apiClient.post(`/admin/students/${id}/activity`, payload);
      if (res.data?.success || res.status === 200 || res.status === 201) {
        Toast.show({
          type: 'success',
          text1: 'Activity Added',
          text2: 'Student activity has been logged successfully.',
        });
        setIsModalVisible(false);
        setActivityDesc('');
        setActivityDate(new Date());
        loadActivities(true);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Submission Failed',
          text2: res.data?.message || 'Could not record activity.',
        });
      }
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: err.response?.data?.message || err.message || 'An error occurred.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteActivity = (activityId: number | string) => {
    Alert.alert(
      'Delete Activity',
      'Are you sure you want to remove this activity log?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(activityId);
            try {
              const res = await apiClient.delete(`/admin/students/activity/${activityId}`);
              if (res.data?.success || res.status === 200) {
                Toast.show({
                  type: 'success',
                  text1: 'Activity Deleted',
                  text2: 'Activity record removed successfully.',
                });
                if (studentDetails) {
                  setStudentDetails({
                    ...studentDetails,
                    activities: (studentDetails.activities || []).filter(
                      (a: any) => String(a.id) !== String(activityId)
                    ),
                  });
                }
              } else {
                Toast.show({
                  type: 'error',
                  text1: 'Delete Failed',
                  text2: res.data?.message || 'Could not delete activity.',
                });
              }
            } catch (err: any) {
              Toast.show({
                type: 'error',
                text1: 'Error',
                text2: err.response?.data?.message || err.message || 'An error occurred.',
              });
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const studentName =
    student?.full_name || `${student?.first_name || ''} ${student?.last_name || ''}`.trim() || 'Student';
  const studentHouse = student?.house_name || student?.house || 'Not Assigned';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Student Activity" onBack={handleBack} />

      {loading && !studentDetails ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          {/* Student & House Info Card */}
          <View style={[styles.summaryCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.summaryTop}>
              <View style={styles.studentInfoLeft}>
                <Text style={[styles.studentName, { color: colors.text }]} numberOfLines={1}>
                  {studentName}
                </Text>
                <Text style={[styles.studentMeta, { color: colors.textMuted }]}>
                  ID: {student?.admission_number || id} • Class {student?.class_name || student?.class || 'N/A'}
                </Text>
              </View>
              <View style={[styles.activityCountBadge, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="trophy" size={14} color={colors.primary} />
                <Text style={[styles.activityCountText, { color: colors.primary }]}>
                  {activities.length} {activities.length === 1 ? 'Activity' : 'Activities'}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.summaryBottom}>
              <View style={styles.houseRow}>
                <View style={[styles.houseIconWrapper, { backgroundColor: isDark ? '#232b3e' : '#eef2ff' }]}>
                  <Ionicons name="flag-outline" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.houseLabel, { color: colors.textMuted }]}>House Group</Text>
                  <Text style={[styles.houseValue, { color: colors.text }]}>{studentHouse}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.addActivityBtn, { backgroundColor: colors.primary }]}
                onPress={() => setIsModalVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addActivityBtnText}>Add Activity</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Activity List Section */}
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Activity History</Text>
            {activities.length > 0 && (
              <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
                {activities.length} Recorded
              </Text>
            )}
          </View>

          {activities.length === 0 ? (
            <View style={[styles.emptyStateCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={[styles.iconCircle, { backgroundColor: isDark ? '#1a2234' : '#f0f4ff' }]}>
                <Ionicons name="trophy-outline" size={44} color={colors.primary} />
              </View>
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>No Activities Recorded</Text>
              <Text style={[styles.emptyStateSubtitle, { color: colors.textMuted }]}>
                No extracurricular achievements, sports, or behavioral activities have been logged for this student yet.
              </Text>
              <TouchableOpacity
                style={[styles.emptyActionBtn, { backgroundColor: colors.primary }]}
                onPress={() => setIsModalVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.emptyActionBtnText}>Log New Activity</Text>
              </TouchableOpacity>
            </View>
          ) : (
            activities.map((act: any, idx: number) => {
              const description =
                act.activity_description ||
                act.description ||
                act.title ||
                act.activity_name ||
                act.name ||
                'Activity';
              const dateDisplay = formatDate(act.date || act.created_at);
              const isDeleting = deletingId === act.id;

              return (
                <View
                  key={act.id || idx}
                  style={[styles.activityCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.trophyIconBox, { backgroundColor: isDark ? '#242a38' : '#fff8e6' }]}>
                        <Ionicons name="ribbon-outline" size={20} color="#f59e0b" />
                      </View>
                      <View style={styles.dateContainer}>
                        <View style={styles.dateRow}>
                          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
                          <Text style={[styles.dateText, { color: colors.textMuted }]}>{dateDisplay}</Text>
                        </View>
                        <Text style={[styles.activityTitle, { color: colors.text }]}>Student Activity</Text>
                      </View>
                    </View>

                    {act.id && (
                      <TouchableOpacity
                        style={[styles.deleteBtn, { backgroundColor: isDark ? '#3b1c1c' : '#fee2e2' }]}
                        onPress={() => handleDeleteActivity(act.id)}
                        disabled={isDeleting}
                        activeOpacity={0.7}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <Ionicons name="trash-outline" size={16} color="#ef4444" />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={[styles.cardContent, { backgroundColor: isDark ? '#141824' : '#f8fafc', borderColor: colors.border }]}>
                    <Text style={[styles.descText, { color: colors.text }]}>{description}</Text>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add Activity Modal */}
      <Modal
        visible={isModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalBackdrop}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View style={styles.modalHeaderLeft}>
                <View style={[styles.modalHeaderIcon, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="trophy" size={20} color={colors.primary} />
                </View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add Student Activity</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsModalVisible(false)}
                disabled={isSubmitting}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Modal Form */}
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* Date Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Activity Date *</Text>
                <TouchableOpacity
                  style={[styles.datePickerBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  <Text style={[styles.datePickerText, { color: colors.text }]}>
                    {formatDate(formatDateToYMD(activityDate))}
                  </Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={activityDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                />
              )}

              {/* Description Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>Activity Description *</Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: colors.surfaceSubtle,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="e.g., 1st position in Annual Science Quiz Competition"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  value={activityDesc}
                  onChangeText={setActivityDesc}
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.cancelBtn, { borderColor: colors.border }]}
                onPress={() => setIsModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddActivity}
                disabled={isSubmitting}
                activeOpacity={0.85}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>Save Activity</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  studentInfoLeft: {
    flex: 1,
    marginRight: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  studentMeta: {
    fontSize: 13,
  },
  activityCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  activityCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  summaryBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  houseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  houseIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  houseLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  houseValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  addActivityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addActivityBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  activityCard: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  trophyIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateContainer: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  dateText: {
    fontSize: 11,
    fontWeight: '500',
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  cardContent: {
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  descText: {
    fontSize: 13,
    lineHeight: 20,
  },
  emptyStateCard: {
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
    maxWidth: 280,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyActionBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxHeight: 360,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  datePickerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 90,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

