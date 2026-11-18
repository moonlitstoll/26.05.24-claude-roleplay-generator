import { useEffect, useState } from 'react';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Tells whether a newer build has been deployed than the one this page was loaded from.
 * An installed app can stay open (or suspended) for days, so it would otherwise keep running old code.
 * Checked on start, when the app comes back to the foreground, and every 5 minutes.
 * Offline or failed checks are ignored quietly.
 */
export function useAppUpdate(): boolean {
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    const currentId = process.env.NEXT_PUBLIC_BUILD_ID;
    if (!currentId || currentId === 'local') return;

    let stopped = false;

    const check = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data: { buildId?: string } = await res.json();
        if (!stopped && data.buildId && data.buildId !== currentId) setUpdateReady(true);
      } catch {
        // offline or server unreachable: try again on the next tick
      }
    };

    check();
    const timer = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return updateReady;
}
