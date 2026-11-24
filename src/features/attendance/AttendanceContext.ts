import { createContext } from 'react';

import type { AttendanceSession } from '@/types/models';

export interface AttendanceContextValue {
  status: 'loading' | 'ready' | 'error';
  activeSession: AttendanceSession | null;
  error: Error | null;
  operation: 'time_in' | 'time_out' | 'update_break' | null;
  refresh: () => Promise<void>;
  timeIn: () => Promise<AttendanceSession>;
  timeOut: (
    sessionId: number,
    unpaidBreakSeconds: number,
    occurredAt?: Date,
  ) => Promise<AttendanceSession>;
  updateUnpaidBreak: (sessionId: number, unpaidBreakSeconds: number) => Promise<AttendanceSession>;
}

export const AttendanceContext = createContext<AttendanceContextValue | null>(null);

