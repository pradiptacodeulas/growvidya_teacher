import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { UpcomingEvent } from '@/redux/features/dashboard/types';
import { useAppTheme } from '@/constants/theme';

interface SchedulesCardProps {
  events?: UpcomingEvent[];
}

export default function SchedulesCard({ events = [] }: SchedulesCardProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = new Date();
  const { colors } = useAppTheme();

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const renderCalendar = () => {
    const month = currentDate.getMonth();
    const year = currentDate.getFullYear();
    const daysInMonth = getDaysInMonth(month, year);
    const firstDay = getFirstDayOfMonth(month, year);
    const days = [];

    // Empty slots for previous month
    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.dayCell} />);
    }

    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const isToday = today.getDate() === i && today.getMonth() === month && today.getFullYear() === year;
      days.push(
        <View key={i} style={styles.dayCell}>
          <View style={[
            styles.dayInner,
            isToday && [styles.todayInner, { backgroundColor: colors.primary }]
          ]}>
            <Text style={[
              styles.dayText,
              { color: colors.text },
              isToday && styles.todayText
            ]}>{i}</Text>
          </View>
        </View>
      );
    }

    return days;
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  const monthYearStr = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'exam': return { name: 'document-text-outline', color: '#ff9800' };
      case 'holiday': return { name: 'sunny-outline', color: '#f44336' };
      default: return { name: 'book-outline', color: colors.primary };
    }
  };

  const formatEventTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return 'All Day';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={styles.calendarSection}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Schedules</Text>
          <View style={styles.navContainer}>
            <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={20} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.monthYearText, { color: colors.primary }]}>{monthYearStr}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.weekDaysRow}>
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <Text key={d} style={[styles.weekDayLabel, { color: colors.textMuted }]}>{d}</Text>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {renderCalendar()}
        </View>
      </View>

      <View style={styles.eventsSection}>
        <View style={styles.eventsHeader}>
          <Text style={[styles.eventsTitle, { color: colors.text }]}>Upcoming Events</Text>
          <Text style={[styles.eventsCount, { color: colors.textMuted }]}>Next {events.length} events</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.eventsList}
        >
          {events.length > 0 ? (
            events.map(event => {
              const icon = getEventIcon(event.type);
              const eventTime = formatEventTime(event.start_date);
              return (
                <View key={event.id} style={[styles.eventItem, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                  <View style={[styles.eventTimeBox, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.eventTimeText, { color: colors.primary }]}>{eventTime.split(' ')[0]}</Text>
                    <Text style={[styles.eventPeriodText, { color: colors.primary }]}>{eventTime.split(' ')[1]}</Text>
                  </View>
                  <View style={[styles.iconBox, { backgroundColor: icon.color + '15' }]}>
                    <Ionicons name={icon.name as any} size={22} color={icon.color} />
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={[styles.eventTitleText, { color: colors.text }]} numberOfLines={1}>{event.title}</Text>
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyEventItem}>
              <Text style={[styles.emptyEventText, { color: colors.textMuted }]}>No upcoming events</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    paddingVertical: 20,
    marginVertical: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
  },
  calendarSection: {
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navBtn: {
    padding: 5,
  },
  monthYearText: {
    fontSize: 14,
    fontWeight: '700',
    marginHorizontal: 10,
    minWidth: 120,
    textAlign: 'center',
  },
  weekDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  weekDayLabel: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayInner: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todayInner: {
    borderRadius: 14,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
  },
  todayText: {
    color: '#fff',
    fontWeight: '800',
  },
  eventsSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    paddingTop: 15,
  },
  eventsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  eventsTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  eventsCount: {
    fontSize: 12,
  },
  eventsList: {
    paddingHorizontal: 20,
    paddingBottom: 5,
    gap: 12,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    width: 220,
    marginRight: 10,
    borderWidth: 1,
  },
  eventTimeBox: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 10,
  },
  eventTimeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  eventPeriodText: {
    fontSize: 9,
    fontWeight: '700',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  emptyEventItem: {
    padding: 15,
    alignItems: 'center',
  },
  emptyEventText: {
    fontSize: 13,
  },
});
