import { useRouter } from 'expo-router';
import { CheckCircle2, Clock3, LogIn, LogOut, TriangleAlert } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, BottomSheet, Button, Card, GradientHeader, LoadingState, Screen } from '@/components/ui';
import { BreakSelector } from '@/features/attendance/BreakSelector';
import { useAttendance } from '@/features/attendance/useAttendance';
import { useElapsedSeconds } from '@/features/attendance/useElapsedSeconds';
import { DateTimeField } from '@/features/setup/DateTimeField';
import { useSetup } from '@/features/setup/useSetup';
import { calculateAttendanceDurations, formatDuration } from '@/services/attendanceCalculations.js';
import { colors, radius, spacing, typography } from '@/theme';
import type { AttendanceSession } from '@/types/models';
import {
  getZonedDateTimeParts,
  toWorkDate,
  zonedDateTimeToUtc,
} from '@/utils/time';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function formatTimestamp(value: string, timezone: string, hour12: boolean): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12,
  }).format(new Date(value));
}

export function ActiveTimerScreen() {
  const router = useRouter();
  const { data: setup } = useSetup();
  const {
    activeSession,
    status,
    error: restoreError,
    operation,
    refresh,
    timeIn,
    timeOut,
    updateUnpaidBreak,
  } = useAttendance();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [lastCompleted, setLastCompleted] = useState<AttendanceSession | null>(null);
  const [recoveryDate, setRecoveryDate] = useState('');
  const [recoveryTime, setRecoveryTime] = useState('');
  const elapsedSeconds = useElapsedSeconds(activeSession?.clockInAt ?? null);
  const timezone = setup?.workSettings.timezone ?? 'Asia/Manila';
  const timeFormat = setup?.workSettings.timeFormat ?? '12h';
  const dateFormat = setup?.workSettings.dateFormat ?? 'mdy';
  const isStale = activeSession
    ? activeSession.workDate !== toWorkDate(new Date(), timezone)
    : false;

  useEffect(() => {
    if (!activeSession || !isStale) return;
    const parts = getZonedDateTimeParts(new Date(), timezone);
    setRecoveryDate(parts.date);
    setRecoveryTime(parts.time);
  }, [activeSession?.id, isStale, timezone]);

  const proposedClockOut = useMemo(() => {
    if (!activeSession) return null;
    try {
      return isStale
        ? zonedDateTimeToUtc(recoveryDate, recoveryTime, timezone)
        : new Date();
    } catch {
      return null;
    }
  }, [activeSession, elapsedSeconds, isStale, recoveryDate, recoveryTime, timezone]);

  const preview = useMemo(() => {
    if (!activeSession || !proposedClockOut) return null;
    try {
      return calculateAttendanceDurations(
        activeSession.clockInAt,
        proposedClockOut,
        activeSession.breakDurationSeconds,
      );
    } catch {
      return null;
    }
  }, [activeSession, proposedClockOut]);

  async function handleTimeIn() {
    setFeedback(null);
    setLastCompleted(null);
    try {
      await timeIn();
      setFeedback({ tone: 'success', message: 'Time In saved on this device.' });
    } catch (reason) {
      setFeedback({
        tone: 'error',
        message: reason instanceof Error ? reason.message : 'Time In could not be saved.',
      });
    }
  }

  async function handleBreakChange(minutes: number) {
    if (!activeSession) return;
    setFeedback(null);
    try {
      await updateUnpaidBreak(activeSession.id, minutes * 60);
      setFeedback({ tone: 'success', message: 'Unpaid break updated.' });
    } catch (reason) {
      setFeedback({
        tone: 'error',
        message: reason instanceof Error ? reason.message : 'Break could not be updated.',
      });
    }
  }

  async function confirmTimeOut() {
    if (!activeSession) return;
    setFeedback(null);
    let occurredAt: Date;
    try {
      occurredAt = isStale
        ? zonedDateTimeToUtc(recoveryDate, recoveryTime, timezone)
        : new Date();
    } catch (reason) {
      setSheetVisible(false);
      setFeedback({
        tone: 'error',
        message: reason instanceof Error ? reason.message : 'Recovery time is invalid.',
      });
      return;
    }
    try {
      const completed = await timeOut(
        activeSession.id,
        activeSession.breakDurationSeconds,
        occurredAt,
      );
      setLastCompleted(completed);
      setSheetVisible(false);
      setFeedback({ tone: 'success', message: 'Time Out saved successfully.' });
    } catch (reason) {
      setSheetVisible(false);
      setFeedback({
        tone: 'error',
        message: reason instanceof Error ? reason.message : 'Time Out could not be saved.',
      });
    }
  }

  if (status === 'loading') return <LoadingState fullPage label="Restoring attendance…" />;

  return (
    <Screen branded>
      <GradientHeader
        compact
        eyebrow={activeSession ? 'IN PROGRESS' : 'ATTENDANCE'}
        onBack={() => router.back()}
        subtitle={activeSession ? 'Your work session is running' : 'Ready when you are'}
        title="Work Session"
      />
      <View style={styles.content}>

      {restoreError ? (
        <View style={[styles.feedback, styles.errorFeedback]}>
          <Text style={styles.errorText}>{restoreError.message}</Text>
          <Button onPress={() => void refresh()} title="Try again" variant="ghost" />
        </View>
      ) : null}

      {feedback ? (
        <View
          accessibilityLiveRegion={feedback.tone === 'error' ? 'assertive' : 'polite'}
          style={[
            styles.feedback,
            feedback.tone === 'error' ? styles.errorFeedback : styles.successFeedback,
          ]}
        >
          <Text style={feedback.tone === 'error' ? styles.errorText : styles.successText}>
            {feedback.message}
          </Text>
        </View>
      ) : null}

      {!activeSession ? (
        <Card style={styles.timerCard}>
          {lastCompleted ? (
            <>
              <View style={styles.timerIcon}>
                <CheckCircle2 color={colors.success} size={34} />
              </View>
              <Text style={styles.stateTitle}>Session completed</Text>
              <Text style={styles.stateDescription}>
                Credited time: {formatDuration(lastCompleted.workedDurationSeconds ?? 0)}
              </Text>
              <Button
                fullWidth
                onPress={() => router.replace('/attendance')}
                title="Back to attendance"
                variant="secondary"
              />
            </>
          ) : (
            <>
              <Badge label="Ready" tone="primary" />
              <View style={styles.timerIcon}>
                <Clock3 color={colors.primary} size={34} strokeWidth={1.8} />
              </View>
              <Text style={styles.stateTitle}>Start your workday</Text>
              <Text style={styles.stateDescription}>
                Time In records the current timestamp immediately after SQLite confirms the write.
              </Text>
              <Button
                fullWidth
                icon={LogIn}
                loading={operation === 'time_in'}
                onPress={() => void handleTimeIn()}
                title="Time In"
              />
            </>
          )}
        </Card>
      ) : (
        <>
          {isStale ? (
            <View style={styles.staleBanner}>
              <TriangleAlert color={colors.warning} size={22} />
              <View style={styles.staleCopy}>
                <Text style={styles.staleTitle}>Manual recovery required</Text>
                <Text style={styles.staleText}>
                  This session crossed into another workday. It will never be clocked out automatically.
                </Text>
              </View>
            </View>
          ) : null}

          <Card style={styles.timerCard}>
            <Badge label={isStale ? 'Incomplete session' : 'Active session'} tone={isStale ? 'warning' : 'success'} />
            <Text accessibilityLabel={`${formatDuration(elapsedSeconds)} elapsed`} style={styles.timer}>
              {formatDuration(elapsedSeconds)}
            </Text>
            <Text style={styles.timerLabel}>Elapsed time</Text>
            <View style={styles.sessionInfo}>
              <InfoRow label="Work date" value={activeSession.workDate} />
              <InfoRow
                label="Time In"
                value={formatTimestamp(activeSession.clockInAt, timezone, timeFormat === '12h')}
              />
            </View>
          </Card>

          <Card style={styles.breakCard}>
            <BreakSelector
              disabled={operation !== null}
              onChange={(minutes) => void handleBreakChange(minutes)}
              valueMinutes={Math.round(activeSession.breakDurationSeconds / 60)}
            />
            <Text style={styles.breakNote}>
              Saved per session. Changing the default in Settings will not alter this session.
            </Text>
          </Card>

          {isStale ? (
            <Card style={styles.recoveryCard}>
              <Text style={styles.recoveryTitle}>Actual Time Out</Text>
              <Text style={styles.recoveryDescription}>
                Choose the time you actually stopped working, then review the calculation.
              </Text>
              <DateTimeField
                dateFormat={dateFormat}
                label="Time Out date"
                mode="date"
                onChange={setRecoveryDate}
                value={recoveryDate}
              />
              <DateTimeField
                label="Time Out time"
                mode="time"
                onChange={setRecoveryTime}
                timeFormat={timeFormat}
                value={recoveryTime}
              />
              {!preview ? (
                <Text style={styles.validationError}>
                  Time Out must follow Time In, and the unpaid break cannot exceed elapsed time.
                </Text>
              ) : null}
              <Button
                disabled={!preview || operation !== null}
                fullWidth
                icon={LogOut}
                onPress={() => setSheetVisible(true)}
                title="Review manual Time Out"
                variant="danger"
              />
            </Card>
          ) : (
            <Button
              disabled={!preview || operation !== null}
              fullWidth
              icon={LogOut}
              onPress={() => setSheetVisible(true)}
              style={styles.timeOutButton}
              title="Time Out"
              variant="danger"
            />
          )}
        </>
      )}
      </View>

      <BottomSheet
        dismissDisabled={operation === 'time_out'}
        onDismiss={() => setSheetVisible(false)}
        title="Confirm Time Out"
        visible={sheetVisible && Boolean(activeSession)}
      >
        <Text style={styles.sheetDescription}>
          This completes the session. Review the authoritative whole-second calculation below.
        </Text>
        <View style={styles.calculationCard}>
          <InfoRow label="Elapsed" value={preview ? formatDuration(preview.elapsedSeconds) : 'Invalid'} />
          <InfoRow
            label="Unpaid break"
            value={activeSession ? formatDuration(activeSession.breakDurationSeconds) : '00:00:00'}
          />
          <View style={styles.calculationDivider} />
          <InfoRow label="Credited" value={preview ? formatDuration(preview.creditedSeconds) : 'Invalid'} />
        </View>
        <View style={styles.sheetActions}>
          <Button
            disabled={operation === 'time_out'}
            fullWidth
            onPress={() => setSheetVisible(false)}
            title="Keep session running"
            variant="outline"
          />
          <Button
            disabled={!preview}
            fullWidth
            loading={operation === 'time_out'}
            onPress={() => void confirmTimeOut()}
            title="Confirm Time Out"
            variant="danger"
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    marginTop: -36,
  },
  timerCard: {
    alignItems: 'center',
    marginTop: 0,
  },
  timerIcon: {
    width: 68,
    height: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
  },
  timer: {
    marginTop: spacing.xl,
    color: colors.text,
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  timerLabel: {
    color: colors.textSecondary,
    ...typography.body,
  },
  stateTitle: {
    marginTop: spacing.lg,
    color: colors.text,
    textAlign: 'center',
    ...typography.heading,
  },
  stateDescription: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    ...typography.body,
  },
  sessionInfo: {
    width: '100%',
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  infoLabel: {
    color: colors.textSecondary,
    ...typography.body,
  },
  infoValue: {
    flex: 1,
    color: colors.text,
    textAlign: 'right',
    ...typography.bodyStrong,
  },
  breakCard: {
    marginTop: spacing.md,
  },
  breakNote: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    textAlign: 'center',
    ...typography.caption,
  },
  timeOutButton: {
    marginTop: spacing.lg,
  },
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.warningSoft,
    borderRadius: radius.md,
  },
  staleCopy: {
    flex: 1,
  },
  staleTitle: {
    color: colors.warning,
    ...typography.bodyStrong,
  },
  staleText: {
    marginTop: spacing.xxs,
    color: colors.textSecondary,
    ...typography.caption,
  },
  recoveryCard: {
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  recoveryTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  recoveryDescription: {
    marginTop: -spacing.sm,
    color: colors.textSecondary,
    ...typography.body,
  },
  validationError: {
    color: colors.error,
    ...typography.caption,
  },
  feedback: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  successFeedback: {
    backgroundColor: colors.successSoft,
  },
  errorFeedback: {
    backgroundColor: colors.errorSoft,
  },
  successText: {
    color: colors.success,
    ...typography.body,
  },
  errorText: {
    color: colors.error,
    ...typography.body,
  },
  sheetDescription: {
    color: colors.textSecondary,
    ...typography.body,
  },
  calculationCard: {
    marginTop: spacing.lg,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  calculationDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  sheetActions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});

