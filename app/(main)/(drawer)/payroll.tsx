import React, { useState, useCallback, useMemo, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  FlatList, 
  ActivityIndicator, 
  TouchableOpacity, 
  RefreshControl, 
  Alert,
  Platform
} from 'react-native';
import { useAppSelector } from '@/redux/hooks';
import { Ionicons } from '@expo/vector-icons';
import InternalHeader from '@/components/InternalHeader';
import { useFocusEffect } from 'expo-router';
import { useAppTheme } from '@/constants/theme';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { apiClient, getServerBaseUrl } from '@/services/apiClient';

export default function PayrollScreen() {
  const token = useAppSelector((state) => state.auth.token);
  const teacherUser = useAppSelector((state) => state.auth.user);
  const { colors, isDark } = useAppTheme();
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingSlipId, setGeneratingSlipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);

  const teacherFullName = teacherUser
    ? `${teacherUser.first_name || ''} ${teacherUser.last_name || ''}`.trim()
    : 'Teacher';

  const fetchPayroll = useCallback(async (isRefresh = false, isSilent = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (!isSilent) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await apiClient.get('/teacher/payroll/salary');
      const resData = response.data;
      const raw =
        resData?.data?.salaries ||
        resData?.salaries ||
        (Array.isArray(resData?.data) ? resData.data : []);
      const list = Array.isArray(raw) ? raw : (raw && typeof raw === 'object' ? [raw] : []);
      const normalized = list.map((item: any) => ({
        ...item,
        emp_name: item.employee_name || item.emp_name || teacherFullName || 'Teacher',
        month: item.month || item.payment_date || item.created_on || '',
      }));
      setPayrollData(normalized);
    } catch (err: any) {
      console.warn('fetchPayroll exception:', err?.message);
      setError(err?.response?.data?.message || err?.message || 'An error occurred while fetching payroll');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [teacherFullName]);

  useFocusEffect(
    useCallback(() => {
      fetchPayroll(false, hasLoadedRef.current);
      hasLoadedRef.current = true;
    }, [fetchPayroll])
  );

  const formatCurrency = (amount: any): string => {
    const num = Number(amount);
    if (isNaN(num)) return '₹0.00';
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateString = (dateStr: any) => {
    if (!dateStr) return 'N/A';
    try {
      const cleanStr = String(dateStr).split('T')[0].split(' ')[0];
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const months = [
          'January', 'February', 'March', 'April', 'May', 'June', 
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        if (monthIdx >= 0 && monthIdx < 12) {
          return `${day} ${months[monthIdx]} ${year}`;
        }
      }
      return String(dateStr);
    } catch (e) {
      return String(dateStr);
    }
  };

  const getFullMonthYear = (dateStr: any) => {
    if (!dateStr) return 'N/A';
    try {
      const cleanStr = String(dateStr).split('T')[0].split(' ')[0];
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const months = [
          'January', 'February', 'March', 'April', 'May', 'June', 
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        if (monthIdx >= 0 && monthIdx < 12) {
          return `${months[monthIdx]} ${year}`;
        }
      }
      return String(dateStr);
    } catch (e) {
      return String(dateStr);
    }
  };

  const formatMonthYearString = (dateStr: any) => {
    if (!dateStr) return 'N/A';
    try {
      const cleanStr = String(dateStr).split('T')[0].split(' ')[0];
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const year = parts[0];
        const monthIdx = parseInt(parts[1], 10) - 1;
        const months = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        if (monthIdx >= 0 && monthIdx < 12) {
          return `${months[monthIdx]} ${year}`;
        }
      }
      return String(dateStr);
    } catch (e) {
      return String(dateStr);
    }
  };

  // Helper to convert number to words (Indian Numbering System format)
  const numberToWords = (amount: number): string => {
    if (!amount || isNaN(amount) || amount <= 0) return 'Zero Rupees';
    const ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    const convert = (n: number): string => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
      return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
    };

    const intVal = Math.floor(amount);
    const decVal = Math.round((amount - intVal) * 100);
    
    let res = convert(intVal).trim();
    if (decVal > 0) {
      res += ` Rupees and ${convert(decVal).trim()} Paise`;
    } else {
      res += ` Rupees`;
    }
    return res;
  };

  const handleDownloadSlip = async (item: any) => {
    const slipId = item.id ? String(item.id) : 'active';
    setGeneratingSlipId(slipId);
    try {
      const dateSource = item.payment_date || item.created_on;
      const monthYear = getFullMonthYear(dateSource);
      const designation = String(item.user_type) === '1' ? 'Staff' : 'Teacher';
      const formattedDate = formatDateString(dateSource);
      const netSalaryNum = Number(item.net_salary) || 0;
      const amountInWords = numberToWords(netSalaryNum) + ' Only';
      const basicNum = Number(item.basic_salary) || 0;
      const dedNum = Number(item.total_deductions) || 0;

      // Professional HTML Template for Print/PDF
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Salary Slip - ${monthYear}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
              color: #1f2937;
              margin: 0;
              padding: 24px;
              background-color: #ffffff;
            }
            .salary-slip {
              border: 1px solid #d1d5db;
              border-radius: 8px;
              padding: 28px;
              max-width: 750px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #3d5ee1;
              margin-bottom: 20px;
              padding-bottom: 16px;
            }
            .header img {
              max-height: 55px;
              margin-bottom: 8px;
              object-fit: contain;
            }
            .header h2 {
              margin: 0 0 4px 0;
              font-size: 22px;
              color: #111827;
              font-weight: 700;
            }
            .header h3 {
              margin: 0;
              font-size: 14px;
              color: #3d5ee1;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 14px;
              margin-bottom: 16px;
            }
            .table td, .table th {
              border: 1px solid #e5e7eb;
              padding: 8px 12px;
              font-size: 12px;
            }
            .meta-label {
              background-color: #f9fafb;
              font-weight: 600;
              color: #4b5563;
              width: 20%;
            }
            .meta-val {
              color: #111827;
              width: 30%;
            }
            .salary-head {
              background-color: #3d5ee1;
              color: #ffffff;
              font-weight: 600;
              text-align: left;
            }
            .text-right {
              text-align: right;
            }
            .summary-row td {
              font-weight: 600;
              background-color: #f9fafb;
            }
            .net-row td {
              font-size: 14px;
              font-weight: 700;
              background-color: #eef2ff;
              color: #3d5ee1;
            }
            .words-box {
              background-color: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 6px;
              padding: 10px 14px;
              margin-top: 14px;
              font-size: 12px;
            }
            .words-box strong {
              color: #475569;
            }
            .footer {
              margin-top: 50px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            .signature {
              text-align: center;
              border-top: 1px solid #9ca3af;
              padding-top: 6px;
              font-size: 11px;
              font-weight: 600;
              color: #4b5563;
              width: 180px;
              margin-left: auto;
            }
            .note {
              font-size: 10px;
              color: #9ca3af;
              margin-top: 24px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="salary-slip">
            <div class="header">
              <img src="${getServerBaseUrl()}/vidya_assets/images/school-logo.png" height="55" alt="Growvidya School" onerror="this.style.display='none'" />
              <h2>Growvidya Public School</h2>
              <h3>Salary Slip - ${monthYear}</h3>
            </div>

            <table class="table">
              <tr>
                <td class="meta-label">Employee Name:</td>
                <td class="meta-val"><strong>${item.emp_name || 'N/A'}</strong></td>
                <td class="meta-label">Employee ID:</td>
                <td class="meta-val">${item.employee_id || 'N/A'}</td>
              </tr>
              <tr>
                <td class="meta-label">Designation:</td>
                <td class="meta-val">${designation}</td>
                <td class="meta-label">Payment Date:</td>
                <td class="meta-val">${formattedDate}</td>
              </tr>
              ${item.transaction_id ? `
              <tr>
                <td class="meta-label">Transaction ID:</td>
                <td class="meta-val" colspan="3">${item.transaction_id}</td>
              </tr>
              ` : ''}
            </table>

            <table class="table">
              <thead>
                <tr>
                  <th class="salary-head" style="width: 50%;">Earnings</th>
                  <th class="salary-head text-right" style="width: 50%;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Basic Salary</td>
                  <td class="text-right">₹${basicNum.toFixed(2)}</td>
                </tr>
                <tr class="summary-row">
                  <td>Total Earnings</td>
                  <td class="text-right">₹${basicNum.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <table class="table">
              <thead>
                <tr>
                  <th class="salary-head" style="width: 50%; background-color: #64748b;">Deductions</th>
                  <th class="salary-head text-right" style="width: 50%; background-color: #64748b;">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Standard Deductions / Leaves</td>
                  <td class="text-right">₹${dedNum.toFixed(2)}</td>
                </tr>
                <tr class="summary-row">
                  <td>Total Deductions</td>
                  <td class="text-right">₹${dedNum.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <table class="table">
              <tr class="net-row">
                <td style="width: 50%;">Net Salary Payable</td>
                <td class="text-right" style="width: 50%;">₹${netSalaryNum.toFixed(2)}</td>
              </tr>
            </table>

            <div class="words-box">
              <strong>Amount in Words:</strong> ${amountInWords}
            </div>

            <div class="footer">
              <div class="signature">
                Authorized Signatory
              </div>
            </div>

            <div class="note">
              This is a computer generated salary slip and does not require physical stamp or seal.
            </div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      const safeMonth = monthYear.replace(/\s+/g, '_');
      const fileName = `Salary_Slip_${safeMonth}.pdf`;

      if (Platform.OS === 'android') {
        let savedDirectly = false;
        try {
          if (FileSystem.StorageAccessFramework?.requestDirectoryPermissionsAsync) {
            const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
            if (permissions?.granted && permissions?.directoryUri) {
              const base64Data = await FileSystem.readAsStringAsync(uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                permissions.directoryUri,
                fileName,
                'application/pdf'
              );
              await FileSystem.writeAsStringAsync(fileUri, base64Data, {
                encoding: FileSystem.EncodingType.Base64,
              });
              savedDirectly = true;
              Alert.alert('Success', 'Salary slip saved successfully!');
            }
          }
        } catch (storageErr) {
          console.log('SAF save fallback to share dialog:', storageErr);
        }

        if (!savedDirectly) {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, {
              mimeType: 'application/pdf',
              dialogTitle: fileName,
              UTI: 'com.adobe.pdf',
            });
          } else {
            Alert.alert('Download Complete', `File saved at: ${uri}`);
          }
        }
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: fileName,
            UTI: 'com.adobe.pdf',
          });
        } else {
          Alert.alert('Download Complete', `File saved at: ${uri}`);
        }
      }
    } catch (err: any) {
      console.warn('Error downloading salary slip:', err);
      Alert.alert('Error', err?.message || 'Failed to generate salary slip');
    } finally {
      setGeneratingSlipId(null);
    }
  };

  // Sum calculations
  const totals = useMemo(() => {
    return payrollData.reduce(
      (acc, item) => {
        acc.net += Number(item.net_salary) || 0;
        acc.basic += Number(item.basic_salary) || 0;
        acc.deductions += Number(item.total_deductions) || 0;
        return acc;
      },
      { net: 0, basic: 0, deductions: 0 }
    );
  }, [payrollData]);

  const renderSummaryHeader = () => {
    if (payrollData.length === 0) return null;

    return (
      <View style={styles.summaryContainer}>
        <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.summaryLabel}>Total Net Received</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totals.net)}</Text>
          <Text style={styles.summarySubtext}>{payrollData.length} Payslip(s) Recorded</Text>
        </View>
        
        <View style={styles.statsRow}>
          <View style={[styles.statsCard, { marginRight: 8, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.statsHeader}>
              <Ionicons name="arrow-up-circle-outline" size={16} color="#10b981" />
              <Text style={[styles.statsLabel, { color: colors.textMuted }]}>Basic Salary</Text>
            </View>
            <Text style={[styles.statsValue, { color: colors.text }]}>{formatCurrency(totals.basic)}</Text>
          </View>

          <View style={[styles.statsCard, { marginLeft: 8, backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.statsHeader}>
              <Ionicons name="arrow-down-circle-outline" size={16} color="#ef4444" />
              <Text style={[styles.statsLabel, { color: colors.textMuted }]}>Deductions</Text>
            </View>
            <Text style={[styles.statsValue, { color: colors.text }]}>{formatCurrency(totals.deductions)}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderPayrollItem = ({ item }: { item: any }) => {
    const isPaid = Number(item.payment_status) === 1 || String(item.payment_status).toLowerCase() === 'paid' || String(item.payment_status) === '1';
    const isGenerating = generatingSlipId === (item.id ? String(item.id) : '');
    const dateSource = item.payment_date || item.created_on;

    return (
      <View style={[styles.payrollCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        {/* Card Header */}
        <View style={[styles.cardHeader, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardMonth, { color: colors.text }]}>{formatMonthYearString(dateSource)}</Text>
            <Text style={[styles.empName, { color: colors.textMuted }]}>{item.emp_name}</Text>
          </View>
          <View style={[styles.statusBadge, isPaid ? styles.paidBadge : styles.unpaidBadge]}>
            <Text style={[styles.statusText, isPaid ? styles.paidText : styles.unpaidText]}>
              {isPaid ? 'PAID' : 'UNPAID'}
            </Text>
          </View>
        </View>

        {/* Salary Details */}
        <View style={styles.salarySection}>
          <View style={styles.salaryCol}>
            <Text style={[styles.salaryLabel, { color: colors.textMuted }]}>Net Salary</Text>
            <Text style={[styles.netSalaryValue, { color: colors.primary }]}>{formatCurrency(item.net_salary)}</Text>
          </View>
          
          <View style={[styles.salaryDivider, { backgroundColor: colors.border }]} />

          <View style={styles.salaryBreakdown}>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textMuted }]}>Basic</Text>
              <Text style={[styles.breakdownValue, { color: colors.text }]}>{formatCurrency(item.basic_salary)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <Text style={[styles.breakdownLabel, { color: colors.textMuted }]}>Deductions</Text>
              <Text style={[styles.breakdownValue, { color: '#ef4444' }]}>
                {formatCurrency(item.total_deductions)}
              </Text>
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Card Footer Actions */}
        <View style={styles.cardFooter}>
          <View style={styles.footerInfo}>
            <Ionicons name="card-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.infoText, { color: colors.textMuted, marginLeft: 6 }]} numberOfLines={1}>
              {item.transaction_id ? `Txn: ${item.transaction_id}` : (item.payment_mode ? `Paid via ${item.payment_mode}` : 'Direct Bank Transfer')}
            </Text>
          </View>

          {isPaid && (
            <TouchableOpacity 
              style={[styles.downloadButton, { backgroundColor: colors.primary }]}
              onPress={() => handleDownloadSlip(item)}
              disabled={isGenerating}
              activeOpacity={0.8}
            >
              {isGenerating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={15} color="#fff" />
                  <Text style={styles.downloadText}>Slip</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="My Salary" />

      {error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Unable to Load Payroll</Text>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
          <TouchableOpacity 
            style={[styles.retryButton, { backgroundColor: colors.primary }]} 
            onPress={() => fetchPayroll()}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : isLoading && !refreshing ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading salary records...</Text>
        </View>
      ) : (
        <FlatList
          data={payrollData}
          keyExtractor={(item, index) => (item?.id != null ? String(item.id) : String(index))}
          renderItem={renderPayrollItem}
          ListHeaderComponent={renderSummaryHeader}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchPayroll(true)}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: isDark ? 'rgba(61, 94, 225, 0.15)' : '#eff6ff' }]}>
                <Ionicons name="receipt-outline" size={40} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Payslips Available</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                Your processed salary slips will appear here once generated by the school administration.
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.primary, marginTop: 16 }]}
                onPress={() => fetchPayroll(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.retryButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
  errorTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 6,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 260,
  },
  summaryContainer: {
    marginBottom: 16,
  },
  summaryCard: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#3d5ee1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 12,
  },
  summaryLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 4,
  },
  summarySubtext: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 12,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsCard: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  statsValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  payrollCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardMonth: {
    fontSize: 16,
    fontWeight: '700',
  },
  empName: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  paidBadge: {
    backgroundColor: '#d1fae5',
  },
  unpaidBadge: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  paidText: {
    color: '#065f46',
  },
  unpaidText: {
    color: '#991b1b',
  },
  salarySection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  salaryCol: {
    flex: 1.1,
  },
  salaryLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  netSalaryValue: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 2,
  },
  salaryDivider: {
    width: 1,
    height: 36,
    marginHorizontal: 12,
  },
  salaryBreakdown: {
    flex: 1.1,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 1,
  },
  breakdownLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  infoText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 64,
    justifyContent: 'center',
  },
  downloadText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
});
