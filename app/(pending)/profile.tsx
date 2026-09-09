import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Header } from '../../components/common/Header';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../store/AuthContext';
import { router } from 'expo-router';

export default function PendingProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Header
        title="Pending User Profile"
        subtitle="MahaSetu Identity Registration"
        showBack={true}
        showLogout={true}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.statusBanner}>
          <Ionicons name="hourglass-outline" size={24} color={Colors.warning} />
          <View style={styles.bannerTextContainer}>
            <Text style={styles.bannerTitle}>Account Awaiting Approval</Text>
            <Text style={styles.bannerSub}>
              An administrator must approve your account and assign your role before full platform features are accessible.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>USER INFORMATION</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Full Name</Text>
            <Text style={styles.value}>{user?.name || 'Pending User'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Email Address</Text>
            <Text style={styles.value}>{user?.email}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Assigned Role</Text>
            <Text style={[styles.value, styles.pendingText]}>{user?.role || 'Pending Assignment'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Account Status</Text>
            <Text style={[styles.value, styles.pendingText]}>{user?.status || 'PENDING'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Registered On</Text>
            <Text style={styles.value}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Today'}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color={Colors.primary} />
          <Text style={styles.backBtnText}>Return to Approval Status</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.logoutText}>Sign Out from Account</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.md,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: '#92400E',
  },
  bannerSub: {
    fontSize: Typography.fontSize.xs - 1,
    color: '#B45309',
    marginTop: 2,
    lineHeight: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  heading: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  label: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  value: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pendingText: {
    color: Colors.warning,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  backBtnText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dangerLight,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  logoutText: {
    color: Colors.danger,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
});
