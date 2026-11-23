import { THEME_STORAGE_KEY } from "@orc-alchemy/ui";
import { optionNames, pickOption } from "@orc-alchemy/ui/testing";
import { act, cleanup, fireEvent, render as renderPage, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";
import { PREVIEW_2024_KEY } from "../state/preview-2024.ts";
import { Preferences } from "./Preferences.tsx";

// The Experimental section has a link, so the page needs a router.
const render = (page: ReactNode) => renderPage(<MemoryRouter>{page}</MemoryRouter>);

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

const preview = () => within(screen.getByRole("region", { name: "Experimental" })).getByRole("checkbox", { name: "2024 rules preview" });
const previewLink = () => screen.queryByRole("link", { name: "Open the 2024 rules preview" });

test("the Experimental section has the 2024 rules preview, off by default, with no link", () => {
  render(<Preferences />);
  expect(preview().getAttribute("aria-checked")).toBe("false");
  expect(previewLink()).toBeNull();
});

test("checking the 2024 rules preview stores its flag and shows the link to the preview", () => {
  render(<Preferences />);
  fireEvent.click(preview());
  expect(localStorage.getItem(PREVIEW_2024_KEY)).toBe("on");
  expect(preview().getAttribute("aria-checked")).toBe("true");
  expect(previewLink()?.getAttribute("href")).toBe("/dev/2024");

  fireEvent.click(preview());
  expect(localStorage.getItem(PREVIEW_2024_KEY)).toBeNull();
  expect(previewLink()).toBeNull();
});

test("a browser that has the flag on already shows the box checked", () => {
  localStorage.setItem(PREVIEW_2024_KEY, "on");
  render(<Preferences />);
  expect(preview().getAttribute("aria-checked")).toBe("true");
  expect(previewLink()).toBeTruthy();
});
