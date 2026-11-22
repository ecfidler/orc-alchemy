import { useCallback } from "react";
import { storedValue, useStoredValue } from "./stored-value.ts";

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

const store = storedValue<ThemePreference>(THEME_STORAGE_KEY, {
  parse: (stored) => (stored === "light" || stored === "dark" ? stored : "system"),
  serialize: (preference) => (preference === "system" ? null : preference),
  fallback: "system",
});

function apply(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
}

// Each write in this tab and each change in another tab sets data-theme, while a hook listens.
const subscribe = (listener: () => void) =>
  store.subscribe(() => {
    apply(store.read());
    listener();
  });
const themeStore = { ...store, subscribe };

/**
 * The stored theme preference and a setter. The setter writes the key (or
 * removes it for "system") and sets `data-theme` on `<html>` at once. A
 * change in another tab sets `data-theme` here too, and re-renders the hook.
 * When the storage is blocked, the choice lasts until the page reloads.
 */
export function useThemePreference(): [ThemePreference, (preference: ThemePreference) => void] {
  const [preference, write] = useStoredValue(themeStore, "system");
  const setPreference = useCallback(
    (next: ThemePreference) => {
      write(next);
      // Also here, so that data-theme does not depend on a listener.
      apply(next);
    },
    [write],
  );
  return [preference, setPreference];
}
