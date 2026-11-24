import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays, Clock3 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet, Button } from '@/components/ui';
import { colors, fontFamilies, radius, spacing, typography } from '@/theme';
import type { DateFormat, TimeFormat } from '@/types/models';
import { formatScheduleTime, formatWorkDate } from '@/utils/time';

interface DateTimeFieldProps {
  label: string;
  mode: 'date' | 'time';
  value: string;
  onChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
  error?: string | undefined;
  timeFormat?: TimeFormat;
  dateFormat?: DateFormat;
  compact?: boolean;
}

function valueToDate(value: string, mode: 'date' | 'time'): Date {
  if (mode === 'time') {
    const [hours = '8', minutes = '0'] = value.split(':');
    return new Date(2000, 0, 1, Number(hours), Number(minutes));
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
}

function dateToValue(value: Date, mode: 'date' | 'time'): string {
  if (mode === 'time') {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function displayValue(
  value: string,
  mode: 'date' | 'time',
  timeFormat: TimeFormat,
  dateFormat: DateFormat,
): string {
  if (!value) return mode === 'date' ? 'Select date' : 'Select time';
  return mode === 'time' ? formatScheduleTime(value, timeFormat) : formatWorkDate(value, dateFormat);
}

export function DateTimeField({
  label,
  mode,
  value,
  onChange,
  onBlur,
  error,
  timeFormat = '12h',
  dateFormat = 'mdy',
  compact = false,
}: DateTimeFieldProps) {
  const [visible, setVisible] = useState(false);
  const pickerValue = useMemo(() => valueToDate(value, mode), [mode, value]);
  const Icon = mode === 'date' ? CalendarDays : Clock3;
  const pickerInSheet = compact && Platform.OS === 'ios';

  function handleValueChange(_event: unknown, selected: Date) {
    onChange(dateToValue(selected, mode));
    if (Platform.OS === 'android') {
      setVisible(false);
      if (compact) onBlur?.();
    }
  }

  function handleDismiss() {
    setVisible(false);
    onBlur?.();
  }

  const picker = visible ? (
    <DateTimePicker
      display={pickerInSheet ? 'spinner' : 'default'}
      is24Hour={timeFormat === '24h'}
      mode={mode}
      onDismiss={handleDismiss}
      onValueChange={handleValueChange}
      {...(pickerInSheet ? { style: styles.sheetPicker } : {})}
      themeVariant="light"
      value={pickerValue}
    />
  ) : null;

  return (
    <View style={styles.field}>
      <Text style={[styles.label, compact && styles.compactLabel]}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}, ${displayValue(value, mode, timeFormat, dateFormat)}`}
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.frame,
          compact && styles.compactFrame,
          error ? styles.frameError : null,
          pressed && styles.pressed,
        ]}
      >
        {!compact || mode === 'date' ? <Icon color={colors.textMuted} size={compact ? 18 : 20} /> : null}
        <Text style={[styles.value, compact && styles.compactValue, !value && styles.placeholder]}>
          {displayValue(value, mode, timeFormat, dateFormat)}
        </Text>
      </Pressable>
      {visible && pickerInSheet ? (
        <BottomSheet onDismiss={handleDismiss} scrollable title={label} titleStyle={styles.sheetTitle} visible>
          {picker}
          <Button fullWidth onPress={handleDismiss} title="Done" />
        </BottomSheet>
      ) : visible ? (
        <View style={Platform.OS === 'ios' ? styles.iosPicker : undefined}>
          {picker}
          {Platform.OS === 'ios' ? (
            <Button
              onPress={handleDismiss}
              title="Done"
              variant="ghost"
            />
          ) : null}
        </View>
      ) : null}
      {error ? <Text accessibilityLiveRegion="polite" style={[styles.error, compact && styles.compactError]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    width: '100%',
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    ...typography.label,
  },
  frame: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
  },
  frameError: {
    borderColor: colors.error,
  },
  pressed: {
    backgroundColor: colors.background,
  },
  value: {
    flex: 1,
    color: colors.text,
    ...typography.body,
  },
  placeholder: {
    color: colors.textMuted,
  },
  iosPicker: {
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  error: {
    color: colors.error,
    ...typography.caption,
  },
  compactLabel: { fontFamily: fontFamilies.label, fontWeight: 'normal' },
  compactFrame: { borderRadius: radius.md, paddingHorizontal: spacing.sm },
  compactValue: { fontFamily: fontFamilies.bodyMedium, fontWeight: 'normal', fontSize: 15, fontVariant: ['tabular-nums'] },
  compactError: { fontFamily: fontFamilies.body, fontWeight: 'normal' },
  sheetTitle: { fontFamily: fontFamilies.headingSemibold, fontWeight: 'normal' },
  sheetPicker: { alignSelf: 'stretch' },
});

