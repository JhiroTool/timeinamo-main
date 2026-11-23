import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronRight } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { BackHandler, StyleSheet, Text, View } from 'react-native';

import { AppHeader, Badge, Button, Card, Screen } from '@/components/ui';
import {
  OjtGoalFields,
  PersonalInformationFields,
  WorkScheduleFields,
} from '@/features/setup/SetupFormSections';
import {
  defaultSetupFormValues,
  setupSchema,
  setupStepFields,
  toSaveSetupInput,
  type SetupFormValues,
} from '@/features/setup/setupSchema';
import { useSetup } from '@/features/setup/useSetup';
import { colors, radius, spacing, typography } from '@/theme';

const stepCopy = [
  { title: 'Personal information', description: 'Tell us who this workspace belongs to.' },
  { title: 'Work schedule', description: 'Set the defaults for your regular workday.' },
  { title: 'OJT goal', description: 'Define your internship target and preferences.' },
] as const;

const dayLabels: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

export function OnboardingScreen() {
  const { save } = useSetup();
  const [step, setStep] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    trigger,
    watch,
  } = useForm<SetupFormValues>({
    defaultValues: defaultSetupFormValues,
    mode: 'onBlur',
    resolver: zodResolver(setupSchema),
    shouldUnregister: false,
  });
  const values = watch();

  const goBack = useCallback(() => {
    if (step === 0) return false;
    setSaveError(null);
    setStep((current) => current - 1);
    return true;
  }, [step]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  }, [goBack]);

  async function goNext() {
    const fields = setupStepFields[step];
    if (!fields) return;
    const valid = await trigger([...fields]);
    if (valid) {
      setSaveError(null);
      setStep((current) => Math.min(current + 1, 2));
    }
  }

  const completeSetup = handleSubmit(async (formValues) => {
    setSaveError(null);
    try {
      await save(toSaveSetupInput(formValues));
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Setup could not be saved.');
    }
  });

  return (
    <Screen includeBottomInset keyboardAware>
      <AppHeader onBack={step > 0 ? goBack : undefined} title="Set up TimeInamo" />

      <View style={styles.progress}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[styles.progressBar, index <= step && styles.progressBarActive]}
          />
        ))}
      </View>

      <View style={styles.intro}>
        <Badge label={`Step ${step + 1} of 3`} tone="primary" />
        <Text style={styles.title}>{stepCopy[step]?.title}</Text>
        <Text style={styles.description}>{stepCopy[step]?.description}</Text>
      </View>

      <Card style={styles.formCard}>
        {step === 0 ? <PersonalInformationFields control={control} errors={errors} /> : null}
        {step === 1 ? <WorkScheduleFields control={control} errors={errors} /> : null}
        {step === 2 ? (
          <>
            <OjtGoalFields control={control} errors={errors} />
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>Setup summary</Text>
              <SummaryRow label="Name" value={values.fullName || 'Not entered'} />
              <SummaryRow label="Establishment" value={values.companyName || 'Not entered'} />
              <SummaryRow label="Schedule" value={`${values.workStart}–${values.workEnd}`} />
              <SummaryRow
                label="Working days"
                value={values.workdays.map((day) => dayLabels[day]).join(', ')}
              />
              <SummaryRow label="Required hours" value={`${values.requiredHours} hours`} />
              <SummaryRow label="Timezone" value={values.timezone} />
            </View>
          </>
        ) : null}
      </Card>

      {saveError ? (
        <View accessibilityLiveRegion="assertive" style={styles.errorBanner}>
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        {step < 2 ? (
          <Button
            fullWidth
            icon={ChevronRight}
            onPress={() => void goNext()}
            title="Continue"
          />
        ) : (
          <Button
            fullWidth
            icon={Check}
            loading={isSubmitting}
            onPress={() => void completeSetup()}
            title="Finish setup"
          />
        )}
        {step > 0 ? <Button onPress={goBack} title="Back" variant="ghost" /> : null}
      </View>
      <Text style={styles.privacy}>Your setup is saved only on this device.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  progressBar: {
    height: 4,
    flex: 1,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
  },
  progressBarActive: {
    backgroundColor: colors.primary,
  },
  intro: {
    marginTop: spacing.lg,
  },
  title: {
    marginTop: spacing.md,
    color: colors.text,
    ...typography.title,
  },
  description: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    ...typography.body,
  },
  formCard: {
    marginTop: spacing.lg,
  },
  summary: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  summaryTitle: {
    marginBottom: spacing.xs,
    color: colors.text,
    ...typography.subheading,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  summaryLabel: {
    color: colors.textSecondary,
    ...typography.caption,
  },
  summaryValue: {
    flex: 1,
    color: colors.text,
    textAlign: 'right',
    ...typography.label,
  },
  errorBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.errorSoft,
    borderRadius: radius.md,
  },
  errorText: {
    color: colors.error,
    ...typography.body,
  },
  footer: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  privacy: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    ...typography.caption,
  },
});

