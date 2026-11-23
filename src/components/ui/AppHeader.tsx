import { ArrowLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, layout, radius, spacing, typography } from '@/theme';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: (() => void) | undefined;
  action?: ReactNode;
}

export function AppHeader({ title, subtitle, onBack, action }: AppHeaderProps) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          hitSlop={4}
          onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <ArrowLeft color={colors.text} size={22} strokeWidth={2} />
        </Pressable>
      ) : null}
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  back: {
    width: layout.minimumTouchTarget,
    height: layout.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
    borderRadius: radius.pill,
  },
  pressed: {
    backgroundColor: colors.border,
  },
  copy: {
    minWidth: 0,
    flex: 1,
  },
  title: {
    color: colors.text,
    ...typography.title,
  },
  subtitle: {
    marginTop: spacing.xxs,
    color: colors.textSecondary,
    ...typography.body,
  },
  action: {
    alignItems: 'flex-end',
  },
});

