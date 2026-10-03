import "fake-indexeddb/auto";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { engine, loadEngine } from "../engine/engine.ts";
import { deleteCharacter, getCharacter, getDraft, listSummaries, saveDraft } from "../storage/characters.ts";
import { addCharacter, AUTOSAVE_DELAY_MS, flushAutosave, readCharacter, useCharacter, useOpenCharacter } from "./character.ts";

beforeAll(() => loadEngine());

afterEach(async () => {
  await flushAutosave();
  vi.useRealTimers();
  useCharacter.setState({ id: null, entity: null, dirty: false });
});

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
