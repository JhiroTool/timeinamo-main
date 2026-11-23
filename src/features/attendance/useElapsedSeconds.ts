import { useEffect, useState } from 'react';

export function useElapsedSeconds(clockInAt: string | null, visible = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (!clockInAt || !visible) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [clockInAt, visible]);

  if (!clockInAt) return 0;
  return Math.max(0, Math.floor((now - new Date(clockInAt).getTime()) / 1000));
}

