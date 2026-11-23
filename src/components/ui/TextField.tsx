import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { colors, layout, radius, spacing, typography } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  helperText?: string | undefined;
  error?: string | undefined;
  icon?: LucideIcon;
}

export function TextField({
  label,
  helperText,
  error,
  icon: Icon,
  onFocus,
  onBlur,
  accessibilityLabel,
  style,
  ...props
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const supportingText = error ?? helperText;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputFrame,
          focused && styles.inputFrameFocused,
          error ? styles.inputFrameError : null,
        ]}
      >
        {Icon ? <Icon color={colors.textMuted} size={20} strokeWidth={2} /> : null}
        <TextInput
          accessibilityLabel={accessibilityLabel ?? label}
          accessibilityState={{ disabled: props.editable === false }}
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.primary}
          style={[styles.input, style]}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          {...props}
        />
      </View>
      {supportingText ? (
        <Text style={[styles.supporting, error ? styles.error : null]}>{supportingText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  inputFrame: {
    minHeight: layout.minimumTouchTarget + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
  },
  inputFrameFocused: {
    borderWidth: 2,
    borderColor: colors.primary,
    paddingHorizontal: spacing.md - 1,
  },
  inputFrameError: {
    borderColor: colors.error,
  },
  input: {
    minWidth: 0,
    flex: 1,
    minHeight: layout.minimumTouchTarget,
    paddingVertical: spacing.sm,
    color: colors.text,
    ...typography.body,
  },
  supporting: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  error: {
    color: colors.error,
  },
});

