import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../store/AuthContext';
import { router } from 'expo-router';

export default function PendingApprovalScreen() {
  const { user, logout, refreshProfile } = useAuth();
  const [checking, setChecking] = useState(false);

  // Poll / refresh status check
  const handleCheckStatus = async () => {
    setChecking(true);
    await refreshProfile();
    setTimeout(() => {
      setChecking(false);
    }, 1000);
  };

  return (
    <View style={styles.container}>
      {/* Government Emblem Header */}
      <View style={styles.badgeContainer}>
        <Image
          source={require('../../assets/images/indian-flag.png')}
          style={styles.flagLogo}
          resizeMode="cover"
          accessibilityLabel="Indian National Flag"
        />
      </View>

      <Text style={styles.brandTitle}>MAHASETU</Text>
      <Text style={styles.brandSubtitle}>Government Of Maharashtra</Text>

      {/* Main Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.alertIconRow}>
          <View style={styles.clockCircle}>
            <Ionicons name="hourglass-outline" size={28} color={Colors.warning} />
          </View>
        </View>

        <Text style={styles.headline}>Your account has been created.</Text>

        <View style={styles.statusBox}>
          <Text style={styles.statusLabel}>STATUS</Text>
          <Text style={styles.statusValue}>Pending Admin Approval</Text>
        </View>

        <Text style={styles.explanationText}>
          An administrator will review your registration and assign your MahaSetu role.
        </Text>

        <View style={styles.emailContainer}>
          <Text style={styles.emailLabel}>Registered email:</Text>
          <Text style={styles.emailValue}>{user?.email || 'user@gmail.com'}</Text>
        </View>

        <Text style={styles.footerNotice}>
          You will receive access after approval. No applications or administrative tools can be accessed until then.
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleCheckStatus}
          disabled={checking}
          accessibilityLabel="Check approval status"
        >
          {checking ? (
            <ActivityIndicator color={Colors.textInverse} size="small" />
          ) : (
            <>
              <Ionicons name="sync" size={18} color={Colors.textInverse} style={styles.btnIcon} />
              <Text style={styles.refreshButtonText}>Check Status</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/(pending)/profile')}
          accessibilityLabel="View registration profile"
        >
          <Ionicons name="person-outline" size={18} color={Colors.textInverse} style={styles.btnIcon} />
          <Text style={styles.profileButtonText}>View Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
          accessibilityLabel="Sign out"
        >
          <Ionicons name="log-out-outline" size={18} color={Colors.textMuted} style={styles.btnIcon} />
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  badgeContainer: {
    width: 80,
    height: 54,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  flagLogo: {
    width: 80,
    height: 54,
    borderRadius: BorderRadius.md,
  },
  brandTitle: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xxl,
    fontWeight: '800',
    letterSpacing: 2,
  },
  brandSubtitle: {
    color: '#93C5FD',
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
    marginBottom: Spacing.lg,
    letterSpacing: 0.5,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: Colors.shadowColor,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
  },
  alertIconRow: {
    marginBottom: Spacing.sm,
  },
  clockCircle: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  statusBox: {
    backgroundColor: Colors.warningLight,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusLabel: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.8,
  },
  statusValue: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
    color: Colors.warning,
  },
  explanationText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  emailContainer: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emailLabel: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  emailValue: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  footerNotice: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  actionsContainer: {
    marginTop: Spacing.lg,
    width: '100%',
    maxWidth: 380,
    gap: Spacing.sm,
  },
  refreshButton: {
    backgroundColor: Colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.md,
  },
  btnIcon: {
    marginRight: Spacing.xs,
  },
  refreshButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  profileButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md - 4,
    borderRadius: BorderRadius.md,
  },
  profileButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  logoutButtonText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '600',
  },
});
