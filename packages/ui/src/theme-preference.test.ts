import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { THEME_STORAGE_KEY, themeHeadScript, useThemePreference } from "./theme-preference.ts";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

test("with no stored value, the preference is system and <html> has no data-theme", () => {
  const { result } = renderHook(() => useThemePreference());
  expect(result.current[0]).toBe("system");
  expect(document.documentElement.dataset.theme).toBeUndefined();
});

test("a choice writes the key and sets data-theme; Match System removes both", () => {
  const { result } = renderHook(() => useThemePreference());

  act(() => result.current[1]("dark"));
  expect(result.current[0]).toBe("dark");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");

  act(() => result.current[1]("system"));
  expect(result.current[0]).toBe("system");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  expect(document.documentElement.dataset.theme).toBeUndefined();
});

test("two hooks in one tab agree", () => {
  const a = renderHook(() => useThemePreference());
  const b = renderHook(() => useThemePreference());
  act(() => a.result.current[1]("light"));
  expect(b.result.current[0]).toBe("light");
});

test("a change in another tab re-renders the hook", () => {
  const { result } = renderHook(() => useThemePreference());
  act(() => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "dark" }));
  });
  expect(result.current[0]).toBe("dark");
});

test("the head script applies the stored override, and follows other tabs", () => {
  localStorage.setItem(THEME_STORAGE_KEY, "dark");
  new Function(themeHeadScript)();
  expect(document.documentElement.dataset.theme).toBe("dark");

  dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "light" }));
  expect(document.documentElement.dataset.theme).toBe("light");
  dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: null }));
  expect(document.documentElement.dataset.theme).toBeUndefined();
});

test("the head script ignores a value that is not light or dark", () => {
  localStorage.setItem(THEME_STORAGE_KEY, "system");
  new Function(themeHeadScript)();
  expect(document.documentElement.dataset.theme).toBeUndefined();
});
