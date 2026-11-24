import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { CircleCheck, Download } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircularProgress } from '@/components/CircularProgress';
import { Button, Screen } from '@/components/ui';
import { AttendanceCsvExportSheet } from '@/features/progress/AttendanceCsvExportSheet';
import { WeeklyActivity } from '@/features/progress/WeeklyActivity';
import { useOjtInsights } from '@/features/progress/useOjtInsights';
import { useSetup } from '@/features/setup/useSetup';
import { buildRecentWeeklyTotals, calculateOjtProgress, formatProgressHours } from '@/services/ojtProgressCalculations.js';
import { colors, fontFamilies, layout, radius, spacing } from '@/theme';
import { toWorkDate } from '@/utils/time';

const buttonLabel = { fontFamily: fontFamilies.label, fontSize: 14, fontWeight: 'normal' } as const;

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);

  useEffect(() => {
    let subscribed = true;
    let receivedChange = false;
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      receivedChange = true;
      setReducedMotion(enabled);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (subscribed && !receivedChange) setReducedMotion(enabled);
    }).catch(() => {
      if (subscribed && !receivedChange) setReducedMotion(true);
    });
    return () => {
      subscribed = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

function CreditedHours({ seconds, animate, compact }: {
  seconds: number;
  animate: boolean;
  compact: boolean;
}) {
  const [display, setDisplay] = useState(() => formatProgressHours(seconds));
  const [counter] = useState(() => new Animated.Value(seconds));
  const previousTarget = useRef(seconds);

  useEffect(() => {
    if (!animate) {
      counter.setValue(seconds);
      setDisplay(formatProgressHours(seconds));
      previousTarget.current = seconds;
      return;
    }
    if (previousTarget.current === seconds) return;

    previousTarget.current = seconds;
    const listener = counter.addListener(({ value }) => setDisplay(formatProgressHours(value)));
    const animation = Animated.timing(counter, {
      duration: 450,
      easing: Easing.out(Easing.cubic),
      toValue: seconds,
      // Only this text updates while the native SVG arc animates independently.
      useNativeDriver: false,
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished) setDisplay(formatProgressHours(seconds));
    });

    return () => {
      counter.removeListener(listener);
      animation.stop();
    };
  }, [animate, counter, seconds]);

  return (
    <Text
      accessibilityLabel={`${formatProgressHours(seconds)} credited hours`}
      adjustsFontSizeToFit
      numberOfLines={1}
      style={[styles.heroHours, compact && styles.heroHoursCompact]}
    >
      {display}<Text style={styles.hoursUnit}> h</Text>
    </Text>
  );
}

function ProgressMetric({ label, value, divided }: { label: string; value: string; divided?: boolean }) {
  return (
    <View style={[styles.metric, divided && styles.metricDivided]}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.support}>{label}</Text>
    </View>
  );
}

function ProgressSkeleton() {
  return (
    <View accessibilityLabel="Loading progress" accessibilityRole="progressbar" accessible>
      <View style={[styles.hero, styles.skeletonHero]}>
        <View style={styles.heroCopy}>
          <View style={[styles.skeleton, styles.skeletonLabel]} />
          <View style={[styles.skeleton, styles.skeletonHours]} />
          <View style={[styles.skeleton, styles.skeletonLabel]} />
        </View>
        <View style={styles.skeletonRing} />
      </View>
      <View style={styles.skeletonStats}>
        <View style={[styles.skeleton, styles.skeletonMetric]} />
        <View style={[styles.skeleton, styles.skeletonMetric]} />
        <View style={[styles.skeleton, styles.skeletonMetric]} />
        <View style={[styles.skeleton, styles.skeletonMetric]} />
      </View>
    </View>
  );
}

export function ProgressScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [exportVisible, setExportVisible] = useState(false);
  const { data: setup, status: setupStatus, refresh: refreshSetup } = useSetup();
  const schedule = setup?.workSettings;
  const timezone = schedule?.timezone ?? 'Asia/Manila';
  const { status, data, load } = useOjtInsights(timezone);
  const today = toWorkDate(new Date(), timezone);
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(width - insets.left - insets.right, layout.maxContentWidth) - 40;
  const reducedMotion = useReducedMotionPreference();

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const requiredMinutes = setup?.profile.requiredMinutes;
  const scheduledMinutes = schedule
    ? schedule.workEndMinutes - schedule.workStartMinutes - schedule.defaultBreakMinutes
    : 0;
  const validSchedule = Boolean(schedule?.workdaysMask)
    && Number.isSafeInteger(scheduledMinutes) && scheduledMinutes > 0;

  const progress = useMemo(() => {
    if (!data || !requiredMinutes) return null;
    return calculateOjtProgress(
      data.completedSeconds,
      requiredMinutes,
      data.completedWorkdays,
      validSchedule ? scheduledMinutes : null,
    );
  }, [data, requiredMinutes, scheduledMinutes, validSchedule]);

  const weeklyTotals = useMemo(
    () => data ? buildRecentWeeklyTotals(data.creditedDays, today) : [],
    [data, today],
  );

  const stackedHero = contentWidth < 120 + 142 * Math.max(1, fontScale);
  const ringSize = stackedHero ? Math.max(112, Math.min(160, 100 * fontScale)) : 116;
  const loading = (!data && status === 'loading') || (!setup && setupStatus === 'loading');
  const loadFailed = status === 'error' || setupStatus === 'error';
  const openSettings = () => router.navigate('/settings');

  return (
    <Screen contentStyle={styles.page}>
      {isFocused ? <StatusBar style="dark" /> : null}
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.title}>Your Progress</Text>
        <Text style={styles.body}>Every hour brings you closer.</Text>
      </View>

      {loadFailed ? (
        <View style={styles.notice}>
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={styles.noticeTitle}>
            {data ? 'Progress could not be refreshed' : 'Progress unavailable'}
          </Text>
          <Text style={styles.body}>
            {data ? 'Showing the most recently loaded records.' : 'Your progress could not be loaded. Please try again.'}
          </Text>
          <Button
            labelStyle={buttonLabel}
            onPress={() => {
              if (setupStatus === 'error') void refreshSetup();
              void load();
            }}
            style={styles.inlineButton}
            title="Retry"
            variant="outline"
          />
        </View>
      ) : null}

      {loading && !loadFailed ? <ProgressSkeleton /> : null}

      {data && !loading ? (
        <>
          <View style={styles.hero}>
            <View style={[styles.heroMain, stackedHero && styles.heroMainStacked]}>
              <View style={[styles.heroCopy, stackedHero && styles.heroCopyStacked]}>
                <Text style={styles.heroLabel}>Credited hours</Text>
                <CreditedHours
                  animate={isFocused && reducedMotion === false}
                  compact={contentWidth < 330 && !stackedHero}
                  seconds={data.completedSeconds}
                />
                <Text style={styles.body}>
                  {progress ? `of ${formatProgressHours(progress.requiredSeconds)} h required` : 'Set your required hours in Settings'}
                </Text>
              </View>
              {progress ? (
                <CircularProgress active={isFocused} percentage={progress.percentage} reducedMotion={reducedMotion} size={ringSize} />
              ) : null}
            </View>
            {progress ? (
              <View style={[styles.heroFooter, progress.goalCompleted && styles.heroFooterSuccess]}>
                {progress.goalCompleted ? <CircleCheck color={colors.success} size={18} strokeWidth={2} /> : null}
                <Text style={[styles.heroFooterText, progress.goalCompleted && styles.successText]}>
                  {progress.goalCompleted
                    ? 'Goal Completed'
                    : `${formatProgressHours(progress.remainingSeconds)} hours remaining`}
                </Text>
              </View>
            ) : null}
          </View>

          {data.completedWorkdays === 0 ? (
            <View style={styles.notice}>
              <Text accessibilityRole="header" style={styles.noticeTitle}>Your progress starts here</Text>
              <Text style={styles.body}>Complete your first work session to start tracking your hours.</Text>
              <Button
                labelStyle={buttonLabel}
                onPress={() => router.navigate('/')}
                style={styles.inlineButton}
                title="Go to Home"
                variant="outline"
              />
            </View>
          ) : null}

          <View style={styles.stats}>
            <View style={styles.statsRow}>
              <ProgressMetric label="Completed workdays" value={String(data.completedWorkdays)} />
              <ProgressMetric
                divided
                label="Average hours / day"
                value={`${formatProgressHours(progress?.averageSecondsPerDay ?? (data.completedWorkdays
                  ? data.completedSeconds / data.completedWorkdays
                  : 0))} h`}
              />
            </View>
            <View style={[styles.statsRow, styles.statsDivider]}>
              <ProgressMetric
                label="Required hours"
                value={progress ? `${formatProgressHours(progress.requiredSeconds)} h` : 'Not set'}
              />
              <ProgressMetric
                divided
                label="Remaining hours"
                value={progress ? `${formatProgressHours(progress.remainingSeconds)} h` : 'Not set'}
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>Weekly Activity</Text>
              <Text style={styles.body}>Your working hours over time</Text>
            </View>
            <WeeklyActivity dateFormat={schedule?.dateFormat ?? 'mdy'} fontScale={fontScale} weeks={weeklyTotals} />
          </View>

          <View style={[styles.section, styles.dividedSection]}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Completion Estimate</Text>
            {progress?.goalCompleted ? (
              <Text style={styles.body}>Your required hours are complete.</Text>
            ) : progress?.estimatedRemainingWorkdays != null ? (
              <>
                <Text style={styles.estimate}>
                  {progress.estimatedRemainingWorkdays.toLocaleString('en-US')}
                  <Text style={styles.estimateLabel}>
                    {progress.estimatedRemainingWorkdays === 1 ? ' working day remaining' : ' working days remaining'}
                  </Text>
                </Text>
                <Text style={styles.body}>Based on your current work schedule.</Text>
              </>
            ) : (
              <>
                <Text style={styles.body}>
                  {progress ? 'Set your work schedule to see an estimate.' : 'Set your required hours and work schedule to see an estimate.'}
                </Text>
                <Button
                  labelStyle={buttonLabel}
                  onPress={openSettings}
                  style={styles.inlineButton}
                  title="Open Settings"
                  variant="outline"
                />
              </>
            )}
          </View>
        </>
      ) : null}

      {data && !loading ? (
        <View style={[styles.section, styles.dividedSection]}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Attendance Report</Text>
          <Text style={styles.body}>Export your work records for personal review or OJT documentation.</Text>
          <Button
            icon={Download}
            labelStyle={buttonLabel}
            onPress={() => setExportVisible(true)}
            style={styles.inlineButton}
            title="Export CSV"
            variant="outline"
          />
        </View>
      ) : null}
      <AttendanceCsvExportSheet onDismiss={() => setExportVisible(false)} visible={exportVisible} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.xxs, marginBottom: 20 },
  title: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 26, letterSpacing: -0.7 },
  body: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 14 },
  support: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13 },
  hero: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heroMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  heroMainStacked: { flexDirection: 'column', alignItems: 'flex-start', padding: 20 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroCopyStacked: { flex: 0, width: '100%' },
  heroLabel: { color: colors.primaryDark, fontFamily: fontFamilies.label, fontSize: 13 },
  heroHours: {
    color: colors.text,
    fontFamily: fontFamilies.heading,
    fontSize: 44,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.8,
    width: '100%',
  },
  heroHoursCompact: { fontSize: 40, letterSpacing: -1.4 },
  hoursUnit: { color: colors.textSecondary, fontFamily: fontFamilies.headingSemibold, fontSize: 22, letterSpacing: 0 },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: '#F0FAF8',
  },
  heroFooterSuccess: { backgroundColor: colors.successSoft },
  heroFooterText: { flexShrink: 1, color: colors.primaryDark, fontFamily: fontFamilies.label, fontSize: 13 },
  successText: { color: colors.success },
  notice: { marginTop: spacing.md, gap: spacing.xxs },
  noticeTitle: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 16 },
  stats: { marginTop: 20, borderBottomWidth: 1, borderTopWidth: 1, borderColor: colors.border },
  statsRow: { flexDirection: 'row', paddingVertical: spacing.sm },
  statsDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  metric: { flex: 1, minWidth: 0, gap: spacing.xxs, paddingRight: spacing.sm },
  metricDivided: { paddingLeft: spacing.md, paddingRight: 0, borderLeftWidth: 1, borderLeftColor: colors.border },
  metricValue: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 23, fontVariant: ['tabular-nums'] },
  section: { marginTop: spacing.lg, gap: spacing.xs },
  sectionHeader: { gap: spacing.xxs },
  sectionTitle: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 18 },
  dividedSection: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  estimate: { color: colors.primaryDark, fontFamily: fontFamilies.heading, fontSize: 28, fontVariant: ['tabular-nums'] },
  estimateLabel: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 17 },
  inlineButton: { alignSelf: 'flex-start', maxWidth: '100%', marginTop: spacing.xs, paddingHorizontal: spacing.md },
  skeletonHero: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, alignItems: 'center' },
  skeleton: { backgroundColor: colors.border, borderRadius: radius.sm },
  skeletonLabel: { width: '65%', height: 11 },
  skeletonHours: { width: '88%', height: 34, marginVertical: spacing.sm },
  skeletonRing: { width: 108, height: 108, borderRadius: 54, borderWidth: 8, borderColor: colors.border },
  skeletonStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  skeletonMetric: { width: '45%', height: 30 },
});
