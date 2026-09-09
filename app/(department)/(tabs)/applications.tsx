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

export default function DepartmentApplicationsScreen() {
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
        title="Department Records"
        subtitle={`All applications involving ${user?.departmentId || 'Department'}`}
      />

      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(department)/review/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.appNum}>{item.applicationNumber}</Text>
                <Text style={styles.serviceName}>{item.serviceTitle}</Text>
              </View>
              <StatusBadge status={item.status} size="sm" />
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoText}>Citizen: {item.citizenName}</Text>
              <Text style={styles.infoText}>Location: {item.citizenCity}</Text>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.scoreText}>
                5/5 Verification Progress: {item.verificationSummary?.verifiedCount || 0} approved
              </Text>
              <View style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Review</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.accent} />
              </View>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title="No Records Found"
            description="No applications currently filed under this departmental purview."
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
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
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: Spacing.xs,
  },
  infoText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs + 2,
    marginTop: Spacing.xs,
  },
  scoreText: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  actionBtnText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.accent,
    fontWeight: '700',
  },
});
