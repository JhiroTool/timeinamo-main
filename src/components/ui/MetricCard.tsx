import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

export function MetricCard({ icon: Icon, label, value, note }: { icon?: LucideIcon; label: string; value: string; note?: string }) {
  return (
    <View style={styles.card}>
      {Icon ? <Icon color={colors.primaryBright} size={21} /> : null}
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 142,
    flex: 1,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  value: { marginTop: spacing.xs, color: colors.text, ...typography.heading, fontVariant: ['tabular-nums'] },
  label: { marginTop: spacing.xxs, color: colors.textSecondary, ...typography.caption },
  note: { marginTop: spacing.xs, color: colors.textMuted, ...typography.caption },
});
