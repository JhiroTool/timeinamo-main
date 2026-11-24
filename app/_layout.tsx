import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppOpening } from '@/components/AppOpening';
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

let hasFinishedOpening = false;

function AppNavigator({ fontsReady, onScreenLayout }: { fontsReady: boolean; onScreenLayout: () => void }) {
  const { status, isComplete, error, refresh } = useSetup();

  if (status === 'error') {
    return (
      <DatabaseErrorView
        error={error ?? new Error('Setup could not be loaded.')}
        onLayout={onScreenLayout}
        onRetry={() => void refresh()}
      />
    );
  }
  if (status === 'loading' || !fontsReady) return <LoadingState fullPage label="Loading your setup…" />;

  return (
    <Stack
      screenLayout={({ children }) => (
        <View onLayout={onScreenLayout} style={styles.scene}>{children}</View>
      )}
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
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const fontsReady = fontsLoaded || Boolean(fontError);
  const [opening, setOpening] = useState(() => !hasFinishedOpening);
  const [screenLaidOut, setScreenLaidOut] = useState(false);
  const markScreenLaidOut = useCallback(() => setScreenLaidOut(true), []);
  const finishOpening = useCallback(() => {
    hasFinishedOpening = true;
    setOpening(false);
  }, []);

  useEffect(() => {
    if (fontError) console.warn('TimeInamo fonts could not be loaded.', fontError);
  }, [fontError]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={styles.root}>
        <View
          accessibilityElementsHidden={opening}
          importantForAccessibility={opening ? 'no-hide-descendants' : 'auto'}
          style={styles.scene}
        >
          <DatabaseProvider onErrorLayout={markScreenLaidOut}>
            <SetupProvider>
              <AttendanceProvider>
                <AppNavigator fontsReady={fontsReady} onScreenLayout={markScreenLaidOut} />
              </AttendanceProvider>
            </SetupProvider>
          </DatabaseProvider>
        </View>
        {opening ? <AppOpening fontsReady={fontsReady} onFinish={finishOpening} ready={screenLaidOut} /> : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  scene: { flex: 1, backgroundColor: colors.background },
});

