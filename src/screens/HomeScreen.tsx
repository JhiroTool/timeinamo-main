import { useRouter } from 'expo-router';
import { Clock3, ShieldCheck } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { AppHeader, Badge, Button, Card, Screen, SectionHeader } from '@/components/ui';
import { colors, radius, spacing, typography } from '@/theme';

export function HomeScreen() {
  const router = useRouter();

  return (
    <Screen>
      <AppHeader title="TimeInamo" subtitle="Your workday, at a glance" />

      <Card style={styles.hero}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroIcon}>
            <Clock3 color={colors.primary} size={26} strokeWidth={1.8} />
          </View>
          <Badge label="No active session" />
        </View>
        <Text style={styles.heroTitle}>Ready when you are</Text>
        <Text style={styles.heroDescription}>
          Start from the attendance timer when your profile and work schedule are configured.
        </Text>
        <Button
          fullWidth
          onPress={() => router.push('/attendance/active')}
          title="Open attendance timer"
        />
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Workspace" description="Private by design" />
        <Card style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <ShieldCheck color={colors.success} size={22} strokeWidth={2} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>Offline-first storage</Text>
            <Text style={styles.infoDescription}>
              Your profile, attendance, and journal data stay on this device.
            </Text>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.lg,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heroIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
  },
  heroTitle: {
    marginTop: spacing.lg,
    color: colors.text,
    ...typography.heading,
  },
  heroDescription: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    color: colors.textSecondary,
    ...typography.body,
  },
  section: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  infoIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radius.md,
  },
  infoCopy: {
    minWidth: 0,
    flex: 1,
  },
  infoTitle: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  infoDescription: {
    marginTop: spacing.xxs,
    color: colors.textSecondary,
    ...typography.caption,
  },
});

