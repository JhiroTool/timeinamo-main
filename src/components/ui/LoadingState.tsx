import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

interface LoadingStateProps {
  label?: string;
  fullPage?: boolean;
}

export function LoadingState({ label = 'Loading…', fullPage = false }: LoadingStateProps) {
  return (
    <View
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      style={[styles.container, fullPage && styles.fullPage]}
    >
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
  },
  fullPage: {
    flex: 1,
    backgroundColor: colors.background,
  },
  label: {
    color: colors.textSecondary,
    ...typography.body,
  },
});

