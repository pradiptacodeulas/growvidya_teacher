import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AppHeader from '@/components/AppHeader';
import { useAppTheme } from '@/constants/theme';
import { Platform } from 'react-native';
import { useAppSelector } from '@/redux/hooks';

export default function TabLayout() {
  const { colors } = useAppTheme();
  const unreadCount = useAppSelector((state) => state.chat?.unreadCount || 0);

  return (
    <Tabs 
      screenOptions={{ 
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        headerShown: true,
        header: () => <AppHeader />,
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
          tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="class"
        options={{
          title: 'Class',
          tabBarIcon: ({ color }) => <Ionicons name="school" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="message"
        options={{
          title: 'Message',
          tabBarIcon: ({ color }) => <Ionicons name="mail" size={24} color={color} />,
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
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
