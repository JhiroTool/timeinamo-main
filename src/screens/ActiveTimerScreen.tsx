import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Check, LogIn, LogOut } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';

import { BottomSheet, Button, LoadingState, Screen } from '@/components/ui';
import { BreakSelector, formatSessionBreak } from '@/features/attendance/BreakSelector';
import { workDateToUtc } from '@/features/attendance/attendancePresentation';
import { useAttendance } from '@/features/attendance/useAttendance';
import { useElapsedSeconds } from '@/features/attendance/useElapsedSeconds';
import { DateTimeField } from '@/features/setup/DateTimeField';
import { useSetup } from '@/features/setup/useSetup';
import { calculateAttendanceDurations, formatDuration } from '@/services/attendanceCalculations.js';
import { colors, fontFamilies, layout, radius, spacing } from '@/theme';
import type { AttendanceSession, DateFormat } from '@/types/models';
import { getZonedDateTimeParts, toWorkDate, zonedDateTimeToUtc } from '@/utils/time';

function InfoRow({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, emphasized && styles.creditedValue]}>{value}</Text>
    </View>
  );
}

function formatWorkDate(workDate: string, preference: DateFormat) {
  const date = workDateToUtc(workDate);
  const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' } as const;
  if (preference === 'ymd') {
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);
    const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${fields.weekday}, ${fields.year} ${fields.month} ${fields.day}`;
  }
  return new Intl.DateTimeFormat(preference === 'dmy' ? 'en-GB' : 'en-US', options).format(date);
}

function buildTimeOutReview(session: AttendanceSession, clockOutAt: Date) {
  return {
    sessionId: session.id,
    clockInAt: session.clockInAt,
    clockOutAt,
    breakSeconds: session.breakDurationSeconds,
    ...calculateAttendanceDurations(session.clockInAt, clockOutAt, session.breakDurationSeconds),
  };
}

type TimeOutReview = ReturnType<typeof buildTimeOutReview>;
const timerEntrance = FadeIn.duration(200);

function useSessionMotion(enabled: boolean) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const cycle = useSharedValue(0);

  useEffect(() => {
    let awaitingPreference = true;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      awaitingPreference = false;
      setReduceMotion(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (awaitingPreference) setReduceMotion(value);
    }, () => {});
    return () => {
      awaitingPreference = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!enabled || reduceMotion) return;
    // The accessibility listener handles changes made while the app is running.
    cycle.set(withRepeat(withTiming(1, {
      duration: 1800,
      easing: Easing.inOut(Easing.sin),
    }), -1, true, undefined, ReduceMotion.Never));
    return () => {
      cancelAnimation(cycle);
      cycle.set(0);
    };
  }, [cycle, enabled, reduceMotion]);

  const dot = useAnimatedStyle(() => ({
    opacity: 0.72 + cycle.get() * 0.28,
    transform: [{ scale: 0.93 + cycle.get() * 0.16 }],
  }));
  const accent = useAnimatedStyle(() => ({ transform: [{ translateX: cycle.get() * 46 }] }));

  return { dot, accent, reduceMotion };
}

function SessionReadout({ session, visible, recovery, review, workDate, timeIn, motion }: {
  session: AttendanceSession;
  visible: boolean;
  recovery: boolean;
  review: TimeOutReview | null;
  workDate: string;
  timeIn: string;
  motion: ReturnType<typeof useSessionMotion>;
}) {
  const elapsed = useElapsedSeconds(recovery ? null : session.clockInAt, visible);
  const duration = review?.elapsedSeconds ?? (recovery ? undefined : elapsed);
  const estimate = review?.creditedSeconds ?? (recovery ? undefined : Math.max(0, elapsed - session.breakDurationSeconds));
  const elapsedDisplay = duration === undefined ? '—' : formatDuration(duration);

  return (
    <>
      <Animated.View {...(!motion.reduceMotion && !recovery ? { entering: timerEntrance } : {})} style={styles.hero}>
        <Text accessibilityLabel={duration === undefined ? 'Elapsed time pending recovery' : `${elapsedDisplay} elapsed`}
          adjustsFontSizeToFit maxFontSizeMultiplier={1.25} numberOfLines={1} style={styles.timer}>{elapsedDisplay}</Text>
        <Text style={styles.timerLabel}>{recovery ? 'Elapsed time at proposed Time Out' : 'Elapsed time'}</Text>
        <View style={[styles.rail, recovery && styles.recoveryRail]}>
          {!recovery ? <Animated.View style={[styles.accent, motion.accent]} /> : null}
        </View>
      </Animated.View>
      <View style={styles.info}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Session details</Text>
        <InfoRow label="Work date" value={workDate} />
        <InfoRow label="Time In" value={timeIn} />
        <InfoRow label="Elapsed duration" value={elapsedDisplay} />
        <InfoRow label="Estimated credited time" value={estimate === undefined ? '—' : formatDuration(estimate)} emphasized />
      </View>
    </>
  );
}

export function ActiveTimerScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { data: setup } = useSetup();
  const { activeSession, status, error: restoreError, operation, refresh, timeIn, timeOut, updateUnpaidBreak } = useAttendance();
  const timezone = setup?.workSettings.timezone ?? 'Asia/Manila';
  const timeFormat = setup?.workSettings.timeFormat ?? '12h';
  const dateFormat = setup?.workSettings.dateFormat ?? 'mdy';
  const [foreground, setForeground] = useState(() => AppState.currentState === 'active');
  const [today, setToday] = useState(() => toWorkDate(new Date(), timezone));
  const [review, setReview] = useState<TimeOutReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastCompleted, setLastCompleted] = useState<AttendanceSession | null>(null);
  const [recoveryDate, setRecoveryDate] = useState('');
  const [recoveryTime, setRecoveryTime] = useState('');
  const submitting = useRef(false);
  const visible = isFocused && foreground;
  const isStale = Boolean(activeSession && activeSession.workDate !== today);
  const motion = useSessionMotion(visible && Boolean(activeSession) && !isStale && !review);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setForeground(state === 'active'));
    setForeground(AppState.currentState === 'active');
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let timeout: ReturnType<typeof setTimeout>;
    function refreshWorkDate() {
      setToday(toWorkDate(new Date(), timezone));
      timeout = setTimeout(refreshWorkDate, 60_000 - (Date.now() % 60_000));
    }
    refreshWorkDate();
    return () => clearTimeout(timeout);
  }, [timezone, visible]);

  const goHome = useCallback(() => {
    router.dismissTo('/attendance');
    router.navigate('/');
  }, [router]);

  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      goHome();
      return true;
    });
    return () => subscription.remove();
  }, [goHome]));

  useEffect(() => {
    if (!activeSession || !isStale) return;
    const parts = getZonedDateTimeParts(new Date(), timezone);
    setRecoveryDate(parts.date);
    setRecoveryTime(parts.time);
  }, [activeSession?.id, isStale, timezone]);

  useEffect(() => {
    if (review && activeSession?.id !== review.sessionId) setReview(null);
  }, [activeSession?.id, review]);

  const clockFormat = useMemo(() => new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: timeFormat === '12h',
  }), [timeFormat, timezone]);
  const reviewClockFormat = useMemo(() => new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: timeFormat === '12h',
  }), [timeFormat, timezone]);

  const clockLabel = (date: string | Date, workDate?: string, exact = false) => {
    const clock = (exact ? reviewClockFormat : clockFormat).format(new Date(date));
    if (!workDate) return clock;
    const clockDate = toWorkDate(date, timezone);
    return clockDate === workDate ? clock : `${formatWorkDate(clockDate, dateFormat)} · ${clock}`;
  };

  const recoveryPreview = useMemo(() => {
    if (!activeSession || !isStale || !recoveryDate || !recoveryTime) return null;
    try {
      return buildTimeOutReview(activeSession, zonedDateTimeToUtc(recoveryDate, recoveryTime, timezone));
    } catch {
      return null;
    }
  }, [activeSession, isStale, recoveryDate, recoveryTime, timezone]);

  async function handleTimeIn() {
    if (operation !== null) return;
    setError(null);
    setLastCompleted(null);
    try {
      await timeIn();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Time In could not be saved.');
    }
  }

  async function handleBreakChange(minutes: number) {
    if (!activeSession || operation !== null) return false;
    if (activeSession.breakDurationSeconds === minutes * 60) return true;
    setError(null);
    try {
      await updateUnpaidBreak(activeSession.id, minutes * 60);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Break could not be updated.');
      return false;
    }
  }

  function openTimeOut() {
    if (!activeSession || operation !== null) return;
    setError(null);
    if (isStale) {
      if (recoveryPreview) setReview(recoveryPreview);
      return;
    }
    const proposed = new Date();
    const workDate = toWorkDate(proposed, timezone);
    if (workDate !== activeSession.workDate) {
      setToday(workDate);
      return;
    }
    try {
      setReview(buildTimeOutReview(activeSession, proposed));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Time Out could not be calculated.');
    }
  }

  async function confirmTimeOut() {
    if (!review || submitting.current || operation !== null) return;
    if (!activeSession || activeSession.id !== review.sessionId || activeSession.clockInAt !== review.clockInAt
      || activeSession.breakDurationSeconds !== review.breakSeconds) {
      setReview(null);
      setError('The session changed. Review Time Out again.');
      return;
    }
    submitting.current = true;
    setError(null);
    try {
      // Save the exact timestamp and deduction shown in the review.
      const completed = await timeOut(review.sessionId, review.breakSeconds, review.clockOutAt);
      setLastCompleted(completed);
      setReview(null);
    } catch (reason) {
      setReview(null);
      setError(reason instanceof Error ? reason.message : 'Time Out could not be saved.');
    } finally {
      submitting.current = false;
    }
  }

  const stateLabel = status === 'loading' ? null : isStale ? 'Incomplete' : activeSession ? 'Active'
    : lastCompleted ? 'Completed' : status === 'error' ? null : 'Ready';
  const subtitle = isStale ? 'Choose your actual Time Out to finish this workday.'
    : activeSession ? 'Your time is being recorded.' : lastCompleted ? 'This session is saved in Attendance.' : null;

  return (
    <Screen includeBottomInset contentStyle={styles.screen}>
      {isFocused ? <StatusBar style="dark" /> : null}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Home" onPress={goHome}
            style={({ pressed }) => [styles.back, pressed && styles.backPressed]}>
            <ArrowLeft color={colors.primaryDark} size={22} />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>Work Session</Text>
          {stateLabel ? (
            <View style={[styles.status, isStale && styles.warningStatus]}>
              {activeSession && !isStale ? <Animated.View style={[styles.dot, motion.dot]} /> : null}
              <Text style={[styles.statusLabel, isStale && styles.warningLabel]}>{stateLabel}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={styles.support}>{subtitle}</Text> : null}
      </View>

      {restoreError ? (
        <View style={styles.feedback}>
          <Text accessibilityLiveRegion="polite" style={styles.error}>Attendance could not be restored.</Text>
          <Button title="Try again" variant="ghost" labelStyle={styles.buttonLabel} onPress={() => void refresh()} />
        </View>
      ) : null}

      {status === 'loading' ? <LoadingState label="Restoring attendance…" /> : null}
      {status !== 'loading' && activeSession ? (
        <>
          <SessionReadout key={activeSession.id} session={activeSession} visible={visible && !review}
            recovery={isStale} review={review ?? recoveryPreview} workDate={formatWorkDate(activeSession.workDate, dateFormat)}
            timeIn={clockLabel(activeSession.clockInAt, activeSession.workDate)} motion={motion} />

          <View style={styles.breakSection}>
            <BreakSelector key={activeSession.id} valueSeconds={activeSession.breakDurationSeconds}
              disabled={operation !== null || Boolean(review)} saving={operation === 'update_break'} onChange={handleBreakChange} />
          </View>

          {isStale ? (
            <View style={styles.recovery}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Actual Time Out</Text>
              <DateTimeField dateFormat={dateFormat} label="Time Out date" mode="date"
                onChange={setRecoveryDate} value={recoveryDate} />
              <DateTimeField label="Time Out time" mode="time"
                onChange={setRecoveryTime} timeFormat={timeFormat} value={recoveryTime} />
              {!recoveryPreview ? (
                <Text style={styles.warningLabel}>Time Out must follow Time In, and the unpaid break cannot exceed elapsed time.</Text>
              ) : null}
            </View>
          ) : null}
          <View style={styles.action}>
            {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
            <Button fullWidth disabled={operation !== null || (isStale && !recoveryPreview)}
              icon={LogOut} labelStyle={styles.buttonLabel} style={styles.primaryButton}
              onPress={openTimeOut} title={isStale ? 'Review Time Out' : 'Time Out'} />
          </View>
        </>
      ) : null}

      {status !== 'loading' && !activeSession ? (
        <View style={styles.inactive}>
          {lastCompleted ? (
            <>
              <View style={styles.check}><Check color={colors.primaryDark} size={24} /></View>
              <Text accessibilityRole="header" style={styles.inactiveTitle}>Session completed</Text>
              <Text adjustsFontSizeToFit maxFontSizeMultiplier={1.35} numberOfLines={1} style={styles.completedTime}>
                {formatDuration(lastCompleted.workedDurationSeconds ?? 0)}
              </Text>
              <Text style={styles.timerLabel}>Credited time</Text>
              <View style={styles.action}>
                <Button fullWidth labelStyle={styles.buttonLabel} title="Back to Attendance"
                  onPress={() => router.dismissTo('/attendance')} variant="outline" />
              </View>
            </>
          ) : (
            <>
              <Text accessibilityRole="header" style={styles.inactiveTitle}>Start your workday</Text>
              <Text style={[styles.support, styles.centered]}>Time In records the start of this session.</Text>
              <View style={styles.action}>
                {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
                <Button fullWidth icon={LogIn} labelStyle={styles.buttonLabel} loading={operation === 'time_in'}
                  disabled={operation !== null} onPress={() => void handleTimeIn()} title="Time In" />
              </View>
            </>
          )}
        </View>
      ) : null}

      {review && activeSession?.id === review.sessionId ? (
        <BottomSheet visible scrollable title="Confirm Time Out" titleStyle={styles.sectionTitle}
          dismissDisabled={operation === 'time_out'} onDismiss={() => setReview(null)}>
          <View style={styles.review}>
            <InfoRow label="Time In" value={clockLabel(review.clockInAt, activeSession.workDate, true)} />
            <InfoRow label="Proposed Time Out" value={clockLabel(review.clockOutAt, activeSession.workDate, true)} />
            <InfoRow label="Elapsed duration" value={formatDuration(review.elapsedSeconds)} />
            <InfoRow label="Unpaid break" value={formatSessionBreak(review.breakSeconds)} />
            <InfoRow label="Final credited hours" value={formatDuration(review.creditedSeconds)} emphasized />
          </View>
          <View style={styles.sheetActions}>
            <Button fullWidth loading={operation === 'time_out'} disabled={operation !== null}
              title="Confirm Time Out" labelStyle={styles.buttonLabel} onPress={() => void confirmTimeOut()} />
            <Button fullWidth disabled={operation === 'time_out'} title="Continue Working" variant="outline"
              labelStyle={styles.buttonLabel} onPress={() => setReview(null)} />
          </View>
        </BottomSheet>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingTop: spacing.xs, paddingBottom: spacing.lg },
  header: { gap: spacing.xxs, paddingBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  headerRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.xs },
  back: { width: layout.minimumTouchTarget, height: layout.minimumTouchTarget, alignItems: 'center', justifyContent: 'center', marginLeft: -spacing.xs, borderRadius: radius.md },
  backPressed: { backgroundColor: colors.primarySoft },
  title: { flexGrow: 1, flexShrink: 1, color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 24, lineHeight: 32, letterSpacing: -0.6 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: '#E3F3EF' },
  statusLabel: { color: colors.primaryDark, fontFamily: fontFamilies.label, fontSize: 12, lineHeight: 17 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  warningStatus: { backgroundColor: colors.warningSoft },
  warningLabel: { color: colors.warning, fontFamily: fontFamilies.bodyMedium, fontSize: 13, lineHeight: 19 },
  support: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 20 },
  hero: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg, gap: spacing.xxs },
  timer: { alignSelf: 'stretch', color: colors.text, textAlign: 'center', fontFamily: fontFamilies.heading, fontSize: 54, lineHeight: 66, letterSpacing: -1.85, fontVariant: ['tabular-nums'] },
  timerLabel: { color: colors.textSecondary, fontFamily: fontFamilies.bodyMedium, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  rail: { width: 70, height: 3, marginTop: spacing.xs, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: '#CDE5DF' },
  accent: { height: '100%', width: 24, borderRadius: radius.pill, backgroundColor: colors.primary },
  recoveryRail: { backgroundColor: colors.borderStrong },
  info: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong, paddingTop: spacing.sm },
  sectionTitle: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontWeight: 'normal', fontSize: 18, lineHeight: 26 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  infoLabel: { minWidth: 0, flex: 1, color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 20 },
  infoValue: { maxWidth: '56%', flexShrink: 1, color: colors.text, textAlign: 'right', fontFamily: fontFamilies.bodyMedium, fontSize: 16, lineHeight: 22, fontVariant: ['tabular-nums'] },
  creditedValue: { color: colors.primaryDark, fontFamily: fontFamilies.headingSemibold },
  breakSection: { marginTop: spacing.md },
  recovery: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: spacing.sm },
  action: { width: '100%', marginTop: spacing.md, gap: spacing.xs },
  primaryButton: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  buttonLabel: { fontFamily: fontFamilies.label, fontWeight: 'normal', fontSize: 15 },
  feedback: { alignItems: 'flex-start', gap: spacing.xxs, marginTop: spacing.sm },
  error: { color: colors.error, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 20 },
  inactive: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  inactiveTitle: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 24, lineHeight: 32, textAlign: 'center' },
  centered: { textAlign: 'center' },
  completedTime: { alignSelf: 'stretch', color: colors.primaryDark, fontFamily: fontFamilies.heading, fontSize: 46, lineHeight: 56, textAlign: 'center', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  check: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.primarySoft },
  review: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sheetActions: { marginTop: spacing.md, gap: spacing.xs, paddingBottom: spacing.xxs },
});
