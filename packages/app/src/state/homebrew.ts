// The loaded homebrew (doc 04 §Storage): the stored pack records, and the
// multi-plugin map built from them, the old app's :plugins, keyed by pack
// name. A stored record that does not read or build is quarantined: it stays
// in storage as it is, is not used, and the UI warns about it.
import { create } from "zustand";
import { engine, loadEngine, type ParsedOrcbrew } from "../engine/engine.ts";
import { resolveConflicts as applyChoices, type Resolution } from "../engine/conflicts.ts";
import type { BundleHomebrew } from "../engine/import.ts";
import { deletePack, listPacks, savePacks, type PackRecord } from "../storage/packs.ts";

interface HomebrewState {
  /** The stored packs that read and build, sorted by name. */
  packs: PackRecord[];
  /** The stored records not used, with why. */
  quarantined: { id: string; reason: string }[];
  /**
   * The enabled packs without their disabled items, or undefined with none,
   * so the character builds against the SRD alone. A new object only when
   * packs changes.
   */
  homebrew: Record<string, object> | undefined;
  /**
   * Names the homebrew: the enabled packs with the times they last changed,
   * or "" with none. A character summary stores it, so the list page can
   * find summaries built with other homebrew.
   */
  fingerprint: string;
  /** The last import, kept raw, with the name of its file: the UI shows its log and its conflicts. */
  lastImport: LastImport | null;
  /** An .orcbrew import that waits for a choice on each of its key conflicts, or null. */
  pending: PendingImport | null;
  /**
   * Merges an .orcbrew file's text into the stored packs, skipping invalid
   * items, or, with strict, refusing the whole file if an item is invalid. A
   * single-plugin file loads as a pack named for the file. New packs are
   * enabled. A failed import leaves the packs as they were. A file with key
   * conflicts stores nothing yet: it becomes pending, and resolveConflicts or
   * cancelImport ends it. Throws, leaving the packs as they were and
   * lastImport null, if the file has a pack named as a quarantined record,
   * or if the importer throws.
   * Needs the engine loaded.
   */
  load: (fileName: string, text: string, options?: { strict?: boolean }) => Promise<void>;
  /**
   * Merges a dmv-export bundle's packs into the stored packs, as load merges
   * a multi-plugin file, and gives each bundle pack its flags from the
   * bundle. A bundle pack without flags keeps its stored flags, or is
   * enabled when new. Its key conflicts do not make it pending: the packs
   * come from this app, so their conflicts were resolved when they were
   * loaded. Throws as load does. Needs the engine loaded.
   */
  loadBundle: (bundle: BundleHomebrew, fileName: string) => Promise<void>;
  /**
   * Applies a choice to each of the pending import's key conflicts, then
   * stores the packs as load does. The applied renames join its log. Throws,
   * and keeps the import pending, if a choice is missing or a rename fails.
   */
  resolveConflicts: (choices: Record<string, Resolution>) => Promise<void>;
  /** Drops the pending import. Nothing of it was stored. */
  cancelImport: () => void;
  /** Removes a pack from storage. */
  remove: (pack: string) => Promise<void>;
  setPackEnabled: (pack: string, enabled: boolean) => Promise<void>;
  setItemEnabled: (pack: string, contentType: string, key: string, enabled: boolean) => Promise<void>;
}

/** One import's result without its data, and the name of the file it read. */
export type LastImport = Omit<ParsedOrcbrew, "data"> & { fileName: string };

/** An import held for its key conflicts: its result, and the homebrew it parsed (the stored packs with the file merged in). */
export interface PendingImport {
  /** New for each pending import, so the UI starts each one with no choices. */
  id: string;
  result: LastImport;
  homebrew: Record<string, object>;
}

interface MergeOptions {
  /** The file the text came from, for the import log. */
  fileName: string;
  /** The pack name for a single-plugin file. */
  name: string;
  flags: BundleHomebrew["flags"];
  strict?: boolean;
  /** Hold an import that has key conflicts as pending, instead of storing it. */
  askOnConflicts?: boolean;
}

export const useHomebrew = create<HomebrewState>()((set, get) => {
  let queue: Promise<unknown> = Promise.resolve();
  /** Runs a change after the ones before it, so each starts from the packs the last one left. */
  function queued<T>(change: () => Promise<T>): Promise<T> {
    const running = queue.then(change);
    queue = running.catch(() => {}); // a failed change does not stop the next
    return running;
  }

  /** Stores a changed pack and puts it in the state; change returns null when the pack is already as asked. */
  const update = (pack: string, change: (record: PackRecord) => Partial<PackRecord> | null) =>
    queued(async () => {
      const record = get().packs.find((p) => p.id === pack);
      if (record === undefined) throw new Error(`No pack named ${pack}`);
      const fields = change(record);
      if (fields === null) return;
      const changed = { ...record, ...fields, updatedAt: now() };
      await savePacks([changed]);
      set(withPacks(get().packs.map((p) => (p.id === pack ? changed : p))));
    });

  /**
   * Parses .orcbrew text over the stored packs, strictly if asked, and
   * stores the packs it changes, or holds it as pending for its key
   * conflicts if asked. The import's log becomes lastImport; an import that
   * throws clears it. Runs inside queued.
   */
  async function merge(text: string, { fileName, name, flags, strict = false, askOnConflicts = false }: MergeOptions) {
    set({ lastImport: null, pending: null }); // so an error is not shown under an earlier file's log
    await restorePacks();
    const { packs } = get();
    const existing = packs.length === 0 ? undefined : pluginMap(packs);
    let parsed: ParsedOrcbrew;
    try {
      parsed = engine().parseOrcbrew(text, { name, existing, strict });
    } catch (e) {
      // Engine 0.2.0 throws on an item or pack that is not a map (ORC-116), with a ClojureScript message.
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`The homebrew could not be read. An item or pack in the file may not be a map. (Engine message: ${detail})`);
    }
    const { data, ...withoutData } = parsed;
    const lastImport = { ...withoutData, fileName };
    if (data === null) return set({ lastImport });
    checkQuarantine(data);
    if (askOnConflicts && lastImport.conflicts.length > 0) return set({ pending: { id: crypto.randomUUID(), result: lastImport, homebrew: data } });
    await store(data, flags, lastImport);
  }

  /** Throws if the homebrew has a pack named as a quarantined record. */
  function checkQuarantine(data: Record<string, object>) {
    const blocked = get().quarantined.find((q) => q.id in data);
    if (blocked) {
      throw new Error(`A stored pack named ${blocked.id} could not be read; it is kept as it is, so a pack of that name cannot be loaded.`);
    }
  }

  /**
   * Stores the packs of the homebrew that differ from the stored ones, and
   * makes lastImport the import's result. A changed pack takes its flags from
   * flags, or keeps its stored ones, or is enabled when new.
   */
  async function store(data: Record<string, object>, flags: BundleHomebrew["flags"], lastImport: LastImport) {
    const { packs } = get();
    const changed = Object.entries(data).flatMap(([id, plugin]): PackRecord[] => {
      const stored = packs.find((p) => p.id === id);
      const { enabled, disabledItems } = flags[id] ?? stored ?? { enabled: true, disabledItems: [] };
      if (
        stored !== undefined &&
        JSON.stringify(stored.plugin) === JSON.stringify(plugin) &&
        stored.enabled === enabled &&
        JSON.stringify(stored.disabledItems) === JSON.stringify(disabledItems)
      ) {
        return [];
      }
      return [{ id, rules: "2014", enabled, disabledItems, plugin, updatedAt: now() }];
    });
    if (changed.length === 0) return set({ lastImport });
    await savePacks(changed);
    set({ ...withPacks([...packs.filter((p) => !changed.some((c) => c.id === p.id)), ...changed]), lastImport });
  }

  return {
    packs: [],
    quarantined: [],
    homebrew: undefined,
    fingerprint: "",
    lastImport: null,
    pending: null,
    load: (fileName, text, { strict } = {}) =>
      queued(() => merge(text, { fileName, name: fileName.replace(/\.orcbrew$/i, ""), flags: {}, strict, askOnConflicts: true })),
    // Through .orcbrew text, so the bundle's packs get the same checks as a file's.
    loadBundle: ({ homebrew, flags }, fileName) =>
      queued(() => merge(engine().orcbrewToEdn(homebrew), { fileName, name: "dmv-export", flags })),
    resolveConflicts: (choices) =>
      queued(async () => {
        const pending = get().pending;
        if (pending === null) throw new Error("No import is waiting on its conflicts");
        const { result, homebrew } = pending;
        const { homebrew: resolved, renames } = applyChoices(homebrew, result.conflicts, choices);
        const renamed = renames.map(({ pack, contentType, from, to }) => ({ type: "key-renamed", pack, "content-type": contentType, from, to }));
        await store(resolved, {}, { ...result, log: { ...result.log, changes: [...result.log.changes, ...renamed] }, conflicts: [] });
        set({ pending: null });
      }),
    cancelImport: () => set({ pending: null }),
    remove: (pack) => queued(async () => {
      await deletePack(pack);
      set(withPacks(get().packs.filter((p) => p.id !== pack)));
    }),
    setPackEnabled: (pack, enabled) => update(pack, (record) => (record.enabled === enabled ? null : { enabled })),
    setItemEnabled: (pack, contentType, key, enabled) =>
      update(pack, ({ disabledItems }) => {
        const others = disabledItems.filter(([t, k]) => t !== contentType || k !== key);
        const disabled = others.length < disabledItems.length;
        if (disabled !== enabled) return null;
        return { disabledItems: enabled ? others : [...others, [contentType, key]] };
      }),
  };
});

let restoring: Promise<void> | undefined;

/**
 * Reads the stored packs into useHomebrew once; later calls return the same
 * promise, or try again after a failed read. Loads the engine to check them
 * when there are any. Wait for it before building a character to store.
 */
export function restorePacks(): Promise<void> {
  restoring ??= listPacks()
    .then(async (records) => {
      if (records.length === 0) return;
      await loadEngine();
      const shaped: PackRecord[] = [];
      const quarantined: HomebrewState["quarantined"] = [];
      for (const record of records) {
        const reason = shapeProblem(record);
        if (reason === null) shaped.push(record as PackRecord);
        else quarantined.push({ id: String((record as { id?: unknown } | null)?.id), reason });
      }
      // One build checks them all. If it fails, the packs are added one at a time in
      // name order, and each that does not build with the ones before it is quarantined.
      let packs = shaped;
      if (shaped.length > 0 && buildProblem(pluginMap(shaped)) !== null) {
        packs = [];
        for (const pack of shaped) {
          const reason = buildProblem(pluginMap([...packs, pack]));
          if (reason === null) packs.push(pack);
          else quarantined.push({ id: pack.id, reason: `The engine could not build it: ${reason}` });
        }
      }
      useHomebrew.setState({ ...withPacks(packs), quarantined });
    })
    .catch((e) => {
      restoring = undefined;
      throw e;
    });
  return restoring;
}

/** The loaded packs as stored, disabled ones too, with their flags: the homebrew of a dmv-export bundle. */
export function bundleHomebrew(): BundleHomebrew {
  const { packs } = useHomebrew.getState();
  return {
    homebrew: pluginMap(packs),
    flags: Object.fromEntries(packs.map(({ id, enabled, disabledItems }) => [id, { enabled, disabledItems }])),
  };
}

/** The multi-plugin map of these packs, as stored. */
const pluginMap = (packs: PackRecord[]) => Object.fromEntries(packs.map((p) => [p.id, p.plugin]));

function shapeProblem(record: unknown): string | null {
  const isMap = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
  const isItem = (item: unknown) => Array.isArray(item) && item.length === 2 && item.every((s) => typeof s === "string");
  if (
    !isMap(record) ||
    typeof record.id !== "string" ||
    !isMap(record.plugin) ||
    typeof record.enabled !== "boolean" ||
    !Array.isArray(record.disabledItems) ||
    !record.disabledItems.every(isItem)
  ) {
    return "The record is not a stored pack.";
  }
  if (record.rules !== "2014") return `The record is for rules ${JSON.stringify(record.rules)}; only 2014 packs are used.`;
  return null;
}

function buildProblem(homebrew: Record<string, object>): string | null {
  try {
    engine().buildTemplate(homebrew);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

/** packs, sorted by name so the homebrew is the same after a reload, and the homebrew built from them, with its fingerprint. */
function withPacks(packs: PackRecord[]): Pick<HomebrewState, "packs" | "homebrew" | "fingerprint"> {
  const sorted = [...packs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const enabled = sorted.filter((p) => p.enabled);
  return {
    packs: sorted,
    homebrew: enabled.length === 0 ? undefined : Object.fromEntries(enabled.map((p) => [p.id, withoutDisabled(p)])),
    // Every change to a pack, its flags included, sets its updatedAt.
    fingerprint: enabled.length === 0 ? "" : JSON.stringify(enabled.map((p) => [p.id, p.updatedAt])),
  };
}

function withoutDisabled({ plugin, disabledItems }: PackRecord): object {
  if (disabledItems.length === 0) return plugin;
  const copy: Record<string, Record<string, unknown>> = { ...(plugin as Record<string, Record<string, unknown>>) };
  for (const [contentType, key] of disabledItems) {
    if (copy[contentType] === undefined) continue;
    const { [key]: _disabled, ...rest } = copy[contentType];
    copy[contentType] = rest;
  }
  return copy;
}

const now = () => new Date().toISOString();
