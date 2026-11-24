import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { LoadingState, ProgressBar, Screen } from '@/components/ui';
import { HomeAttendanceControl } from '@/features/attendance/HomeAttendanceControl';
import { useAttendance } from '@/features/attendance/useAttendance';
import { useElapsedSeconds } from '@/features/attendance/useElapsedSeconds';
import { useOjtInsights } from '@/features/progress/useOjtInsights';
import { useSetup } from '@/features/setup/useSetup';
import { formatDuration } from '@/services/attendanceCalculations.js';
import { calculateOjtProgress } from '@/services/ojtProgressCalculations.js';
import { colors, fontFamilies, layout, radius, spacing } from '@/theme';
import { formatWorkDate, getZonedDateTimeParts, toWorkDate } from '@/utils/time';

const headerDateStyle = { weekday: 'short', month: 'short', day: 'numeric' } as const;

function compactHours(seconds: number): string {
  return `${(seconds / 3600).toLocaleString('en-US', { maximumFractionDigits: 1 })} h`;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function AttendanceMetric({ label, value, divided }: { label: string; value: string; divided?: boolean }) {
  return (
    <View style={[styles.metric, divided && styles.metricDivider]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function HomeLink({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Text style={styles.linkText}>{label}</Text>
      <ArrowUpRight color={colors.primaryDark} size={15} strokeWidth={2} />
    </Pressable>
  );
}

function WorkdayTime({ clockInAt, creditedSeconds, isVisible }: {
  clockInAt: string | null;
  creditedSeconds: number;
  isVisible: boolean;
}) {
  const elapsedSeconds = useElapsedSeconds(clockInAt, isVisible);

  return (
    <Text adjustsFontSizeToFit numberOfLines={1} style={styles.workdayTime}>
      {formatDuration(clockInAt ? elapsedSeconds : creditedSeconds)}
    </Text>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [isForeground, setIsForeground] = useState(() => AppState.currentState === 'active');
  const isVisible = isFocused && isForeground;
  const { data: setup } = useSetup();
  const { activeSession, operation, timeIn } = useAttendance();
  const timezone = setup?.workSettings.timezone ?? 'Asia/Manila';
  const { status, data, error, load } = useOjtInsights(timezone);
  const [actionError, setActionError] = useState<string | null>(null);
  const starting = useRef(false);
  const now = new Date();
  const today = toWorkDate(now, timezone);
  const firstName = setup?.profile.fullName.trim().split(/\s+/)[0] ?? '';
  const hour12 = setup?.workSettings.timeFormat !== '24h';
  const dateFormat = setup?.workSettings.dateFormat ?? 'mdy';

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setIsForeground(state === 'active'));
    setIsForeground(AppState.currentState === 'active');
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isVisible) void load();
  }, [isVisible, load]);

  useEffect(() => {
    if (!isVisible) return;
    let timeout: ReturnType<typeof setTimeout>;

    function checkAtNextMinute() {
      timeout = setTimeout(() => {
        if (toWorkDate(new Date(), timezone) !== today) void load();
        else checkAtNextMinute();
      }, 60_000 - (Date.now() % 60_000));
    }

    checkAtNextMinute();
    return () => clearTimeout(timeout);
  }, [isVisible, load, today, timezone]);

  const snapshot = data?.today?.workDate === today ? data.today : null;
  const todayRecord = activeSession?.workDate === today ? activeSession : snapshot;
  const session = activeSession ?? todayRecord;
  const completed = todayRecord?.status === 'completed';
  const isLiveToday = todayRecord !== null && !completed;
  const needsReview = Boolean(session && session.status !== 'completed' && session.workDate !== today);
  const actionState = needsReview ? 'incomplete' : session?.status === 'completed' ? 'completed' : session ? 'active' : 'ready';
  const workdayStatus = completed
    ? 'Completed'
    : todayRecord?.status === 'on_break'
      ? 'On Break'
      : isLiveToday
        ? 'In Progress'
        : needsReview ? 'Incomplete' : 'Not Started';
  const timeLabel = isLiveToday ? 'Elapsed session time' : 'Credited work time';

  const progress = data && setup?.profile.requiredMinutes
    ? calculateOjtProgress(
        data.completedSeconds,
        setup.profile.requiredMinutes,
        data.completedWorkdays,
        setup.workSettings.targetMinutes,
      )
    : null;
  const clockFormatter = useMemo(() => new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12,
  }), [timezone, hour12]);
  const greeting = greetingForHour(Number(getZonedDateTimeParts(now, timezone).time.slice(0, 2)));

  function formatTime(value: string | null | undefined) {
    return value ? clockFormatter.format(new Date(value)) : '—';
  }

  function openRecord(id: number) {
    router.push({ pathname: '/attendance/[id]', params: { id: String(id) } });
  }

  async function handlePrimaryAction() {
    if (starting.current || operation) return;
    setActionError(null);
    if (activeSession) {
      router.push('/attendance/active');
      return;
    }
    if (todayRecord) {
      if (todayRecord.status === 'completed') openRecord(todayRecord.id);
      else router.push('/attendance/active');
      return;
    }
    starting.current = true;
    try {
      await timeIn();
      await load();
      router.push('/attendance/active');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Time In could not be saved.');
    } finally {
      starting.current = false;
    }
  }

  return (
    <Screen contentStyle={styles.screen}>
      {isFocused ? <StatusBar style="dark" /> : null}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.brand}>
            <Image
              resizeMode="cover"
              source={require('../../assets/images/TI LOGO 96.png')}
              style={styles.logo}
            />
            <Text style={styles.brandName}>TimeInamo</Text>
          </View>
          <Text style={styles.headerDate}>{formatWorkDate(today, dateFormat, headerDateStyle)}</Text>
        </View>
        <Text accessibilityRole="header" numberOfLines={2} style={styles.greeting}>
          {greeting}{firstName ? `, ${firstName}` : ''}
        </Text>
      </View>

      {status === 'loading' && !data ? <LoadingState label="Loading your workday…" /> : null}
      {status === 'error' ? (
        <View style={styles.errorBanner} accessibilityLiveRegion="polite">
          <Text style={styles.errorText}>{error?.message ?? 'Home data could not be loaded.'}</Text>
          <HomeLink label="Try again" accessibilityLabel="Reload Home data" onPress={() => void load()} />
        </View>
      ) : null}

      {data ? (
        <>
          <View style={styles.workday}>
            <View style={styles.workdayHeader}>
              <Text accessibilityRole="header" style={styles.workdayTitle}>Today’s Workday</Text>
              <View style={styles.status}>
                <View style={[
                  styles.statusDot,
                  isLiveToday && styles.activeDot,
                  workdayStatus === 'Incomplete' && styles.warningDot,
                ]} />
                <Text style={styles.statusText}>{workdayStatus}</Text>
              </View>
            </View>

            <WorkdayTime
              clockInAt={isLiveToday ? todayRecord.clockInAt : null}
              creditedSeconds={todayRecord?.workedDurationSeconds ?? 0}
              isVisible={isVisible}
            />
            <Text style={styles.workdayCaption}>{timeLabel}</Text>

            <View style={styles.metrics}>
              <AttendanceMetric label="Time In" value={formatTime(todayRecord?.clockInAt)} />
              <AttendanceMetric divided label="Time Out" value={formatTime(todayRecord?.clockOutAt)} />
              <AttendanceMetric
                divided
                label="Unpaid Break"
                value={todayRecord ? `${Math.round(todayRecord.breakDurationSeconds / 60)} min` : '—'}
              />
            </View>
          </View>

          <View style={styles.attendanceAction}>
            <HomeAttendanceControl
              disabled={operation !== null}
              isVisible={isVisible}
              loading={operation === 'time_in'}
              onPress={() => void handlePrimaryAction()}
              state={actionState}
            />
            {needsReview && session ? (
              <Text style={styles.recoveryNote}>Time Out needed for {formatWorkDate(session.workDate, dateFormat)}</Text>
            ) : null}
            {actionError ? (
              <Text accessibilityLiveRegion="assertive" style={[styles.errorText, styles.actionError]}>{actionError}</Text>
            ) : null}
          </View>

          {progress ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>OJT Progress</Text>
                <HomeLink label="View Progress" accessibilityLabel="View detailed OJT progress" onPress={() => router.push('/progress')} />
              </View>
              <View style={styles.progressSummary}>
                <View style={styles.progressHours}>
                  <Text style={styles.completedHours}>{compactHours(data.completedSeconds)}</Text>
                  <Text style={styles.requiredHours}>of {compactHours(progress.requiredSeconds)} required</Text>
                </View>
                <Text style={styles.percentage}>{progress.percentage.toFixed(1)}%</Text>
              </View>
              <ProgressBar height={5} percentage={progress.percentage} />
              <Text style={styles.remainingHours}>{compactHours(progress.remainingSeconds)} remaining</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Recent Attendance</Text>
              <HomeLink label="View All" accessibilityLabel="View all attendance records" onPress={() => router.push('/attendance')} />
            </View>
            {data.latestRecords.length === 0 ? (
              <View style={styles.emptyRow}>
                <CalendarDays color={colors.primaryDark} size={19} strokeWidth={1.7} />
                <Text style={styles.emptyText}>No attendance recorded yet.</Text>
              </View>
            ) : (
              data.latestRecords.map((record) => {
                const isCompleted = record.status === 'completed';
                const recordStatus = record.workDate !== today ? 'Incomplete'
                  : record.status === 'on_break' ? 'On Break' : 'In Progress';
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={record.id}
                    onPress={() => openRecord(record.id)}
                    style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}
                  >
                    <View style={styles.recentCopy}>
                      <Text style={styles.recentDate}>{formatWorkDate(record.workDate, dateFormat)}</Text>
                      <Text style={styles.recentTime}>{formatTime(record.clockInAt)} – {formatTime(record.clockOutAt)}</Text>
                    </View>
                    <View style={styles.recentSummary}>
                      <Text style={[styles.recentHours, !isCompleted && styles.uncreditedHours]}>
                        {isCompleted ? compactHours(record.workedDurationSeconds ?? 0) : '—'}
                      </Text>
                      {!isCompleted ? (
                        <Text style={[styles.recentStatus, recordStatus === 'Incomplete' && styles.incompleteText]}>
                          {recordStatus}
                        </Text>
                      ) : null}
                    </View>
                    <ChevronRight color={colors.textMuted} size={15} strokeWidth={1.8} />
                  </Pressable>
                );
              })
            )}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.sm, paddingBottom: spacing.xl },
  header: { marginBottom: spacing.md, gap: spacing.xs },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: spacing.sm },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  logo: { width: 27, height: 27, borderRadius: 7 },
  brandName: { color: colors.primaryDark, fontFamily: fontFamilies.heading, fontSize: 19, lineHeight: 25, letterSpacing: -0.45 },
  headerDate: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, fontVariant: ['tabular-nums'] },
  greeting: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 28, lineHeight: 35, letterSpacing: -0.7 },
  workday: { borderRadius: radius.card, backgroundColor: colors.primaryDark, padding: spacing.md },
  workdayHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  workdayTitle: { color: colors.surface, fontFamily: fontFamilies.headingSemibold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 9, paddingVertical: 3 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primarySoft },
  activeDot: { backgroundColor: '#5EEAD4' },
  warningDot: { backgroundColor: '#FCD34D' },
  statusText: { color: colors.surface, fontFamily: fontFamilies.label, fontSize: 12, lineHeight: 18 },
  workdayTime: { marginTop: spacing.xxs, color: colors.surface, fontFamily: fontFamilies.heading, fontSize: 46, lineHeight: 55, letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  workdayCaption: { color: colors.primarySoft, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 20 },
  metrics: { flexDirection: 'row', marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.30)' },
  metric: { flex: 1, minWidth: 0, justifyContent: 'space-between', paddingRight: 2, gap: 2 },
  metricDivider: { paddingLeft: 6, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: 'rgba(255,255,255,0.30)' },
  metricLabel: { color: colors.primarySoft, fontFamily: fontFamilies.body, fontSize: 12, lineHeight: 17 },
  metricValue: { color: colors.surface, fontFamily: fontFamilies.label, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  attendanceAction: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.xs },
  recoveryNote: { fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, color: colors.warning, textAlign: 'center' },
  section: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong, paddingTop: spacing.xxs, paddingBottom: spacing.sm },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: spacing.xs },
  sectionTitle: { flexShrink: 1, color: colors.text, fontFamily: fontFamilies.heading, fontSize: 19, lineHeight: 26, letterSpacing: -0.35 },
  link: { minHeight: layout.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  linkText: { color: colors.primaryDark, fontFamily: fontFamilies.label, fontSize: 13, lineHeight: 19, flexShrink: 1 },
  progressSummary: { flexDirection: 'row', alignItems: 'baseline', columnGap: spacing.xs, marginBottom: spacing.xs },
  progressHours: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
  completedHours: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 20, lineHeight: 28, letterSpacing: -0.35, fontVariant: ['tabular-nums'] },
  requiredHours: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, fontVariant: ['tabular-nums'] },
  percentage: { color: colors.primaryDark, fontFamily: fontFamilies.headingSemibold, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  remainingHours: { marginTop: spacing.xs, color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, fontVariant: ['tabular-nums'] },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 58, paddingVertical: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  recentCopy: { flex: 1, minWidth: 0 },
  recentDate: { color: colors.text, fontFamily: fontFamilies.label, fontSize: 14, lineHeight: 20, fontVariant: ['tabular-nums'] },
  recentTime: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19, fontVariant: ['tabular-nums'] },
  recentSummary: { maxWidth: '38%', alignItems: 'flex-end' },
  recentHours: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 14, lineHeight: 20, textAlign: 'right', fontVariant: ['tabular-nums'] },
  uncreditedHours: { color: colors.textMuted },
  recentStatus: { color: colors.primaryDark, fontFamily: fontFamilies.bodyMedium, fontSize: 13, lineHeight: 19, textAlign: 'right' },
  incompleteText: { color: colors.warning },
  emptyRow: { flexDirection: 'row', alignItems: 'center', minHeight: layout.minimumTouchTarget, gap: spacing.xs },
  emptyText: { flex: 1, color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 20 },
  errorBanner: { marginBottom: spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.xs, backgroundColor: colors.errorSoft, borderRadius: radius.md },
  errorText: { color: colors.error, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 20 },
  actionError: { textAlign: 'center' },
  pressed: { opacity: 0.65 },
});
