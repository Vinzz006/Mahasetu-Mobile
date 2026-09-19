import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Header } from '../components/common/Header';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../store/AuthContext';
import {
  residentProfileService,
  calculateAgeFromDob,
  calculateProfileCompletion,
  createDefaultProfileTemplate,
} from '../services/residentProfileService';
import { ResidentProfile } from '../types';
import * as DocumentPicker from 'expo-document-picker';

// Dropdown options
const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const MARITAL_STATUS_OPTIONS = ['Single', 'Married', 'Divorced', 'Widowed'];
const COMMUNITY_OPTIONS = ['General', 'OBC', 'SC', 'ST', 'Minorities', 'Other'];
const EDUCATION_OPTIONS = [
  'Primary School (1st - 8th)',
  'Secondary School (10th / SSC)',
  'Higher Secondary (12th / HSC)',
  'Diploma / Vocational / ITI',
  "Bachelor's Degree (Graduate)",
  "Master's Degree (Post Graduate)",
  'Doctorate (Ph.D.)',
  'Professional Degree (CA / CS / LLB / MBBS)',
  'Other',
];

export default function ResidentDetailsScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPassport, setUploadingPassport] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Active form data
  const [formData, setFormData] = useState<ResidentProfile | null>(null);

  // Active expanded section index (1-8 or 9)
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({
    1: true, // Personal Details open by default
    2: false,
    3: false,
    4: false,
    5: false,
    6: false,
    7: false,
    8: false,
    9: false,
  });

  // Modal selector state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTitle, setPickerTitle] = useState('');
  const [pickerOptions, setPickerOptions] = useState<string[]>([]);
  const [pickerOnSelect, setPickerOnSelect] = useState<(val: string) => void>(() => () => {});

  // Load existing profile on mount
  useEffect(() => {
    if (!user?.uid) return;

    let isMounted = true;
    (async () => {
      try {
        const existing = await residentProfileService.getResidentProfile(user.uid);
        if (isMounted) {
          if (existing) {
            setFormData(existing);
          } else {
            // Pre-populate defaults from user account
            const defaultTemplate = createDefaultProfileTemplate(user.uid, user);
            setFormData(defaultTemplate);
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (isMounted) {
          Alert.alert('Error', 'Failed to load resident profile data.');
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.uid]);

  // Expand / collapse helper
  const toggleSection = (sectionIndex: number) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionIndex]: !prev[sectionIndex],
    }));
  };

  const expandAll = () => {
    setExpandedSections({
      1: true,
      2: true,
      3: true,
      4: true,
      5: true,
      6: true,
      7: true,
      8: true,
      9: true,
    });
  };

  const collapseAll = () => {
    setExpandedSections({
      1: false,
      2: false,
      3: false,
      4: false,
      5: false,
      6: false,
      7: false,
      8: false,
      9: false,
    });
  };

  // Field updater helpers
  const updateField = (section: keyof ResidentProfile, key: string, value: any) => {
    setIsDirty(true);
    setFormData((prev) => {
      if (!prev) return prev;
      const currentSection = (prev[section] as Record<string, any>) || {};
      const updatedSection = { ...currentSection, [key]: value };

      // If updating DOB, auto-calculate age
      if (section === 'personalDetails' && key === 'dateOfBirth') {
        const calculatedAge = calculateAgeFromDob(value);
        updatedSection.age = calculatedAge;
      }

      return {
        ...prev,
        [section]: updatedSection,
      };
    });
  };

  const openPicker = (title: string, options: string[], onSelect: (val: string) => void) => {
    setPickerTitle(title);
    setPickerOptions(options);
    setPickerOnSelect(() => (val: string) => {
      onSelect(val);
      setPickerVisible(false);
    });
    setPickerVisible(true);
  };

  // Handle Passport Yes / No Switch
  const handlePassportToggle = (hasPassport: boolean) => {
    if (!formData) return;

    if (!hasPassport && formData.passport?.hasPassport && formData.passport?.documentPath) {
      // User is switching from YES to NO, but a document was already uploaded
      Alert.alert(
        'Confirm Passport Removal',
        'You have an uploaded passport document. Switching to "No" will remove and delete your uploaded passport file from secure government storage. Proceed?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Remove File',
            style: 'destructive',
            onPress: async () => {
              try {
                if (formData.passport.documentPath) {
                  await residentProfileService.deletePassportDocument(formData.passport.documentPath);
                }
                updateField('passport', 'hasPassport', false);
                updateField('passport', 'documentPath', null);
                updateField('passport', 'fileName', null);
                updateField('passport', 'fileSize', null);
                updateField('passport', 'uploadedAt', null);
              } catch (err: any) {
                Alert.alert('Error', 'Failed to remove passport file.');
              }
            },
          },
        ]
      );
    } else {
      updateField('passport', 'hasPassport', hasPassport);
      if (!hasPassport) {
        updateField('passport', 'documentPath', null);
        updateField('passport', 'fileName', null);
        updateField('passport', 'fileSize', null);
        updateField('passport', 'uploadedAt', null);
      }
    }
  };

  // Handle PDF Document Pick & Upload
  const handlePickPassportPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];

      // Validate PDF format
      if (!asset.name.toLowerCase().endsWith('.pdf') && asset.mimeType !== 'application/pdf') {
        Alert.alert(
          'Invalid File Type',
          'Passport document must be a PDF file smaller than 10 MB. Non-PDF files are rejected.'
        );
        return;
      }

      // Validate File Size (10 MB max = 10 * 1024 * 1024 bytes)
      const MAX_SIZE = 10 * 1024 * 1024;
      if (asset.size && asset.size > MAX_SIZE) {
        Alert.alert(
          'File Too Large',
          'Passport document must be a PDF file smaller than 10 MB.'
        );
        return;
      }

      setUploadingPassport(true);

      // If previously had a document, clean up the old one
      if (formData?.passport?.documentPath) {
        await residentProfileService.deletePassportDocument(formData.passport.documentPath);
      }

      const uploadResult = await residentProfileService.uploadPassportDocument(
        asset.uri,
        asset.name,
        asset.size || 0
      );

      updateField('passport', 'hasPassport', true);
      updateField('passport', 'documentPath', uploadResult.storagePath);
      updateField('passport', 'fileName', uploadResult.fileName);
      updateField('passport', 'fileSize', uploadResult.fileSize);
      updateField('passport', 'uploadedAt', uploadResult.uploadedAt);

      Alert.alert('Success', 'Passport PDF uploaded successfully to secure storage.');
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Failed to upload passport PDF.');
    } finally {
      setUploadingPassport(false);
    }
  };

  // Handle Remove Passport File button
  const handleRemovePassportFile = () => {
    if (!formData?.passport?.documentPath) return;

    Alert.alert(
      'Remove Document',
      'Are you sure you want to remove your uploaded passport document?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (formData.passport.documentPath) {
                await residentProfileService.deletePassportDocument(formData.passport.documentPath);
              }
              updateField('passport', 'documentPath', null);
              updateField('passport', 'fileName', null);
              updateField('passport', 'fileSize', null);
              updateField('passport', 'uploadedAt', null);
            } catch (err: any) {
              Alert.alert('Error', 'Failed to remove document.');
            }
          },
        },
      ]
    );
  };

  // Form Validation & Save
  const handleSave = async (shouldNavigateBack: boolean = false) => {
    if (!formData || !user?.uid) return;

    // Validate minimum required fields
    if (!formData.personalDetails.fullLegalName?.trim()) {
      Alert.alert('Validation Error', 'Full Legal Name is required in Section 1.');
      setExpandedSections((prev) => ({ ...prev, 1: true }));
      return;
    }

    if (formData.passport.hasPassport && !formData.passport.documentPath) {
      Alert.alert(
        'Passport PDF Required',
        'You indicated you have a Passport. Please upload your passport document PDF or switch the option to "No".'
      );
      setExpandedSections((prev) => ({ ...prev, 8: true }));
      return;
    }

    setSaving(true);
    try {
      const saved = await residentProfileService.saveResidentProfile(formData);
      setFormData(saved);
      setIsDirty(false);

      if (shouldNavigateBack) {
        Alert.alert(
          'Profile Saved Successfully',
          'Your Government Resident Details have been securely updated in the MahaSetu Registry.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        Alert.alert(
          'Profile Saved Successfully',
          'Your Government Resident Details have been securely updated in the MahaSetu Registry.'
        );
      }
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save profile details.');
    } finally {
      setSaving(false);
    }
  };

  // Back button confirmation if dirty
  const handleBack = () => {
    if (isDirty) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes in your resident details. Do you want to discard them?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          {
            text: 'Discard & Exit',
            style: 'destructive',
            onPress: () => router.back(),
          },
        ]
      );
    } else {
      router.back();
    }
  };

  if (loading || !formData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Government Resident Details...</Text>
      </View>
    );
  }

  const { percentage, isComplete, missingFields } = calculateProfileCompletion(formData);
  const isOfficerOrAdmin = user?.role && user.role !== 'citizen' && user.role !== 'CITIZEN';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        title="Resident Details"
        subtitle="Government Of Maharashtra"
        showBack={true}
        showLogout={false}
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Progress & Completion Summary Banner */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryTitleCol}>
              <Text style={styles.summaryHeader}>Government Resident Profile</Text>
              <Text style={styles.summarySub}>
                {isComplete
                  ? 'Government Resident Profile — Complete'
                  : `Profile Completion: ${percentage}%`}
              </Text>
            </View>
            <View style={[styles.percentBadge, isComplete && styles.percentBadgeComplete]}>
              <Text style={styles.percentText}>{percentage}%</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${percentage}%` },
                isComplete && { backgroundColor: Colors.success },
              ]}
            />
          </View>

          {!isComplete && missingFields.length > 0 && (
            <Text style={styles.missingHint}>
              Missing: {missingFields.slice(0, 3).join(', ')}
              {missingFields.length > 3 ? ` +${missingFields.length - 3} more` : ''}
            </Text>
          )}

          <View style={styles.expandControlsRow}>
            <TouchableOpacity onPress={expandAll} style={styles.expandCtrlBtn}>
              <Ionicons name="expand-outline" size={14} color={Colors.primary} />
              <Text style={styles.expandCtrlText}>Expand All</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={collapseAll} style={styles.expandCtrlBtn}>
              <Ionicons name="contract-outline" size={14} color={Colors.primary} />
              <Text style={styles.expandCtrlText}>Collapse All</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ======================================================== */}
        {/* SECTION 1: PERSONAL DETAILS */}
        {/* ======================================================== */}
        <SectionContainer
          index={1}
          title="1. Personal Details"
          icon="person-outline"
          isExpanded={expandedSections[1]}
          onToggle={() => toggleSection(1)}
          isCompleted={Boolean(
            formData.personalDetails.fullLegalName &&
              formData.personalDetails.dateOfBirth &&
              formData.personalDetails.gender
          )}
        >
          <FormField
            label="Full Legal Name *"
            value={formData.personalDetails.fullLegalName}
            onChangeText={(t) => updateField('personalDetails', 'fullLegalName', t)}
            placeholder="e.g. Ramesh Kumar"
            autoCapitalize="words"
          />

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <FormField
                label="Date of Birth (YYYY-MM-DD) *"
                value={formData.personalDetails.dateOfBirth}
                onChangeText={(t) => updateField('personalDetails', 'dateOfBirth', t)}
                placeholder="1995-08-15"
                keyboardType="numeric"
                hint="Format: YYYY-MM-DD"
              />
            </View>
            <View style={styles.halfCol}>
              <FormField
                label="Age (Auto-calculated)"
                value={
                  formData.personalDetails.age !== null
                    ? `${formData.personalDetails.age} years`
                    : 'Auto from DOB'
                }
                isReadOnly={true}
                hint="Computed from birthdate"
              />
            </View>
          </View>

          <SelectField
            label="Gender *"
            value={formData.personalDetails.gender}
            placeholder="Select Gender"
            onPress={() =>
              openPicker('Select Gender', GENDER_OPTIONS, (val) =>
                updateField('personalDetails', 'gender', val)
              )
            }
          />

          <SelectField
            label="Marital Status *"
            value={formData.personalDetails.maritalStatus}
            placeholder="Select Marital Status"
            onPress={() =>
              openPicker('Select Marital Status', MARITAL_STATUS_OPTIONS, (val) =>
                updateField('personalDetails', 'maritalStatus', val)
              )
            }
          />

          <SelectField
            label="Community *"
            value={formData.personalDetails.community}
            placeholder="Select Community"
            onPress={() =>
              openPicker('Select Community', COMMUNITY_OPTIONS, (val) =>
                updateField('personalDetails', 'community', val)
              )
            }
          />

          <FormField
            label="Caste (Optional)"
            value={formData.personalDetails.caste}
            onChangeText={(t) => updateField('personalDetails', 'caste', t)}
            placeholder="Enter caste name if applicable"
          />
        </SectionContainer>

        {/* ======================================================== */}
        {/* SECTION 2: ADDRESS & LOCATION */}
        {/* ======================================================== */}
        <SectionContainer
          index={2}
          title="2. Address & Location"
          icon="location-outline"
          isExpanded={expandedSections[2]}
          onToggle={() => toggleSection(2)}
          isCompleted={Boolean(
            formData.address.address && formData.address.city && formData.address.pinCode
          )}
        >
          <FormField
            label="Residential Address *"
            value={formData.address.address}
            onChangeText={(t) => updateField('address', 'address', t)}
            placeholder="House/Flat No, Street, Landmark"
            multiline={true}
          />

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <FormField
                label="City *"
                value={formData.address.city}
                onChangeText={(t) => updateField('address', 'city', t)}
                placeholder="e.g. Mumbai"
              />
            </View>
            <View style={styles.halfCol}>
              <FormField
                label="District *"
                value={formData.address.district}
                onChangeText={(t) => updateField('address', 'district', t)}
                placeholder="e.g. Mumbai Suburban"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <FormField
                label="Division"
                value={formData.address.division}
                onChangeText={(t) => updateField('address', 'division', t)}
                placeholder="e.g. Konkan"
              />
            </View>
            <View style={styles.halfCol}>
              <FormField
                label="Taluk / Tehsil"
                value={formData.address.taluk}
                onChangeText={(t) => updateField('address', 'taluk', t)}
                placeholder="e.g. Andheri"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <FormField
                label="Zone / Ward"
                value={formData.address.zone}
                onChangeText={(t) => updateField('address', 'zone', t)}
                placeholder="e.g. Zone K-West"
              />
            </View>
            <View style={styles.halfCol}>
              <FormField
                label="PIN Code *"
                value={formData.address.pinCode}
                onChangeText={(t) => updateField('address', 'pinCode', t)}
                placeholder="400001"
                keyboardType="numeric"
                maxLength={6}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <FormField
                label="State *"
                value={formData.address.state || 'Maharashtra'}
                onChangeText={(t) => updateField('address', 'state', t)}
                placeholder="Maharashtra"
              />
            </View>
            <View style={styles.halfCol}>
              <FormField
                label="Country *"
                value={formData.address.country || 'India'}
                onChangeText={(t) => updateField('address', 'country', t)}
                placeholder="India"
              />
            </View>
          </View>
        </SectionContainer>

        {/* ======================================================== */}
        {/* SECTION 3: CONTACT DETAILS */}
        {/* ======================================================== */}
        <SectionContainer
          index={3}
          title="3. Contact Information"
          icon="call-outline"
          isExpanded={expandedSections[3]}
          onToggle={() => toggleSection(3)}
          isCompleted={Boolean(formData.contact.phoneNumber && formData.contact.emailAddress)}
        >
          <FormField
            label="Mobile Phone Number *"
            value={formData.contact.phoneNumber}
            onChangeText={(t) => updateField('contact', 'phoneNumber', t)}
            placeholder="+919876543210"
            keyboardType="phone-pad"
          />

          <FormField
            label="Telephone / Landline (Optional)"
            value={formData.contact.telephoneNumber}
            onChangeText={(t) => updateField('contact', 'telephoneNumber', t)}
            placeholder="022-22001122"
            keyboardType="phone-pad"
          />

          <FormField
            label="Email Address *"
            value={formData.contact.emailAddress}
            onChangeText={(t) => updateField('contact', 'emailAddress', t)}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </SectionContainer>

        {/* ======================================================== */}
        {/* SECTION 4: FAMILY DETAILS */}
        {/* ======================================================== */}
        <SectionContainer
          index={4}
          title="4. Family Details"
          icon="people-outline"
          isExpanded={expandedSections[4]}
          onToggle={() => toggleSection(4)}
          isCompleted={Boolean(
            formData.family.fatherName || formData.family.motherName || formData.family.guardianName
          )}
        >
          {/* Father */}
          <Text style={styles.subHeading}>Father Details</Text>
          <FormField
            label="Father Full Name"
            value={formData.family.fatherName}
            onChangeText={(t) => updateField('family', 'fatherName', t)}
            placeholder="Enter father's legal name"
          />
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <FormField
                label="Father Mobile Number"
                value={formData.family.fatherMobileNumber}
                onChangeText={(t) => updateField('family', 'fatherMobileNumber', t)}
                placeholder="+919876543210"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.halfCol}>
              <FormField
                label="Father Phone (Landline)"
                value={formData.family.fatherPhoneNumber}
                onChangeText={(t) => updateField('family', 'fatherPhoneNumber', t)}
                placeholder="022-XXXXXXX"
                keyboardType="phone-pad"
              />
            </View>
          </View>
          <FormField
            label="Father Email Address"
            value={formData.family.fatherEmail}
            onChangeText={(t) => updateField('family', 'fatherEmail', t)}
            placeholder="father@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Mother */}
          <Text style={[styles.subHeading, { marginTop: Spacing.sm }]}>Mother Details</Text>
          <FormField
            label="Mother Full Name"
            value={formData.family.motherName}
            onChangeText={(t) => updateField('family', 'motherName', t)}
            placeholder="Enter mother's legal name"
          />
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <FormField
                label="Mother Mobile Number"
                value={formData.family.motherMobileNumber}
                onChangeText={(t) => updateField('family', 'motherMobileNumber', t)}
                placeholder="+919876543211"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.halfCol}>
              <FormField
                label="Mother Email Address"
                value={formData.family.motherEmail}
                onChangeText={(t) => updateField('family', 'motherEmail', t)}
                placeholder="mother@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Spouse */}
          <Text style={[styles.subHeading, { marginTop: Spacing.sm }]}>Spouse Details (If Married)</Text>
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <FormField
                label="Spouse Full Name"
                value={formData.family.spouseName}
                onChangeText={(t) => updateField('family', 'spouseName', t)}
                placeholder="Enter spouse name"
              />
            </View>
            <View style={styles.halfCol}>
              <FormField
                label="Spouse Contact Number"
                value={formData.family.spouseNumber}
                onChangeText={(t) => updateField('family', 'spouseNumber', t)}
                placeholder="+919876543212"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Guardian */}
          <Text style={[styles.subHeading, { marginTop: Spacing.sm }]}>Guardian Details (If Applicable)</Text>
          <FormField
            label="Guardian Full Name"
            value={formData.family.guardianName}
            onChangeText={(t) => updateField('family', 'guardianName', t)}
            placeholder="Enter legal guardian name"
          />
          <View style={styles.row}>
            <View style={styles.halfCol}>
              <FormField
                label="Guardian Phone Number"
                value={formData.family.guardianPhoneNumber}
                onChangeText={(t) => updateField('family', 'guardianPhoneNumber', t)}
                placeholder="+919876543213"
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.halfCol}>
              <FormField
                label="Guardian Email ID"
                value={formData.family.guardianEmail}
                onChangeText={(t) => updateField('family', 'guardianEmail', t)}
                placeholder="guardian@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
        </SectionContainer>

        {/* ======================================================== */}
        {/* SECTION 5: IDENTITY DETAILS */}
        {/* ======================================================== */}
        <SectionContainer
          index={5}
          title="5. Identity Details"
          icon="card-outline"
          isExpanded={expandedSections[5]}
          onToggle={() => toggleSection(5)}
          isCompleted={Boolean(
            formData.identity.aadhaarReference && formData.identity.panCardNumber
          )}
        >
          <FormField
            label="Aadhaar Reference / Number *"
            value={formData.identity.aadhaarReference}
            onChangeText={(t) => updateField('identity', 'aadhaarReference', t)}
            placeholder="XXXX-XXXX-1234 or 12-digit UID"
            hint="Masked token used for statutory identity verification"
          />

          <FormField
            label="PAN Card Number *"
            value={formData.identity.panCardNumber}
            onChangeText={(t) => updateField('identity', 'panCardNumber', t.toUpperCase())}
            placeholder="ABCDE1234F"
            autoCapitalize="characters"
            maxLength={10}
            hint="10-character alphanumeric Permanent Account Number"
          />
        </SectionContainer>

        {/* ======================================================== */}
        {/* SECTION 6: EDUCATIONAL QUALIFICATION */}
        {/* ======================================================== */}
        <SectionContainer
          index={6}
          title="6. Education"
          icon="school-outline"
          isExpanded={expandedSections[6]}
          onToggle={() => toggleSection(6)}
          isCompleted={Boolean(formData.education.educationalQualification)}
        >
          <SelectField
            label="Educational Qualification *"
            value={formData.education.educationalQualification}
            placeholder="Select highest qualification"
            onPress={() =>
              openPicker('Select Educational Qualification', EDUCATION_OPTIONS, (val) =>
                updateField('education', 'educationalQualification', val)
              )
            }
          />
        </SectionContainer>

        {/* ======================================================== */}
        {/* SECTION 7: BANK DETAILS */}
        {/* ======================================================== */}
        <SectionContainer
          index={7}
          title="7. Bank Details"
          icon="wallet-outline"
          isExpanded={expandedSections[7]}
          onToggle={() => toggleSection(7)}
          isCompleted={Boolean(
            formData.bank.bankName &&
              formData.bank.accountNumber &&
              formData.bank.ifscCode
          )}
        >
          <FormField
            label="Bank Name *"
            value={formData.bank.bankName}
            onChangeText={(t) => updateField('bank', 'bankName', t)}
            placeholder="e.g. State Bank of India / Bank of Maharashtra"
          />

          <FormField
            label="Account Holder Name *"
            value={formData.bank.accountHolderName}
            onChangeText={(t) => updateField('bank', 'accountHolderName', t)}
            placeholder="Name as printed in passbook"
          />

          <FormField
            label="Bank Account Number *"
            value={formData.bank.accountNumber}
            onChangeText={(t) => updateField('bank', 'accountNumber', t)}
            placeholder="e.g. 10023456789"
            keyboardType="numeric"
            hint="For Direct Benefit Transfer (DBT) and statutory schemes"
          />

          <View style={styles.row}>
            <View style={styles.halfCol}>
              <FormField
                label="IFSC Code *"
                value={formData.bank.ifscCode}
                onChangeText={(t) => updateField('bank', 'ifscCode', t.toUpperCase())}
                placeholder="SBIN0001234"
                autoCapitalize="characters"
                maxLength={11}
              />
            </View>
            <View style={styles.halfCol}>
              <FormField
                label="Branch Name"
                value={formData.bank.branchName}
                onChangeText={(t) => updateField('bank', 'branchName', t)}
                placeholder="e.g. Nariman Point"
              />
            </View>
          </View>
        </SectionContainer>

        {/* ======================================================== */}
        {/* SECTION 8: PASSPORT DETAILS & PDF UPLOAD */}
        {/* ======================================================== */}
        <SectionContainer
          index={8}
          title="8. Passport Details"
          icon="airplane-outline"
          isExpanded={expandedSections[8]}
          onToggle={() => toggleSection(8)}
          isCompleted={
            !formData.passport.hasPassport || Boolean(formData.passport.documentPath)
          }
        >
          <Text style={styles.questionLabel}>Do you have a Passport? *</Text>
          <View style={styles.segmentedControl}>
            <TouchableOpacity
              style={[
                styles.segmentBtn,
                formData.passport.hasPassport && styles.segmentBtnActive,
              ]}
              onPress={() => handlePassportToggle(true)}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  formData.passport.hasPassport && styles.segmentBtnTextActive,
                ]}
              >
                Yes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentBtn,
                !formData.passport.hasPassport && styles.segmentBtnActive,
              ]}
              onPress={() => handlePassportToggle(false)}
            >
              <Text
                style={[
                  styles.segmentBtnText,
                  !formData.passport.hasPassport && styles.segmentBtnTextActive,
                ]}
              >
                No
              </Text>
            </TouchableOpacity>
          </View>

          {/* Conditional Passport Upload Card */}
          {formData.passport.hasPassport ? (
            <View style={styles.passportUploadContainer}>
              <Text style={styles.uploadPromptTitle}>Upload Passport Document (PDF)</Text>
              <Text style={styles.uploadPromptSub}>
                Passport document must be a PDF file smaller than 10 MB. Encrypted in private government storage.
              </Text>

              {formData.passport.documentPath ? (
                <View style={styles.uploadedDocCard}>
                  <View style={styles.docIconBox}>
                    <Ionicons name="document-text" size={28} color={Colors.primary} />
                  </View>
                  <View style={styles.docInfo}>
                    <Text style={styles.docName} numberOfLines={1}>
                      {formData.passport.fileName || 'passport.pdf'}
                    </Text>
                    <Text style={styles.docMeta}>
                      Size:{' '}
                      {formData.passport.fileSize
                        ? `${(formData.passport.fileSize / (1024 * 1024)).toFixed(2)} MB`
                        : '< 10 MB'}{' '}
                      • Valid PDF
                    </Text>
                    <View style={styles.docBadge}>
                      <Ionicons name="shield-checkmark" size={12} color={Colors.success} />
                      <Text style={styles.docBadgeText}>Secured in Private Storage</Text>
                    </View>
                  </View>

                  <View style={styles.docActions}>
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={handlePickPassportPDF}
                      disabled={uploadingPassport}
                    >
                      <Ionicons name="refresh" size={18} color={Colors.primary} />
                      <Text style={styles.actionIconText}>Replace</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionIconBtn, { borderColor: '#FCA5A5' }]}
                      onPress={handleRemovePassportFile}
                      disabled={uploadingPassport}
                    >
                      <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                      <Text style={[styles.actionIconText, { color: Colors.danger }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadBox}
                  onPress={handlePickPassportPDF}
                  disabled={uploadingPassport}
                >
                  {uploadingPassport ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={32} color={Colors.primary} />
                      <Text style={styles.uploadBoxText}>Choose PDF Document</Text>
                      <Text style={styles.uploadBoxHint}>PDF only • Maximum 10 MB</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.noPassportNote}>
              <Ionicons name="checkmark-circle-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.noPassportText}>
                No passport on record. Passport document upload is disabled.
              </Text>
            </View>
          )}
        </SectionContainer>

        {/* ======================================================== */}
        {/* SECTION 9: DEPARTMENT & OFFICIAL DETAILS (Non-Citizen Roles) */}
        {/* ======================================================== */}
        {isOfficerOrAdmin && (
          <SectionContainer
            index={9}
            title="9. Official Department Details"
            icon="business-outline"
            isExpanded={expandedSections[9]}
            onToggle={() => toggleSection(9)}
            isCompleted={Boolean(formData.departmentDetails?.employeeId)}
          >
            <FormField
              label="Department Identifier"
              value={formData.departmentDetails?.departmentId || String(user?.departmentId || '')}
              isReadOnly={true}
              hint="Assigned by State Administration"
            />
            <FormField
              label="Official Designation *"
              value={formData.departmentDetails?.designation || ''}
              onChangeText={(t) => updateField('departmentDetails', 'designation', t)}
              placeholder="e.g. Verification Officer / Senior Auditor"
            />
            <FormField
              label="Employee / Officer ID *"
              value={formData.departmentDetails?.employeeId || ''}
              onChangeText={(t) => updateField('departmentDetails', 'employeeId', t)}
              placeholder="e.g. MH-GOV-8942"
            />
            <FormField
              label="Office / Directorate Name"
              value={formData.departmentDetails?.officeName || ''}
              onChangeText={(t) => updateField('departmentDetails', 'officeName', t)}
              placeholder="e.g. Mantralaya, Mumbai"
            />
            <FormField
              label="Office Address"
              value={formData.departmentDetails?.officeAddress || ''}
              onChangeText={(t) => updateField('departmentDetails', 'officeAddress', t)}
              placeholder="Floor, Wing, Office address"
              multiline={true}
            />
          </SectionContainer>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={() => handleSave(false)}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.saveBtnText}>Save Profile</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveContinueBtn, saving && styles.btnDisabled]}
            onPress={() => handleSave(true)}
            disabled={saving}
          >
            <Text style={styles.saveContinueBtnText}>Save & Finish</Text>
            <Ionicons name="arrow-forward" size={18} color={Colors.primary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Dropdown Options Modal */}
      <Modal visible={pickerVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{pickerTitle}</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Ionicons name="close" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 320 }}>
              {pickerOptions.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={styles.pickerItem}
                  onPress={() => pickerOnSelect(opt)}
                >
                  <Text style={styles.pickerItemText}>{opt}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ==========================================
// SUB-COMPONENTS
// ==========================================

function SectionContainer({
  index,
  title,
  icon,
  isExpanded,
  onToggle,
  isCompleted,
  children,
}: {
  index: number;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  isExpanded: boolean;
  onToggle: () => void;
  isCompleted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <TouchableOpacity style={styles.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIconCircle, isCompleted && styles.sectionIconCircleComplete]}>
            <Ionicons
              name={isCompleted ? 'checkmark' : icon}
              size={18}
              color={isCompleted ? Colors.success : Colors.primary}
            />
          </View>
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>

        <View style={styles.sectionHeaderRight}>
          {isCompleted && (
            <View style={styles.sectionDoneBadge}>
              <Text style={styles.sectionDoneText}>Done</Text>
            </View>
          )}
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={Colors.textMuted}
          />
        </View>
      </TouchableOpacity>

      {isExpanded && <View style={styles.sectionBody}>{children}</View>}
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  maxLength,
  multiline = false,
  isReadOnly = false,
  hint,
}: {
  label: string;
  value?: string | null;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
  maxLength?: number;
  multiline?: boolean;
  isReadOnly?: boolean;
  hint?: string;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, isReadOnly && styles.readOnlyInput, multiline && styles.multilineInput]}
        value={value || ''}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        multiline={multiline}
        editable={!isReadOnly}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function SelectField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value?: string | null;
  placeholder: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity style={styles.selectBtn} onPress={onPress} activeOpacity={0.7}>
        <Text style={[styles.selectText, !value && styles.placeholderText]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

// ==========================================
// STYLES
// ==========================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: Spacing.sm,
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  content: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl + 40,
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.md,
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  summaryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  summaryTitleCol: {
    flex: 1,
  },
  summaryHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.2,
  },
  summarySub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  percentBadge: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  percentBadgeComplete: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  percentText: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: Spacing.xs + 2,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  missingHint: {
    fontSize: 11,
    color: '#B45309',
    marginTop: Spacing.xs,
    fontWeight: '500',
  },
  expandControlsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xs + 4,
    paddingTop: Spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  expandCtrlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  expandCtrlText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md - 2,
    backgroundColor: '#FFFFFF',
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  sectionIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionIconCircleComplete: {
    backgroundColor: '#ECFDF5',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionDoneBadge: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  sectionDoneText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.success,
  },
  sectionBody: {
    padding: Spacing.md,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  fieldContainer: {
    marginBottom: Spacing.sm + 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  fieldHint: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 4,
    fontSize: 13,
    color: '#0F172A',
  },
  readOnlyInput: {
    backgroundColor: '#F1F5F9',
    color: '#64748B',
    borderColor: '#E2E8F0',
  },
  multilineInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  selectBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs + 4,
  },
  selectText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '500',
  },
  placeholderText: {
    color: '#94A3B8',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  halfCol: {
    flex: 1,
  },
  subHeading: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
    marginBottom: Spacing.xs,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  questionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: Spacing.xs,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: BorderRadius.sm,
    padding: 3,
    marginBottom: Spacing.md,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: BorderRadius.sm - 2,
  },
  segmentBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentBtnTextActive: {
    fontWeight: '800',
    color: Colors.primary,
  },
  passportUploadContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    padding: Spacing.md,
  },
  uploadPromptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  uploadPromptSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  uploadBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#93C5FD',
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBoxText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 4,
  },
  uploadBoxHint: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  uploadedDocCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: Spacing.sm,
  },
  docIconBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  docInfo: {
    flex: 1,
  },
  docName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  docMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  docBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  docBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.success,
  },
  docActions: {
    gap: 4,
  },
  actionIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#FFFFFF',
  },
  actionIconText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
  },
  noPassportNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.sm,
  },
  noPassportText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  actionButtonsContainer: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.md,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  saveContinueBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.md,
  },
  saveContinueBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.primary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '100%',
    maxWidth: 380,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: Spacing.xs,
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  pickerItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
});
