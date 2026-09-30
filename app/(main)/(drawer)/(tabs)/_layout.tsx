import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '@/components/AppHeader';
import { useAppTheme } from '@/constants/theme';
import { Platform } from 'react-native';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { fetchUnreadCount } from '@/redux/features/chat/slice';

export default function TabLayout() {
  const { colors } = useAppTheme();
  const dispatch = useAppDispatch();
  const unreadCount = useAppSelector((state) => state.chat?.unreadCount || 0);
  const token = useAppSelector((state) => state.auth?.token);

  useEffect(() => {
    if (token) {
      dispatch(fetchUnreadCount());
    }
  }, [token, dispatch]);

  return (
    <Tabs 
      screenOptions={{ 
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: true,
        header: () => <AppHeader />,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: Platform.OS === 'ios' ? 0 : 4,
        },
        tabBarStyle: { 
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
          height: Platform.OS === 'ios' ? 64 : 84,
          paddingTop: 8,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'home' : 'home-outline'} 
              size={size || 24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="class"
        options={{
          title: 'Class',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'school' : 'school-outline'} 
              size={size || 24} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="message"
        options={{
          title: 'Message',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'} 
              size={size || 24} 
              color={color} 
            />
          ),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            lineHeight: Platform.OS === 'android' ? 17 : undefined,
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons 
              name={focused ? 'person-circle' : 'person-circle-outline'} 
              size={size || 24} 
              color={color} 
            />
          ),
        }}
      />
    </Tabs>
  );
}
