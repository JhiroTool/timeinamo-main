import { useRouter } from 'expo-router';
import { FileClock } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { AppHeader, Card, EmptyState, Screen } from '@/components/ui';
import { spacing } from '@/theme';

export function AttendanceDetailsScreen() {
  const router = useRouter();

  return (
    <Screen>
      <AppHeader onBack={() => router.back()} title="Attendance details" />
      <Card style={styles.card}>
        <EmptyState
          description="Session details will load here when attendance records are connected to this route."
          icon={FileClock}
          title="No session selected"
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.lg,
  },
});

