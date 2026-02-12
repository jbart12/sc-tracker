import { useState, useEffect, useCallback, useRef } from 'react';

export type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

const HEALTH_URL = '/api/health';
const HEALTH_TIMEOUT_MS = 3000;
const POLL_CONNECTED_MS = 30000;
const POLL_DISCONNECTED_MS = 5000;

async function checkHealth(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(HEALTH_URL, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef(status);
  statusRef.current = status;

  const schedulePolling = useCallback((connected: boolean) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    const interval = connected ? POLL_CONNECTED_MS : POLL_DISCONNECTED_MS;
    intervalRef.current = setInterval(async () => {
      const ok = await checkHealth();
      const next = ok ? 'connected' : 'disconnected';
      setStatus(prev => {
        if (prev !== next) {
          // Re-schedule with the new interval when status changes
          if (intervalRef.current) clearInterval(intervalRef.current);
          const newInterval = ok ? POLL_CONNECTED_MS : POLL_DISCONNECTED_MS;
          intervalRef.current = setInterval(async () => {
            const ok2 = await checkHealth();
            setStatus(ok2 ? 'connected' : 'disconnected');
          }, newInterval);
        }
        return next;
      });
    }, interval);
  }, []);

  const checkNow = useCallback(async (): Promise<boolean> => {
    const ok = await checkHealth();
    const next = ok ? 'connected' : 'disconnected';
    setStatus(next);
    schedulePolling(ok);
    return ok;
  }, [schedulePolling]);

  // Initial check + online/offline listeners
  useEffect(() => {
    // Initial health check
    checkHealth().then(ok => {
      const initial = ok ? 'connected' : 'disconnected';
      setStatus(initial);
      schedulePolling(ok);
    });

    const handleOnline = () => {
      // Browser came back online — do an immediate health check
      checkHealth().then(ok => {
        setStatus(ok ? 'connected' : 'disconnected');
        schedulePolling(ok);
      });
    };

    const handleOffline = () => {
      setStatus('disconnected');
      schedulePolling(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [schedulePolling]);

  return { status, checkNow };
}
