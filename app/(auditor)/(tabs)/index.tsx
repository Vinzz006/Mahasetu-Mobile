import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Header } from '../../../components/common/Header';
import { StatCard } from '../../../components/common/StatCard';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { applicationService } from '../../../services/applicationService';
import { Application } from '../../../types';
import { router } from 'expo-router';

export default function AuditorDashboardScreen() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = applicationService.subscribeToApplications(user, (list) => {
      setApplications(list);
    });
    return () => unsub();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  const pendingAuditorReview = applications.filter((a) => (a.verificationSummary?.verifiedCount || 0) >= 3).length;

  return (
    <View style={styles.container}>
      <Header
        title="Compliance & Audit Portal"
        subtitle={`Auditor: ${user?.name || 'Auditor'}`}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Metric Cards */}
        <View style={styles.statsRow}>
          <StatCard
            title="Pending Review"
            value={pendingAuditorReview || 2}
            subtitle="Needs auditor slot"
            icon="shield-half"
            color="#7C3AED"
          />
          <StatCard
            title="5/5 Verified"
            value="1"
            subtitle="Fully certified"
            icon="checkmark-done"
            color={Colors.success}
          />
        </View>

        <View style={styles.statsRow}>
          <StatCard
            title="Exchanges Audited"
            value="3"
            subtitle="Canonical transfers"
            icon="swap-horizontal"
            color={Colors.primary}
          />
          <StatCard
            title="Audit Events"
            value="5"
            subtitle="Cryptographic entries"
            icon="finger-print"
            color="#D97706"
          />
        </View>

        {/* Auditor Mandate Card */}
        <View style={styles.mandateCard}>
          <View style={styles.mandateHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#7C3AED" />
            <Text style={styles.mandateTitle}>Independent Compliance Mandate</Text>
          </View>
          <Text style={styles.mandateDesc}>
            The Compliance Auditor holds statutory oversight. You are authorized to review applications, inspect raw consent signatures, audit cross-department transformations, and execute the 5th verification approval gate.
          </Text>
        </View>

        {/* Action Shortcuts */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>AUDITOR RESPONSIBILITIES</Text>

          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/(auditor)/(tabs)/applications')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="checkbox-outline" size={22} color="#7C3AED" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Application Verification Gate</Text>
              <Text style={styles.cardSub}>Inspect dossiers and approve/reject the statutory Auditor gate (Slot 5 of 5).</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/(auditor)/(tabs)/exchanges')}
          >
            <View style={[styles.iconBox, { backgroundColor: Colors.primarySubtle }]}>
              <Ionicons name="swap-horizontal" size={22} color={Colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>Canonical Data Exchange Audit</Text>
              <Text style={styles.cardSub}>Verify data-minimization schemas and consent scopes between departments.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/(auditor)/(tabs)/audit')}
          >
            <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="time" size={22} color="#D97706" />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>System Audit Trail (Read-Only)</Text>
              <Text style={styles.cardSub}>Immutable chronological activity log. Mutation is strictly prohibited.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Auditor Limitations Notice */}
        <View style={styles.limitationsCard}>
          <Ionicons name="lock-closed" size={16} color="#92400E" />
          <Text style={styles.limitationsText}>
            RBAC Enforcement: Auditors cannot assign user roles, modify system configuration, reset demo environments, or alter historical audit logs.
          </Text>
        </View>
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
    paddingBottom: Spacing.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  mandateCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    marginBottom: Spacing.md,
  },
  mandateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  mandateTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
    color: '#7C3AED',
  },
  mandateDesc: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeading: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  limitationsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  limitationsText: {
    flex: 1,
    fontSize: Typography.fontSize.xs - 2,
    color: '#92400E',
    fontWeight: '600',
    lineHeight: 16,
  },
});
