import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { useBuilderSteps } from "../engine/builder.ts";
import { CUSTOM_PACK } from "../engine/custom.ts";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { customHash, deleteCharacter, getCharacter, getDraft, listSummaries, saveDraft, summaryFingerprint, useStorage } from "../storage/characters.ts";
import {
  AUTOSAVE_DELAY_MS,
  addCharacter,
  checkStoredCharacter,
  flushAutosave,
  readCharacter,
  refreshSummaries,
  removeCharacter,
  useCharacter,
  useOpenCharacter,
} from "./character.ts";
import { useHomebrew } from "./homebrew.ts";

beforeAll(() => loadEngine());

afterEach(async () => {
  await flushAutosave();
  vi.useRealTimers();
  useCharacter.setState({ id: null, entity: null, custom: undefined, dirty: false });
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
  if (found) useCharacter.getState().load(id, found.entity, found.dirty, found.custom);
  return found !== null;
}

const rename = (name: string) => useCharacter.getState().update((entity) => engine().setValue(entity, "character-name", name));

test("built, sheet and selections follow the entity; a mutation marks it dirty", () => {
  const { result } = renderHook(() => useOpenCharacter());
  expect(result.current).toEqual({ entity: null, built: null, sheet: null, selections: null, dirty: false, content: { homebrew: undefined } });

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

test("a save that fails when another character is opened is retried by the next flush", async () => {
  const id = await addCharacter(engine().emptyCharacter(), "2014", null);
  const other = await addCharacter(engine().emptyCharacter(), "2014", null);
  await openCharacter(id);
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  rename("Keyleth");

  const found = (await readCharacter(other))!;
  vi.spyOn(IDBObjectStore.prototype, "get").mockImplementationOnce(() => {
    throw new DOMException("Read failed", "UnknownError");
  });
  useCharacter.getState().load(other, found.entity); // saves the pending changes of the first, and that fails
  await expect(flushAutosave()).rejects.toThrow("Read failed");
  expect(useStorage.getState().failed).toBe(true);
  vi.restoreAllMocks();

  await flushAutosave();
  expect((await getCharacter(id))?.name).toBe("Keyleth");
  expect(await getDraft(id)).toBeUndefined();
  expect(useStorage.getState().failed).toBe(false);
  await deleteCharacter(id);
  await deleteCharacter(other);
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
  ["scaled-uses", "scaled-uses-fighter-6-barbarian-1"],
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
  expect((await listSummaries()).find((s) => s.id === id)).toMatchObject({
    race: "Ironwrought",
    classes: [{ name: "Artificer (Alternate) (duplicate-external-b)", level: 3 }],
  });
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

// Character-local content (ORC-133).
const FEATS = "~:orcpub.dnd.e5/feats";
const RACES = "~:orcpub.dnd.e5/races";
const customFeat = (description = "You are an expert.") => ({
  "~:key": "~:skill-expert-custom",
  "~:name": "Skill Expert Custom",
  "~:option-pack": CUSTOM_PACK,
  "~:description": description,
});
const CUSTOM_FEAT = { [FEATS]: { "~:skill-expert-custom": customFeat() } };
const CUSTOM_RACE = { [RACES]: { "~:gnome-custom": { "~:key": "~:gnome-custom", "~:name": "Gnome Custom", "~:option-pack": CUSTOM_PACK, "~:speed": 30 } } };
const selectFeat = (entity: StrictEntity) => engine().select(entity, ["feats"], "skill-expert-custom", { homebrew: { [CUSTOM_PACK]: CUSTOM_FEAT } });
const deselectFeat = (entity: StrictEntity) => engine().deselect(entity, ["feats"], "skill-expert-custom", { homebrew: { [CUSTOM_PACK]: CUSTOM_FEAT } });

/** Stores a new character with this custom content, changed by mutate, through the open character and autosave. */
async function addWithCustom(entity: StrictEntity, custom: object, mutate: (e: StrictEntity) => StrictEntity = (e) => e) {
  const id = await addCharacter(entity, "2014", null);
  await openCharacter(id);
  useCharacter.getState().updateWithCustom(custom, mutate);
  await flushAutosave();
  return id;
}

test("a character's custom feat is in its feat list and builds; another character neither lists it nor builds with it", async () => {
  const { result } = renderHook(() => {
    const open = useOpenCharacter();
    return { ...open, steps: useBuilderSteps(open.selections, open.content) };
  });
  const featOptions = () =>
    result.current.steps
      .flatMap((step) => step.selections)
      .find((s) => s.key === "feats")
      ?.options.map((o) => o.name);
  const featNames = () =>
    Object.values(result.current.sheet!.features)
      .flat()
      .map((f) => f.name);

  const id = await addWithCustom(readFixture("warlock-10-drow.strict.json"), CUSTOM_FEAT, selectFeat);
  expect((await getCharacter(id))?.custom).toEqual(CUSTOM_FEAT);
  const other = await addCharacter(readFixture("warlock-10-drow.strict.json"), "2014", null);

  await act(() => openCharacter(id));
  expect(result.current.content.homebrew).toEqual({ [CUSTOM_PACK]: CUSTOM_FEAT });
  expect(featOptions()).toContain("Skill Expert Custom");
  expect(result.current.selections!.find((s) => s.key === "feats")?.selected).toContain("skill-expert-custom");
  expect(featNames()).toContain("Skill Expert Custom");

  // The other character, even with the key selected, has no such feat.
  await act(() => openCharacter(other));
  expect(useCharacter.getState().custom).toBeUndefined();
  expect(featOptions()).not.toContain("Skill Expert Custom");
  act(() => useCharacter.getState().load(other, selectFeat(useCharacter.getState().entity!)));
  expect(featNames()).not.toContain("Skill Expert Custom");
  await deleteCharacter(id);
  await deleteCharacter(other);
});

test("saving a character that no longer selects its custom feat removes the feat from custom", async () => {
  const id = await addWithCustom(readFixture("warlock-10-drow.strict.json"), { ...CUSTOM_FEAT, ...CUSTOM_RACE }, selectFeat);
  // The custom race is not selected, so the first save already drops it.
  expect((await getCharacter(id))?.custom).toEqual(CUSTOM_FEAT);
  expect(useCharacter.getState()).toMatchObject({ custom: CUSTOM_FEAT, dirty: false });

  useCharacter.getState().update(deselectFeat);
  await flushAutosave();
  const record = await getCharacter(id);
  expect(record).not.toHaveProperty("custom");
  expect((await listSummaries()).find((s) => s.id === id)).not.toHaveProperty("customHash");
  // The open character holds what was stored, and the prune is not a change to save.
  expect(useCharacter.getState()).toMatchObject({ custom: undefined, dirty: false });
  expect(await getDraft(id)).toBeUndefined();
  await deleteCharacter(id);
});

test("a change of custom content alone is saved, and a draft keeps the custom content with its entity", async () => {
  const id = await addWithCustom(readFixture("warlock-10-drow.strict.json"), CUSTOM_FEAT, selectFeat);
  const changed = { [FEATS]: { "~:skill-expert-custom": customFeat("You are a true expert.") } };
  const { entity } = useCharacter.getState();
  useCharacter.getState().updateWithCustom(changed, (e) => e);
  expect(useCharacter.getState()).toMatchObject({ entity, custom: changed, dirty: true });
  await vi.waitFor(async () => expect((await getDraft(id))?.custom).toEqual(changed));
  await flushAutosave();
  expect((await getCharacter(id))?.custom).toEqual(changed);
  expect(await readCharacter(id)).toMatchObject({ dirty: false, custom: changed });

  // As after a reload mid-edit: the draft opens, dirty, with its own custom content.
  await saveDraft({ id, entity: entity!, custom: CUSTOM_FEAT, updatedAt: "2026-11-15T00:00:00.000Z" });
  expect(await readCharacter(id)).toMatchObject({ dirty: true, custom: CUSTOM_FEAT });
  await openCharacter(id);
  expect(useCharacter.getState()).toMatchObject({ custom: CUSTOM_FEAT, dirty: true });
  await deleteCharacter(id);
});

test("the summary fingerprint changes with the custom content, and refreshSummaries rebuilds a stale summary with it", async () => {
  const summary = async (id: string) => (await listSummaries()).find((s) => s.id === id);
  const raceIs = (entity: StrictEntity) => engine().select(entity, ["race"], "gnome-custom", { homebrew: { [CUSTOM_PACK]: CUSTOM_RACE } });
  await loadPack("warlock-test-content");
  const withPack = useHomebrew.getState().fingerprint;
  const id = await addWithCustom(engine().emptyCharacter(), CUSTOM_RACE, raceIs);
  const hash = customHash(CUSTOM_RACE);
  expect(await summary(id)).toMatchObject({ race: "Gnome Custom", customHash: hash, fingerprint: summaryFingerprint(withPack, hash) });
  expect(summaryFingerprint(withPack, hash)).not.toBe(withPack);

  const renamed = { [RACES]: { "~:gnome-custom": { ...CUSTOM_RACE[RACES]["~:gnome-custom"], "~:name": "Deep Gnome Custom" } } };
  useCharacter.getState().updateWithCustom(renamed, (e) => e);
  await flushAutosave();
  const after = await summary(id);
  expect(after).toMatchObject({ race: "Deep Gnome Custom", customHash: customHash(renamed) });
  expect(after?.fingerprint).not.toBe(summaryFingerprint(withPack, hash));

  // A summary is current while the homebrew is as it was built with.
  await refreshSummaries(await listSummaries(), () => true);
  expect(await summary(id)).toEqual(after);

  // With other homebrew it is stale, and is rebuilt with its custom content.
  await removePack("warlock-test-content");
  await refreshSummaries(await listSummaries(), () => true);
  expect(await summary(id)).toMatchObject({
    race: "Deep Gnome Custom",
    customHash: customHash(renamed),
    fingerprint: summaryFingerprint("", customHash(renamed)),
  });
  await deleteCharacter(id);
});

test("checkStoredCharacter checks a stored character with its own custom content", async () => {
  const id = await addWithCustom(readFixture("warlock-10-drow.strict.json"), CUSTOM_FEAT, selectFeat);
  const other = await addCharacter(selectFeat(readFixture("warlock-10-drow.strict.json")), "2014", null);
  expect((await checkStoredCharacter(id))?.map((u) => u.key)).not.toContain("skill-expert-custom");
  expect((await checkStoredCharacter(other))?.map((u) => u.key)).toContain("skill-expert-custom");
  await deleteCharacter(id);
  await deleteCharacter(other);
});
