import { Stack } from 'expo-router';

import { JournalProvider } from '@/features/journal/JournalContext';
import { colors } from '@/theme';

export default function JournalLayout() {
  return (
    <JournalProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
    </JournalProvider>
  );
}
