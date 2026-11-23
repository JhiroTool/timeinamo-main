import { useContext } from 'react';

import { DatabaseContext } from '@/database/DatabaseContext';
import type { Database } from '@/types/database';

export function useDatabase(): Database {
  const state = useContext(DatabaseContext);
  if (state.status !== 'ready') {
    throw new Error('Database is not ready. Components must be inside DatabaseProvider.');
  }
  return state.database;
}

