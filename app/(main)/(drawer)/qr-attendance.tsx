import React, { useState, useRef, useCallback, Component } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Vibration,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import InternalHeader from '@/components/InternalHeader';
import { useAppTheme } from '@/constants/theme';
import { apiClient } from '@/services/apiClient';

// Error Boundary to catch missing native module in older APKs
class CameraErrorBoundary extends Component<
  { children: React.ReactNode; fallback: (error: any) => React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

// Native Camera Scanner View
interface CameraScannerInnerProps {
  torchEnabled: boolean;
  isProcessing: boolean;
  onBarcodeScanned: (data: string) => void;
  scannedCount: number;
  colors: any;
  requestPermission: any;
  permission: any;
}

function CameraScannerInner({
  torchEnabled,
  isProcessing,
  onBarcodeScanned,
  scannedCount,
  colors,
  requestPermission,
  permission,
}: CameraScannerInnerProps) {
  if (!permission) {
    return (
      <View style={styles.permissionCenter}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.permissionText, { color: colors.textMuted }]}>
          Checking camera permissions...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionCenter}>
        <View style={[styles.permissionIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
          <Ionicons name="camera-outline" size={48} color={colors.primary} />
        </View>
        <Text style={[styles.permissionTitle, { color: colors.text }]}>
          Camera Permission Required
        </Text>
        <Text style={[styles.permissionSubText, { color: colors.textMuted }]}>
          Growvidya needs camera access to scan student ID cards for automated attendance.
        </Text>
        <TouchableOpacity
          style={[styles.grantBtn, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
          <Text style={styles.grantBtnText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.cameraWrapper}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchEnabled}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={({ data }) => onBarcodeScanned(data)}
      />

      {/* Viewfinder Overlay */}
      <View style={styles.overlayContainer}>
        <View style={styles.overlayTop}>
          <Text style={styles.instructionsText}>
            Align the Student ID Card QR Code inside the frame
          </Text>
        </View>

        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanTargetBox}>
            <View style={[styles.cornerBorder, styles.cornerTL]} />
            <View style={[styles.cornerBorder, styles.cornerTR]} />
            <View style={[styles.cornerBorder, styles.cornerBL]} />
            <View style={[styles.cornerBorder, styles.cornerBR]} />

            {isProcessing && (
              <View style={styles.processingIndicator}>
                <ActivityIndicator size="small" color="#10b981" />
                <Text style={styles.processingText}>Verifying Student...</Text>
              </View>
            )}
          </View>
          <View style={styles.overlaySide} />
        </View>

        <View style={styles.overlayBottom}>
          <View style={styles.counterBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#10b981" />
            <Text style={styles.counterText}>
              {scannedCount} Marked Present Today
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// Wrapper to safely invoke the hook
function SafeCameraWrapper(props: Omit<CameraScannerInnerProps, 'permission' | 'requestPermission'>) {
  const [permission, requestPermission] = useCameraPermissions();
  return (
    <CameraScannerInner
      {...props}
      permission={permission}
      requestPermission={requestPermission}
    />
  );
}

export default function QrAttendanceScreen() {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();

  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalScannedCount, setTotalScannedCount] = useState(0);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualAdmissionNo, setManualAdmissionNo] = useState('');
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  const processingRef = useRef(false);
  const lastScannedCodeRef = useRef<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);

  // Clear state whenever screen comes into focus or loses focus
  useFocusEffect(
    useCallback(() => {
      processingRef.current = false;
      lastScannedCodeRef.current = null;
      lastScannedTimeRef.current = 0;

      return () => {
        processingRef.current = false;
        lastScannedCodeRef.current = null;
        lastScannedTimeRef.current = 0;
      };
    }, [])
  );

  // Process Admission Number from QR Scan or Manual Input
  const processAdmissionNumber = useCallback(
    async (rawCode: string) => {
      const admissionNumber = String(rawCode || '').trim();
      if (!admissionNumber) return;

      const now = Date.now();
      // Prevent duplicate scan of the exact same code within 3 seconds
      if (
        lastScannedCodeRef.current === admissionNumber &&
        now - lastScannedTimeRef.current < 3000
      ) {
        return;
      }

      if (processingRef.current) return;
      processingRef.current = true;
      setIsProcessing(true);

      lastScannedCodeRef.current = admissionNumber;
      lastScannedTimeRef.current = now;

      try {
        if (Platform.OS !== 'web') {
          Vibration.vibrate(100);
        }

        const response = await apiClient.post('/teacher/attendance/qr-scan', {
          admission_number: admissionNumber,
        });

        const data = response.data?.data;
        if (data && data.student) {
          const isAlreadyPresent = Boolean(data.attendance?.is_already_marked);
          const student = data.student;

          const classSec = student.class_name && student.section_name
            ? `${student.class_name} (${student.section_name})`
            : student.class_name || '';
          const rollAdm = `Roll: ${student.roll_number || '—'} • Adm: ${student.admission_number}`;
          const studentDetails = classSec ? `${classSec} • ${rollAdm}` : rollAdm;

          if (!isAlreadyPresent) {
            setTotalScannedCount((prev) => prev + 1);

            // Toast Success Notification: student is marked as present
            Toast.show({
              type: 'success',
              text1: `Marked Present: ${student.full_name}`,
              text2: studentDetails,
              visibilityTime: 3200,
              topOffset: 55,
            });
          } else {
            // Warning Toast: student is already present
            Toast.show({
              type: 'warning',
              text1: `Already Present: ${student.full_name}`,
              text2: studentDetails,
              visibilityTime: 3500,
              topOffset: 55,
            });
          }
        }
      } catch (err: any) {
        const errorMsg =
          err.response?.data?.message ||
          err.message ||
          `Student with admission number "${admissionNumber}" not found in this school.`;

        // Error Toast: not found or failure
        Toast.show({
          type: 'error',
          text1: 'Attendance Error',
          text2: errorMsg,
          visibilityTime: 4000,
          topOffset: 55,
        });
      } finally {
        setTimeout(() => {
          processingRef.current = false;
          setIsProcessing(false);
        }, 1800);
      }
    },
    []
  );

  // QR Code detection handler
  const handleBarcodeScanned = useCallback(
    (data: string) => {
      if (processingRef.current || !data) return;
      processAdmissionNumber(data);
    },
    [processAdmissionNumber]
  );

  // Manual Admission Number Submit
  const handleManualSubmit = async () => {
    const cleanNo = manualAdmissionNo.trim();
    if (!cleanNo) {
      Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter a student admission number.',
        topOffset: 55,
      });
      return;
    }
    setIsManualSubmitting(true);
    await processAdmissionNumber(cleanNo);
    setIsManualSubmitting(false);
    setShowManualModal(false);
    setManualAdmissionNo('');
  };

  // Header Right Action (Torch & Manual buttons)
  const headerRight = (
    <View style={styles.headerRightActions}>
      <TouchableOpacity
        style={styles.headerIconBtn}
        onPress={() => setTorchEnabled((prev) => !prev)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={torchEnabled ? 'flash' : 'flash-outline'}
          size={22}
          color={torchEnabled ? '#f59e0b' : colors.icon}
        />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.headerIconBtn}
        onPress={() => {
          setManualAdmissionNo('');
          setShowManualModal(true);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="keypad-outline" size={22} color={colors.icon} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.background : '#f8fafc' }]}>
      <InternalHeader
        title="Scan ID Card Attendance"
        rightAction={headerRight}
        onBack={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(main)/(drawer)/attendance');
          }
        }}
      />

      {/* Main Scanner Section with Error Boundary */}
      <View style={styles.mainContent}>
        <CameraErrorBoundary
          fallback={() => (
            <View style={[styles.nativeErrorCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={styles.alertIconCircle}>
                <Ionicons name="construct-outline" size={44} color="#f59e0b" />
              </View>
              <Text style={[styles.nativeErrorTitle, { color: colors.text }]}>
                New Development Build Required
              </Text>
              <Text style={[styles.nativeErrorDesc, { color: colors.textMuted }]}>
                The APK installed on this phone was built before{' '}
                <Text style={{ fontWeight: '700', color: colors.text }}>expo-camera</Text> was added.
                To enable the camera viewfinder, create a new development APK:
              </Text>

              <View style={[styles.codeBox, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }]}>
                <Text style={[styles.codeText, { color: colors.primary }]}>
                  eas build --profile development --platform android
                </Text>
              </View>

              <Text style={[styles.nativeErrorDesc, { color: colors.textMuted, marginTop: 8 }]}>
                In the meantime, you can test student lookup and attendance recording using manual entry:
              </Text>

              <TouchableOpacity
                style={[styles.manualActionBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setManualAdmissionNo('');
                  setShowManualModal(true);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="keypad-outline" size={20} color="#fff" />
                <Text style={styles.manualActionBtnText}>Enter Admission Number Manually</Text>
              </TouchableOpacity>
            </View>
          )}
        >
          <SafeCameraWrapper
            torchEnabled={torchEnabled}
            isProcessing={isProcessing}
            onBarcodeScanned={handleBarcodeScanned}
            scannedCount={totalScannedCount}
            colors={colors}
          />
        </CameraErrorBoundary>
      </View>

      {/* Manual Admission Number Modal */}
      <Modal
        visible={showManualModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setManualAdmissionNo('');
          setShowManualModal(false);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.cardBg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Manual Admission Entry
              </Text>
              <TouchableOpacity onPress={() => setShowManualModal(false)}>
                <Ionicons name="close" size={24} color={colors.icon} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubText, { color: colors.textMuted }]}>
              Enter student's admission number to verify against the backend and mark attendance.
            </Text>

            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. ADM2026-0042"
              placeholderTextColor={colors.textMuted}
              value={manualAdmissionNo}
              onChangeText={setManualAdmissionNo}
              autoCapitalize="characters"
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => {
                  setManualAdmissionNo('');
                  setShowManualModal(false);
                }}
              >
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: colors.primary }]}
                onPress={handleManualSubmit}
                disabled={isManualSubmitting}
              >
                {isManualSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Mark Present</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mainContent: {
    flex: 1,
    position: 'relative',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  overlayTop: {
    paddingTop: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  instructionsText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  overlayMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  overlaySide: {
    flex: 1,
    height: 240,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  scanTargetBox: {
    width: 240,
    height: 240,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerBorder: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#10b981',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 8,
  },
  processingIndicator: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processingText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  overlayBottom: {
    paddingBottom: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  counterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#10b981',
    gap: 8,
  },
  counterText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  permissionCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  permissionIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionSubText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  permissionText: {
    marginTop: 12,
    fontSize: 14,
  },
  grantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  grantBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  nativeErrorCard: {
    margin: 20,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    elevation: 2,
  },
  alertIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  nativeErrorTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  nativeErrorDesc: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 12,
  },
  codeBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginVertical: 8,
    width: '100%',
    alignItems: 'center',
  },
  codeText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  manualActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  manualActionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    padding: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubText: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 110,
  },
  modalSubmitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
