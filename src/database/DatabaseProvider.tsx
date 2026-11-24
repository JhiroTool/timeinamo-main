import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { DatabaseErrorView } from '@/components/DatabaseErrorView';
import { LoadingState } from '@/components/ui';
import type { DatabaseState } from '@/types/database';

import { DatabaseContext } from './DatabaseContext';
import { initializeDatabase } from './database';
import { DatabaseRecoveryRequiredError } from './errors';

export function DatabaseProvider({ children, onErrorLayout }: PropsWithChildren<{ onErrorLayout: () => void }>) {
  const [state, setState] = useState<DatabaseState>({ status: 'initializing' });
  const [attempt, setAttempt] = useState({ recoverMissingProfile: false });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'initializing' });
    initializeDatabase(attempt).then(
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

  const retry = useCallback(() => setAttempt({ recoverMissingProfile: false }), []);
  const recover = useCallback(() => setAttempt({ recoverMissingProfile: true }), []);
  const contextValue = useMemo(() => state, [state]);

  if (state.status === 'initializing') {
    return <LoadingState fullPage label="Preparing your local workspace…" />;
  }
  if (state.status === 'error') {
    return (
      <DatabaseErrorView
        error={state.error}
        onLayout={onErrorLayout}
        onRetry={retry}
        {...(state.error instanceof DatabaseRecoveryRequiredError ? { onRecover: recover } : {})}
      />
    );
  }

  return <DatabaseContext.Provider value={contextValue}>{children}</DatabaseContext.Provider>;
}

