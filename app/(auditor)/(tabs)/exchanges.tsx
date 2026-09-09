import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Header } from '../../../components/common/Header';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { CanonicalDataExchange } from '../../../types';

export default function AuditorExchangesScreen() {
  const exchanges: CanonicalDataExchange[] = [
    {
      id: 'ex-1',
      exchangeId: 'XCHG-2026-9901',
      applicationId: 'app_1',
      applicationNumber: 'MS-10001',
      sourceDepartment: 'DEPT_A',
      targetDepartment: 'DEPT_B',
      consentId: 'c-101',
      purpose: 'Eligibility Verification & Entitlement Check',
      fields: ['citizenName', 'mobileNumber', 'verifiedIncome'],
      canonicalSchema: 'gov.mahasetu.canonical.v1',
      transformationVersion: '1.2.0',
      sourceSchema: 'revenue.dept_a.resident.v2',
      targetSchema: 'welfare.dept_b.applicant.v1',
      status: 'SUCCESS',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 'ex-2',
      exchangeId: 'XCHG-2026-9902',
      applicationId: 'app_1',
      applicationNumber: 'MS-10001',
      sourceDepartment: 'DEPT_B',
      targetDepartment: 'DEPT_C',
      consentId: 'c-102',
      purpose: 'Employment Allowance Registry Check',
      fields: ['aadhaarRef', 'category', 'employmentStatus'],
      canonicalSchema: 'gov.mahasetu.canonical.v1',
      transformationVersion: '1.2.0',
      sourceSchema: 'welfare.dept_b.applicant.v1',
      targetSchema: 'labour.dept_c.registry.v3',
      status: 'SUCCESS',
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
  ];

  return (
    <View style={styles.container}>
      <Header
        title="Data Exchange Oversight"
        subtitle="Read-only compliance audit of canonical transformations"
      />

      <FlatList
        data={exchanges}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.noticeCard}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#7C3AED" />
            <Text style={styles.noticeText}>
              Auditor View: Schema mapping versions, consent validity, and data-minimization rules are verified for GDPR/DPDP Act compliance.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.topRow}>
              <Text style={styles.exchangeId}>{item.exchangeId}</Text>
              <Text style={styles.appRef}>Application: {item.applicationNumber}</Text>
            </View>

            <Text style={styles.routeText}>
              {item.sourceDepartment} ➔ {item.targetDepartment} ({item.purpose})
            </Text>

            <View style={styles.box}>
              <Text style={styles.boxLabel}>Canonical Schema: {item.canonicalSchema} (v{item.transformationVersion})</Text>
              <Text style={styles.boxLabel}>Consent Token: {item.consentId} (Verified ✓)</Text>
              <Text style={styles.boxLabel}>Shared: {item.fields.join(', ')}</Text>
            </View>

            <Text style={styles.timeText}>{new Date(item.timestamp).toLocaleString()}</Text>
          </View>
        )}
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
  noticeCard: {
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
  noticeText: {
    fontSize: Typography.fontSize.xs,
    color: '#6D28D9',
    flex: 1,
    lineHeight: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  exchangeId: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '800',
    color: '#7C3AED',
  },
  appRef: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  routeText: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  box: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginVertical: Spacing.xs,
    gap: 2,
  },
  boxLabel: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textSecondary,
  },
  timeText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'right',
  },
});
