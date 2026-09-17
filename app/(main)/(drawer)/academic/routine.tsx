import React from 'react';
import { StyleSheet, View } from 'react-native';
import InternalHeader from '@/components/InternalHeader';
import RoutineView from '@/components/RoutineView';

export default function RoutineScreen() {
  return (
    <View style={styles.container}>
      <InternalHeader title="Class Routine" />
      <RoutineView />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
});

