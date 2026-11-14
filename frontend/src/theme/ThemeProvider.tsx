import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ThemeContext,
  applyThemeToDocument,
  initialThemeId,
  storeTheme,
  type ThemeContextValue,
} from './theme-context';
import type { ThemeId } from './themes';

/**
 * Owns the active theme. Switching is instant (no reload): it swaps the
 * `data-theme` attribute, so every component, chart and map control re-reads
 * the same semantic variables. The selection persists in localStorage.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeState] = useState<ThemeId>(() => initialThemeId());

  // Keep <html> in sync before children paint or read computed styles.
  useLayoutEffect(() => {
    applyThemeToDocument(themeId);
  }, [themeId]);

  const setThemeId = useCallback((id: ThemeId) => {
    applyThemeToDocument(id);
    storeTheme(id);
    setThemeState(id);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ themeId, setThemeId }), [themeId, setThemeId]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
