import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, layout, radius, spacing, typography } from '@/theme';

const days = [
  { value: 1, label: 'M', full: 'Monday' },
  { value: 2, label: 'T', full: 'Tuesday' },
  { value: 3, label: 'W', full: 'Wednesday' },
  { value: 4, label: 'T', full: 'Thursday' },
  { value: 5, label: 'F', full: 'Friday' },
  { value: 6, label: 'S', full: 'Saturday' },
  { value: 0, label: 'S', full: 'Sunday' },
] as const;

interface WeekdaySelectorProps {
  value: number[];
  onChange: (value: number[]) => void;
  onBlur?: (() => void) | undefined;
  error?: string | undefined;
  onboardingLayout?: 'single-row' | 'two-rows';
}

export function WeekdaySelector({ value, onChange, onBlur, error, onboardingLayout }: WeekdaySelectorProps) {
  function toggle(day: number) {
    onChange(value.includes(day) ? value.filter((item) => item !== day) : [...value, day]);
    if (onboardingLayout) onBlur?.();
  }

  return (
    <View style={styles.field}>
      <Text style={[styles.label, onboardingLayout && styles.compactLabel]}>{onboardingLayout ? 'Working Days' : 'Working days'}</Text>
      <View style={[styles.days, onboardingLayout && styles.compactDays, onboardingLayout === 'two-rows' && styles.wrappedDays]}>
        {days.map((day) => {
          const selected = value.includes(day.value);
          return (
            <Pressable
              accessibilityLabel={day.full}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              key={day.full}
              onBlur={onBlur}
              onPress={() => toggle(day.value)}
              style={({ pressed }) => [
                styles.day,
                onboardingLayout && styles.compactDay,
                selected && styles.daySelected,
                pressed && styles.dayPressed,
              ]}
            >
              <Text style={[styles.dayLabel, onboardingLayout && styles.compactLabel, selected && styles.dayLabelSelected]}>{day.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, onboardingLayout && styles.compactError]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    ...typography.label,
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  day: {
    width: layout.minimumTouchTarget,
    height: layout.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
  },
  daySelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayPressed: {
    opacity: 0.78,
  },
  dayLabel: {
    color: colors.textSecondary,
    ...typography.label,
  },
  dayLabelSelected: {
    color: colors.surface,
  },
  error: {
    color: colors.error,
    ...typography.caption,
  },
  compactLabel: { fontFamily: fontFamilies.label, fontWeight: 'normal' },
  compactDays: { columnGap: 2, rowGap: 6 },
  wrappedDays: { maxWidth: 4 * layout.minimumTouchTarget + 3 * 6, columnGap: 6 },
  compactDay: { borderRadius: radius.md },
  compactError: { fontFamily: fontFamilies.body, fontWeight: 'normal' },
});

