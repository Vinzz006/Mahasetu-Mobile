import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { Application } from '../../types';
import { Ionicons } from '@expo/vector-icons';

interface VerificationMatrixProps {
  applications: Application[];
  verificationsMap?: Record<string, Record<string, 'VERIFIED' | 'PENDING' | 'REJECTED'>>;
  onSelectApplication?: (app: Application) => void;
}

export const VerificationMatrix: React.FC<VerificationMatrixProps> = ({
  applications,
  verificationsMap,
}) => {
  const getStageIndicator = (app: Application, roleKey: string) => {
    // 1. Check exact verification record from Firestore if mapped
    const status = verificationsMap?.[app.id]?.[roleKey];
    if (status === 'VERIFIED') {
      return { symbol: '✓', style: styles.symVerified };
    }
    if (status === 'REJECTED') {
      return { symbol: '✗', style: styles.symRejected };
    }
    if (status === 'PENDING') {
      return { symbol: '○', style: styles.symPending };
    }

    // 2. If application document itself records full verification
    if (app.verificationSummary?.isFullyVerified || app.status === 'APPLICATION_VERIFIED') {
      return { symbol: '✓', style: styles.symVerified };
    }

    // 3. Default pending
    return { symbol: '○', style: styles.symPending };
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cross-Department Verification Matrix</Text>
        <Text style={styles.subtitle}>All 5 government verifiers must approve for application completion</Text>
      </View>

      {applications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="grid-outline" size={28} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No Active Applications</Text>
          <Text style={styles.emptySubtitle}>
            Submitted applications will appear in this 5-stage verification matrix.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.columnHeader, styles.colApp]}>Application</Text>
              <Text style={[styles.columnHeader, styles.colCitizen]}>Citizen</Text>
              <Text style={[styles.columnHeader, styles.colDept]}>Dept A</Text>
              <Text style={[styles.columnHeader, styles.colDept]}>Dept B</Text>
              <Text style={[styles.columnHeader, styles.colDept]}>Dept C</Text>
              <Text style={[styles.columnHeader, styles.colDept]}>Admin</Text>
              <Text style={[styles.columnHeader, styles.colDept]}>Auditor</Text>
              <Text style={[styles.columnHeader, styles.colStatus]}>Progress</Text>
            </View>

            {/* Rows */}
            {applications.map((app, index) => {
              const verified = app.verificationSummary?.verifiedCount || 0;
              const isCompleted = verified === 5 || app.verificationSummary?.isFullyVerified;

              const stageA = getStageIndicator(app, 'DEPARTMENT_A');
              const stageB = getStageIndicator(app, 'DEPARTMENT_B');
              const stageC = getStageIndicator(app, 'DEPARTMENT_C');
              const stageAdmin = getStageIndicator(app, 'ADMIN');
              const stageAuditor = getStageIndicator(app, 'AUDITOR');

              return (
                <View
                  key={app.id || index}
                  style={[
                    styles.tableRow,
                    index % 2 === 1 && styles.tableRowEven,
                    app.status === 'REJECTED' && styles.tableRowRejected,
                  ]}
                >
                  <Text style={[styles.cellText, styles.colApp, styles.bold]}>
                    {app.applicationNumber}
                  </Text>
                  <Text style={[styles.cellText, styles.colCitizen]} numberOfLines={1}>
                    {app.citizenName}
                  </Text>

                  <View style={[styles.colDept, styles.center]}>
                    <Text style={[styles.statusSymbol, stageA.style]}>
                      {stageA.symbol}
                    </Text>
                  </View>

                  <View style={[styles.colDept, styles.center]}>
                    <Text style={[styles.statusSymbol, stageB.style]}>
                      {stageB.symbol}
                    </Text>
                  </View>

                  <View style={[styles.colDept, styles.center]}>
                    <Text style={[styles.statusSymbol, stageC.style]}>
                      {stageC.symbol}
                    </Text>
                  </View>

                  <View style={[styles.colDept, styles.center]}>
                    <Text style={[styles.statusSymbol, stageAdmin.style]}>
                      {stageAdmin.symbol}
                    </Text>
                  </View>

                  <View style={[styles.colDept, styles.center]}>
                    <Text style={[styles.statusSymbol, stageAuditor.style]}>
                      {stageAuditor.symbol}
                    </Text>
                  </View>

                  <View style={[styles.colStatus, styles.center]}>
                    <View
                      style={[
                        styles.scoreBadge,
                        isCompleted ? styles.scoreCompleted : styles.scorePending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.scoreText,
                          isCompleted ? styles.scoreTextCompleted : styles.scoreTextPending,
                        ]}
                      >
                        {isCompleted ? '5/5' : `${verified}/5`}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  header: {
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  title: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
  },
  table: {
    minWidth: 540,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSubtle,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  columnHeader: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tableRowEven: {
    backgroundColor: '#FAFAFA',
  },
  tableRowRejected: {
    backgroundColor: Colors.dangerLight,
  },
  colApp: {
    width: 90,
  },
  colCitizen: {
    width: 100,
  },
  colDept: {
    width: 55,
    alignItems: 'center',
  },
  colStatus: {
    width: 70,
    alignItems: 'center',
  },
  center: {
    justifyContent: 'center',
  },
  cellText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
  },
  bold: {
    fontWeight: '700',
    color: Colors.primary,
  },
  statusSymbol: {
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
  },
  symVerified: {
    color: Colors.success,
  },
  symPending: {
    color: Colors.textMuted,
  },
  symRejected: {
    color: Colors.danger,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
    maxWidth: 280,
  },
  scoreBadge: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
  },
  scorePending: {
    backgroundColor: Colors.warningLight,
  },
  scoreCompleted: {
    backgroundColor: Colors.successLight,
  },
  scoreText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  scoreTextPending: {
    color: Colors.warning,
  },
  scoreTextCompleted: {
    color: Colors.success,
  },
});
