import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const THEMES = new Set(['light', 'dark', 'system']);

function initialTheme() {
  try {
    const stored = localStorage.getItem('taskflow-theme');
    return THEMES.has(stored) ? stored : 'light';
  } catch { return 'light'; }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(initialTheme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches || false);
  const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const update = (event) => setSystemDark(event.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const setTheme = useCallback((nextTheme) => {
    if (!THEMES.has(nextTheme)) return;
    setThemeState(nextTheme);
    try { localStorage.setItem('taskflow-theme', nextTheme); } catch { /* Storage can be unavailable in private mode. */ }
  }, []);
  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme must be used inside ThemeProvider.');
  return value;
}
