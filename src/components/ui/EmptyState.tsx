import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={styles.iconFrame}>
        <Icon color={colors.primary} size={28} strokeWidth={1.8} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
  },
  compact: {
    paddingVertical: spacing.lg,
  },
  iconFrame: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
  },
  title: {
    color: colors.text,
    textAlign: 'center',
    ...typography.subheading,
  },
  description: {
    maxWidth: 360,
    marginTop: spacing.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    ...typography.body,
  },
  action: {
    width: '100%',
    maxWidth: 320,
    marginTop: spacing.lg,
  },
});

