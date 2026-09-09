import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Header } from '../../../components/common/Header';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { CanonicalDataExchange } from '../../../types';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

export default function AdminExchangesScreen() {
  const [exchanges, setExchanges] = useState<CanonicalDataExchange[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);
    const colRef = collection(db, 'dataExchanges');
    const q = query(colRef, orderBy('timestamp', 'desc'), limit(50));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: CanonicalDataExchange[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            exchangeId: data.exchangeId || d.id,
            applicationId: data.applicationId || '',
            applicationNumber: data.applicationNumber || '',
            sourceDepartment: data.sourceDepartment || 'DEPARTMENT_A',
            targetDepartment: data.targetDepartment || 'DEPARTMENT_B',
            consentId: data.consentId || '',
            purpose: data.purpose || 'Statutory Verification & Data Reuse',
            fields: data.fields || [],
            canonicalSchema: data.canonicalSchema || 'gov.mahasetu.canonical.v1',
            transformationVersion: data.transformationVersion || '1.0.0',
            sourceSchema: data.sourceSchema || 'dept_a.resident.v1',
            targetSchema: data.targetSchema || 'dept_b.applicant.v1',
            status: data.status || 'SUCCESS',
            timestamp: data.timestamp?.toDate?.()?.toISOString() || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          });
        });
        setExchanges(list);
        setLoading(false);
      },
      (err) => {
        console.warn('dataExchanges listener warning:', err.message);
        setExchanges([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  return (
    <View style={styles.container}>
      <Header
        title="Canonical Data Exchanges"
        subtitle="Interoperability adapter pipeline & schema transformations"
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading interoperability pipeline telemetry...</Text>
        </View>
      ) : (
        <FlatList
          data={exchanges}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.pipelineCard}>
              <View style={styles.pipelineHeader}>
                <Ionicons name="git-network-outline" size={20} color={Colors.primary} />
                <Text style={styles.pipelineTitle}>Backend Canonical Pipeline</Text>
              </View>
              <Text style={styles.pipelineFlow}>
                Dept A Adapter ➔ Canonical Model ➔ Consent Validation ➔ Transformation ➔ Dept B Adapter
              </Text>
              <Text style={styles.pipelineNote}>
                Transformations run strictly on the trusted backend with consent validation.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="swap-horizontal-outline"
              title="No Canonical Data Exchanges"
              description="Cross-department schema transformations and data exchanges will appear here as applications progress."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.exchangeId}>{item.exchangeId}</Text>
                  <Text style={styles.appRef}>Application: {item.applicationNumber}</Text>
                </View>
                <StatusBadge status={item.status} size="sm" />
              </View>

              <View style={styles.deptRouteRow}>
                <View style={styles.deptBox}>
                  <Text style={styles.deptLabel}>SOURCE</Text>
                  <Text style={styles.deptName}>{item.sourceDepartment}</Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
                <View style={styles.deptBox}>
                  <Text style={styles.deptLabel}>TARGET</Text>
                  <Text style={styles.deptName}>{item.targetDepartment}</Text>
                </View>
              </View>

              <Text style={styles.purposeText}>{item.purpose}</Text>

              <View style={styles.footerRow}>
                <Text style={styles.schemaText}>Schema: {item.canonicalSchema}</Text>
                <Text style={styles.timeText}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
  pipelineCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pipelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  pipelineTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pipelineFlow: {
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
    lineHeight: 18,
    marginBottom: 4,
  },
  pipelineNote: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  exchangeId: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  appRef: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
    marginTop: 1,
  },
  deptRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.sm,
    padding: Spacing.xs + 2,
    marginBottom: Spacing.xs,
  },
  deptBox: {
    alignItems: 'center',
  },
  deptLabel: {
    fontSize: Typography.fontSize.xs - 3,
    color: Colors.textMuted,
    fontWeight: '700',
  },
  deptName: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  purposeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
  },
  schemaText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
  },
  timeText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
  },
});
