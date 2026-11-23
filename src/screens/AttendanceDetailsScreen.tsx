import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { FilePenLine, Pencil, Trash2 } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge, Button, Card, Dialog, EmptyState, GradientHeader, LoadingState, Screen, SectionHeader } from '@/components/ui';
import { AttendanceHistoryRepository } from '@/database/repositories';
import type { AttendanceDetails } from '@/database/repositories';
import { useAttendance } from '@/features/attendance/useAttendance';
import { useSetup } from '@/features/setup/useSetup';
import { useDatabase } from '@/hooks/useDatabase';
import { calculateAttendanceDurations, formatDuration } from '@/services/attendanceCalculations.js';
import { colors, spacing, typography } from '@/theme';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function readableField(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
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
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [details, setDetails] = useState<AttendanceDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isSafeInteger(recordId)) {
      setError('Attendance record is invalid.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const result = await repository.getDetails(recordId);
      if (!result) {
        setError('Attendance record was not found.');
        setStatus('error');
      } else {
        setDetails(result);
        setStatus('ready');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Attendance details could not be loaded.');
      setStatus('error');
    }
  }, [recordId, repository]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const elapsedSeconds = useMemo(() => {
    const record = details?.record;
    if (!record?.clockOutAt) return null;
    try {
      return calculateAttendanceDurations(record.clockInAt, record.clockOutAt, 0).elapsedSeconds;
    } catch {
      return null;
    }
  }, [details]);

  function formatTimestamp(value: string | null): string {
    if (!value) return 'Not recorded';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12,
    }).format(new Date(value));
  }

  async function confirmDelete() {
    setDeleting(true);
    setError(null);
    try {
      await repository.delete(recordId);
      await refreshAttendance();
      setDeleteVisible(false);
      router.replace('/attendance');
    } catch (reason) {
      setDeleteVisible(false);
      setError(reason instanceof Error ? reason.message : 'Attendance could not be deleted.');
      setStatus('error');
    } finally {
      setDeleting(false);
    }
  }

  if (status === 'loading') return <LoadingState fullPage label="Loading attendance details…" />;

  if (status === 'error' || !details) {
    return (
      <Screen branded>
        <GradientHeader compact onBack={() => router.back()} subtitle="Session record and audit history" title="Attendance Details" />
        <Card style={styles.errorCard}>
          <EmptyState
            action={<Button onPress={() => void load()} title="Try again" />}
            description={error ?? 'This attendance record is unavailable.'}
            icon={FilePenLine}
            title="Unable to show record"
          />
        </Card>
      </Screen>
    );
  }

  const { record, corrections } = details;

  return (
    <Screen branded>
      <GradientHeader compact onBack={() => router.back()} subtitle="Session record and audit history" title="Attendance Details" />

      <View style={styles.badges}>
        <Badge
          label={record.entrySource === 'manual' ? 'Manual entry' : 'Timer entry'}
          tone="neutral"
        />
        <Badge
          label={record.status === 'completed' ? 'Completed' : 'Incomplete'}
          tone={record.status === 'completed' ? 'success' : 'warning'}
        />
        {record.isAdjusted ? <Badge icon={FilePenLine} label="Manually adjusted" tone="primary" /> : null}
      </View>

      <Card style={styles.detailsCard}>
        <Text style={styles.workDate}>{record.workDate}</Text>
        <DetailRow label="Time In" value={formatTimestamp(record.clockInAt)} />
        <DetailRow label="Time Out" value={formatTimestamp(record.clockOutAt)} />
        <DetailRow
          label="Elapsed"
          value={elapsedSeconds === null ? 'Incomplete' : formatDuration(elapsedSeconds)}
        />
        <DetailRow label="Unpaid break" value={formatDuration(record.breakDurationSeconds)} />
        <DetailRow
          label="Credited"
          value={
            record.workedDurationSeconds === null
              ? 'Not credited'
              : formatDuration(record.workedDurationSeconds)
          }
        />
        <DetailRow label="Created" value={formatTimestamp(record.createdAt)} />
        <DetailRow label="Last updated" value={formatTimestamp(record.updatedAt)} />
      </Card>

      <View style={styles.actions}>
        <Button
          icon={Pencil}
          onPress={() =>
            router.push({ pathname: '/attendance/edit', params: { id: String(record.id) } })
          }
          title="Edit"
          variant="outline"
        />
        <Button
          icon={Trash2}
          onPress={() => setDeleteVisible(true)}
          title="Delete"
          variant="danger"
        />
      </View>

      <View style={styles.auditSection}>
        <SectionHeader
          title="Correction history"
          description="Previous and new values are retained on this device"
        />
        {corrections.length === 0 ? (
          <Card>
            <EmptyState
              compact
              description="This attendance record has not been adjusted."
              icon={FilePenLine}
              title="No corrections"
            />
          </Card>
        ) : (
          corrections.map((correction) => (
            <Card key={correction.id} style={styles.auditCard}>
              <View style={styles.auditHeader}>
                <Text style={styles.auditField}>{readableField(correction.fieldName)}</Text>
                <Text style={styles.auditTime}>{formatTimestamp(correction.createdAt)}</Text>
              </View>
              <Text style={styles.auditChange}>
                {correction.oldValue ?? 'Empty'} → {correction.newValue ?? 'Empty'}
              </Text>
              <Text style={styles.auditReason}>{correction.reason}</Text>
            </Card>
          ))
        )}
      </View>

      <Dialog
        actions={
          <>
            <Button
              disabled={deleting}
              onPress={() => setDeleteVisible(false)}
              title="Cancel"
              variant="ghost"
            />
            <Button
              loading={deleting}
              onPress={() => void confirmDelete()}
              title="Delete record"
              variant="danger"
            />
          </>
        }
        description="This record will be removed from history and totals. Its audit data remains preserved locally."
        onDismiss={() => {
          if (!deleting) setDeleteVisible(false);
        }}
        title="Delete attendance record?"
        visible={deleteVisible}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: -32,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 18,
  },
  detailsCard: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  workDate: {
    marginBottom: spacing.sm,
    color: colors.text,
    ...typography.title,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  detailLabel: {
    color: colors.textSecondary,
    ...typography.body,
  },
  detailValue: {
    flex: 1,
    color: colors.text,
    textAlign: 'right',
    ...typography.bodyStrong,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  auditSection: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  auditCard: {
    gap: spacing.xs,
  },
  auditHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  auditField: {
    color: colors.text,
    ...typography.bodyStrong,
  },
  auditTime: {
    flex: 1,
    color: colors.textSecondary,
    textAlign: 'right',
    ...typography.caption,
  },
  auditChange: {
    color: colors.primaryDark,
    ...typography.caption,
  },
  auditReason: {
    color: colors.textSecondary,
    ...typography.body,
  },
  errorCard: {
    marginTop: -32,
  },
});

