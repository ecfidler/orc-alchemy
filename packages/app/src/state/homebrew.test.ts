import "fake-indexeddb/auto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, test, vi } from "vitest";
import type { PackRecord } from "../storage/packs.ts";

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");
const readPack = (name: string) => readFileSync(join(fixturesDir, "orcbrew", `${name}.orcbrew`), "utf8");
const readFixture = (file: string) => JSON.parse(readFileSync(join(fixturesDir, "characters", file), "utf8"));

/** The app's modules as a new page load has them: nothing read from storage yet, and the engine loaded. */
async function reload() {
  vi.resetModules();
  const { engine, loadEngine } = await import("../engine/engine.ts");
  await loadEngine();
  const { restorePacks, useHomebrew } = await import("./homebrew.ts");
  const storage = await import("../storage/packs.ts");
  const load = (name: string) => useHomebrew.getState().load(`${name}.orcbrew`, readPack(name));
  return { engine, restorePacks, useHomebrew, load, ...storage };
}

// Each test starts with an empty database.
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  return () => vi.unstubAllGlobals();
});

test.each([
  "duplicate-external-a",
  "duplicate-external-b",
  "warlock-test-content",
  "community-mezzoloth-race",
  "community-dandwiki-star-elf",
  "community-gmbinder-homebrew",
])("%s.orcbrew loads as a pack named for the file, stored for 2014 rules", async (name) => {
  const { useHomebrew, load, listPacks } = await reload();
  await load(name);
  const { homebrew, lastImport } = useHomebrew.getState();
  expect(lastImport?.success).toBe(true);
  expect(lastImport?.log.message).toContain("Import successful");
  expect(Object.keys(homebrew!)).toEqual([name]);
  expect(await listPacks()).toEqual([expect.objectContaining({ id: name, rules: "2014", enabled: true, disabledItems: [] })]);
});

test("the pack name drops the extension in any case", async () => {
  const { useHomebrew } = await reload();
  await useHomebrew.getState().load("warlock-test-content.ORCBREW", readPack("warlock-test-content"));
  expect(Object.keys(useHomebrew.getState().homebrew!)).toEqual(["warlock-test-content"]);
});

test("a second file merges in and reports its key conflicts; removing a pack keeps the others", async () => {
  const { useHomebrew, load, listPacks } = await reload();
  await load("duplicate-external-a");
  await load("duplicate-external-b");
  expect(Object.keys(useHomebrew.getState().homebrew!)).toEqual(["duplicate-external-a", "duplicate-external-b"]);
  expect(useHomebrew.getState().lastImport?.conflicts.map((c) => c.key)).toContain("artificer");

  await useHomebrew.getState().remove("duplicate-external-a");
  expect(Object.keys(useHomebrew.getState().homebrew!)).toEqual(["duplicate-external-b"]);
  await useHomebrew.getState().remove("duplicate-external-b");
  expect(useHomebrew.getState().homebrew).toBeUndefined();
  expect(await listPacks()).toEqual([]);
});

test("a file that does not parse keeps the loaded homebrew and its log says why", async () => {
  const { useHomebrew, load } = await reload();
  await load("warlock-test-content");
  const loaded = useHomebrew.getState().homebrew;

  await useHomebrew.getState().load("broken.orcbrew", "{:orcpub.dnd.e5/spells {:fireball");
  expect(useHomebrew.getState().homebrew).toBe(loaded);
  expect(useHomebrew.getState().lastImport?.success).toBe(false);
  expect(useHomebrew.getState().lastImport?.log.message).toContain("Could not read file");
});

test("packs and their flags survive a reload", async () => {
  let app = await reload();
  await app.load("warlock-test-content");
  await app.load("community-mezzoloth-race");
  await app.useHomebrew.getState().setPackEnabled("community-mezzoloth-race", false);
  await app.useHomebrew.getState().setItemEnabled("warlock-test-content", "~:orcpub.dnd.e5/feats", "~:keen-mind", false);
  const before = app.useHomebrew.getState();

  app = await reload();
  expect(app.useHomebrew.getState().packs).toEqual([]);
  await app.restorePacks();
  const after = app.useHomebrew.getState();
  expect(after.packs).toEqual(before.packs);
  expect(after.quarantined).toEqual([]);
  expect(after.homebrew).toEqual(before.homebrew);
  expect(Object.keys(after.homebrew!)).toEqual(["warlock-test-content"]);
  expect(after.homebrew!["warlock-test-content"]).toHaveProperty(["~:orcpub.dnd.e5/feats"], {});
  expect((await app.listPacks()).map((r) => (r as PackRecord).rules)).toEqual(["2014", "2014"]);
});

test("toggling a pack changes selections on the next evaluate", async () => {
  const { engine, useHomebrew, load } = await reload();
  const raceOptions = () =>
    engine()
      .evaluate(readFixture("fighter-1.strict.json"), { homebrew: useHomebrew.getState().homebrew })
      .selections.find((s) => s.path.join("/") === "race")?.optionCount;
  await load("community-mezzoloth-race");
  expect(raceOptions()).toBe(11);
  await useHomebrew.getState().setPackEnabled("community-mezzoloth-race", false);
  expect(useHomebrew.getState().homebrew).toBeUndefined();
  expect(raceOptions()).toBe(10);
  await useHomebrew.getState().setPackEnabled("community-mezzoloth-race", true);
  expect(raceOptions()).toBe(11);
});

test("a disabled item is left out of the homebrew and its selections", async () => {
  const { engine, useHomebrew, load } = await reload();
  const featOptions = () =>
    engine()
      .evaluate(readFixture("warlock-10-drow.strict.json"), { homebrew: useHomebrew.getState().homebrew })
      .selections.find((s) => s.path.join("/") === "feats")?.optionCount;
  await load("warlock-test-content");
  expect(featOptions()).toBe(2);

  await useHomebrew.getState().setItemEnabled("warlock-test-content", "~:orcpub.dnd.e5/feats", "~:keen-mind", false);
  expect(useHomebrew.getState().homebrew!["warlock-test-content"]).toHaveProperty(["~:orcpub.dnd.e5/feats"], {});
  expect(useHomebrew.getState().homebrew!["warlock-test-content"]).toHaveProperty(["~:orcpub.dnd.e5/backgrounds", "~:spy"]);
  expect(featOptions()).toBe(1);

  await useHomebrew.getState().setItemEnabled("warlock-test-content", "~:orcpub.dnd.e5/feats", "~:keen-mind", true);
  expect(useHomebrew.getState().packs[0].disabledItems).toEqual([]);
  expect(featOptions()).toBe(2);
});

// A feat name must be a string; the engine throws on a number.
const breaks: PackRecord = {
  id: "breaks",
  rules: "2014",
  enabled: true,
  disabledItems: [],
  plugin: { "~:orcpub.dnd.e5/feats": { "~:x": { "~:name": 5 } } },
  updatedAt: "2026-10-05T00:00:00.000Z",
};
const corrupted = [
  { id: "wrong-shape", plugin: "not a map" },
  breaks,
  { ...breaks, id: "for-2024", rules: "2024", plugin: {} },
] as PackRecord[];

test("a stored record that does not read or build is quarantined and kept, and the other packs load", async () => {
  let app = await reload();
  await app.load("warlock-test-content");
  await app.savePacks(corrupted);
  const stored = await app.listPacks();

  app = await reload();
  await app.restorePacks();
  const { packs, quarantined, homebrew } = app.useHomebrew.getState();
  expect(packs.map((p) => p.id)).toEqual(["warlock-test-content"]);
  expect(Object.keys(homebrew!)).toEqual(["warlock-test-content"]);
  expect(quarantined).toEqual([
    { id: "for-2024", reason: 'The record is for rules "2024"; only 2014 packs are used.' },
    { id: "wrong-shape", reason: "The record is not a stored pack." },
    { id: "breaks", reason: expect.stringMatching(/^The engine could not build it: /) },
  ]);
  expect(await app.listPacks()).toEqual(stored);
});

test("a file with a pack named as a quarantined record is refused, and the record is kept", async () => {
  let app = await reload();
  await app.savePacks([{ ...breaks, id: "warlock-test-content" }]);

  app = await reload();
  await expect(app.load("warlock-test-content")).rejects.toThrow("A stored pack named warlock-test-content could not be read");
  expect(app.useHomebrew.getState().packs).toEqual([]);
  expect(await app.listPacks()).toEqual([{ ...breaks, id: "warlock-test-content" }]);
});

test("every fixture pack that parses restores with none quarantined", { timeout: 60_000 }, async () => {
  let app = await reload();
  for (const file of readdirSync(join(fixturesDir, "orcbrew")).filter((f) => f.endsWith(".orcbrew"))) {
    await app.load(file.replace(".orcbrew", ""));
  }
  const loaded = app.useHomebrew.getState().packs.map((p) => p.id);
  expect(loaded.length).toBeGreaterThan(15);

  app = await reload();
  await app.restorePacks();
  expect(app.useHomebrew.getState().quarantined).toEqual([]);
  expect(app.useHomebrew.getState().packs.map((p) => p.id)).toEqual(loaded);
});

test("version 1 characters survive the upgrade that adds the packs store", async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open("alchemy-5e", 1);
    request.onupgradeneeded = () => {
      for (const name of ["characters", "summaries", "drafts"]) request.result.createObjectStore(name, { keyPath: "id" });
      request.transaction!.objectStore("characters").put({ id: "old", name: "Kept" });
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });

  const { listPacks } = await reload();
  const { getCharacter } = await import("../storage/characters.ts");
  expect(await getCharacter("old")).toEqual({ id: "old", name: "Kept" });
  expect(await listPacks()).toEqual([]);
});
