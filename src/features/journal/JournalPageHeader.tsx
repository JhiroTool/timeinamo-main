import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, layout, radius, spacing } from '@/theme';

export function JournalPageHeader({ title, onBack, action, onAction, disabled, busy }: {
  title?: string;
  onBack: () => void;
  action?: string;
  onAction?: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const focused = useIsFocused();
  return (
    <View style={styles.row}>
      {focused ? <StatusBar style="dark" /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" disabled={busy} onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
        <ArrowLeft color={colors.primaryDark} size={22} />
      </Pressable>
      <View style={styles.heading}>
        {title ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : null}
      </View>
      {action && onAction ? (
        <Pressable accessibilityRole="button" accessibilityLabel={action} accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
          disabled={disabled || busy} onPress={onAction} style={({ pressed }) => [styles.action, disabled && styles.disabled, pressed && styles.pressed]}>
          {busy ? <ActivityIndicator color={colors.primaryDark} /> : <Text style={styles.actionText}>{action}</Text>}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: spacing.xxs, gap: spacing.xxs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  back: { height: layout.minimumTouchTarget, width: layout.minimumTouchTarget, marginLeft: -spacing.xs, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 23, lineHeight: 30, letterSpacing: -0.5 },
  action: { minHeight: layout.minimumTouchTarget, minWidth: 58, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xs, borderRadius: radius.md },
  actionText: { color: colors.primaryDark, fontFamily: fontFamilies.label, fontSize: 15, lineHeight: 21 },
  pressed: { backgroundColor: colors.primarySoft },
  disabled: { opacity: 0.45 },
});
