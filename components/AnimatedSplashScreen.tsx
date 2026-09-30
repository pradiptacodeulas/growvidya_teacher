import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { useAppTheme } from '@/constants/theme';

interface AnimatedSplashScreenProps {
  onAnimationFinish: () => void;
}

export default function AnimatedSplashScreen({ onAnimationFinish }: AnimatedSplashScreenProps) {
  const { isDark } = useAppTheme();

  useEffect(() => {
    // Hold static logo on screen for 2 seconds before advancing
    const timer = setTimeout(() => {
      onAnimationFinish();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onAnimationFinish]);

  const logoSource = isDark
    ? require('../assets/images/logo_dark.png')
    : require('../assets/images/logo_light.png');

  const backgroundColor = isDark ? '#0F172A' : '#FFFFFF';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.logoContainer}>
        <Image
          source={logoSource}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '75%',
    maxWidth: 280,
  },
  logo: {
    width: '100%',
    height: 120,
  },
});
