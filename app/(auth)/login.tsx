import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../store/AuthContext';
import { authService } from '../../services/authService';
import { DEMO_USERS, DemoUser } from '../../constants/demoData';

export default function LoginScreen() {
  const { loginAsDemoUser, signInWithEmail, signUpWithEmail, sendPasswordReset } = useAuth();

  // Mode: 'signin' | 'register'
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Demo loading state
  const [loadingDemoId, setLoadingDemoId] = useState<string | null>(null);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  // Handle Email/Password Sign In
  const handleSignIn = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      Alert.alert('Missing Email', 'Please enter your registered email address.');
      return;
    }
    if (!password) {
      Alert.alert('Missing Password', 'Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmail(cleanEmail, password);
    } catch (e: any) {
      const friendlyMessage = authService.mapAuthError(e);
      Alert.alert('Sign In Failed', friendlyMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Email/Password Registration
  const handleRegister = async () => {
    const cleanName = displayName.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      Alert.alert('Missing Name', 'Please enter your full name.');
      return;
    }
    if (!cleanEmail) {
      Alert.alert('Missing Email', 'Please enter a valid email address.');
      return;
    }
    if (!password) {
      Alert.alert('Missing Password', 'Please enter a password.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'The passwords you entered do not match. Please re-enter.');
      return;
    }

    setSubmitting(true);
    try {
      await signUpWithEmail(cleanEmail, password, cleanName);
    } catch (e: any) {
      const friendlyMessage = authService.mapAuthError(e);
      Alert.alert('Registration Failed', friendlyMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Forgot Password
  const handleSendPasswordReset = async () => {
    const cleanEmail = resetEmail.trim() || email.trim();
    if (!cleanEmail) {
      Alert.alert('Missing Email', 'Please enter the email address for password recovery.');
      return;
    }

    setSendingReset(true);
    try {
      await sendPasswordReset(cleanEmail);
      Alert.alert(
        'Password Reset Sent',
        `Password reset link sent to ${cleanEmail}. Please check your email inbox and spam folder.`
      );
      setShowForgotModal(false);
      setResetEmail('');
    } catch (e: any) {
      const friendlyMessage = authService.mapAuthError(e);
      Alert.alert('Reset Error', friendlyMessage);
    } finally {
      setSendingReset(false);
    }
  };

  // Handle Demo Account Login
  const handleSelectDemo = async (demo: DemoUser) => {
    setLoadingDemoId(demo.id);
    try {
      await loginAsDemoUser(demo);
    } catch (e: any) {
      Alert.alert('Demo Login Error', e.message || 'Failed to authenticate demo account.');
    } finally {
      setLoadingDemoId(null);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <Image
              source={require('../../assets/images/indian-flag.png')}
              style={styles.flagLogo}
              resizeMode="cover"
              accessibilityLabel="Indian National Flag"
            />
          </View>
          <Text style={styles.brandTitle}>MAHASETU</Text>
          <Text style={styles.brandSubtitle}>Government Of Maharashtra</Text>
          <View style={styles.taglineChip}>
            <Text style={styles.taglineText}>Submit Once • Consent • Multi-Department Verification</Text>
          </View>
        </View>

        {/* Primary Auth Form Card */}
        <View style={styles.sectionCard}>
          {/* Mode Tabs */}
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, authMode === 'signin' && styles.tabBtnActive]}
              onPress={() => setAuthMode('signin')}
              disabled={submitting}
            >
              <Ionicons
                name="log-in-outline"
                size={16}
                color={authMode === 'signin' ? Colors.primary : Colors.textMuted}
              />
              <Text
                style={[styles.tabBtnText, authMode === 'signin' && styles.tabBtnTextActive]}
              >
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, authMode === 'register' && styles.tabBtnActive]}
              onPress={() => setAuthMode('register')}
              disabled={submitting}
            >
              <Ionicons
                name="person-add-outline"
                size={16}
                color={authMode === 'register' ? Colors.primary : Colors.textMuted}
              />
              <Text
                style={[styles.tabBtnText, authMode === 'register' && styles.tabBtnTextActive]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Header */}
          <Text style={styles.cardTitle}>
            {authMode === 'signin' ? 'Sign In to MahaSetu' : 'Create New Account'}
          </Text>
          <Text style={styles.cardDesc}>
            {authMode === 'signin'
              ? 'Enter your registered email and password to access the portal.'
              : 'New accounts are registered under Pending Admin Approval for security.'}
          </Text>

          {/* Form Fields */}
          {authMode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Ramesh Kumar"
                  placeholderTextColor={Colors.textMuted}
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  editable={!submitting}
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>OFFICIAL EMAIL</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="name@example.gov.in"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!submitting}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              {authMode === 'signin' && (
                <TouchableOpacity
                  onPress={() => {
                    setResetEmail(email.trim());
                    setShowForgotModal(true);
                  }}
                  disabled={submitting}
                >
                  <Text style={styles.forgotLink}>Forgot Password?</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder={authMode === 'register' ? 'At least 6 characters' : 'Enter your password'}
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!submitting}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((prev) => !prev)}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>

          {authMode === 'register' && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Re-enter your password"
                  placeholderTextColor={Colors.textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!submitting}
                />
              </View>
            </View>
          )}

          {/* Submit Action Button */}
          <TouchableOpacity
            style={[styles.actionButton, submitting && styles.actionButtonDisabled]}
            onPress={authMode === 'signin' ? handleSignIn : handleRegister}
            disabled={submitting}
            accessibilityLabel={authMode === 'signin' ? 'Sign In' : 'Register Account'}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <>
                <Ionicons
                  name={authMode === 'signin' ? 'arrow-forward-circle' : 'checkmark-circle'}
                  size={20}
                  color={Colors.textInverse}
                  style={styles.actionButtonIcon}
                />
                <Text style={styles.actionButtonText}>
                  {authMode === 'signin' ? 'Sign In' : 'Register Account'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Switch Mode Toggle Link */}
          <TouchableOpacity
            style={styles.switchModeRow}
            onPress={() => setAuthMode(authMode === 'signin' ? 'register' : 'signin')}
            disabled={submitting}
          >
            <Text style={styles.switchModeText}>
              {authMode === 'signin'
                ? "Don't have an account? "
                : 'Already have an account? '}
              <Text style={styles.switchModeLink}>
                {authMode === 'signin' ? 'Create Account' : 'Sign In'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        {/* Forgot Password Modal */}
        <Modal
          visible={showForgotModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowForgotModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.forgotCard}>
              <View style={styles.modalHeaderRow}>
                <Ionicons name="key-outline" size={24} color={Colors.primary} />
                <Text style={styles.modalHeaderTitle}>Reset Password</Text>
              </View>
              <Text style={styles.modalHeaderDesc}>
                Enter your registered MahaSetu email. We will send a secure password reset link to your inbox.
              </Text>

              <View style={[styles.inputWrapper, { marginTop: Spacing.sm }]}>
                <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="name@example.gov.in"
                  placeholderTextColor={Colors.textMuted}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!sendingReset}
                />
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowForgotModal(false)}
                  disabled={sendingReset}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalSubmitBtn, sendingReset && styles.actionButtonDisabled]}
                  onPress={handleSendPasswordReset}
                  disabled={sendingReset}
                >
                  {sendingReset ? (
                    <ActivityIndicator size="small" color={Colors.textInverse} />
                  ) : (
                    <Text style={styles.modalSubmitText}>Send Reset Link</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Demo Accounts Quick-Switch Section (Strictly gated to Development & Demo Mode) */}
        {Boolean(typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_DEMO_MODE === 'true') && (
          <View style={styles.demoSection}>
            <View style={styles.demoHeaderRow}>
              <Ionicons name="people-circle-outline" size={22} color={Colors.primary} />
              <Text style={styles.demoSectionTitle}>Official Demo Persona Switcher</Text>
            </View>
            <Text style={styles.demoSectionDesc}>
              Select any official persona to test role-isolated dashboards with authentic Firebase Authentication:
            </Text>

            {/* Citizens */}
            <Text style={styles.categoryLabel}>CITIZENS (Self-Service & Submit-Once)</Text>
            {DEMO_USERS.filter((u) => u.role === 'citizen').map((demo) => (
              <TouchableOpacity
                key={demo.id}
                style={styles.demoCard}
                onPress={() => handleSelectDemo(demo)}
                disabled={loadingDemoId !== null || submitting}
              >
                <View style={styles.avatarCircle}>
                  <Ionicons name="person" size={18} color={Colors.primary} />
                </View>
                <View style={styles.demoInfo}>
                  <Text style={styles.demoName}>{demo.name}</Text>
                  <Text style={styles.demoRole}>Role: Citizen • {demo.city}</Text>
                </View>
                {loadingDemoId === demo.id ? (
                  <ActivityIndicator color={Colors.primary} size="small" />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            ))}

            {/* Department Officers */}
            <Text style={styles.categoryLabel}>DEPARTMENT OFFICERS (Verification Queue)</Text>
            {DEMO_USERS.filter((u) => u.role === 'department_officer').map((demo) => (
              <TouchableOpacity
                key={demo.id}
                style={[styles.demoCard, styles.deptCard]}
                onPress={() => handleSelectDemo(demo)}
                disabled={loadingDemoId !== null || submitting}
              >
                <View style={[styles.avatarCircle, styles.deptAvatar]}>
                  <Ionicons name="business" size={18} color={Colors.accent} />
                </View>
                <View style={styles.demoInfo}>
                  <Text style={styles.demoName}>{demo.name}</Text>
                  <Text style={styles.demoRole}>{demo.departmentName}</Text>
                </View>
                {loadingDemoId === demo.id ? (
                  <ActivityIndicator color={Colors.accent} size="small" />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            ))}

            {/* Administrators */}
            <Text style={styles.categoryLabel}>ADMINISTRATORS (Approvals, Matrix & Systems)</Text>
            {DEMO_USERS.filter((u) => u.role === 'admin').map((demo) => (
              <TouchableOpacity
                key={demo.id}
                style={[styles.demoCard, styles.adminCard]}
                onPress={() => handleSelectDemo(demo)}
                disabled={loadingDemoId !== null || submitting}
              >
                <View style={[styles.avatarCircle, styles.adminAvatar]}>
                  <Ionicons name="settings" size={18} color="#D97706" />
                </View>
                <View style={styles.demoInfo}>
                  <Text style={styles.demoName}>{demo.name}</Text>
                  <Text style={styles.demoRole}>State Administrator • HQ</Text>
                </View>
                {loadingDemoId === demo.id ? (
                  <ActivityIndicator color="#D97706" size="small" />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            ))}

            {/* Auditor */}
            <Text style={styles.categoryLabel}>INDEPENDENT AUDITOR (Compliance & Verification)</Text>
            {DEMO_USERS.filter((u) => u.role === 'auditor').map((demo) => (
              <TouchableOpacity
                key={demo.id}
                style={[styles.demoCard, styles.auditorCard]}
                onPress={() => handleSelectDemo(demo)}
                disabled={loadingDemoId !== null || submitting}
              >
                <View style={[styles.avatarCircle, styles.auditorAvatar]}>
                  <Ionicons name="shield" size={18} color="#7C3AED" />
                </View>
                <View style={styles.demoInfo}>
                  <Text style={styles.demoName}>{demo.name}</Text>
                  <Text style={styles.demoRole}>Compliance Auditor • Read-Only Logs + Verification</Text>
                </View>
                {loadingDemoId === demo.id ? (
                  <ActivityIndicator color="#7C3AED" size="small" />
                ) : (
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingBottom: Spacing.xxl + 20,
  },
  header: {
    backgroundColor: Colors.primaryDark,
    paddingTop: Spacing.xxl + 10,
    paddingBottom: Spacing.xl + 4,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: BorderRadius.lg * 1.5,
    borderBottomRightRadius: BorderRadius.lg * 1.5,
  },
  logoBadge: {
    width: 64,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  flagLogo: {
    width: 64,
    height: 44,
    borderRadius: BorderRadius.md,
  },
  brandTitle: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.title,
    fontWeight: '800',
    letterSpacing: 2,
  },
  brandSubtitle: {
    color: '#93C5FD',
    fontSize: Typography.fontSize.xs,
    marginTop: 4,
    textAlign: 'center',
  },
  taglineChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  taglineText: {
    color: '#FDE68A',
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: Spacing.md,
    marginTop: -Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadowColor,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.md,
    padding: 3,
    marginBottom: Spacing.md,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: Colors.surface,
    shadowColor: Colors.shadowColor,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabBtnTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  cardTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  cardDesc: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 3,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: Spacing.sm + 2,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: Typography.fontSize.xs - 2,
    fontWeight: '700',
    color: Colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  forgotLink: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '600',
    color: Colors.primary,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
  },
  inputIcon: {
    marginRight: Spacing.xs,
  },
  textInput: {
    flex: 1,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
    paddingVertical: Spacing.xs + 4,
  },
  eyeBtn: {
    padding: Spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md - 2,
    marginTop: Spacing.xs,
    gap: Spacing.xs,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  actionButtonDisabled: {
    opacity: 0.65,
  },
  actionButtonIcon: {
    marginRight: 2,
  },
  actionButtonText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
  },
  switchModeRow: {
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  switchModeText: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
  },
  switchModeLink: {
    color: Colors.primary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  forgotCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  modalHeaderTitle: {
    fontSize: Typography.fontSize.md,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalHeaderDesc: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  modalCancelBtn: {
    paddingVertical: Spacing.xs + 3,
    paddingHorizontal: Spacing.md,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },
  modalSubmitBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.xs + 3,
    paddingHorizontal: Spacing.md + 4,
    borderRadius: BorderRadius.sm,
  },
  modalSubmitText: {
    color: Colors.textInverse,
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
  },
  demoSection: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  demoHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  demoSectionTitle: {
    fontSize: Typography.fontSize.sm + 1,
    fontWeight: '800',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  demoSectionDesc: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  categoryLabel: {
    fontSize: Typography.fontSize.xs - 1,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  demoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deptCard: {
    borderColor: '#CCFBF1',
  },
  adminCard: {
    borderColor: '#FEF3C7',
  },
  auditorCard: {
    borderColor: '#EDE9FE',
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  deptAvatar: {
    backgroundColor: Colors.accentLight,
  },
  adminAvatar: {
    backgroundColor: '#FEF3C7',
  },
  auditorAvatar: {
    backgroundColor: '#EDE9FE',
  },
  demoInfo: {
    flex: 1,
  },
  demoName: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  demoRole: {
    fontSize: Typography.fontSize.xs - 1,
    color: Colors.textSecondary,
    marginTop: 1,
  },
});
