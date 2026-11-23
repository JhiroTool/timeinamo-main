import { createContext } from 'react';

import type { DatabaseState } from '@/types/database';

export const DatabaseContext = createContext<DatabaseState>({ status: 'initializing' });

