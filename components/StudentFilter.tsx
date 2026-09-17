import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
} from 'react-native-popup-menu';
import { useAppSelector } from '@/redux/hooks';
import { useAppTheme } from '@/constants/theme';

interface StudentFilterProps {
  filters: {
    name: string;
    class: string;
    section: string;
    status: string;
    date: string;
  };
  onChangeFilters: (filters: any) => void;
  onSearch: () => void;
  onOpenClass: () => void;
  onOpenSection: () => void;
  onClear: () => void;
}

export default function StudentFilter({ 
  filters, 
  onChangeFilters, 
  onSearch,
  onOpenClass,
  onOpenSection,
  onClear
}: StudentFilterProps) {
  const { classes, sections } = useAppSelector(state => state.students);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const { colors } = useAppTheme();

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      const formatted = date.toISOString().split('T')[0];
      onChangeFilters({ ...filters, date: formatted });
    }
  };

  const selectedClassObj = classes.find(c => String(c.id) === String(filters.class));
  const classText = selectedClassObj 
    ? (selectedClassObj.class_name ? `Class ${selectedClassObj.class_name}` : `Class ${selectedClassObj.id}`) 
    : 'Select';

  const selectedSectionObj = sections.find(s => String(s.id) === String(filters.section));
  const sectionText = selectedSectionObj 
    ? `Section ${selectedSectionObj.section_name}` 
    : 'Select';

  const statusText = filters.status === '1' ? 'Active' : filters.status === '0' ? 'Inactive' : 'All';

  return (
    <View style={[styles.container, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      {/* Search Input */}
      <View style={[styles.inputGroup, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Search by student name or roll..."
          placeholderTextColor={colors.textMuted}
          value={filters.name}
          onChangeText={(val) => onChangeFilters({ ...filters, name: val })}
        />
        {filters.name.length > 0 && (
          <TouchableOpacity onPress={() => onChangeFilters({ ...filters, name: '' })}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Selectors Grid */}
      <View style={styles.gridRow}>
        {/* Class Selector */}
        <View style={styles.gridItem}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Class</Text>
          <TouchableOpacity style={[styles.selectorBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={onOpenClass}>
            <Text style={[styles.selectorText, { color: colors.text }]} numberOfLines={1}>{classText}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Section Selector */}
        <View style={styles.gridItem}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Section</Text>
          <TouchableOpacity style={[styles.selectorBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} onPress={onOpenSection}>
            <Text style={[styles.selectorText, { color: colors.text }]} numberOfLines={1}>{sectionText}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.gridRow}>
        {/* Status Selector */}
        <View style={styles.gridItem}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Status</Text>
          <Menu>
            <MenuTrigger>
              <View style={[styles.selectorBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                <Text style={[styles.selectorText, { color: colors.text }]}>{statusText}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
              </View>
            </MenuTrigger>
            <MenuOptions customStyles={{
              optionsContainer: [styles.menuOptionsContainer, { backgroundColor: colors.cardBg, borderColor: colors.border }],
            }}>
              <MenuOption onSelect={() => onChangeFilters({ ...filters, status: '' })}>
                <Text style={[styles.menuOptionText, { color: colors.text }]}>All Status</Text>
              </MenuOption>
              <MenuOption onSelect={() => onChangeFilters({ ...filters, status: '1' })}>
                <Text style={[styles.menuOptionText, { color: colors.text }]}>Active</Text>
              </MenuOption>
              <MenuOption onSelect={() => onChangeFilters({ ...filters, status: '0' })}>
                <Text style={[styles.menuOptionText, { color: colors.text }]}>Inactive</Text>
              </MenuOption>
            </MenuOptions>
          </Menu>
        </View>

        {/* Date Selector */}
        <View style={styles.gridItem}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Admission Date</Text>
          <TouchableOpacity 
            style={[styles.selectorBtn, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]} 
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={[styles.selectorText, { color: colors.text }]} numberOfLines={1}>
              {filters.date ? filters.date : 'Any Date'}
            </Text>
            <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={filters.date ? new Date(filters.date) : new Date()}
          mode="date"
          display="default"
          onChange={handleDateChange}
        />
      )}

      {/* Filter Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.clearBtn, { borderColor: colors.border }]} onPress={onClear}>
          <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.clearBtnText, { color: colors.textMuted }]}>Reset</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.searchBtn, { backgroundColor: colors.primary }]} onPress={onSearch}>
          <Ionicons name="funnel" size={16} color="#fff" />
          <Text style={styles.searchBtnText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    marginBottom: 14,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  gridItem: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  selectorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  menuOptionsContainer: {
    borderRadius: 10,
    marginTop: 35,
    padding: 6,
    width: 140,
    borderWidth: 1,
  },
  menuOptionText: {
    fontSize: 13,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    gap: 10,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  searchBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 8,
  },
  searchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
