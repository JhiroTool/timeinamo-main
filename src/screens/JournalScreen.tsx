import { zodResolver } from '@hookform/resolvers/zod';
import { useFocusEffect } from 'expo-router';
import {
  BookOpen,
  Link2,
  Link2Off,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  GradientHeader,
  LoadingState,
  Screen,
  TextField,
} from '@/components/ui';
import { ActivityLogRepository } from '@/database/repositories';
import { journalSchema, type JournalFormValues } from '@/features/journal/journalSchema';
import { DateTimeField } from '@/features/setup/DateTimeField';
import { useSetup } from '@/features/setup/useSetup';
import { useDatabase } from '@/hooks/useDatabase';
import { formatDuration } from '@/services/attendanceCalculations.js';
import { colors, layout, radius, shadows, spacing, typography } from '@/theme';
import type { ActivityLog, AttendanceSession } from '@/types/models';
import { parseWorkDate, toWorkDate } from '@/utils/time';

function formatWorkDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function JournalScreen() {
  const database = useDatabase();
  const insets = useSafeAreaInsets();
  const repository = useMemo(() => new ActivityLogRepository(database), [database]);
  const { data: setup } = useSetup();
  const timezone = setup?.workSettings.timezone ?? 'Asia/Manila';
  const dateFormat = setup?.workSettings.dateFormat ?? 'mdy';
  const profileId = setup?.profile.id ?? 1;
  const today = toWorkDate(new Date(), timezone);
  const [entries, setEntries] = useState<ActivityLog[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<ActivityLog | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSession | null>(null);
  const [linkAttendance, setLinkAttendance] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const {
    control,
    formState: { errors, isDirty, isSubmitting },
    handleSubmit,
    reset,
  } = useForm<JournalFormValues>({
    defaultValues: { workDate: today, title: '', content: '', notes: '' },
    mode: 'onBlur',
    resolver: zodResolver(journalSchema),
  });
  const editorDate = useWatch({ control, name: 'workDate' });

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setEntries(
        await repository.list(profileId, {
          search: debouncedSearch,
          workDate: filterDate ? parseWorkDate(filterDate) : null,
        }),
      );
      setStatus('ready');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Journal entries could not be loaded.');
      setStatus('error');
    }
  }, [debouncedSearch, filterDate, profileId, repository]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!editorVisible || !editorDate) return;
    let cancelled = false;
    repository.getAttendanceForDate(profileId, parseWorkDate(editorDate)).then(
      (record) => {
        if (cancelled) return;
        setAttendance(record);
        setLinkAttendance(Boolean(record && editing?.attendanceSessionId === record.id));
      },
      () => {
        if (!cancelled) {
          setAttendance(null);
          setLinkAttendance(false);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [editing?.attendanceSessionId, editorDate, editorVisible, profileId, repository]);

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, ActivityLog[]>();
    for (const entry of entries) {
      const group = groups.get(entry.workDate) ?? [];
      group.push(entry);
      groups.set(entry.workDate, group);
    }
    return [...groups.entries()].map(([title, data]) => ({ title, data }));
  }, [entries]);

  function openCreate() {
    setEditing(null);
    setAttendance(null);
    setLinkAttendance(false);
    setSaveError(null);
    reset({ workDate: today, title: '', content: '', notes: '' });
    setEditorVisible(true);
  }

  function openEdit(entry: ActivityLog) {
    setEditing(entry);
    setAttendance(null);
    setLinkAttendance(Boolean(entry.attendanceSessionId));
    setSaveError(null);
    reset({
      workDate: entry.workDate,
      title: entry.title,
      content: entry.content,
      notes: entry.notes ?? '',
    });
    setEditorVisible(true);
  }

  function closeEditor(force = false) {
    if (isSubmitting) return;
    if (!force && isDirty) {
      Alert.alert('Discard unsaved changes?', 'Your journal changes have not been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => setEditorVisible(false) },
      ]);
      return;
    }
    setEditorVisible(false);
  }

  const submit = handleSubmit(async (values) => {
    setSaveError(null);
    try {
      await repository.save({
        ...(editing ? { id: editing.id } : {}),
        profileId,
        workDate: parseWorkDate(values.workDate),
        title: values.title,
        content: values.content,
        notes: values.notes,
        attendanceSessionId: linkAttendance ? attendance?.id ?? null : null,
      });
      reset(values);
      setEditorVisible(false);
      await load();
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Journal entry could not be saved.');
    }
  });

  function confirmDelete(entry: ActivityLog) {
    Alert.alert('Delete journal entry?', `“${entry.title}” will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setDeletingId(entry.id);
          repository.remove(entry.id, profileId).then(
            () => void load(),
            (reason: unknown) =>
              Alert.alert(
                'Could not delete entry',
                reason instanceof Error ? reason.message : 'Please try again.',
              ),
          ).finally(() => setDeletingId(null));
        },
      },
    ]);
  }

  return (
    <Screen branded contentStyle={styles.screenContent} keyboardAware scrollable={false}>
      <GradientHeader
        compact
        eyebrow="DAILY ACTIVITIES"
        subtitle="Record your daily accomplishments"
        title="My Journal"
      />
      <SectionList
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: layout.tabBarBaseHeight + insets.bottom + spacing.xl },
        ]}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(entry) => String(entry.id)}
        ListEmptyComponent={
          status === 'ready' ? (
            <Card style={styles.stateCard}>
              <EmptyState
                description={
                  search || filterDate
                    ? 'Try a different search or clear the date filter.'
                    : 'Start recording your daily activities and accomplishments.'
                }
                icon={BookOpen}
                title={search || filterDate ? 'No matching entries' : 'Your journal is empty'}
              />
            </Card>
          ) : undefined
        }
        ListHeaderComponent={
          <>
            <View style={styles.filters}>
              <TextField
                icon={Search}
                label="Search"
                onChangeText={setSearch}
                placeholder="Search activities…"
                returnKeyType="search"
                value={search}
              />
              <View style={styles.dateFilterRow}>
                <View style={styles.dateFilter}>
                  <DateTimeField
                    dateFormat={dateFormat}
                    label="Filter by date"
                    mode="date"
                    onChange={setFilterDate}
                    value={filterDate}
                  />
                </View>
                {filterDate ? (
                  <Button onPress={() => setFilterDate('')} title="Clear" variant="ghost" />
                ) : null}
              </View>
              <Button fullWidth icon={Plus} onPress={openCreate} title="Add Activity" />
            </View>
            {status === 'loading' && entries.length === 0 ? (
              <LoadingState label="Loading journal…" />
            ) : null}
            {status === 'error' ? (
              <Card style={styles.stateCard}>
                <EmptyState
                  action={<Button onPress={() => void load()} title="Try again" />}
                  description={error ?? 'Journal entries could not be loaded.'}
                  icon={BookOpen}
                  title="Journal unavailable"
                />
              </Card>
            ) : null}
          </>
        }
        renderItem={({ item: entry }) => (
          <Card style={styles.entryCard}>
            <View style={styles.entryHeader}>
              <View style={styles.entryTitleWrap}>
                <Text style={styles.entryTitle}>{entry.title}</Text>
                {entry.attendanceSessionId ? (
                  <Badge
                    icon={Link2}
                    label={
                      entry.attendanceCreditedSeconds === null
                        ? 'Linked to attendance'
                        : `${formatDuration(entry.attendanceCreditedSeconds)} credited`
                    }
                  />
                ) : null}
              </View>
              <View style={styles.entryActions}>
                <Pressable
                  accessibilityLabel={`Edit ${entry.title}`}
                  accessibilityRole="button"
                  onPress={() => openEdit(entry)}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                >
                  <Pencil color={colors.primaryDark} size={19} />
                </Pressable>
                <Pressable
                  accessibilityLabel={`Delete ${entry.title}`}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: deletingId === entry.id }}
                  disabled={deletingId === entry.id}
                  onPress={() => confirmDelete(entry)}
                  style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
                >
                  <Trash2 color={colors.error} size={19} />
                </Pressable>
              </View>
            </View>
            <Text style={styles.description}>{entry.content}</Text>
            {entry.notes ? (
              <View style={styles.notesBox}>
                <Text style={styles.notesLabel}>Additional notes</Text>
                <Text style={styles.notes}>{entry.notes}</Text>
              </View>
            ) : null}
          </Card>
        )}
        renderSectionHeader={({ section }) => (
          <Text style={styles.dateHeading}>{formatWorkDate(section.title)}</Text>
        )}
        sections={groupedEntries}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        stickySectionHeadersEnabled={false}
      />

      <BottomSheet
        dismissDisabled={isSubmitting}
        onDismiss={() => closeEditor()}
        title={editing ? 'Edit journal entry' : 'New journal entry'}
        visible={editorVisible}
      >
        <ScrollView
          contentContainerStyle={styles.editor}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Controller
            control={control}
            name="workDate"
            render={({ field }) => (
              <DateTimeField
                dateFormat={dateFormat}
                error={errors.workDate?.message}
                label="Date"
                mode="date"
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}
              />
            )}
          />
          <Controller
            control={control}
            name="title"
            render={({ field }) => (
              <TextField
                error={errors.title?.message}
                label="Title"
                maxLength={120}
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="What did you work on?"
                value={field.value}
              />
            )}
          />
          <Controller
            control={control}
            name="content"
            render={({ field }) => (
              <TextField
                error={errors.content?.message}
                label="Description"
                multiline
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="Describe the activity, output, or learning"
                style={styles.multiline}
                textAlignVertical="top"
                value={field.value}
              />
            )}
          />
          <Controller
            control={control}
            name="notes"
            render={({ field }) => (
              <TextField
                error={errors.notes?.message}
                label="Additional notes (optional)"
                multiline
                onBlur={field.onBlur}
                onChangeText={field.onChange}
                placeholder="Add follow-ups or reminders"
                style={styles.notesInput}
                textAlignVertical="top"
                value={field.value}
              />
            )}
          />

          <View style={styles.linkSection}>
            <View style={styles.linkCopy}>
              <Text style={styles.linkTitle}>Attendance link</Text>
              <Text style={styles.linkDescription}>
                {attendance
                  ? 'An attendance record exists for this date.'
                  : 'No attendance record exists for this date. The entry can still be saved.'}
              </Text>
            </View>
            <Button
              disabled={!attendance}
              icon={linkAttendance ? Link2Off : Link2}
              onPress={() => setLinkAttendance((current) => !current)}
              title={linkAttendance ? 'Unlink' : 'Link'}
              variant={linkAttendance ? 'secondary' : 'outline'}
            />
          </View>

          {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
          <View style={styles.editorActions}>
            <Button disabled={isSubmitting} onPress={() => closeEditor()} title="Cancel" variant="ghost" />
            <Button loading={isSubmitting} onPress={() => void submit()} title="Save entry" />
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingBottom: 0 },
  list: { flex: 1, marginTop: -28 },
  listContent: { paddingTop: 0 },
  filters: {
    gap: spacing.sm,
    padding: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    ...shadows.card,
  },
  dateFilterRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: spacing.sm },
  dateFilter: { minWidth: 200, flex: 1 },
  stateCard: { marginTop: spacing.md },
  dateHeading: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    color: colors.textSecondary,
    backgroundColor: colors.background,
    ...typography.label,
  },
  entryCard: { gap: spacing.md, marginBottom: spacing.sm },
  entryHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  entryTitleWrap: { minWidth: 0, flex: 1, gap: spacing.xs },
  entryTitle: { color: colors.text, ...typography.subheading },
  entryActions: { flexDirection: 'row', marginTop: -spacing.xs },
  iconButton: {
    width: layout.minimumTouchTarget,
    height: layout.minimumTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  pressed: { backgroundColor: colors.border },
  description: { color: colors.textSecondary, ...typography.body },
  notesBox: { padding: spacing.md, backgroundColor: colors.background, borderRadius: radius.md },
  notesLabel: { color: colors.textMuted, ...typography.label },
  notes: { marginTop: spacing.xxs, color: colors.textSecondary, ...typography.caption },
  editor: { gap: spacing.md, paddingBottom: spacing.lg },
  multiline: { minHeight: 112 },
  notesInput: { minHeight: 80 },
  linkSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  linkCopy: { minWidth: 0, flex: 1 },
  linkTitle: { color: colors.text, ...typography.label },
  linkDescription: { marginTop: spacing.xxs, color: colors.textSecondary, ...typography.caption },
  saveError: { color: colors.error, ...typography.caption },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
