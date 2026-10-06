import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Built2014 } from "@pubdoor/dmv";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import { toSheet } from "../engine/sheet.ts";
import { getCharacter, listSummaries, saveCharacter, useStorage } from "../storage/characters.ts";
import { CharacterList } from "./CharacterList.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// expected.json is evaluate(strict).built, so these tests need no engine.
const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");

function store(id: string, fixture: string, portrait: string | null = null, fingerprint = "") {
  const sheet = toSheet(JSON.parse(readFileSync(join(charactersDir, `${fixture}.expected.json`), "utf8")) as Built2014, {});
  const entity = { "~:orcpub.entity.strict/selections": [] };
  sheet.portrait = portrait;
  return saveCharacter(
    { format: "dmv-character", version: 1, rules: "2014", id, name: sheet.name, updatedAt: "2026-10-03T00:00:00.000Z", legacyId: null, entity },
    sheet,
    fingerprint,
  );
}

test("the list follows the summaries index, and delete asks first", async () => {
  render(
    <MemoryRouter>
      <CharacterList />
    </MemoryRouter>,
  );
  expect(await screen.findByText("No characters yet. Import a character file to add one.")).toBeTruthy();

  await act(() => store("a", "fighter-3-wizard-2"));
  await act(() => store("b", "wizard-5", "https://example.com/fimble.png"));
  const corvin = await screen.findByRole("listitem", { name: "Corvin Half-Elven" });
  expect(within(corvin).getByRole("link", { name: "Corvin Half-Elven" }).getAttribute("href")).toBe("/sheet/a");
  expect(within(corvin).getByText("Half-Elf · Fighter 3 / Wizard 2")).toBeTruthy();
  expect(corvin.querySelector("img")).toBeNull();
  expect(screen.getByRole("listitem", { name: "Fimble Nackle" }).querySelector("img")?.getAttribute("src")).toBe("https://example.com/fimble.png");
  expect(screen.getAllByRole("listitem").map((item) => item.getAttribute("aria-label"))).toEqual(["Corvin Half-Elven", "Fimble Nackle"]);

  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(within(corvin).getByRole("button", { name: "Delete Corvin Half-Elven" }));
  expect(confirm).toHaveBeenCalledWith("Delete Corvin Half-Elven? This cannot be undone.");
  expect(await getCharacter("a")).toBeDefined();

  confirm.mockReturnValue(true);
  fireEvent.click(within(corvin).getByRole("button", { name: "Delete Corvin Half-Elven" }));
  await vi.waitFor(() => expect(screen.queryByRole("listitem", { name: "Corvin Half-Elven" })).toBeNull());
  expect(await getCharacter("a")).toBeUndefined();
  expect((await listSummaries()).map((s) => s.id)).toEqual(["b"]);
  expect(screen.getByRole("listitem", { name: "Fimble Nackle" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Export Fimble Nackle" })).toBeTruthy();
  // Focus stays in the list rather than falling to the page.
  expect(document.activeElement).toBe(screen.getByRole("list", { name: "Characters" }).parentElement);
});

test("a failed read says so, without reporting a failed save, and Try again re-reads", async () => {
  await store("e", "barbarian-5");
  vi.spyOn(IDBObjectStore.prototype, "getAll").mockImplementationOnce(() => {
    throw new DOMException("Read failed", "UnknownError");
  });
  render(
    <MemoryRouter>
      <CharacterList />
    </MemoryRouter>,
  );
  expect((await screen.findByRole("alert")).textContent).toBe("The characters could not be read from this browser");
  expect(useStorage.getState().failed).toBe(false);

  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("listitem", { name: "Korga Stormhide" })).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a summary built with other homebrew is rebuilt with the loaded homebrew", async () => {
  // Built with a pack since removed: the stored summary is Korga's, but the record's entity has no selections.
  await store("f", "barbarian-5", null, "stale");
  render(
    <MemoryRouter>
      <CharacterList />
    </MemoryRouter>,
  );
  expect(await screen.findByRole("listitem", { name: "Korga Stormhide" })).toBeTruthy();
  expect(await screen.findByRole("listitem", { name: "Unnamed character" }, { timeout: 10000 })).toBeTruthy();
  expect((await listSummaries()).find((s) => s.id === "f")).toMatchObject({ name: null, fingerprint: "" });
}, 20000);
