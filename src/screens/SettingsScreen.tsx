import { zodResolver } from '@hookform/resolvers/zod';
import Constants from 'expo-constants';
import { usePreventRemove, useRouter } from 'expo-router';
import { FileSpreadsheet, Save, Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Dialog, GradientHeader, Screen, SectionHeader } from '@/components/ui';
import {
  OjtGoalFields,
  PersonalInformationFields,
  WorkScheduleFields,
} from '@/features/setup/SetupFormSections';
import {
  defaultSetupFormValues,
  setupDataToFormValues,
  setupSchema,
  toSaveSetupInput,
  type SetupFormValues,
} from '@/features/setup/setupSchema';
import { useSetup } from '@/features/setup/useSetup';
import { colors, radius, spacing, typography } from '@/theme';

export function SettingsScreen() {
  const router = useRouter();
  const { data, save, deleteAllLocalData } = useSetup();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [allowExit, setAllowExit] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<(() => void) | null>(null);
  const {
    control,
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    reset,
  } = useForm<SetupFormValues>({
    defaultValues: data ? setupDataToFormValues(data) : defaultSetupFormValues,
    mode: 'onBlur',
    resolver: zodResolver(setupSchema),
  });

  useEffect(() => {
    if (data) reset(setupDataToFormValues(data));
  }, [data, reset]);

  usePreventRemove(isDirty && !allowExit, ({ repeat }) => {
    setPendingNavigation(() => repeat);
  });

  const saveChanges = handleSubmit(async (values) => {
    setSaveError(null);
    setSaveMessage(null);
    try {
      await save(toSaveSetupInput(values));
      reset(values);
      setSaveMessage('Changes saved on this device.');
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Changes could not be saved.');
    }
  });

  async function confirmDelete() {
    setDeleting(true);
    setSaveError(null);
    try {
      setAllowExit(true);
      await deleteAllLocalData();
      setDeleteDialogVisible(false);
    } catch (reason) {
      setAllowExit(false);
      setDeleteDialogVisible(false);
      setSaveError(reason instanceof Error ? reason.message : 'Local data could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  function discardAndContinue() {
    if (data) reset(setupDataToFormValues(data));
    const repeat = pendingNavigation;
    setPendingNavigation(null);
    setAllowExit(true);
    setTimeout(() => repeat?.(), 0);
  }

  return (
    <Screen branded keyboardAware>
      <GradientHeader
        compact
        eyebrow="TIMEINAMO"
        subtitle="Manage your TimeInamo preferences"
        title="Settings"
      />
      <View style={styles.content}>

      <View style={styles.section}>
        <SectionHeader title="Personal information" description="Your OJT identity and establishment" />
        <Card>
          <PersonalInformationFields control={control} errors={errors} />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Work schedule" description="Defaults for future attendance sessions" />
        <Card>
          <WorkScheduleFields control={control} errors={errors} />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="OJT goal & preferences" description="Target hours, timezone, date, and time" />
        <Card>
          <OjtGoalFields control={control} errors={errors} />
        </Card>
      </View>

      {saveError ? (
        <View accessibilityLiveRegion="assertive" style={[styles.message, styles.errorMessage]}>
          <Text style={styles.errorText}>{saveError}</Text>
        </View>
      ) : null}
      {saveMessage ? (
        <View accessibilityLiveRegion="polite" style={[styles.message, styles.successMessage]}>
          <Text style={styles.successText}>{saveMessage}</Text>
        </View>
      ) : null}

      <Button
        fullWidth
        icon={Save}
        loading={isSubmitting}
        onPress={() => void saveChanges()}
        title="Save changes"
      />

      <View style={styles.section}>
        <SectionHeader title="Data management" description="Export or remove local records" />
        <Card>
          <Button
            fullWidth
            icon={FileSpreadsheet}
            onPress={() => router.push('/progress')}
            title="Export Attendance CSV"
            variant="outline"
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="About" />
        <Card style={styles.aboutCard}>
          <Text style={styles.aboutLabel}>TimeInamo version</Text>
          <Text style={styles.aboutValue}>{Constants.expoConfig?.version ?? 'Unavailable'}</Text>
        </Card>
      </View>

      <View style={styles.dangerSection}>
        <SectionHeader
          title="Delete local data"
          description="Permanently removes your profile, settings, attendance, corrections, and journal"
        />
        <Button
          fullWidth
          icon={Trash2}
          onPress={() => setDeleteDialogVisible(true)}
          title="Delete all local data"
          variant="danger"
        />
      </View>
      </View>

      <Dialog
        actions={
          <>
            <Button
              disabled={deleting}
              onPress={() => setDeleteDialogVisible(false)}
              title="Cancel"
              variant="ghost"
            />
            <Button
              loading={deleting}
              onPress={() => void confirmDelete()}
              title="Delete everything"
              variant="danger"
            />
          </>
        }
        description="This cannot be undone. All TimeInamo data stored on this device will be permanently deleted."
        onDismiss={() => {
          if (!deleting) setDeleteDialogVisible(false);
        }}
        title="Delete all local data?"
        visible={deleteDialogVisible}
      />

      <Dialog
        actions={
          <>
            <Button
              onPress={() => setPendingNavigation(null)}
              title="Keep editing"
              variant="ghost"
            />
            <Button onPress={discardAndContinue} title="Discard changes" variant="danger" />
          </>
        }
        description="You have changes that have not been saved to this device."
        onDismiss={() => setPendingNavigation(null)}
        title="Discard unsaved changes?"
        visible={pendingNavigation !== null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    marginTop: -28,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  section: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  message: {
    marginVertical: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  errorMessage: {
    backgroundColor: colors.errorSoft,
  },
  successMessage: {
    backgroundColor: colors.successSoft,
  },
  errorText: {
    color: colors.error,
    ...typography.body,
  },
  successText: {
    color: colors.success,
    ...typography.body,
  },
  aboutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
  },
  aboutLabel: {
    color: colors.text,
    ...typography.body,
  },
  aboutValue: {
    color: colors.textSecondary,
    ...typography.bodyStrong,
  },
  dangerSection: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
});

