import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Built2014 } from "@pubdoor/dmv";
import { expect, test, vi } from "vitest";
import { toSheet } from "../engine/sheet.ts";
import {
  deleteCharacter,
  deleteDraft,
  getCharacter,
  getDraft,
  listSummaries,
  saveCharacter,
  saveDraft,
  useStorage,
  type CharacterRecord,
} from "./characters.ts";

// expected.json is evaluate(strict).built, so these tests need no engine.
const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const sheetOf = (name: string) => toSheet(JSON.parse(readFileSync(join(charactersDir, `${name}.expected.json`), "utf8")) as Built2014);

const record = (id: string, name: string | null): CharacterRecord => ({
  format: "dmv-character",
  version: 1,
  rules: "2014",
  id,
  name,
  updatedAt: "2026-10-03T00:00:00.000Z",
  legacyId: null,
  entity: { "~:orcpub.entity.strict/selections": [] },
});

test("create, update, delete and list characters and their summaries", async () => {
  const fighter = sheetOf("fighter-3-wizard-2");
  await saveCharacter(record("a", fighter.name), fighter);
  const wizard = sheetOf("wizard-5");
  await saveCharacter(record("b", wizard.name), wizard);

  expect(await getCharacter("a")).toEqual(record("a", "Corvin Half-Elven"));
  expect(await listSummaries()).toEqual([
    {
      id: "a",
      rules: "2014",
      name: "Corvin Half-Elven",
      race: "Half-Elf",
      classes: [
        { key: "2014/fighter", name: "Fighter", level: 3 },
        { key: "2014/wizard", name: "Wizard", level: 2 },
      ],
      portrait: null,
      updatedAt: "2026-10-03T00:00:00.000Z",
    },
    expect.objectContaining({ id: "b", rules: "2014", name: "Fimble Nackle" }),
  ]);

  // Saving again replaces the record and refreshes its summary.
  await saveCharacter({ ...record("a", "Corvin"), updatedAt: "2026-10-04T00:00:00.000Z" }, { ...fighter, name: "Corvin" });
  expect((await getCharacter("a"))?.name).toBe("Corvin");
  expect((await listSummaries()).find((s) => s.id === "a")).toMatchObject({ name: "Corvin", updatedAt: "2026-10-04T00:00:00.000Z" });

  await saveDraft({ id: "a", entity: { draft: true }, updatedAt: "2026-10-04T00:00:00.000Z" });
  await deleteCharacter("a");
  expect(await getCharacter("a")).toBeUndefined();
  expect(await getDraft("a")).toBeUndefined();
  expect((await listSummaries()).map((s) => s.id)).toEqual(["b"]);
  await deleteCharacter("b");
  expect(useStorage.getState().inMemory).toBe(false);
});

test("drafts are kept until deleted", async () => {
  const draft = { id: "c", entity: { draft: true }, updatedAt: "2026-10-03T00:00:00.000Z" };
  await saveDraft(draft);
  expect(await getDraft("c")).toEqual(draft);
  await deleteDraft("c");
  expect(await getDraft("c")).toBeUndefined();
});

test("a failed write is thrown and reported, and storage stays on IndexedDB", async () => {
  const sheet = sheetOf("wizard-5");
  await saveCharacter(record("d", sheet.name), sheet);

  // A function cannot be stored, so IndexedDB refuses this draft.
  await expect(saveDraft({ id: "d", entity: { notData: () => {} }, updatedAt: "" })).rejects.toThrow();
  expect(useStorage.getState()).toEqual({ inMemory: false, failed: true });
  expect((await getCharacter("d"))?.name).toBe("Fimble Nackle");

  useStorage.setState({ failed: false });
  await deleteCharacter("d");
});

test("a failed read is thrown but not reported as a failed save", async () => {
  // null is not an IndexedDB key, so the read is refused.
  await expect(getCharacter(null as unknown as string)).rejects.toThrow();
  expect(useStorage.getState()).toEqual({ inMemory: false, failed: false });
});

test("without IndexedDB, storage works in memory and says so", async () => {
  vi.resetModules();
  vi.stubGlobal("indexedDB", undefined);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const storage = await import("./characters.ts");
    const sheet = sheetOf("wizard-5");
    await storage.saveCharacter(record("m", sheet.name), sheet);

    expect(await storage.getCharacter("m")).toEqual(record("m", "Fimble Nackle"));
    expect((await storage.listSummaries()).map((s) => s.id)).toEqual(["m"]);
    expect(storage.useStorage.getState().inMemory).toBe(true);
  } finally {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  }
});
