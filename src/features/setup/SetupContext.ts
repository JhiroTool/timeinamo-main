import { createContext } from 'react';

import type { SaveSetupInput, SetupData } from '@/database/repositories';

export interface SetupContextValue {
  status: 'loading' | 'ready' | 'error';
  data: SetupData | null;
  isComplete: boolean;
  error: Error | null;
  save: (input: SaveSetupInput) => Promise<void>;
  deleteAllLocalData: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const SetupContext = createContext<SetupContextValue | null>(null);

