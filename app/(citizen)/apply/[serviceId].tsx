import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Header } from '../../../components/common/Header';
import { StepIndicator } from '../../../components/common/StepIndicator';
import { FormInput } from '../../../components/forms/FormInput';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { GOVERNMENT_SERVICES } from '../../../constants/demoData';
import { applicationService } from '../../../services/applicationService';
import { residentProfileService } from '../../../services/residentProfileService';

export default function ApplyWizardScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const service =
    GOVERNMENT_SERVICES.find((s) => s.id === serviceId) || GOVERNMENT_SERVICES[0];

  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [familyIncome, setFamilyIncome] = useState('180000');
  const [bankAccount, setBankAccount] = useState('SBIN00012345678');
  const [ifscCode, setIfscCode] = useState('SBIN0001234');
  const [occupation, setOccupation] = useState('Agricultural Self-Employed');

  // Pre-fill from verified Resident Profile if available (Submit Once reuse)
  useEffect(() => {
    if (!user?.uid) return;
    residentProfileService.getResidentProfile(user.uid).then((profile) => {
      if (profile?.bank?.accountNumber) {
        setBankAccount(profile.bank.accountNumber);
      }
      if (profile?.bank?.ifscCode) {
        setIfscCode(profile.bank.ifscCode);
      }
    });
  }, [user?.uid]);

  const stepTitles = [
    'Service Overview',
    'Personal Information',
    'Eligibility Details',
    'Data Sharing Disclosure',
    'Submit & Initialize',
  ];

  const handleNext = () => {
    if (currentStep < 5) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const eligibilityData = {
        familyIncome,
        bankAccount,
        ifscCode,
        occupation,
      };

      const newApp = await applicationService.submitApplication(
        service.id,
        service.title,
        service.code,
        user,
        eligibilityData
      );

      Alert.alert(
        'Application Submitted!',
        `Your application ${newApp.applicationNumber} has been successfully registered. The 5-party verification workflow has been initialized.`,
        [
          {
            text: 'Track Real-Time Progress',
            onPress: () => router.replace(`/(citizen)/application/${newApp.id}`),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert('Submission Error', e.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title={service.title}
        subtitle="Submit Once Government Application"
        showBack={true}
      />

      <StepIndicator
        currentStep={currentStep}
        totalSteps={5}
        stepTitles={stepTitles}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Step 1: Service Overview */}
        {currentStep === 1 && (
          <View style={styles.stepContainer}>
            <View style={styles.badgeRow}>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryText}>{service.category}</Text>
              </View>
              <Text style={styles.codeText}>{service.code}</Text>
            </View>

            <Text style={styles.title}>{service.title}</Text>
            <Text style={styles.desc}>{service.description}</Text>

            <View style={styles.cardSection}>
              <Text style={styles.cardHeading}>DEPARTMENTS CONDUCTING VERIFICATION</Text>
              {service.departmentsInvolved.map((dept) => (
                <View key={dept.id} style={styles.deptItem}>
                  <Ionicons name="business" size={16} color={Colors.primary} />
                  <View style={styles.deptDetails}>
                    <Text style={styles.deptName}>{dept.name}</Text>
                    <Text style={styles.deptRole}>{dept.role}</Text>
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.infoBox}>
              <Ionicons name="information-circle-outline" size={20} color={Colors.info} />
              <Text style={styles.infoText}>
                By applying, MahaSetu will automatically bundle your saved citizen data so you do not need to re-upload documents.
              </Text>
            </View>
          </View>
        )}

        {/* Step 2: Personal Information (Submit Once) */}
        {currentStep === 2 && (
          <View style={styles.stepContainer}>
            <View style={styles.reusableBanner}>
              <Ionicons name="cloud-done" size={20} color={Colors.success} />
              <View style={styles.reusableBannerText}>
                <Text style={styles.reusableBannerTitle}>
                  Information already available in MahaSetu
                </Text>
                <Text style={styles.reusableBannerSubtitle}>
                  Your verified identity data is loaded automatically from your resident profile.
                </Text>
              </View>
            </View>

            <FormInput
              label="Full Legal Name"
              value={user?.name || 'Anusha G.'}
              isReadOnly={true}
              hint="Verified via MahaSetu Identity Registry"
            />
            <FormInput
              label="Aadhaar Reference"
              value={user?.aadhaarRef || 'XXXX-XXXX-4589'}
              isReadOnly={true}
              hint="Tokenized resident identity"
            />
            <FormInput
              label="Registered Mobile Number"
              value={user?.phone || '+919876543210'}
              isReadOnly={true}
            />
            <FormInput
              label="Permanent Resident Address"
              value={`${user?.city || 'Mumbai'}, ${user?.district || 'Mumbai Suburban'}, ${user?.state || 'Maharashtra'} - ${user?.pinCode || '400001'}`}
              isReadOnly={true}
              multiline
            />
          </View>
        )}

        {/* Step 3: Eligibility Information */}
        {currentStep === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepHeader}>Scheme Specific Information</Text>
            <Text style={styles.stepSub}>
              Please provide details required specifically for this scheme:
            </Text>

            <FormInput
              label="Annual Family Income (in INR)"
              value={familyIncome}
              onChangeText={setFamilyIncome}
              keyboardType="number-pad"
              hint="Must be below ₹2,50,000 for eligibility"
            />
            <FormInput
              label="Bank Account Number"
              value={bankAccount}
              onChangeText={setBankAccount}
              hint="For direct benefit transfer"
            />
            <FormInput
              label="Bank IFSC Code"
              value={ifscCode}
              onChangeText={setIfscCode}
              autoCapitalize="characters"
            />
            <FormInput
              label="Primary Occupation / Livelihood"
              value={occupation}
              onChangeText={setOccupation}
            />
          </View>
        )}

        {/* Step 4: Data Sharing Disclosure (Submit Once Principle) */}
        {currentStep === 4 && (
          <View style={styles.stepContainer}>
            <View style={styles.disclosureCard}>
              <Ionicons name="shield-checkmark" size={32} color={Colors.primary} />
              <Text style={styles.disclosureTitle}>Submit Once & Secure Data Reuse</Text>
              <Text style={styles.disclosureQuote}>
                "Your saved information can be securely reused for this service. You will be shown exactly which information is shared with other departments."
              </Text>
            </View>

            <View style={styles.sharedListCard}>
              <Text style={styles.sharedListHeading}>DATA TO BE SHARED FOR VERIFICATION:</Text>
              <View style={styles.fieldRow}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.fieldText}>Aadhaar Reference & Legal Name → All 3 Departments</Text>
              </View>
              <View style={styles.fieldRow}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.fieldText}>Income & Domicile → Department A (Revenue)</Text>
              </View>
              <View style={styles.fieldRow}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.fieldText}>Welfare Entitlements → Department B (Social Welfare)</Text>
              </View>
              <View style={styles.fieldRow}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.fieldText}>Employment Registry → Department C (Labour)</Text>
              </View>
              <View style={styles.fieldRow}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                <Text style={styles.fieldText}>Audit Log & Token Record → Admin & Auditor</Text>
              </View>
            </View>
          </View>
        )}

        {/* Step 5: Review & Submit */}
        {currentStep === 5 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepHeader}>Final Review</Text>
            <Text style={styles.stepSub}>
              Confirm your application details before creating the 5-party verification workflow.
            </Text>

            <View style={styles.reviewBox}>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Service Scheme:</Text>
                <Text style={styles.reviewValue}>{service.title}</Text>
              </View>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Applicant:</Text>
                <Text style={styles.reviewValue}>{user?.name} ({user?.phone})</Text>
              </View>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Stated Family Income:</Text>
                <Text style={styles.reviewValue}>₹{familyIncome}</Text>
              </View>
              <View style={styles.reviewItem}>
                <Text style={styles.reviewLabel}>Bank Account:</Text>
                <Text style={styles.reviewValue}>{bankAccount} ({ifscCode})</Text>
              </View>
            </View>

            <View style={styles.actionNotice}>
              <Ionicons name="sync-circle" size={24} color={Colors.primary} />
              <Text style={styles.actionNoticeText}>
                Upon submission, 5 independent verification tasks will be generated for Department A, Department B, Department C, State Admin, and Compliance Auditor.
              </Text>
            </View>
          </View>
        )}

        {/* Navigation Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.btnSecondary} onPress={handleBack}>
            <Text style={styles.btnSecondaryText}>{currentStep === 1 ? 'Cancel' : 'Back'}</Text>
          </TouchableOpacity>

          {currentStep < 5 ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleNext}>
              <Text style={styles.btnPrimaryText}>Continue</Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.textInverse} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.btnPrimary, styles.btnSubmit]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <>
                  <Text style={styles.btnPrimaryText}>Submit Application</Text>
                  <Ionicons name="checkmark-done" size={18} color={Colors.textInverse} />
                </>
              )}
            </TouchableOpacity>
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
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  stepContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  categoryPill: {
    backgroundColor: Colors.surfaceSubtle,
    paddingVertical: 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  categoryText: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '700',
    color: Colors.primary,
  },
  codeText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  desc: {
    fontSize: Typography.fontSize.xs + 1,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  cardSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cardHeading: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  deptItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  deptDetails: {
    flex: 1,
  },
  deptName: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  deptRole: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.infoLight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  infoText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.info,
    flex: 1,
    lineHeight: 16,
  },
  reusableBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  reusableBannerText: {
    flex: 1,
  },
  reusableBannerTitle: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '800',
    color: '#065F46',
  },
  reusableBannerSubtitle: {
    fontSize: Typography.fontSize.xs - 1,
    color: '#047857',
    marginTop: 2,
  },
  stepHeader: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  stepSub: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.md,
  },
  disclosureCard: {
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.primarySubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: Spacing.md,
  },
  disclosureTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  disclosureQuote: {
    fontSize: Typography.fontSize.xs + 1,
    fontStyle: 'italic',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 20,
  },
  sharedListCard: {
    padding: Spacing.sm,
  },
  sharedListHeading: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '800',
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs + 2,
  },
  fieldText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  reviewBox: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  reviewItem: {
    marginBottom: Spacing.xs,
  },
  reviewLabel: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  reviewValue: {
    fontSize: Typography.fontSize.xs + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 1,
  },
  actionNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  actionNoticeText: {
    flex: 1,
    fontSize: Typography.fontSize.xs,
    color: Colors.primary,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    gap: Spacing.md,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: Spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
  },
  btnSecondaryText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  btnPrimary: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: Spacing.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  btnSubmit: {
    backgroundColor: Colors.success,
  },
  btnPrimaryText: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textInverse,
  },
});
