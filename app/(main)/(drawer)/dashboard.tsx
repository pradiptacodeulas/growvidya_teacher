import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import InternalHeader from '@/components/InternalHeader';

export default function DashboardScreen() {
  return (
    <View style={styles.container}>
      <InternalHeader title="Dashboard" />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.placeholder}>
          <Text style={styles.text}>Main Dashboard Coming Soon</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    padding: 20,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  text: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
});
