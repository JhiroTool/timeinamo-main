import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Button, Dialog, LoadingState, Screen, TextField } from '@/components/ui';
import { DatabaseOperationError } from '@/database/errors';
import { AttendanceHistoryRepository } from '@/database/repositories';
import { AttendancePageHeader } from '@/features/attendance/AttendancePageHeader';
import { formatAttendanceHours } from '@/features/attendance/attendancePresentation';
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
import { calculateAttendanceDurations } from '@/services/attendanceCalculations.js';
import { colors, fontFamilies, radius, spacing } from '@/theme';
import type { AttendanceSession } from '@/types/models';
import { getZonedDateTimeParts, parseWorkDate, toUtcTimestamp, zonedDateTimeToUtc } from '@/utils/time';

function initialWorkDate(date: string | undefined, today: string): string {
  if (typeof date !== 'string' || date > today) return today;
  try {
    return parseWorkDate(date);
  } catch {
    return today;
  }
}

export function ManualAttendanceScreen() {
  const router = useRouter();
  const { fontScale } = useWindowDimensions();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
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
      workDate: initialWorkDate(params.date, nowParts.date),
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
    setLoadError(null);
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
      () => {
        if (cancelled) return;
        setLoadError('Attendance could not be loaded.');
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
      const destination = { pathname: '/attendance/[id]' as const, params: { id: String(saved.id) } };
      if (editing) router.dismissTo(destination);
      else router.replace(destination);
    } catch (reason) {
      setSaveError(reason instanceof DatabaseOperationError || reason instanceof RangeError
        ? reason.message : 'Attendance could not be saved. Please try again.');
    }
  });

  function discardAndContinue() {
    const repeat = pendingNavigation;
    setPendingNavigation(null);
    disablePrevention();
    repeat?.();
  }

  return (
    <Screen keyboardAware contentStyle={styles.screen}>
      <AttendancePageHeader
        onBack={() => router.back()}
        subtitle={editing ? 'Corrections retain the previous values and your reason.' : 'Log a workday that wasn’t tracked with the timer.'}
        title={editing ? 'Edit Record' : 'Add Record'}
      />

      {loading ? <LoadingState label="Loading attendance record…" /> : loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{loadError}</Text>
          <Button onPress={() => router.back()} title="Go back" variant="ghost" />
        </View>
      ) : (
        <>
          <View style={styles.form}>
            <Controller
              control={control}
              name="workDate"
              render={({ field }) => (
                <DateTimeField
                  dateFormat={dateFormat}
                  error={errors.workDate?.message}
                  label="Attendance date"
                  mode="date"
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  value={field.value}
                />
              )}
            />
            <View style={styles.timeRow}>
              <View style={[styles.timeField, fontScale > 1.2 && styles.stackedField]}>
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
              <View style={[styles.timeField, fontScale > 1.2 && styles.stackedField]}>
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
          </View>

          <View style={styles.calculation}>
            {preview ? (
              <>
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>Elapsed</Text>
                  <Text style={styles.calculationValue}>{formatAttendanceHours(preview.elapsedSeconds, true)}</Text>
                </View>
                <View style={styles.calculationRow}>
                  <Text style={styles.calculationLabel}>Credited hours</Text>
                  <Text style={styles.creditedValue}>{formatAttendanceHours(preview.creditedSeconds, true)}</Text>
                </View>
              </>
            ) : <Text style={styles.calculationLabel}>Enter a valid time range and break to preview credited hours.</Text>}
          </View>

          {saveError ? (
            <View accessibilityLiveRegion="assertive" style={styles.errorBanner}>
              <Text style={styles.errorText}>{saveError}</Text>
            </View>
          ) : null}

          <Button
            disabled={editing && !existing}
            fullWidth
            loading={isSubmitting}
            onPress={() => void submit()}
            title={editing ? 'Save Changes' : 'Save Attendance'}
          />
        </>
      )}

      <Dialog
        actions={
          <View style={styles.dialogActions}>
            <Button onPress={() => setPendingNavigation(null)} title="Keep editing" variant="ghost" />
            <Button onPress={discardAndContinue} title="Discard changes" variant="danger" />
          </View>
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
  screen: { paddingHorizontal: 20, paddingBottom: spacing.xl },
  form: { gap: spacing.md },
  timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  timeField: { flexGrow: 1, flexBasis: 140 },
  stackedField: { flexBasis: '100%' },
  calculation: { marginVertical: spacing.md, padding: spacing.sm, backgroundColor: '#F0F8F6', borderRadius: radius.md, gap: spacing.xs },
  calculationRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: spacing.sm },
  calculationLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
  calculationValue: { color: colors.text, fontFamily: fontFamilies.label, fontSize: 14, lineHeight: 21, fontVariant: ['tabular-nums'] },
  creditedValue: { color: colors.primaryDark, fontFamily: fontFamilies.headingSemibold, fontSize: 17, lineHeight: 24, fontVariant: ['tabular-nums'] },
  dialogActions: { flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.xs },
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
    fontFamily: fontFamilies.body,
    fontSize: 14,
    lineHeight: 21,
  },
});

