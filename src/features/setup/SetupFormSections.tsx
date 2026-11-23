import { Building2, Clock3, Target, UserRound } from 'lucide-react-native';
import { Controller, useWatch } from 'react-hook-form';
import type { Control, FieldErrors } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { TextField } from '@/components/ui';
import { colors, spacing, typography } from '@/theme';

import { ChoiceSelector } from './ChoiceSelector';
import { DateTimeField } from './DateTimeField';
import type { SetupFormValues } from './setupSchema';
import { WeekdaySelector } from './WeekdaySelector';

interface FormSectionProps {
  control: Control<SetupFormValues>;
  errors: FieldErrors<SetupFormValues>;
}

export function PersonalInformationFields({ control, errors }: FormSectionProps) {
  return (
    <View style={styles.fields}>
      <Controller
        control={control}
        name="fullName"
        render={({ field }) => (
          <TextField
            autoCapitalize="words"
            error={errors.fullName?.message}
            icon={UserRound}
            label="Full name"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Enter your full name"
            returnKeyType="next"
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
            error={errors.companyName?.message}
            icon={Building2}
            label="Company / OJT establishment"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Enter establishment name"
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
            error={errors.jobTitle?.message}
            label="Department or position (optional)"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="e.g. Information Technology"
            value={field.value}
          />
        )}
      />
    </View>
  );
}

export function WorkScheduleFields({ control, errors }: FormSectionProps) {
  const timeFormat = useWatch({ control, name: 'timeFormat' });
  return (
    <View style={styles.fields}>
      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <Controller
            control={control}
            name="workStart"
            render={({ field }) => (
              <DateTimeField
                error={errors.workStart?.message}
                label="Scheduled time in"
                mode="time"
                onBlur={field.onBlur}
                onChange={field.onChange}
                timeFormat={timeFormat}
                value={field.value}
              />
            )}
          />
        </View>
        <View style={styles.timeField}>
          <Controller
            control={control}
            name="workEnd"
            render={({ field }) => (
              <DateTimeField
                error={errors.workEnd?.message}
                label="Scheduled time out"
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
        name="workdays"
        render={({ field }) => (
          <WeekdaySelector
            error={errors.workdays?.message}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="defaultBreakMinutes"
        render={({ field }) => (
          <TextField
            error={errors.defaultBreakMinutes?.message}
            icon={Clock3}
            keyboardType="number-pad"
            label="Default unpaid break (minutes)"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="60"
            value={field.value}
          />
        )}
      />
      <Text style={styles.note}>
        This default applies only to future sessions. Historical attendance is never recalculated.
      </Text>
    </View>
  );
}

export function OjtGoalFields({ control, errors }: FormSectionProps) {
  const dateFormat = useWatch({ control, name: 'dateFormat' });
  return (
    <View style={styles.fields}>
      <Controller
        control={control}
        name="internshipStartDate"
        render={({ field }) => (
          <DateTimeField
            error={errors.internshipStartDate?.message}
            label="Internship start date"
            mode="date"
            onBlur={field.onBlur}
            onChange={field.onChange}
            dateFormat={dateFormat}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="requiredHours"
        render={({ field }) => (
          <TextField
            error={errors.requiredHours?.message}
            icon={Target}
            keyboardType="decimal-pad"
            label="Required OJT hours"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="400"
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="timezone"
        render={({ field }) => (
          <TextField
            autoCapitalize="none"
            autoCorrect={false}
            error={errors.timezone?.message}
            label="Timezone"
            onBlur={field.onBlur}
            onChangeText={field.onChange}
            placeholder="Asia/Manila"
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="timeFormat"
        render={({ field }) => (
          <ChoiceSelector
            choices={[
              { label: '12-hour', value: '12h' },
              { label: '24-hour', value: '24h' },
            ]}
            label="Time format"
            onChange={field.onChange}
            value={field.value}
          />
        )}
      />
      <Controller
        control={control}
        name="dateFormat"
        render={({ field }) => (
          <ChoiceSelector
            choices={[
              { label: 'Month / Day', value: 'mdy' },
              { label: 'Day / Month', value: 'dmy' },
              { label: 'Year / Month', value: 'ymd' },
            ]}
            label="Date format"
            onChange={field.onChange}
            value={field.value}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: spacing.lg,
  },
  timeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  timeField: {
    minWidth: 220,
    flex: 1,
  },
  note: {
    marginTop: -spacing.sm,
    color: colors.textSecondary,
    ...typography.caption,
  },
});

