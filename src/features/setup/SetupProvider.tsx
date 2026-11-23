import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SetupRepository } from '@/database/repositories';
import { useDatabase } from '@/hooks/useDatabase';
import type { SaveSetupInput, SetupData } from '@/database/repositories';

import { SetupContext, type SetupContextValue } from './SetupContext';

export function SetupProvider({ children }: PropsWithChildren) {
  const database = useDatabase();
  const repository = useMemo(() => new SetupRepository(database), [database]);
  const [status, setStatus] = useState<SetupContextValue['status']>('loading');
  const [data, setData] = useState<SetupData | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setData(await repository.get());
      setStatus('ready');
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error('Setup could not be loaded.'));
      setStatus('error');
    }
  }, [repository]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (input: SaveSetupInput) => {
      const saved = await repository.save(input);
      setData(saved);
      setError(null);
      setStatus('ready');
    },
    [repository],
  );

  const deleteAllLocalData = useCallback(async () => {
    await repository.deleteAllLocalData();
    setData(null);
    setError(null);
    setStatus('ready');
  }, [repository]);

  const value = useMemo<SetupContextValue>(
    () => ({
      status,
      data,
      isComplete: Boolean(data?.profile.setupCompletedAt),
      error,
      save,
      deleteAllLocalData,
      refresh,
    }),
    [data, deleteAllLocalData, error, refresh, save, status],
  );

  return <SetupContext.Provider value={value}>{children}</SetupContext.Provider>;
}

