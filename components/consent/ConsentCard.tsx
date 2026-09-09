import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { Consent } from '../../types';
import { Ionicons } from '@expo/vector-icons';
import { StatusBadge } from '../common/StatusBadge';

interface ConsentCardProps {
  consent: Consent;
  onGrant?: (id: string) => void;
  onDeny?: (id: string) => void;
}

export const ConsentCard: React.FC<ConsentCardProps> = ({ consent, onGrant, onDeny }) => {
  const isPending = consent.status === 'PENDING';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.badgeRow}>
          <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
          <Text style={styles.cardHeader}>DATA SHARING REQUEST</Text>
        </View>
        <StatusBadge status={consent.status} size="sm" />
      </View>

      <View style={styles.departmentBlock}>
        <Text style={styles.label}>Requesting Department:</Text>
        <Text style={styles.deptName}>{consent.targetDepartmentName}</Text>
      </View>

      <View style={styles.detailBlock}>
        <Text style={styles.label}>Purpose of Access:</Text>
        <Text style={styles.detailText}>{consent.purpose}</Text>
      </View>

      <View style={styles.fieldsBlock}>
        <Text style={styles.label}>Information to be Shared:</Text>
        <View style={styles.fieldsList}>
          {consent.sharedFields.map((field, idx) => (
            <View key={idx} style={styles.fieldChip}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={styles.fieldText}>{field}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Application: {consent.applicationNumber || 'MS-10001'}</Text>
        <Text style={styles.footerText}>
          Requested: {new Date(consent.createdAt).toLocaleDateString()}
        </Text>
      </View>

      {/* Action Buttons for Citizen */}
      {isPending && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnDeny]}
            onPress={() => onDeny && onDeny(consent.id)}
            accessibilityLabel="Deny data access"
          >
            <Ionicons name="close" size={16} color={Colors.danger} />
            <Text style={styles.btnDenyText}>Deny</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnGrant]}
            onPress={() => onGrant && onGrant(consent.id)}
            accessibilityLabel="Grant consent"
          >
            <Ionicons name="checkmark-sharp" size={16} color={Colors.textInverse} />
            <Text style={styles.btnGrantText}>Grant Consent</Text>
          </TouchableOpacity>
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
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
    marginVertical: Spacing.xs + 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cardHeader: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  departmentBlock: {
    marginBottom: Spacing.xs + 2,
  },
  label: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  deptName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  detailBlock: {
    marginBottom: Spacing.sm,
  },
  detailText: {
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  fieldsBlock: {
    marginBottom: Spacing.sm,
  },
  fieldsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 4,
  },
  fieldChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  fieldText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs + 2,
    marginTop: Spacing.xs,
  },
  footerText: {
    fontSize: Typography.fontSize.xs - 2,
    color: Colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  btnDeny: {
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  btnDenyText: {
    color: Colors.danger,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
  btnGrant: {
    backgroundColor: Colors.primary,
  },
  btnGrantText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
});
