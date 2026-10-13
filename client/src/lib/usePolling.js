import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Calls `fetcher` now and then every `intervalMs`, pausing while the tab is hidden.
 * Keeps the last good data if a refresh fails, so the screen never goes blank mid-event.
 */
export function usePolling(fetcher, intervalMs = 10_000) {
  const [state, setState] = useState({ data: null, error: null, loading: true, updatedAt: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    try {
      const data = await fetcherRef.current();
      setState({ data, error: null, loading: false, updatedAt: Date.now() });
    } catch (error) {
      setState((s) => ({ ...s, error, loading: false }));
    }
  }, []);

  useEffect(() => {
    refresh();
    const tick = () => { if (!document.hidden) refresh(); };
    const id = setInterval(tick, intervalMs);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [refresh, intervalMs]);

  return { ...state, refresh };
}
