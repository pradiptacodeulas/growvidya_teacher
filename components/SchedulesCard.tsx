import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { UpcomingEvent } from '@/redux/features/dashboard/types';
import { useAppTheme } from '@/constants/theme';

interface SchedulesCardProps {
  events?: UpcomingEvent[];
}

export default function SchedulesCard({ events = [] }: SchedulesCardProps) {
  const { colors, isDark } = useAppTheme();
  const router = useRouter();

  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    // Handle DD-MM-YYYY or DD/MM/YYYY formats
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{4}/.test(dateStr)) {
      const parts = dateStr.split(/[-/]/);
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatScheduleDate = (startDateStr: string, endDateStr?: string) => {
    const start = parseDate(startDateStr);
    if (!start) {
      return {
        day: '--',
        month: '---',
        timeText: 'All Day',
        fullDateText: startDateStr || 'Upcoming',
      };
    }

    const day = String(start.getDate()).padStart(2, '0');
    const month = start.toLocaleString('en-US', { month: 'short' }).toUpperCase();

    const hasTime = startDateStr.includes(':');
    let timeText = 'All Day';
    if (hasTime) {
      timeText = start.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    }

    const end = parseDate(endDateStr || '');
    let fullDateText = start.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
    });
    if (end && end.getTime() !== start.getTime() && end.getDate() !== start.getDate()) {
      fullDateText = `${start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`;
    }

    return {
      day,
      month,
      timeText,
      fullDateText,
    };
  };

  const getEventTypeStyle = (type: string) => {
    const lower = (type || '').toLowerCase();
    if (lower.includes('exam')) {
      return {
        label: 'Exam',
        icon: 'document-text-outline' as const,
        color: '#f59e0b',
        bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7',
      };
    }
    if (lower.includes('holiday')) {
      return {
        label: 'Holiday',
        icon: 'sunny-outline' as const,
        color: '#ef4444',
        bg: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
      };
    }
    if (lower.includes('meeting')) {
      return {
        label: 'Meeting',
        icon: 'people-outline' as const,
        color: '#8b5cf6',
        bg: isDark ? 'rgba(139, 92, 246, 0.15)' : '#ede9fe',
      };
    }
    return {
      label: type || 'Event',
      icon: 'calendar-outline' as const,
      color: colors.primary,
      bg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#e0f2fe',
    };
  };

  const displayedEvents = events.slice(0, 4);

  const handleOpenAllEvents = () => {
    router.push('/(main)/(drawer)/announcement/event' as any);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>Schedules</Text>
          {events.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                {events.length}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity onPress={handleOpenAllEvents} activeOpacity={0.7}>
          <Text style={[styles.viewAllText, { color: colors.primary }]}>View All</Text>
        </TouchableOpacity>
      </View>

      {/* Events List / Empty State */}
      {displayedEvents.length > 0 ? (
        <View style={styles.listContainer}>
          {displayedEvents.map((event) => {
            const typeStyle = getEventTypeStyle(event.type);
            const dateInfo = formatScheduleDate(event.start_date, event.end_date);

            return (
              <TouchableOpacity
                key={event.id}
                style={[
                  styles.scheduleItem,
                  { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }
                ]}
                onPress={handleOpenAllEvents}
                activeOpacity={0.7}
              >
                {/* Calendar Tear-sheet Date Tile */}
                <View style={[styles.dateTile, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <View style={[styles.dateTileMonth, { backgroundColor: colors.primary }]}>
                    <Text style={styles.dateTileMonthText}>{dateInfo.month}</Text>
                  </View>
                  <View style={styles.dateTileDay}>
                    <Text style={[styles.dateTileDayText, { color: colors.text }]}>{dateInfo.day}</Text>
                  </View>
                </View>

                {/* Event Details */}
                <View style={styles.detailsContainer}>
                  <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                    {event.title}
                  </Text>

                  <View style={styles.metaRow}>
                    <View style={styles.timeInfo}>
                      <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                      <Text style={[styles.timeText, { color: colors.textMuted }]} numberOfLines={1}>
                        {dateInfo.timeText === 'All Day' ? dateInfo.fullDateText : `${dateInfo.timeText} • ${dateInfo.fullDateText}`}
                      </Text>
                    </View>

                    <View style={[styles.typeBadge, { backgroundColor: typeStyle.bg }]}>
                      <Ionicons name={typeStyle.icon} size={11} color={typeStyle.color} style={{ marginRight: 3 }} />
                      <Text style={[styles.typeBadgeText, { color: typeStyle.color }]}>
                        {typeStyle.label}
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
            <Ionicons name="calendar-outline" size={26} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Upcoming Schedules</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Events, exams, and school schedules will appear here.
          </Text>
        </View>
      )}
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
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    gap: 10,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateTile: {
    width: 48,
    height: 52,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    marginRight: 12,
  },
  dateTileMonth: {
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTileMonthText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateTileDay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTileDayText: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  detailsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  timeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
});
