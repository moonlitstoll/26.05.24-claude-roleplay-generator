import { useEffect, useState } from 'react';
import { applyResolvedTheme, normalizeThemePref, resolveTheme, ThemePref, THEME_STORAGE_KEY } from '../utils/theme';
import { readLocal, writeLocal } from '../utils/safeStorage';

const QUERY = '(prefers-color-scheme: dark)';

/** Holds the theme setting and applies it to <html>. On 'system' it also follows device changes. */
export function useTheme() {
  // Read once on the client. The value is only rendered inside the settings window, which starts
  // closed, so this cannot cause a hydration mismatch.
  const [theme, setThemeState] = useState<ThemePref>(() =>
    typeof window === 'undefined' ? 'system' : normalizeThemePref(readLocal(THEME_STORAGE_KEY))
  );

  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const apply = () => applyResolvedTheme(document, resolveTheme(theme, mq.matches));
    apply();
    if (theme !== 'system') return;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  const setTheme = (next: ThemePref) => {
    setThemeState(next);
    writeLocal(THEME_STORAGE_KEY, next);
  };

  return { theme, setTheme };
}
