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

export default function AuditorReviewScreen() {
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
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Loading auditor review dossier...</Text>
      </View>
    );
  }

  const auditorVerification = verifications.find((v) => v.verifierKey === 'AUDITOR');
  const isAlreadyVerified = auditorVerification?.status === 'VERIFIED';
  const isRejected = auditorVerification?.status === 'REJECTED' || application?.status === 'REJECTED';

  const handleVerify = async () => {
    if (!user || isAlreadyVerified || processing) return;
    setProcessing(true);
    try {
      await verificationService.verifyApplication(
        application?.id || id!,
        user,
        comments || 'Certified statutory compliance and consent verification.'
      );
      Alert.alert(
        'Auditor Certification Completed',
        `Successfully executed the 5th verification gate. Application is now certified under compliance review.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Verification Error', e.message || 'Failed to verify');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!user || processing) return;
    if (!comments) {
      Alert.alert('Comment Required', 'Please provide a compliance audit reason for rejection.');
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
        'Application Rejected by Auditor',
        `Application rejected under statutory oversight powers.`,
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
        title={`Audit: ${application?.applicationNumber || 'Application'}`}
        subtitle="Independent Compliance Review"
        showBack={true}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Auditor Mandate Banner */}
        <View style={styles.mandateBanner}>
          <Ionicons name="shield-checkmark" size={18} color="#7C3AED" />
          <Text style={styles.mandateText}>
            Compliance Gate (5 of 5): Your independent certification is required alongside Department A, B, C, and State Admin for application completion.
          </Text>
        </View>

        {/* Application Card */}
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
              Citizen: {application?.citizenName} ({application?.citizenPhone})
            </Text>
            <Text style={styles.metaText}>Location: {application?.citizenCity}</Text>
          </View>
        </View>

        {/* 5-Party Stepper */}
        <VerificationTimeline
          verifications={verifications}
          applicationNumber={application?.applicationNumber}
          isCitizenView={false}
        />

        {/* Auditor Decision Action Box */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>STATUTORY AUDITOR DECISION</Text>

          {isAlreadyVerified ? (
            <View style={styles.verifiedBox}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
              <View style={styles.verifiedTextBox}>
                <Text style={styles.verifiedTitle}>Auditor Slot Certified</Text>
                <Text style={styles.verifiedSub}>
                  Compliance approved by {user?.name || 'Auditor'}
                </Text>
              </View>
            </View>
          ) : isRejected ? (
            <View style={styles.rejectedBox}>
              <Ionicons name="close-circle" size={24} color={Colors.danger} />
              <View style={styles.verifiedTextBox}>
                <Text style={styles.rejectedTitle}>Application Rejected</Text>
                <Text style={styles.verifiedSub}>
                  {application?.rejectionReason || 'Compliance rejection noted'}
                </Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.commentPrompt}>
                Statutory audit remark / compliance note:
              </Text>
              <TextInput
                style={styles.commentInput}
                placeholder="e.g. Consent scopes verified, cross-department tokens valid, all 4 prior checks validated."
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
                  <Text style={styles.btnRejectText}>Reject Compliance</Text>
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
                      <Text style={styles.btnVerifyText}>Approve Auditor Gate</Text>
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
  mandateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EDE9FE',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  mandateText: {
    fontSize: Typography.fontSize.xs,
    color: '#6D28D9',
    flex: 1,
    lineHeight: 18,
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
    color: Colors.textSecondary,
  },
  cardHeading: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
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
    backgroundColor: '#7C3AED',
  },
  btnVerifyText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
  },
  verifiedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  verifiedTextBox: {
    flex: 1,
  },
  verifiedTitle: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.success,
  },
  verifiedSub: {
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
