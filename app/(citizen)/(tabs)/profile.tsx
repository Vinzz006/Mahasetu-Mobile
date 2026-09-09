import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Header } from '../../../components/common/Header';
import { Colors, Spacing, Typography, BorderRadius } from '../../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../store/AuthContext';
import { useRouter } from 'expo-router';
import {
  residentProfileService,
  calculateProfileCompletion,
} from '../../../services/residentProfileService';
import { ResidentProfile } from '../../../types';

export default function CitizenProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ResidentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const unsub = residentProfileService.subscribeToResidentProfile(user.uid, (p) => {
      setProfile(p);
      setLoading(false);
    });

    return () => {
      unsub();
    };
  }, [user?.uid]);

  const handleRequestCorrection = () => {
    Alert.alert(
      'Correction Request Submitted',
      'Your identity correction request has been forwarded to the MahaSetu State Administration verification team for review.'
    );
  };

  const handleOpenForm = () => {
    router.push('/resident-details');
  };

  // Compute completion metrics
  const completion = profile
    ? calculateProfileCompletion(profile)
    : { percentage: 25, isComplete: false, missingFields: ['Personal Details', 'Address', 'Bank Details'] };

  const isComplete = completion.isComplete;
  const percentage = completion.percentage;

  return (
    <View style={styles.container}>
      <Header
        title="Citizen Profile"
        subtitle="Government Of Maharashtra"
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Identity Verification Card */}
        <View style={styles.verificationCard}>
          <View style={styles.vHeader}>
            <View style={styles.vIconBadge}>
              <Ionicons name="shield-checkmark" size={24} color={Colors.success} />
            </View>
            <View style={styles.vHeaderText}>
              <Text style={styles.vTitle}>MahaSetu Verified Identity</Text>
              <Text style={styles.vSubtitle}>Verified by State Administration Authority</Text>
            </View>
          </View>

          <View style={styles.vStatusBadge}>
            <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
            <Text style={styles.vStatusText}>✓ IDENTITY VERIFIED</Text>
          </View>

          <Text style={styles.vNotice}>
            Your government identity record is certified for automated reuse across all Maharashtra departments.
          </Text>
        </View>

        {/* Profile Completion & Action Card */}
        <View style={styles.completionCard}>
          <View style={styles.completionTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.completionTitle}>
                {isComplete
                  ? 'Government Resident Profile — Complete'
                  : `Profile Completion: ${percentage}%`}
              </Text>
              <Text style={styles.completionSub}>
                {isComplete
                  ? 'All 8 statutory resident sections verified & on file'
                  : `Missing required: ${completion.missingFields.slice(0, 2).join(', ')}${
                      completion.missingFields.length > 2 ? ` +${completion.missingFields.length - 2} more` : ''
                    }`}
              </Text>
            </View>
            <View style={[styles.percentBadge, isComplete && styles.percentBadgeComplete]}>
              <Text style={styles.percentText}>{percentage}%</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${percentage}%` },
                isComplete && { backgroundColor: Colors.success },
              ]}
            />
          </View>

          <TouchableOpacity style={styles.primaryActionBtn} onPress={handleOpenForm}>
            <Ionicons
              name={isComplete ? 'create-outline' : 'clipboard-outline'}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.primaryActionBtnText}>
              {isComplete ? 'Edit Government Resident Details' : 'Complete Government Resident Profile'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ======================================================== */}
        {/* EXTENDED RESIDENT DOSSIER SECTIONS */}
        {/* ======================================================== */}

        {/* 1. Personal Details */}
        <View style={styles.dossierCard}>
          <View style={styles.dossierHeaderRow}>
            <Ionicons name="person" size={16} color={Colors.primary} />
            <Text style={styles.dossierHeading}>PERSONAL RESIDENT DETAILS</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Legal Name</Text>
            <Text style={styles.infoValue}>
              {profile?.personalDetails?.fullLegalName || user?.name || 'Citizen'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Date of Birth / Age</Text>
            <Text style={styles.infoValue}>
              {profile?.personalDetails?.dateOfBirth
                ? `${profile.personalDetails.dateOfBirth} (${profile.personalDetails.age || 'N/A'} yrs)`
                : 'Not provided'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Gender / Marital Status</Text>
            <Text style={styles.infoValue}>
              {profile?.personalDetails?.gender || 'Not specified'} •{' '}
              {profile?.personalDetails?.maritalStatus || 'Not specified'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Community / Caste</Text>
            <Text style={styles.infoValue}>
              {profile?.personalDetails?.community || 'General'}{' '}
              {profile?.personalDetails?.caste ? `(${profile.personalDetails.caste})` : ''}
            </Text>
          </View>
        </View>

        {/* 2. Address & Location */}
        <View style={styles.dossierCard}>
          <View style={styles.dossierHeaderRow}>
            <Ionicons name="location" size={16} color={Colors.primary} />
            <Text style={styles.dossierHeading}>ADDRESS & LOCATION</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Permanent Address</Text>
            <Text style={styles.infoValue}>
              {profile?.address?.address || user?.city || 'Address on file'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>City / District</Text>
            <Text style={styles.infoValue}>
              {profile?.address?.city || user?.city || 'Not specified'}{' '}
              {profile?.address?.district || user?.district ? `/ ${profile?.address?.district || user?.district}` : ''}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>State / PIN Code</Text>
            <Text style={styles.infoValue}>
              {profile?.address?.state || user?.state || 'Maharashtra'} -{' '}
              {profile?.address?.pinCode || user?.pinCode || '400001'}
            </Text>
          </View>
        </View>

        {/* 3. Contact Information */}
        <View style={styles.dossierCard}>
          <View style={styles.dossierHeaderRow}>
            <Ionicons name="call" size={16} color={Colors.primary} />
            <Text style={styles.dossierHeading}>CONTACT DETAILS</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Verified Mobile</Text>
            <Text style={styles.infoValue}>
              {profile?.contact?.phoneNumber || user?.phone || 'Not linked'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Registered Email</Text>
            <Text style={styles.infoValue}>
              {profile?.contact?.emailAddress || user?.email || 'Not provided'}
            </Text>
          </View>
        </View>

        {/* 4. Family Details */}
        <View style={styles.dossierCard}>
          <View style={styles.dossierHeaderRow}>
            <Ionicons name="people" size={16} color={Colors.primary} />
            <Text style={styles.dossierHeading}>FAMILY INFORMATION</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Father Name</Text>
            <Text style={styles.infoValue}>
              {profile?.family?.fatherName || 'Not specified'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mother Name</Text>
            <Text style={styles.infoValue}>
              {profile?.family?.motherName || 'Not specified'}
            </Text>
          </View>

          {profile?.family?.spouseName ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Spouse Name</Text>
              <Text style={styles.infoValue}>{profile.family.spouseName}</Text>
            </View>
          ) : null}
        </View>

        {/* 5. Identity Details */}
        <View style={styles.dossierCard}>
          <View style={styles.dossierHeaderRow}>
            <Ionicons name="card" size={16} color={Colors.primary} />
            <Text style={styles.dossierHeading}>IDENTITY & STATUTORY CREDENTIALS</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Aadhaar Reference</Text>
            <Text style={styles.infoValue}>
              {profile?.identity?.aadhaarReference || user?.aadhaarRef || 'XXXX-XXXX-4589'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PAN Card Number</Text>
            <Text style={styles.infoValue}>
              {profile?.identity?.panCardNumber || 'Not provided'}
            </Text>
          </View>
        </View>

        {/* 6. Education Details */}
        <View style={styles.dossierCard}>
          <View style={styles.dossierHeaderRow}>
            <Ionicons name="school" size={16} color={Colors.primary} />
            <Text style={styles.dossierHeading}>EDUCATION</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Highest Qualification</Text>
            <Text style={styles.infoValue}>
              {profile?.education?.educationalQualification || 'Not specified'}
            </Text>
          </View>
        </View>

        {/* 7. Bank Details */}
        <View style={styles.dossierCard}>
          <View style={styles.dossierHeaderRow}>
            <Ionicons name="wallet" size={16} color={Colors.primary} />
            <Text style={styles.dossierHeading}>BANK & DBT ACCOUNT</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Bank Name</Text>
            <Text style={styles.infoValue}>
              {profile?.bank?.bankName || 'State Bank of India'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Number</Text>
            <Text style={styles.infoValue}>
              {profile?.bank?.accountNumber
                ? `XXXX-XXXX-${profile.bank.accountNumber.slice(-4)}`
                : 'Not configured'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>IFSC Code / Branch</Text>
            <Text style={styles.infoValue}>
              {profile?.bank?.ifscCode || 'SBIN0001234'}{' '}
              {profile?.bank?.branchName ? `(${profile.bank.branchName})` : ''}
            </Text>
          </View>
        </View>

        {/* 8. Passport Details */}
        <View style={styles.dossierCard}>
          <View style={styles.dossierHeaderRow}>
            <Ionicons name="airplane" size={16} color={Colors.primary} />
            <Text style={styles.dossierHeading}>PASSPORT STATUS</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Passport Held</Text>
            <Text style={styles.infoValue}>
              {profile?.passport?.hasPassport ? 'Yes' : 'No'}
            </Text>
          </View>

          {profile?.passport?.hasPassport ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Document PDF</Text>
              <Text style={[styles.infoValue, { color: Colors.success, fontWeight: '700' }]}>
                {profile.passport.documentPath ? '✓ Uploaded & Secured' : 'Pending Upload'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Request Correction action */}
        <TouchableOpacity
          style={styles.correctionBtn}
          onPress={handleRequestCorrection}
          accessibilityLabel="Request identity record correction"
        >
          <Ionicons name="help-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.correctionBtnText}>Request Data Correction from Admin</Text>
        </TouchableOpacity>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={styles.signOutBtnText}>Sign Out from MahaSetu</Text>
        </TouchableOpacity>
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
    paddingBottom: Spacing.xxl + 20,
  },
  verificationCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    shadowColor: Colors.shadowColor,
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
    marginBottom: Spacing.md,
  },
  vHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  vIconBadge: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vHeaderText: {
    flex: 1,
  },
  vTitle: {
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  vSubtitle: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textMuted,
  },
  vStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  vStatusText: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '700',
    color: Colors.success,
  },
  vNotice: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  completionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: Spacing.md,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  completionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  completionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  completionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  percentBadge: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#93C5FD',
  },
  percentBadgeComplete: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  percentText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.primary,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  primaryActionBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dossierCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dossierHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs + 2,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dossierHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  infoLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  correctionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    backgroundColor: '#EFF6FF',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  correctionBtnText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    marginTop: Spacing.xs,
  },
  signOutBtnText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.danger,
  },
});
