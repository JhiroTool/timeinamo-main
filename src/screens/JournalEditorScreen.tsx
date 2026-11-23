import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, usePreventRemove, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { ComponentRef } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, LoadingState } from '@/components/ui';
import { DatabaseOperationError } from '@/database/errors';
import { useJournal } from '@/features/journal/JournalContext';
import { JournalDatePicker } from '@/features/journal/JournalDatePicker';
import { JournalPageHeader } from '@/features/journal/JournalPageHeader';
import { journalSchema, type JournalFormValues } from '@/features/journal/journalSchema';
import { useJournalEntry } from '@/features/journal/useJournalEntry';
import { colors, fontFamilies, layout, radius, spacing } from '@/theme';
import type { ActivityLog, AttendanceSession } from '@/types/models';
import { parseWorkDate, toWorkDate } from '@/utils/time';

function initialDate(value: string | undefined, today: string) {
  if (typeof value !== 'string') return today;
  try { return parseWorkDate(value); } catch { return today; }
}

function WritingField({ label, error, ...props }: TextInputProps & { label: string; error?: string | undefined }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        underlineColorAndroid="transparent"
        style={[styles.input, props.style, focused && styles.focusedInput, error && styles.invalidInput]}
        onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
        onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
      />
      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function JournalEditor({ entry, workDate, today }: { entry: ActivityLog | null; workDate: string; today: string }) {
  const router = useRouter();
  const { repository, profileId, setNotice } = useJournal();
  const [linkedId, setLinkedId] = useState(entry?.attendanceSessionId ?? null);
  const [lookup, setLookup] = useState<{ date: string; record: AttendanceSession | null; failed?: boolean } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const saving = useRef(false);
  const writingScroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const form = useForm<JournalFormValues>({
    defaultValues: { workDate, title: entry?.title ?? '', content: entry?.content ?? '', notes: entry?.notes ?? '' },
    mode: 'onBlur',
    resolver: zodResolver(journalSchema),
  });
  const { control, formState: { errors, isDirty, isSubmitting }, handleSubmit, reset } = form;
  const date = useWatch({ control, name: 'workDate' });
  const currentLookup = lookup?.date === date ? lookup : null;
  const attendance = currentLookup?.record ?? null;
  const leaveEditor = () => { if (router.canGoBack()) router.back(); else router.dismissTo('/journal'); };
  const dirty = isDirty || linkedId !== (entry?.attendanceSessionId ?? null);
  const allowRemoval = usePreventRemove(!leaving && (dirty || isSubmitting), ({ repeat }) => {
    if (saving.current) return;
    Alert.alert('Discard unsaved changes?', 'Your journal changes have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { setLeaving(true); repeat(); } },
    ]);
  });

  useEffect(() => {
    let cancelled = false;
    void repository.getAttendanceForDate(profileId, parseWorkDate(date)).then(
      (record) => {
        if (cancelled) return;
        setLookup({ date, record });
        setLinkedId((current) => current === record?.id ? current : null);
      },
      () => { if (!cancelled) setLookup({ date, record: null, failed: true }); },
    );
    return () => { cancelled = true; };
  }, [date, profileId, repository]);

  function save() {
    if (saving.current || !currentLookup) return;
    saving.current = true;
    setSaveError(null);
    void handleSubmit(async (values) => {
      try {
        await repository.save({
          ...(entry ? { id: entry.id } : {}),
          profileId,
          workDate: parseWorkDate(values.workDate),
          title: values.title,
          content: values.content,
          notes: values.notes,
          attendanceSessionId: linkedId,
        });
        reset(values);
        setLeaving(true);
        allowRemoval();
        Keyboard.dismiss();
        setNotice(entry ? 'Changes saved.' : 'Activity added.');
        router.dismissTo('/journal');
      } catch (reason) {
        setSaveError(reason instanceof DatabaseOperationError ? reason.message : 'Your activity couldn’t be saved. Please try again.');
        writingScroll.current?.scrollTo({ y: 0, animated: false });
      }
    }, () => writingScroll.current?.scrollTo({ y: 0, animated: false }))().finally(() => { saving.current = false; });
  }

  return (
    <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.screen}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <JournalPageHeader title={entry ? 'Edit Activity' : 'New Activity'} onBack={leaveEditor}
          action="Save" onAction={save} busy={isSubmitting} disabled={!currentLookup} />
        <ScrollView ref={writingScroll} style={styles.screen} contentContainerStyle={styles.writing}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}>
          {saveError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{saveError}</Text> : null}
          <Controller control={control} name="workDate" render={({ field }) => (
            <View style={styles.field}>
              <Text style={styles.label}>Date</Text>
              <JournalDatePicker value={field.value} today={today} onChange={(value) => {
                if (value !== field.value) {
                  setLinkedId(value === entry?.workDate ? entry.attendanceSessionId : null);
                  setLookup(null);
                }
                field.onChange(value);
                field.onBlur();
              }} />
              {errors.workDate ? <Text style={styles.error}>{errors.workDate.message}</Text> : null}
            </View>
          )} />
          <Controller control={control} name="title" render={({ field }) => (
            <WritingField label="Activity Title" error={errors.title?.message} value={field.value}
              onBlur={field.onBlur} onChangeText={field.onChange} maxLength={120}
              placeholder="What did you work on?" />
          )} />
          <Controller control={control} name="content" render={({ field }) => (
            <WritingField label="Description" error={errors.content?.message} value={field.value}
              onBlur={field.onBlur} onChangeText={field.onChange} multiline maxLength={5000} textAlignVertical="top"
              style={styles.description} placeholder="Describe what you accomplished today…" />
          )} />
          <Controller control={control} name="notes" render={({ field }) => (
            <WritingField label="Additional Notes (optional)" error={errors.notes?.message} value={field.value}
              onBlur={field.onBlur} onChangeText={field.onChange} multiline maxLength={5000} textAlignVertical="top"
              style={styles.notes} placeholder="Learnings, challenges, or other notes…" />
          )} />
          <View style={styles.attendanceRow}>
            <View style={styles.attendanceCopy}>
              <Text style={styles.label}>Link attendance</Text>
              <Text style={styles.support}>{!currentLookup ? 'Checking attendance…' : currentLookup.failed
                ? 'Attendance couldn’t be checked.' : attendance ? 'Attach the attendance record for this date.' : 'No attendance recorded for this date.'}</Text>
            </View>
            <Switch accessibilityLabel="Link attendance" value={linkedId !== null}
              disabled={!attendance || isSubmitting} thumbColor={linkedId !== null ? colors.primary : colors.surface}
              trackColor={{ true: '#A9DDD6', false: colors.borderStrong }}
              onValueChange={(value) => setLinkedId(value ? attendance?.id ?? null : null)} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function JournalEditorScreen() {
  const router = useRouter();
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const { timezone } = useJournal();
  const today = toWorkDate(new Date(), timezone);
  const { entry, loading, error, retry } = useJournalEntry(id);
  if (id !== undefined && !entry) {
    return (
      <SafeAreaView style={styles.screen}>
        <JournalPageHeader title="Edit Activity" onBack={() => router.dismissTo('/journal')} />
        <View style={styles.writing}>
          {loading ? <LoadingState label="Loading activity…" /> : (
            <>
              <Text style={styles.support}>{error ? 'This activity couldn’t be loaded.' : 'This activity is unavailable.'}</Text>
              {error ? <Button title="Retry" variant="ghost" onPress={retry} /> : null}
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }
  return <JournalEditor key={id ?? 'new'} entry={entry} today={today} workDate={entry?.workDate ?? initialDate(date, today)} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  writing: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: 20, paddingTop: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  field: { gap: 6 },
  label: { color: colors.text, fontFamily: fontFamilies.label, fontSize: 14, lineHeight: 20 },
  input: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, color: colors.text, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 23 },
  focusedInput: { borderColor: colors.primary },
  invalidInput: { borderColor: colors.error },
  description: { minHeight: 148 },
  notes: { minHeight: 80 },
  support: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19 },
  attendanceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  attendanceCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  error: { color: colors.error, fontFamily: fontFamilies.body, fontSize: 13, lineHeight: 19 },
});
