import { Tabs, usePathname } from 'expo-router';
import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  Clock3,
  House,
  Settings,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, useWindowDimensions } from 'react-native';
import type { TextStyle } from 'react-native';

import { colors, fontFamilies, layout, spacing } from '@/theme';

export default function TabsLayout() {
  const pathname = usePathname();
  const hideTabs = pathname === '/attendance/active' || pathname === '/journal/edit';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const bottomPadding = Math.max(insets.bottom, spacing.xs);
  const tabLabelStyle: TextStyle = {
    fontFamily: fontFamilies.label,
    fontSize: width < 400 ? 11 : 12,
    fontWeight: 'normal',
    lineHeight: 16,
    marginTop: 1,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primaryDark,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: tabLabelStyle,
        tabBarStyle: {
          display: hideTabs ? 'none' : 'flex',
          height: 54 + bottomPadding,
          paddingTop: spacing.xxs,
          paddingBottom: bottomPadding,
          paddingHorizontal: width < 360 ? 0 : spacing.xs,
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 0,
        },
        tabBarItemStyle: {
          flex: 1,
          minHeight: layout.minimumTouchTarget,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <House color={color} size={21} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarLabel: width < 360 ? ({ children, color }) => (
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[tabLabelStyle, { alignSelf: 'stretch', color, textAlign: 'center' }]}
            >
              {children}
            </Text>
          ) : 'Attendance',
          tabBarIcon: ({ color }) => <Clock3 color={color} size={21} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: 'Journal',
          tabBarIcon: ({ color }) => <BookOpen color={color} size={21} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          title: 'Progress',
          tabBarIcon: ({ color }) => (
            <ChartNoAxesColumnIncreasing color={color} size={21} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Settings color={color} size={21} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}

