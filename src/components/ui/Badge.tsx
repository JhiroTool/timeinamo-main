import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'error';

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  icon?: LucideIcon;
}

const tones = {
  neutral: { background: '#F1F5F9', text: colors.textSecondary },
  primary: { background: colors.primarySoft, text: colors.primaryDark },
  success: { background: colors.successSoft, text: colors.success },
  warning: { background: colors.warningSoft, text: colors.warning },
  error: { background: colors.errorSoft, text: colors.error },
} as const;

export function Badge({ label, tone = 'neutral', icon: Icon }: BadgeProps) {
  const palette = tones[tone];
  return (
    <View
      accessibilityLabel={label}
      style={[styles.badge, { backgroundColor: palette.background }]}
    >
      {Icon ? <Icon color={palette.text} size={14} strokeWidth={2.2} /> : null}
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
  },
});

