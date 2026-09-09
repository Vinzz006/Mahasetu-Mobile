import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Header } from '../../../components/common/Header';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { auditService } from '../../../services/auditService';
import { AuditLogItem } from '../../../types';

export default function AdminAuditScreen() {
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    const unsub = auditService.subscribeToAuditLogs((logs) => {
      setAuditLogs(logs);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <View style={styles.container}>
      <Header
        title="Immutable Audit Trail"
        subtitle="Cryptographically logged government events"
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading immutable audit trail...</Text>
        </View>
      ) : (
        <FlatList
          data={auditLogs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.banner}>
              <Ionicons name="finger-print" size={20} color={Colors.primary} />
              <Text style={styles.bannerText}>
                Every action on MahaSetu generates an immutable audit entry. Audit records are generated strictly by backend services and cannot be altered by users.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title="No Audit Records"
              description="Administrative actions, verifications, and approvals will generate tamper-evident audit entries."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.logCard}>
              <View style={styles.logHeader}>
                <View style={styles.actionPill}>
                  <Text style={styles.actionText}>{item.action}</Text>
                </View>
                <Text style={styles.timeText}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              <Text style={styles.detailsText}>{item.details}</Text>

              <View style={styles.footerRow}>
                <Text style={styles.actorText}>
                  Actor: <Text style={styles.bold}>{item.actorName}</Text> ({item.actorRole})
                </Text>
                <Text style={styles.dateText}>
                  {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
              </View>
            </View>
          )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  bannerText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    lineHeight: 18,
  },
  logCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  actionPill: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
  },
  actionText: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '700',
    color: '#D97706',
  },
  timeText: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
  },
  detailsText: {
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
  },
  actorText: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textSecondary,
  },
  bold: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  dateText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
  },
});
