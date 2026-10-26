import { useCallback, useSyncExternalStore } from "react";

/** The `localStorage` key for the theme override. This package owns it. */
export const THEME_STORAGE_KEY = "theme";

/** "system" is never stored: Match System removes the key. */
export type ThemePreference = "light" | "dark" | "system";

/**
 * A classic script for the app's `<head>`, before the module script. It
 * applies a stored override before first paint, and follows changes made in
 * other tabs. `packages/app/index.html` holds a copy; a test there checks
 * that the copy matches.
 */
export const themeHeadScript = `(function () {
  var root = document.documentElement;
  function apply(value) {
    if (value === "light" || value === "dark") root.dataset.theme = value;
    else delete root.dataset.theme;
  }
  try { apply(localStorage.getItem("${THEME_STORAGE_KEY}")); } catch (e) {}
  addEventListener("storage", function (event) {
    if (event.key === "${THEME_STORAGE_KEY}" || event.key === null) apply(event.newValue);
  });
})();`;

// The choice when storage is blocked. It lasts until the page reloads.
let unstored: ThemePreference = "system";

function read(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return unstored;
  }
}

function apply(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) listener();
  };
  addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    removeEventListener("storage", onStorage);
  };
}

/**
 * The stored theme preference and a setter. The setter writes the key (or
 * removes it for "system") and sets `data-theme` on `<html>` at once. A
 * change in another tab re-renders the hook.
 */
export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const preference = useSyncExternalStore(subscribe, read, () => "system" as const);
  const setPreference = useCallback((next: ThemePreference) => {
    try {
      if (next === "system") localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      unstored = next;
    }
    apply(next);
    for (const listener of listeners) listener();
  }, []);
  return [preference, setPreference];
}
