import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontFamilies, layout, radius, spacing, typography } from '@/theme';

interface Choice<T extends string> {
  label: string;
  value: T;
}

interface ChoiceSelectorProps<T extends string> {
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
  compact?: boolean;
}

export function ChoiceSelector<T extends string>({
  label,
  value,
  choices,
  onChange,
  compact = false,
}: ChoiceSelectorProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, compact && styles.compactLabel]}>{label}</Text>
      <View accessibilityRole="radiogroup" style={[styles.row, compact && styles.compactRow]}>
        {choices.map((choice) => {
          const selected = choice.value === value;
          return (
            <Pressable
              accessibilityLabel={`${label}: ${choice.label}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={choice.value}
              onPress={() => onChange(choice.value)}
              style={({ pressed }) => [
                styles.choice,
                compact && styles.compactChoice,
                selected && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.choiceLabel, compact && styles.compactLabel, selected && styles.choiceLabelSelected]}>
                {choice.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  choice: {
    minHeight: layout.minimumTouchTarget,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
  },
  choiceSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.78,
  },
  choiceLabel: {
    color: colors.textSecondary,
    ...typography.label,
  },
  choiceLabelSelected: {
    color: colors.primaryDark,
  },
  compactLabel: { fontFamily: fontFamilies.label, fontWeight: 'normal', fontSize: 13 },
  compactRow: { gap: 6 },
  compactChoice: { minWidth: layout.minimumTouchTarget, paddingHorizontal: 10, backgroundColor: colors.surface },
});

