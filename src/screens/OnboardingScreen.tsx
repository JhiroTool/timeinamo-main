import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import {
  BackHandler, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Screen } from '@/components/ui';
import { recoveredProfileName } from '@/database/recoverMissingProfile';
import { OjtGoalFields, PersonalInformationFields, WorkScheduleFields } from '@/features/setup/SetupFormSections';
import {
  defaultSetupFormValues, maskToWorkdays, setupDataToFormValues, setupSchema, setupStepFields,
  toSaveSetupInput, workdaysToMask,
} from '@/features/setup/setupSchema';
import type { SetupFormValues } from '@/features/setup/setupSchema';
import { useSetup } from '@/features/setup/useSetup';
import { colors, fontFamilies, layout, radius, spacing } from '@/theme';
import { formatScheduleTime, toWorkDate } from '@/utils/time';

const stepCopy = [
  { title: 'Let’s get to know you.', description: 'Start with a few details about yourself.' },
  { title: 'When do you usually work?', description: 'Set your usual schedule. You can change it later.' },
  { title: 'What’s your hour goal?', description: 'Set your target and start tracking your progress.' },
] as const;
const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const stepFade = FadeIn.duration(220).reduceMotion(ReduceMotion.System);
const progressFadeIn = FadeIn.duration(200).reduceMotion(ReduceMotion.System);
const progressFadeOut = FadeOut.duration(200).reduceMotion(ReduceMotion.System);

type SetupStep = 0 | 1 | 2;
type OnboardingPage = 'welcome' | SetupStep;

function StepProgress({ step, onBack, disabled }: { step: SetupStep; onBack: () => void; disabled: boolean }) {
  return (
    <View style={styles.progress}>
      <View style={styles.progressTop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" accessibilityState={{ disabled }}
          disabled={disabled} onPress={onBack}
          style={({ pressed }) => [styles.back, pressed && styles.pressed, disabled && styles.backDisabled]}>
          <ArrowLeft size={18} strokeWidth={2} color={colors.primaryDark} />
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Text accessibilityLabel={`Step ${step + 1} of 3`} accessibilityLiveRegion="polite" style={styles.stepCount}>
          STEP 0{step + 1} / 03
        </Text>
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.segments}>
        {stepCopy.map(({ title }, index) => (
          <View key={title} style={styles.segment}>
            {index <= step ? (
              <Animated.View entering={progressFadeIn} exiting={progressFadeOut} style={styles.segmentActive} />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  return (
    <Animated.View entering={stepFade} style={styles.welcome}>
      <View style={styles.brandLockup}>
        <Image accessible={false} resizeMode="contain"
          source={require('../../assets/images/TI LOGO.png')} style={styles.logo} />
        <Text style={styles.wordmark}>TimeInamo</Text>
      </View>
      <View style={styles.welcomeBody}>
        <Text accessibilityRole="header" style={styles.welcomeTitle}>Your time matters.</Text>
        <Text style={styles.welcomeSubtitle}>Track your workday. See your progress.</Text>
        <Text style={styles.description}>
          Keep track of your working hours, daily accomplishments, and OJT progress—all in one place.
        </Text>
      </View>
      <View style={styles.welcomeFooter}>
        <Button fullWidth icon={ArrowRight} labelStyle={styles.buttonLabel} onPress={onStart} title="Get Started" />
        <Text style={styles.privacy}>Your records stay on this device.</Text>
      </View>
    </Animated.View>
  );
}

function SetupSummary({ control, stacked }: { control: Control<SetupFormValues>; stacked: boolean }) {
  const [workStart, workEnd, timeFormat, workdays, defaultBreakMinutes, requiredHours] = useWatch({
    control, name: ['workStart', 'workEnd', 'timeFormat', 'workdays', 'defaultBreakMinutes', 'requiredHours'],
  });
  const required = Number(requiredHours);
  const days = maskToWorkdays(workdaysToMask(workdays)).map((day) => dayLabels[day]);
  const timeIn = formatScheduleTime(workStart, timeFormat);
  const timeOut = formatScheduleTime(workEnd, timeFormat);
  const items = [
    { label: 'Work schedule', value: `${timeIn} – ${timeOut}` },
    { label: 'Working days', value: days.join(', ') },
    { label: 'Unpaid break', value: `${defaultBreakMinutes} min` },
    { label: 'Required hours', value: required > 0 && Number.isFinite(required)
      ? `${required.toLocaleString('en-US', { maximumFractionDigits: 2 })} h`
      : '—' },
  ];

  return (
    <View style={styles.summary}>
      <Text accessibilityRole="header" style={styles.summaryTitle}>Your setup at a glance</Text>
      {items.map(({ label, value }) => (
        <View key={label} style={[styles.summaryRow, stacked && styles.summaryStacked]}>
          <Text style={styles.summaryLabel}>{label}</Text>
          <Text style={[styles.summaryValue, stacked && styles.summaryValueStacked]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export function OnboardingScreen() {
  const { data, save } = useSetup();
  const [page, setPage] = useState<OnboardingPage>('welcome');
  const [initialValues] = useState<SetupFormValues>(() => {
    if (!data) return defaultSetupFormValues;
    const existing = setupDataToFormValues(data);
    return {
      ...existing,
      fullName: !data.profile.setupCompletedAt && existing.fullName === recoveredProfileName ? '' : existing.fullName,
      requiredHours: existing.requiredHours || defaultSetupFormValues.requiredHours,
    };
  });
  const [customBreak, setCustomBreak] = useState(() => !['0', '30', '60'].includes(initialValues.defaultBreakMinutes));
  const [saveError, setSaveError] = useState('');
  const actionLock = useRef(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const contentWidth = Math.min(width - insets.left - insets.right, 500) - 40;
  const weekdayWidth = 7 * layout.minimumTouchTarget + 6 * 2;
  const {
    control, getValues, setValue, trigger, handleSubmit,
    formState: { errors, isSubmitting, isValidating },
  } = useForm<SetupFormValues>({
    defaultValues: initialValues,
    mode: 'onBlur',
    resolver: zodResolver(setupSchema),
    shouldUnregister: false,
  });
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [page]);

  const goBack = useCallback(() => {
    if (actionLock.current) return true;
    if (page === 'welcome') return false;
    Keyboard.dismiss();
    setSaveError('');
    setPage(page === 2 ? 1 : page === 1 ? 0 : 'welcome');
    return true;
  }, [page]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  }, [goBack]);

  async function continueSetup(step: 0 | 1) {
    if (actionLock.current) return;
    const fields = setupStepFields[step];
    if (!fields) return;

    actionLock.current = true;
    Keyboard.dismiss();
    try {
      if (!(await trigger([...fields]))) return;
      if (step === 1 && !getValues('internshipStartDate')) {
        const localTimezone = new Intl.DateTimeFormat().resolvedOptions().timeZone || defaultSetupFormValues.timezone;
        setValue('internshipStartDate', toWorkDate(new Date(), localTimezone));
      }
      setSaveError('');
      setPage(step === 0 ? 1 : 2);
    } catch {
      setSaveError('Unable to validate this step. Please try again.');
    } finally {
      actionLock.current = false;
    }
  }

  async function finishSetup() {
    if (actionLock.current) return;
    actionLock.current = true;
    Keyboard.dismiss();
    setSaveError('');
    let saved = false;
    try {
      await handleSubmit(
        async (formValues) => {
          await save(toSaveSetupInput(formValues));
          saved = true;
        },
        (invalid) => {
          if (setupStepFields[0]?.some((field) => invalid[field])) setPage(0);
          else if (setupStepFields[1]?.some((field) => invalid[field])) setPage(1);
          else scrollRef.current?.scrollTo({ y: 0, animated: false });
        },
      )();
    } catch {
      setSaveError('Unable to save your setup. Please try again.');
    } finally {
      if (!saved) actionLock.current = false;
    }
  }

  return (
    <Screen contentStyle={[styles.page, page === 'welcome' && styles.welcomePage]}
      includeBottomInset keyboardAware scrollRef={scrollRef}>
      {page === 'welcome' ? (
        <Welcome onStart={() => setPage(0)} />
      ) : (
        <>
          <StepProgress disabled={isSubmitting} onBack={goBack} step={page} />
          <Animated.View entering={stepFade} key={page} style={styles.stepBody}>
            <View style={styles.intro}>
              <Text accessibilityRole="header" style={styles.stepTitle}>{stepCopy[page].title}</Text>
              <Text style={styles.description}>{stepCopy[page].description}</Text>
            </View>

            {page === 0 ? <PersonalInformationFields compact control={control} errors={errors} /> : null}
            {page === 1 ? (
              <WorkScheduleFields
                control={control} customBreak={customBreak} errors={errors} onCustomBreakChange={setCustomBreak}
                stackTimes={contentWidth < 224 * Math.max(1, fontScale)}
                wrapWeekdays={contentWidth < weekdayWidth}
              />
            ) : null}
            {page === 2 ? (
              <>
                <OjtGoalFields control={control} errors={errors} />
                <SetupSummary control={control} stacked={fontScale > 1.35} />
              </>
            ) : null}

            {saveError ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{saveError}</Text> : null}
            {page === 2 ? (
              <Button fullWidth labelStyle={styles.buttonLabel} loading={isSubmitting}
                onPress={() => void finishSetup()} title="Start Using TimeInamo" />
            ) : (
              <Button disabled={isValidating} fullWidth icon={ArrowRight} labelStyle={styles.buttonLabel}
                onPress={() => void continueSetup(page)} title="Continue" />
            )}
          </Animated.View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: { maxWidth: 500, paddingHorizontal: 20, paddingTop: spacing.xs, paddingBottom: spacing.lg },
  welcomePage: { flexGrow: 1, paddingTop: spacing.lg },
  welcome: { flexGrow: 1, justifyContent: 'space-between' },
  brandLockup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logo: { width: 64, height: 64, borderRadius: radius.md },
  wordmark: { flexShrink: 1, color: colors.text, fontFamily: fontFamilies.heading, fontSize: 21, letterSpacing: -0.55 },
  welcomeBody: { flexGrow: 1, justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  welcomeTitle: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 34, letterSpacing: -1.15 },
  welcomeSubtitle: { color: colors.primaryDark, fontFamily: fontFamilies.headingSemibold, fontSize: 18, letterSpacing: -0.3 },
  description: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 22, maxWidth: 365 },
  welcomeFooter: { gap: spacing.sm },
  privacy: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, textAlign: 'center' },
  progress: { gap: spacing.xs },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  back: { minHeight: layout.minimumTouchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backDisabled: { opacity: 0.45 },
  backLabel: { color: colors.primaryDark, fontFamily: fontFamilies.label, fontSize: 14 },
  pressed: { opacity: 0.68 },
  stepCount: {
    flexShrink: 1, textAlign: 'right', color: colors.primaryDark, fontFamily: fontFamilies.label,
    fontSize: 12, letterSpacing: 0.8, fontVariant: ['tabular-nums'],
  },
  segments: { flexDirection: 'row', gap: spacing.xs },
  segment: { flex: 1, height: 4, borderRadius: radius.pill, backgroundColor: colors.border },
  segmentActive: { flex: 1, borderRadius: radius.pill, backgroundColor: colors.primary },
  stepBody: { gap: spacing.lg, marginTop: spacing.lg },
  intro: { gap: spacing.xs },
  stepTitle: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 28, letterSpacing: -0.85 },
  buttonLabel: { color: colors.surface, fontFamily: fontFamilies.label, fontSize: 16, fontWeight: 'normal', flexShrink: 1 },
  summary: { gap: spacing.xs, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.md },
  summaryTitle: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 17, marginBottom: spacing.xxs },
  summaryRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  summaryStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  summaryLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13 },
  summaryValue: { flex: 1, color: colors.text, fontFamily: fontFamilies.label, fontSize: 13, textAlign: 'right' },
  summaryValueStacked: { flex: 0, textAlign: 'left' },
  error: { color: colors.error, backgroundColor: colors.errorSoft, padding: spacing.sm, borderRadius: radius.md,
    fontFamily: fontFamilies.body, fontSize: 14 },
});
