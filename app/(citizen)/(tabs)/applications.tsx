import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { Header } from '../../../components/common/Header';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { applicationService } from '../../../services/applicationService';
import { Application } from '../../../types';
import { router } from 'expo-router';

export default function CitizenApplicationsScreen() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const unsub = applicationService.subscribeToApplications(
      user,
      (list) => {
        setApplications(list);
        setLoading(false);
      },
      (err) => {
        setError(err || 'Failed to load applications');
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    setError(null);
    setTimeout(() => setRefreshing(false), 800);
  };

  const renderItem = ({ item }: { item: Application }) => {
    const verified = item.verificationSummary?.verifiedCount || 0;
    const isCompleted = verified === 5;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/(citizen)/application/${item.id}`)}
        accessibilityLabel={`View application ${item.applicationNumber}`}
      >
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.appNum}>{item.applicationNumber}</Text>
            <Text style={styles.serviceTitle}>{item.serviceTitle}</Text>
          </View>
          <StatusBadge status={item.status} size="sm" />
        </View>

        {/* 5-part progress stepper preview */}
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>5-Party Verification:</Text>
          <Text style={[styles.progressScore, isCompleted && styles.progressScoreCompleted]}>
            {verified} / 5 completed
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, (verified / 5) * 100)}%` },
              isCompleted && styles.progressFillCompleted,
            ]}
          />
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.dateText}>
            Submitted on {new Date(item.submissionDate).toLocaleDateString()}
          </Text>
          <View style={styles.actionRow}>
            <Text style={styles.trackText}>Track Status</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="My Applications"
        subtitle="Real-time multi-department verification status"
      />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading applications...</Text>
        </View>
      ) : (
        <FlatList
          data={applications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            error ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={20} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title="No Applications Submitted"
              description="Explore the services catalogue to apply. Your information will be reused securely."
            />
          }
        />
      )}
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
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  appNum: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  serviceTitle: {
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    marginTop: 2,
  },
  progressLabel: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  progressScore: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.warning,
  },
  progressScoreCompleted: {
    color: Colors.success,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.warning,
  },
  progressFillCompleted: {
    backgroundColor: Colors.success,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
  },
  dateText: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trackText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    fontWeight: '700',
  },
  centerLoading: {
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
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.danger,
    fontWeight: '500',
  },
});
