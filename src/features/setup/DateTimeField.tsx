import DateTimePicker from '@react-native-community/datetimepicker';
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, Clock3 } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { colors, layout, radius, spacing, typography } from '@/theme';
import type { DateFormat, TimeFormat } from '@/types/models';

interface DateTimeFieldProps {
  label: string;
  mode: 'date' | 'time';
  value: string;
  onChange: (value: string) => void;
  onBlur?: (() => void) | undefined;
  error?: string | undefined;
  timeFormat?: TimeFormat;
  dateFormat?: DateFormat;
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
  const date = valueToDate(value, mode);
  if (mode === 'time') {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: timeFormat === '12h',
    }).format(date);
  }
  const locale = dateFormat === 'dmy' ? 'en-GB' : dateFormat === 'ymd' ? 'en-CA' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
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
}: DateTimeFieldProps) {
  const [visible, setVisible] = useState(false);
  const pickerValue = useMemo(() => valueToDate(value, mode), [mode, value]);
  const Icon = mode === 'date' ? CalendarDays : Clock3;

  function handleChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') setVisible(false);
    if (event.type === 'set' && selected) onChange(dateToValue(selected, mode));
    if (Platform.OS === 'android') onBlur?.();
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}, ${displayValue(value, mode, timeFormat, dateFormat)}`}
        accessibilityRole="button"
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.frame,
          error ? styles.frameError : null,
          pressed && styles.pressed,
        ]}
      >
        <Icon color={colors.textMuted} size={20} />
        <Text style={[styles.value, !value && styles.placeholder]}>
          {displayValue(value, mode, timeFormat, dateFormat)}
        </Text>
      </Pressable>
      {visible ? (
        <View style={Platform.OS === 'ios' ? styles.iosPicker : undefined}>
          <DateTimePicker
            display="default"
            is24Hour={timeFormat === '24h'}
            mode={mode}
            onChange={handleChange}
            themeVariant="light"
            value={pickerValue}
          />
          {Platform.OS === 'ios' ? (
            <Button
              onPress={() => {
                setVisible(false);
                onBlur?.();
              }}
              title="Done"
              variant="ghost"
            />
          ) : null}
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
    minHeight: layout.minimumTouchTarget + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
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
});

