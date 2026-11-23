import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { ActivityLog } from '@/types/models';

import { useJournal } from './JournalContext';

export function useJournalEntry(id: string | undefined) {
  const { repository, profileId } = useJournal();
  const [request, setRequest] = useState(0);
  const [state, setState] = useState<{ id: string; entry: ActivityLog | null; error?: boolean } | null>(null);
  useFocusEffect(useCallback(() => {
    if (id === undefined) return;
    let cancelled = false;
    const numericId = Number(id);
    if (!Number.isSafeInteger(numericId) || numericId <= 0) {
      setState({ id, entry: null, error: true });
      return;
    }
    void repository.getById(numericId, profileId).then(
      (entry) => { if (!cancelled) setState({ id, entry }); },
      () => { if (!cancelled) setState({ id, entry: null, error: true }); },
    );
    return () => { cancelled = true; };
  }, [id, profileId, repository, request]));

  const current = state?.id === id ? state : null;
  return {
    entry: current?.entry ?? null,
    loading: id !== undefined && !current,
    error: Boolean(current?.error),
    retry: () => { setState(null); setRequest((value) => value + 1); },
  };
}
