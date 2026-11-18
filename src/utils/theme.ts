// Light/dark theme rules. The boot script in app/layout.tsx repeats resolveTheme; change both together.

export type ThemePref = 'system' | 'light' | 'dark';

export const THEME_OPTIONS: ThemePref[] = ['system', 'light', 'dark'];
export const THEME_STORAGE_KEY = 'roleplay_theme';

// Phone status bar colour: the page background of each theme.
const THEME_COLOR = { light: '#f8fafc', dark: '#0f172a' };

export function normalizeThemePref(value: unknown): ThemePref {
  return THEME_OPTIONS.includes(value as ThemePref) ? (value as ThemePref) : 'system';
}

export function resolveTheme(pref: ThemePref, systemDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return systemDark ? 'dark' : 'light';
  return pref;
}

export function applyResolvedTheme(doc: Document, resolved: 'light' | 'dark') {
  const dark = resolved === 'dark';
  const root = doc.documentElement;
  root.classList.toggle('dark', dark);
  // Keeps native parts (select, inputs, scrollbars) in step with the theme.
  root.style.colorScheme = resolved;
  let meta = doc.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    doc.head.appendChild(meta);
  }
  meta.setAttribute('content', THEME_COLOR[resolved]);
}
