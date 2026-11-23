import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BottomSheet, Button } from '@/components/ui';
import { colors, fontFamilies, layout, radius, spacing } from '@/theme';

interface BreakSelectorProps {
  valueSeconds: number;
  onChange: (minutes: number) => Promise<boolean>;
  disabled?: boolean;
  saving?: boolean;
}

const presets = [0, 30, 60];
const maximumMinutes = 720;

export function formatSessionBreak(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (!remainder) return `${minutes} min`;
  return minutes ? `${minutes} min ${remainder} sec` : `${remainder} sec`;
}

export function BreakSelector({ valueSeconds, onChange, disabled = false, saving = false }: BreakSelectorProps) {
  const [customVisible, setCustomVisible] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const [customError, setCustomError] = useState<string | null>(null);
  const applyingCustom = useRef(false);
  const isPreset = presets.some((minutes) => minutes * 60 === valueSeconds);

  function openCustom() {
    setCustomMinutes(String(Math.floor(valueSeconds / 60)));
    setCustomError(null);
    setCustomVisible(true);
  }

  async function saveCustom() {
    if (disabled || applyingCustom.current) return;
    const input = customMinutes.trim();
    const minutes = Number(input);
    if (!/^\d+$/.test(input) || minutes > maximumMinutes) {
      setCustomError(`Enter a whole number from 0 to ${maximumMinutes} minutes.`);
      return;
    }
    applyingCustom.current = true;
    try {
      if (await onChange(minutes)) setCustomVisible(false);
      else setCustomError('The break could not be saved. Try again.');
    } finally {
      applyingCustom.current = false;
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.headingRow}>
        <Text accessibilityRole="header" style={styles.heading}>Unpaid Break</Text>
        <Text accessibilityLiveRegion="polite" style={styles.currentValue}>{formatSessionBreak(valueSeconds)}</Text>
      </View>
      <Text style={styles.support}>Deduct unpaid break time from this session.</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Unpaid break presets" style={styles.options}>
        {presets.map((minutes) => {
          const selected = valueSeconds === minutes * 60;
          return (
            <Pressable key={minutes} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }}
              disabled={disabled} onPress={() => void onChange(minutes)}
              style={({ pressed }) => [styles.option, selected && styles.selected, pressed && styles.pressed]}>
              <Text style={[styles.optionLabel, selected && styles.selectedLabel]}>{minutes} min</Text>
            </Pressable>
          );
        })}
        <Pressable accessibilityRole="button" accessibilityLabel="Custom break"
          accessibilityState={{ disabled, selected: !isPreset }} disabled={disabled} onPress={openCustom}
          style={({ pressed }) => [styles.option, !isPreset && styles.selected, pressed && styles.pressed]}>
          <Text style={[styles.optionLabel, !isPreset && styles.selectedLabel]}>Custom</Text>
        </Pressable>
      </View>

      {customVisible ? (
        <BottomSheet visible title="Custom break" scrollable titleStyle={styles.heading}
          dismissDisabled={saving} onDismiss={() => setCustomVisible(false)}>
          <View style={styles.customForm}>
            <Text style={styles.optionLabel}>Unpaid break in minutes</Text>
            <TextInput accessibilityLabel="Unpaid break in minutes" keyboardType="numeric"
              value={customMinutes} editable={!disabled}
              onChangeText={(value) => { setCustomMinutes(value); setCustomError(null); }}
              style={[styles.input, customError && styles.invalidInput]}
              onSubmitEditing={() => void saveCustom()} returnKeyType="done" />
            {customError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{customError}</Text> : null}
            <Button title="Save break" fullWidth disabled={disabled} loading={saving}
              labelStyle={styles.buttonLabel} onPress={() => void saveCustom()} />
          </View>
        </BottomSheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xxs },
  headingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.xs },
  heading: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontWeight: 'normal', fontSize: 18, lineHeight: 25 },
  currentValue: { color: colors.primaryDark, fontFamily: fontFamilies.heading, fontSize: 20, lineHeight: 27, fontVariant: ['tabular-nums'] },
  support: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19 },
  options: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs, gap: spacing.xs },
  option: { flexGrow: 1, minWidth: 58, minHeight: layout.minimumTouchTarget, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md },
  selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  optionLabel: { color: colors.textSecondary, fontFamily: fontFamilies.label, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  selectedLabel: { color: colors.primaryDark },
  pressed: { opacity: 0.7 },
  customForm: { gap: spacing.sm, paddingBottom: spacing.xs },
  input: { minHeight: 52, paddingHorizontal: spacing.sm, backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, color: colors.text, fontFamily: fontFamilies.bodyMedium, fontSize: 18, fontVariant: ['tabular-nums'] },
  invalidInput: { borderColor: colors.error },
  error: { color: colors.error, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19 },
  buttonLabel: { fontFamily: fontFamilies.label, fontWeight: 'normal', fontSize: 15 },
});
