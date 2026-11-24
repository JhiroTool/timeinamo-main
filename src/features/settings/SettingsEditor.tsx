import { zodResolver } from '@hookform/resolvers/zod';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Keyboard, Modal, StyleSheet, Text, View } from 'react-native';

import { Button, Screen, TextField } from '@/components/ui';
import type { SetupData, SaveSetupInput } from '@/database/repositories';
import { ChoiceSelector } from '@/features/setup/ChoiceSelector';
import { DateTimeField } from '@/features/setup/DateTimeField';
import { PersonalInformationFields } from '@/features/setup/SetupFormSections';
import { setupDataToFormValues, setupSchema, toSaveSetupInput } from '@/features/setup/setupSchema';
import type { SetupFormValues } from '@/features/setup/setupSchema';
import { WeekdaySelector } from '@/features/setup/WeekdaySelector';
import { colors, fontFamilies, spacing } from '@/theme';

export const settingTitles = {
  profile: 'Edit profile',
  requiredHours: 'OJT Target',
  internshipStartDate: 'Internship Start Date',
  schedule: 'Work Schedule',
  workdays: 'Working Days',
  defaultBreakMinutes: 'Default Unpaid Break',
  timezone: 'Timezone',
  timeFormat: 'Time Format',
  dateFormat: 'Date Format',
} as const;

export type SettingEditor = keyof typeof settingTitles;

const timeChoices = [
  { label: '12-hour', value: '12h' },
  { label: '24-hour', value: '24h' },
] as const;
const dateChoices = [
  { label: 'Month / Day / Year', value: 'mdy' },
  { label: 'Day / Month / Year', value: 'dmy' },
  { label: 'Year / Month / Day', value: 'ymd' },
] as const;
export const dateFormatLabels = {
  mdy: dateChoices[0].label,
  dmy: dateChoices[1].label,
  ymd: dateChoices[2].label,
} as const;

const textFields = {
  requiredHours: { label: 'Required OJT hours', keyboardType: 'decimal-pad' },
  defaultBreakMinutes: { label: 'Break duration in minutes', keyboardType: 'number-pad' },
  timezone: { label: 'Timezone', keyboardType: 'default' },
} as const;

export function SettingsEditor({ editor, data, save, onClose, onSaved }: {
  editor: SettingEditor;
  data: SetupData;
  save: (input: SaveSetupInput) => Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [discardVisible, setDiscardVisible] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  const { control, handleSubmit, formState: { isDirty, isSubmitting, errors } } = useForm<SetupFormValues>({
    defaultValues: setupDataToFormValues(data),
    mode: 'onBlur',
    resolver: zodResolver(setupSchema),
  });

  function requestClose() {
    if (saving.current) return;
    Keyboard.dismiss();
    if (discardVisible) setDiscardVisible(false);
    else if (isDirty) setDiscardVisible(true);
    else onClose();
  }

  async function submit() {
    if (saving.current) return;
    saving.current = true;
    Keyboard.dismiss();
    setError('');
    try {
      await handleSubmit(async (values) => {
        await save(toSaveSetupInput(values));
        onSaved();
      }, (invalid) => {
        const relevantFields = editor === 'profile'
          ? ['fullName', 'companyName', 'jobTitle'] as const
          : editor === 'schedule'
            ? ['workStart', 'workEnd', 'defaultBreakMinutes'] as const
            : [editor];
        const hasVisibleError = relevantFields.some((name) => invalid[name]);
        if (!hasVisibleError) setError('Review your other settings before saving this change.');
      })();
    } catch {
      setError('Unable to save changes. Please try again.');
    } finally {
      saving.current = false;
    }
  }

  function renderFields() {
    switch (editor) {
      case 'profile':
        return <PersonalInformationFields control={control} errors={errors} inputStyle={styles.input} />;
      case 'schedule':
        return (
          <>
            <Controller control={control} name="workStart" render={({ field }) => (
              <DateTimeField label="Scheduled time in" mode="time" value={field.value}
                onChange={field.onChange} onBlur={field.onBlur} timeFormat={data.workSettings.timeFormat}
                error={errors.workStart?.message} />
            )} />
            <Controller control={control} name="workEnd" render={({ field }) => (
              <DateTimeField label="Scheduled time out" mode="time" value={field.value}
                onChange={field.onChange} onBlur={field.onBlur} timeFormat={data.workSettings.timeFormat}
                error={errors.workEnd?.message ?? errors.defaultBreakMinutes?.message} />
            )} />
          </>
        );
      case 'internshipStartDate':
        return <Controller control={control} name={editor} render={({ field }) => (
          <DateTimeField label="Internship start date" mode="date" value={field.value} onChange={field.onChange}
            onBlur={field.onBlur} dateFormat={data.workSettings.dateFormat} error={errors[editor]?.message} />
        )} />;
      case 'workdays':
        return <Controller control={control} name={editor} render={({ field }) => (
          <WeekdaySelector value={field.value} onChange={field.onChange} onBlur={field.onBlur} error={errors[editor]?.message} />
        )} />;
      case 'timeFormat':
        return <Controller control={control} name={editor} render={({ field }) => (
          <ChoiceSelector choices={timeChoices} label="Time format" value={field.value} onChange={field.onChange} />
        )} />;
      case 'dateFormat':
        return <Controller control={control} name={editor} render={({ field }) => (
          <ChoiceSelector choices={dateChoices} label="Date format" value={field.value} onChange={field.onChange} />
        )} />;
      default:
        return <Controller control={control} name={editor} render={({ field }) => (
          <TextField {...textFields[editor]} autoCapitalize="none" autoCorrect={false}
            editable={!isSubmitting} style={styles.input} value={field.value} onChangeText={field.onChange}
            onBlur={field.onBlur} error={errors[editor]?.message}
            helperText={editor === 'timezone' ? 'Use an IANA timezone such as Asia/Manila.'
              : editor === 'defaultBreakMinutes' ? 'This default applies to future work sessions.' : undefined} />
        )} />;
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={requestClose} presentationStyle="fullScreen" statusBarTranslucent>
      <Screen contentStyle={styles.page} includeBottomInset keyboardAware>
        <StatusBar style="dark" />
        {discardVisible ? (
          <View style={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>Discard unsaved changes?</Text>
            <Text style={styles.body}>Your edits will be lost if you leave this editor.</Text>
            <View style={styles.actions}>
              <Button fullWidth labelStyle={styles.buttonLabel} onPress={() => setDiscardVisible(false)} title="Keep editing" />
              <Button fullWidth labelStyle={styles.buttonLabel} onPress={onClose} title="Discard changes" variant="outline" />
            </View>
          </View>
        ) : (
          <View style={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>{settingTitles[editor]}</Text>
            {renderFields()}
            {error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <Button disabled={!isDirty} fullWidth labelStyle={styles.buttonLabel} loading={isSubmitting}
                onPress={() => void submit()} title="Save changes" />
              <Button disabled={isSubmitting} fullWidth labelStyle={styles.buttonLabel}
                onPress={requestClose} title="Cancel" variant="ghost" />
            </View>
          </View>
        )}
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingTop: spacing.lg },
  content: { gap: spacing.md },
  title: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 26, letterSpacing: -0.65 },
  body: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 14 },
  input: { fontFamily: fontFamilies.body, fontWeight: 'normal' },
  actions: { gap: spacing.xs, marginTop: spacing.xs },
  buttonLabel: { flexShrink: 1, fontFamily: fontFamilies.label, fontWeight: 'normal' },
  error: { color: colors.error, fontFamily: fontFamilies.body, fontSize: 14 },
});
