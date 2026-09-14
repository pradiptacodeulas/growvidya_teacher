import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import { useRouter, usePathname } from 'expo-router';
import { Alert } from 'react-native';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import { logout } from '@/redux/features/auth/slice';
import Toast from 'react-native-toast-message';
import { useAppTheme } from '@/constants/theme';
import { getAvatarUrl } from '@/services/apiClient';

interface DrawerNavItemProps {
  label: string;
  iconName: any;
  onPress?: () => void;
  isActive?: boolean;
  isDropdown?: boolean;
  isExpanded?: boolean;
  onToggleDropdown?: () => void;
}

const DrawerNavItem: React.FC<DrawerNavItemProps> = ({
  label,
  iconName,
  onPress,
  isActive = false,
  isDropdown = false,
  isExpanded = false,
  onToggleDropdown,
}) => {
  const { colors } = useAppTheme();
  const activeColor = colors.primary;
  const inactiveColor = colors.textSecondary;
  const iconColor = isActive || isExpanded ? activeColor : colors.textMuted;
  const textColor = isActive || isExpanded ? activeColor : inactiveColor;
  
  const content = (
    <View style={[
      styles.navItemContainer,
      isActive && { backgroundColor: colors.primaryLight }
    ]}>
      <View style={styles.navItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={iconName} size={22} color={iconColor} />
        </View>
        <Text style={[
          styles.navItemLabel,
          { color: textColor },
          isActive && styles.navItemLabelActive
        ]}>
          {label}
        </Text>
      </View>
      {isDropdown && (
        <Ionicons 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
          size={18} 
          color={isExpanded ? activeColor : colors.textMuted} 
        />
      )}
    </View>
  );

  return (
    <TouchableOpacity 
      onPress={isDropdown ? onToggleDropdown : onPress}
      activeOpacity={0.7}
    >
      {content}
    </TouchableOpacity>
  );
};

interface DrawerSubNavItemProps {
  label: string;
  onPress: () => void;
  isActive?: boolean;
}

const DrawerSubNavItem: React.FC<DrawerSubNavItemProps> = ({
  label,
  onPress,
  isActive = false,
}) => {
  const { colors } = useAppTheme();
  const activeColor = colors.primary;
  const inactiveColor = colors.textSecondary;
  const textColor = isActive ? activeColor : inactiveColor;

  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.subNavItemContainer,
        isActive && { backgroundColor: colors.primaryLight }
      ]}
    >
      <Text style={[
        styles.subNavItemLabel,
        { color: textColor },
        isActive && styles.subNavItemLabelActive
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

function CustomDrawerContent(props: any) {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const user = useAppSelector(state => state.auth.user);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const getNormalizedPath = (path: string) => {
    return path.replace(/\/\([^)]+\)/g, '');
  };

  const isActive = (path: string) => {
    const cleanCurrent = getNormalizedPath(pathname);
    const cleanTarget = getNormalizedPath(path);
    return cleanCurrent === cleanTarget;
  };

  const isSectionActive = (sectionKey: string) => {
    const cleanCurrent = getNormalizedPath(pathname);
    switch (sectionKey) {
      case 'ward':
        return cleanCurrent === '/ward';
      case 'academic':
        return ['/academic/routine', '/academic/study-material', '/academic/syllabus', '/academic/assignment'].includes(cleanCurrent);
      case 'attendance':
        return cleanCurrent === '/attendance';
      case 'exam':
        return ['/examination/schedule', '/examination/attendance', '/examination/results', '/examination/add-marks'].includes(cleanCurrent);
      case 'payroll':
        return cleanCurrent === '/payroll';
      case 'leaves':
        return cleanCurrent === '/leaves';
      case 'transport':
        return cleanCurrent === '/transport';
      case 'hostel':
        return cleanCurrent === '/hostel';
      case 'announcement':
        return ['/announcement/notice', '/announcement/event', '/announcement/holiday'].includes(cleanCurrent);
      default:
        return false;
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const navigateTo = (path: string) => {
    props.navigation.closeDrawer();
    router.navigate(path as any);
  };

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
            props.navigation.closeDrawer();
            dispatch(logout());
            router.replace('/(auth)/login');
            Toast.show({
              type: 'success',
              text1: 'Logged out successfully',
              text2: 'See you again soon!',
            });
          }
        },
      ]
    );
  };

  useEffect(() => {
    const sections = ['ward', 'academic', 'attendance', 'exam', 'payroll', 'leaves', 'transport', 'hostel', 'announcement'];
    for (const section of sections) {
      if (isSectionActive(section)) {
        setExpandedSection(section);
        break;
      }
    }
  }, [pathname]);

  const { colors } = useAppTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* School Header Section */}
      <View style={[styles.schoolHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.avatarContainer, { backgroundColor: colors.primaryLight }]}>
          <Image 
            source={{ uri: getAvatarUrl(user?.picture, user?.gender) }} 
            style={styles.userAvatar} 
          />
        </View>
        <View style={styles.schoolInfo}>
          <Text style={[styles.schoolName, { color: colors.text }]}>{user ? `${user.first_name} ${user.last_name}` : 'Growvidya Academy'}</Text>
          <Text style={[styles.schoolTagline, { color: colors.textMuted }]}>{user?.school_name || 'Education for Excellence'}</Text>
        </View>
      </View>

      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0, backgroundColor: colors.surface }}>
        {/* Dashboard - Flat */}
        <DrawerNavItem
          label="Dashboard"
          iconName="grid-outline"
          isActive={isActive('/(main)/(drawer)/(tabs)')}
          onPress={() => navigateTo('/(main)/(drawer)/(tabs)')}
        />

        {/* Ward [Students] Dropdown */}
        <DrawerNavItem
          label="Ward"
          iconName="people-outline"
          isDropdown
          isExpanded={expandedSection === 'ward'}
          onToggleDropdown={() => toggleSection('ward')}
        />
        {expandedSection === 'ward' && (
          <View style={[styles.subItemContainer, { backgroundColor: colors.surfaceSubtle }]}>
            <DrawerSubNavItem
              label="Students"
              isActive={isActive('/(main)/(drawer)/ward')}
              onPress={() => navigateTo('/(main)/(drawer)/ward')}
            />
          </View>
        )}

        {/* Academic Dropdown */}
        <DrawerNavItem
          label="Academic"
          iconName="school-outline"
          isDropdown
          isExpanded={expandedSection === 'academic'}
          onToggleDropdown={() => toggleSection('academic')}
        />
        {expandedSection === 'academic' && (
          <View style={[styles.subItemContainer, { backgroundColor: colors.surfaceSubtle }]}>
            <DrawerSubNavItem
              label="Routine"
              isActive={isActive('/(main)/(drawer)/academic/routine')}
              onPress={() => navigateTo('/(main)/(drawer)/academic/routine')}
            />
            <DrawerSubNavItem
              label="Study Material"
              isActive={isActive('/(main)/(drawer)/academic/study-material')}
              onPress={() => navigateTo('/(main)/(drawer)/academic/study-material')}
            />
            <DrawerSubNavItem
              label="Syllabus"
              isActive={isActive('/(main)/(drawer)/academic/syllabus')}
              onPress={() => navigateTo('/(main)/(drawer)/academic/syllabus')}
            />
            <DrawerSubNavItem
              label="Assignment"
              isActive={isActive('/(main)/(drawer)/academic/assignment')}
              onPress={() => navigateTo('/(main)/(drawer)/academic/assignment')}
            />
          </View>
        )}

        {/* Attendance Dropdown */}
        <DrawerNavItem
          label="Attendance"
          iconName="checkbox-outline"
          isDropdown
          isExpanded={expandedSection === 'attendance'}
          onToggleDropdown={() => toggleSection('attendance')}
        />
        {expandedSection === 'attendance' && (
          <View style={[styles.subItemContainer, { backgroundColor: colors.surfaceSubtle }]}>
            <DrawerSubNavItem
              label="Student Attendance"
              isActive={isActive('/(main)/(drawer)/attendance')}
              onPress={() => navigateTo('/(main)/(drawer)/attendance')}
            />
          </View>
        )}

        {/* Examination Dropdown */}
        <DrawerNavItem
          label="Examination"
          iconName="document-outline"
          isDropdown
          isExpanded={expandedSection === 'exam'}
          onToggleDropdown={() => toggleSection('exam')}
        />
        {expandedSection === 'exam' && (
          <View style={[styles.subItemContainer, { backgroundColor: colors.surfaceSubtle }]}>
            <DrawerSubNavItem
              label="Exam Schedule"
              isActive={isActive('/(main)/(drawer)/examination/schedule')}
              onPress={() => navigateTo('/(main)/(drawer)/examination/schedule')}
            />
            <DrawerSubNavItem
              label="Exam Attendance"
              isActive={isActive('/(main)/(drawer)/examination/attendance')}
              onPress={() => navigateTo('/(main)/(drawer)/examination/attendance')}
            />
            <DrawerSubNavItem
              label="Exam Results"
              isActive={isActive('/(main)/(drawer)/examination/results')}
              onPress={() => navigateTo('/(main)/(drawer)/examination/results')}
            />
          </View>
        )}

        {/* Payroll Dropdown */}
        <DrawerNavItem
          label="Payroll"
          iconName="cash-outline"
          isDropdown
          isExpanded={expandedSection === 'payroll'}
          onToggleDropdown={() => toggleSection('payroll')}
        />
        {expandedSection === 'payroll' && (
          <View style={[styles.subItemContainer, { backgroundColor: colors.surfaceSubtle }]}>
            <DrawerSubNavItem
              label="My Salary"
              isActive={isActive('/(main)/(drawer)/payroll')}
              onPress={() => navigateTo('/(main)/(drawer)/payroll')}
            />
          </View>
        )}

        {/* Leaves Dropdown */}
        <DrawerNavItem
          label="Leaves Application"
          iconName="exit-outline"
          isDropdown
          isExpanded={expandedSection === 'leaves'}
          onToggleDropdown={() => toggleSection('leaves')}
        />
        {expandedSection === 'leaves' && (
          <View style={[styles.subItemContainer, { backgroundColor: colors.surfaceSubtle }]}>
            <DrawerSubNavItem
              label="My Leave"
              isActive={isActive('/(main)/(drawer)/leaves')}
              onPress={() => navigateTo('/(main)/(drawer)/leaves')}
            />
          </View>
        )}

        {/* Transport Dropdown */}
        <DrawerNavItem
          label="Transport"
          iconName="bus-outline"
          isDropdown
          isExpanded={expandedSection === 'transport'}
          onToggleDropdown={() => toggleSection('transport')}
        />
        {expandedSection === 'transport' && (
          <View style={[styles.subItemContainer, { backgroundColor: colors.surfaceSubtle }]}>
            <DrawerSubNavItem
              label="My Transport"
              isActive={isActive('/(main)/(drawer)/transport')}
              onPress={() => navigateTo('/(main)/(drawer)/transport')}
            />
          </View>
        )}

        {/* Hostel Dropdown */}
        <DrawerNavItem
          label="Hostel"
          iconName="business-outline"
          isDropdown
          isExpanded={expandedSection === 'hostel'}
          onToggleDropdown={() => toggleSection('hostel')}
        />
        {expandedSection === 'hostel' && (
          <View style={[styles.subItemContainer, { backgroundColor: colors.surfaceSubtle }]}>
            <DrawerSubNavItem
              label="My Hostel"
              isActive={isActive('/(main)/(drawer)/hostel')}
              onPress={() => navigateTo('/(main)/(drawer)/hostel')}
            />
          </View>
        )}

        {/* Announcement Dropdown */}
        <DrawerNavItem
          label="Announcement"
          iconName="notifications-outline"
          isDropdown
          isExpanded={expandedSection === 'announcement'}
          onToggleDropdown={() => toggleSection('announcement')}
        />
        {expandedSection === 'announcement' && (
          <View style={[styles.subItemContainer, { backgroundColor: colors.surfaceSubtle }]}>
            <DrawerSubNavItem
              label="Notice"
              isActive={isActive('/(main)/(drawer)/announcement/notice')}
              onPress={() => navigateTo('/(main)/(drawer)/announcement/notice')}
            />
            <DrawerSubNavItem
              label="Event"
              isActive={isActive('/(main)/(drawer)/announcement/event')}
              onPress={() => navigateTo('/(main)/(drawer)/announcement/event')}
            />
            <DrawerSubNavItem
              label="Holiday"
              isActive={isActive('/(main)/(drawer)/announcement/holiday')}
              onPress={() => navigateTo('/(main)/(drawer)/announcement/holiday')}
            />
          </View>
        )}

        {/* Settings - Flat */}
        <DrawerNavItem
          label="Settings"
          iconName="settings-outline"
          isActive={isActive('/(main)/(drawer)/settings')}
          onPress={() => navigateTo('/(main)/(drawer)/settings')}
        />

        {/* Logout - Flat */}
        <View style={[styles.logoutWrapper, { borderTopColor: colors.border }]}>
          <DrawerNavItem
            label="Logout"
            iconName="log-out-outline"
            onPress={handleLogout}
          />
        </View>
      </DrawerContentScrollView>
    </View>
  );
}

export default function DrawerLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Drawer
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerShown: false,
          drawerActiveTintColor: '#2f95dc',
          drawerStyle: {
            width: 280,
          },
        }}
      >
        {/* All routes hidden from default list */}
        <Drawer.Screen name="(tabs)" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="ward" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="academic/routine" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="academic/study-material" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="academic/syllabus" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="academic/assignment" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="academic/assignment-sections" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="academic/assignment-subjects" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="academic/assignment-details" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="academic/add-assignment" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="attendance" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="take-attendance" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="examination/schedule" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="examination/attendance" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="examination/results" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="examination/add-marks" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="payroll" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="leaves" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="apply-leave" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="transport" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="hostel" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="announcement/notice" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="announcement/event" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="announcement/holiday" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="dashboard" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="settings" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="profile-edit" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="student/[id]" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="student/personal" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="student/parents" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="student/siblings" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="student/address" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="student/transport" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="student/hostel" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="student/documents" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="student/medical" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="student/previous-school" options={{ drawerItemStyle: { display: 'none' } }} />
        <Drawer.Screen name="student/activity" options={{ drawerItemStyle: { display: 'none' } }} />
      </Drawer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  schoolHeader: {
    paddingVertical: 20,
    paddingHorizontal: 12,
    paddingTop: 65,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  schoolTagline: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  navItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    marginVertical: 2,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: 'rgba(47, 149, 220, 0.08)',
  },
  navItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  navItemLabelActive: {
    fontWeight: '700',
  },
  subItemContainer: {
    paddingVertical: 2,
  },
  subNavItemContainer: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    paddingLeft: 40, // Align sub-item label to main item label (8 + 24 + 8 = 40)
    marginHorizontal: 4,
    marginVertical: 1,
    borderRadius: 8,
  },
  subNavItemActive: {
    backgroundColor: 'rgba(47, 149, 220, 0.05)',
  },
  subNavItemLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  subNavItemLabelActive: {
    fontWeight: '600',
  },
  logoutWrapper: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
});
