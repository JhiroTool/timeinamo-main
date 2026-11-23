import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Pencil, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Dialog, LoadingState, Screen } from '@/components/ui';
import { AttendanceHistoryRepository } from '@/database/repositories';
import type { AttendanceDetails } from '@/database/repositories';
import { AttendancePageHeader } from '@/features/attendance/AttendancePageHeader';
import { formatAttendanceDate, formatAttendanceHours } from '@/features/attendance/attendancePresentation';
import { useAttendance } from '@/features/attendance/useAttendance';
import { useSetup } from '@/features/setup/useSetup';
import { useDatabase } from '@/hooks/useDatabase';
import { calculateAttendanceDurations } from '@/services/attendanceCalculations.js';
import { colors, fontFamilies, radius, spacing } from '@/theme';
import type { AttendanceCorrection } from '@/types/models';
import { toWorkDate } from '@/utils/time';

const fieldLabels: Record<AttendanceCorrection['fieldName'], string> = {
  work_date: 'Attendance date',
  clock_in_at: 'Time In',
  clock_out_at: 'Time Out',
  break_duration_seconds: 'Unpaid break',
  worked_duration_seconds: 'Credited hours',
  status: 'Status',
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function AttendanceDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recordId = Number(id);
  const database = useDatabase();
  const repository = useMemo(() => new AttendanceHistoryRepository(database), [database]);
  const { refresh: refreshAttendance } = useAttendance();
  const { data: setup } = useSetup();
  const timezone = setup?.workSettings.timezone ?? 'Asia/Manila';
  const hour12 = setup?.workSettings.timeFormat !== '24h';
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<AttendanceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDeleteError(null);
    try {
      const result = Number.isSafeInteger(recordId) ? await repository.getDetails(recordId) : null;
      setDetails(result);
      if (!result) setError('This attendance record is unavailable.');
    } catch {
      setError('Attendance details couldn’t be loaded.');
    } finally {
      setLoading(false);
    }
  }, [recordId, repository]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const clockFormat = useMemo(() => new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: 'numeric', minute: '2-digit', second: '2-digit', hour12,
  }), [timezone, hour12]);
  const timestampFormat = useMemo(() => new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12,
  }), [timezone, hour12]);

  const elapsedSeconds = useMemo(() => {
    const record = details?.record;
    if (!record?.clockOutAt) return null;
    try {
      return calculateAttendanceDurations(record.clockInAt, record.clockOutAt, 0).elapsedSeconds;
    } catch {
      return null;
    }
  }, [details]);

  function formatClock(value: string | null, workDate: string) {
    if (!value) return 'Not recorded';
    return (toWorkDate(value, timezone) === workDate ? clockFormat : timestampFormat).format(new Date(value));
  }

  function formatCorrection(field: AttendanceCorrection['fieldName'], value: string | null) {
    if (value === null) return 'Not recorded';
    if (field === 'clock_in_at' || field === 'clock_out_at') return timestampFormat.format(new Date(value));
    if (field === 'break_duration_seconds' || field === 'worked_duration_seconds') return formatAttendanceHours(Number(value), true);
    if (field === 'work_date') return formatAttendanceDate(value, { month: 'short', day: 'numeric', year: 'numeric' });
    if (value === 'on_break') return 'On break';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  async function confirmDelete() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await repository.delete(recordId);
      await refreshAttendance();
      setDeleteVisible(false);
      router.dismissTo('/attendance');
    } catch {
      setDeleteVisible(false);
      setDeleteError('Attendance couldn’t be deleted. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  const record = details?.record;
  const title = record ? formatAttendanceDate(record.workDate, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Attendance record';

  return (
    <Screen contentStyle={styles.screen}>
      <AttendancePageHeader title={title} onBack={() => router.back()} />
      {loading ? <LoadingState label="Loading attendance details…" /> : null}
      {!loading && (error || !details) ? (
        <View style={styles.empty}>
          <Text style={styles.support}>{error ?? 'This attendance record is unavailable.'}</Text>
          <Button onPress={() => void load()} title="Retry" variant="ghost" />
        </View>
      ) : null}

      {!loading && !error && details && record ? (
        <>
          <View style={styles.meta}>
            <Text style={[styles.status, record.status !== 'completed' && styles.warning]}>
              {record.status === 'completed' ? 'Completed' : 'Incomplete'}
            </Text>
            <Text style={styles.support}>{record.workDate.slice(0, 4)} · {record.entrySource === 'manual' ? 'Manual entry' : 'Timer entry'}</Text>
            {record.isAdjusted ? <Text style={styles.adjusted}>Manually adjusted</Text> : null}
          </View>
          <View style={styles.creditedPanel}>
            <Text style={styles.support}>Credited hours</Text>
            <Text style={styles.credited}>{record.workedDurationSeconds === null ? 'Not credited' : formatAttendanceHours(record.workedDurationSeconds, true)}</Text>
          </View>
          <View style={styles.details}>
            <DetailRow label="Time In" value={formatClock(record.clockInAt, record.workDate)} />
            <DetailRow label="Time Out" value={formatClock(record.clockOutAt, record.workDate)} />
            <DetailRow label="Elapsed duration" value={elapsedSeconds === null ? 'Not available' : formatAttendanceHours(elapsedSeconds, true)} />
            <DetailRow label="Unpaid break" value={record.breakDurationSeconds % 60 === 0
              ? `${record.breakDurationSeconds / 60} min` : formatAttendanceHours(record.breakDurationSeconds, true)} />
          </View>
          <View style={styles.actions}>
            <Button icon={Pencil} onPress={() => router.push({ pathname: '/attendance/edit', params: { id: String(record.id) } })}
              title="Edit Record" variant="outline" />
            <Button icon={Trash2} onPress={() => setDeleteVisible(true)} title="Delete Record" variant="danger" />
          </View>
          {deleteError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{deleteError}</Text> : null}

          <View style={styles.audit}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Correction history</Text>
            {details.corrections.length === 0 ? <Text style={styles.support}>No corrections for this record.</Text> :
              details.corrections.map((correction) => (
                <View key={correction.id} style={styles.auditRow}>
                  <Text style={styles.auditField}>{fieldLabels[correction.fieldName]}</Text>
                  <Text style={styles.support}>{timestampFormat.format(new Date(correction.createdAt))}</Text>
                  <Text style={styles.change}>{formatCorrection(correction.fieldName, correction.oldValue)} → {formatCorrection(correction.fieldName, correction.newValue)}</Text>
                  <Text style={styles.support}>{correction.reason}</Text>
                </View>
              ))}
            <View style={styles.timestamps}>
              <Text style={styles.support}>Created {timestampFormat.format(new Date(record.createdAt))}</Text>
              <Text style={styles.support}>Updated {timestampFormat.format(new Date(record.updatedAt))}</Text>
            </View>
          </View>
        </>
      ) : null}

      <Dialog
        actions={
          <View style={styles.dialogActions}>
            <Button disabled={deleting} onPress={() => setDeleteVisible(false)} title="Cancel" variant="ghost" />
            <Button loading={deleting} onPress={() => void confirmDelete()} title="Delete Record" variant="danger" />
          </View>
        }
        description="This removes the record from attendance history and recalculates your credited totals."
        onDismiss={() => { if (!deleting) setDeleteVisible(false); }}
        title="Delete attendance record?"
        visible={deleteVisible}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingBottom: spacing.xl },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
  support: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19 },
  status: { color: colors.primaryDark, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, fontFamily: fontFamilies.label, fontSize: 12, lineHeight: 17 },
  warning: { color: colors.warning, backgroundColor: colors.warningSoft },
  adjusted: { color: colors.primaryDark, fontFamily: fontFamilies.label, fontSize: 12, lineHeight: 17 },
  creditedPanel: { padding: spacing.md, marginBottom: spacing.xs, borderRadius: radius.lg, backgroundColor: '#F0F8F6', borderWidth: 1, borderColor: '#DBEAE7', gap: spacing.xxs },
  credited: { color: colors.primaryDark, fontFamily: fontFamilies.heading, fontSize: 31, lineHeight: 39, letterSpacing: -0.75, fontVariant: ['tabular-nums'] },
  details: { marginVertical: spacing.sm },
  detailRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  detailLabel: { flex: 1, color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
  detailValue: { flex: 1, color: colors.text, textAlign: 'right', fontFamily: fontFamilies.label, fontSize: 14, lineHeight: 21, fontVariant: ['tabular-nums'] },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  dialogActions: { flexShrink: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.xs },
  error: { marginTop: spacing.sm, color: colors.error, fontFamily: fontFamilies.body },
  audit: { gap: spacing.sm, marginTop: spacing.lg },
  sectionTitle: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 19, lineHeight: 26 },
  auditRow: { gap: spacing.xxs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  auditField: { color: colors.text, fontFamily: fontFamilies.label, fontSize: 14, lineHeight: 20 },
  change: { color: colors.primaryDark, fontFamily: fontFamilies.bodyMedium, fontSize: 13, lineHeight: 20, fontVariant: ['tabular-nums'] },
  timestamps: { gap: spacing.xxs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  empty: { alignItems: 'flex-start', gap: spacing.xs },
});
