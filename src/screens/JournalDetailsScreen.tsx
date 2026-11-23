import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, LoadingState } from '@/components/ui';
import { formatAttendanceHours } from '@/features/attendance/attendancePresentation';
import { useJournal } from '@/features/journal/JournalContext';
import { formatJournalDate } from '@/features/journal/JournalDatePicker';
import { JournalPageHeader } from '@/features/journal/JournalPageHeader';
import { useJournalEntry } from '@/features/journal/useJournalEntry';
import { colors, fontFamilies, layout, spacing } from '@/theme';

export function JournalDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { repository, profileId, setNotice } = useJournal();
  const { entry, loading, error, retry } = useJournalEntry(id ?? '');
  const [deleting, setDeleting] = useState(false);
  const deletingLock = useRef(false);

  function confirmDelete() {
    if (!entry || deletingLock.current) return;
    const entryId = entry.id;
    Alert.alert('Delete activity?', `“${entry.title}” will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Activity', style: 'destructive', onPress: async () => {
        if (deletingLock.current) return;
        deletingLock.current = true;
        setDeleting(true);
        try {
          await repository.remove(entryId, profileId);
          setNotice('Activity deleted.');
          router.dismissTo('/journal');
        } catch {
          Alert.alert('Could not delete activity', 'Please try again.');
        } finally {
          deletingLock.current = false;
          setDeleting(false);
        }
      } },
    ]);
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <JournalPageHeader onBack={() => router.dismissTo('/journal')}
        {...(entry ? { action: 'Edit', onAction: () => router.push({ pathname: '/journal/edit', params: { id: String(entry.id) } }) } : {})}
        disabled={deleting} />
      <ScrollView contentContainerStyle={styles.article} showsVerticalScrollIndicator={false}>
        {loading ? <LoadingState label="Loading activity…" /> : entry ? (
          <>
            <Text style={styles.date}>{formatJournalDate(entry.workDate)}</Text>
            <Text accessibilityRole="header" style={styles.title}>{entry.title}</Text>
            <Text selectable style={styles.readingText}>{entry.content}</Text>
            {entry.notes ? (
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>Additional notes</Text>
                <Text selectable style={styles.readingText}>{entry.notes}</Text>
              </View>
            ) : null}
            {entry.attendanceSessionId !== null ? (
              <View style={styles.section}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>Related attendance</Text>
                <Text style={styles.readingText}>
                  {entry.attendanceCreditedSeconds === null ? 'Linked to attendance' : `${formatAttendanceHours(entry.attendanceCreditedSeconds, true)} credited`}
                </Text>
              </View>
            ) : null}
            <View style={styles.section}>
              <Button variant="ghost" title="Delete Activity" loading={deleting} onPress={confirmDelete}
                labelStyle={styles.deleteLabel} style={styles.deleteButton} />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.readingText}>{error ? 'This activity couldn’t be loaded.' : 'This activity is unavailable.'}</Text>
            {error ? <Button title="Retry" variant="ghost" onPress={retry} /> : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  article: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  date: { color: colors.primaryDark, fontFamily: fontFamilies.label, fontSize: 13, lineHeight: 20 },
  title: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 29, lineHeight: 38, letterSpacing: -0.65 },
  readingText: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 15, lineHeight: 25 },
  section: { marginTop: spacing.sm, paddingTop: spacing.md, gap: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sectionTitle: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 17, lineHeight: 24 },
  deleteLabel: { color: colors.error, fontFamily: fontFamilies.label, fontWeight: 'normal' },
  deleteButton: { alignSelf: 'flex-start', marginLeft: -spacing.sm },
});
