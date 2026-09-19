import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { Header } from '../../../components/common/Header';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

interface VerificationRecord {
  id: string;
  applicationId: string;
  applicationNumber?: string;
  verifierKey: string;
  verifierName?: string;
  verifierRole?: string;
  departmentId?: string | null;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  comments?: string | null;
  verifiedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
}

export default function AuditorVerificationsScreen() {
  const [records, setRecords] = useState<VerificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const vRef = collection(db, 'applicationVerifications');
    const q = query(vRef, orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: VerificationRecord[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          // Only show completed verifications (not pending ones)
          if (data.status === 'PENDING') return;
          list.push({
            id: docSnap.id,
            applicationId: data.applicationId || '',
            applicationNumber: data.applicationNumber,
            verifierKey: data.verifierKey || data.verifierRole || '',
            verifierName: data.verifierName || data.verifierKey || '',
            verifierRole: data.verifierRole || data.verifierKey || '',
            departmentId: data.departmentId ?? null,
            status: data.status || 'PENDING',
            comments: data.comments ?? null,
            verifiedAt: data.verifiedAt?.toDate?.()?.toISOString() || data.verifiedAt || null,
            rejectedAt: data.rejectedAt?.toDate?.()?.toISOString() || data.rejectedAt || null,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          });
        });
        setRecords(list);
        setLoading(false);
      },
      (error) => {
        console.warn('Verifications listener warning:', error.message);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const getDeptLabel = (verifierKey: string) => {
    switch (verifierKey?.toUpperCase()) {
      case 'DEPARTMENT_A': return 'Department A — Revenue & Civil Supplies';
      case 'DEPARTMENT_B': return 'Department B — Social Welfare';
      case 'DEPARTMENT_C': return 'Department C — Labour & Employment';
      case 'ADMIN': return 'State Administrator';
      case 'AUDITOR': return 'Compliance Auditor';
      default: return verifierKey || 'Verifier';
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Header title="Verification History" subtitle="Chronological log of multi-person certifications" />
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header
        title="Verification History"
        subtitle="Chronological log of multi-person certifications"
      />

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>No Completed Verifications</Text>
            <Text style={styles.emptyDesc}>
              Completed verifications from all applications will appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.topRow}>
              <Text style={styles.appNum}>{item.applicationNumber || item.applicationId.slice(0, 12)}</Text>
              <View style={[styles.badge, item.status === 'REJECTED' && styles.badgeRejected]}>
                <Ionicons
                  name={item.status === 'VERIFIED' ? 'checkmark-circle' : 'close-circle'}
                  size={12}
                  color={item.status === 'VERIFIED' ? Colors.success : Colors.danger}
                />
                <Text style={[styles.badgeText, item.status === 'REJECTED' && styles.badgeTextRejected]}>
                  {item.status}
                </Text>
              </View>
            </View>

            <Text style={styles.verifierTitle}>{getDeptLabel(item.verifierKey)}</Text>
            {item.verifierName ? (
              <Text style={styles.officerName}>Officer: {item.verifierName}</Text>
            ) : null}
            {item.comments ? (
              <Text style={styles.remarksText}>"{item.comments}"</Text>
            ) : null}

            <Text style={styles.dateText}>
              {formatDate(item.verifiedAt || item.rejectedAt || item.createdAt)}
            </Text>
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
  center: {
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  emptyDesc: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 18,
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
  badgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '800',
    color: Colors.success,
  },
  badgeTextRejected: {
    color: Colors.danger,
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
