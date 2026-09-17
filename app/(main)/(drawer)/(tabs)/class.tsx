import React from 'react';
import { StyleSheet, View } from 'react-native';
import RoutineView from '@/components/RoutineView';

export default function ClassScreen() {
  return (
    <View style={styles.container}>
      <RoutineView showTitleBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
});

