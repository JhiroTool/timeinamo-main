import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider } from '@/database/DatabaseProvider';
import { DatabaseErrorView } from '@/components/DatabaseErrorView';
import { LoadingState } from '@/components/ui';
import { SetupProvider } from '@/features/setup/SetupProvider';
import { useSetup } from '@/features/setup/useSetup';
import { AttendanceProvider } from '@/features/attendance/AttendanceProvider';
import { colors } from '@/theme';

function AppNavigator() {
  const { status, isComplete, error, refresh } = useSetup();

  if (status === 'loading') return <LoadingState fullPage label="Loading your setup…" />;
  if (status === 'error') {
    return (
      <DatabaseErrorView
        error={error ?? new Error('Setup could not be loaded.')}
        onRetry={() => void refresh()}
      />
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}
      >
        <Stack.Protected guard={isComplete}>
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        </Stack.Protected>
        <Stack.Protected guard={!isComplete}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <DatabaseProvider>
        <SetupProvider>
          <AttendanceProvider>
            <AppNavigator />
          </AttendanceProvider>
        </SetupProvider>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}

