import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../store/AuthContext';
import { Colors, Spacing, Typography } from '../../constants/theme';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: string[];
  requireApproved?: boolean;
}

export function RoleGuard({ children, allowedRoles, requireApproved = true }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const userRole = user?.role ? String(user.role).toUpperCase() : '';
  const userStatus = user?.status ? String(user.status).toUpperCase() : '';

  const isRoleAllowed = allowedRoles.map((r) => r.toUpperCase()).includes(userRole);
  const isApproved = userStatus === 'APPROVED';

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    if (userStatus === 'SUSPENDED' || userStatus === 'REJECTED') {
      router.replace('/(auth)/login');
      return;
    }

    if (requireApproved && !isApproved) {
      router.replace('/(pending)');
      return;
    }

    if (!isRoleAllowed) {
      // Redirect to the user's appropriate portal based on their actual role
      switch (userRole) {
        case 'CITIZEN':
          router.replace('/(citizen)/(tabs)');
          break;
        case 'DEPARTMENT_A':
        case 'DEPARTMENT_B':
        case 'DEPARTMENT_C':
        case 'DEPARTMENT_OFFICER':
          router.replace('/(department)/(tabs)');
          break;
        case 'ADMIN':
          router.replace('/(admin)/(tabs)');
          break;
        case 'AUDITOR':
          router.replace('/(auditor)/(tabs)');
          break;
        default:
          router.replace('/(auth)/login');
      }
    }
  }, [user, loading, userRole, userStatus, isRoleAllowed, isApproved, requireApproved]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Verifying authorization...</Text>
      </View>
    );
  }

  if (!user || (requireApproved && !isApproved) || !isRoleAllowed) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    marginTop: Spacing.md,
  },
});
