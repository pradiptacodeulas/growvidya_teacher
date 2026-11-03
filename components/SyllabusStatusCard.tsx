import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';
import { useAppTheme } from '@/constants/theme';

interface SyllabusStatusCardProps {
  completed: number;
  pending: number;
}

export default function SyllabusStatusCard({ completed, pending }: SyllabusStatusCardProps) {
  const { colors, isDark } = useAppTheme();

  const pieData = [
    {
      value: completed,
      color: '#4CAF50',
      text: `${completed}%`,
      focused: true,
    },
    {
      value: pending,
      color: isDark ? '#ef5350' : '#F44336',
      text: `${pending}%`,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>Syllabus Progress</Text>
      
      <View style={styles.cardContent}>
        <View style={styles.chartWrapper}>
          <PieChart
            data={pieData}
            donut
            sectionAutoFocus
            radius={60}
            innerRadius={45}
            innerCircleColor={colors.cardBg}
            centerLabelComponent={() => {
              return (
                <View style={styles.centerLabel}>
                  <Text style={[styles.centerValue, { color: '#4CAF50' }]}>{completed}%</Text>
                  <Text style={[styles.centerText, { color: colors.textMuted }]}>Completed</Text>
                </View>
              );
            }}
          />
        </View>

        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: '#4CAF50' }]} />
            <View>
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>Completed</Text>
              <Text style={[styles.legendValue, { color: colors.text }]}>{completed}%</Text>
            </View>
          </View>
          
          <View style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: isDark ? '#ef5350' : '#F44336' }]} />
            <View>
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>Pending</Text>
              <Text style={[styles.legendValue, { color: colors.text }]}>{pending}%</Text>
            </View>
          </View>
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
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chartWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLabel: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  centerText: {
    fontSize: 9,
  },
  legendContainer: {
    flex: 1,
    paddingLeft: 35,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  legendValue: {
    fontSize: 14,
    fontWeight: '700',
  },
});
