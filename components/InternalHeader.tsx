import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/constants/theme';

interface InternalHeaderProps {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export default function InternalHeader({ title, onBack, rightAction }: InternalHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useAppTheme();

  return (
    <View style={[
      styles.headerContainer,
      {
        paddingTop: insets.top,
        backgroundColor: colors.headerBg,
        borderBottomColor: colors.border,
      }
    ]}>
      <View style={styles.headerContent}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={onBack ? onBack : () => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color={colors.icon} />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={[styles.titleText, { color: colors.text }]}>{title}</Text>
        </View>

        <View style={styles.rightContainer}>
          {rightAction ? rightAction : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    borderBottomWidth: 1,
  },
  headerContent: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  backButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 18,
    fontWeight: '700',
  },
  rightContainer: {
    minWidth: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
});
