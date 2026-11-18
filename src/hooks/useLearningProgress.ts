import { useCallback, useMemo, useState } from 'react';
import { readLocal, writeLocal } from '../utils/safeStorage';

// { [session id]: { [line number]: { status, miss, ts } } }
// Saved scripts never change, so session id + line number always points at the same sentence.
const STORAGE_KEY = 'roleplay_learn_progress';

interface LineProgress {
  status: 'known' | 'unknown';
  miss: number;
  ts: number;
}
type ProgressStore = Record<string, Record<string, LineProgress>>;

function loadStore(): ProgressStore {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(readLocal(STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function useLearningProgress(sessionId: string | undefined, lineCount: number) {
  const [store, setStore] = useState<ProgressStore>(loadStore);

  const update = useCallback((change: (prev: ProgressStore) => ProgressStore) => {
    setStore(prev => {
      const next = change(prev);
      if (next !== prev) writeLocal(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const mark = useCallback((idx: number, known: boolean) => {
    if (!sessionId) return;
    update(prev => {
      const lines = prev[sessionId] || {};
      const miss = lines[idx]?.miss || 0;
      return {
        ...prev,
        [sessionId]: {
          ...lines,
          [idx]: { status: known ? 'known' : 'unknown', miss: known ? miss : miss + 1, ts: Date.now() },
        },
      };
    });
  }, [sessionId, update]);

  const clearSession = useCallback((id: string | undefined) => {
    if (!id) return;
    update(prev => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [update]);

  const clearAll = useCallback(() => update(prev => (Object.keys(prev).length ? {} : prev)), [update]);

  const wrongIndices = useMemo(() => {
    const lines = (sessionId && store[sessionId]) || {};
    return Object.keys(lines)
      .filter(key => lines[key].status === 'unknown')
      .map(Number)
      .filter(idx => idx < lineCount)
      .sort((a, b) => a - b);
  }, [store, sessionId, lineCount]);

  return { mark, wrongIndices, clearSession, clearAll };
}
