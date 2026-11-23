import { createContext, useContext, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { ActivityLogRepository } from '@/database/repositories';
import { useSetup } from '@/features/setup/useSetup';
import { useDatabase } from '@/hooks/useDatabase';
import type { DateFormat } from '@/types/models';

interface JournalContextValue {
  repository: ActivityLogRepository;
  profileId: number;
  timezone: string;
  dateFormat: DateFormat;
  notice: string | null;
  setNotice: (notice: string | null) => void;
}

const JournalContext = createContext<JournalContextValue | null>(null);

export function JournalProvider({ children }: PropsWithChildren) {
  const database = useDatabase();
  const repository = useMemo(() => new ActivityLogRepository(database), [database]);
  const { data } = useSetup();
  const profileId = data?.profile.id ?? 1;
  const timezone = data?.workSettings.timezone ?? 'Asia/Manila';
  const dateFormat = data?.workSettings.dateFormat ?? 'mdy';
  const [notice, setNotice] = useState<string | null>(null);
  const value = useMemo(() => ({ repository, profileId, timezone, dateFormat, notice, setNotice }),
    [repository, profileId, timezone, dateFormat, notice]);
  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournal() {
  const value = useContext(JournalContext);
  if (!value) throw new Error('Journal screens require JournalProvider.');
  return value;
}
