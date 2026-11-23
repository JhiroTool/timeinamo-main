import { AlertTriangle } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

import { Button } from './ui';

interface DatabaseErrorViewProps {
  error: Error;
  onRetry: () => void;
}

export function DatabaseErrorView({ error, onRetry }: DatabaseErrorViewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.icon}>
        <AlertTriangle color={colors.error} size={28} />
      </View>
      <Text style={styles.title}>Local storage is unavailable</Text>
      <Text style={styles.message}>{error.message}</Text>
      <Button onPress={onRetry} title="Try again" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  icon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorSoft,
    borderRadius: radius.lg,
  },
  title: {
    color: colors.text,
    textAlign: 'center',
    ...typography.heading,
  },
  message: {
    maxWidth: 420,
    color: colors.textSecondary,
    textAlign: 'center',
    ...typography.body,
  },
});

