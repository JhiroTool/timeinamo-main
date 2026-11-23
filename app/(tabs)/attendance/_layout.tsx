import { Stack } from 'expo-router';

import { colors } from '@/theme';

export default function AttendanceLayout() {
  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}
    />
  );
}

