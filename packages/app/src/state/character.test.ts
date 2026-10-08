import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { engine, loadEngine } from "../engine/engine.ts";
import { deleteCharacter, getCharacter, getDraft, listSummaries, saveDraft, useStorage } from "../storage/characters.ts";
import { addCharacter, AUTOSAVE_DELAY_MS, flushAutosave, readCharacter, refreshSummaries, removeCharacter, useCharacter, useOpenCharacter } from "./character.ts";
import { useHomebrew } from "./homebrew.ts";

beforeAll(() => loadEngine());

afterEach(async () => {
  await flushAutosave();
  vi.useRealTimers();
  useCharacter.setState({ id: null, entity: null, dirty: false });
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
  useHomebrew.setState({ lastImport: null });
});

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");
const readFixture = (file: string) => JSON.parse(readFileSync(join(fixturesDir, "characters", file), "utf8"));
const loadPack = (name: string) => useHomebrew.getState().load(`${name}.orcbrew`, readFileSync(join(fixturesDir, "orcbrew", `${name}.orcbrew`), "utf8"));
const removePack = (name: string) => useHomebrew.getState().remove(name);

/** Opens a stored character as the sheet page does. */
async function openCharacter(id: string) {
  const found = await readCharacter(id);
  if (found) useCharacter.getState().load(id, found.entity, found.dirty);
  return found !== null;
}

const rename = (name: string) => useCharacter.getState().update((entity) => engine().setValue(entity, "character-name", name));

test("built, sheet and selections follow the entity; a mutation marks it dirty", () => {
  const { result } = renderHook(() => useOpenCharacter());
  expect(result.current).toEqual({ entity: null, built: null, sheet: null, selections: null, dirty: false });

  act(() => useCharacter.getState().load("x", engine().emptyCharacter()));
  expect(result.current.built?.classes).toEqual(["barbarian"]);
  expect(result.current.sheet?.classes.map((c) => c.name)).toEqual(["Barbarian"]);
  expect(result.current.selections).not.toHaveLength(0);
  expect(result.current.dirty).toBe(false);

  act(() => rename("Grog"));
  expect(result.current.built?.["character-name"]).toBe("Grog");
  expect(result.current.sheet?.name).toBe("Grog");
  expect(result.current.dirty).toBe(true);
});

test("an added character is stored with its summary and opens as stored", async () => {
  const id = await addCharacter(engine().setValue(engine().emptyCharacter(), "character-name", "Pike"), "2014", "17");

  expect(await getCharacter(id)).toMatchObject({ format: "dmv-character", version: 1, rules: "2014", name: "Pike", legacyId: "17" });
  expect((await listSummaries()).find((s) => s.id === id)).toMatchObject({ rules: "2014", name: "Pike", classes: [{ key: "2014/barbarian" }] });

  expect(await openCharacter(id)).toBe(true);
  expect(useCharacter.getState()).toMatchObject({ id, dirty: false });
  expect(await openCharacter("no-such-id")).toBe(false);
  await deleteCharacter(id);
});

test("autosave keeps a draft at once and saves the record once changes stop", async () => {
  const id = await addCharacter(engine().emptyCharacter(), "2014", null);
  await openCharacter(id);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  rename("Vex");
  await vi.waitFor(async () => expect(await getDraft(id)).toBeDefined());
  rename("Vex'ahlia");
  await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1);
  expect((await getCharacter(id))?.name).toBeNull();

  await vi.advanceTimersByTimeAsync(1);
  await vi.waitFor(async () => expect((await getCharacter(id))?.name).toBe("Vex'ahlia"));
  expect((await listSummaries()).find((s) => s.id === id)?.name).toBe("Vex'ahlia");
  await vi.waitFor(async () => expect(await getDraft(id)).toBeUndefined());
  expect(useCharacter.getState().dirty).toBe(false);
  await deleteCharacter(id);
});

test("a flush waits for a save the timer already started", async () => {
  const id = await addCharacter(engine().emptyCharacter(), "2014", null);
  await openCharacter(id);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  rename("Keyleth");
  vi.advanceTimersByTime(AUTOSAVE_DELAY_MS); // starts the save without waiting for it
  await flushAutosave();
  expect((await getCharacter(id))?.name).toBe("Keyleth");
  await deleteCharacter(id);
});

test("an autosave that fails reading the stored character reports a failed save and keeps its draft", async () => {
  const id = await addCharacter(engine().emptyCharacter(), "2014", null);
  await openCharacter(id);

  rename("Percy");
  await vi.waitFor(async () => expect(await getDraft(id)).toBeDefined());
  vi.spyOn(IDBObjectStore.prototype, "get").mockImplementationOnce(() => {
    throw new DOMException("Read failed", "UnknownError");
  });
  await expect(flushAutosave()).rejects.toThrow("Read failed");
  expect(useStorage.getState().failed).toBe(true);
  expect(await getDraft(id)).toBeDefined();
  expect(useCharacter.getState().dirty).toBe(true);

  // The changes are pending again, so the next flush saves them and clears the notice.
  vi.restoreAllMocks();
  await flushAutosave();
  expect((await getCharacter(id))?.name).toBe("Percy");
  expect(useStorage.getState().failed).toBe(false);
  expect(useCharacter.getState().dirty).toBe(false);
  expect(await getDraft(id)).toBeUndefined();
  await deleteCharacter(id);
});

test("a save that fails while newer changes are pending does not replace them", async () => {
  const id = await addCharacter(engine().emptyCharacter(), "2014", null);
  await openCharacter(id);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  rename("Trinket");
  vi.spyOn(IDBObjectStore.prototype, "get").mockImplementationOnce(() => {
    throw new DOMException("Read failed", "UnknownError");
  });
  const failing = flushAutosave();
  rename("Trinket the bear"); // while the first save is under way
  await expect(failing).rejects.toThrow("Read failed");
  vi.restoreAllMocks();

  vi.advanceTimersByTime(AUTOSAVE_DELAY_MS);
  await flushAutosave(); // waits for the save the timer started
  expect((await getCharacter(id))?.name).toBe("Trinket the bear");
  expect(useStorage.getState().failed).toBe(false);
  await deleteCharacter(id);
});

test("a save that fails after a newer save of the character does not replace it", async () => {
  const id = await addCharacter(engine().emptyCharacter(), "2014", null);
  await openCharacter(id);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  rename("Vax");
  vi.spyOn(IDBObjectStore.prototype, "get").mockImplementationOnce(() => {
    throw new DOMException("Read failed", "UnknownError");
  });
  const failing = flushAutosave();
  rename("Vex");
  const newer = flushAutosave(); // under way when the first save fails; it waits for both
  await expect(failing).rejects.toThrow("Read failed");
  await expect(newer).rejects.toThrow("Read failed");
  vi.restoreAllMocks();

  await flushAutosave(); // nothing is pending: the failed save is not retried over the newer one
  expect((await getCharacter(id))?.name).toBe("Vex");
  expect(useCharacter.getState().dirty).toBe(false);
  expect(await getDraft(id)).toBeUndefined();
  expect(useStorage.getState().failed).toBe(false);
  await deleteCharacter(id);
});

test("removing the open character closes it, and its pending save does not store it again", async () => {
  const id = await addCharacter(engine().emptyCharacter(), "2014", null);
  await openCharacter(id);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

  rename("Grog");
  await removeCharacter(id);
  expect(useCharacter.getState()).toMatchObject({ id: null, entity: null, dirty: false });
  await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
  expect(await getCharacter(id)).toBeUndefined();
  expect(await getDraft(id)).toBeUndefined();
  expect((await listSummaries()).find((s) => s.id === id)).toBeUndefined();
});

test("opening a character recovers its draft", async () => {
  const id = await addCharacter(engine().emptyCharacter(), "2014", null);
  // As after a reload mid-edit: the draft is stored, the record not yet saved.
  const entity = engine().setValue(engine().emptyCharacter(), "character-name", "Scanlan");
  await saveDraft({ id, entity, updatedAt: "2026-10-03T00:00:00.000Z" });

  expect(await openCharacter(id)).toBe(true);
  expect(useCharacter.getState().dirty).toBe(true);
  expect(engine().evaluate(useCharacter.getState().entity!).built["character-name"]).toBe("Scanlan");
  await deleteCharacter(id);
});

test("the open character builds with the loaded homebrew, and without it once the pack is removed", async () => {
  const { result } = renderHook(() => useOpenCharacter());
  act(() => useCharacter.getState().load("w", readFixture("warlock-10-drow.strict.json")));
  const paths = ["race/elf/subrace", "background", "feats"];
  const optionCounts = () => result.current.selections!.filter((s) => paths.includes(s.path.join("/"))).map((s) => s.optionCount);
  expect(optionCounts()).toEqual([2, 2, 1]);

  // The pack adds the Drow subrace, the Spy background and the Keen Mind feat.
  await act(() => loadPack("warlock-test-content"));
  expect(optionCounts()).toEqual([3, 3, 2]);
  expect(result.current.built).toEqual(readFixture("warlock-10-drow.expected.json"));

  await act(() => removePack("warlock-test-content"));
  expect(optionCounts()).toEqual([2, 2, 1]);
});

test("a homebrew-only character has its pack's selections while the pack is loaded", async () => {
  const { result } = renderHook(() => useOpenCharacter());
  act(() => useCharacter.getState().load("i", readFixture("ironwrought-artificer-3.strict.json")));
  const specialization = () => result.current.selections!.find((s) => s.key === "artificer-specialization");
  expect(specialization()).toBeUndefined();

  await act(() => loadPack("duplicate-external-b"));
  expect(specialization()?.selected).toEqual(["alchemist"]);
  expect(result.current.selections!.find((s) => s.key === "subrace")?.selected).toEqual(["envoy"]);
  expect(result.current.built).toEqual(readFixture("ironwrought-artificer-3.expected.json"));

  await act(() => removePack("duplicate-external-b"));
  expect(specialization()).toBeUndefined();
});

// The homebrew golden characters (ORC-54): with the fixture's pack loaded, the build is the oracle's.
test.each([
  ["duplicate-external-b", "ironwrought-artificer-3"],
  ["warlock-test-content", "warlock-10-drow"],
])("with %s loaded, %s builds to its expected.json", async (pack, fixture) => {
  const { result } = renderHook(() => useOpenCharacter());
  await act(() => loadPack(pack));
  act(() => useCharacter.getState().load("g", readFixture(`${fixture}.strict.json`)));
  expect(result.current.built).toEqual(readFixture(`${fixture}.expected.json`));
});

test.each([
  ["duplicate-external-a", () => readFixture("fighter-1.strict.json"), "class", 12, 14],
  ["community-mezzoloth-race", () => readFixture("fighter-1.strict.json"), "race", 10, 11],
  ["community-dandwiki-star-elf", () => readFixture("warlock-10-drow.strict.json"), "race/elf/subrace", 2, 3],
  ["community-gmbinder-homebrew", () => engine().setClass(engine().emptyCharacter(), 0, "cleric"), "class/cleric/levels/level-1/divine-domain", 2, 3],
])("%s adds its options while it is loaded", async (pack, entity, path, without, withPack) => {
  const { result } = renderHook(() => useOpenCharacter());
  act(() => useCharacter.getState().load("p", entity()));
  const optionCount = () => result.current.selections!.find((s) => s.path.join("/") === path)?.optionCount;
  expect(optionCount()).toBe(without);

  await act(() => loadPack(pack));
  expect(optionCount()).toBe(withPack);
  await act(() => removePack(pack));
  expect(optionCount()).toBe(without);
});

test("a character's summary is built with the loaded homebrew", async () => {
  await loadPack("duplicate-external-b");
  const id = await addCharacter(readFixture("ironwrought-artificer-3.strict.json"), "2014", null);
  expect((await listSummaries()).find((s) => s.id === id)).toMatchObject({ race: "Ironwrought", classes: [{ name: "Artificer (Alternate) (duplicate-external-b)", level: 3 }] });
  await deleteCharacter(id);
});

test("refreshSummaries rebuilds the summaries built with other homebrew, unless it is no longer current", async () => {
  await loadPack("duplicate-external-b");
  const id = await addCharacter(readFixture("ironwrought-artificer-3.strict.json"), "2014", null);
  const summary = async () => (await listSummaries()).find((s) => s.id === id);
  const withPack = { race: "Ironwrought", fingerprint: useHomebrew.getState().fingerprint };
  expect(await summary()).toMatchObject(withPack);

  // Removing the pack leaves the summary as it was built.
  await removePack("duplicate-external-b");
  expect(await summary()).toMatchObject(withPack);

  await refreshSummaries(await listSummaries(), () => false);
  expect(await summary()).toMatchObject(withPack);

  await refreshSummaries(await listSummaries(), () => true);
  const rebuilt = await summary();
  expect(rebuilt).toMatchObject({ fingerprint: "" });
  expect(rebuilt?.race).not.toBe("Ironwrought");

  // Loading the pack again brings the homebrew race back.
  await loadPack("duplicate-external-b");
  await refreshSummaries(await listSummaries(), () => true);
  expect(await summary()).toMatchObject({ race: "Ironwrought", fingerprint: useHomebrew.getState().fingerprint });
  await deleteCharacter(id);
});
