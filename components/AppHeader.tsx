import React from 'react';
import { View, StyleSheet, Image, Text, Platform, Alert, TouchableOpacity } from 'react-native';
import { DrawerToggleButton } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Menu,
  MenuOptions,
  MenuOption,
  MenuTrigger,
} from 'react-native-popup-menu';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/constants/theme';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { logout } from '@/redux/features/auth/slice';
import Toast from 'react-native-toast-message';

export default function AppHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { colors, isDark } = useAppTheme();
  const unreadCount = useAppSelector((state) => state.chat?.unreadCount || 0);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => {
            dispatch(logout());
            router.replace('/(auth)/login');
            Toast.show({
              type: 'success',
              text1: 'Logged Out',
              text2: 'You have been logged out successfully.',
            });
          }
        },
      ]
    );
  };

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
        <View style={styles.leftContainer}>
          <DrawerToggleButton tintColor={colors.icon} />
        </View>

        <View style={styles.centerContainer}>
          <Image
            source={isDark ? require('../assets/images/logo_dark.png') : require('../assets/images/logo_light.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <View style={styles.rightContainer}>
          <TouchableOpacity
            style={[styles.headerIconButton, { backgroundColor: colors.surfaceSubtle }]}
            onPress={() => router.push('/(main)/(drawer)/(tabs)/message')}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubbles-outline" size={20} color={colors.icon} />
            {unreadCount > 0 && (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <Menu>
            <MenuTrigger customStyles={triggerStyles}>
              <View style={[styles.triggerCircle, { backgroundColor: colors.surfaceSubtle }]}>
                <Ionicons name="ellipsis-vertical" size={20} color={colors.icon} />
              </View>
            </MenuTrigger>

            <MenuOptions customStyles={{
              optionsContainer: [
                styles.optionsContainer, 
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  shadowColor: colors.shadowColor,
                }
              ],
            }}>
              <MenuOption onSelect={() => router.push('/(main)/(drawer)/(tabs)/profile')}>
                <View style={styles.menuOptionRow}>
                  <View style={[styles.optionIconBox, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="person-outline" size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.optionText, { color: colors.text }]}>Profile</Text>
                </View>
              </MenuOption>

              <MenuOption onSelect={() => router.push('/(main)/(drawer)/settings')}>
                <View style={styles.menuOptionRow}>
                  <View style={[styles.optionIconBox, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="settings-outline" size={16} color={colors.primary} />
                  </View>
                  <Text style={[styles.optionText, { color: colors.text }]}>Settings</Text>
                </View>
              </MenuOption>


              <View style={[styles.divider, { backgroundColor: colors.border }]} />

              <MenuOption onSelect={handleLogout}>
                <View style={styles.menuOptionRow}>
                  <View style={[styles.optionIconBox, { backgroundColor: '#FEE2E2' }]}>
                    <Ionicons name="log-out-outline" size={16} color="#EF4444" />
                  </View>
                  <Text style={[styles.optionText, { color: '#EF4444', fontWeight: '700' }]}>Logout</Text>
                </View>
              </MenuOption>
            </MenuOptions>
          </Menu>
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
  leftContainer: {
    width: 76,
    alignItems: 'flex-start',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightContainer: {
    width: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  headerBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  triggerCircle: {
    width: 36,

    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    height: 32,
    width: 140,
  },
  divider: {
    height: 1,
    marginVertical: 4,
  },
  menuOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  optionIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  optionsContainer: {
    borderRadius: 14,
    marginTop: 42,
    width: 180,
    padding: 6,
    borderWidth: 1,
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
});

const triggerStyles = {
  triggerWrapper: {
    padding: 4,
  },
};
