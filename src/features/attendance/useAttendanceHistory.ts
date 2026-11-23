import { useCallback, useMemo, useState } from 'react';

import { AttendanceHistoryRepository } from '@/database/repositories';
import type {
  AttendanceHistoryFilter,
  AttendanceMonthResult,
} from '@/database/repositories';
import { useDatabase } from '@/hooks/useDatabase';

const emptyResult: AttendanceMonthResult = {
  records: [],
  summary: { creditedSeconds: 0, completedWorkdays: 0, incompleteCount: 0 },
};

export function useAttendanceHistory(month: string, filter: AttendanceHistoryFilter) {
  const database = useDatabase();
  const repository = useMemo(() => new AttendanceHistoryRepository(database), [database]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [result, setResult] = useState<AttendanceMonthResult>(emptyResult);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setResult(await repository.getMonth(1, month, filter));
      setStatus('ready');
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error('Attendance history could not be loaded.'));
      setStatus('error');
    }
  }, [filter, month, repository]);

  return { status, result, error, load, repository } as const;
}

