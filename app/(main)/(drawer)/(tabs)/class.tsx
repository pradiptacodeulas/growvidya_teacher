import React from 'react';
import { StyleSheet, View } from 'react-native';
import RoutineView from '@/components/RoutineView';
import { useAppTheme } from '@/constants/theme';

export default function ClassScreen() {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <RoutineView showTitleBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
