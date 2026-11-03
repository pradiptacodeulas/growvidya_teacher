import React from 'react';
import { StyleSheet, View } from 'react-native';
import InternalHeader from '@/components/InternalHeader';
import RoutineView from '@/components/RoutineView';
import { useAppTheme } from '@/constants/theme';

export default function RoutineScreen() {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <InternalHeader title="Class Routine" />
      <RoutineView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
