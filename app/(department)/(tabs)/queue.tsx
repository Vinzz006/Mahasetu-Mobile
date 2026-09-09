import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { Header } from '../../../components/common/Header';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { applicationService } from '../../../services/applicationService';
import { Application } from '../../../types';
import { router } from 'expo-router';

export default function DepartmentQueueScreen() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [filterText, setFilterText] = useState('');
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

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      app.applicationNumber.toLowerCase().includes(filterText.toLowerCase()) ||
      app.citizenName.toLowerCase().includes(filterText.toLowerCase()) ||
      app.serviceTitle.toLowerCase().includes(filterText.toLowerCase());
    return matchesSearch;
  });

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
          <Text style={styles.deptScopeText}>Scope: {user?.departmentId} Verification</Text>
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
        title="Verification Queue"
        subtitle={deptLabel}
      />

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search applicant, app ID, service..."
            placeholderTextColor={Colors.textMuted}
            value={filterText}
            onChangeText={setFilterText}
          />
          {filterText ? (
            <TouchableOpacity onPress={() => setFilterText('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <FlatList
        data={filteredApps}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            icon="checkmark-done-circle-outline"
            title="Verification Queue Empty"
            description="No applications are currently awaiting verification for your department."
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
  searchContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
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
    fontWeight: '700',
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
    padding: Spacing.sm,
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
    fontWeight: '600',
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
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.accent,
    fontWeight: '600',
  },
  reviewButton: {
    backgroundColor: Colors.accent,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
});
