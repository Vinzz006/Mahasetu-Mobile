import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Header } from '../../../components/common/Header';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { AuditLogItem } from '../../../types';
import { auditService } from '../../../services/auditService';
import { EmptyState } from '../../../components/common/EmptyState';

export default function AuditorAuditScreen() {
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auditService.subscribeToAuditLogs((logs) => {
      setAuditLogs(logs);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <View style={styles.container}>
      <Header
        title="Compliance Audit Log"
        subtitle="Read-only statutory inspection log"
      />

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#7C3AED" />
        </View>
      ) : (
        <FlatList
          data={auditLogs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.banner}>
              <Ionicons name="lock-closed" size={18} color="#7C3AED" />
              <Text style={styles.bannerText}>
                Audit Record Immutability: The Compliance Auditor holds read-only rights over the audit trail. No entries can be edited or pruned.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="document-text-outline"
              title="No Audit Records"
              description="No audit logs recorded yet in statutory registry."
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
                Actor: {item.actorName} ({item.actorRole})
              </Text>
              <Text style={styles.targetText}>Target: {item.targetId}</Text>
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
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  bannerText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    color: '#6D28D9',
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
    backgroundColor: '#EDE9FE',
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  actionText: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '800',
    color: '#7C3AED',
    letterSpacing: 0.5,
  },
  timeText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
  },
  detailsText: {
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
    lineHeight: 18,
    marginVertical: Spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  actorText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  targetText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
  },
});
