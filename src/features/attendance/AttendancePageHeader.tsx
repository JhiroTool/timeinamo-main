import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, layout, radius, spacing } from '@/theme';

export function AttendancePageHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  const focused = useIsFocused();

  return (
    <View style={styles.header}>
      {focused ? <StatusBar style="dark" /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <ArrowLeft color={colors.primaryDark} size={22} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md, gap: spacing.xxs },
  back: { width: layout.minimumTouchTarget, height: layout.minimumTouchTarget, marginLeft: -spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  pressed: { backgroundColor: colors.primarySoft },
  title: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 27, lineHeight: 34, letterSpacing: -0.65 },
  subtitle: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
});
