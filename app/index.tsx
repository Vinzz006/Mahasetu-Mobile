import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../store/AuthContext';
import { Colors, Spacing, Typography } from '../constants/theme';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/(auth)/login');
      return;
    }

    if (user.status === 'PENDING' || user.role === 'pending' || !user.role) {
      router.replace('/(pending)');
      return;
    }

    const role = user.role ? String(user.role).toUpperCase() : '';
    switch (role) {
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
  }, [user, loading]);

  return (
    <View style={styles.container}>
      <View style={styles.logoBadge}>
        <Image
          source={require('../assets/images/indian-flag.png')}
          style={styles.logo}
          resizeMode="cover"
          accessibilityLabel="Indian National Flag"
        />
      </View>
      <Text style={styles.brandTitle}>MAHASETU</Text>
      <Text style={styles.tagline}>Government Of Maharashtra</Text>
      <ActivityIndicator size="large" color={Colors.primaryLight} style={styles.spinner} />
      <Text style={styles.loadingText}>Verifying credentials & claims...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  logoBadge: {
    width: 72,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  logo: {
    width: 72,
    height: 48,
    borderRadius: 8,
  },
  brandTitle: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.title,
    fontWeight: '800',
    letterSpacing: 2,
  },
  tagline: {
    color: '#93C5FD',
    fontSize: Typography.fontSize.sm,
    marginTop: 4,
    textAlign: 'center',
  },
  spinner: {
    marginTop: Spacing.xl,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSize.xs,
    marginTop: Spacing.sm,
  },
});
