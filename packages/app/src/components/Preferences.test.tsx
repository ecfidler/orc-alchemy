import { THEME_STORAGE_KEY } from "@orc-alchemy/ui";
import { optionNames, pickOption } from "@orc-alchemy/ui/testing";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { Preferences } from "./Preferences.tsx";

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

const theme = () => screen.getByRole("combobox", { name: "Theme" });

test("the Appearance section holds the theme choice, Match System is the default, and there is no Save button", async () => {
  render(<Preferences />);
  expect(screen.getByRole("heading", { level: 1, name: "Preferences" })).toBeTruthy();
  const appearance = screen.getByRole("region", { name: "Appearance" });
  expect(within(appearance).getByRole("combobox", { name: "Theme" })).toBe(theme());
  expect(theme().textContent).toBe("Match System");
  expect(await optionNames(theme())).toEqual(["Light", "Dark", "Match System"]);
  expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
});

test("Dark applies at once and is stored; Match System removes the key", async () => {
  render(<Preferences />);
  await pickOption(theme(), "Dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  expect(theme().textContent).toBe("Dark");

  await pickOption(theme(), "Match System");
  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  expect(theme().textContent).toBe("Match System");
});

test("the page shows a change made in another tab at once", () => {
  render(<Preferences />);
  localStorage.setItem(THEME_STORAGE_KEY, "light");
  act(() => {
    dispatchEvent(new StorageEvent("storage", { key: THEME_STORAGE_KEY, newValue: "light" }));
  });
  expect(theme().textContent).toBe("Light");
  expect(document.documentElement.dataset.theme).toBe("light");
});
