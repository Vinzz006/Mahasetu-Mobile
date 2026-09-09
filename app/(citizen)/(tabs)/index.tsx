import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Header } from '../../../components/common/Header';
import { StatCard } from '../../../components/common/StatCard';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { SkeletonLoader } from '../../../components/common/SkeletonLoader';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { applicationService } from '../../../services/applicationService';
import { consentService } from '../../../services/consentService';
import { Application, Consent } from '../../../types';
import { router } from 'expo-router';

export default function CitizenHomeScreen() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);
  const [loadingConsents, setLoadingConsents] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoadingApps(true);
    setLoadingConsents(true);
    setErrorMessage(null);

    // Realtime subscription to citizen's applications
    const unsubApps = applicationService.subscribeToApplications(user, (list) => {
      setApplications(list);
      setLoadingApps(false);
    });

    // Realtime subscription to citizen's consents
    const unsubConsents = consentService.subscribeToConsents(user, (list) => {
      setConsents(list);
      setLoadingConsents(false);
    });

    return () => {
      unsubApps();
      unsubConsents();
    };
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const pendingConsentsCount = consents.filter((c) => c.status === 'PENDING').length;
  const activeAppsCount = applications.filter(
    (a) => a.status !== 'COMPLETED' && a.status !== 'REJECTED'
  ).length;
  const recentApp = applications[0];

  return (
    <View style={styles.container}>
      <Header
        title={`Welcome, ${user?.name || 'Citizen'}`}
        subtitle="MahaSetu Citizen Portal"
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Error State Banner */}
        {errorMessage && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={Colors.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {/* Core Metric Cards: Skeleton or Real Firestore Values */}
        {loadingApps || loadingConsents ? (
          <View style={styles.statsRow}>
            <View style={styles.skeletonStatCard}>
              <SkeletonLoader width={80} height={14} borderRadius={4} />
              <SkeletonLoader width={40} height={28} borderRadius={4} style={{ marginVertical: 6 }} />
              <Text style={styles.skeletonText}>Loading applications...</Text>
            </View>
            <View style={styles.skeletonStatCard}>
              <SkeletonLoader width={80} height={14} borderRadius={4} />
              <SkeletonLoader width={40} height={28} borderRadius={4} style={{ marginVertical: 6 }} />
              <Text style={styles.skeletonText}>Loading consents...</Text>
            </View>
          </View>
        ) : (
          <View style={styles.statsRow}>
            <StatCard
              title="Active Apps"
              value={activeAppsCount}
              subtitle={activeAppsCount === 1 ? '1 under verification' : `${activeAppsCount} in progress`}
              icon="document-text-outline"
              color={Colors.primary}
            />
            <StatCard
              title="Consents"
              value={pendingConsentsCount}
              subtitle={pendingConsentsCount > 0 ? 'Requires action' : 'All approved'}
              icon="shield-checkmark-outline"
              color={pendingConsentsCount > 0 ? Colors.warning : Colors.success}
            />
          </View>
        )}

        {/* Primary Action Button: Apply for Service */}
        <TouchableOpacity
          style={styles.applyButton}
          onPress={() => router.push('/(citizen)/(tabs)/services')}
          accessibilityLabel="Apply for government service"
        >
          <View style={styles.applyButtonLeft}>
            <View style={styles.applyIconCircle}>
              <Ionicons name="add-circle" size={22} color={Colors.textInverse} />
            </View>
            <View style={styles.applyTextContainer}>
              <Text style={styles.applyButtonTitle}>Apply for Service</Text>
              <Text style={styles.applyButtonSubtitle}>Submit Once • Cross-Department Verification</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.textInverse} />
        </TouchableOpacity>

        {/* Pending Consent Notification Banner */}
        {!loadingConsents && pendingConsentsCount > 0 && (
          <TouchableOpacity
            style={styles.consentAlertBanner}
            onPress={() => router.push('/(citizen)/(tabs)/consent')}
          >
            <Ionicons name="alert-circle" size={20} color="#92400E" />
            <View style={styles.consentAlertContent}>
              <Text style={styles.consentAlertTitle}>Consent Required</Text>
              <Text style={styles.consentAlertText}>
                {pendingConsentsCount} department request(s) awaiting your explicit authorization.
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={16} color="#92400E" />
          </TouchableOpacity>
        )}

        {/* Current Active Application Tracker & Realtime 5/5 Progress */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Verification Progress</Text>
            {applications.length > 1 && (
              <TouchableOpacity onPress={() => router.push('/(citizen)/(tabs)/applications')}>
                <Text style={styles.viewAllText}>View all ({applications.length})</Text>
              </TouchableOpacity>
            )}
          </View>

          {loadingApps ? (
            <View style={styles.loadingAppBox}>
              <SkeletonLoader width="60%" height={16} borderRadius={4} />
              <SkeletonLoader width="100%" height={12} borderRadius={4} style={{ marginTop: 8 }} />
              <SkeletonLoader width="100%" height={8} borderRadius={4} style={{ marginTop: 12 }} />
              <Text style={styles.loadingAppText}>Connecting to live verification stream...</Text>
            </View>
          ) : recentApp ? (
            <TouchableOpacity
              style={styles.appCard}
              onPress={() => router.push(`/(citizen)/application/${recentApp.id}`)}
            >
              <View style={styles.appCardHeader}>
                <View style={styles.appHeaderLeft}>
                  <Text style={styles.appNumber}>{recentApp.applicationNumber}</Text>
                  <Text style={styles.appServiceTitle} numberOfLines={1}>
                    {recentApp.serviceTitle}
                  </Text>
                </View>
                <StatusBadge status={recentApp.status} size="sm" />
              </View>

              {/* 5-Step Realtime Verification Indicator */}
              <View style={styles.progressContainer}>
                <View style={styles.progressLabelRow}>
                  <Text style={styles.progressLabel}>Verification Status</Text>
                  <Text style={styles.progressScore}>
                    {recentApp.verificationSummary?.verifiedCount || 0} / 5 completed
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.min(
                          100,
                          ((recentApp.verificationSummary?.verifiedCount || 0) / 5) * 100
                        )}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.footerDate}>
                  Submitted: {new Date(recentApp.submissionDate).toLocaleDateString()}
                </Text>
                <View style={styles.trackLink}>
                  <Text style={styles.trackLinkText}>Track Details</Text>
                  <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyAppBox}>
              <Ionicons name="folder-open-outline" size={32} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Active Applications</Text>
              <Text style={styles.emptySubtitle}>
                Select a service from the catalogue to submit your first application.
              </Text>
            </View>
          )}
        </View>

        {/* Improved Guarantee Card: Trust & Consent Assurance */}
        <View style={styles.submitOnceCard}>
          <View style={styles.submitOnceHeader}>
            <Ionicons name="shield-checkmark" size={18} color={Colors.accent} />
            <Text style={styles.submitOnceTitle}>The MahaSetu Guarantee</Text>
          </View>
          <Text style={styles.submitOnceBody}>
            Your verified information is securely reused across participating departments. You will always be informed and asked for explicit consent before any data exchange occurs.
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm + 2,
    marginBottom: Spacing.md,
  },
  skeletonStatCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skeletonText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
    marginTop: 4,
  },
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm + 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  applyButtonLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  applyIconCircle: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyTextContainer: {
    flex: 1,
  },
  applyButtonTitle: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '700',
  },
  applyButtonSubtitle: {
    color: '#93C5FD',
    fontSize: Typography.fontSize.xs - 2,
    marginTop: 1,
  },
  consentAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  consentAlertContent: {
    flex: 1,
  },
  consentAlertTitle: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: '#92400E',
  },
  consentAlertText: {
    fontSize: Typography.fontSize.xs - 1,
    color: '#B45309',
    marginTop: 1,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs + 2,
  },
  sectionTitle: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '800',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewAllText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
  loadingAppBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  loadingAppText: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  appCard: {
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
  },
  appCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  appHeaderLeft: {
    flex: 1,
    marginRight: Spacing.xs,
  },
  appNumber: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  appServiceTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  progressContainer: {
    marginVertical: Spacing.xs,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  progressScore: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerDate: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
  },
  trackLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackLinkText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyAppBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 280,
    lineHeight: 18,
  },
  submitOnceCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.xs,
  },
  submitOnceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  submitOnceTitle: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: '#166534',
  },
  submitOnceBody: {
    fontSize: Typography.fontSize.xs - 1,
    color: '#15803D',
    lineHeight: 17,
  },
});
