import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { ApplicationVerification } from '../../types';
import { Ionicons } from '@expo/vector-icons';

interface VerificationTimelineProps {
  verifications: ApplicationVerification[];
  applicationNumber?: string;
  isCitizenView?: boolean;
}

export const VerificationTimeline: React.FC<VerificationTimelineProps> = ({
  verifications,
  applicationNumber,
  isCitizenView = true,
}) => {
  // Ensure we have the 5 standard verification slots represented even if empty initially
  const defaultSlots: Array<{
    key: 'DEPT_A' | 'DEPT_B' | 'DEPT_C' | 'ADMIN' | 'AUDITOR';
    title: string;
    subtext: string;
  }> = [
    { key: 'DEPT_A', title: 'Department A', subtext: 'Revenue & Civil Supplies' },
    { key: 'DEPT_B', title: 'Department B', subtext: 'Social Welfare & Inclusion' },
    { key: 'DEPT_C', title: 'Department C', subtext: 'Labour & Employment Welfare' },
    { key: 'ADMIN', title: 'Administrator', subtext: 'State Administration Review' },
    { key: 'AUDITOR', title: 'Compliance Review', subtext: 'Independent Auditor Oversight' },
  ];

  const getRecordForKey = (key: string) => {
    return verifications.find((v) => {
      if (v.verifierKey === key || (v.verifierRole as string) === key) return true;
      if (
        key === 'DEPT_A' &&
        (v.verifierKey === 'DEPARTMENT_A' ||
          (v.verifierRole as string) === 'DEPARTMENT_A' ||
          v.departmentId === 'DEPARTMENT_A' ||
          v.departmentId === 'DEPT_A')
      ) {
        return true;
      }
      if (
        key === 'DEPT_B' &&
        (v.verifierKey === 'DEPARTMENT_B' ||
          (v.verifierRole as string) === 'DEPARTMENT_B' ||
          v.departmentId === 'DEPARTMENT_B' ||
          v.departmentId === 'DEPT_B')
      ) {
        return true;
      }
      if (
        key === 'DEPT_C' &&
        (v.verifierKey === 'DEPARTMENT_C' ||
          (v.verifierRole as string) === 'DEPARTMENT_C' ||
          v.departmentId === 'DEPARTMENT_C' ||
          v.departmentId === 'DEPT_C')
      ) {
        return true;
      }
      return false;
    });
  };


  const verifiedCount = verifications.filter((v) => v.status === 'VERIFIED').length;
  const progressPercent = Math.min(100, Math.round((verifiedCount / 5) * 100));

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.cardTitle}>Application Verification</Text>
          {applicationNumber ? (
            <Text style={styles.appNumber}>{applicationNumber}</Text>
          ) : null}
        </View>
        <View style={styles.badgeContainer}>
          <Text style={styles.badgeText}>{verifiedCount} / 5 completed</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
      </View>

      {/* 5-Step Stepper */}
      <View style={styles.stepperContainer}>
        {defaultSlots.map((slot, index) => {
          const record = getRecordForKey(slot.key);
          const isVerified = record?.status === 'VERIFIED';
          const isRejected = record?.status === 'REJECTED';
          const isPending = !isVerified && !isRejected;

          return (
            <View key={slot.key} style={styles.stepItem}>
              {/* Connector line */}
              {index < defaultSlots.length - 1 && (
                <View
                  style={[
                    styles.verticalLine,
                    isVerified && styles.verticalLineCompleted,
                  ]}
                />
              )}

              {/* Status icon circle */}
              <View
                style={[
                  styles.iconCircle,
                  isVerified && styles.iconCircleVerified,
                  isRejected && styles.iconCircleRejected,
                  isPending && styles.iconCirclePending,
                ]}
              >
                {isVerified ? (
                  <Ionicons name="checkmark" size={16} color={Colors.textInverse} />
                ) : isRejected ? (
                  <Ionicons name="close" size={16} color={Colors.textInverse} />
                ) : (
                  <Ionicons name="time-outline" size={14} color={Colors.warning} />
                )}
              </View>

              {/* Details */}
              <View style={styles.stepContent}>
                <View style={styles.titleRow}>
                  <Text style={styles.stepTitle}>{slot.title}</Text>
                  <Text
                    style={[
                      styles.statusLabel,
                      isVerified && styles.statusLabelVerified,
                      isRejected && styles.statusLabelRejected,
                    ]}
                  >
                    {isVerified ? '✓ Verified' : isRejected ? '✗ Rejected' : '○ Pending'}
                  </Text>
                </View>
                <Text style={styles.stepSubtext}>{slot.subtext}</Text>
                {record?.verifiedAt ? (
                  <Text style={styles.timestamp}>
                    Verified on {new Date(record.verifiedAt).toLocaleDateString()}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {isCitizenView && (
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={16} color={Colors.info} />
          <Text style={styles.infoText}>
            This status is verified directly by government authorities. No action is required from you.
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadowColor,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    marginVertical: Spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  cardTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  appNumber: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  badgeContainer: {
    backgroundColor: Colors.primarySubtle,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.full,
    marginVertical: Spacing.sm,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.full,
  },
  stepperContainer: {
    marginTop: Spacing.sm,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  verticalLine: {
    position: 'absolute',
    left: 14,
    top: 28,
    bottom: -16,
    width: 2,
    backgroundColor: Colors.border,
    zIndex: 1,
  },
  verticalLineCompleted: {
    backgroundColor: Colors.success,
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    marginRight: Spacing.sm,
  },
  iconCircleVerified: {
    backgroundColor: Colors.success,
  },
  iconCircleRejected: {
    backgroundColor: Colors.danger,
  },
  iconCirclePending: {
    backgroundColor: Colors.warningLight,
    borderWidth: 1.5,
    borderColor: Colors.warning,
  },
  stepContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  statusLabel: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.warning,
  },
  statusLabelVerified: {
    color: Colors.success,
  },
  statusLabelRejected: {
    color: Colors.danger,
  },
  stepSubtext: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  timestamp: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  infoText: {
    flex: 1,
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.info,
    lineHeight: 16,
  },
});
