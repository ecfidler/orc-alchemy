import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Built2014 } from "@pubdoor/dmv";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import { toSheet } from "../engine/sheet.ts";
import { getCharacter, listSummaries, saveCharacter } from "../storage/characters.ts";
import { CharacterList } from "./CharacterList.tsx";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// expected.json is evaluate(strict).built, so these tests need no engine.
const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");

function store(id: string, fixture: string, portrait: string | null = null) {
  const sheet = toSheet(JSON.parse(readFileSync(join(charactersDir, `${fixture}.expected.json`), "utf8")) as Built2014, {});
  const entity = { "~:orcpub.entity.strict/selections": [] };
  sheet.portrait = portrait;
  return saveCharacter(
    { format: "dmv-character", version: 1, rules: "2014", id, name: sheet.name, updatedAt: "2026-10-03T00:00:00.000Z", legacyId: null, entity },
    sheet,
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
});
