import Constants from 'expo-constants';
import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChevronRight, Download } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Dialog, Screen } from '@/components/ui';
import { AttendanceCsvExportSheet } from '@/features/progress/AttendanceCsvExportSheet';
import { dateFormatLabels, SettingsEditor, settingTitles } from '@/features/settings/SettingsEditor';
import type { SettingEditor } from '@/features/settings/SettingsEditor';
import { maskToWorkdays, minutesToTime } from '@/features/setup/setupSchema';
import { useSetup } from '@/features/setup/useSetup';
import { colors, fontFamilies, layout, radius, spacing } from '@/theme';
import { formatScheduleTime, formatWorkDate } from '@/utils/time';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={styles.groupHeading}>{title}</Text>
      <View style={styles.groupRows}>{children}</View>
    </View>
  );
}

function SettingRow({ label, value, description, onPress, stacked, divided, exportAction, destructive }: {
  label: string;
  value?: string;
  description?: string;
  onPress: () => void;
  stacked?: boolean;
  divided?: boolean;
  exportAction?: boolean;
  destructive?: boolean;
}) {
  const Icon = exportAction ? Download : ChevronRight;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[label, value, description].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divided && styles.divided, pressed && styles.pressed]}
    >
      <View style={[styles.rowCopy, value && !stacked && styles.rowCopyInline]}>
        <View style={styles.rowLabelGroup}>
          <Text style={[styles.rowLabel, destructive && styles.destructive]}>{label}</Text>
          {description ? <Text style={styles.description}>{description}</Text> : null}
        </View>
        {value ? <Text style={[styles.value, !stacked && styles.valueInline]}>{value}</Text> : null}
      </View>
      {!destructive ? <Icon size={17} strokeWidth={1.8} color={exportAction ? colors.primaryDark : colors.textMuted} /> : null}
    </Pressable>
  );
}

function SettingsSkeleton() {
  return (
    <View accessible accessibilityLabel="Loading settings" accessibilityRole="progressbar" style={styles.group}>
      <View style={styles.profile}>
        <View style={[styles.avatar, styles.skeleton]} />
        <View style={styles.profileCopy}>
          <View style={[styles.skeleton, styles.skeletonName]} />
          <View style={[styles.skeleton, styles.skeletonLabel]} />
        </View>
      </View>
      <View style={styles.groupRows}>
        {[1, 2, 3, 4].map((row) => (
          <View key={row} style={[styles.row, row > 1 && styles.divided]}>
            <View style={[styles.skeleton, styles.skeletonLabel]} />
          </View>
        ))}
      </View>
    </View>
  );
}

function initialsFor(name: string) {
  const words = name.trim().split(/\s+/u);
  return [words[0], words.length > 1 ? words.at(-1) : undefined]
    .map((word) => word ? Array.from(word)[0] : '')
    .join('').toLocaleUpperCase();
}

export function SettingsScreen() {
  const focused = useIsFocused();
  const { data, status, refresh, save, deleteAllLocalData } = useSetup();
  const [activeEditor, setActiveEditor] = useState<SettingEditor | null>(null);
  const [exportVisible, setExportVisible] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'deleteError' | null>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'final' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteLock = useRef(false);
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const stacked = Math.min(width - insets.left - insets.right, layout.maxContentWidth) - 40 < 308 * Math.max(1, fontScale);
  const { profile, workSettings } = data ?? {};
  const version = Constants.expoConfig?.version;

  useEffect(() => {
    if (notice !== 'saved') return;
    const timer = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(timer);
  }, [notice]);

  function openEditor(editor: SettingEditor) {
    setNotice(null);
    setActiveEditor(editor);
  }

  function closeDelete() {
    if (!deleteLock.current) setDeleteStep(null);
  }

  async function confirmDelete() {
    if (deleteLock.current || deleteStep !== 'final') return;
    deleteLock.current = true;
    setDeleting(true);
    try {
      await deleteAllLocalData();
      setDeleteStep(null);
    } catch {
      setDeleteStep(null);
      setNotice('deleteError');
    } finally {
      deleteLock.current = false;
      setDeleting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Screen contentStyle={styles.page}>
        {focused ? <StatusBar style="dark" /> : null}
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>Settings</Text>
          <Text style={styles.body}>Make TimeInamo work for you.</Text>
        </View>

        {status === 'loading' && !data ? <SettingsSkeleton /> : null}
        {status !== 'loading' && !data ? (
          <View style={styles.notice}>
            <Text accessibilityRole="header" style={styles.aboutName}>Settings unavailable</Text>
            <Text style={styles.body}>Your settings could not be loaded. Please try again.</Text>
            <Button labelStyle={styles.buttonLabel} onPress={() => void refresh()} style={styles.retry} title="Retry" variant="outline" />
          </View>
        ) : null}

        {profile && workSettings ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Edit profile. ${profile.fullName}. Company ${profile.companyName || 'not provided'}. Department or position ${profile.jobTitle || 'not provided'}.`}
              onPress={() => openEditor('profile')}
              style={({ pressed }) => [styles.profile, pressed && styles.pressed]}
            >
              <View style={styles.avatar}>
                <Text style={styles.initials} adjustsFontSizeToFit numberOfLines={1}>{initialsFor(profile.fullName)}</Text>
              </View>
              <View style={styles.profileCopy}>
                <Text style={styles.profileName}>{profile.fullName}</Text>
                <Text style={styles.body}>{profile.companyName || 'Company not provided'}</Text>
                <Text style={styles.description}>{profile.jobTitle || 'Department or position not provided'}</Text>
              </View>
              <ChevronRight size={19} strokeWidth={1.8} color={colors.textMuted} />
            </Pressable>

            <Group title="WORK CONFIGURATION">
              <SettingRow label={settingTitles.requiredHours} stacked={stacked} onPress={() => openEditor('requiredHours')}
                value={profile.requiredMinutes
                  ? `${(profile.requiredMinutes / 60).toLocaleString('en-US', { maximumFractionDigits: 2 })} hours`
                  : 'Not set'} />
              <SettingRow divided label={settingTitles.internshipStartDate} stacked={stacked} onPress={() => openEditor('internshipStartDate')}
                value={profile.internshipStartDate ? formatWorkDate(profile.internshipStartDate, workSettings.dateFormat) : 'Not set'} />
              <SettingRow divided label={settingTitles.schedule} stacked={stacked} onPress={() => openEditor('schedule')}
                value={`${formatScheduleTime(minutesToTime(workSettings.workStartMinutes), workSettings.timeFormat)} – ${formatScheduleTime(minutesToTime(workSettings.workEndMinutes), workSettings.timeFormat)}`} />
              <SettingRow divided label={settingTitles.workdays} stacked onPress={() => openEditor('workdays')}
                value={maskToWorkdays(workSettings.workdaysMask).map((day) => weekdayLabels[day]).join(', ') || 'Not set'} />
              <SettingRow divided label={settingTitles.defaultBreakMinutes} stacked={stacked} onPress={() => openEditor('defaultBreakMinutes')}
                value={`${workSettings.defaultBreakMinutes} min`} />
            </Group>

            <Group title="PREFERENCES">
              <SettingRow label={settingTitles.timezone} stacked={stacked} value={workSettings.timezone} onPress={() => openEditor('timezone')} />
              <SettingRow divided label={settingTitles.timeFormat} stacked={stacked}
                value={workSettings.timeFormat === '24h' ? '24-hour' : '12-hour'} onPress={() => openEditor('timeFormat')} />
              <SettingRow divided label={settingTitles.dateFormat} stacked={stacked}
                value={dateFormatLabels[workSettings.dateFormat]} onPress={() => openEditor('dateFormat')} />
            </Group>

            <Group title="DATA MANAGEMENT">
              <SettingRow exportAction label="Export Attendance" description="Save a copy of your recorded work hours."
                onPress={() => setExportVisible(true)} />
              <SettingRow destructive divided label="Delete All Local Data" onPress={() => {
                setNotice(null);
                setDeleteStep('confirm');
              }} />
            </Group>
            {notice === 'deleteError' ? (
              <Text accessibilityLiveRegion="assertive" style={styles.error}>Unable to delete local data. Please try again.</Text>
            ) : null}
          </>
        ) : null}

        <View style={[styles.group, styles.about]}>
          <Text accessibilityRole="header" style={styles.groupHeading}>ABOUT TIMEINAMO</Text>
          <View style={styles.aboutRow}>
            <View style={styles.aboutCopy}>
              <Text style={styles.aboutName}>TimeInamo</Text>
              <Text style={styles.description}>Track Time. Record Progress.</Text>
            </View>
            {version ? <Text style={styles.version}>Version {version}</Text> : null}
          </View>
        </View>

        {data && activeEditor ? (
          <SettingsEditor
            data={data} editor={activeEditor} key={activeEditor} onClose={() => setActiveEditor(null)}
            onSaved={() => { setActiveEditor(null); setNotice('saved'); }} save={save}
          />
        ) : null}
        <AttendanceCsvExportSheet visible={exportVisible} onDismiss={() => setExportVisible(false)} />
        <Dialog
          visible={deleteStep !== null}
          title={deleteStep === 'final' ? 'Confirm permanent deletion' : 'Delete all TimeInamo data?'}
          description={deleteStep === 'final'
            ? 'TimeInamo will return to onboarding after your data is deleted. This action is permanent.'
            : 'This will permanently remove your attendance records, journal entries, and saved settings from this device.'}
          onDismiss={closeDelete}
          actions={(
            <View style={styles.dialogActions}>
              <Button fullWidth labelStyle={styles.buttonLabel} loading={deleting} title="Delete All Data" variant="danger"
                onPress={deleteStep === 'confirm' ? () => setDeleteStep('final') : () => void confirmDelete()} />
              <Button disabled={deleting} fullWidth labelStyle={styles.buttonLabel} title="Cancel" variant="ghost" onPress={closeDelete} />
            </View>
          )}
        />
      </Screen>
      {notice === 'saved' && focused ? (
        <View pointerEvents="none" style={styles.toastArea}>
          <Text accessibilityLiveRegion="polite" style={styles.success}>Settings updated.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  page: { paddingHorizontal: 20, paddingTop: spacing.md, paddingBottom: spacing.xl },
  header: { gap: spacing.xxs, marginBottom: 20 },
  title: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 26, letterSpacing: -0.7 },
  body: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 14 },
  profile: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: '#EDF5F4', minHeight: 76,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primarySoft, justifyContent: 'center', paddingHorizontal: 5 },
  initials: { color: colors.primaryDark, fontFamily: fontFamilies.headingSemibold, fontSize: 19, textAlign: 'center' },
  profileCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  profileName: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 20, letterSpacing: -0.4 },
  group: { marginTop: spacing.lg, gap: spacing.xs },
  groupHeading: { color: colors.textSecondary, fontFamily: fontFamilies.headingSemibold, fontSize: 12, letterSpacing: 0.75 },
  groupRows: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' },
  row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderStrong },
  pressed: { backgroundColor: colors.primarySoft },
  rowCopy: { flex: 1, minWidth: 0, gap: spacing.xxs },
  rowCopyInline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowLabelGroup: { flex: 1, minWidth: 0, gap: spacing.xxs },
  rowLabel: { color: colors.text, fontFamily: fontFamilies.bodyMedium, fontSize: 15 },
  value: { color: colors.textSecondary, fontFamily: fontFamilies.headingSemibold, fontSize: 13, fontVariant: ['tabular-nums'] },
  valueInline: { flex: 1, textAlign: 'right' },
  description: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13 },
  destructive: { color: colors.error },
  about: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md },
  aboutRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.xs },
  aboutCopy: { gap: spacing.xxs, maxWidth: '100%' },
  aboutName: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 17 },
  version: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13, fontVariant: ['tabular-nums'] },
  dialogActions: { width: '100%', gap: spacing.xs },
  buttonLabel: { flexShrink: 1, fontFamily: fontFamilies.label, fontWeight: 'normal' },
  notice: { alignItems: 'flex-start', gap: spacing.xs },
  retry: { alignSelf: 'flex-start' },
  toastArea: { position: 'absolute', bottom: spacing.sm, left: 20, right: 20, alignItems: 'center' },
  success: {
    color: colors.success, backgroundColor: colors.successSoft, fontFamily: fontFamilies.label, fontSize: 13,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, textAlign: 'center',
  },
  error: { color: colors.error, fontFamily: fontFamilies.body, fontSize: 13, marginTop: spacing.xs },
  skeleton: { backgroundColor: colors.border, borderRadius: radius.sm },
  skeletonName: { width: '72%', height: 16 },
  skeletonLabel: { width: '42%', height: 12 },
});
