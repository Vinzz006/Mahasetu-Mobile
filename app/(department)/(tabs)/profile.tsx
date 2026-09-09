import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Header } from '../../../components/common/Header';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { useRouter } from 'expo-router';

export default function DepartmentProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const deptNames: Record<string, string> = {
    DEPT_A: 'Department A — Revenue & Civil Supplies',
    DEPT_B: 'Department B — Social Welfare & Inclusion',
    DEPT_C: 'Department C — Labour & Employment Welfare',
  };

  return (
    <View style={styles.container}>
      <Header
        title="Officer Credentials"
        subtitle="Government Of Maharashtra"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Verification Authority Card */}
        <View style={styles.authorityCard}>
          <View style={styles.badgeRow}>
            <Ionicons name="business" size={24} color={Colors.accent} />
            <Text style={styles.badgeText}>RBAC Scope: {user?.departmentId}</Text>
          </View>
          <Text style={styles.authorityTitle}>
            {deptNames[user?.departmentId || 'DEPT_A'] || 'Government Department'}
          </Text>
          <Text style={styles.authoritySub}>
            Authorized to verify citizen application records under Section 25 isolation rules.
          </Text>
        </View>

        {/* Credentials Details */}
        <View style={styles.card}>
          <Text style={styles.heading}>OFFICER PROFILE</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Officer Name</Text>
            <Text style={styles.value}>{user?.name || 'Department Officer'}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Official Gov Email</Text>
            <Text style={styles.value}>{user?.email}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Department Code</Text>
            <Text style={[styles.value, styles.accentText]}>{user?.departmentId}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Authorization Role</Text>
            <Text style={styles.value}>department_officer</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Account Status</Text>
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
          <Text style={styles.logoutText}>Sign Out from MahaSetu</Text>
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
    borderColor: '#99F6E4',
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
    color: Colors.accent,
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
  accentText: {
    color: Colors.accent,
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

