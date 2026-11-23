import type { PropsWithChildren } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { DatabaseOperationError } from '@/database/errors';
import { createRepositories } from '@/database/repositories';
import { useSetup } from '@/features/setup/useSetup';
import { useDatabase } from '@/hooks/useDatabase';
import { AttendanceService } from '@/services/AttendanceService';
import type { AttendanceSession } from '@/types/models';

import { AttendanceContext, type AttendanceContextValue } from './AttendanceContext';

const PROFILE_ID = 1;

export function AttendanceProvider({ children }: PropsWithChildren) {
  const database = useDatabase();
  const { isComplete } = useSetup();
  const repositories = useMemo(() => createRepositories(database), [database]);
  const service = useMemo(() => new AttendanceService(repositories), [repositories]);
  const [status, setStatus] = useState<AttendanceContextValue['status']>('loading');
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<AttendanceSession[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [operation, setOperation] = useState<AttendanceContextValue['operation']>(null);
  const operationLock = useRef(false);

  const refresh = useCallback(async () => {
    if (!isComplete) {
      setActiveSession(null);
      setRecentSessions([]);
      setError(null);
      setStatus('ready');
      return;
    }
    try {
      const [active, recent] = await Promise.all([
        repositories.attendance.getActive(PROFILE_ID),
        repositories.attendance.listRecentCompleted(PROFILE_ID),
      ]);
      setActiveSession(active);
      setRecentSessions(recent);
      setError(null);
      setStatus('ready');
    } catch (reason) {
      const nextError =
        reason instanceof Error ? reason : new Error('Attendance could not be restored.');
      setError(nextError);
      setStatus('error');
    }
  }, [isComplete, repositories]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && !operationLock.current) void refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const timeIn = useCallback(async () => {
    if (operationLock.current) throw new DatabaseOperationError('Attendance update already in progress.');
    operationLock.current = true;
    setOperation('time_in');
    const occurredAt = new Date();
    try {
      const session = await service.startForProfile(PROFILE_ID, occurredAt);
      setActiveSession(session);
      setError(null);
      return session;
    } finally {
      operationLock.current = false;
      setOperation(null);
    }
  }, [service]);

  const timeOut = useCallback(
    async (sessionId: number, unpaidBreakSeconds: number, occurredAt = new Date()) => {
      if (operationLock.current) {
        throw new DatabaseOperationError('Attendance update already in progress.');
      }
      operationLock.current = true;
      setOperation('time_out');
      try {
        const session = await service.completeSession(
          sessionId,
          unpaidBreakSeconds,
          occurredAt,
        );
        setActiveSession(null);
        setRecentSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
        setError(null);
        return session;
      } finally {
        operationLock.current = false;
        setOperation(null);
      }
    },
    [service],
  );

  const updateUnpaidBreak = useCallback(
    async (sessionId: number, unpaidBreakSeconds: number) => {
      if (operationLock.current) {
        throw new DatabaseOperationError('Attendance update already in progress.');
      }
      operationLock.current = true;
      setOperation('update_break');
      try {
        const session = await service.updateUnpaidBreak(sessionId, unpaidBreakSeconds);
        setActiveSession(session);
        setError(null);
        return session;
      } finally {
        operationLock.current = false;
        setOperation(null);
      }
    },
    [service],
  );

  const value = useMemo<AttendanceContextValue>(
    () => ({
      status,
      activeSession,
      recentSessions,
      error,
      operation,
      refresh,
      timeIn,
      timeOut,
      updateUnpaidBreak,
    }),
    [
      activeSession,
      error,
      operation,
      recentSessions,
      refresh,
      status,
      timeIn,
      timeOut,
      updateUnpaidBreak,
    ],
  );

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

