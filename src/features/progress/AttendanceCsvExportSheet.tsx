import { CalendarRange, Check, FileSpreadsheet } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { BottomSheet, Button } from '@/components/ui';
import { AttendanceExportRepository } from '@/database/repositories';
import { DateTimeField } from '@/features/setup/DateTimeField';
import { useSetup } from '@/features/setup/useSetup';
import { useDatabase } from '@/hooks/useDatabase';
import { shareAttendanceCsv } from '@/services/AttendanceExportService';
import { colors, fontFamilies, radius, spacing } from '@/theme';
import type { WorkDate } from '@/types/time';
import { parseWorkDate, toWorkDate } from '@/utils/time';

type ExportScope = 'all' | 'month' | 'custom';

interface AttendanceCsvExportSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

function monthBounds(today: WorkDate): { startDate: WorkDate; endDate: WorkDate; label: string } {
  const [year = 0, month = 0] = today.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const label = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  return {
    startDate: parseWorkDate(`${label}-01`),
    endDate: parseWorkDate(`${label}-${String(lastDay).padStart(2, '0')}`),
    label,
  };
}

function ScopeOption({
  active,
  label,
  description,
  onPress,
}: {
  active: boolean;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={`${label}. ${description}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, active && styles.optionActive, pressed && styles.pressed]}
    >
      <View style={[styles.radio, active && styles.radioActive]}>
        {active ? <Check color="#FFFFFF" size={14} strokeWidth={3} /> : null}
      </View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{label}</Text>
        <Text style={styles.optionDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

export function AttendanceCsvExportSheet({ visible, onDismiss }: AttendanceCsvExportSheetProps) {
  const database = useDatabase();
  const repository = useMemo(() => new AttendanceExportRepository(database), [database]);
  const { data: setup } = useSetup();
  const timezone = setup?.workSettings.timezone ?? 'Asia/Manila';
  const dateFormat = setup?.workSettings.dateFormat ?? 'mdy';
  const today = toWorkDate(new Date(), timezone);
  const currentMonth = monthBounds(today);
  const [scope, setScope] = useState<ExportScope>('month');
  const [startDate, setStartDate] = useState<string>(currentMonth.startDate);
  const [endDate, setEndDate] = useState<string>(today);
  const [includeJournal, setIncludeJournal] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setError(null);
  }, [visible]);

  async function exportCsv() {
    setError(null);
    if (scope === 'custom' && (!startDate || !endDate || startDate > endDate)) {
      setError('Choose a valid custom date range.');
      return;
    }
    setExporting(true);
    try {
      const range =
        scope === 'all'
          ? {}
          : scope === 'month'
            ? { startDate: currentMonth.startDate, endDate: currentMonth.endDate }
            : { startDate: parseWorkDate(startDate), endDate: parseWorkDate(endDate) };
      const records = await repository.list(setup?.profile.id ?? 1, range, includeJournal);
      if (records.length === 0) {
        setError('There are no attendance records in the selected range.');
        return;
      }
      const periodLabel =
        scope === 'all'
          ? 'All'
          : scope === 'month'
            ? currentMonth.label
            : `${startDate}_to_${endDate}`;
      const filename = await shareAttendanceCsv({
        records,
        timezone,
        includeJournalDescriptions: includeJournal,
        periodLabel,
      });
      onDismiss();
      Alert.alert('CSV export ready', `${filename} was passed to the native share sheet.`);
    } catch {
      setError('The CSV could not be exported. Try again or check that file sharing is available on this device.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <BottomSheet
      dismissDisabled={exporting}
      onDismiss={onDismiss}
      scrollable
      title="Export CSV"
      titleStyle={styles.sheetTitle}
      visible={visible}
    >
      <View style={styles.content}>
        <View accessibilityRole="radiogroup" style={styles.options}>
          <ScopeOption
            active={scope === 'all'}
            description="Every non-deleted attendance record"
            label="All records"
            onPress={() => setScope('all')}
          />
          <ScopeOption
            active={scope === 'month'}
            description={currentMonth.label}
            label="This month"
            onPress={() => setScope('month')}
          />
          <ScopeOption
            active={scope === 'custom'}
            description="Choose inclusive start and end dates"
            label="Custom date range"
            onPress={() => setScope('custom')}
          />
        </View>

        {scope === 'custom' ? (
          <View style={styles.dateRow}>
            <View style={styles.dateField}>
              <DateTimeField
                dateFormat={dateFormat}
                label="Start date"
                mode="date"
                onChange={setStartDate}
                value={startDate}
              />
            </View>
            <View style={styles.dateField}>
              <DateTimeField
                dateFormat={dateFormat}
                label="End date"
                mode="date"
                onChange={setEndDate}
                value={endDate}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Include journal activities</Text>
            <Text style={styles.switchDescription}>
              Adds descriptions from journal entries sharing each attendance date.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Include journal activities"
            onValueChange={setIncludeJournal}
            thumbColor="#FFFFFF"
            trackColor={{ false: colors.borderStrong, true: colors.primary }}
            value={includeJournal}
          />
        </View>

        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
        <Button
          fullWidth
          icon={scope === 'custom' ? CalendarRange : FileSpreadsheet}
          labelStyle={styles.buttonLabel}
          loading={exporting}
          onPress={() => void exportCsv()}
          title="Create and share CSV"
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetTitle: { fontFamily: fontFamilies.headingSemibold, fontWeight: 'normal' },
  content: { gap: spacing.md, paddingBottom: spacing.md },
  options: { gap: spacing.sm },
  option: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  optionActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.8 },
  radio: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
  },
  radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionCopy: { flex: 1 },
  optionTitle: { color: colors.text, fontFamily: fontFamilies.label, fontSize: 14 },
  optionDescription: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13 },
  dateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dateField: { minWidth: 150, flex: 1 },
  switchRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderRadius: radius.md,
  },
  switchCopy: { minWidth: 0, flex: 1 },
  switchTitle: { color: colors.text, fontFamily: fontFamilies.label, fontSize: 14 },
  switchDescription: { marginTop: spacing.xxs, color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 13 },
  error: { color: colors.error, fontFamily: fontFamilies.body, fontSize: 13 },
  buttonLabel: { flexShrink: 1, fontFamily: fontFamilies.label, fontWeight: 'normal' },
});
