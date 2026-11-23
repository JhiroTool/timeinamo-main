import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronRight, Clock3, Plus } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AttendanceHistoryFilter, AttendanceHistoryRecord } from '@/database/repositories';
import { AttendanceCalendar } from '@/features/attendance/AttendanceCalendar';
import { formatAttendanceDate, formatAttendanceHours, shiftAttendanceMonth } from '@/features/attendance/attendancePresentation';
import { useAttendance } from '@/features/attendance/useAttendance';
import { useAttendanceHistory } from '@/features/attendance/useAttendanceHistory';
import { useSetup } from '@/features/setup/useSetup';
import { colors, fontFamilies, layout, radius, spacing } from '@/theme';
import { toWorkDate } from '@/utils/time';

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Completed', value: 'completed' },
  { label: 'Incomplete', value: 'incomplete' },
  { label: 'Adjusted', value: 'adjusted' },
] as const;

const shortDate = { weekday: 'short', month: 'short', day: 'numeric' } as const;
const fullDate = { weekday: 'long', month: 'long', day: 'numeric' } as const;

function InlineAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.inlineAction, pressed && styles.pressed]}>
      <Text style={styles.link}>{label}</Text>
    </Pressable>
  );
}

function RecordRow({ record, timeRange, title, onPress }: {
  record: AttendanceHistoryRecord;
  timeRange: string;
  title: string;
  onPress: () => void;
}) {
  const completed = record.status === 'completed';
  return (
    <Pressable accessibilityRole="button" accessibilityHint="Opens attendance details" onPress={onPress}
      style={({ pressed }) => [styles.record, pressed && styles.pressed]}>
      <View style={styles.recordCopy}>
        <Text style={styles.recordTitle}>{title}</Text>
        <Text style={styles.timeRange}>{timeRange}</Text>
      </View>
      <View style={styles.recordTotals}>
        <Text style={styles.recordHours}>{completed ? formatAttendanceHours(record.workedDurationSeconds ?? 0) : '—'}</Text>
        <Text style={[styles.recordStatus, !completed && styles.warning]}>{completed ? 'Completed' : 'Incomplete'}</Text>
        {record.isAdjusted ? <Text style={styles.adjusted}>Adjusted</Text> : null}
      </View>
      <ChevronRight color={colors.textMuted} size={16} />
    </Pressable>
  );
}

export function AttendanceScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { data: setup } = useSetup();
  const { activeSession } = useAttendance();
  const timezone = setup?.workSettings.timezone ?? 'Asia/Manila';
  const today = toWorkDate(new Date(), timezone);
  const currentMonth = today.slice(0, 7);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [filter, setFilter] = useState<AttendanceHistoryFilter>('all');
  const month = selectedDate.slice(0, 7);
  const { status, result, hasResult, load } = useAttendanceHistory(month);
  const hour12 = setup?.workSettings.timeFormat !== '24h';

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const recordsByDate = useMemo(() => new Map<string, AttendanceHistoryRecord>(
    result.records.map((record) => [record.workDate, record]),
  ), [result.records]);
  const visibleRecords = useMemo(() => result.records.filter((record) => {
    if (filter === 'completed') return record.status === 'completed';
    if (filter === 'incomplete') return record.status !== 'completed';
    if (filter === 'adjusted') return record.isAdjusted;
    return true;
  }), [filter, result.records]);
  const selectedRecord = recordsByDate.get(selectedDate);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12,
  }), [timezone, hour12]);

  function formatTimeRange(record: AttendanceHistoryRecord) {
    const start = timeFormatter.format(new Date(record.clockInAt));
    const end = record.clockOutAt ? timeFormatter.format(new Date(record.clockOutAt)) : '—';
    return `${start} – ${end}`;
  }

  function moveMonth(offset: number) {
    const next = shiftAttendanceMonth(month, offset);
    setSelectedDate(next === currentMonth ? today : `${next}-01`);
  }

  function openRecord(id: number) {
    router.push({ pathname: '/attendance/[id]', params: { id: String(id) } });
  }

  function addRecord(date?: string) {
    router.push({ pathname: '/attendance/manual', params: date ? { date } : {} });
  }

  const timerAction = activeSession ? 'Work Session' : 'Time In';
  const loading = status === 'loading' && !hasResult;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      {isFocused ? <StatusBar style="dark" /> : null}
      <FlatList
        data={visibleRecords}
        keyExtractor={(record) => String(record.id)}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <RecordRow record={item} timeRange={formatTimeRange(item)}
            title={formatAttendanceDate(item.workDate, shortDate)}
            onPress={() => openRecord(item.id)} />
        )}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <View style={styles.headerRow}>
                <Text accessibilityRole="header" style={styles.title}>Attendance</Text>
                <View style={styles.headerActions}>
                  <Pressable accessibilityRole="button" accessibilityLabel={timerAction}
                    onPress={() => router.push('/attendance/active')}
                    style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
                    <Clock3 color={colors.primaryDark} size={21} />
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Add Record"
                    onPress={() => addRecord()} style={({ pressed }) => [styles.iconButton, styles.addButton, pressed && styles.pressed]}>
                    <Plus color={colors.primaryDark} size={24} />
                  </Pressable>
                </View>
              </View>
              <Text style={styles.support}>Your workdays, all in one place.</Text>
            </View>
            <View accessibilityLiveRegion="polite" accessibilityState={{ busy: loading }} style={styles.summary}>
              <View style={styles.featuredMetric}>
                {loading ? <View style={[styles.skeleton, styles.hoursSkeleton]} /> : (
                  <Text style={styles.monthlyHours}>{hasResult ? formatAttendanceHours(result.summary.creditedSeconds) : '—'}</Text>
                )}
                <Text style={styles.support}>Hours completed this month</Text>
              </View>
              <View style={styles.summaryStats}>
                <Text style={styles.support}>
                  <Text style={styles.statValue}>{hasResult ? result.summary.completedWorkdays : '—'}</Text>
                  {result.summary.completedWorkdays === 1 ? ' Workday' : ' Workdays'}
                </Text>
                <Text style={styles.support}>
                  <Text style={styles.statValue}>{hasResult ? result.summary.incompleteCount : '—'}</Text>
                  {result.summary.incompleteCount === 1 ? ' Incomplete record' : ' Incomplete records'}
                </Text>
              </View>
            </View>
            <AttendanceCalendar month={month} today={today} selectedDate={selectedDate}
              recordsByDate={recordsByDate} onSelect={setSelectedDate}
              onPrevious={() => moveMonth(-1)} onNext={month < currentMonth ? () => moveMonth(1) : undefined} />

            <View style={styles.selectedDay}>
              <Text accessibilityRole="header" style={styles.selectedTitle}>{formatAttendanceDate(selectedDate, fullDate)}</Text>
              {selectedRecord ? (
                <RecordRow record={selectedRecord} title="View record" timeRange={formatTimeRange(selectedRecord)}
                  onPress={() => openRecord(selectedRecord.id)} />
              ) : hasResult ? (
                <View style={styles.selectedEmpty}>
                  <Text style={[styles.support, styles.selectedCopy]}>
                    {selectedDate > today ? 'This workday is in the future.' : 'No attendance recorded for this date.'}
                  </Text>
                  {selectedDate <= today ? <InlineAction label="Add record" onPress={() => addRecord(selectedDate)} /> : null}
                </View>
              ) : null}
            </View>

            <View style={styles.historyHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Attendance History</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel="Filter attendance history" style={styles.filters}>
                {filters.map((item) => (
                  <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: filter === item.value }}
                    onPress={() => setFilter(item.value)}
                    style={({ pressed }) => [styles.filter, filter === item.value && styles.filterSelected, pressed && styles.pressed]}>
                    <Text style={[styles.filterLabel, filter === item.value && styles.filterLabelSelected]}>{item.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View accessible accessibilityLabel="Loading attendance" accessibilityState={{ busy: true }} style={styles.empty}>
              <View style={[styles.skeleton, styles.rowSkeleton]} />
              <View style={[styles.skeleton, styles.shortSkeleton]} />
            </View>
          ) : status === 'error' ? (
            <View accessibilityLiveRegion="polite" style={styles.empty}>
              <Text style={styles.emptyTitle}>Attendance couldn’t be loaded.</Text>
              <InlineAction label="Retry" onPress={() => void load()} />
            </View>
          ) : result.records.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No attendance records this month.</Text>
              <Text style={styles.support}>Your recorded workdays will appear here.</Text>
              <InlineAction label="Add record" onPress={() => addRecord(selectedDate <= today ? selectedDate : undefined)} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No records match this filter.</Text>
              <InlineAction label="Reset filter" onPress={() => setFilter('all')} />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: 20, paddingTop: spacing.xs, paddingBottom: spacing.xl },
  header: { marginBottom: spacing.md },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: spacing.xs, rowGap: spacing.xxs },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  title: { flexShrink: 1, color: colors.text, fontFamily: fontFamilies.heading, fontSize: 28, lineHeight: 35, letterSpacing: -0.7 },
  iconButton: { width: layout.minimumTouchTarget, height: layout.minimumTouchTarget, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  addButton: { backgroundColor: colors.primarySoft },
  support: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19 },
  summary: { marginBottom: spacing.md, padding: spacing.sm, borderWidth: 1, borderColor: '#DBEAE7', borderRadius: radius.lg, backgroundColor: '#F0F8F6' },
  featuredMetric: { gap: 2 },
  monthlyHours: { color: colors.primaryDark, fontFamily: fontFamilies.heading, fontSize: 30, lineHeight: 38, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
  summaryStats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xxs, marginTop: spacing.xs, paddingTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#C8DEDB' },
  statValue: { color: colors.text, fontFamily: fontFamilies.label, fontVariant: ['tabular-nums'] },
  selectedDay: { paddingTop: spacing.sm, marginTop: spacing.xs },
  selectedTitle: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 16, lineHeight: 23 },
  selectedEmpty: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.xs, paddingTop: spacing.xxs },
  selectedCopy: { flexGrow: 1, flexBasis: 155 },
  inlineAction: { minHeight: layout.minimumTouchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  link: { color: colors.primaryDark, fontFamily: fontFamilies.label, fontSize: 13, lineHeight: 19 },
  historyHeader: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing.xs },
  sectionTitle: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 20, lineHeight: 27, letterSpacing: -0.35 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.xxs, columnGap: spacing.sm, rowGap: spacing.xxs },
  filter: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', paddingHorizontal: 2 },
  filterSelected: { borderBottomColor: colors.primary },
  filterLabel: { color: colors.textSecondary, fontFamily: fontFamilies.bodyMedium, fontSize: 12, lineHeight: 18 },
  filterLabelSelected: { color: colors.primaryDark, fontFamily: fontFamilies.label },
  record: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: spacing.sm },
  recordCopy: { flex: 1, minWidth: 0, gap: 2 },
  recordTitle: { color: colors.text, fontFamily: fontFamilies.label, fontSize: 14, lineHeight: 20 },
  timeRange: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, fontVariant: ['tabular-nums'] },
  recordTotals: { maxWidth: '44%', alignItems: 'flex-end' },
  recordHours: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 15, lineHeight: 21, textAlign: 'right', fontVariant: ['tabular-nums'] },
  recordStatus: { color: colors.primaryDark, fontFamily: fontFamilies.bodyMedium, fontSize: 12, lineHeight: 18, textAlign: 'right' },
  warning: { color: colors.warning },
  adjusted: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 11, lineHeight: 16, textAlign: 'right' },
  empty: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingVertical: spacing.sm, gap: spacing.xxs },
  emptyTitle: { color: colors.text, fontFamily: fontFamilies.label, fontSize: 14, lineHeight: 20 },
  skeleton: { height: 14, borderRadius: radius.sm, backgroundColor: '#DDECE9' },
  hoursSkeleton: { height: 28, width: 112, marginVertical: 5 },
  rowSkeleton: { width: '48%', marginBottom: spacing.xxs },
  shortSkeleton: { width: '32%' },
  pressed: { opacity: 0.65 },
});
