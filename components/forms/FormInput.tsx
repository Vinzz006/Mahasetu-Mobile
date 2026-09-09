import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { Colors, Spacing, Typography, BorderRadius } from '../../constants/theme';

interface FormInputProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  isReadOnly?: boolean;
}

export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  hint,
  isReadOnly = false,
  style,
  ...rest
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          isReadOnly && styles.readOnlyInput,
          error ? styles.errorInput : null,
          style,
        ]}
        placeholderTextColor={Colors.textMuted}
        editable={!isReadOnly}
        {...rest}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: Typography.fontSize.xs,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs - 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: Typography.fontSize.sm,
    color: Colors.textPrimary,
  },
  readOnlyInput: {
    backgroundColor: Colors.surfaceSubtle,
    color: Colors.textSecondary,
    borderColor: Colors.border,
  },
  errorInput: {
    borderColor: Colors.danger,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.fontSize.xs - 2,
    marginTop: 3,
    fontWeight: '600',
  },
  hintText: {
    color: Colors.textMuted,
    fontSize: Typography.fontSize.xs - 2,
    marginTop: 3,
  },
});
