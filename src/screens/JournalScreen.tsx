import { BookOpen, PenLine } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { AppHeader, Button, Card, EmptyState, Screen } from '@/components/ui';
import { spacing } from '@/theme';

export function JournalScreen() {
  return (
    <Screen>
      <AppHeader title="Journal" subtitle="Keep a clear record of your work" />
      <Card style={styles.card}>
        <EmptyState
          action={<Button disabled fullWidth icon={PenLine} title="Create entry" />}
          description="Dated activity and OJT notes will appear here once journal actions are connected."
          icon={BookOpen}
          title="Your journal is empty"
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

