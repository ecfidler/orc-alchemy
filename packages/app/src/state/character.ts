// The open character (Plan Set 1 doc 04): the entity is the single source of
// truth; built and selections are derived from it with useEvaluation.
import { useMemo } from "react";
import { create } from "zustand";
import { engine, loadEngine, useEvaluation, type Homebrew, type Rules, type StrictEntity } from "../engine/engine.ts";
import { toSheet } from "../engine/sheet.ts";
import {
  deleteCharacter,
  deleteDraft,
  getCharacter,
  getDraft,
  saveCharacter,
  saveDraft,
  saveSummaries,
  useStorage,
  type CharacterRecord,
  type CharacterSummary,
} from "../storage/characters.ts";
import { restorePacks, useHomebrew } from "./homebrew.ts";

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

/**
 * The open character, built with the loaded homebrew, as { entity, built,
 * sheet, selections, dirty }; built, sheet and selections are null with no
 * character open.
 */
export function useOpenCharacter() {
  const entity = useCharacter((state) => state.entity);
  const dirty = useCharacter((state) => state.dirty);
  const homebrew = useHomebrew((state) => state.homebrew);
  const evaluation = useEvaluation(entity, homebrew);
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

/** Saves a record with entity, its name, and the time; and its summary, built with the loaded homebrew. */
function save(record: Omit<CharacterRecord, "name" | "updatedAt" | "entity">, entity: StrictEntity) {
  const { homebrew, fingerprint } = useHomebrew.getState();
  const sheet = buildSheet(entity, homebrew);
  return saveCharacter({ ...record, name: sheet.name, updatedAt: now(), entity }, sheet, fingerprint);
}

/**
 * Rebuilds, with the loaded homebrew, the summaries built with other
 * homebrew (ORC-115), and writes them together. A pack change does not
 * rebuild them, since each build takes tens of milliseconds; the list page
 * calls this instead. Restores the packs first, and loads the engine only if
 * a summary needs it. Builds one character at a time, so the page does not
 * stop. Stops, and writes nothing, as soon as isCurrent returns false, or if
 * the packs change. A character that does not build keeps its summary.
 */
export async function refreshSummaries(summaries: CharacterSummary[], isCurrent: () => boolean): Promise<void> {
  await restorePacks();
  const { homebrew, fingerprint } = useHomebrew.getState();
  const stale = summaries.filter((s) => s.fingerprint !== fingerprint);
  if (stale.length === 0) return;
  await loadEngine();
  // A pending autosave would write its own summary; saving it now keeps a rebuild from replacing that one.
  await flushAutosave().catch(console.error);
  const live = () => isCurrent() && useHomebrew.getState().fingerprint === fingerprint;
  const rebuilt = [];
  for (const { id } of stale) {
    await new Promise((resolve) => setTimeout(resolve));
    if (!live()) return;
    const record = await getCharacter(id);
    if (record === undefined) continue; // deleted since
    try {
      rebuilt.push({ record, sheet: buildSheet(record.entity, homebrew), fingerprint });
    } catch (e) {
      console.error(`The summary of character ${id} could not be rebuilt:`, e);
    }
  }
  if (rebuilt.length > 0 && live()) await saveSummaries(rebuilt);
}

const buildSheet = (entity: StrictEntity, homebrew: Homebrew | undefined) => toSheet(engine().evaluate(entity, { homebrew }).built, entity);

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

/** Changes not saved yet. Those put back after a failed save have no timer: Save, or the next flush, retries them. */
let pending: { id: string; entity: StrictEntity; timer?: ReturnType<typeof setTimeout> } | null = null;
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

/** Whether the failed-write notice comes from a save here, so a save that succeeds may clear it. */
let saveFailed = false;

/**
 * Saves the pending changes now, if there are any, and waits for every save
 * under way. If a save fails, its changes stay in their draft, and this
 * throws. They become pending again, with no timer, unless the open character
 * has newer changes. Leaving the page still asks first. A save that succeeds
 * clears the notice of a failed save.
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
        if (saveFailed) {
          saveFailed = false;
          useStorage.setState({ failed: false });
        }
        if (pending === null && saving.size === 0) window.removeEventListener("beforeunload", confirmLeave);
      },
      () => {
        saving.delete(running);
        // Storage reports failed writes; a failed read before the save is a failed save too.
        saveFailed = true;
        useStorage.setState({ failed: true });
        // A newer save of the character, under way or done, must not be replaced by this one.
        const state = useCharacter.getState();
        if (pending === null && state.id === id && state.entity === entity) pending = { id, entity };
      },
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
