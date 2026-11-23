import { ChartNoAxesColumnIncreasing } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { AppHeader, Card, EmptyState, Screen } from '@/components/ui';
import { spacing } from '@/theme';

export function ProgressScreen() {
  return (
    <Screen>
      <AppHeader title="Progress" subtitle="Understand your completed hours" />
      <Card style={styles.card}>
        <EmptyState
          description="Progress summaries will be calculated when completed attendance sessions are available."
          icon={ChartNoAxesColumnIncreasing}
          title="Nothing to summarize yet"
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

