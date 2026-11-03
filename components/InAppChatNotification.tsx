import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/constants/theme';

export interface InAppChatNotificationProps {
  senderName?: string;
  message?: string;
  avatarUrl?: string | null;
  senderRole?: string;
  time?: string;
  onPress?: () => void;
  onClose?: () => void;
}

export default function InAppChatNotification({
  senderName = 'New Message',
  message = '',
  avatarUrl,
  senderRole,
  time = 'Just now',
  onPress,
  onClose,
}: InAppChatNotificationProps) {
  const { colors, isDark } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [imageError, setImageError] = useState(false);

  // Calculate reliable explicit card width
  const cardWidth = Math.min(windowWidth - 24, 460);

  // Role-based badge styling
  const normalizedRole = String(senderRole || '').toLowerCase();
  const getRoleBadge = () => {
    switch (normalizedRole) {
      case 'parent':
        return {
          label: 'Parent',
          bg: isDark ? '#143823' : '#E8F5E9',
          color: '#2E7D32',
          icon: 'people' as const,
        };
      case 'student':
        return {
          label: 'Student',
          bg: isDark ? '#162C4E' : '#E3F2FD',
          color: '#1565C0',
          icon: 'school' as const,
        };
      case 'admin':
      case 'super admin':
        return {
          label: 'Admin',
          bg: isDark ? '#321D48' : '#F3E5F5',
          color: '#7B1FA2',
          icon: 'shield-checkmark' as const,
        };
      default:
        return {
          label: senderRole ? senderRole.charAt(0).toUpperCase() + senderRole.slice(1) : 'Staff',
          bg: isDark ? '#333333' : '#F1F3F5',
          color: colors.textSecondary,
          icon: 'chatbubble-ellipses' as const,
        };
    }
  };

  const badge = getRoleBadge();

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onPress={onPress}
      style={[
        styles.container,
        {
          width: cardWidth,
          backgroundColor: isDark ? '#1E2430' : '#FFFFFF',
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          shadowColor: isDark ? '#000000' : '#0F172A',
        },
      ]}
    >
      {/* Left: Avatar with online dot */}
      <View style={styles.avatarWrapper}>
        {avatarUrl && !imageError ? (
          <Image
            source={{ uri: avatarUrl }}
            style={styles.avatar}
            onError={() => setImageError(true)}
          />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              { backgroundColor: badge.bg },
            ]}
          >
            <Ionicons name={badge.icon} size={22} color={badge.color} />
          </View>
        )}
        <View
          style={[
            styles.onlineDot,
            { borderColor: isDark ? '#1E2430' : '#FFFFFF' },
          ]}
        />
      </View>

      {/* Center: Details & Message Preview */}
      <View style={styles.contentContainer}>
        <View style={styles.topRow}>
          <Text
            numberOfLines={1}
            style={[styles.senderName, { color: colors.text }]}
          >
            {senderName}
          </Text>
          <View style={[styles.roleBadge, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon} size={10} color={badge.color} style={{ marginRight: 3 }} />
            <Text style={[styles.roleText, { color: badge.color }]}>
              {badge.label}
            </Text>
          </View>
        </View>

        <Text
          numberOfLines={2}
          style={[styles.messageText, { color: colors.textSecondary }]}
        >
          {message}
        </Text>

        <View style={styles.footerRow}>
          <Text style={[styles.timeText, { color: colors.textMuted }]}>
            {time}
          </Text>
          <View style={styles.tapToReply}>
            <Text style={[styles.tapToReplyText, { color: colors.primary }]}>
              Reply
            </Text>
            <Ionicons name="chevron-forward" size={12} color={colors.primary} />
          </View>
        </View>
      </View>

      {/* Right: Dismiss Close Button */}
      {onClose && (
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={onClose}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          style={[
            styles.closeButton,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' },
          ]}
        >
          <Ionicons name="close" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.14,
        shadowRadius: 14,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  senderName: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  tapToReply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tapToReplyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
});
