// Local-first character storage (doc 03 §Storage): one IndexedDB record per
// character holding its dmv-character envelope, a summaries index for the
// list page, and drafts of unsaved changes. The same database holds the
// homebrew packs (packs.ts). When IndexedDB is unavailable or
// fails, as in some private windows, storage moves to memory for the rest of
// the session and useStorage says so. A request that fails after that is
// thrown to the caller. useStorage reports a failed write; a failed read is
// for its caller to report, since nothing unsaved is at risk.
import { create } from "zustand";
import type { Rules, StrictEntity } from "../engine/engine.ts";
import type { Sheet } from "../engine/sheet.ts";

/** The dmv-character envelope (doc 03), as stored. */
export interface CharacterRecord {
  format: "dmv-character";
  version: 1;
  rules: Rules;
  id: string;
  name: string | null;
  updatedAt: string;
  /** The old app's id, kept for reference. */
  legacyId: string | null;
  entity: StrictEntity;
}

/** What the list page shows for a character. Content keys are qualified by edition, as "2014/fighter". */
export interface CharacterSummary {
  id: string;
  rules: Rules;
  name: string | null;
  race: string | null;
  classes: { key: string; name: string; level: number }[];
  portrait: string | null;
  updatedAt: string;
}

/** Unsaved changes to a character, kept until autosave writes its record. */
export interface Draft {
  id: string;
  entity: StrictEntity;
  updatedAt: string;
}

export const useStorage = create<{ inMemory: boolean; failed: boolean }>(() => ({ inMemory: false, failed: false }));

/** Counts writes to the summaries index, so the list page can re-read it when it changes. */
export const useSummariesVersion = create<number>(() => 0);
const summariesChanged = () => useSummariesVersion.setState((version) => version + 1, true);

function toSummary(record: CharacterRecord, sheet: Sheet): CharacterSummary {
  return {
    id: record.id,
    rules: record.rules,
    name: sheet.name,
    race: sheet.race,
    classes: sheet.classes.map((c) => ({ key: `${record.rules}/${c.key}`, name: c.name, level: c.level })),
    portrait: sheet.portrait,
    updatedAt: record.updatedAt,
  };
}

/** Writes a character's record and its summary together. */
export function saveCharacter(record: CharacterRecord, sheet: Sheet): Promise<void> {
  return write([
    { store: "characters", put: record },
    { store: "summaries", put: toSummary(record, sheet) },
  ]).then(summariesChanged);
}

export function getCharacter(id: string): Promise<CharacterRecord | undefined> {
  return run((db) => db.get("characters", id) as Promise<CharacterRecord | undefined>);
}

/** Deletes a character's record, summary and draft. */
export function deleteCharacter(id: string): Promise<void> {
  return write([
    { store: "characters", delete: id },
    { store: "summaries", delete: id },
    { store: "drafts", delete: id },
  ]).then(summariesChanged);
}

export function listCharacters(): Promise<CharacterRecord[]> {
  return run((db) => db.getAll("characters") as Promise<CharacterRecord[]>);
}

export function listSummaries(): Promise<CharacterSummary[]> {
  return run((db) => db.getAll("summaries") as Promise<CharacterSummary[]>);
}

export function saveDraft(draft: Draft): Promise<void> {
  return write([{ store: "drafts", put: draft }]);
}

export function getDraft(id: string): Promise<Draft | undefined> {
  return run((db) => db.get("drafts", id) as Promise<Draft | undefined>);
}

export function deleteDraft(id: string): Promise<void> {
  return write([{ store: "drafts", delete: id }]);
}

type StoreName = "characters" | "summaries" | "drafts" | "packs";
const storeNames: StoreName[] = ["characters", "summaries", "drafts", "packs"];
type Write = { store: StoreName; put: { id: string } } | { store: StoreName; delete: string };

interface Backend {
  get(store: StoreName, id: string): Promise<unknown>;
  getAll(store: StoreName): Promise<unknown[]>;
  /** Applies the writes in one transaction. */
  write(writes: Write[]): Promise<void>;
}

let backend: Promise<Backend> | undefined;

// run and write are exported for packs.ts.

/** Runs op on IndexedDB, or on memory if IndexedDB does not open. */
export async function run<T>(op: (db: Backend) => Promise<T>): Promise<T> {
  backend ??= openIndexedDb().catch(toMemory);
  return op(await backend);
}

/** Applies the writes in one transaction, and reports in useStorage if they fail. */
export async function write(writes: Write[]): Promise<void> {
  try {
    await run((db) => db.write(writes));
  } catch (e) {
    useStorage.setState({ failed: true });
    throw e;
  }
}

function toMemory(reason: unknown): Backend {
  console.warn("Character storage is in memory:", reason);
  useStorage.setState({ inMemory: true });
  const stores = new Map(storeNames.map((name) => [name, new Map<string, unknown>()]));
  return {
    get: async (store, id) => stores.get(store)!.get(id),
    getAll: async (store) => [...stores.get(store)!.values()],
    write: async (writes) => {
      for (const w of writes) {
        if ("put" in w) stores.get(w.store)!.set(w.put.id, w.put);
        else stores.get(w.store)!.delete(w.delete);
      }
    },
  };
}

function openIndexedDb(): Promise<Backend> {
  return new Promise((resolve, reject) => {
    // Version 2 adds packs. An upgrade creates only the stores not there yet, so it keeps the others' records.
    const request = indexedDB.open("alchemy-5e", 2);
    request.onupgradeneeded = () => {
      for (const name of storeNames) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("IndexedDB is blocked"));
    request.onsuccess = () => {
      const db = request.result;
      // Closes this connection when another tab opens a later version, so its upgrade is not blocked.
      db.onversionchange = () => db.close();
      const read = (store: StoreName, query: (s: IDBObjectStore) => IDBRequest) =>
        new Promise<unknown>((resolve, reject) => {
          const r = query(db.transaction(store).objectStore(store));
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
      resolve({
        get: (store, id) => read(store, (s) => s.get(id)),
        getAll: (store) => read(store, (s) => s.getAll()) as Promise<unknown[]>,
        write: (writes) =>
          new Promise((resolve, reject) => {
            const tx = db.transaction([...new Set(writes.map((w) => w.store))], "readwrite");
            for (const w of writes) {
              if ("put" in w) tx.objectStore(w.store).put(w.put);
              else tx.objectStore(w.store).delete(w.delete);
            }
            tx.oncomplete = () => resolve();
            // A failed request aborts the transaction; tx.error is set by then.
            tx.onabort = () => reject(tx.error);
          }),
      });
    };
  });
}
