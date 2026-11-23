import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, layout, radius, spacing, typography } from '@/theme';

interface Choice<T extends string> {
  label: string;
  value: T;
}

interface ChoiceSelectorProps<T extends string> {
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
}

export function ChoiceSelector<T extends string>({
  label,
  value,
  choices,
  onChange,
}: ChoiceSelectorProps<T>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {choices.map((choice) => {
          const selected = choice.value === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={choice.value}
              onPress={() => onChange(choice.value)}
              style={({ pressed }) => [
                styles.choice,
                selected && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>
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
});

