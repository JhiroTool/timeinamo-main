import { useFocusEffect, useRouter } from 'expo-router';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FilePenLine,
  Plus,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, EmptyState, GradientHeader, LoadingState, Screen } from '@/components/ui';
import type { AttendanceHistoryFilter } from '@/database/repositories';
import { useAttendance } from '@/features/attendance/useAttendance';
import { useAttendanceHistory } from '@/features/attendance/useAttendanceHistory';
import { useSetup } from '@/features/setup/useSetup';
import { formatDuration } from '@/services/attendanceCalculations.js';
import { colors, layout, radius, spacing, typography } from '@/theme';
import { toWorkDate } from '@/utils/time';

const filters: Array<{ label: string; value: AttendanceHistoryFilter }> = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Incomplete', value: 'incomplete' },
  { label: 'Adjusted', value: 'adjusted' },
];

function shiftMonth(month: string, amount: number): string {
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5, 7)) - 1;
  const next = new Date(Date.UTC(year, monthIndex + amount, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatMonth(month: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00.000Z`),
  );
}

function formatWorkDate(workDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${workDate}T00:00:00.000Z`));
}

function formatTime(value: string | null, timezone: string, hour12: boolean): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12,
  }).format(new Date(value));
}

export function AttendanceScreen() {
  const router = useRouter();
  const { data: setup } = useSetup();
  const { activeSession } = useAttendance();
  const timezone = setup?.workSettings.timezone ?? 'Asia/Manila';
  const currentMonth = toWorkDate(new Date(), timezone).slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [filter, setFilter] = useState<AttendanceHistoryFilter>('all');
  const { status, result, error, load } = useAttendanceHistory(month, filter);
  const hour12 = setup?.workSettings.timeFormat !== '24h';

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const emptyDescription = useMemo(() => {
    if (filter === 'all') return 'No attendance records exist for this month.';
    return `No ${filter} attendance records exist for this month.`;
  }, [filter]);

  return (
    <Screen branded>
      <GradientHeader
        compact
        eyebrow="WORK RECORDS"
        subtitle="Track your daily work records"
        title="Attendance"
      />
      <View style={styles.content}>

      <View style={styles.actions}>
        <Button
          icon={activeSession ? Clock3 : CalendarClock}
          onPress={() => router.push('/attendance/active')}
          title={activeSession ? 'Active timer' : 'Time In'}
          variant="secondary"
        />
        <Button
          icon={Plus}
          onPress={() => router.push('/attendance/manual')}
          title="Manual entry"
          variant="outline"
        />
      </View>

      <View style={styles.monthNavigator}>
        <Pressable
          accessibilityLabel="Previous month"
          accessibilityRole="button"
          onPress={() => setMonth((value) => shiftMonth(value, -1))}
          style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
        >
          <ChevronLeft color={colors.text} size={22} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.monthTitle}>
          {formatMonth(month)}
        </Text>
        <Pressable
          accessibilityLabel="Next month"
          accessibilityRole="button"
          accessibilityState={{ disabled: month >= currentMonth }}
          disabled={month >= currentMonth}
          onPress={() => setMonth((value) => shiftMonth(value, 1))}
          style={({ pressed }) => [
            styles.monthButton,
            month >= currentMonth && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <ChevronRight color={colors.text} size={22} />
        </Pressable>
      </View>

      <View accessibilityRole="radiogroup" style={styles.filters}>
        {filters.map((item) => {
          const selected = filter === item.value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={item.value}
              onPress={() => setFilter(item.value)}
              style={({ pressed }) => [
                styles.filter,
                selected && styles.filterSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summaryGrid}>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{formatDuration(result.summary.creditedSeconds)}</Text>
          <Text style={styles.summaryLabel}>Credited hours</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{result.summary.completedWorkdays}</Text>
          <Text style={styles.summaryLabel}>Completed days</Text>
        </Card>
        <Card style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{result.summary.incompleteCount}</Text>
          <Text style={styles.summaryLabel}>Incomplete</Text>
        </Card>
      </View>

      {status === 'loading' ? <LoadingState label="Loading monthly attendance…" /> : null}
      {status === 'error' ? (
        <View style={styles.errorState}>
          <Text style={styles.errorText}>{error?.message ?? 'History could not be loaded.'}</Text>
          <Button onPress={() => void load()} title="Try again" variant="ghost" />
        </View>
      ) : null}

      {status === 'ready' && result.records.length === 0 ? (
        <Card style={styles.emptyCard}>
          <EmptyState
            compact
            description={emptyDescription}
            icon={CalendarClock}
            title="No matching records"
          />
        </Card>
      ) : null}

      {status === 'ready' ? (
        <View style={styles.records}>
          {result.records.map((record) => (
            <Pressable
              accessibilityLabel={`View attendance for ${record.workDate}`}
              accessibilityRole="button"
              key={record.id}
              onPress={() =>
                router.push({ pathname: '/attendance/[id]', params: { id: String(record.id) } })
              }
              style={({ pressed }) => pressed && styles.recordPressed}
            >
              <Card style={styles.recordCard}>
                <View style={styles.recordHeader}>
                  <View>
                    <Text style={styles.recordDate}>{formatWorkDate(record.workDate)}</Text>
                    <Text style={styles.recordSource}>
                      {record.entrySource === 'manual' ? 'Manual entry' : 'Timer entry'}
                    </Text>
                  </View>
                  <Badge
                    icon={record.isAdjusted ? FilePenLine : undefined}
                    label={
                      record.isAdjusted
                        ? 'Adjusted'
                        : record.status === 'completed'
                          ? 'Completed'
                          : 'Incomplete'
                    }
                    tone={record.isAdjusted ? 'primary' : record.status === 'completed' ? 'success' : 'warning'}
                  />
                </View>
                <View style={styles.timeRow}>
                  <View style={styles.timeMetric}>
                    <Text style={styles.metricLabel}>Time In</Text>
                    <Text style={styles.metricValue}>
                      {formatTime(record.clockInAt, timezone, hour12)}
                    </Text>
                  </View>
                  <View style={styles.timeMetric}>
                    <Text style={styles.metricLabel}>Time Out</Text>
                    <Text style={styles.metricValue}>
                      {formatTime(record.clockOutAt, timezone, hour12)}
                    </Text>
                  </View>
                </View>
                <View style={styles.recordFooter}>
                  <Text style={styles.footerText}>
                    Break {formatDuration(record.breakDurationSeconds)}
                  </Text>
                  <Text style={styles.creditedText}>
                    {record.status === 'completed'
                      ? `${formatDuration(record.workedDurationSeconds ?? 0)} credited`
                      : 'Not credited'}
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    marginTop: -36,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
  },
  monthNavigator: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  monthButton: {
    width: layout.minimumTouchTarget,
    height: layout.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
  },
  monthTitle: {
    color: colors.text,
    textAlign: 'center',
    ...typography.heading,
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  filter: {
    minHeight: layout.minimumTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
  },
  filterSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterLabel: {
    color: colors.textSecondary,
    ...typography.label,
  },
  filterLabelSelected: {
    color: colors.surface,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  summaryCard: {
    minWidth: 150,
    flex: 1,
    padding: spacing.md,
  },
  summaryValue: {
    color: colors.text,
    ...typography.heading,
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    marginTop: spacing.xxs,
    color: colors.textSecondary,
    ...typography.caption,
  },
  records: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  recordCard: {
    gap: spacing.md,
  },
  recordPressed: {
    opacity: 0.76,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  recordDate: {
    color: colors.text,
    ...typography.subheading,
  },
  recordSource: {
    marginTop: spacing.xxs,
    color: colors.textSecondary,
    ...typography.caption,
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  timeMetric: {
    flex: 1,
  },
  metricLabel: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  metricValue: {
    marginTop: spacing.xxs,
    color: colors.text,
    ...typography.bodyStrong,
  },
  recordFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  creditedText: {
    color: colors.primaryDark,
    ...typography.label,
    fontVariant: ['tabular-nums'],
  },
  emptyCard: {
    marginTop: spacing.lg,
  },
  errorState: {
    alignItems: 'center',
    marginTop: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.errorSoft,
    borderRadius: radius.md,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    ...typography.body,
  },
});

