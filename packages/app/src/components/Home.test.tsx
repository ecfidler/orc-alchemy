import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Built2014 } from "@pubdoor/dmv";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, expect, test } from "vitest";
import { toSheet } from "../engine/sheet.ts";
import { saveCharacter } from "../storage/characters.ts";
import { Home } from "./Home.tsx";

afterEach(cleanup);

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");

function store(id: string, fixture: string, updatedAt: string) {
  const sheet = toSheet(JSON.parse(readFileSync(join(charactersDir, `${fixture}.expected.json`), "utf8")) as Built2014, {});
  const entity = { "~:orcpub.entity.strict/selections": [] };
  return saveCharacter({ format: "dmv-character", version: 1, rules: "2014", id, name: sheet.name, updatedAt, legacyId: null, entity }, sheet, "");
}

test("Home shows the three most recent characters and a link to all of them", async () => {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>,
  );
  expect(await screen.findByText("Characters you make or import show here.")).toBeTruthy();
  expect(screen.queryByRole("link", { name: /^All characters/ })).toBeNull();

  await act(() => store("a", "fighter-1", "2026-10-01T00:00:00.000Z"));
  await act(() => store("b", "wizard-5", "2026-10-04T00:00:00.000Z"));
  await act(() => store("c", "fighter-3-wizard-2", "2026-10-02T00:00:00.000Z"));
  await act(() => store("d", "barbarian-5", "2026-10-03T00:00:00.000Z"));

  const recent = await screen.findByRole("list", { name: "Recent characters" });
  await within(recent).findAllByRole("listitem");
  const rows = within(recent).getAllByRole("listitem");
  expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual(["Fimble Nackle", expect.any(String), "Corvin Half-Elven"]);
  expect(within(rows[0]).getByRole("link").getAttribute("href")).toBe("/sheet/b");
  expect(within(rows[2]).getByText("Half-Elf · Fighter 3 / Wizard 2")).toBeTruthy();
  expect(screen.getByRole("link", { name: "All characters (4)" }).getAttribute("href")).toBe("/characters");
});
