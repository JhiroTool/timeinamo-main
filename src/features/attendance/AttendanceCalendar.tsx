import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { AttendanceHistoryRecord } from '@/database/repositories';
import { colors, fontFamilies, layout, radius, spacing } from '@/theme';

import { formatAttendanceDate, getAttendanceWeeks, workDateToUtc } from './attendancePresentation';

const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const dayLabel = new Intl.DateTimeFormat('en-US', {
  weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
});

export function AttendanceCalendar({
  month,
  today,
  selectedDate,
  recordsByDate,
  onSelect,
  onPrevious,
  onNext,
}: {
  month: string;
  today: string;
  selectedDate: string;
  recordsByDate: ReadonlyMap<string, AttendanceHistoryRecord>;
  onSelect: (date: string) => void;
  onPrevious: () => void;
  onNext: (() => void) | undefined;
}) {
  const weeks = useMemo(() => getAttendanceWeeks(month), [month]);
  return (
    <View style={styles.calendar}>
      <View style={styles.monthRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Previous month" onPress={onPrevious}
          style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
          <ChevronLeft color={colors.primaryDark} size={21} />
        </Pressable>
        <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.month}>
          {formatAttendanceDate(`${month}-01`, { month: 'long', year: 'numeric' })}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Next month" accessibilityState={{ disabled: !onNext }}
          disabled={!onNext} onPress={onNext} style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}>
          <ChevronRight color={onNext ? colors.primaryDark : colors.disabled} size={21} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {weekdays.map((day) => (
          <Text key={day} accessibilityLabel={day} style={styles.weekday}>{day[0]}</Text>
        ))}
      </View>
      {weeks.map((week, index) => (
        <View key={index} style={styles.week}>
          {week.map((date, column) => {
            if (!date) return <View key={column} style={styles.day} />;
            const record = recordsByDate.get(date);
            const selected = date === selectedDate;
            const isToday = date === today;
            const isFuture = date > today;
            const status = record ? (record.status === 'completed' ? 'Completed' : 'Incomplete')
              : isFuture ? 'Future date' : 'No record';
            const label = [dayLabel.format(workDateToUtc(date)), isToday && 'Today', status, record?.isAdjusted && 'Adjusted']
              .filter(Boolean).join(', ');

            return (
              <Pressable key={date} accessibilityRole="button" accessibilityLabel={label}
                accessibilityState={{ selected }} onPress={() => onSelect(date)}
                style={({ pressed }) => [styles.day, pressed && styles.pressed]}>
                <View style={[styles.dateCircle, isToday && styles.today, selected && styles.selected]}>
                  <Text maxFontSizeMultiplier={1.5}
                    style={[styles.dayNumber, isFuture && !record && styles.future, selected && styles.selectedNumber]}>
                    {Number(date.slice(8))}
                  </Text>
                </View>
                <View style={styles.markers}>
                  {record ? <View style={[styles.marker, record.status === 'completed' ? styles.completed : styles.incomplete]} /> : null}
                  {record?.isAdjusted ? <View style={[styles.marker, styles.adjusted]} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={styles.legend}>
        <View style={styles.legendItem}><View style={[styles.marker, styles.completed]} /><Text style={styles.legendLabel}>Completed</Text></View>
        <View style={styles.legendItem}><View style={[styles.marker, styles.incomplete]} /><Text style={styles.legendLabel}>Incomplete</Text></View>
        <View style={styles.legendItem}><View style={[styles.marker, styles.adjusted]} /><Text style={styles.legendLabel}>Adjusted</Text></View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xxs },
  monthButton: { width: layout.minimumTouchTarget, minHeight: layout.minimumTouchTarget, alignItems: 'center', justifyContent: 'center' },
  month: { flex: 1, textAlign: 'center', color: colors.text, fontFamily: fontFamilies.heading, fontSize: 18, lineHeight: 24 },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: colors.textMuted, fontFamily: fontFamilies.label, fontSize: 12, lineHeight: 19, paddingBottom: spacing.xxs },
  day: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dateCircle: { width: 31, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  today: { borderColor: colors.primary, borderWidth: 1 },
  selected: { backgroundColor: colors.primary },
  dayNumber: { color: colors.text, fontFamily: fontFamilies.bodyMedium, fontSize: 14, fontVariant: ['tabular-nums'] },
  selectedNumber: { color: colors.surface, fontFamily: fontFamilies.label },
  future: { color: colors.textMuted },
  pressed: { opacity: 0.63 },
  markers: { height: 6, flexDirection: 'row', alignItems: 'center', gap: 3 },
  marker: { width: 5, height: 5, borderRadius: 3 },
  completed: { backgroundColor: colors.primary },
  incomplete: { backgroundColor: colors.warning },
  adjusted: { borderRadius: 1, borderWidth: 1, borderColor: colors.primaryDark, transform: [{ rotate: '45deg' }] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: spacing.sm, rowGap: spacing.xxs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  legendLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 11, lineHeight: 16 },
});
