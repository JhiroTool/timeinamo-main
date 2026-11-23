import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { BookOpen, Plus, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Keyboard, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { formatAttendanceHours } from '@/features/attendance/attendancePresentation';
import { useJournal } from '@/features/journal/JournalContext';
import { formatJournalDate, JournalDatePicker } from '@/features/journal/JournalDatePicker';
import { colors, fontFamilies, layout, radius, spacing } from '@/theme';
import type { ActivityLog } from '@/types/models';
import { parseWorkDate, toWorkDate } from '@/utils/time';

const emptyEntries: ActivityLog[] = [];

function JournalLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

function AddActivity({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let awaitingPreference = true;
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      awaitingPreference = false;
      setReduceMotion(value);
    });
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (awaitingPreference) setReduceMotion(value);
    }, () => {});
    return () => { awaitingPreference = false; listener.remove(); };
  }, []);

  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  function press(next: number) {
    scale.set(reduceMotion ? 1 : withTiming(next, { duration: 110, reduceMotion: ReduceMotion.Never }));
  }

  return (
    <Animated.View style={motion}>
      <Pressable accessibilityRole="button" accessibilityLabel="Add Activity" onPress={onPress}
        onPressIn={() => press(0.96)} onPressOut={() => press(1)}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
        <Plus color={colors.surface} size={25} strokeWidth={2.2} />
      </Pressable>
    </Animated.View>
  );
}

export function JournalScreen() {
  const router = useRouter();
  const focused = useIsFocused();
  const { repository, profileId, timezone, notice, setNotice } = useJournal();
  const today = toWorkDate(new Date(), timezone);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{ entries: ActivityLog[]; key: string } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const queryKey = JSON.stringify([profileId, query, filterDate]);
  const waiting = search.trim() !== query || (result?.key !== queryKey && failedKey !== queryKey);
  const filtered = Boolean(search.trim() || filterDate);
  const entries = result?.key === queryKey && failedKey !== queryKey ? result.entries : emptyEntries;

  useEffect(() => {
    const timeout = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    setFailedKey(null);
    void repository.list(profileId, { search: query, workDate: filterDate ? parseWorkDate(filterDate) : null }).then(
      (entries) => { if (!cancelled) setResult({ entries, key: queryKey }); },
      () => { if (!cancelled) setFailedKey(queryKey); },
    );
    return () => { cancelled = true; };
  }, [filterDate, profileId, query, queryKey, reload, repository]));

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 3000);
    return () => clearTimeout(timeout);
  }, [notice, setNotice]);

  const sections = useMemo(() => {
    const groups = new Map<string, ActivityLog[]>();
    for (const entry of entries) {
      const existing = groups.get(entry.workDate);
      if (existing) existing.push(entry);
      else groups.set(entry.workDate, [entry]);
    }
    return [...groups].map(([date, data]) => ({ key: date, date, data }));
  }, [entries]);

  function openCreate() {
    Keyboard.dismiss();
    router.push({ pathname: '/journal/edit', params: filterDate ? { date: filterDate } : {} });
  }

  function openEntry(entry: ActivityLog) {
    Keyboard.dismiss();
    router.push({ pathname: '/journal/[id]', params: { id: String(entry.id) } });
  }

  function clearSearch() {
    setSearch('');
    setQuery('');
  }

  const showFab = !keyboardVisible && (filtered || entries.length > 0 || failedKey === queryKey);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      {focused ? <StatusBar style="dark" /> : null}
      <SectionList
        style={styles.list}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(entry) => String(entry.id)}
        sections={sections}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <>
            <View style={styles.heading}>
              <Text accessibilityRole="header" style={styles.title}>My Journal</Text>
              <Text style={styles.support}>Your daily work, documented.</Text>
            </View>
            <View style={styles.tools}>
              <View style={[styles.search, searchFocused && styles.focusedSearch]}>
                <Search color={colors.textMuted} size={18} strokeWidth={1.8} />
                <TextInput accessibilityLabel="Search your activities" placeholder="Search your activities"
                  placeholderTextColor={colors.textMuted} selectionColor={colors.primary} underlineColorAndroid="transparent" autoCapitalize="none"
                  autoCorrect={false} returnKeyType="search" value={search} onChangeText={setSearch}
                  onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} style={styles.searchInput} />
                {search ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={clearSearch}
                    style={({ pressed }) => [styles.clear, pressed && styles.pressed]}>
                    <X color={colors.textSecondary} size={18} />
                  </Pressable>
                ) : null}
              </View>
              <JournalDatePicker compact value={filterDate} today={today} onChange={setFilterDate} />
            </View>
            {filterDate ? (
              <View style={styles.filterRow}>
                <Text style={styles.filterDate}>{formatJournalDate(filterDate)}</Text>
                <JournalLink label="Clear date" onPress={() => setFilterDate('')} />
              </View>
            ) : null}
          </>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.dateGroup}>
            <View style={styles.dateMarker} />
            <Text accessibilityRole="header" style={styles.dateHeading}>{formatJournalDate(section.date, {
              weekday: 'long', month: 'long', day: 'numeric',
              ...(section.date.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' } : {}),
            })}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" accessibilityLabel={item.title} accessibilityHint="Opens activity details"
            onPress={() => openEntry(item)} style={({ pressed }) => [styles.entry, pressed && styles.entryPressed]}>
            <Text style={styles.entryTitle}>{item.title}</Text>
            <Text numberOfLines={3} style={styles.description}>{item.content}</Text>
            {item.attendanceSessionId !== null ? (
              <Text style={styles.entryMeta}>{item.attendanceCreditedSeconds === null ? 'Linked to attendance'
                : `${formatAttendanceHours(item.attendanceCreditedSeconds)} credited · Attendance`}</Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          waiting ? (
            <View accessibilityLabel="Loading journal" accessible accessibilityState={{ busy: true }} style={styles.empty}>
              <View style={[styles.skeleton, styles.dateSkeleton]} />
              <View style={[styles.skeleton, styles.titleSkeleton]} />
              <View style={[styles.skeleton, styles.textSkeleton]} />
            </View>
          ) : failedKey === queryKey ? (
            <View style={styles.empty}>
              <Text accessibilityRole="header" style={styles.emptyTitle}>Journal couldn’t be loaded.</Text>
              <JournalLink label="Retry" onPress={() => setReload((current) => current + 1)} />
            </View>
          ) : filtered ? (
            <View style={styles.empty}>
              <Text accessibilityRole="header" style={styles.emptyTitle}>
                {search.trim() ? 'No matching activities' : 'No activities recorded for this date.'}
              </Text>
              {search.trim() ? (
                <>
                  <Text style={styles.support}>Try another search term.</Text>
                  <JournalLink label="Clear search" onPress={clearSearch} />
                </>
              ) : null}
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><BookOpen color={colors.primaryDark} size={20} strokeWidth={1.75} /></View>
              <Text accessibilityRole="header" style={styles.emptyTitle}>Your journal starts here</Text>
              <Text style={styles.support}>Record what you worked on and build a history of your progress.</Text>
              <JournalLink label="Add Your First Activity" onPress={openCreate} />
            </View>
          )
        }
      />
      {showFab || notice ? (
        <View style={styles.actionRail}>
          <View style={styles.noticeSpace}>
            {notice ? <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}
          </View>
          {showFab ? <AddActivity onPress={openCreate} /> : null}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  content: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', paddingTop: spacing.md, paddingBottom: spacing.sm, paddingHorizontal: 20 },
  heading: { marginBottom: spacing.md, gap: spacing.xxs },
  title: { color: colors.text, fontFamily: fontFamilies.heading, fontSize: 27, lineHeight: 34, letterSpacing: -0.6 },
  support: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 21 },
  tools: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, marginBottom: spacing.xs },
  search: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, paddingLeft: spacing.sm, backgroundColor: colors.surface },
  focusedSearch: { borderColor: colors.primary },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, paddingVertical: spacing.xs, paddingRight: spacing.xxs, color: colors.text, fontFamily: fontFamilies.body, fontSize: 14 },
  clear: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  filterRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: spacing.xs },
  filterDate: { flexShrink: 1, color: colors.primaryDark, fontFamily: fontFamilies.bodyMedium, fontSize: 13, lineHeight: 19 },
  dateGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: spacing.md, paddingBottom: spacing.xs },
  dateMarker: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  dateHeading: { flexShrink: 1, color: colors.primaryDark, fontFamily: fontFamilies.headingSemibold, fontSize: 13, lineHeight: 20, letterSpacing: 0.35, textTransform: 'uppercase' },
  entry: { paddingVertical: spacing.sm, gap: spacing.xxs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  entryPressed: { backgroundColor: '#EBF3F2' },
  entryTitle: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 17, lineHeight: 24 },
  description: { color: colors.textSecondary, fontFamily: fontFamilies.body, fontSize: 14, lineHeight: 22 },
  entryMeta: { color: colors.textMuted, fontFamily: fontFamilies.bodyMedium, fontSize: 12, lineHeight: 18 },
  empty: { paddingTop: spacing.lg, maxWidth: 340, gap: spacing.xs, alignItems: 'flex-start' },
  emptyIcon: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.text, fontFamily: fontFamilies.headingSemibold, fontSize: 19, lineHeight: 27 },
  link: { minHeight: layout.minimumTouchTarget, alignSelf: 'flex-start', justifyContent: 'center' },
  linkText: { color: colors.primaryDark, fontFamily: fontFamilies.label, fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.62 },
  skeleton: { backgroundColor: colors.border, height: 13, borderRadius: radius.sm },
  dateSkeleton: { width: 100, marginBottom: spacing.sm },
  titleSkeleton: { width: '58%', height: 18 },
  textSkeleton: { width: '86%' },
  actionRail: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 20, paddingTop: spacing.xxs, paddingBottom: spacing.sm },
  noticeSpace: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  notice: { color: colors.surface, backgroundColor: colors.primaryDark, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, fontFamily: fontFamilies.bodyMedium, fontSize: 13, lineHeight: 20 },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 2,
    shadowColor: colors.primaryDark, shadowOpacity: 0.15, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4 },
  fabPressed: { backgroundColor: colors.primaryDark },
});
