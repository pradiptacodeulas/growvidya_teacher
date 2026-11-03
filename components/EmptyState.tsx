import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

interface EmptyStateProps {
  message?: string;
  subMessage?: string;
}

export default function EmptyState({ 
  message = "No Data Found", 
  subMessage,
}: EmptyStateProps) {
  const showSub = Boolean(subMessage && subMessage.trim() && subMessage.trim().toLowerCase() !== message.trim().toLowerCase());

  return (
    <View style={styles.container}>
      <LottieView
        autoPlay
        loop
        style={styles.lottie}
        source={require('../assets/lottiefiles/empty_state.json')}
      />
      <Text style={styles.message}>{message}</Text>
      {showSub && <Text style={styles.subMessage}>{subMessage}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  lottie: {
    width: 250,
    height: 250,
  },
  message: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    textAlign: 'center',
  },
  subMessage: {
    fontSize: 14,
    color: '#777',
    marginTop: 8,
    textAlign: 'center',
  },
});
