import { useCallback, useMemo, useRef, useState } from 'react';

import { AttendanceHistoryRepository } from '@/database/repositories';
import type { AttendanceMonthResult } from '@/database/repositories';
import { useDatabase } from '@/hooks/useDatabase';

const emptyResult: AttendanceMonthResult = {
  records: [],
  summary: { creditedSeconds: 0, completedWorkdays: 0, incompleteCount: 0 },
};

interface MonthLoad {
  month: string;
  status: 'loading' | 'ready' | 'error';
  result?: AttendanceMonthResult;
}

export function useAttendanceHistory(month: string) {
  const database = useDatabase();
  const repository = useMemo(() => new AttendanceHistoryRepository(database), [database]);
  const [loadState, setLoadState] = useState<MonthLoad>({ month, status: 'loading' });
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestRequest.current;
    setLoadState((previous) => ({
      month,
      status: 'loading',
      ...(previous.month === month && previous.result ? { result: previous.result } : {}),
    }));
    try {
      const result = await repository.getMonth(1, month, 'all');
      if (request === latestRequest.current) setLoadState({ month, status: 'ready', result });
    } catch {
      if (request === latestRequest.current) setLoadState({ month, status: 'error' });
    }
  }, [month, repository]);

  const current = loadState.month === month ? loadState : undefined;
  return { status: current?.status ?? 'loading', result: current?.result ?? emptyResult, hasResult: Boolean(current?.result), load } as const;
}

