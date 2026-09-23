import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { Header } from '../../../components/common/Header';
import { ConsentCard } from '../../../components/consent/ConsentCard';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { consentService } from '../../../services/consentService';
import { Consent } from '../../../types';

export default function CitizenConsentScreen() {
  const { user } = useAuth();
  const [consents, setConsents] = useState<Consent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const unsub = consentService.subscribeToConsents(
      user,
      (list) => {
        setConsents(list);
        setLoading(false);
      },
      (err) => {
        setError(err || 'Failed to load consent requests');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    setError(null);
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleGrant = async (id: string) => {
    try {
      await consentService.grantConsent(id);
      setConsents((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'GRANTED', grantedAt: new Date().toISOString() } : c))
      );
      Alert.alert('Consent Granted', 'Your consent was recorded securely. The department may now access the approved fields.');
    } catch {
      Alert.alert('Error', 'Failed to update consent.');
    }
  };

  const handleDeny = async (id: string) => {
    try {
      await consentService.denyConsent(id);
      setConsents((prev) =>
        prev.map((c) => (c.id === id ? { ...c, status: 'DENIED', deniedAt: new Date().toISOString() } : c))
      );
      Alert.alert('Consent Denied', 'Department access has been blocked.');
    } catch {
      Alert.alert('Error', 'Failed to update consent.');
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Data Sharing & Consent"
        subtitle="You control which departments access your information"
      />

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading consent requests...</Text>
        </View>
      ) : (
        <FlatList
          data={consents}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConsentCard consent={item} onGrant={handleGrant} onDeny={handleDeny} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <View>
              {error && (
                <View style={styles.errorBanner}>
                  <Ionicons name="alert-circle" size={20} color={Colors.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
              <View style={styles.banner}>
                <Ionicons name="shield-checkmark" size={20} color={Colors.accent} />
                <View style={styles.bannerContent}>
                  <Text style={styles.bannerTitle}>Granular Citizen Consent</Text>
                  <Text style={styles.bannerText}>
                    No government department can access your private data without your explicit permission. Each exchange is strictly scoped to the stated purpose.
                  </Text>
                </View>
              </View>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="shield-outline"
              title="No Consent Requests"
              description="You have no pending data-sharing requests at this time."
            />
          }
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
    alignItems: 'flex-start',
    backgroundColor: Colors.accentLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#99F6E4',
    gap: Spacing.sm,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: '#115E59',
  },
  bannerText: {
    fontSize: Typography.fontSize.xs,
    color: '#0F766E',
    marginTop: 2,
    lineHeight: 18,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.danger,
    fontWeight: '500',
  },
});
