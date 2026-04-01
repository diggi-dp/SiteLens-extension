import { create } from 'zustand';
import type { ThemeMode, InteractionMode } from '../../shared/types';

const STORAGE_KEY = 'sitelens-settings';

export function hydrateRoute(): Promise<string> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(['sitelens-route'], (result) => {
          resolve((result as any)['sitelens-route'] || '/overview');
        });
      } else {
        resolve(localStorage.getItem('sitelens-route') || '/overview');
      }
    } catch {
      resolve('/overview');
    }
  });
}

export function persistRoute(route: string) {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ 'sitelens-route': route });
    } else {
      localStorage.setItem('sitelens-route', route);
    }
  } catch { /* ignore */ }
}

interface SettingsState {
  theme: ThemeMode;
  mode: InteractionMode;
  showBoxModel: boolean;
  showGridOverlay: boolean;
  showAccessibility: boolean;
  colorFormat: 'hex' | 'rgb' | 'hsl';
  keyboardShortcutsEnabled: boolean;
  commandPaletteOpen: boolean;

  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setMode: (mode: InteractionMode) => void;
  setShowBoxModel: (show: boolean) => void;
  setShowGridOverlay: (show: boolean) => void;
  setShowAccessibility: (show: boolean) => void;
  setColorFormat: (format: 'hex' | 'rgb' | 'hsl') => void;
  setKeyboardShortcuts: (enabled: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
}

// ── Read initial value from chrome.storage.local (synchronous default + async hydration) ──

function getInitialTheme(): ThemeMode {
  // First preference: see if we already loaded from storage (set before store init)
  const cached = (window as any).__slTheme as ThemeMode | undefined;
  if (cached) return cached;
  return 'light'; // safe default until storage resolves
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: getInitialTheme(),
  mode: 'floating',
  showBoxModel: true,
  showGridOverlay: false,
  showAccessibility: true,
  colorFormat: 'hex',
  keyboardShortcutsEnabled: true,
  commandPaletteOpen: false,

  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
    persistTheme(theme);
  },
  toggleTheme: () =>
    set((state) => {
      const next: ThemeMode = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      persistTheme(next);
      return { theme: next };
    }),
  setMode: (mode) => set({ mode }),
  setShowBoxModel: (show) => set({ showBoxModel: show }),
  setShowGridOverlay: (show) => set({ showGridOverlay: show }),
  setShowAccessibility: (show) => set({ showAccessibility: show }),
  setColorFormat: (format) => set({ colorFormat: format }),
  setKeyboardShortcuts: (enabled) => set({ keyboardShortcutsEnabled: enabled }),
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
}));

// ── Hydrate from chrome.storage.local on startup ───────────────────────────────

export function hydrateTheme(): Promise<ThemeMode> {
  return new Promise((resolve) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
          const saved: ThemeMode = (result as any)[STORAGE_KEY]?.theme || 'light';
          // Apply immediately to DOM before React paint
          applyTheme(saved);
          (window as any).__slTheme = saved;
          // Update the store if it's already initialised
          useSettingsStore.setState({ theme: saved });
          resolve(saved);
        });
      } else {
        // Fallback to localStorage (for dev)
        const raw = localStorage.getItem(STORAGE_KEY);
        const saved: ThemeMode = raw ? (JSON.parse(raw)?.theme || 'light') : 'light';
        applyTheme(saved);
        useSettingsStore.setState({ theme: saved });
        resolve(saved);
      }
    } catch {
      resolve('light');
    }
  });
}

// ── Persist theme ──────────────────────────────────────────────────────────────

function persistTheme(theme: ThemeMode) {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.set({ [STORAGE_KEY]: { theme } });
      // Also notify the content script so the floating panel header can update
      chrome.runtime.sendMessage({ type: '__THEME_CHANGED__', theme }).catch(() => {});
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme }));
    }
  } catch { /* ignore */ }
}

// ── Apply theme to the document root ─────────────────────────────────────────

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  const resolved = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  root.setAttribute('data-theme', resolved);
}
