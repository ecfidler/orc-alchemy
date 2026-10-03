// The open character (Plan Set 1 doc 04): the entity is the single source of
// truth; built and selections are derived from it with useEvaluation.
import { useMemo } from "react";
import { create } from "zustand";
import { engine, useEvaluation, type Rules, type StrictEntity } from "../engine/engine.ts";
import { toSheet } from "../engine/sheet.ts";
import { deleteCharacter, deleteDraft, getCharacter, getDraft, saveCharacter, saveDraft, type CharacterRecord } from "../storage/characters.ts";

interface CharacterState {
  /** The open character's storage id. */
  id: string | null;
  entity: StrictEntity | null;
  dirty: boolean;
  /** Opens a character, as stored or, with dirty, with unsaved changes. */
  load: (id: string, entity: StrictEntity, dirty?: boolean) => void;
  /** Applies an engine mutation, such as (e) => engine().select(e, path, key). */
  update: (mutate: (entity: StrictEntity) => StrictEntity) => void;
}

export const useCharacter = create<CharacterState>()((set, get) => ({
  id: null,
  entity: null,
  dirty: false,
  load: (id, entity, dirty = false) => set({ id, entity, dirty }),
  update: (mutate) => {
    const { entity } = get();
    if (entity === null) throw new Error("No character is open");
    set({ entity: mutate(entity), dirty: true });
  },
}));

/** The open character as { entity, built, sheet, selections, dirty }; built, sheet and selections are null with no character open. */
export function useOpenCharacter() {
  const entity = useCharacter((state) => state.entity);
  const dirty = useCharacter((state) => state.dirty);
  const evaluation = useEvaluation(entity);
  const built = evaluation?.built ?? null;
  const sheet = useMemo(() => (built === null ? null : toSheet(built, entity!)), [built, entity]);
  return { entity, built, sheet, selections: evaluation?.selections ?? null, dirty };
}

/** Stores a new character and returns its id. Needs the engine loaded. */
export async function addCharacter(entity: StrictEntity, rules: Rules, legacyId: string | null): Promise<string> {
  const id = crypto.randomUUID();
  await save({ format: "dmv-character", version: 1, rules, id, legacyId }, entity);
  return id;
}

/** Saves a record with entity, its name, and the time; and its summary. */
function save(record: Omit<CharacterRecord, "name" | "updatedAt" | "entity">, entity: StrictEntity) {
  const sheet = toSheet(engine().evaluate(entity).built, entity);
  return saveCharacter({ ...record, name: sheet.name, updatedAt: now(), entity }, sheet);
}

/**
 * Reads a stored character to open with load: its draft, which is dirty, if
 * it has one, or else its record. Null when there is no such character.
 */
export async function readCharacter(id: string): Promise<{ entity: StrictEntity; dirty: boolean } | null> {
  const [record, draft] = await Promise.all([getCharacter(id), getDraft(id)]);
  if (record === undefined) return null;
  return draft === undefined ? { entity: record.entity, dirty: false } : { entity: draft.entity, dirty: true };
}

/** Deletes a stored character, and closes it if it is open. */
export async function removeCharacter(id: string): Promise<void> {
  // A pending save that ran after the delete would store the character again.
  await flushAutosave().catch(console.error);
  await deleteCharacter(id);
  if (useCharacter.getState().id === id) useCharacter.setState({ id: null, entity: null, dirty: false });
}

// Autosave, as the old app's autosave_fx.cljs: each change is kept as a draft
// at once, and the record is saved once changes stop for AUTOSAVE_DELAY_MS.
// Leaving the page before then asks for confirmation.

export const AUTOSAVE_DELAY_MS = 7500;

let pending: { id: string; entity: StrictEntity; timer: ReturnType<typeof setTimeout> } | null = null;
/** Saves under way, so a flush can wait for one the timer started. */
const saving = new Set<Promise<void>>();

useCharacter.subscribe((state, previous) => {
  // Opening another character saves the last one's pending changes now.
  if (pending !== null && pending.id !== state.id) flushAutosave().catch(console.error);
  if (!state.dirty || state.id === null || state.entity === null || state.entity === previous.entity) return;

  const { id, entity } = state;
  saveDraft({ id, entity, updatedAt: now() }).catch(console.error);
  if (pending === null) window.addEventListener("beforeunload", confirmLeave);
  else clearTimeout(pending.timer);
  pending = { id, entity, timer: setTimeout(() => void flushAutosave().catch(console.error), AUTOSAVE_DELAY_MS) };
});

/**
 * Saves the pending changes now, if there are any, and waits for every save
 * under way. If a save fails, its changes stay in their draft, leaving the
 * page still asks first, and this throws.
 */
export async function flushAutosave(): Promise<void> {
  if (pending !== null) {
    const { id, entity, timer } = pending;
    clearTimeout(timer);
    pending = null;
    const running = saveChanges(id, entity);
    saving.add(running);
    running.then(
      () => {
        saving.delete(running);
        if (pending === null && saving.size === 0) window.removeEventListener("beforeunload", confirmLeave);
      },
      () => saving.delete(running),
    );
  }
  await Promise.all(saving);
}

async function saveChanges(id: string, entity: StrictEntity) {
  const record = await getCharacter(id);
  if (record !== undefined) await save(record, entity); // undefined: deleted since
  // Changes made while saving stay dirty, with their draft.
  const state = useCharacter.getState();
  if (state.id !== id || state.entity === entity) await deleteDraft(id);
  if (state.id === id && state.entity === entity) useCharacter.setState({ dirty: false });
}

function confirmLeave(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = ""; // older browsers ask only when this is set
}

const now = () => new Date().toISOString();
