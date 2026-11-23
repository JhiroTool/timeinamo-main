import { useFocusEffect } from 'expo-router';
import { CalendarCheck2, ChartNoAxesColumnIncreasing, CircleCheckBig, Clock3, FileSpreadsheet, TrendingUp } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CircularProgress } from '@/components/CircularProgress';
import { Badge, Button, Card, EmptyState, GradientHeader, LoadingState, MetricCard, Screen, SectionHeader } from '@/components/ui';
import { useOjtInsights } from '@/features/progress/useOjtInsights';
import { AttendanceCsvExportSheet } from '@/features/progress/AttendanceCsvExportSheet';
import { useSetup } from '@/features/setup/useSetup';
import {
  buildRecentWeeklyTotals,
  calculateOjtProgress,
  formatHoursMinutes,
} from '@/services/ojtProgressCalculations.js';
import { colors, radius, spacing, typography } from '@/theme';
import { toWorkDate } from '@/utils/time';

export function ProgressScreen() {
  const [exportVisible, setExportVisible] = useState(false);
  const { data: setup } = useSetup();
  const timezone = setup?.workSettings.timezone ?? 'Asia/Manila';
  const { status, data, error, load } = useOjtInsights(timezone);
  const today = toWorkDate(new Date(), timezone);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const progress = useMemo(() => {
    if (!data || !setup?.profile.requiredMinutes) return null;
    return calculateOjtProgress(
      data.completedSeconds,
      setup.profile.requiredMinutes,
      data.completedWorkdays,
      setup.workSettings.targetMinutes,
    );
  }, [data, setup]);

  const weeklyTotals = useMemo(
    () => (data ? buildRecentWeeklyTotals(data.creditedDays, today, 6) : []),
    [data, today],
  );
  const maxWeeklySeconds = Math.max(1, ...weeklyTotals.map((week) => week.creditedSeconds));
  const hasWeeklyActivity = weeklyTotals.some((week) => week.creditedSeconds > 0);

  function formatWeekLabel(workDate: string): string {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${workDate}T00:00:00.000Z`),
    );
  }

  return (
    <Screen branded>
      <GradientHeader
        compact
        eyebrow="OJT GOAL"
        subtitle="You’re getting closer to your goal"
        title="My Progress"
      />
      <View style={styles.content}>

      {status === 'loading' && !data ? <LoadingState label="Calculating progress…" /> : null}
      {status === 'error' ? (
        <Card style={styles.stateCard}>
          <EmptyState
            action={<Button onPress={() => void load()} title="Try again" />}
            description={error?.message ?? 'Progress could not be calculated.'}
            icon={ChartNoAxesColumnIncreasing}
            title="Progress unavailable"
          />
        </Card>
      ) : null}

      {data && progress && setup?.profile.requiredMinutes ? (
        <>
          {progress.goalCompleted ? (
            <View style={styles.goalBanner}>
              <CircleCheckBig color={colors.success} size={26} />
              <View style={styles.goalCopy}>
                <Text style={styles.goalTitle}>OJT goal completed</Text>
                <Text style={styles.goalText}>
                  Additional completed hours continue to be included in your total.
                </Text>
              </View>
            </View>
          ) : null}

          <Card style={[styles.progressCard, progress.goalCompleted && styles.progressCardAfterBanner]}>
            <CircularProgress percentage={progress.percentage} />
            <View style={styles.progressCopy}>
              <Badge
                label={progress.goalCompleted ? 'Goal reached' : 'In progress'}
                tone={progress.goalCompleted ? 'success' : 'primary'}
              />
              <Text style={styles.completedHours}>{formatHoursMinutes(data.completedSeconds)}</Text>
              <Text style={styles.completedLabel}>completed of {formatHoursMinutes(progress.requiredSeconds)}</Text>
              <Text style={styles.remainingLabel}>
                {formatHoursMinutes(progress.remainingSeconds)} remaining
              </Text>
            </View>
          </Card>

          <View style={styles.statsGrid}>
            <MetricCard
              icon={Clock3}
              label="Completed hours"
              value={formatHoursMinutes(data.completedSeconds)}
            />
            <MetricCard
              icon={ChartNoAxesColumnIncreasing}
              label="Remaining hours"
              value={formatHoursMinutes(progress.remainingSeconds)}
            />
            <MetricCard
              icon={CalendarCheck2}
              label="Completed workdays"
              value={String(data.completedWorkdays)}
            />
            <MetricCard
              icon={TrendingUp}
              label="Average per completed day"
              value={formatHoursMinutes(progress.averageSecondsPerDay)}
            />
          </View>
          <Text style={styles.estimateText}>
            Estimated remaining workdays: {progress.estimatedRemainingWorkdays}. This estimate uses your scheduled credited hours per day.
          </Text>

          <View style={styles.weeklySection}>
            <SectionHeader
              title="Recent weekly hours"
              description="Monday through Sunday · completed credited time only"
            />
            <Card>
              {hasWeeklyActivity ? (
                <View style={styles.chart}>
                  {weeklyTotals.map((week) => (
                    <View key={week.weekStart} style={styles.barRow}>
                      <Text style={styles.weekLabel}>{formatWeekLabel(week.weekStart)}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${(week.creditedSeconds / maxWeeklySeconds) * 100}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.weekValue}>{formatHoursMinutes(week.creditedSeconds)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <EmptyState
                  compact
                  description="Complete an attendance session to begin the weekly trend."
                  icon={ChartNoAxesColumnIncreasing}
                  title="No completed hours yet"
                />
              )}
            </Card>
          </View>

          <Card style={styles.exportCard}>
            <View style={styles.exportIcon}>
              <FileSpreadsheet color={colors.primaryBright} size={25} />
            </View>
            <View style={styles.exportCopy}>
              <Text style={styles.exportTitle}>Export Attendance CSV</Text>
              <Text style={styles.exportDescription}>Save or share your attendance report directly from this device.</Text>
            </View>
            <Button onPress={() => setExportVisible(true)} title="Export" variant="secondary" />
          </Card>
        </>
      ) : null}
      </View>
      <AttendanceCsvExportSheet
        onDismiss={() => setExportVisible(false)}
        visible={exportVisible}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { marginTop: -36 },
  stateCard: {
    marginTop: 0,
  },
  goalBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: 0,
    padding: spacing.md,
    backgroundColor: colors.successSoft,
    borderRadius: radius.lg,
  },
  goalCopy: {
    flex: 1,
  },
  goalTitle: {
    color: colors.success,
    ...typography.bodyStrong,
  },
  goalText: {
    marginTop: spacing.xxs,
    color: colors.textSecondary,
    ...typography.caption,
  },
  progressCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: 0,
  },
  progressCardAfterBanner: { marginTop: spacing.md },
  progressCopy: {
    minWidth: 210,
    flex: 1,
  },
  completedHours: {
    marginTop: spacing.md,
    color: colors.text,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  completedLabel: {
    color: colors.textSecondary,
    ...typography.body,
  },
  remainingLabel: {
    marginTop: spacing.sm,
    color: colors.primaryDark,
    ...typography.bodyStrong,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  estimateText: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    ...typography.caption,
  },
  weeklySection: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  chart: {
    gap: spacing.md,
  },
  barRow: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weekLabel: {
    width: 48,
    color: colors.textSecondary,
    ...typography.caption,
  },
  barTrack: {
    height: 12,
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
  },
  barFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  weekValue: {
    width: 70,
    color: colors.text,
    textAlign: 'right',
    ...typography.label,
    fontVariant: ['tabular-nums'],
  },
  exportCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  exportIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
  },
  exportCopy: { minWidth: 180, flex: 1 },
  exportTitle: { color: colors.text, ...typography.subheading },
  exportDescription: { marginTop: spacing.xxs, color: colors.textSecondary, ...typography.caption },
});

