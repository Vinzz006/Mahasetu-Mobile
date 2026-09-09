import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Header } from '../../../components/common/Header';
import { VerificationTimeline } from '../../../components/verification/VerificationTimeline';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { applicationService } from '../../../services/applicationService';
import { Application, ApplicationVerification } from '../../../types';

export default function ApplicationTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [application, setApplication] = useState<Application | null>(null);
  const [verifications, setVerifications] = useState<ApplicationVerification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const unsubApp = applicationService.subscribeToApplication(id, (app) => {
      setApplication(app);
      setLoading(false);
    });

    const unsubV = applicationService.subscribeToVerifications(id, (vList) => {
      setVerifications(vList);
    });

    return () => {
      unsubApp();
      unsubV();
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading verification status...</Text>
      </View>
    );
  }

  const appNumber = application?.applicationNumber || 'MS-10001';
  const verifiedCount = verifications.filter((v) => v.status === 'VERIFIED').length;
  const isFullyVerified = verifiedCount === 5;

  return (
    <View style={styles.container}>
      <Header
        title={appNumber}
        subtitle={application?.serviceTitle || 'Government Service'}
        showBack={true}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Highlight Banner */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View>
              <Text style={styles.summarySub}>OVERALL STATUS</Text>
              <Text style={styles.summaryTitle}>
                {isFullyVerified
                  ? 'All Verifications Approved'
                  : application?.status === 'REJECTED'
                  ? 'Application Rejected'
                  : 'Under Government Verification'}
              </Text>
            </View>
            <StatusBadge status={application?.status || 'UNDER_VERIFICATION'} />
          </View>

          <View style={styles.divider} />

          <View style={styles.metaGrid}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Applicant</Text>
              <Text style={styles.metaValue}>{application?.citizenName || 'Citizen Applicant'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Submitted</Text>
              <Text style={styles.metaValue}>
                {application?.submissionDate
                  ? new Date(application.submissionDate).toLocaleDateString()
                  : 'Today'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Service Scheme</Text>
              <Text style={styles.metaValue}>{application?.serviceCode || 'ICB-2026'}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>Verification Score</Text>
              <Text style={[styles.metaValue, styles.highlightScore]}>
                {verifiedCount} / 5 completed
              </Text>
            </View>
          </View>
        </View>

        {/* 5-Department Verification Stepper & Timeline */}
        <VerificationTimeline
          verifications={verifications}
          applicationNumber={appNumber}
          isCitizenView={true}
        />

        {/* Informational Assurance Card */}
        <View style={styles.ruleCard}>
          <View style={styles.ruleHeader}>
            <Ionicons name="shield" size={18} color={Colors.primary} />
            <Text style={styles.ruleTitle}>MahaSetu Multi-Party Rule</Text>
          </View>
          <Text style={styles.ruleDesc}>
            This application is processed through 5 independent gates (Department A, Department B, Department C, State Admin, and Compliance Auditor). All 5 must approve for final benefit disbursement.
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadowColor,
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    marginBottom: Spacing.sm,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summarySub: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  summaryTitle: {
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  metaItem: {
    width: '48%',
  },
  metaLabel: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  metaValue: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 1,
  },
  highlightScore: {
    color: Colors.primary,
  },
  ruleCard: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginTop: Spacing.sm,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  ruleTitle: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.primary,
  },
  ruleDesc: {
    fontSize: Typography.fontSize.xs,
    color: '#1E40AF',
    lineHeight: 18,
  },
});
