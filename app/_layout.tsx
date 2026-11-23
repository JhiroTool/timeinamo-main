import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DatabaseProvider } from '@/database/DatabaseProvider';
import { DatabaseErrorView } from '@/components/DatabaseErrorView';
import { LoadingState } from '@/components/ui';
import { SetupProvider } from '@/features/setup/SetupProvider';
import { useSetup } from '@/features/setup/useSetup';
import { AttendanceProvider } from '@/features/attendance/AttendanceProvider';
import { colors, fontFamilies } from '@/theme';

const appFonts = {
  [fontFamilies.heading]: PlusJakartaSans_700Bold,
  [fontFamilies.headingSemibold]: PlusJakartaSans_600SemiBold,
  [fontFamilies.body]: Inter_400Regular,
  [fontFamilies.bodyMedium]: Inter_500Medium,
  [fontFamilies.label]: Inter_600SemiBold,
};

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
  const [fontsLoaded, fontError] = useFonts(appFonts);

  useEffect(() => {
    if (fontError) console.warn('TimeInamo fonts could not be loaded.', fontError);
  }, [fontError]);

  return (
    <SafeAreaProvider>
      {fontsLoaded || fontError ? (
        <DatabaseProvider>
          <SetupProvider>
            <AttendanceProvider>
              <AppNavigator />
            </AttendanceProvider>
          </SetupProvider>
        </DatabaseProvider>
      ) : null}
    </SafeAreaProvider>
  );
}

