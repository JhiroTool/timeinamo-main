import { useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { buildRecentWeeklyTotals, formatProgressHours, shiftWorkDate } from '@/services/ojtProgressCalculations.js';
import { colors, fontFamilies, radius, spacing } from '@/theme';
import type { DateFormat } from '@/types/models';
import { formatWorkDate } from '@/utils/time';

type Week = ReturnType<typeof buildRecentWeeklyTotals>[number];

const shortDate = { month: 'short', day: 'numeric' } as const;

function weekRange(weekStart: string, preference: DateFormat) {
  const weekEnd = shiftWorkDate(weekStart, 6);
  const sameYear = weekStart.slice(0, 4) === weekEnd.slice(0, 4);
  return `${formatWorkDate(weekStart, preference, sameYear ? shortDate : undefined)} – ${formatWorkDate(weekEnd, preference)}`;
}

function describeWeek(week: Week) {
  const days = week.completedWorkdays;
  return `${formatProgressHours(week.creditedSeconds)} hours · ${days} ${days === 1 ? 'workday' : 'workdays'}`;
}

export function WeeklyActivity({ weeks, fontScale, dateFormat }: { weeks: Week[]; fontScale: number; dateFormat: DateFormat }) {
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const chart = useRef<ComponentRef<typeof ScrollView>>(null);
  const firstRecordedWeek = weeks.find((week) => week.completedWorkdays > 0);

  if (!firstRecordedWeek) {
    return (
      <View style={styles.empty}>
        <Text style={styles.body}>Your weekly activity will appear here as you record work sessions.</Text>
      </View>
    );
  }

  const visibleWeeks = weeks.slice(weeks.indexOf(firstRecordedWeek));
  const selected = visibleWeeks.find((week) => week.weekStart === selectedStart) ?? weeks.at(-1) ?? firstRecordedWeek;
  const peakSeconds = Math.max(...visibleWeeks.map((week) => week.creditedSeconds));
  const scaleHours = Math.max(1, Math.ceil(peakSeconds / 3600));
  const cellWidth = Math.max(44, Math.ceil(44 * fontScale));

  return (
    <View style={styles.chart}>
      <Text accessible={false} style={styles.axis}>{scaleHours} h</Text>
      <ScrollView
        horizontal
        onLayout={() => chart.current?.scrollToEnd({ animated: false })}
        ref={chart}
        style={styles.scroll}
        contentContainerStyle={[styles.plot, { minWidth: visibleWeeks.length * cellWidth }]}
      >
        {visibleWeeks.map((week) => {
          const isSelected = week.weekStart === selected.weekStart;
          return (
            <Pressable
              accessibilityLabel={`${weekRange(week.weekStart, dateFormat)}, ${describeWeek(week)}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              key={week.weekStart}
              onPress={() => setSelectedStart(week.weekStart)}
              style={({ pressed }) => [styles.week, { minWidth: cellWidth }, pressed && styles.pressed]}
            >
              <View style={styles.barSlot}>
                {week.creditedSeconds > 0 ? (
                  <View style={[
                    styles.bar,
                    isSelected && styles.barSelected,
                    { height: `${week.creditedSeconds / (scaleHours * 3600) * 100}%` },
                  ]} />
                ) : null}
              </View>
              <Text style={[styles.weekLabel, isSelected && styles.weekSelected]}>
                {formatWorkDate(week.weekStart, dateFormat, shortDate)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View accessible accessibilityLiveRegion="polite" style={styles.detail}>
        <Text style={styles.detailRange}>{weekRange(selected.weekStart, dateFormat)}</Text>
        <Text style={styles.detailValue}>{describeWeek(selected)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { marginTop: spacing.xxs, gap: spacing.xxs },
  axis: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 11, fontVariant: ['tabular-nums'] },
  scroll: { width: '100%' },
  plot: { flexGrow: 1 },
  week: { flex: 1, paddingBottom: spacing.xs },
  pressed: { opacity: 0.7 },
  barSlot: {
    height: 96,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
  },
  bar: { width: '52%', maxWidth: 30, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: '#4B958E' },
  barSelected: { backgroundColor: colors.primary },
  weekLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamilies.label,
    fontSize: 11,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  weekSelected: { color: colors.primaryDark, textDecorationLine: 'underline' },
  detail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    columnGap: spacing.sm,
    rowGap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#EDF5F4',
    borderRadius: radius.sm,
  },
  detailRange: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 12 },
  detailValue: { color: colors.primaryDark, fontFamily: fontFamilies.label, fontSize: 12, fontVariant: ['tabular-nums'] },
  empty: { borderLeftWidth: 2, borderLeftColor: colors.borderStrong, paddingLeft: spacing.sm, paddingVertical: spacing.xs },
  body: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 14 },
});
