import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Header } from '../../../components/common/Header';
import { StatCard } from '../../../components/common/StatCard';
import { VerificationMatrix } from '../../../components/verification/VerificationMatrix';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import {
  adminDashboardService,
  CitizenVerificationItem,
} from '../../../services/adminDashboardService';
import { twilioService, SmsMetrics } from '../../../services/twilioService';
import { Application, UserProfile } from '../../../types';
import { router } from 'expo-router';

export default function AdminDashboardScreen() {
  const { user } = useAuth();

  // Live real-time Firestore datasets
  const [pendingUsers, setPendingUsers] = useState<UserProfile[]>([]);
  const [citizensQueue, setCitizensQueue] = useState<CitizenVerificationItem[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [verificationsMap, setVerificationsMap] = useState<
    Record<string, Record<string, 'VERIFIED' | 'PENDING' | 'REJECTED'>>
  >({});
  const [smsMetrics, setSmsMetrics] = useState<SmsMetrics>({
    smsSentToday: 0,
    smsFailedToday: 0,
    recentLogs: [],
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);

    let streamErrors: string[] = [];
    const handleStreamError = (msg: string) => {
      console.error('[AdminDashboard]', msg);
      streamErrors.push(msg);
      setError(streamErrors.join('\n'));
      setLoading(false);
    };

    let loadedCount = 0;
    const markStreamLoaded = () => {
      loadedCount++;
      if (loadedCount >= 3) {
        setLoading(false);
      }
    };

    // 1. Live Pending Users (status in ['PENDING', 'PENDING_APPROVAL'], excludes isDemo)
    const unsubPending = adminDashboardService.subscribeToPendingUsers(
      (list) => {
        setPendingUsers(list);
        markStreamLoaded();
      },
      (err) => handleStreamError(err)
    );

    // 2. Live Citizens awaiting Identity Certification (excludes isDemo)
    const unsubCitizens = adminDashboardService.subscribeToCitizenIdentityQueue(
      (queue) => {
        setCitizensQueue(queue);
        markStreamLoaded();
      },
      (err) => handleStreamError(err)
    );

    // 3. Live Active Applications (excludes completed/rejected and isDemo)
    const unsubApps = adminDashboardService.subscribeToActiveApplications(
      (list) => {
        setApplications(list);
        markStreamLoaded();
      },
      (err) => handleStreamError(err)
    );

    // 4. Live Verification Matrix mapping across all active application slots
    const unsubVerifications = adminDashboardService.subscribeToVerificationMatrix(
      (matrixMap) => {
        setVerificationsMap(matrixMap);
      },
      (err) => handleStreamError(err)
    );

    // 5. Live SMS Delivery Logs & Today Metrics
    const unsubSms = adminDashboardService.subscribeToSmsMetrics(
      (metrics) => {
        setSmsMetrics(metrics);
      },
      (err) => handleStreamError(err)
    );

    // Safety timeout to ensure loading indicator clears gracefully
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 2000);

    return () => {
      unsubPending();
      unsubCitizens();
      unsubApps();
      unsubVerifications();
      unsubSms();
      clearTimeout(timeout);
    };
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const health = await twilioService.getTwilioHealth();
      setSmsMetrics({
        smsSentToday: health.smsSentToday,
        smsFailedToday: health.smsFailedToday,
        recentLogs: health.recentLogs,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to refresh telemetry');
    } finally {
      setRefreshing(false);
    }
  }, []);

  // 1. Pending Users Calculation
  const pendingCount = pendingUsers.length;
  const pendingSubtitle = pendingCount > 0 ? 'Needs role assignment' : 'No pending approvals';

  // 2. Citizen Identity Certification Calculation
  const pendingCitizensCount = citizensQueue.length;
  const citizenSubtitle =
    pendingCitizensCount > 0 ? 'Pending certification' : 'No pending certification';

  // 3. Active Applications Calculation
  const activeApps = applications.filter(
    (a) => a.status !== 'COMPLETED' && a.status !== 'REJECTED'
  );
  const activeAppsCount = activeApps.length;

  const fullyVerifiedCount = activeApps.filter(
    (a) => a.verificationSummary?.isFullyVerified || a.verificationSummary?.verifiedCount === 5
  ).length;
  const inProgressApps = activeApps.filter(
    (a) => (a.verificationSummary?.verifiedCount || 0) < 5 && !a.verificationSummary?.isFullyVerified
  );

  let activeAppsSubtitle = 'Multi-department flow';
  if (activeAppsCount === 0) {
    activeAppsSubtitle = 'No active applications';
  } else if (inProgressApps.length === 0) {
    activeAppsSubtitle = 'All applications certified';
  } else {
    const totalVerifiedStages = inProgressApps.reduce(
      (sum, a) => sum + (a.verificationSummary?.verifiedCount || 0),
      0
    );
    const avgProgress = Math.round(totalVerifiedStages / inProgressApps.length);
    activeAppsSubtitle = `${avgProgress}/5 verification in progress`;
  }

  // 4. Twilio SMS Metrics Calculation
  const totalSmsToday = smsMetrics.smsSentToday + smsMetrics.smsFailedToday;
  const twilioSubtitle =
    totalSmsToday === 0 ? 'No messages today' : `${smsMetrics.smsFailedToday} failed today`;

  return (
    <View style={styles.container}>
      <Header
        title="Admin Control Center"
        subtitle={`Administrator: ${user?.name || 'Administrator'}`}
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading real-time admin telemetry...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.danger} />
          <Text style={styles.errorTitle}>Unable to load dashboard data</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Top Metric Cards - 100% Real Live Firestore Counters */}
          <View style={styles.statsGrid}>
            <StatCard
              title="PENDING USERS"
              value={String(pendingCount)}
              subtitle={pendingSubtitle}
              icon="person-add-outline"
              color="#D97706"
              onPress={() => router.push('/(admin)/(tabs)/approvals')}
            />
            <StatCard
              title="CITIZEN IDENTITY"
              value={String(pendingCitizensCount)}
              subtitle={citizenSubtitle}
              icon="id-card-outline"
              color={Colors.primary}
              onPress={() => router.push('/(admin)/(tabs)/citizens')}
            />
          </View>

          <View style={styles.statsGrid}>
            <StatCard
              title="ACTIVE APPLICATIONS"
              value={String(activeAppsCount)}
              subtitle={activeAppsSubtitle}
              icon="layers-outline"
              color={Colors.accent}
              onPress={() => router.push('/(admin)/(tabs)/applications')}
            />
            <StatCard
              title="TWILIO SMS"
              value={String(smsMetrics.smsSentToday)}
              subtitle={twilioSubtitle}
              icon="chatbubbles-outline"
              color={smsMetrics.smsFailedToday > 0 ? Colors.danger : Colors.success}
              onPress={() => router.push('/(admin)/(tabs)/integrations')}
            />
          </View>

          {/* Quick Management Shortcuts */}
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>ADMINISTRATIVE WORKFLOWS</Text>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(admin)/(tabs)/approvals')}
            >
              <View style={[styles.iconBox, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="people" size={22} color="#D97706" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Pending User Approvals</Text>
                <Text style={styles.actionSub}>
                  Review new registrations and assign Citizen, Department Officer, or Auditor roles.
                </Text>
              </View>
              <View style={styles.badgeWrap}>
                {pendingCount > 0 && (
                  <View style={styles.countPill}>
                    <Text style={styles.countPillText}>{pendingCount}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(admin)/(tabs)/citizens')}
            >
              <View style={[styles.iconBox, { backgroundColor: Colors.primarySubtle }]}>
                <Ionicons name="shield-checkmark" size={22} color={Colors.primary} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>Citizen Identity Verification Queue</Text>
                <Text style={styles.actionSub}>
                  Certify resident credentials for automated cross-department data reuse.
                </Text>
              </View>
              <View style={styles.badgeWrap}>
                {pendingCitizensCount > 0 && (
                  <View style={[styles.countPill, { backgroundColor: Colors.primary }]}>
                    <Text style={styles.countPillText}>{pendingCitizensCount}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/(admin)/(tabs)/applications')}
            >
              <View style={[styles.iconBox, { backgroundColor: Colors.accentLight }]}>
                <Ionicons name="grid" size={22} color={Colors.accent} />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>5/5 Verification Matrix</Text>
                <Text style={styles.actionSub}>
                  Track cross-department completion and execute the State Admin verification step.
                </Text>
              </View>
              <View style={styles.badgeWrap}>
                {activeAppsCount > 0 && (
                  <View style={[styles.countPill, { backgroundColor: Colors.accent }]}>
                    <Text style={styles.countPillText}>{activeAppsCount}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>

          {/* Verification Matrix Widget with Real Live Verification Stages */}
          <View style={styles.section}>
            <VerificationMatrix
              applications={activeApps}
              verificationsMap={verificationsMap}
            />

            {/* Dynamic Cross-Department Aggregation Summary */}
            {activeAppsCount > 0 && (
              <View style={styles.matrixSummaryRow}>
                <View style={styles.matrixSummaryItem}>
                  <Text style={styles.matrixSummaryLabel}>Active:</Text>
                  <Text style={styles.matrixSummaryVal}>{activeAppsCount}</Text>
                </View>
                <View style={styles.matrixSummaryDivider} />
                <View style={styles.matrixSummaryItem}>
                  <Text style={styles.matrixSummaryLabel}>Fully Verified (5/5):</Text>
                  <Text style={[styles.matrixSummaryVal, { color: Colors.success }]}>
                    {fullyVerifiedCount}
                  </Text>
                </View>
                <View style={styles.matrixSummaryDivider} />
                <View style={styles.matrixSummaryItem}>
                  <Text style={styles.matrixSummaryLabel}>In Progress:</Text>
                  <Text style={[styles.matrixSummaryVal, { color: '#D97706' }]}>
                    {inProgressApps.length}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Compliance & Audit Monitoring Shortcut */}
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>SECURITY & INFRASTRUCTURE</Text>
            <View style={styles.infraGrid}>
              <TouchableOpacity
                style={styles.infraCard}
                onPress={() => router.push('/(admin)/(tabs)/audit')}
              >
                <Ionicons name="finger-print-outline" size={24} color={Colors.primary} />
                <Text style={styles.infraTitle}>Immutable Audit Trail</Text>
                <Text style={styles.infraDesc}>Real-time compliance logs</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.infraCard}
                onPress={() => router.push('/(admin)/(tabs)/integrations')}
              >
                <Ionicons name="hardware-chip-outline" size={24} color={Colors.accent} />
                <Text style={styles.infraTitle}>Twilio Messaging</Text>
                <Text style={styles.infraDesc}>SMS delivery health monitor</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}
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
    paddingBottom: Spacing.xxl + 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: Colors.danger,
    marginTop: Spacing.sm,
  },
  errorSubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  retryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  retryText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  section: {
    marginTop: Spacing.md,
  },
  sectionHeading: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
  },
  actionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadowColor,
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  actionSub: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  badgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  countPill: {
    backgroundColor: '#D97706',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  countPillText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '800',
  },
  matrixSummaryRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  matrixSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  matrixSummaryLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  matrixSummaryVal: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  matrixSummaryDivider: {
    width: 1,
    height: 16,
    backgroundColor: Colors.border,
  },
  infraGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  infraCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infraTitle: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  infraDesc: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
