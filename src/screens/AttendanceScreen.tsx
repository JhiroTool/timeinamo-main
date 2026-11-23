import { useRouter } from 'expo-router';
import { CalendarClock, Timer } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { AppHeader, Button, Card, EmptyState, Screen, SectionHeader } from '@/components/ui';
import { spacing } from '@/theme';

export function AttendanceScreen() {
  const router = useRouter();

  return (
    <Screen>
      <AppHeader title="Attendance" subtitle="Track work sessions and breaks" />
      <Card style={styles.primaryCard}>
        <EmptyState
          action={
            <Button
              fullWidth
              icon={Timer}
              onPress={() => router.push('/attendance/active')}
              title="Open timer"
            />
          }
          compact
          description="The timer layout is ready and will connect to attendance data in a later part."
          icon={CalendarClock}
          title="No session in progress"
        />
      </Card>

      <View style={styles.section}>
        <SectionHeader title="Recent sessions" description="Completed workdays will appear here" />
        <Card>
          <EmptyState
            compact
            description="There are no attendance sessions to display yet."
            icon={CalendarClock}
            title="No attendance history"
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  primaryCard: {
    marginTop: spacing.lg,
  },
  section: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
});

