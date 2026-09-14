import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useAppTheme } from '@/constants/theme';

interface ProfileCardProps {
  name: string;
  id: string;
  className: string;
  avatarUrl: string;
  onEditPress?: () => void;
}

export default function ProfileCard({ 
  name, 
  id, 
  className, 
  avatarUrl, 
  onEditPress 
}: ProfileCardProps) {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={styles.cardWrapper}>
      <View style={[styles.cardBody, { backgroundColor: isDark ? '#141822' : '#1e2846', borderColor: colors.border }]}>
        <View style={styles.contentContainer}>
          <View style={styles.mainInfoRow}>
            <View style={styles.profileSection}>
              {/* Avatar XXL Rounded */}
              <View style={[styles.avatarContainer, { borderColor: isDark ? colors.primary : '#fff' }]}>
                <Image 
                  source={{ uri: avatarUrl }} 
                  style={styles.avatar}
                  resizeMode="cover"
                />
              </View>

              <View style={styles.infoTextContainer}>
                {/* Badge ID */}
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{id}</Text>
                </View>
                
                <Text style={styles.nameText} numberOfLines={1}>{name}</Text>
                
                <View style={styles.classContainer}>
                  <Text style={styles.classText}>Class : {className}</Text>
                </View>
              </View>
            </View>

            {/* Edit Profile Button */}
            <TouchableOpacity 
              style={[styles.editButton, { backgroundColor: colors.primary }]} 
              onPress={onEditPress}
              activeOpacity={0.8}
            >
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    marginVertical: 10,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardBody: {
    padding: 20,
    minHeight: 140,
    justifyContent: 'center',
    borderWidth: 1,
  },
  contentContainer: {
    zIndex: 1,
  },
  mainInfoRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 85,
    height: 85,
    borderRadius: 16,
    borderWidth: 2,
    backgroundColor: '#1C2230',
    overflow: 'hidden',
    marginRight: 15,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  infoTextContainer: {
    flex: 1,
  },
  badge: {
    backgroundColor: 'rgba(91, 120, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(91, 120, 246, 0.4)',
  },
  badgeText: {
    color: '#A5B4FC',
    fontSize: 11,
    fontWeight: 'bold',
  },
  nameText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  classContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  editButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  editButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
