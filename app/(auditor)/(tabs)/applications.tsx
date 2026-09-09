import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Header } from '../../../components/common/Header';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { applicationService } from '../../../services/applicationService';
import { Application } from '../../../types';
import { router } from 'expo-router';

export default function AuditorApplicationsScreen() {
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

  return (
    <View style={styles.container}>
      <Header
        title="Application Compliance Review"
        subtitle="Independent statutory verification oversight"
      />

      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const verified = item.verificationSummary?.verifiedCount || 0;
          const isCompleted = verified === 5;

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(auditor)/review/${item.id}`)}
              accessibilityLabel={`Review application ${item.applicationNumber}`}
            >
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.appNum}>{item.applicationNumber}</Text>
                  <Text style={styles.serviceName}>{item.serviceTitle}</Text>
                  <Text style={styles.citizenName}>Applicant: {item.citizenName}</Text>
                </View>
                <StatusBadge status={item.status} size="sm" />
              </View>

              <View style={styles.scoreRow}>
                <Text style={styles.scoreLabel}>5-Party Completion Progress:</Text>
                <Text style={[styles.scoreVal, isCompleted && styles.scoreValCompleted]}>
                  {verified} / 5 verifiers approved
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
                  Submitted: {new Date(item.submissionDate).toLocaleDateString()}
                </Text>
                <View style={styles.actionBtn}>
                  <Text style={styles.actionBtnText}>Audit & Verify</Text>
                  <Ionicons name="chevron-forward" size={14} color="#7C3AED" />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title="No Applications"
            description="No applications currently filed for compliance review."
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
  cardTop: {
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
  serviceName: {
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  citizenName: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  scoreLabel: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  scoreVal: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.warning,
  },
  scoreValCompleted: {
    color: Colors.success,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
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
    paddingTop: Spacing.xs + 2,
  },
  dateText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionBtnText: {
    fontSize: Typography.fontSize.xs,
    color: '#7C3AED',
    fontWeight: '700',
  },
});
