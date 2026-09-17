import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PieChart } from 'react-native-gifted-charts';
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
} from 'react-native-popup-menu';

import { AttendanceData } from '@/redux/features/dashboard/types';
import { useAppTheme } from '@/constants/theme';

interface AttendanceCardProps {
  data?: AttendanceData;
}

export default function AttendanceCard({ data }: AttendanceCardProps) {
  const [period, setPeriod] = useState('This Week');
  const { colors } = useAppTheme();

  // Active stats based on selected period
  const activeStats = (period === 'This Week' && data?.periods?.this_week)
    ? data.periods.this_week
    : (period === 'Last Week' && data?.periods?.last_week)
    ? data.periods.last_week
    : (period === 'Last Month' && data?.periods?.last_month)
    ? data.periods.last_month
    : (period === 'Overall' && data?.periods?.overall)
    ? data.periods.overall
    : {
        present: data?.present || 0,
        late: data?.late || 0,
        half: data?.half || 0,
        absent: data?.absent || 0,
      };

  const attendanceStats = [
    { value: activeStats.present, color: '#4CAF50', label: 'Present' },
    { value: activeStats.late, color: '#2196F3', label: 'Late' },
    { value: activeStats.half, color: '#FF9800', label: 'Half Day' },
    { value: activeStats.absent, color: '#F44336', label: 'Absent' },
  ];

  const totalDays = activeStats.present + activeStats.late + activeStats.half + activeStats.absent;

  const chartData = attendanceStats
    .filter(item => item.value > 0)
    .map((item, index) => ({
      value: item.value,
      color: item.color,
      text: `${Math.round((item.value / totalDays) * 100)}%`,
      focused: index === 0,
    }));

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const getDayStatusColor = (status?: string) => {
    switch (status) {
      case '1': return '#4CAF50'; // Present
      case '2': return '#2196F3'; // Late
      case '3': return '#FF9800'; // Half Day
      case '0': return '#F44336'; // Absent
      default: return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Attendance</Text>
        <Menu>
          <MenuTrigger>
            <View style={[styles.periodSelector, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="calendar-outline" size={14} color={colors.primary} />
              <Text style={[styles.periodText, { color: colors.primary }]}>{period}</Text>
              <Ionicons name="chevron-down" size={12} color={colors.primary} />
            </View>
          </MenuTrigger>
          <MenuOptions customStyles={{
            optionsContainer: [menuOptionsStyles.optionsContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }],
          }}>
            <MenuOption onSelect={() => setPeriod('This Week')}>
              <Text style={[menuOptionsStyles.optionText, { color: colors.text }]}>This Week</Text>
            </MenuOption>
            <MenuOption onSelect={() => setPeriod('Last Week')}>
              <Text style={[menuOptionsStyles.optionText, { color: colors.text }]}>Last Week</Text>
            </MenuOption>
            <MenuOption onSelect={() => setPeriod('Last Month')}>
              <Text style={[menuOptionsStyles.optionText, { color: colors.text }]}>Last Month</Text>
            </MenuOption>
            <MenuOption onSelect={() => setPeriod('Overall')}>
              <Text style={[menuOptionsStyles.optionText, { color: colors.text }]}>Overall</Text>
            </MenuOption>
          </MenuOptions>
        </Menu>
      </View>

      {/* Week Overview Box */}
      <View style={[styles.weekBox, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
        <View style={styles.weekHeader}>
          <Text style={[styles.weekTitle, { color: colors.text }]}>Weekly Overview</Text>
          <Text style={[styles.weekDates, { color: colors.textMuted }]}>Recent 7 Days</Text>
        </View>
        <View style={styles.daysRow}>
          {(data?.recent_days || weekDays.map((d) => ({ day: d, status: '' }))).map((item, index) => {
            const statusColor = getDayStatusColor(item.status);
            return (
              <View 
                key={index} 
                style={[
                  styles.dayBadge, 
                  { 
                    backgroundColor: statusColor ? statusColor + '20' : colors.cardBg, 
                    borderColor: statusColor || colors.border 
                  }
                ]}
              >
                <Text style={[styles.dayText, { color: statusColor || colors.textSecondary }]}>
                  {item.day}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.reportInfo}>
        <Ionicons name="stats-chart-outline" size={14} color={colors.primary} />
        <Text style={[styles.reportInfoText, { color: colors.textMuted }]}>
          {period === 'Overall' ? 'Overall Attendance Summary' : `${period} Attendance Summary`}
        </Text>
      </View>

      {/* Stats Summary Table */}
      <View style={[styles.statsTable, { borderColor: colors.border }]}>
        <View style={styles.statColumn}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Present</Text>
          <Text style={[styles.statValue, { color: '#4CAF50' }]}>{activeStats.present}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statColumn}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Late</Text>
          <Text style={[styles.statValue, { color: '#2196F3' }]}>{activeStats.late}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statColumn}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Half Day</Text>
          <Text style={[styles.statValue, { color: '#FF9800' }]}>{activeStats.half}</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statColumn}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Absent</Text>
          <Text style={[styles.statValue, { color: '#F44336' }]}>{activeStats.absent}</Text>
        </View>
      </View>

      {/* Chart Section */}
      <View style={styles.chartContainer}>
        <View style={styles.chartWrapper}>
          {chartData.length > 0 ? (
            <PieChart
              data={chartData}
              donut
              sectionAutoFocus
              radius={80}
              innerRadius={50}
              innerCircleColor={colors.cardBg}
              centerLabelComponent={() => (
                <View style={styles.centerLabel}>
                  <Text style={[styles.centerValue, { color: colors.text }]}>{totalDays}</Text>
                  <Text style={[styles.centerSubText, { color: colors.textMuted }]}>Total Days</Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={[styles.centerValue, { color: colors.text }]}>0</Text>
              <Text style={[styles.centerSubText, { color: colors.textMuted }]}>No data available</Text>
            </View>
          )}
        </View>
        
        <View style={styles.legendContainer}>
          {attendanceStats.map((item, index) => (
            <View key={index} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginVertical: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  periodSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  periodText: {
    fontSize: 12,
    fontWeight: '600',
    marginHorizontal: 6,
  },
  weekBox: {
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    marginBottom: 15,
  },
  weekHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  weekTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  weekDates: {
    fontSize: 11,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  dayBadge: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  dayText: {
    fontSize: 12,
    fontWeight: '600',
  },
  reportInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  reportInfoText: {
    fontSize: 13,
    marginLeft: 8,
  },
  statsTable: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    marginBottom: 20,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    width: '100%',
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 160,
    width: '100%',
  },
  centerLabel: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
  },
  centerValue: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  centerSubText: {
    fontSize: 10,
    textAlign: 'center',
  },
  legendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 20,
    gap: 15,
    width: '100%',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

const menuOptionsStyles = {
  optionsContainer: {
    borderRadius: 10,
    marginTop: 35,
    width: 130,
    padding: 5,
    borderWidth: 1,
  },
  optionText: {
    fontSize: 14,
    padding: 5,
  },
};
