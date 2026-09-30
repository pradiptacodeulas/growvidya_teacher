import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/constants/theme';
import { getAvatarInitials, isNonEmptyPicture } from '@/utils/avatar';

interface ProfileCardProps {
  name: string;
  firstName?: string;
  lastName?: string;
  id?: string;
  className?: string;
  roleName?: string;
  subjectName?: string;
  avatarUrl?: string;
  onEditPress?: () => void;
}

export default function ProfileCard({ 
  name, 
  firstName,
  lastName,
  id, 
  className, 
  roleName,
  subjectName,
  avatarUrl, 
  onEditPress 
}: ProfileCardProps) {
  const { colors } = useAppTheme();
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [avatarUrl]);

  const initials = getAvatarInitials(name, firstName, lastName);
  const hasValidPicture = isNonEmptyPicture(avatarUrl);
  const showImage = hasValidPicture && !imageError;

  const cleanId = id?.trim() || '';
  const formattedId = cleanId 
    ? (cleanId.toUpperCase().startsWith('ID') || cleanId.toUpperCase().startsWith('TCH') ? cleanId : `ID: ${cleanId}`) 
    : null;

  const cleanClass = className?.trim() || '';
  const isGenericTeacherText = 
    cleanClass.toLowerCase() === 'teacher' || 
    cleanClass.toLowerCase() === 'not assigned' || 
    cleanClass.toLowerCase() === 'n/a';
  const hasValidClass = cleanClass !== '' && !isGenericTeacherText;

  const formattedClass = hasValidClass 
    ? (cleanClass.toLowerCase().startsWith('class') ? cleanClass : `Class ${cleanClass}`)
    : null;

  const displayRole = roleName?.trim() || (isGenericTeacherText ? 'Teacher' : 'Faculty');

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <View style={styles.profileSection}>
        {/* Avatar Container */}
        <View style={[styles.avatarContainer, { borderColor: colors.border, backgroundColor: colors.surfaceSubtle }]}>
          {showImage && avatarUrl ? (
            <Image 
              source={{ uri: avatarUrl }} 
              style={styles.avatar}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={[styles.avatar, styles.initialsAvatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.initialsText}>{initials}</Text>
            </View>
          )}
        </View>

        {/* Info Column */}
        <View style={styles.infoTextContainer}>
          {formattedId && (
            <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>{formattedId}</Text>
            </View>
          )}
          
          <Text style={[styles.nameText, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {name}
          </Text>
          
          <View style={styles.metaRow}>
            <Ionicons 
              name={hasValidClass ? "school-outline" : "briefcase-outline"} 
              size={14} 
              color={colors.textSecondary} 
              style={styles.metaIcon} 
            />
            <Text style={[styles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
              {formattedClass || displayRole}
            </Text>
            {subjectName && subjectName.trim() !== '' && (
              <>
                <Text style={[styles.dotSeparator, { color: colors.textMuted }]}>•</Text>
                <Ionicons name="book-outline" size={13} color={colors.textMuted} style={styles.metaIcon} />
                <Text style={[styles.metaTextMuted, { color: colors.textMuted }]} numberOfLines={1}>
                  {subjectName}
                </Text>
              </>
            )}
          </View>
        </View>
      </View>

      {/* Edit Profile Button */}
      <TouchableOpacity 
        style={[styles.editButton, { backgroundColor: colors.primary }]} 
        onPress={onEditPress}
        activeOpacity={0.8}
      >
        <Ionicons name="create-outline" size={16} color="#FFFFFF" style={styles.buttonIcon} />
        <Text style={styles.editButtonText}>Edit Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginVertical: 10,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    width: '100%',
  },
  avatarContainer: {
    width: 76,
    height: 76,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    marginRight: 14,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  initialsAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 1,
  },
  infoTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  nameText: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metaIcon: {
    marginRight: 4,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  dotSeparator: {
    marginHorizontal: 6,
    fontSize: 13,
  },
  metaTextMuted: {
    fontSize: 13,
    fontWeight: '400',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    width: '100%',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  buttonIcon: {
    marginRight: 6,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
