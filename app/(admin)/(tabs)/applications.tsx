import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Header } from '../../../components/common/Header';
import { VerificationMatrix } from '../../../components/verification/VerificationMatrix';
import { VerificationTimeline } from '../../../components/verification/VerificationTimeline';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { EmptyState } from '../../../components/common/EmptyState';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { applicationService } from '../../../services/applicationService';
import { verificationService } from '../../../services/verificationService';
import { Application, ApplicationVerification } from '../../../types';

export default function AdminApplicationsScreen() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [verifications, setVerifications] = useState<ApplicationVerification[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsub = applicationService.subscribeToApplications(user, (list) => {
      setApplications(list);
      if (list.length > 0 && !selectedAppId) {
        setSelectedAppId(list[0].id);
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!selectedAppId) return;
    const unsubV = applicationService.subscribeToVerifications(selectedAppId, (vList) => {
      setVerifications(vList);
    });
    return () => unsubV();
  }, [selectedAppId]);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const selectedApp = applications.find((a) => a.id === selectedAppId) || applications[0];
  const adminVerification = verifications.find((v) => v.verifierKey === 'ADMIN');
  const isAdminVerified = adminVerification?.status === 'VERIFIED';

  const handleAdminVerify = async () => {
    if (!user || !selectedApp || isAdminVerified || verifying) return;
    setVerifying(true);
    try {
      await verificationService.verifyApplication(
        selectedApp.id,
        user,
        'Certified by State Administrator under statutory review.'
      );
      Alert.alert(
        'Admin Step Certified',
        `Administrator verification completed for ${selectedApp.applicationNumber}.`
      );
    } catch (e: any) {
      Alert.alert('Verification Error', e.message || 'Failed to verify');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="5/5 Verification Matrix"
        subtitle="Full Multi-Personnel Government Oversight"
      />

      <FlatList
        data={applications}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View>
            {/* Global Matrix Component */}
            <VerificationMatrix applications={applications} />

            {/* Application Selector Tabs */}
            <Text style={styles.sectionHeader}>SELECT APPLICATION TO INSPECT / CERTIFY:</Text>
            <View style={styles.appSelectorRow}>
              {applications.map((app) => (
                <TouchableOpacity
                  key={app.id}
                  style={[
                    styles.appChip,
                    app.id === selectedAppId && styles.appChipActive,
                  ]}
                  onPress={() => setSelectedAppId(app.id)}
                >
                  <Text
                    style={[
                      styles.appChipText,
                      app.id === selectedAppId && styles.appChipTextActive,
                    ]}
                  >
                    {app.applicationNumber}
                  </Text>
                  <Text
                    style={[
                      styles.appChipScore,
                      app.id === selectedAppId && styles.appChipScoreActive,
                    ]}
                  >
                    {app.verificationSummary?.verifiedCount || 0}/5
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Selected Application Timeline & Admin Action */}
            {selectedApp && (
              <View style={styles.detailCard}>
                <View style={styles.detailHeader}>
                  <View>
                    <Text style={styles.detailAppNum}>{selectedApp.applicationNumber}</Text>
                    <Text style={styles.detailService}>{selectedApp.serviceTitle}</Text>
                    <Text style={styles.detailApplicant}>Citizen: {selectedApp.citizenName}</Text>
                  </View>
                  <StatusBadge status={selectedApp.status} size="sm" />
                </View>

                {/* 5-Party Stepper */}
                <VerificationTimeline
                  verifications={verifications}
                  applicationNumber={selectedApp.applicationNumber}
                  isCitizenView={false}
                />

                {/* Admin Verification Action */}
                <View style={styles.adminActionBox}>
                  <View style={styles.adminActionHeader}>
                    <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
                    <Text style={styles.adminActionTitle}>Administrator Certification Gate</Text>
                  </View>
                  <Text style={styles.adminActionSub}>
                    Admin executes the 'ADMIN' verification slot. Admin cannot bypass other 4 independent departmental verifiers.
                  </Text>

                  {isAdminVerified ? (
                    <View style={styles.verifiedNotice}>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                      <Text style={styles.verifiedNoticeText}>Admin Slot: Certified & Logged to Audit Trail</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.adminVerifyBtn}
                      onPress={handleAdminVerify}
                      disabled={verifying}
                    >
                      {verifying ? (
                        <ActivityIndicator color={Colors.textInverse} size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-done-circle" size={20} color={Colors.textInverse} />
                          <Text style={styles.adminVerifyBtnText}>Execute Admin Certification</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            <Text style={styles.sectionHeader}>APPLICATION AUDIT RECORDS:</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.summaryRowCard}>
            <View style={styles.summaryRowTop}>
              <Text style={styles.rowAppNum}>{item.applicationNumber}</Text>
              <Text style={styles.rowCount}>
                {item.verificationSummary?.verifiedCount || 0} / 5 verifiers approved
              </Text>
            </View>
            <Text style={styles.rowCitizen}>{item.citizenName} • {item.serviceTitle}</Text>
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
  listContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  sectionHeader: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  appSelectorRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  appChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.sm,
    gap: 6,
  },
  appChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  appChipText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  appChipTextActive: {
    color: Colors.textInverse,
  },
  appChipScore: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '700',
    color: Colors.warning,
    backgroundColor: Colors.warningLight,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  appChipScoreActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: Colors.textInverse,
  },
  detailCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  detailAppNum: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  detailService: {
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  detailApplicant: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  adminActionBox: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  adminActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  adminActionTitle: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.primary,
  },
  adminActionSub: {
    fontSize: Typography.fontSize.xs - 1,
    color: '#1E40AF',
    marginTop: 2,
    marginBottom: Spacing.sm,
    lineHeight: 16,
  },
  adminVerifyBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  adminVerifyBtnText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
  verifiedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  verifiedNoticeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.success,
  },
  summaryRowCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowAppNum: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.primary,
  },
  rowCount: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  rowCitizen: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
