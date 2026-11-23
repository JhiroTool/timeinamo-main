import type { LucideIcon } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const variantStyles = {
  primary: { background: colors.primary, border: colors.primary, text: '#FFFFFF' },
  secondary: { background: colors.primarySoft, border: colors.primarySoft, text: colors.primaryDark },
  outline: { background: colors.surface, border: colors.borderStrong, text: colors.text },
  ghost: { background: colors.transparent, border: colors.transparent, text: colors.primaryDark },
  danger: { background: colors.error, border: colors.error, text: '#FFFFFF' },
} as const;

export function Button({
  title,
  variant = 'primary',
  icon: Icon,
  loading = false,
  fullWidth = false,
  disabled = false,
  style,
  accessibilityLabel,
  ...props
}: ButtonProps) {
  const palette = variantStyles[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.background, borderColor: palette.border },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      {...props}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={palette.text} size="small" />
        ) : Icon ? (
          <Icon color={palette.text} size={20} strokeWidth={2} />
        ) : null}
        <Text style={[styles.label, { color: palette.text }]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.button,
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
});

