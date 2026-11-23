import { Minus, Plus } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, layout, radius, spacing, typography } from '@/theme';

interface BreakSelectorProps {
  valueMinutes: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
}

const quickValues = [0, 30, 60] as const;

export function BreakSelector({ valueMinutes, onChange, disabled = false }: BreakSelectorProps) {
  const update = (next: number) => onChange(Math.max(0, Math.min(720, next)));

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Unpaid break deduction</Text>
      <View style={styles.stepper}>
        <Pressable
          accessibilityLabel="Decrease unpaid break by 15 minutes"
          accessibilityRole="button"
          disabled={disabled || valueMinutes === 0}
          onPress={() => update(valueMinutes - 15)}
          style={({ pressed }) => [styles.control, pressed && styles.pressed]}
        >
          <Minus color={colors.primaryDark} size={22} />
        </Pressable>
        <View accessibilityLiveRegion="polite" style={styles.valueFrame}>
          <Text style={styles.value}>{valueMinutes}</Text>
          <Text style={styles.unit}>minutes</Text>
        </View>
        <Pressable
          accessibilityLabel="Increase unpaid break by 15 minutes"
          accessibilityRole="button"
          disabled={disabled || valueMinutes === 720}
          onPress={() => update(valueMinutes + 15)}
          style={({ pressed }) => [styles.control, pressed && styles.pressed]}
        >
          <Plus color={colors.primaryDark} size={22} />
        </Pressable>
      </View>
      <View style={styles.quickRow}>
        {quickValues.map((minutes) => {
          const selected = valueMinutes === minutes;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              key={minutes}
              onPress={() => update(minutes)}
              style={({ pressed }) => [
                styles.quick,
                selected && styles.quickSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.quickLabel, selected && styles.quickLabelSelected]}>
                {minutes} min
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    ...typography.label,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  control: {
    width: layout.minimumTouchTarget,
    height: layout.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
  },
  valueFrame: {
    minWidth: 112,
    alignItems: 'center',
  },
  value: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  quick: {
    minHeight: layout.minimumTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
  },
  quickSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  quickLabel: {
    color: colors.textSecondary,
    ...typography.label,
  },
  quickLabelSelected: {
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.72,
  },
});

