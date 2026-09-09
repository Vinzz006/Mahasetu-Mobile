import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Alert } from 'react-native';
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
  const [refreshing, setRefreshing] = useState(false);

  // Prepopulate standard demo consent requests if list is initially empty
  useEffect(() => {
    if (!user) return;
    const unsub = consentService.subscribeToConsents(user, (list) => {
      if (list.length === 0) {
        // Provide representative default consent record for demonstration
        setConsents([
          {
            id: 'c-101',
            applicationId: 'app_1',
            applicationNumber: 'MS-10001',
            citizenUid: user.uid,
            sourceDepartment: 'Department A',
            targetDepartment: 'DEPT_B',
            targetDepartmentName: 'Department B — Social Welfare & Inclusion',
            purpose: 'Eligibility Verification & Domicile Check',
            sharedFields: ['Legal Name', 'Mobile Number', 'City / District'],
            status: 'PENDING',
            expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
            createdAt: new Date().toISOString(),
          },
          {
            id: 'c-102',
            applicationId: 'app_1',
            applicationNumber: 'MS-10001',
            citizenUid: user.uid,
            sourceDepartment: 'Department B',
            targetDepartment: 'DEPT_C',
            targetDepartmentName: 'Department C — Labour & Employment Welfare',
            purpose: 'Employment Allowance Registry Check',
            sharedFields: ['Legal Name', 'Aadhaar Reference', 'Employment Category'],
            status: 'GRANTED',
            grantedAt: new Date(Date.now() - 86400000).toISOString(),
            expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
            createdAt: new Date(Date.now() - 86400000).toISOString(),
          },
        ]);
      } else {
        setConsents(list);
      }
    });

    return () => unsub();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
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

      <FlatList
        data={consents}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConsentCard consent={item} onGrant={handleGrant} onDeny={handleDeny} />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View style={styles.banner}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.accent} />
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>Granular Citizen Consent</Text>
              <Text style={styles.bannerText}>
                No government department can access your private data without your explicit permission. Each exchange is strictly scoped to the stated purpose.
              </Text>
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
});
