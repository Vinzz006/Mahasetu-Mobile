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
import { DEMO_USERS, DEMO_PASSWORD } from '../../constants/demoData';

export default function LoginScreen() {
  const { signInWithEmail, signUpWithEmail, sendPasswordReset } = useAuth();

  // Mode: 'signin' | 'register'
  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'citizen':
        return '#0284C7';
      case 'department_officer':
        return '#7C3AED';
      case 'admin':
        return '#D97706';
      case 'auditor':
        return '#0D9488';
      default:
        return Colors.primary;
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

        {/* Quick Demo Switcher Section */}
        <View style={styles.demoSection}>
          <View style={styles.demoSectionHeader}>
            <Ionicons name="flash" size={16} color="#F59E0B" />
            <Text style={styles.demoSectionTitle}>Official Demo Personas (1-Tap Auto-fill)</Text>
          </View>
          <Text style={styles.demoSectionDesc}>
            Tap any persona to autofill demo credentials and test role-based access:
          </Text>
          <View style={styles.demoGrid}>
            {DEMO_USERS.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.demoCard}
                onPress={() => {
                  setEmail(u.email);
                  setPassword(DEMO_PASSWORD);
                  setAuthMode('signin');
                }}
                accessibilityLabel={`Fill credentials for ${u.name}`}
              >
                <View style={styles.demoCardHeader}>
                  <Text style={styles.demoCardName} numberOfLines={1}>{u.name}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: getRoleBadgeColor(u.role) }]}>
                    <Text style={styles.roleBadgeText}>
                      {u.role === 'citizen'
                        ? 'Citizen'
                        : u.role === 'department_officer'
                        ? (u.departmentId ? u.departmentId.replace('DEPT_', 'Dept ') : 'Officer')
                        : u.role === 'admin'
                        ? 'Admin'
                        : 'Auditor'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.demoCardEmail} numberOfLines={1}>{u.email}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  demoSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  demoSectionTitle: {
    fontSize: Typography.fontSize.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  demoSectionDesc: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  demoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'space-between',
  },
  demoCard: {
    width: '48%',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.xs,
  },
  demoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
    gap: 4,
  },
  demoCardName: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  roleBadgeText: {
    color: Colors.textInverse,
    fontSize: 9,
    fontWeight: '800',
  },
  demoCardEmail: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
