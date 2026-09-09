import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../store/AuthContext';
import { router } from 'expo-router';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  showLogout?: boolean;
  rightAction?: React.ReactNode;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  showLogout = true,
  rightAction,
}) => {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.leftSection}>
          {showBack && (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
              accessibilityLabel="Go back"
            >
              <Ionicons name="arrow-back" size={22} color={Colors.textInverse} />
            </TouchableOpacity>
          )}

          {/* Indian National Flag Badge */}
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/images/indian-flag.png')}
              style={styles.logo}
              resizeMode="cover"
              accessibilityLabel="Indian National Flag"
            />
          </View>

          {/* Brand Titles */}
          <View style={styles.brandTextContainer}>
            <Text style={styles.brandTitle}>MAHASETU</Text>
            <Text style={styles.brandSubtitle}>Government Of Maharashtra</Text>
          </View>
        </View>

        {/* Right Action & Logout */}
        <View style={styles.rightSection}>
          {rightAction}
          {showLogout && (
            <TouchableOpacity
              onPress={logout}
              style={styles.logoutButton}
              accessibilityLabel="Sign out"
            >
              <Ionicons name="log-out-outline" size={20} color={Colors.textInverse} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Screen Title & Subtitle (when provided) */}
      {title ? (
        <View style={styles.headerContent}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0A1428', // Dark Government Navy
    paddingTop: 36,
    paddingBottom: Spacing.sm + 4,
    paddingHorizontal: Spacing.md,
    borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backButton: {
    padding: Spacing.xs,
    marginRight: 2,
  },
  logoBadge: {
    width: 36,
    height: 24,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  logo: {
    width: 36,
    height: 24,
    borderRadius: 4,
  },
  brandTextContainer: {
    justifyContent: 'center',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1.2,
    lineHeight: 20,
  },
  brandSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.2,
    marginTop: 1,
    lineHeight: 15,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  logoutButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    marginTop: Spacing.xs + 2,
    paddingTop: Spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  title: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.md + 2,
    fontWeight: '700',
  },
  subtitle: {
    color: '#93C5FD',
    fontSize: Typography.fontSize.xs - 1,
    marginTop: 1,
  },
});
