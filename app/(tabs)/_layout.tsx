import { Tabs } from 'expo-router';
import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Clock3,
  House,
  Settings,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';

import { colors, layout, spacing } from '@/theme';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bottomPadding = Math.max(insets.bottom, spacing.xs);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarActiveBackgroundColor: colors.primarySoft,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: width < 360 ? 10 : width < 400 ? 11 : 12,
          lineHeight: 14,
          fontWeight: '600',
          marginTop: 1,
        },
        tabBarStyle: {
          height: layout.tabBarBaseHeight + bottomPadding,
          paddingTop: spacing.xxs,
          paddingBottom: bottomPadding,
          paddingHorizontal: spacing.xs,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 12,
          shadowColor: colors.text,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.04,
          shadowRadius: 8,
        },
        tabBarItemStyle: {
          flex: 1,
          minHeight: layout.minimumTouchTarget,
          marginHorizontal: 1,
          marginVertical: 2,
          borderRadius: 16,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <House color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, size }) => <Clock3 color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color, size }) => <BookOpen color={color} size={size} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color, size }) => (
            <ChartNoAxesColumnIncreasing color={color} size={size} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}

