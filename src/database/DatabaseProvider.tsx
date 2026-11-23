import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DatabaseErrorView } from '@/components/DatabaseErrorView';
import { AppLoadingView } from '@/components/AppLoadingView';
import type { DatabaseState } from '@/types/database';

import { DatabaseContext } from './DatabaseContext';
import { initializeDatabase } from './database';

export function DatabaseProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<DatabaseState>({ status: 'initializing' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'initializing' });
    initializeDatabase().then(
      (database) => {
        if (!cancelled) setState({ status: 'ready', database });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            error: error instanceof Error ? error : new Error('Unknown database error'),
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const contextValue = useMemo(() => state, [state]);

  if (state.status === 'initializing') return <AppLoadingView />;
  if (state.status === 'error') {
    return <DatabaseErrorView error={state.error} onRetry={retry} />;
  }

  return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>;
}

