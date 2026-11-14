import { createContext, useContext } from 'react';
import { DEFAULT_THEME, THEME_STORAGE_KEY, getTheme, isThemeId, type ThemeId } from './themes';

export interface ThemeContextValue {
  themeId: ThemeId;
  setThemeId: (id: ThemeId) => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}

/** Storage can be unavailable (private mode, blocked site data); never let that break the app. */
export function readStoredTheme(): ThemeId | null {
  try {
    const v = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(v) ? v : null;
  } catch {
    return null;
  }
}

export function storeTheme(id: ThemeId): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* non-fatal: theme still applies for this session */
  }
}

/**
 * Apply a theme to <html>: `data-theme` selects the variable set, `.dark` drives
 * shadcn's dark: variants. Synchronous, so computed styles are updated immediately
 * (the map reads them right after).
 */
export function applyThemeToDocument(id: ThemeId, root: HTMLElement = document.documentElement) {
  const theme = getTheme(id);
  root.dataset.theme = theme.id;
  root.classList.toggle('dark', theme.mode === 'dark');
  root.style.colorScheme = theme.mode;
}

export function initialThemeId(root: HTMLElement = document.documentElement): ThemeId {
  const fromDom = root.dataset.theme;
  if (isThemeId(fromDom)) return fromDom;
  return readStoredTheme() ?? DEFAULT_THEME;
}
