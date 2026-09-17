import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import InternalHeader from '@/components/InternalHeader';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, ThemeMode } from '@/constants/theme';

export default function SettingsScreen() {
  const { themeMode, colors, setTheme } = useAppTheme();

  const themeOptions: { 
    id: ThemeMode; 
    label: string; 
    icon: keyof typeof Ionicons.glyphMap;
  }[] = [
    {
      id: 'light',
      label: 'Light',
      icon: 'sunny-outline',
    },
    {
      id: 'dark',
      label: 'Dark',
      icon: 'moon-outline',
    },
    {
      id: 'automatic',
      label: 'System',
      icon: 'hardware-chip-outline',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Settings" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            APPEARANCE
          </Text>

          {/* Ultra-Sleek Native Segmented Control */}
          <View style={[styles.segmentedTrack, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            {themeOptions.map((option) => {
              const isSelected = themeMode === option.id;

              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.segmentButton,
                    isSelected && [
                      styles.activeSegment,
                      { backgroundColor: colors.surface, borderColor: colors.border }
                    ]
                  ]}
                  onPress={() => setTheme(option.id)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={option.icon}
                    size={16}
                    color={isSelected ? colors.primary : colors.textMuted}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[
                    styles.segmentText,
                    { color: isSelected ? colors.primary : colors.textMuted },
                    isSelected && styles.activeSegmentText
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Footer App Version */}
        <View style={styles.footerContainer}>
          <Text style={[styles.appNameText, { color: colors.text }]}>
            GrowVidya Teacher App
          </Text>
          <Text style={[styles.versionText, { color: colors.textMuted }]}>
            Version 1.0.4 • Build 2026.07
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 2,
  },
  segmentedTrack: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
  },
  activeSegment: {
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  activeSegmentText: {
    fontWeight: '700',
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 'auto',
  },
  appNameText: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 3,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
