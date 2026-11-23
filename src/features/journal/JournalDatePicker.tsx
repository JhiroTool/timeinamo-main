import DateTimePicker from '@react-native-community/datetimepicker';
import { CalendarDays } from 'lucide-react-native';
import { useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { BottomSheet, Button } from '@/components/ui';
import { colors, fontFamilies, layout, radius } from '@/theme';
import { parseWorkDate } from '@/utils/time';

import { useJournal } from './JournalContext';

export const journalDateLabel = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } as const;

export function formatJournalDate(value: string, options: Intl.DateTimeFormatOptions = journalDateLabel, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`));
}

function pickerDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function workDateOf(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return parseWorkDate(`${date.getFullYear()}-${month}-${day}`);
}

export function JournalDatePicker({ value, today, onChange, compact = false }: {
  value: string;
  today: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const { dateFormat } = useJournal();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => pickerDate(value || today));
  const label = compact ? 'Filter by date' : 'Date';
  const dateLabel = value ? formatJournalDate(value, { month: 'short', day: 'numeric', year: 'numeric' },
    dateFormat === 'dmy' ? 'en-GB' : dateFormat === 'ymd' ? 'en-CA' : 'en-US') : '';

  function openPicker() {
    Keyboard.dismiss();
    setDraft(pickerDate(value || today));
    setOpen(true);
  }

  const picker = open ? (
    <DateTimePicker value={draft} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'calendar'}
      themeVariant="light" onDismiss={() => setOpen(false)}
      onValueChange={(_event, date) => {
        if (Platform.OS === 'ios') setDraft(date);
        else {
          setOpen(false);
          onChange(workDateOf(date));
        }
      }} />
  ) : null;

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={dateLabel ? `${label}, ${dateLabel}` : label}
        onPress={openPicker} style={({ pressed }) => [
          styles.control, compact && styles.compact, compact && value && styles.selected, pressed && styles.pressed,
        ]}>
        <CalendarDays color={colors.primaryDark} size={20} strokeWidth={1.75} />
        {!compact ? <Text style={styles.text}>{dateLabel || 'Select date'}</Text> : null}
      </Pressable>
      {open && Platform.OS === 'ios' ? (
        <BottomSheet visible title={label} onDismiss={() => setOpen(false)}>
          {picker}
          <Button fullWidth title="Done" onPress={() => { onChange(workDateOf(draft)); setOpen(false); }} />
        </BottomSheet>
      ) : picker}
    </>
  );
}

const styles = StyleSheet.create({
  control: { minHeight: layout.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  compact: { width: layout.minimumTouchTarget, paddingHorizontal: 0, justifyContent: 'center' },
  selected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  pressed: { opacity: 0.65 },
  text: { flexShrink: 1, color: colors.text, fontFamily: fontFamilies.bodyMedium, fontSize: 15, lineHeight: 22 },
});
