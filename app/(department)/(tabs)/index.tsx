import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Header } from '../../../components/common/Header';
import { StatCard } from '../../../components/common/StatCard';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { applicationService } from '../../../services/applicationService';
import { Application } from '../../../types';
import { router } from 'expo-router';

export default function DepartmentDashboardScreen() {
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
    setTimeout(() => setRefreshing(false), 800);
  };

  const deptLabel =
    user?.departmentId === 'DEPT_A'
      ? 'Department A — Revenue & Civil Supplies'
      : user?.departmentId === 'DEPT_B'
      ? 'Department B — Social Welfare & Inclusion'
      : 'Department C — Labour & Employment Welfare';

  const pendingCount = applications.filter((a) => a.status === 'UNDER_VERIFICATION' || a.status === 'APPLICATION_SUBMITTED').length;
  const verifiedCount = applications.filter((a) => a.status === 'APPLICATION_VERIFIED' || a.status === 'COMPLETED').length;
  const recentPending = applications.filter((a) => a.status === 'UNDER_VERIFICATION' || a.status === 'APPLICATION_SUBMITTED').slice(0, 5);

  const renderItem = ({ item }: { item: Application }) => (
    <View style={styles.appCard}>
      <View style={styles.cardTop}>
        <View style={styles.appNumberGroup}>
          <Text style={styles.appNumber}>{item.applicationNumber}</Text>
          <Text style={styles.serviceName}>{item.serviceTitle}</Text>
        </View>
        <StatusBadge status={item.status} size="sm" />
      </View>

      <View style={styles.citizenDetailsBox}>
        <View style={styles.citizenRow}>
          <Text style={styles.citizenLabel}>Applicant Name:</Text>
          <Text style={styles.citizenValue}>{item.citizenName}</Text>
        </View>
        <View style={styles.citizenRow}>
          <Text style={styles.citizenLabel}>Mobile Reference:</Text>
          <Text style={styles.citizenValue}>{item.citizenPhone}</Text>
        </View>
        <View style={styles.citizenRow}>
          <Text style={styles.citizenLabel}>Location:</Text>
          <Text style={styles.citizenValue}>{item.citizenCity}</Text>
        </View>
        <View style={styles.citizenRow}>
          <Text style={styles.citizenLabel}>Declared Income:</Text>
          <Text style={styles.citizenValue}>
            ₹{item.eligibilityData?.familyIncome || '1,80,000'} / yr
          </Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <View style={styles.deptScope}>
          <Ionicons name="shield-checkmark-outline" size={14} color={Colors.accent} />
          <Text style={styles.deptScopeText}>Scope: {user?.departmentId} Gate</Text>
        </View>
        <TouchableOpacity
          style={styles.reviewButton}
          onPress={() => router.push(`/(department)/review/${item.id}`)}
          accessibilityLabel={`Review application ${item.applicationNumber}`}
        >
          <Text style={styles.reviewButtonText}>Review & Action</Text>
          <Ionicons name="arrow-forward" size={14} color={Colors.textInverse} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header
        title={`Welcome, ${user?.name || 'Officer'}`}
        subtitle={deptLabel}
      />

      <FlatList
        data={recentPending}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.statsContainer}>
            <View style={styles.statsRow}>
              <StatCard
                title="Pending Review"
                value={pendingCount}
                subtitle="Awaiting authorization"
                icon="hourglass-outline"
                color={Colors.warning}
              />
              <StatCard
                title="Verified"
                value={verifiedCount}
                subtitle="Approved records"
                icon="checkmark-circle-outline"
                color={Colors.success}
              />
            </View>

            <TouchableOpacity
              style={styles.queueBanner}
              onPress={() => router.push('/(department)/(tabs)/queue')}
            >
              <View style={styles.queueBannerLeft}>
                <Ionicons name="list" size={24} color={Colors.textInverse} />
                <View>
                  <Text style={styles.queueBannerTitle}>Open Verification Queue</Text>
                  <Text style={styles.queueBannerSubtitle}>{pendingCount} items awaiting verification</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={Colors.textInverse} />
            </TouchableOpacity>

            <View style={styles.isolationNotice}>
              <Ionicons name="lock-closed-outline" size={16} color={Colors.accent} />
              <Text style={styles.isolationText}>
                Department Isolation Active: You are authorized to verify only the {user?.departmentId} gate.
              </Text>
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.queueHeading}>RECENT PENDING APPLICATIONS</Text>
              {pendingCount > 5 && (
                <TouchableOpacity onPress={() => router.push('/(department)/(tabs)/queue')}>
                  <Text style={styles.viewAllText}>View all ({pendingCount})</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="checkmark-done-circle-outline"
            title="Queue Cleared"
            description="All pending departmental verifications are up to date."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  statsContainer: {
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  queueBanner: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  queueBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  queueBannerTitle: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '700',
  },
  queueBannerSubtitle: {
    color: '#CCFBF1',
    fontSize: Typography.fontSize.xs - 1,
    marginTop: 2,
  },
  isolationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  isolationText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    color: '#0F766E',
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  queueHeading: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
  },
  viewAllText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.accent,
    fontWeight: '700',
  },
  appCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadowColor,
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  appNumberGroup: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  appNumber: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  serviceName: {
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  citizenDetailsBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    marginVertical: Spacing.xs,
    gap: 4,
  },
  citizenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  citizenLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  citizenValue: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  deptScope: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  deptScopeText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.accent,
    fontWeight: '700',
  },
  reviewButton: {
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: 4,
  },
  reviewButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
});
