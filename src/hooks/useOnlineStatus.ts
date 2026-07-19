import { useEffect, useState } from 'react';
import { checkBackendOnline } from '../api/client';

const POLL_INTERVAL_MS = 15000;

export function useOnlineStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      const result = await checkBackendOnline();
      if (!cancelled) setOnline(result);
    }
    poll();
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return online;
}
