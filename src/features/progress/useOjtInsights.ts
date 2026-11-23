import { useCallback, useMemo, useState } from 'react';

import { OjtInsightsRepository } from '@/database/repositories';
import type { OjtInsightsSnapshot } from '@/database/repositories';
import { useDatabase } from '@/hooks/useDatabase';
import { getMondayWeekStart, shiftWorkDate } from '@/services/ojtProgressCalculations.js';
import { parseWorkDate, toWorkDate } from '@/utils/time';

export function useOjtInsights(timezone: string) {
  const database = useDatabase();
  const repository = useMemo(() => new OjtInsightsRepository(database), [database]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [data, setData] = useState<OjtInsightsSnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const today = toWorkDate(new Date(), timezone);
      const weeklyFrom = parseWorkDate(shiftWorkDate(getMondayWeekStart(today), -35));
      setData(await repository.getSnapshot(1, today, weeklyFrom));
      setStatus('ready');
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error('Progress data could not be loaded.'));
      setStatus('error');
    }
  }, [repository, timezone]);

  return { status, data, error, load } as const;
}

