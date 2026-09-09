import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Header } from '../../../components/common/Header';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import {
  adminDashboardService,
  CitizenVerificationItem,
} from '../../../services/adminDashboardService';
import { authService } from '../../../services/authService';

export default function AdminCitizensScreen() {
  const [citizens, setCitizens] = useState<CitizenVerificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const unsub = adminDashboardService.subscribeToCitizenIdentityQueue(
      (queue) => {
        setCitizens(queue);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleVerify = async (uid: string, name: string) => {
    setProcessingUid(uid);
    try {
      await authService.verifyCitizenIdentity(uid, true);
      setCitizens((prev) =>
        prev.map((c) => (c.uid === uid ? { ...c, isVerified: true, status: 'VERIFIED' } : c))
      );
      Alert.alert(
        'Citizen Identity Verified',
        `Identity dossier for ${name} has been certified for cross-department data reuse.`
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to verify citizen');
    } finally {
      setProcessingUid(null);
    }
  };

  const handleReject = async (uid: string, name: string) => {
    setProcessingUid(uid);
    try {
      await authService.verifyCitizenIdentity(uid, false);
      setCitizens((prev) =>
        prev.map((c) => (c.uid === uid ? { ...c, isVerified: false, status: 'REJECTED' } : c))
      );
      Alert.alert('Verification Rejected', `Identity record for ${name} was rejected.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to reject citizen');
    } finally {
      setProcessingUid(null);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Citizen Verification Queue"
        subtitle="Authenticate resident identities for Submit Once reuse"
      />

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading citizen verification queue...</Text>
        </View>
      ) : (
        <FlatList
          data={citizens}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.banner}>
              <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
              <Text style={styles.bannerText}>
                Citizens cannot self-verify their identities. State administrators certify identity dossiers against state population registries.
              </Text>
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="id-card-outline"
              title="No Citizen Identity Records"
              description="Citizens who register on MahaSetu will appear here for statutory certification."
            />
          }
          renderItem={({ item }) => {
            const isPending = item.status === 'PENDING';

            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Ionicons name="id-card" size={20} color={Colors.primary} />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name}>{item.name}</Text>
                    <Text style={styles.aadhaar}>Aadhaar: {item.aadhaarRef}</Text>
                    <Text style={styles.location}>
                      {item.city}, {item.district}
                    </Text>
                  </View>
                  <StatusBadge status={item.status} size="sm" />
                </View>

                <View style={styles.contactRow}>
                  <Text style={styles.contactText}>Email: {item.email}</Text>
                  <Text style={styles.contactText}>Phone: {item.phone}</Text>
                </View>

                {isPending && (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.btn, styles.btnReject]}
                      onPress={() => handleReject(item.uid, item.name)}
                      disabled={processingUid === item.uid}
                    >
                      <Text style={styles.btnRejectText}>Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.btn, styles.btnVerify]}
                      onPress={() => handleVerify(item.uid, item.name)}
                      disabled={processingUid === item.uid}
                    >
                      {processingUid === item.uid ? (
                        <ActivityIndicator color={Colors.textInverse} size="small" />
                      ) : (
                        <Text style={styles.btnVerifyText}>Verify Identity</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          }}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primarySubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  bannerText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  aadhaar: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 1,
  },
  location: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
    marginTop: 1,
  },
  contactRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
    marginTop: Spacing.sm,
  },
  contactText: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  btn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnReject: {
    backgroundColor: Colors.dangerLight,
  },
  btnRejectText: {
    color: Colors.danger,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
  btnVerify: {
    backgroundColor: Colors.primary,
  },
  btnVerifyText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
});
