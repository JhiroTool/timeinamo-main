import { useFocusEffect, useRouter } from 'expo-router';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  History,
  LogIn,
  LogOut,
  TimerReset,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  GradientHeader,
  LoadingState,
  ProgressBar,
  Screen,
} from '@/components/ui';
import { useAttendance } from '@/features/attendance/useAttendance';
import { useElapsedSeconds } from '@/features/attendance/useElapsedSeconds';
import { useOjtInsights } from '@/features/progress/useOjtInsights';
import { useSetup } from '@/features/setup/useSetup';
import { formatDuration } from '@/services/attendanceCalculations.js';
import { calculateOjtProgress } from '@/services/ojtProgressCalculations.js';
import { colors, radius, spacing, typography } from '@/theme';
import type { AttendanceSession } from '@/types/models';
import { getZonedDateTimeParts, toWorkDate } from '@/utils/time';

function formatTime(value: string | null, timezone: string, hour12: boolean): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12,
  }).format(new Date(value));
}

function compactHours(seconds: number): string {
  const hours = seconds / 3600;
  return `${Number.isInteger(hours) ? hours.toFixed(0) : hours.toFixed(1)}h`;
}

function formatRecordDate(workDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${workDate}T00:00:00.000Z`));
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 18) return 'Good Afternoon';
  return 'Good Evening';
}

function AttendanceMetric({
  icon: Icon,
  label,
  value,
  divided,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  divided?: boolean;
}) {
  return (
    <View style={[styles.attendanceMetric, divided && styles.metricDivider]}>
      <View style={styles.metricLabelRow}>
        <Icon color={colors.textSecondary} size={17} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ProgressMetric({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <View style={[styles.progressMetric, compact && styles.progressMetricCompact]}>
      <Text style={styles.progressMetricLabel}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.progressMetricValue}>{value}</Text>
    </View>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { data: setup } = useSetup();
  const { activeSession, operation, timeIn } = useAttendance();
  const timezone = setup?.workSettings.timezone ?? 'Asia/Manila';
  const { status, data, error, load } = useOjtInsights(timezone);
  const [actionError, setActionError] = useState<string | null>(null);
  const today = toWorkDate(new Date(), timezone);
  const nowParts = getZonedDateTimeParts(new Date(), timezone);
  const elapsedSeconds = useElapsedSeconds(activeSession?.clockInAt ?? null);
  const firstName = setup?.profile.fullName.trim().split(/\s+/)[0] ?? '';
  const hour12 = setup?.workSettings.timeFormat !== '24h';
  const compact = width < 370;

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const todayRecord = useMemo(() => {
    if (data?.today) return data.today;
    return activeSession?.workDate === today ? activeSession : null;
  }, [activeSession, data?.today, today]);

  const progress = useMemo(() => {
    if (!data || !setup?.profile.requiredMinutes) return null;
    return calculateOjtProgress(
      data.completedSeconds,
      setup.profile.requiredMinutes,
      data.completedWorkdays,
      setup.workSettings.targetMinutes,
    );
  }, [data, setup]);
  const isStaleSession = Boolean(activeSession && activeSession.workDate !== today);
  const displayRecord = todayRecord ?? activeSession;

  const currentDateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  async function handlePrimaryAction() {
    setActionError(null);
    if (activeSession) {
      router.push('/attendance/active');
      return;
    }
    if (todayRecord) {
      router.push({ pathname: '/attendance/[id]', params: { id: String(todayRecord.id) } });
      return;
    }
    try {
      await timeIn();
      await load();
      router.push('/attendance/active');
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : 'Time In could not be saved.');
    }
  }

  const attendanceBadge = displayRecord?.status === 'completed'
    ? { label: 'Completed', tone: 'success' as const, icon: CheckCircle2 }
    : isStaleSession
      ? { label: 'Incomplete', tone: 'warning' as const, icon: History }
      : displayRecord
      ? { label: 'In Progress', tone: 'primary' as const, icon: TimerReset }
      : { label: 'Not Started', tone: 'neutral' as const, icon: Clock3 };

  return (
    <Screen branded contentStyle={styles.screen}>
      <GradientHeader
        showBrand
        showLocalNote
        subtitle={currentDateLabel}
        title={`${greetingForHour(Number(nowParts.time.slice(0, 2)))}${firstName ? `, ${firstName}!` : '!'}`}
      />

      <View style={styles.content}>
        {actionError ? (
          <View accessibilityLiveRegion="assertive" style={styles.errorBanner}>
            <Text style={styles.errorText}>{actionError}</Text>
          </View>
        ) : null}
        {status === 'loading' && !data ? <LoadingState label="Loading your dashboard…" /> : null}
        {status === 'error' ? (
          <Card>
            <EmptyState
              action={<Button onPress={() => void load()} title="Try again" />}
              description={error?.message ?? 'Dashboard data could not be loaded.'}
              icon={BarChart3}
              title="Dashboard unavailable"
            />
          </Card>
        ) : null}

        {data ? (
          <>
            <Card style={styles.attendanceCard}>
              <View style={styles.cardTitleRow}>
                <View style={styles.titleWithIcon}>
                  <CalendarDays color={colors.text} size={25} />
                  <Text style={styles.cardTitle}>Today’s Attendance</Text>
                </View>
                <Badge icon={attendanceBadge.icon} label={attendanceBadge.label} tone={attendanceBadge.tone} />
              </View>

              <View style={styles.attendanceMetrics}>
                <AttendanceMetric icon={LogIn} label="Time In" value={formatTime(displayRecord?.clockInAt ?? null, timezone, hour12)} />
                <AttendanceMetric divided icon={LogOut} label="Time Out" value={formatTime(displayRecord?.clockOutAt ?? null, timezone, hour12)} />
                <AttendanceMetric divided icon={Coffee} label="Break" value={displayRecord ? `${Math.round(displayRecord.breakDurationSeconds / 60)} min` : '—'} />
              </View>

              {activeSession && !isStaleSession ? (
                <View style={styles.timerPanel}>
                  <TimerReset color={colors.primaryDark} size={42} strokeWidth={1.8} />
                  <View style={styles.timerCopy}>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={styles.timer}>{formatDuration(elapsedSeconds)}</Text>
                    <Text style={styles.timerLabel}>Elapsed Working Session</Text>
                  </View>
                </View>
              ) : isStaleSession && activeSession ? (
                <View style={styles.warningPanel}>
                  <History color={colors.warning} size={31} />
                  <View style={styles.warningCopy}>
                    <Text style={styles.warningTitle}>Manual recovery required</Text>
                    <Text style={styles.warningText}>Session from {activeSession.workDate} needs an actual Time Out.</Text>
                  </View>
                </View>
              ) : displayRecord?.status === 'completed' ? (
                <View style={styles.timerPanel}>
                  <CheckCircle2 color={colors.success} size={38} />
                  <View style={styles.timerCopy}>
                    <Text style={styles.completedValue}>{formatDuration(displayRecord.workedDurationSeconds ?? 0)}</Text>
                    <Text style={styles.timerLabel}>Total Credited Working Hours</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.readyPanel}>
                  <Clock3 color={colors.primary} size={28} />
                  <Text style={styles.readyText}>Ready to start your workday?</Text>
                </View>
              )}

              <Button
                fullWidth
                icon={activeSession || displayRecord ? ArrowRight : LogIn}
                loading={operation === 'time_in'}
                onPress={() => void handlePrimaryAction()}
                title={isStaleSession ? 'Review Session' : activeSession ? 'View Active Session' : displayRecord ? 'View Attendance' : 'Time In'}
              />
            </Card>

            {progress && setup?.profile.requiredMinutes ? (
              <Card style={styles.dashboardCard}>
                <View style={styles.cardTitleRow}>
                  <View style={styles.titleWithIcon}>
                    <BarChart3 color={colors.primaryBright} size={25} />
                    <Text style={styles.cardTitle}>My OJT Progress</Text>
                  </View>
                </View>
                <View style={[styles.progressMetrics, compact && styles.progressMetricsCompact]}>
                  <ProgressMetric compact={compact} label="Completed Hours" value={compactHours(data.completedSeconds)} />
                  <ProgressMetric compact={compact} label="Required Hours" value={compactHours(progress.requiredSeconds)} />
                  <ProgressMetric compact={compact} label="Remaining" value={compactHours(progress.remainingSeconds)} />
                  <ProgressMetric compact={compact} label="Percentage" value={`${progress.percentage.toFixed(1)}%`} />
                </View>
                <ProgressBar percentage={progress.percentage} />
                <Pressable
                  accessibilityLabel="View detailed OJT progress"
                  accessibilityRole="button"
                  onPress={() => router.push('/progress')}
                  style={({ pressed }) => [styles.cardLink, pressed && styles.pressed]}
                >
                  <Text style={styles.cardLinkText}>View Progress</Text>
                  <ArrowRight color={colors.primaryDark} size={21} />
                </Pressable>
              </Card>
            ) : null}

            <Card style={styles.dashboardCard}>
              <View style={styles.cardTitleRow}>
                <View style={styles.titleWithIcon}>
                  <History color={colors.primaryBright} size={25} />
                  <Text style={styles.cardTitle}>Recent Attendance</Text>
                </View>
                <Pressable
                  accessibilityLabel="View all attendance records"
                  accessibilityRole="button"
                  onPress={() => router.push('/attendance')}
                  style={({ pressed }) => [styles.inlineLink, pressed && styles.pressed]}
                >
                  <Text style={styles.inlineLinkText}>View All</Text>
                  <ArrowRight color={colors.primaryDark} size={18} />
                </Pressable>
              </View>
              {data.latestRecords.length === 0 ? (
                <EmptyState compact description="Completed and incomplete records will appear here." icon={CalendarDays} title="No attendance yet" />
              ) : (
                <View style={styles.recentList}>
                  {data.latestRecords.map((record: AttendanceSession) => (
                    <Pressable
                      accessibilityLabel={`View attendance for ${record.workDate}`}
                      accessibilityRole="button"
                      key={record.id}
                      onPress={() => router.push({ pathname: '/attendance/[id]', params: { id: String(record.id) } })}
                      style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}
                    >
                      <CalendarDays color={colors.text} size={22} />
                      <View style={styles.recentCopy}>
                        <Text style={styles.recentDate}>{formatRecordDate(record.workDate)}</Text>
                        <Text style={styles.recentTime}>{formatTime(record.clockInAt, timezone, hour12)} – {formatTime(record.clockOutAt, timezone, hour12)}</Text>
                      </View>
                      <Text style={styles.recentHours}>{record.status === 'completed' ? compactHours(record.workedDurationSeconds ?? 0) : '—'}</Text>
                      <Badge label={record.status === 'completed' ? 'Completed' : 'Incomplete'} tone={record.status === 'completed' ? 'success' : 'warning'} />
                    </Pressable>
                  ))}
                </View>
              )}
            </Card>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: spacing.xl },
  content: { marginTop: -42, gap: spacing.md },
  errorBanner: { padding: spacing.md, backgroundColor: colors.errorSoft, borderRadius: radius.lg },
  errorText: { color: colors.error, ...typography.body },
  attendanceCard: { gap: spacing.lg },
  dashboardCard: { gap: spacing.lg },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  titleWithIcon: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { flexShrink: 1, color: colors.text, ...typography.heading },
  attendanceMetrics: { flexDirection: 'row' },
  attendanceMetric: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: spacing.xs },
  metricDivider: { borderLeftWidth: 1, borderLeftColor: colors.borderStrong },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  metricLabel: { color: colors.textSecondary, ...typography.caption },
  metricValue: { marginTop: spacing.xs, color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  timerPanel: { minHeight: 108, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radius.lg },
  timerCopy: { minWidth: 0, flexShrink: 1, alignItems: 'center' },
  timer: { color: colors.primaryDeep, fontSize: 37, lineHeight: 43, fontWeight: '800', letterSpacing: 0.8, fontVariant: ['tabular-nums'] },
  timerLabel: { color: colors.textSecondary, ...typography.body },
  completedValue: { color: colors.primaryDeep, fontSize: 29, lineHeight: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  readyPanel: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radius.lg },
  readyText: { color: colors.primaryDark, ...typography.bodyStrong },
  warningPanel: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.warningSoft, borderRadius: radius.lg },
  warningCopy: { minWidth: 0, flex: 1 },
  warningTitle: { color: colors.warning, ...typography.bodyStrong },
  warningText: { marginTop: spacing.xxs, color: colors.textSecondary, ...typography.caption },
  progressMetrics: { flexDirection: 'row', gap: spacing.xs },
  progressMetricsCompact: { flexWrap: 'wrap' },
  progressMetric: { minWidth: 68, flex: 1 },
  progressMetricCompact: { minWidth: '45%' },
  progressMetricLabel: { minHeight: 36, color: colors.textSecondary, ...typography.caption },
  progressMetricValue: { color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '800', fontVariant: ['tabular-nums'] },
  cardLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  cardLinkText: { color: colors.primaryDark, ...typography.bodyStrong },
  inlineLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  inlineLinkText: { color: colors.primaryDark, ...typography.label },
  recentList: { gap: spacing.xs },
  recentRow: { minHeight: 68, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md },
  recentCopy: { minWidth: 0, flex: 1 },
  recentDate: { color: colors.text, ...typography.label },
  recentTime: { marginTop: spacing.xxs, color: colors.textSecondary, ...typography.caption },
  recentHours: { color: colors.text, ...typography.bodyStrong, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.72 },
});
