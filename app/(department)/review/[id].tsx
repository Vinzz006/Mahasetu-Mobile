import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Header } from '../../../components/common/Header';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { VerificationTimeline } from '../../../components/verification/VerificationTimeline';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { applicationService } from '../../../services/applicationService';
import { verificationService } from '../../../services/verificationService';
import { Application, ApplicationVerification } from '../../../types';

export default function DepartmentReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [application, setApplication] = useState<Application | null>(null);
  const [verifications, setVerifications] = useState<ApplicationVerification[]>([]);
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const unsubApp = applicationService.subscribeToApplication(id, (app) => {
      setApplication(app);
      setLoading(false);
    });

    const unsubV = applicationService.subscribeToVerifications(id, (vList) => {
      setVerifications(vList);
    });

    return () => {
      unsubApp();
      unsubV();
    };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading application review details...</Text>
      </View>
    );
  }

  // Find this department's specific verification record
  const currentDeptKey = user?.departmentId || 'DEPT_A';
  const myVerification = verifications.find((v) => v.verifierKey === currentDeptKey);
  const isAlreadyVerified = myVerification?.status === 'VERIFIED';
  const isRejected = myVerification?.status === 'REJECTED' || application?.status === 'REJECTED';

  const handleVerify = async () => {
    if (!user || isAlreadyVerified || processing) return;
    setProcessing(true);
    try {
      await verificationService.verifyApplication(
        application?.id || id!,
        user,
        comments || `Verified by ${user.name} for ${currentDeptKey}`
      );
      Alert.alert(
        'Department Certification Complete',
        `Successfully certified ${currentDeptKey} verification slot. The workflow status has advanced.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Verification Error', e.message || 'Failed to certify application');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!user || processing) return;
    if (!comments) {
      Alert.alert('Comment Required', 'Please enter a justification comment for rejecting this application.');
      return;
    }

    setProcessing(true);
    try {
      await verificationService.rejectApplication(
        application?.id || id!,
        user,
        comments
      );
      Alert.alert(
        'Application Rejected',
        `Application rejected under authority of ${currentDeptKey}.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Rejection Error', e.message || 'Failed to reject application');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={`Review ${application?.applicationNumber || 'Application'}`}
        subtitle={`Department Scope: ${currentDeptKey}`}
        showBack={true}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Scope Isolation Banner */}
        <View style={styles.scopeBanner}>
          <Ionicons name="lock-closed" size={16} color="#0F766E" />
          <Text style={styles.scopeText}>
            You are operating under RBAC claim for {currentDeptKey}. You cannot alter other departments' verification slots.
          </Text>
        </View>

        {/* Application Header Card */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            <View>
              <Text style={styles.appNumber}>{application?.applicationNumber}</Text>
              <Text style={styles.serviceTitle}>{application?.serviceTitle}</Text>
            </View>
            <StatusBadge status={application?.status || 'UNDER_VERIFICATION'} />
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText}>
              Submitted: {application?.submissionDate ? new Date(application.submissionDate).toLocaleDateString() : 'Today'}
            </Text>
            <Text style={styles.metaText}>Service Code: {application?.serviceCode}</Text>
          </View>
        </View>

        {/* Applicant Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>CITIZEN RESIDENT DOSSIER</Text>

          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>Applicant Name</Text>
            <Text style={styles.fieldVal}>{application?.citizenName}</Text>
          </View>
          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>Mobile Phone</Text>
            <Text style={styles.fieldVal}>{application?.citizenPhone}</Text>
          </View>
          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>Resident Address</Text>
            <Text style={styles.fieldVal}>{application?.citizenAddress}</Text>
          </View>
          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>Declared Family Income</Text>
            <Text style={styles.fieldVal}>
              ₹{application?.eligibilityData?.familyIncome || '1,80,000'} / annum
            </Text>
          </View>
          <View style={styles.fieldItem}>
            <Text style={styles.fieldLabel}>Bank Account & IFSC</Text>
            <Text style={styles.fieldVal}>
              {application?.eligibilityData?.bankAccount || 'SBIN00012345678'} (
              {application?.eligibilityData?.ifscCode || 'SBIN0001234'})
            </Text>
          </View>
        </View>

        {/* Full 5-Party Verification Status */}
        <VerificationTimeline
          verifications={verifications}
          applicationNumber={application?.applicationNumber}
          isCitizenView={false}
        />

        {/* Department Officer Actions */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>DEPARTMENT DECISION ({currentDeptKey})</Text>

          {isAlreadyVerified ? (
            <View style={styles.alreadyVerifiedBox}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
              <View style={styles.alreadyVerifiedText}>
                <Text style={styles.alreadyVerifiedTitle}>
                  Certified by {myVerification?.verifierName || currentDeptKey}
                </Text>
                <Text style={styles.alreadyVerifiedSub}>
                  Completed on {myVerification?.verifiedAt ? new Date(myVerification.verifiedAt).toLocaleString() : 'Recently'}
                </Text>
              </View>
            </View>
          ) : isRejected ? (
            <View style={styles.rejectedBox}>
              <Ionicons name="close-circle" size={24} color={Colors.danger} />
              <View style={styles.alreadyVerifiedText}>
                <Text style={styles.rejectedTitle}>Application Rejected</Text>
                <Text style={styles.alreadyVerifiedSub}>
                  {application?.rejectionReason || 'Rejected by department reviewer'}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.commentPrompt}>
                Add departmental verification note / audit remark:
              </Text>
              <TextInput
                style={styles.commentInput}
                placeholder="e.g. Income & domicile documents verified against revenue records."
                placeholderTextColor={Colors.textMuted}
                value={comments}
                onChangeText={setComments}
                multiline
                numberOfLines={3}
              />

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnReject]}
                  onPress={handleReject}
                  disabled={processing}
                >
                  <Ionicons name="close" size={18} color={Colors.danger} />
                  <Text style={styles.btnRejectText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.btnVerify]}
                  onPress={handleVerify}
                  disabled={processing}
                >
                  {processing ? (
                    <ActivityIndicator color={Colors.textInverse} size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color={Colors.textInverse} />
                      <Text style={styles.btnVerifyText}>Verify {currentDeptKey}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.xs,
    color: Colors.textMuted,
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  scopeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
  },
  scopeText: {
    fontSize: Typography.fontSize.xs - 1,
    color: '#0F766E',
    flex: 1,
    fontWeight: '600',
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
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  appNumber: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '800',
    color: Colors.textMuted,
  },
  serviceTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  metaText: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
  },
  cardHeading: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  fieldItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  fieldLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  fieldVal: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  commentPrompt: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  commentInput: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlignVertical: 'top',
    minHeight: 70,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  btnReject: {
    backgroundColor: Colors.dangerLight,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  btnRejectText: {
    color: Colors.danger,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
  btnVerify: {
    backgroundColor: Colors.accent,
  },
  btnVerifyText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
  alreadyVerifiedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  alreadyVerifiedText: {
    flex: 1,
  },
  alreadyVerifiedTitle: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.success,
  },
  alreadyVerifiedSub: {
    fontSize: Typography.fontSize.xs - 2,
    color: '#065F46',
    marginTop: 2,
  },
  rejectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dangerLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  rejectedTitle: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.danger,
  },
});
