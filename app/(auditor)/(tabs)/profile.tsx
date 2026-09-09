import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Header } from '../../../components/common/Header';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { useRouter } from 'expo-router';

export default function AuditorProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Header
        title="Auditor Profile"
        subtitle="Government Of Maharashtra"
      />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.authorityCard}>
          <View style={styles.badgeRow}>
            <Ionicons name="shield" size={24} color="#7C3AED" />
            <Text style={styles.badgeText}>INDEPENDENT AUDITOR</Text>
          </View>
          <Text style={styles.authorityTitle}>
            State Audit & Vigilance Commission
          </Text>
          <Text style={styles.authoritySub}>
            Statutory audit mandate to certify the 5th verification slot and inspect tamper-evident SHA-256 exchange logs.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>AUDITOR CREDENTIALS</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{user?.name || 'Compliance Auditor'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Official Email</Text>
            <Text style={styles.value}>{user?.email}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Auditor Key</Text>
            <Text style={[styles.value, styles.purpleText]}>AUDITOR</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Verification Authority</Text>
            <Text style={styles.value}>Slot 5 (Statutory Clearance)</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={[styles.value, styles.approvedText]}>APPROVED</Text>
          </View>
        </View>

        {/* Edit Government Profile Details Button */}
        <TouchableOpacity
          style={styles.profileDetailsBtn}
          onPress={() => router.push('/resident-details')}
        >
          <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
          <Text style={styles.profileDetailsBtnText}>Official Government Profile & Details</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.logoutText}>Sign Out from Auditor Console</Text>
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
  authorityCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  badgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  authorityTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  authoritySub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
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
  purpleText: {
    color: '#7C3AED',
  },
  approvedText: {
    color: Colors.success,
  },
  profileDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  profileDetailsBtnText: {
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
