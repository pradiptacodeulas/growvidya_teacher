import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/constants/theme';
import { getAvatarUrl } from '@/services/apiClient';

export interface ContactType {
  id: string | number;
  name: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  picture?: string | null;
  image?: any;
  phone?: string;
  email?: string;
  designation?: string;
  child_name?: string;
  class_name?: string;
  section_name?: string;
  code?: string;
  last_message?: string | null;
  lastMessage?: string | null;
  last_message_time?: string | null;
  time?: string | null;
  last_message_seen?: number | null;
  last_message_is_outgoing?: boolean;
  unread_count?: number;
  unread?: number;
  is_online?: boolean;
}

const ContactCard = ({ contact }: { contact: ContactType }) => {
  const router = useRouter();
  const { colors, isDark } = useAppTheme();
  const [imageError, setImageError] = useState(false);

  // Generate initials for avatar placeholder
  const initials = (contact.name || 'User')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || 'U';

  const formatTime = (timeStr?: string | null) => {
    if (!timeStr) return '';
    try {
      const d = new Date(timeStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return timeStr;
      const now = new Date();
      const isToday =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return timeStr || '';
    }
  };

  const getRoleBadgeStyle = (role?: string) => {
    const r = (role || '').toLowerCase();
    switch (r) {
      case 'admin':
        return { bg: isDark ? 'rgba(59, 130, 246, 0.2)' : '#EFF6FF', text: '#2563EB', label: 'Admin' };
      case 'parent':
        return { bg: isDark ? 'rgba(16, 185, 129, 0.2)' : '#ECFDF5', text: '#059669', label: 'Parent' };
      case 'student':
        return { bg: isDark ? 'rgba(139, 92, 246, 0.2)' : '#F5F3FF', text: '#7C3AED', label: 'Student' };
      case 'teacher':
        return { bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FFFBEB', text: '#D97706', label: 'Faculty' };
      default:
        return { bg: colors.surfaceSubtle, text: colors.textMuted, label: 'Contact' };
    }
  };

  const getSubText = () => {
    switch ((contact.role || '').toLowerCase()) {
      case 'admin':
        return contact.designation || 'School Administration';
      case 'student':
        const studentInfo = [];
        if (contact.class_name) studentInfo.push(`Class ${contact.class_name}`);
        if (contact.section_name) studentInfo.push(`${contact.section_name}`);
        return studentInfo.length > 0 ? `Student • ${studentInfo.join('-')}` : 'Student';
      case 'parent':
        return contact.child_name ? `Parent of ${contact.child_name}` : 'Parent';
      case 'teacher':
        return 'Colleague • Faculty';
      default:
        return 'Contact';
    }
  };

  const displayPicture = contact.picture || contact.image;
  const avatarUri = displayPicture ? getAvatarUrl(displayPicture, undefined) : null;
  const unreadBadge = contact.unread_count || contact.unread || 0;
  const latestMessage = contact.last_message || contact.lastMessage || `${getSubText()} • Tap to chat`;
  const messageTime = formatTime(contact.last_message_time || contact.time);
  const badgeStyle = getRoleBadgeStyle(contact.role);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.cardContainer, { backgroundColor: colors.cardBg, borderBottomColor: colors.border }]}
      onPress={() =>
        router.push({
          pathname: '/chat/[id]',
          params: {
            id: String(contact.id),
            role: (contact.role || 'parent').toLowerCase(),
            name: contact.name,
            picture: displayPicture || '',
            phone: contact.phone || '',
            email: contact.email || '',
            designation: contact.designation || '',
            child_name: contact.child_name || '',
            class_name: contact.class_name || '',
            section_name: contact.section_name || '',
            code: contact.code || '',
          },
        })
      }
    >
      <View style={styles.avatarSection}>
        {avatarUri && !imageError ? (
          <Image
            source={{ uri: avatarUri }}
            style={[styles.avatar, { backgroundColor: colors.surfaceSubtle }]}
            onError={() => setImageError(true)}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.placeholderAvatar, { backgroundColor: colors.badgeBg, borderColor: colors.border }]}>
            <Text style={[styles.initialsText, { color: colors.primary }]}>{initials}</Text>
          </View>
        )}
        <View
          style={[
            styles.statusDot,
            {
              borderColor: colors.cardBg,
              backgroundColor: contact.is_online ? '#22C55E' : '#94A3B8',
            },
          ]}
        />
      </View>

      <View style={styles.infoSection}>
        <View style={styles.nameRow}>
          <View style={styles.nameWithBadge}>
            <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={1}>
              {contact.name}
            </Text>
            <View style={[styles.rolePill, { backgroundColor: badgeStyle.bg }]}>
              <Text style={[styles.rolePillText, { color: badgeStyle.text }]}>
                {badgeStyle.label}
              </Text>
            </View>
          </View>
          {messageTime ? (
            <Text style={[styles.timeText, { color: unreadBadge > 0 ? colors.primary : colors.textMuted }]}>
              {messageTime}
            </Text>
          ) : null}
        </View>

        <View style={styles.messageRow}>
          <Text
            style={[
              styles.messageText,
              { color: unreadBadge > 0 ? colors.text : colors.textSecondary },
              unreadBadge > 0 && { fontWeight: '700' },
            ]}
            numberOfLines={1}
          >
            {latestMessage}
          </Text>
          {unreadBadge > 0 ? (
            <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.badgeText}>{unreadBadge > 99 ? '99+' : unreadBadge}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.actionSection}>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

export default ContactCard;

const styles = StyleSheet.create({
  cardContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  avatarSection: {
    position: 'relative',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
  },
  placeholderAvatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  initialsText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  statusDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2.5,
  },
  infoSection: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    gap: 6,
  },
  nameText: {
    fontSize: 16,
    fontWeight: '800',
    maxWidth: '70%',
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageText: {
    fontSize: 13,
    flex: 1,
    marginRight: 10,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  actionSection: {
    marginLeft: 8,
  },
});
