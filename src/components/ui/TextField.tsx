import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';

import { colors, fontFamilies, layout, radius, spacing, typography } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  helperText?: string | undefined;
  error?: string | undefined;
  icon?: LucideIcon;
  compact?: boolean;
}

export function TextField({
  label,
  helperText,
  error,
  icon: Icon,
  compact = false,
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
      <Text style={[styles.label, compact && styles.compactLabel]}>{label}</Text>
      <View
        style={[
          styles.inputFrame,
          compact && styles.compactFrame,
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
          style={[styles.input, compact && styles.compactInput, style]}
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
        <Text accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={[styles.supporting, compact && styles.compactSupporting, error && styles.error]}>{supportingText}</Text>
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
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
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
  compactLabel: { fontFamily: fontFamilies.label, fontWeight: 'normal' },
  compactFrame: { borderRadius: radius.md, backgroundColor: colors.surface },
  compactInput: { fontFamily: fontFamilies.body, fontWeight: 'normal', fontSize: 15 },
  compactSupporting: { fontFamily: fontFamilies.body, fontWeight: 'normal' },
});

