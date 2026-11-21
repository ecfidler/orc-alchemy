// The open character (Plan Set 1 doc 04): the entity is the single source of
// truth; built and selections are derived from it with useEvaluation.
import { useMemo } from "react";
import { create } from "zustand";
import { characterContent, pruneCustom } from "../engine/custom.ts";
import { type Content, engine, loadEngine, type Rules, type StrictEntity, useEvaluation } from "../engine/engine.ts";
import { FILE_VERSION } from "../engine/import.ts";
import { missingContent, remapOption, type UnresolvedKey } from "../engine/reconcile.ts";
import { toSheet } from "../engine/sheet.ts";
import {
  type CharacterRecord,
  type CharacterSummary,
  deleteCharacter,
  deleteDraft,
  getCharacter,
  getDraft,
  saveCharacter,
  saveDraft,
  saveSummaries,
  summaryFingerprint,
  useStorage,
} from "../storage/characters.ts";
import { restorePacks, useHomebrew } from "./homebrew.ts";
import { warnBeforeUnload } from "./unload-warning.ts";

interface CharacterState {
  /** The open character's storage id. */
  id: string | null;
  entity: StrictEntity | null;
  /** The open character's custom content (CharacterRecord.custom), or undefined with none. */
  custom: object | undefined;
  dirty: boolean;
  /**
   * Whether the save status says that there are unsaved changes. It has a
   * meaning only while dirty. A sheet change alone does not set it, because a
   * sheet change saves at once. A builder change sets it, and a failed save.
   */
  unsaved: boolean;
  /** Opens a character, as stored or, with dirty, with unsaved changes, and with its custom content. */
  load: (id: string, entity: StrictEntity, dirty?: boolean, custom?: object) => void;
  /** Applies an engine mutation, such as (e) => engine().select(e, path, key). The custom content stays. */
  update: (mutate: (entity: StrictEntity) => StrictEntity) => void;
  /**
   * Replaces the custom content and applies an engine mutation in one
   * change, so autosave stores them together. mutate gets the entity and
   * returns it changed, or as it is.
   */
  updateWithCustom: (custom: object | undefined, mutate: (entity: StrictEntity) => StrictEntity) => void;
  /**
   * Applies an engine mutation as a sheet change: a change to the play state
   * that the user makes from the sheet (docs/design/spells-panel.md, "How a
   * sheet change saves"). It keeps its draft at once, as each change does,
   * and the record saves SHEET_SAVE_DELAY_MS after the last sheet change,
   * together with the pending builder changes. The save status stays "Saved"
   * unless the save fails.
   */
  sheetChange: (mutate: (entity: StrictEntity) => StrictEntity) => void;
}

/** True while sheetChange applies its change, so the autosave below gives it the short delay. */
let inSheetChange = false;

export const useCharacter = create<CharacterState>()((set, get) => ({
  id: null,
  entity: null,
  custom: undefined,
  dirty: false,
  unsaved: false,
  load: (id, entity, dirty = false, custom = undefined) => set({ id, entity, dirty, unsaved: dirty, custom }),
  update: (mutate) => get().updateWithCustom(get().custom, mutate),
  updateWithCustom: (custom, mutate) => {
    const { entity } = get();
    if (entity === null) throw new Error("No character is open");
    set({ entity: mutate(entity), custom, dirty: true, unsaved: true });
  },
  sheetChange: (mutate) => {
    const { entity, dirty, unsaved } = get();
    if (entity === null) throw new Error("No character is open");
    inSheetChange = true;
    try {
      set({ entity: mutate(entity), dirty: true, unsaved: dirty && unsaved });
    } finally {
      inSheetChange = false;
    }
  },
}));

/** What the open character builds against: the loaded content with its custom content (characterContent). */
export function useCharacterContent(): Content {
  const custom = useCharacter((state) => state.custom);
  const content = useHomebrew((state) => state.content);
  return characterContent(content, custom);
}

/**
 * The open character, built with the loaded homebrew and its custom content,
 * as { entity, built, sheet, selections, dirty, unsaved, content }; built,
 * sheet and selections are null with no character open. unsaved is true
 * while the save status must say so: not for a sheet change that is on its
 * way to the record. content is what it builds against (useCharacterContent).
 */
export function useOpenCharacter() {
  const entity = useCharacter((state) => state.entity);
  const dirty = useCharacter((state) => state.dirty);
  const unsaved = useCharacter((state) => state.dirty && state.unsaved);
  const content = useCharacterContent();
  const evaluation = useEvaluation(entity, content);
  const built = evaluation?.built ?? null;
  const sheet = useMemo(() => (built === null ? null : toSheet(built, entity!)), [built, entity]);
  return { entity, built, sheet, selections: evaluation?.selections ?? null, dirty, unsaved, content };
}

/**
 * Stores a new character, with its custom content, and returns its id. Only
 * the custom items that the entity selects are stored (save). Needs the
 * engine loaded.
 */
export async function addCharacter(entity: StrictEntity, rules: Rules, legacyId: string | null, custom?: object): Promise<string> {
  const id = crypto.randomUUID();
  await save({ format: "dmv-character", rules, id, legacyId }, entity, custom);
  return id;
}

/**
 * Saves a record, as version FILE_VERSION, with entity, its custom content, its name, and the time; and
 * its summary, built with the loaded homebrew and the custom content. Only
 * the custom items that entity selects are stored (pruneCustom), and the
 * custom content stored is returned: undefined when none is left.
 */
async function save(record: Omit<CharacterRecord, "version" | "name" | "updatedAt" | "entity">, entity: StrictEntity, custom: object | undefined) {
  const { content, fingerprint } = useHomebrew.getState();
  const kept = pruneCustom(entity, custom);
  const sheet = buildSheet(entity, characterContent(content, kept));
  const { custom: _, ...rest } = record;
  await saveCharacter(
    { ...rest, version: FILE_VERSION, name: sheet.name, updatedAt: now(), entity, ...(kept === undefined ? {} : { custom: kept }) },
    sheet,
    fingerprint,
  );
  return kept;
}

/**
 * A stored character's option keys that the loaded packs do not resolve.
 * Null when there is no such character. Needs the engine loaded.
 */
export async function checkStoredCharacter(id: string): Promise<UnresolvedKey[] | null> {
  const record = await getCharacter(id);
  return record === undefined ? null : missingContent(record.entity, characterContent(useHomebrew.getState().content, record.custom));
}

/**
 * Gives a stored character's option at path a new key (remapOption), saves
 * it, and returns its keys that still do not resolve. Throws if the open
 * character's pending save fails, if there is no such character, or as
 * remapOption throws. Needs the engine loaded.
 */
export async function remapStoredCharacter(id: string, path: string[], newKey: string): Promise<UnresolvedKey[]> {
  // A pending save of the open character would write its entity over this change,
  // so a failed save stops the remap: the open character keeps its unsaved changes.
  await flushAutosave();
  const record = await getCharacter(id);
  if (record === undefined) throw new Error("The character is no longer stored");
  const entity = remapOption(record.entity, path, newKey);
  const custom = await save(record, entity, record.custom);
  const open = useCharacter.getState();
  if (open.id === id) open.load(id, entity, false, custom);
  return missingContent(entity, characterContent(useHomebrew.getState().content, custom));
}

/**
 * Rebuilds, with the loaded homebrew, the summaries built with other
 * homebrew (ORC-115), and writes them together. A summary of a character
 * with custom content is compared, and rebuilt, with that content too. A
 * pack change does not rebuild them, since each build takes tens of
 * milliseconds; the list page calls this instead. Restores the packs first, and loads the engine only if
 * a summary needs it. Builds one character at a time, so the page does not
 * stop. Stops, and writes nothing, as soon as isCurrent returns false, or if
 * the packs change. A character that does not build keeps its summary.
 */
export async function refreshSummaries(summaries: CharacterSummary[], isCurrent: () => boolean): Promise<void> {
  await restorePacks();
  const { content, fingerprint } = useHomebrew.getState();
  const stale = summaries.filter((s) => s.fingerprint !== summaryFingerprint(fingerprint, s.customHash));
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
      rebuilt.push({ record, sheet: buildSheet(record.entity, characterContent(content, record.custom)), fingerprint });
    } catch (e) {
      console.error(`The summary of character ${id} could not be rebuilt:`, e);
    }
  }
  if (rebuilt.length > 0 && live()) await saveSummaries(rebuilt);
}

const buildSheet = (entity: StrictEntity, content: Content) => toSheet(engine().evaluate(entity, content).built, entity);

/**
 * Reads a stored character to open with load: its draft, which is dirty, if
 * it has one, or else its record, each with its custom content. Null when
 * there is no such character.
 */
export async function readCharacter(id: string): Promise<{ entity: StrictEntity; dirty: boolean; custom: object | undefined } | null> {
  const [record, draft] = await Promise.all([getCharacter(id), getDraft(id)]);
  if (record === undefined) return null;
  return draft === undefined ? { entity: record.entity, dirty: false, custom: record.custom } : { entity: draft.entity, dirty: true, custom: draft.custom };
}

/** Deletes a stored character, and closes it if it is open. */
export async function removeCharacter(id: string): Promise<void> {
  // A pending save that ran after the delete would store the character again.
  await flushAutosave().catch(console.error);
  await deleteCharacter(id);
  if (useCharacter.getState().id === id) useCharacter.setState({ id: null, entity: null, custom: undefined, dirty: false, unsaved: false });
}

// Autosave, as the old app's autosave_fx.cljs: each change is kept as a draft
// at once, and the record is saved once changes stop for AUTOSAVE_DELAY_MS.
// A sheet change (sheetChange) is saved SHEET_SAVE_DELAY_MS after the last
// sheet change, so that quick clicks go in one save. Each save writes all
// pending changes of the character. Leaving the page before then asks for
// confirmation.

export const AUTOSAVE_DELAY_MS = 7500;
export const SHEET_SAVE_DELAY_MS = 500;

/** An entity and the custom content that goes with it, as one change to save. */
interface Changes {
  entity: StrictEntity;
  custom: object | undefined;
}

/**
 * Changes not saved yet. Those put back after a failed save have no timer:
 * Save, or the next flush, retries them. sheetDue is the time at which a
 * pending sheet change saves: a builder change after it does not move that
 * time.
 */
let pending: { id: string; changes: Changes; timer?: ReturnType<typeof setTimeout>; sheetDue?: number } | null = null;
/** Saves under way, so a flush can wait for one the timer started. */
const saving = new Set<Promise<void>>();

useCharacter.subscribe((state, previous) => {
  // Opening another character saves the last one's pending changes now.
  if (pending !== null && pending.id !== state.id) flushAutosave().catch(console.error);
  if (!state.dirty || state.id === null || state.entity === null) return;
  if (state.entity === previous.entity && state.custom === previous.custom) return;

  const { id, entity, custom } = state;
  saveDraft({ id, entity, ...(custom === undefined ? {} : { custom }), updatedAt: now() }).catch(console.error);
  if (pending === null) window.addEventListener("beforeunload", warnBeforeUnload);
  else clearTimeout(pending.timer);
  const sheetDue = inSheetChange ? Date.now() + SHEET_SAVE_DELAY_MS : pending?.id === id ? pending.sheetDue : undefined;
  const delay = sheetDue === undefined ? AUTOSAVE_DELAY_MS : Math.max(0, sheetDue - Date.now());
  pending = { id, changes: { entity, custom }, timer: setTimeout(() => void flushAutosave().catch(console.error), delay), sheetDue };
});

/** The changes of the last save started for each character, so an older save that fails does not replace a newer one. */
const latest = new Map<string, Changes>();
/** Whether the failed-write notice comes from a save here, so a save that succeeds may clear it. */
let saveFailed = false;

/**
 * Saves the pending changes now, if there are any, and waits for every save
 * under way. If a save fails, its changes stay in their draft, and this
 * throws. They become pending again, with no timer, unless newer changes are
 * pending or a newer save of the character has started. The save status of
 * the open character then says that it has unsaved changes. Leaving the page
 * still asks first. A save that succeeds clears the notice of a failed save.
 */
export async function flushAutosave(): Promise<void> {
  if (pending !== null) {
    const { id, changes, timer } = pending;
    clearTimeout(timer);
    pending = null;
    latest.set(id, changes);
    const running = saveChanges(id, changes);
    saving.add(running);
    running.then(
      () => {
        saving.delete(running);
        if (saveFailed) {
          saveFailed = false;
          useStorage.setState({ failed: false });
        }
        if (pending === null && saving.size === 0) window.removeEventListener("beforeunload", warnBeforeUnload);
      },
      () => {
        saving.delete(running);
        if (latest.get(id) !== changes) {
          // A newer save of the character, under way or done, reports for itself.
          if (pending === null && saving.size === 0) window.removeEventListener("beforeunload", warnBeforeUnload);
          return;
        }
        // Storage reports failed writes; a failed read before the save is a failed save too.
        saveFailed = true;
        useStorage.setState({ failed: true });
        // A sheet change that did not save is an unsaved change to show, with the Save button.
        if (useCharacter.getState().id === id) useCharacter.setState({ unsaved: true });
        if (pending === null) pending = { id, changes };
      },
    );
  }
  await Promise.all(saving);
}

async function saveChanges(id: string, { entity, custom }: Changes) {
  const record = await getCharacter(id);
  const kept = record === undefined ? custom : await save(record, entity, custom); // undefined: deleted since
  // Changes made while saving stay dirty, with their draft.
  const isSaved = (state: CharacterState) => state.id === id && state.entity === entity && state.custom === custom;
  const state = useCharacter.getState();
  if (state.id !== id || isSaved(state)) await deleteDraft(id);
  // The open character takes the custom content as stored, without its unused items; it is not a change to save.
  if (isSaved(useCharacter.getState()))
    useCharacter.setState(kept === custom ? { dirty: false, unsaved: false } : { dirty: false, unsaved: false, custom: kept });
}

const now = () => new Date().toISOString();
