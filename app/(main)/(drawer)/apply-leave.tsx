import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Image, Alert } from 'react-native';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { useRouter, useFocusEffect } from 'expo-router';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import InternalHeader from '@/components/InternalHeader';
import SelectionBottomSheet from '@/components/common/SelectionBottomSheet';
import { useAppTheme } from '@/constants/theme';
import { apiClient } from '@/services/apiClient';

interface LeaveType {
  id: string | number;
  leave_name: string;
  no_leave: number;
  need_document: string | number;
  [key: string]: any;
}

const formatDateToYYYYMMDD = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${year}-${month}-${day}`;
};
//The date will be send in the format in YYYY-MM-DD
export default function ApplyLeaveScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  
  // Leave types states
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  
  // Form states
  const [selectedLeaveType, setSelectedLeaveType] = useState<LeaveType | null>(null);
  const [durationMode, setDurationMode] = useState<'1' | '2' | '3'>('1'); // 1=Full Day, 2=Half Day, 3=Multiple
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [reason, setReason] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const leaveTypeBottomSheetRef = useRef<BottomSheetModal>(null);

  // Fetch leave types from API
  const fetchLeaveTypes = async () => {
    setIsLoadingTypes(true);
    try {
      const res = await apiClient.get('/teacher/leaves/types');
      const types = res.data?.data?.types || res.data?.types || (Array.isArray(res.data?.data) ? res.data.data : []);
      if (Array.isArray(types)) {
        setLeaveTypes(types);
      }
    } catch (e: any) {
      console.warn('Error fetching leave types:', e?.message);
    } finally {
      setIsLoadingTypes(false);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchLeaveTypes();
    }, [])
  );



  // Helper to calculate days between start and end date (inclusive)
  const calculateDays = (start: Date, end: Date) => {
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;  
    return diffDays.toString();
  };

  // Document selection (PDF, PNG, JPEG)
  const handleSelectDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        if (asset.size && asset.size > 5 * 1024 * 1024) {
          Alert.alert('File Too Large', 'Please select a file smaller than 5MB.');
          return;
        }
        setSelectedDocument({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/octet-stream',
          fileSize: asset.size,
        });
      }
    } catch (err) {
      console.warn('Error picking document:', err);
      Alert.alert('Error', 'Failed to pick document.');
    }
  };

  // Submit leave request
  const handleSubmitLeave = async () => {
    if (!selectedLeaveType) {
      Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Please select a leave type' });
      return;
    }

    // Determine duration to submit (as integer enum: 1=Full Day, 2=Half Day, 3=Multiple)
    const durationToSend = parseInt(durationMode, 10);

    const dates: string[] = [];
    if (durationMode === '3') {
      const cur = new Date(startDate);
      const end = new Date(endDate);
      while (cur <= end) {
        dates.push(formatDateToYYYYMMDD(cur));
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      dates.push(formatDateToYYYYMMDD(startDate));
    }

    // Quota validation
    if (selectedLeaveType.remaining_leaves !== undefined) {
      const requestedDays = durationMode === '2' ? 0.5 : dates.length;
      if (Number(selectedLeaveType.remaining_leaves) <= 0) {
        Alert.alert(
          'Quota Exceeded',
          `You have already exhausted all allowed leaves for "${selectedLeaveType.leave_name}" (Quota: ${selectedLeaveType.no_leave} days).`
        );
        return;
      }
      if (requestedDays > Number(selectedLeaveType.remaining_leaves)) {
        Alert.alert(
          'Quota Exceeded',
          `Requested duration (${requestedDays} day(s)) exceeds your remaining quota of ${selectedLeaveType.remaining_leaves} day(s) for "${selectedLeaveType.leave_name}".`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      let documentUrl = '';
      if (selectedDocument) {
        const formData = new FormData();
        const fileUri = selectedDocument.uri;
        const fileName = selectedDocument.name || `document_${Date.now()}.jpg`;
        const fileType = selectedDocument.mimeType || 'image/jpeg';
        formData.append('file', {
          uri: fileUri,
          name: fileName,
          type: fileType,
        } as any);

        const uploadRes = await apiClient.post('/upload/single?folder=leave', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        documentUrl = uploadRes.data?.data?.file_path || uploadRes.data?.data?.url || uploadRes.data?.file_path || '';
      }

      const response = await apiClient.post('/teacher/leaves/apply', {
        leave_id: Number(selectedLeaveType.id),
        duration: durationToSend,
        document: documentUrl,
        leave_reason: reason.trim(),
        dates,
      });

      Toast.show({
        type: 'success',
        text1: 'Success',
        text2: response.data?.message || 'Leave applied successfully!',
      });

      // Reset form state
      setSelectedLeaveType(null);
      setDurationMode('1');
      setStartDate(new Date());
      setEndDate(new Date());
      setReason('');
      setSelectedDocument(null);

      // Go back explicitly to My Leaves page
      router.replace('/(main)/(drawer)/leaves');
    } catch (err: any) {
      console.warn('applyLeave error:', err);
      const msg = err?.response?.data?.message || err?.message || 'An error occurred while submitting leave';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    setShowStartDatePicker(false);
    if (selectedDate && event?.type !== 'dismissed') {
      setStartDate(selectedDate);
      if (endDate < selectedDate) {
        setEndDate(selectedDate);
      }
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    setShowEndDatePicker(false);
    if (selectedDate && event?.type !== 'dismissed') {
      if (selectedDate < startDate) {
        Alert.alert('Validation Error', 'End Date cannot be before Start Date');
      } else {
        setEndDate(selectedDate);
      }
    }
  };

  const handleBack = () => {
    router.replace('/(main)/(drawer)/leaves');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Apply Leave" onBack={handleBack} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.formCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>New Leave Request</Text>
          
          {/* Leave Type Dropdown */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Leave Type *</Text>
            <TouchableOpacity 
              style={[styles.dropdownInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              onPress={() => {
                if (leaveTypes.length === 0 && !isLoadingTypes) {
                  fetchLeaveTypes();
                }
                leaveTypeBottomSheetRef.current?.present();
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownValueText, { color: colors.text }, !selectedLeaveType && { color: colors.textMuted }]}>
                {selectedLeaveType 
                  ? `${selectedLeaveType.leave_name} (Quota: ${selectedLeaveType.no_leave}${selectedLeaveType.remaining_leaves !== undefined ? `, Available: ${selectedLeaveType.remaining_leaves}` : ''})` 
                  : 'Select Leave Type'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {/* Duration Mode Selection */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Duration Category *</Text>
            <View style={[styles.segmentContainer, { backgroundColor: colors.surfaceSubtle }]}>
              <TouchableOpacity 
                style={[
                  styles.segmentButton, 
                  durationMode === '1' && { backgroundColor: colors.cardBg }
                ]}
                onPress={() => setDurationMode('1')}
              >
                <Text style={[styles.segmentText, { color: colors.textMuted }, durationMode === '1' && { color: colors.primary, fontWeight: '700' }]}>Full Day</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.segmentButton, 
                  durationMode === '2' && { backgroundColor: colors.cardBg }
                ]}
                onPress={() => setDurationMode('2')}
              >
                <Text style={[styles.segmentText, { color: colors.textMuted }, durationMode === '2' && { color: colors.primary, fontWeight: '700' }]}>Half Day</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.segmentButton, 
                  durationMode === '3' && { backgroundColor: colors.cardBg }
                ]}
                onPress={() => setDurationMode('3')}
              >
                <Text style={[styles.segmentText, { color: colors.textMuted }, durationMode === '3' && { color: colors.primary, fontWeight: '700' }]}>Multiple</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Start Date Selection */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textMuted }]}>{durationMode === '3' ? 'Start Date *' : 'Date *'}</Text>
            <TouchableOpacity 
              style={[styles.dropdownInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
              onPress={() => setShowStartDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownValueText, { color: colors.text }]}>
                {startDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {showStartDatePicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display="default"
              onChange={handleStartDateChange}
            />
          )}

          {/* End Date Selection (Only when Multiple is selected) */}
          {durationMode === '3' && (
            <>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textMuted }]}>End Date *</Text>
                <TouchableOpacity 
                  style={[styles.dropdownInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}
                  onPress={() => setShowEndDatePicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dropdownValueText, { color: colors.text }]}>
                    {endDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                  <Ionicons name="calendar-outline" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {showEndDatePicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  onChange={handleEndDateChange}
                  minimumDate={startDate}
                />
              )}
              
              {/* Calculated Days Feedback Card */}
              <View style={[styles.computedDurationCard, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="information-circle" size={20} color={colors.primary} />
                <Text style={[styles.computedDurationText, { color: colors.text }]}>
                  Total leave days: <Text style={{ fontWeight: '700', color: colors.primary }}>{calculateDays(startDate, endDate)} Day(s)</Text>
                </Text>
              </View>
            </>
          )}

          {/* Reason Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Reason *</Text>
            <TextInput 
              style={[styles.textInput, styles.multilineInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
              placeholder="Enter reason for leave..."
              placeholderTextColor={colors.textMuted}
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
              value={reason}
              onChangeText={setReason}
            />
          </View>

          {/* Document Picker */}
          {selectedLeaveType && String(selectedLeaveType.need_document) === '1' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Attachment (Optional)</Text>
              
              {selectedDocument ? (
                <View style={[styles.fileCard, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                  {selectedDocument.mimeType?.includes('image') ? (
                    <Image source={{ uri: selectedDocument.uri }} style={styles.fileThumbnail} />
                  ) : (
                    <View style={[styles.fileThumbnail, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryLight }]}>
                      <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.fileDetails}>
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1} ellipsizeMode="middle">
                      {selectedDocument.name || 'document'}
                    </Text>
                    <Text style={[styles.fileSize, { color: colors.textMuted }]}>
                      {selectedDocument.fileSize ? `${(selectedDocument.fileSize / 1024).toFixed(1)} KB` : 'Document'}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.fileRemoveButton}
                    onPress={() => setSelectedDocument(null)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.uploadBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.primary }]}
                  onPress={handleSelectDocument}
                  activeOpacity={0.7}
                >
                  <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />
                  <Text style={[styles.uploadTitle, { color: colors.primary }]}>Choose file / Photo</Text>
                  <Text style={[styles.uploadSubtitle, { color: colors.textMuted }]}>Supported: PDF, JPEG, PNG (Max 5MB)</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Submit Button */}
          {isSubmitting ? (
            <View style={[styles.submitButton, { backgroundColor: colors.primary }]}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={handleSubmitLeave}
              activeOpacity={0.8}
            >
              <Text style={styles.submitButtonText}>Submit Application</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Leave Type Bottom Sheet */}
      <SelectionBottomSheet
        ref={leaveTypeBottomSheetRef}
        title="Select Leave Type"
        data={leaveTypes}
        loading={isLoadingTypes}
        selectedId={selectedLeaveType?.id}
        keyExtractor={(item) => String(item.id)}
        labelExtractor={(item) => `${item.leave_name} (Quota: ${item.no_leave}${item.remaining_leaves !== undefined ? `, Available: ${item.remaining_leaves}` : ''})`}
        onSelect={(item: LeaveType) => {
          setSelectedLeaveType(item);
          // Clear selected document if new type doesn't need it
          if (String(item.need_document) !== '1') {
            setSelectedDocument(null);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f6fa',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4b5563',
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  dropdownInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  dropdownValueText: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#9ca3af',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  disabledSegmentContainer: {
    backgroundColor: '#e5e7eb',
    opacity: 0.7,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  disabledSegmentBtn: {
    opacity: 0.6,
  },
  activeSegment: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeSegmentText: {
    color: '#3d5ee1',
  },
  restrictionNotice: {
    fontSize: 11,
    color: '#ef4444',
    marginTop: 6,
    fontWeight: '500',
  },
  textInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  disabledInput: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb',
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  disabledTextInput: {
    color: '#9ca3af',
  },
  multilineInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    height: 100,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: '#3d5ee1',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  uploadTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3d5ee1',
    marginTop: 8,
  },
  uploadSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 10,
  },
  fileThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#eee',
  },
  fileDetails: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  fileSize: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  fileRemoveButton: {
    padding: 6,
  },
  computedDurationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 10,
    padding: 12,
    marginTop: 2,
    gap: 8,
  },
  computedDurationText: {
    fontSize: 13,
    color: '#0369a1',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#3d5ee1',
    borderRadius: 10,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#3d5ee1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
