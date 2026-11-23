import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { Save } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Dialog, GradientHeader, LoadingState, Screen, TextField } from '@/components/ui';
import { AttendanceHistoryRepository } from '@/database/repositories';
import { useAttendance } from '@/features/attendance/useAttendance';
import { DateTimeField } from '@/features/setup/DateTimeField';
import {
  correctionAttendanceSchema,
  manualAttendanceSchema,
  sessionToManualForm,
  type ManualAttendanceFormValues,
} from '@/features/attendance/manualAttendanceSchema';
import { useSetup } from '@/features/setup/useSetup';
import { useDatabase } from '@/hooks/useDatabase';
import { calculateAttendanceDurations, formatDuration } from '@/services/attendanceCalculations.js';
import { colors, radius, spacing, typography } from '@/theme';
import type { AttendanceSession } from '@/types/models';
import { getZonedDateTimeParts, parseWorkDate, toUtcTimestamp, zonedDateTimeToUtc } from '@/utils/time';

export function ManualAttendanceScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const sessionId = params.id ? Number(params.id) : null;
  const editing = Number.isSafeInteger(sessionId) && sessionId !== null;
  const database = useDatabase();
  const repository = useMemo(() => new AttendanceHistoryRepository(database), [database]);
  const { data: setup } = useSetup();
  const { refresh: refreshAttendance } = useAttendance();
  const timezone = setup?.workSettings.timezone ?? 'Asia/Manila';
  const timeFormat = setup?.workSettings.timeFormat ?? '12h';
  const dateFormat = setup?.workSettings.dateFormat ?? 'mdy';
  const nowParts = getZonedDateTimeParts(new Date(), timezone);
  const [existing, setExisting] = useState<AttendanceSession | null>(null);
  const [loading, setLoading] = useState(editing);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);

  const {
    control,
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    reset,
  } = useForm<ManualAttendanceFormValues>({
    defaultValues: {
      workDate: nowParts.date,
      timeIn: setup
        ? `${String(Math.floor(setup.workSettings.workStartMinutes / 60)).padStart(2, '0')}:${String(setup.workSettings.workStartMinutes % 60).padStart(2, '0')}`
        : '08:00',
      timeOut: setup
        ? `${String(Math.floor(setup.workSettings.workEndMinutes / 60)).padStart(2, '0')}:${String(setup.workSettings.workEndMinutes % 60).padStart(2, '0')}`
        : '15:00',
      breakMinutes: String(setup?.workSettings.defaultBreakMinutes ?? 60),
      reason: '',
    },
    mode: 'onBlur',
    resolver: zodResolver(editing ? correctionAttendanceSchema : manualAttendanceSchema),
  });
  const values = useWatch({ control });

  const disablePrevention = usePreventRemove(isDirty, ({ repeat }) => {
    setPendingNavigation(() => repeat);
  });

  useEffect(() => {
    if (!editing || sessionId === null) return;
    let cancelled = false;
    setLoading(true);
    repository.getDetails(sessionId).then(
      (details) => {
        if (cancelled) return;
        if (!details) {
          setLoadError('Attendance record was not found.');
        } else {
          setExisting(details.record);
          reset(sessionToManualForm(details.record, timezone));
        }
        setLoading(false);
      },
      (reason: unknown) => {
        if (cancelled) return;
        setLoadError(reason instanceof Error ? reason.message : 'Attendance could not be loaded.');
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [editing, repository, reset, sessionId, timezone]);

  const preview = useMemo(() => {
    if (!values.workDate || !values.timeIn || !values.timeOut || values.breakMinutes === undefined) {
      return null;
    }
    try {
      const clockIn = zonedDateTimeToUtc(values.workDate, values.timeIn, timezone);
      const clockOut = zonedDateTimeToUtc(values.workDate, values.timeOut, timezone);
      return calculateAttendanceDurations(clockIn, clockOut, Number(values.breakMinutes) * 60);
    } catch {
      return null;
    }
  }, [timezone, values.breakMinutes, values.timeIn, values.timeOut, values.workDate]);

  const submit = handleSubmit(async (formValues) => {
    setSaveError(null);
    try {
      const workDate = parseWorkDate(formValues.workDate);
      const input = {
        profileId: 1,
        workDate,
        clockInAt: toUtcTimestamp(zonedDateTimeToUtc(workDate, formValues.timeIn, timezone)),
        clockOutAt: toUtcTimestamp(zonedDateTimeToUtc(workDate, formValues.timeOut, timezone)),
        unpaidBreakSeconds: Number(formValues.breakMinutes) * 60,
        timezone,
      };
      const saved = editing && sessionId !== null
        ? await repository.update(sessionId, input, formValues.reason)
        : await repository.createManual(input);
      await refreshAttendance();
      reset(formValues);
      disablePrevention();
      router.replace({ pathname: '/attendance/[id]', params: { id: String(saved.id) } });
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Attendance could not be saved.');
    }
  });

  function discardAndContinue() {
    const repeat = pendingNavigation;
    setPendingNavigation(null);
    disablePrevention();
    repeat?.();
  }

  if (loading) return <LoadingState fullPage label="Loading attendance record…" />;

  return (
    <Screen branded includeBottomInset keyboardAware>
      <GradientHeader
        compact
        onBack={() => router.back()}
        subtitle={editing ? 'Update values with a required audit reason' : 'Add a completed work record'}
        title={editing ? 'Edit Attendance' : 'Manual Attendance'}
      />
      <View style={styles.content}>

      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Button onPress={() => router.back()} title="Go back" variant="ghost" />
        </View>
      ) : (
        <>
          <Text style={styles.intro}>
            {editing
              ? 'Changes recalculate credited time and are recorded in the correction audit history.'
              : 'Create a completed attendance record for a workday that was not tracked with the timer.'}
          </Text>

          <Card style={styles.formCard}>
            <Controller
              control={control}
              name="workDate"
              render={({ field }) => (
                <DateTimeField
                  dateFormat={dateFormat}
                  error={errors.workDate?.message}
                  label="Work date"
                  mode="date"
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  value={field.value}
                />
              )}
            />
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Controller
                  control={control}
                  name="timeIn"
                  render={({ field }) => (
                    <DateTimeField
                      error={errors.timeIn?.message}
                      label="Time In"
                      mode="time"
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      timeFormat={timeFormat}
                      value={field.value}
                    />
                  )}
                />
              </View>
              <View style={styles.timeField}>
                <Controller
                  control={control}
                  name="timeOut"
                  render={({ field }) => (
                    <DateTimeField
                      error={errors.timeOut?.message}
                      label="Time Out"
                      mode="time"
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      timeFormat={timeFormat}
                      value={field.value}
                    />
                  )}
                />
              </View>
            </View>
            <Controller
              control={control}
              name="breakMinutes"
              render={({ field }) => (
                <TextField
                  error={errors.breakMinutes?.message}
                  keyboardType="number-pad"
                  label="Unpaid break (minutes)"
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  value={field.value}
                />
              )}
            />
            {editing ? (
              <Controller
                control={control}
                name="reason"
                render={({ field }) => (
                  <TextField
                    error={errors.reason?.message}
                    label="Correction reason"
                    multiline
                    numberOfLines={3}
                    onBlur={field.onBlur}
                    onChangeText={field.onChange}
                    placeholder="Explain why this record is changing"
                    textAlignVertical="top"
                    value={field.value}
                  />
                )}
              />
            ) : null}
          </Card>

          <Card style={styles.calculationCard}>
            <Text style={styles.calculationTitle}>Calculated totals</Text>
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Elapsed</Text>
              <Text style={styles.calculationValue}>
                {preview ? formatDuration(preview.elapsedSeconds) : 'Invalid'}
              </Text>
            </View>
            <View style={styles.calculationRow}>
              <Text style={styles.calculationLabel}>Credited</Text>
              <Text style={styles.calculationValue}>
                {preview ? formatDuration(preview.creditedSeconds) : 'Invalid'}
              </Text>
            </View>
          </Card>

          {saveError ? (
            <View accessibilityLiveRegion="assertive" style={styles.errorBanner}>
              <Text style={styles.errorText}>{saveError}</Text>
            </View>
          ) : null}

          <Button
            disabled={!preview || (editing && !existing)}
            fullWidth
            icon={Save}
            loading={isSubmitting}
            onPress={() => void submit()}
            title={editing ? 'Save correction' : 'Create attendance record'}
          />
        </>
      )}

      </View>
      <Dialog
        actions={
          <>
            <Button onPress={() => setPendingNavigation(null)} title="Keep editing" variant="ghost" />
            <Button onPress={discardAndContinue} title="Discard changes" variant="danger" />
          </>
        }
        description="Your attendance changes have not been saved."
        onDismiss={() => setPendingNavigation(null)}
        title="Discard unsaved changes?"
        visible={pendingNavigation !== null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    marginTop: -36,
  },
  intro: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    color: colors.textSecondary,
    ...typography.body,
  },
  formCard: {
    marginTop: spacing.md,
    gap: spacing.lg,
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  timeField: {
    minWidth: 220,
    flex: 1,
  },
  calculationCard: {
    marginVertical: spacing.md,
    gap: spacing.sm,
  },
  calculationTitle: {
    color: colors.text,
    ...typography.subheading,
  },
  calculationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  calculationLabel: {
    color: colors.textSecondary,
    ...typography.body,
  },
  calculationValue: {
    color: colors.text,
    ...typography.bodyStrong,
    fontVariant: ['tabular-nums'],
  },
  errorBanner: {
    alignItems: 'center',
    marginVertical: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.errorSoft,
    borderRadius: radius.md,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    ...typography.body,
  },
});

