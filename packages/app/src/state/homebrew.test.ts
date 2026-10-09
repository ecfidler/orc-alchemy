import "fake-indexeddb/auto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, expect, test, vi } from "vitest";
import type { PackRecord } from "../storage/packs.ts";

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");
const readPack = (name: string) => readFileSync(join(fixturesDir, "orcbrew", `${name}.orcbrew`), "utf8");
const readFixture = (file: string) => JSON.parse(readFileSync(join(fixturesDir, "characters", file), "utf8"));
const readText = (file: string) => readFileSync(join(fixturesDir, file), "utf8");

/** The app's modules as a new page load has them: nothing read from storage yet, and the engine loaded. */
async function reload() {
  vi.resetModules();
  const { engine, loadEngine } = await import("../engine/engine.ts");
  await loadEngine();
  const { bundleHomebrew, restorePacks, useHomebrew } = await import("./homebrew.ts");
  const storage = await import("../storage/packs.ts");
  const load = (name: string) => useHomebrew.getState().load(`${name}.orcbrew`, readPack(name));
  const imports = await import("../engine/import.ts");
  return { engine, bundleHomebrew, restorePacks, useHomebrew, load, ...imports, ...storage };
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

test("a second file with key conflicts waits for its choices, then merges in; removing a pack keeps the others", async () => {
  const { useHomebrew, load, listPacks } = await reload();
  await load("duplicate-external-a");
  await load("duplicate-external-b");
  const { pending } = useHomebrew.getState();
  expect(pending?.result.conflicts.map((c) => c.key)).toContain("artificer");
  expect(Object.keys(useHomebrew.getState().homebrew!)).toEqual(["duplicate-external-a"]);
  expect((await listPacks()).map((p) => (p as { id: string }).id)).toEqual(["duplicate-external-a"]);

  await useHomebrew.getState().resolveConflicts(Object.fromEntries(pending!.result.conflicts.map((c) => [c.id, "rename" as const])));
  expect(useHomebrew.getState().pending).toBeNull();
  expect(Object.keys(useHomebrew.getState().homebrew!)).toEqual(["duplicate-external-a", "duplicate-external-b"]);
  expect(useHomebrew.getState().lastImport?.conflicts).toEqual([]);

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

test("changes started together each start from the last one's packs, and a failed one does not stop the next", async () => {
  const { useHomebrew, load, listPacks } = await reload();
  await Promise.all([load("warlock-test-content"), load("community-mezzoloth-race")]);
  expect(useHomebrew.getState().packs.map((p) => p.id)).toEqual(["community-mezzoloth-race", "warlock-test-content"]);
  expect((await listPacks()).map((r) => (r as PackRecord).id)).toEqual(["community-mezzoloth-race", "warlock-test-content"]);

  const { setPackEnabled, setItemEnabled } = useHomebrew.getState();
  const results = await Promise.allSettled([
    setPackEnabled("missing", false),
    setPackEnabled("warlock-test-content", false),
    setItemEnabled("warlock-test-content", "~:orcpub.dnd.e5/feats", "~:keen-mind", false),
  ]);
  expect(results.map((r) => r.status)).toEqual(["rejected", "fulfilled", "fulfilled"]);
  const expected = { enabled: false, disabledItems: [["~:orcpub.dnd.e5/feats", "~:keen-mind"]] };
  expect(useHomebrew.getState().packs[1]).toMatchObject(expected);
  expect((await listPacks())[1]).toMatchObject(expected);
});

test("a change that changes nothing keeps the same homebrew", async () => {
  const { useHomebrew, load } = await reload();
  await load("warlock-test-content");
  const { homebrew, packs } = useHomebrew.getState();

  await load("warlock-test-content");
  await useHomebrew.getState().setPackEnabled("warlock-test-content", true);
  await useHomebrew.getState().setItemEnabled("warlock-test-content", "~:orcpub.dnd.e5/feats", "~:keen-mind", true);
  expect(useHomebrew.getState().homebrew).toBe(homebrew);
  expect(useHomebrew.getState().packs).toBe(packs);
  expect(useHomebrew.getState().lastImport?.success).toBe(true);
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

// The packs are built one at a time in name order once the build of all of them fails:
// "breaks" sorts before "warlock-test-content", which still builds after it is quarantined.
// No pair of packs was found that builds alone but not together, so no test has one.
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

/** The packs without updatedAt, which a load sets. */
const withoutTimes = (packs: PackRecord[]) => packs.map(({ updatedAt: _, ...rest }) => rest);

test("a bundle's packs and flags round-trip through an empty database, with its characters", async () => {
  let app = await reload();
  await app.load("warlock-test-content");
  await app.load("community-mezzoloth-race");
  await app.useHomebrew.getState().setPackEnabled("community-mezzoloth-race", false);
  await app.useHomebrew.getState().setItemEnabled("warlock-test-content", "~:orcpub.dnd.e5/feats", "~:keen-mind", false);
  const before = app.useHomebrew.getState();
  const [character] = app.readCharacterFile(readText("characters/warlock-10-drow.strict.json"), before.homebrew).characters;
  const { homebrew, flags } = app.bundleHomebrew();
  expect(Object.keys(homebrew)).toEqual(["community-mezzoloth-race", "warlock-test-content"]);
  expect(flags["community-mezzoloth-race"]).toEqual({ enabled: false, disabledItems: [] });
  const text = JSON.stringify(app.exportBundle([character.entity], "https://alchemy.example", { homebrew, flags }));

  vi.stubGlobal("indexedDB", new IDBFactory());
  app = await reload();
  const bundle = app.readBundleHomebrew(text);
  expect(bundle).toEqual({ homebrew, flags });
  await app.useHomebrew.getState().loadBundle(bundle!, "dmv-export.json");
  const after = app.useHomebrew.getState();
  expect(withoutTimes(after.packs)).toEqual(withoutTimes(before.packs));
  expect(after.homebrew).toEqual(before.homebrew);
  expect(withoutTimes((await app.listPacks()) as PackRecord[])).toEqual(withoutTimes(before.packs));

  const { characters, failures } = app.readCharacterFile(text, after.homebrew);
  expect(failures).toEqual([]);
  expect(characters).toEqual([{ ...character, name: null }]);
});

test("a bundle pack without flags keeps its stored flags, or is enabled when new", async () => {
  const app = await reload();
  await app.load("warlock-test-content");
  await app.useHomebrew.getState().setPackEnabled("warlock-test-content", false);
  const homebrew = app.engine().parseOrcbrew(readPack("community-mezzoloth-race"), {
    name: "community-mezzoloth-race",
    existing: { "warlock-test-content": app.useHomebrew.getState().packs[0].plugin },
  }).data!;

  await app.useHomebrew.getState().loadBundle({ homebrew, flags: {} }, "dmv-export.json");
  expect(app.useHomebrew.getState().packs.map(({ id, enabled }) => [id, enabled])).toEqual([
    ["community-mezzoloth-race", true],
    ["warlock-test-content", false],
  ]);
});

test("a bundle with a pack named as a quarantined record is refused", async () => {
  let app = await reload();
  await app.savePacks([{ ...breaks, id: "warlock-test-content" }]);
  const homebrew = app.engine().parseOrcbrew(readPack("warlock-test-content"), { name: "warlock-test-content" }).data!;

  app = await reload();
  await expect(app.useHomebrew.getState().loadBundle({ homebrew, flags: {} }, "dmv-export.json")).rejects.toThrow(
    "A stored pack named warlock-test-content could not be read",
  );
  expect(app.useHomebrew.getState().packs).toEqual([]);
});

test("a bundle with an item that is not a map is refused, and keeps the loaded packs", async () => {
  const app = await reload();
  await app.load("warlock-test-content");
  const { packs } = app.useHomebrew.getState();
  const homebrew = { bad: { "~:orcpub.dnd.e5/spells": { "~:x": 5 } } };
  await expect(app.useHomebrew.getState().loadBundle({ homebrew, flags: {} }, "dmv-export.json")).rejects.toThrow("The homebrew could not be read. An item or pack in the file may not be a map.");
  expect(app.useHomebrew.getState().packs).toBe(packs);
});

test("a missing choice keeps the import pending and stores nothing; cancelImport drops it", async () => {
  const { useHomebrew, load, listPacks } = await reload();
  await load("duplicate-external-a");
  await load("duplicate-external-b");

  await expect(useHomebrew.getState().resolveConflicts({})).rejects.toThrow("The conflict on artificer has no valid choice");
  expect(useHomebrew.getState().pending).not.toBeNull();
  expect((await listPacks()).map((p) => (p as { id: string }).id)).toEqual(["duplicate-external-a"]);

  useHomebrew.getState().cancelImport();
  expect(useHomebrew.getState().pending).toBeNull();
  expect((await listPacks()).map((p) => (p as { id: string }).id)).toEqual(["duplicate-external-a"]);
});

test("removing a pack drops a pending import, so Apply cannot store the removed pack again", async () => {
  const { useHomebrew, load, listPacks } = await reload();
  await load("duplicate-external-a");
  await load("duplicate-external-b");
  expect(useHomebrew.getState().pending).not.toBeNull();

  await useHomebrew.getState().remove("duplicate-external-a");
  expect(useHomebrew.getState().pending).toBeNull();
  await expect(useHomebrew.getState().resolveConflicts({})).rejects.toThrow("No import is waiting on its conflicts");
  expect(await listPacks()).toEqual([]);
});

test("loading the same file again is not a key conflict", async () => {
  const { useHomebrew, load } = await reload();
  await load("duplicate-external-a");
  await load("duplicate-external-a");
  expect(useHomebrew.getState().pending).toBeNull();
  expect(useHomebrew.getState().lastImport?.conflicts).toEqual([]);
});
