// The open character (Plan Set 1 doc 04): the entity is the single source of
// truth; built and selections are derived from it with useEvaluation.
import { useMemo } from "react";
import { create } from "zustand";
import { engine, useEvaluation, type StrictEntity } from "../engine/engine.ts";
import { toSheet } from "../engine/sheet.ts";
import { deleteDraft, getCharacter, getDraft, saveCharacter, saveDraft } from "../storage/characters.ts";

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
  const sheet = useMemo(() => (built === null ? null : toSheet(built)), [built]);
  return { entity, built, sheet, selections: evaluation?.selections ?? null, dirty };
}

/** Stores a new character and returns its id. Needs the engine loaded. */
export async function addCharacter(entity: StrictEntity, legacyId: string | null): Promise<string> {
  const id = crypto.randomUUID();
  const sheet = toSheet(engine().evaluate(entity).built);
  const record = { format: "dmv-character", version: 1, rules: "2014", id, name: sheet.name, updatedAt: now(), legacyId, entity } as const;
  await saveCharacter(record, sheet);
  return id;
}

/** Opens a stored character, recovering its draft if it has one. False when there is no such character. */
export async function openCharacter(id: string): Promise<boolean> {
  const [record, draft] = await Promise.all([getCharacter(id), getDraft(id)]);
  if (record === undefined) return false;
  useCharacter.getState().load(id, draft?.entity ?? record.entity, draft !== undefined);
  return true;
}

// Autosave, as the old app's autosave_fx.cljs: each change is kept as a draft
// at once, and the record is saved once changes stop for AUTOSAVE_DELAY_MS.
// Leaving the page before then asks for confirmation.

export const AUTOSAVE_DELAY_MS = 7500;

let pending: { id: string; entity: StrictEntity; timer: ReturnType<typeof setTimeout> } | null = null;

useCharacter.subscribe((state, previous) => {
  // Opening another character saves the last one's pending changes now.
  if (pending !== null && pending.id !== state.id) void flushAutosave();
  if (!state.dirty || state.id === null || state.entity === null || state.entity === previous.entity) return;

  const { id, entity } = state;
  void saveDraft({ id, entity, updatedAt: now() });
  if (pending === null) window.addEventListener("beforeunload", confirmLeave);
  else clearTimeout(pending.timer);
  pending = { id, entity, timer: setTimeout(() => void flushAutosave(), AUTOSAVE_DELAY_MS) };
});

/** Saves the pending changes now, if there are any. */
export async function flushAutosave(): Promise<void> {
  if (pending === null) return;
  const { id, entity, timer } = pending;
  clearTimeout(timer);
  pending = null;
  window.removeEventListener("beforeunload", confirmLeave);

  const record = await getCharacter(id);
  if (record === undefined) return; // deleted since
  const sheet = toSheet(engine().evaluate(entity).built);
  await saveCharacter({ ...record, name: sheet.name, updatedAt: now(), entity }, sheet);
  // Changes made while saving stay dirty, with their draft.
  const state = useCharacter.getState();
  if (state.id !== id || state.entity === entity) await deleteDraft(id);
  if (state.id === id && state.entity === entity) useCharacter.setState({ dirty: false });
}

function confirmLeave(event: BeforeUnloadEvent) {
  event.preventDefault();
}

const now = () => new Date().toISOString();
