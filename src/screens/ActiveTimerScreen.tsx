import { useRouter } from 'expo-router';
import { Clock3, Coffee } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader, Badge, Button, Card, Screen } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';

export function ActiveTimerScreen() {
  const router = useRouter();

  return (
    <Screen>
      <AppHeader onBack={() => router.back()} title="Attendance timer" />
      <Card style={styles.timerCard}>
        <Badge label="No active session" />
        <View style={styles.timerIcon}>
          <Clock3 color={colors.primary} size={32} strokeWidth={1.8} />
        </View>
        <Text accessibilityLabel="Timer not started" style={styles.timer}>
          --:--:--
        </Text>
        <Text style={styles.timerLabel}>Elapsed work time</Text>
        <View style={styles.actions}>
          <Button disabled fullWidth title="Start session" />
          <Button disabled fullWidth icon={Coffee} title="Start break" variant="outline" />
        </View>
      </Card>
      <Text style={styles.note}>
        Timer controls are visual only in this part and do not write attendance records.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  timerCard: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  timerIcon: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
  },
  timer: {
    marginTop: spacing.lg,
    color: colors.text,
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  timerLabel: {
    color: colors.textSecondary,
    ...typography.body,
  },
  actions: {
    width: '100%',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  note: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    textAlign: 'center',
    ...typography.caption,
  },
});

