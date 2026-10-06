import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, expect, test, vi } from "vitest";
import { useHomebrew } from "../state/homebrew.ts";
import type { PackRecord } from "../storage/packs.ts";
import { LoadHomebrew } from "./LoadHomebrew.tsx";

afterEach(async () => {
  cleanup();
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
  useHomebrew.setState({ lastImport: null });
});

const orcbrewDir = join(import.meta.dirname, "../../../../fixtures/orcbrew");

function choose(name: string, text: string) {
  fireEvent.change(screen.getByLabelText("Load homebrew file"), { target: { files: [new File([text], name)] } });
}

test("a chosen pack is listed with its import log, its checkbox disables it, and Remove takes it out", async () => {
  render(<LoadHomebrew />);
  choose("warlock-test-content.orcbrew", readFileSync(join(orcbrewDir, "warlock-test-content.orcbrew"), "utf8"));

  const pack = await screen.findByRole("listitem", { name: "warlock-test-content" });
  const log = screen.getByRole("region", { name: "Last homebrew import" });
  expect(within(log).getByText(/^✅ Import successful/)).toBeTruthy();
  expect(within(log).getByText(/"imported-count": 3/)).toBeTruthy();

  const enabled = within(pack).getByRole<HTMLInputElement>("checkbox", { name: "warlock-test-content" });
  expect(enabled.checked).toBe(true);
  fireEvent.click(enabled);
  await waitFor(() => expect(enabled.checked).toBe(false));
  expect(useHomebrew.getState().homebrew).toBeUndefined();

  fireEvent.click(within(pack).getByRole("button", { name: "Remove warlock-test-content" }));
  await waitFor(() => expect(screen.queryByRole("list", { name: "Homebrew packs" })).toBeNull());
});

test("a file that does not parse lists no pack and its log says why", async () => {
  render(<LoadHomebrew />);
  choose("broken.orcbrew", "{:orcpub.dnd.e5/spells {:fireball");

  const log = await screen.findByRole("region", { name: "Last homebrew import" });
  expect(within(log).getByText(/^⚠️ Could not read file/)).toBeTruthy();
  expect(within(log).getByText(/"parse-error": true/)).toBeTruthy();
  expect(screen.queryByRole("list", { name: "Homebrew packs" })).toBeNull();
});

test("a stored pack that could not be read shows a warning, and the other packs are listed", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.resetModules();
  try {
    const { savePacks } = await import("../storage/packs.ts");
    const { LoadHomebrew } = await import("./LoadHomebrew.tsx");
    const good: PackRecord = { id: "good", rules: "2014", enabled: true, disabledItems: [], plugin: {}, updatedAt: "" };
    await savePacks([good, { ...good, id: "bad", plugin: "not a map" as unknown as object }]);

    render(<LoadHomebrew />);
    const warning = await screen.findByRole("alert", { name: "Unreadable homebrew packs" });
    expect(warning.textContent).toBe("The stored pack bad could not be read, so it is not used. It is kept in this browser as it is. The record is not a stored pack.");
    expect(within(screen.getByRole("list", { name: "Homebrew packs" })).getByRole("listitem", { name: "good" })).toBeTruthy();
  } finally {
    vi.unstubAllGlobals();
  }
});
