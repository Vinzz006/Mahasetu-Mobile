import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { Header } from '../../../components/common/Header';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

export default function AuditorVerificationsScreen() {
  const history = [
    {
      id: 'h-1',
      appNum: 'MS-10001',
      verifier: 'Department A — Revenue & Civil Supplies',
      officer: 'Vinesh S',
      status: 'VERIFIED',
      date: '08 Sep 2026, 09:15 AM',
      remarks: 'Certified income certificate and domicile token.',
    },
    {
      id: 'h-2',
      appNum: 'MS-10001',
      verifier: 'Department B — Social Welfare',
      officer: 'Sai Sharavan G',
      status: 'VERIFIED',
      date: '08 Sep 2026, 09:30 AM',
      remarks: 'Category entitlement approved against welfare database.',
    },
    {
      id: 'h-3',
      appNum: 'MS-10001',
      verifier: 'Department C — Labour & Employment',
      officer: 'Omesh Kaarthik S U',
      status: 'VERIFIED',
      date: '08 Sep 2026, 09:45 AM',
      remarks: 'Unemployed welfare registry match confirmed.',
    },
    {
      id: 'h-4',
      appNum: 'MS-10001',
      verifier: 'State Administrator',
      officer: 'Tammu Vedesh Kumar',
      status: 'VERIFIED',
      date: '08 Sep 2026, 10:00 AM',
      remarks: 'Administrative statutory compliance certified.',
    },
  ];

  return (
    <View style={styles.container}>
      <Header
        title="Verification History"
        subtitle="Chronological log of multi-person certifications"
      />

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.topRow}>
              <Text style={styles.appNum}>{item.appNum}</Text>
              <View style={styles.badge}>
                <Ionicons name="checkmark-circle" size={12} color={Colors.success} />
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
            </View>

            <Text style={styles.verifierTitle}>{item.verifier}</Text>
            <Text style={styles.officerName}>Officer: {item.officer}</Text>
            <Text style={styles.remarksText}>"{item.remarks}"</Text>

            <Text style={styles.dateText}>{item.date}</Text>
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
    alignItems: 'center',
    marginBottom: 4,
  },
  appNum: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
    color: Colors.primary,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    gap: 3,
  },
  badgeText: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '800',
    color: Colors.success,
  },
  verifierTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  officerName: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  remarksText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 16,
  },
  dateText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },
});
