import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Typography, Spacing } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toUpperCase();

  let bg = Colors.surfaceSubtle;
  let textColor = Colors.textSecondary;
  let iconName: any = 'time-outline';
  let label = status;

  switch (normalized) {
    case 'VERIFIED':
    case 'APPROVED':
    case 'APPLICATION_VERIFIED':
    case 'COMPLETED':
      bg = Colors.successLight;
      textColor = Colors.success;
      iconName = 'checkmark-circle';
      label = normalized === 'APPLICATION_VERIFIED' ? '5/5 VERIFIED' : normalized;
      break;

    case 'PENDING':
    case 'PENDING_APPROVAL':
    case 'UNDER_VERIFICATION':
    case 'APPLICATION_SUBMITTED':
      bg = Colors.warningLight;
      textColor = Colors.warning;
      iconName = 'hourglass-outline';
      label = normalized === 'UNDER_VERIFICATION' ? 'UNDER VERIFICATION' : (normalized === 'PENDING_APPROVAL' ? 'PENDING' : normalized);
      break;

    case 'REJECTED':
    case 'SUSPENDED':
    case 'DENIED':
    case 'FAILED':
      bg = Colors.dangerLight;
      textColor = Colors.danger;
      iconName = 'close-circle';
      label = normalized;
      break;

    case 'GRANTED':
      bg = Colors.accentLight;
      textColor = Colors.accent;
      iconName = 'shield-checkmark';
      label = 'CONSENT GRANTED';
      break;

    default:
      bg = Colors.surfaceSubtle;
      textColor = Colors.textSecondary;
      iconName = 'ellipse';
      label = normalized;
  }

  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: bg }, isSmall && styles.badgeSmall]}>
      <Ionicons name={iconName} size={isSmall ? 12 : 14} color={textColor} style={styles.icon} />
      <Text style={[styles.text, { color: textColor }, isSmall && styles.textSmall]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingVertical: 2,
    paddingHorizontal: Spacing.xs + 2,
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textSmall: {
    fontSize: Typography.fontSize.xs - 2,
  },
});
