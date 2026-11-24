import { Building2, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, TextStyle } from 'react-native';

import { TextField } from '@/components/ui';
import { formatAttendanceHours } from '@/features/attendance/attendancePresentation';
import { colors, fontFamilies, layout, radius, spacing } from '@/theme';

import { ChoiceSelector } from './ChoiceSelector';
import { DateTimeField } from './DateTimeField';
import { scheduledCreditedMinutes, timeToMinutes } from './setupSchema';
import type { SetupFormValues } from './setupSchema';
import { WeekdaySelector } from './WeekdaySelector';

interface FormSectionProps {
  control: Control<SetupFormValues>;
  errors: FieldErrors<SetupFormValues>;
}

export function PersonalInformationFields({ control, errors, inputStyle, compact = false }: FormSectionProps & {
  inputStyle?: StyleProp<TextStyle>;
  compact?: boolean;
}) {
  return (
    <View style={compact ? styles.fields : styles.profileFields}>
      <Controller
        control={control}
        name="fullName"
        render={({ field }) => (
          <TextField
            autoCapitalize="words"
            compact={compact}
            error={errors.fullName?.message}
            {...(compact ? { autoComplete: 'name' } as const : { icon: UserRound, returnKeyType: 'next' } as const)}
            label="Full name"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Enter your full name"
            style={inputStyle}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="companyName"
        render={({ field }) => (
          <TextField
            autoCapitalize="words"
            compact={compact}
            error={errors.companyName?.message}
            {...(!compact ? { icon: Building2 } : {})}
            label="Company / OJT establishment"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder={compact ? 'Where are you working?' : 'Enter establishment name'}
            style={inputStyle}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="jobTitle"
        render={({ field }) => (
          <TextField
            autoCapitalize="words"
            compact={compact}
            error={errors.jobTitle?.message}
            label="Department or position (optional)"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder={compact ? 'e.g. IT Intern' : 'e.g. Information Technology'}
            style={inputStyle}
            value={field.value}
          />
        )}
      />
    </View>
  );
}

const breakChoices = [
  { label: '0 min', value: '0' },
  { label: '30 min', value: '30' },
  { label: '60 min', value: '60' },
  { label: 'Custom', value: 'custom' },
] as const;
const timeChoices = [
  { label: '12-hour', value: '12h' },
  { label: '24-hour', value: '24h' },
] as const;
const dateChoices = [
  { label: 'Month / Day / Year', value: 'mdy' },
  { label: 'Day / Month / Year', value: 'dmy' },
  { label: 'Year / Month / Day', value: 'ymd' },
] as const;

export function WorkScheduleFields({
  control, errors, stackTimes, wrapWeekdays, customBreak, onCustomBreakChange,
}: FormSectionProps & {
  stackTimes: boolean;
  wrapWeekdays: boolean;
  customBreak: boolean;
  onCustomBreakChange: (custom: boolean) => void;
}) {
  const [workStart, workEnd, breakMinutes, timeFormat] = useWatch({
    control, name: ['workStart', 'workEnd', 'defaultBreakMinutes', 'timeFormat'],
  });
  const minutes = scheduledCreditedMinutes(timeToMinutes(workStart), timeToMinutes(workEnd), Number(breakMinutes));
  const showPreview = /^\d+$/.test(breakMinutes) && Number(breakMinutes) <= 720 && minutes > 0;

  return (
    <View style={styles.fields}>
      <View style={[styles.times, stackTimes && styles.timesStacked]}>
        <View style={stackTimes ? styles.timeFieldStacked : styles.timeField}>
          <Controller control={control} name="workStart" render={({ field }) => (
            <DateTimeField compact error={errors.workStart?.message} label="Time In" mode="time"
              onBlur={field.onBlur} onChange={field.onChange} timeFormat={timeFormat} value={field.value} />
          )} />
        </View>
        <View style={stackTimes ? styles.timeFieldStacked : styles.timeField}>
          <Controller control={control} name="workEnd" render={({ field }) => (
            <DateTimeField compact error={errors.workEnd?.message} label="Time Out" mode="time"
              onBlur={field.onBlur} onChange={field.onChange} timeFormat={timeFormat} value={field.value} />
          )} />
        </View>
      </View>
      <Controller control={control} name="workdays" render={({ field }) => (
        <WeekdaySelector error={errors.workdays?.message} onBlur={field.onBlur} onChange={field.onChange}
          onboardingLayout={wrapWeekdays ? 'two-rows' : 'single-row'} value={field.value} />
      )} />
      <Controller control={control} name="defaultBreakMinutes" render={({ field }) => (
        <View style={styles.breakFields}>
          <ChoiceSelector compact choices={breakChoices} label="Default Unpaid Break"
            onChange={(choice) => {
              onCustomBreakChange(choice === 'custom');
              if (choice !== 'custom') {
                field.onChange(choice);
                field.onBlur();
              }
            }}
            value={customBreak ? 'custom' : field.value} />
          {customBreak ? (
            <TextField compact error={errors.defaultBreakMinutes?.message}
              keyboardType="number-pad" label="Break duration in minutes" onBlur={field.onBlur}
              onChangeText={field.onChange} value={field.value} />
          ) : errors.defaultBreakMinutes?.message ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>{errors.defaultBreakMinutes.message}</Text>
          ) : null}
        </View>
      )} />
      <View style={styles.preview}>
        <Text style={styles.previewValue}>{showPreview ? formatAttendanceHours(minutes * 60) : '—'}</Text>
        <Text style={styles.previewLabel}>Estimated credited hours per scheduled day</Text>
      </View>
    </View>
  );
}

export function OjtGoalFields({ control, errors }: FormSectionProps) {
  const dateFormat = useWatch({ control, name: 'dateFormat' });
  const [showFormats, setShowFormats] = useState(false);
  return (
    <View style={styles.fields}>
      <Controller control={control} name="requiredHours" render={({ field }) => (
        <TextField compact error={errors.requiredHours?.message} keyboardType="decimal-pad"
          label="Required hours" onBlur={field.onBlur} onChangeText={field.onChange}
          style={styles.goalInput} value={field.value} />
      )} />
      <Controller control={control} name="internshipStartDate" render={({ field }) => (
        <DateTimeField compact dateFormat={dateFormat} error={errors.internshipStartDate?.message}
          label="Starting Date" mode="date" onBlur={field.onBlur} onChange={field.onChange} value={field.value} />
      )} />
      <Controller control={control} name="timezone" render={({ field }) => (
        <TextField autoCapitalize="none" autoCorrect={false} compact error={errors.timezone?.message}
          label="Timezone" onBlur={field.onBlur} onChangeText={field.onChange}
          placeholder="Asia/Manila" value={field.value} />
      )} />
      <View>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: showFormats }}
          onPress={() => setShowFormats((open) => !open)}
          style={({ pressed }) => [styles.formatsToggle, pressed && styles.pressed]}>
          <Text style={styles.formatsLabel}>Date and time formats</Text>
        </Pressable>
        {showFormats ? (
          <View style={styles.formatsFields}>
            <Controller control={control} name="timeFormat" render={({ field }) => (
              <ChoiceSelector compact choices={timeChoices} label="Time format" onChange={field.onChange} value={field.value} />
            )} />
            <Controller control={control} name="dateFormat" render={({ field }) => (
              <ChoiceSelector compact choices={dateChoices} label="Date format" onChange={field.onChange} value={field.value} />
            )} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profileFields: { gap: spacing.lg },
  fields: { gap: spacing.md },
  times: { flexDirection: 'row', columnGap: spacing.sm, rowGap: spacing.md },
  timesStacked: { flexDirection: 'column' },
  timeField: { flex: 1, minWidth: 0 },
  timeFieldStacked: { width: '100%' },
  breakFields: { gap: spacing.xs },
  preview: {
    backgroundColor: '#EDF5F4', borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm, gap: spacing.xxs,
  },
  previewValue: {
    color: colors.primaryDark, fontFamily: fontFamilies.headingSemibold, fontSize: 23, fontVariant: ['tabular-nums'],
  },
  previewLabel: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13 },
  error: { color: colors.error, fontFamily: fontFamilies.body, fontSize: 13 },
  goalInput: {
    color: colors.text, fontFamily: fontFamilies.heading, fontSize: 28, lineHeight: 36,
    fontVariant: ['tabular-nums'], letterSpacing: -0.65,
  },
  formatsToggle: { justifyContent: 'center', alignSelf: 'flex-start', minHeight: layout.minimumTouchTarget },
  formatsLabel: { color: colors.primaryDark, fontFamily: fontFamilies.label, fontSize: 14, textDecorationLine: 'underline' },
  formatsFields: { gap: spacing.sm, paddingBottom: spacing.xs },
  pressed: { opacity: 0.68 },
});
