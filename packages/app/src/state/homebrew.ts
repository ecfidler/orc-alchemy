// The loaded homebrew (doc 04 §Storage): the stored pack records, and the
// multi-plugin map built from them, the old app's :plugins, keyed by pack
// name. A stored record that does not read or build is quarantined: it stays
// in storage as it is, is not used, and the UI warns about it.
import { create } from "zustand";
import { engine, loadEngine, type ParsedOrcbrew } from "../engine/engine.ts";
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
  /** The last file's import, kept raw: the UI shows its log, which lists skipped items, and its conflicts. */
  lastImport: Omit<ParsedOrcbrew, "data"> | null;
  /**
   * Merges an .orcbrew file's text into the stored packs, skipping invalid
   * items. A single-plugin file loads as a pack named for the file. New packs
   * are enabled. A failed import leaves the packs as they were. Throws, and
   * changes nothing, if the file has a pack named as a quarantined record.
   * Needs the engine loaded.
   */
  load: (fileName: string, text: string) => Promise<void>;
  /** Removes a pack from storage. */
  remove: (pack: string) => Promise<void>;
  setPackEnabled: (pack: string, enabled: boolean) => Promise<void>;
  setItemEnabled: (pack: string, contentType: string, key: string, enabled: boolean) => Promise<void>;
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

  return {
    packs: [],
    quarantined: [],
    homebrew: undefined,
    lastImport: null,
    load: (fileName, text) => queued(async () => {
      await restorePacks();
      const { packs, quarantined } = get();
      const existing = packs.length === 0 ? undefined : Object.fromEntries(packs.map((p) => [p.id, p.plugin]));
      const { data, ...lastImport } = engine().parseOrcbrew(text, { name: fileName.replace(/\.orcbrew$/i, ""), existing });
      if (data === null) return set({ lastImport });
      const blocked = quarantined.find((q) => q.id in data);
      if (blocked) {
        throw new Error(`A stored pack named ${blocked.id} could not be read; it is kept as it is, so a pack of that name cannot be loaded.`);
      }
      const changed = Object.entries(data).flatMap(([id, plugin]): PackRecord[] => {
        const stored = packs.find((p) => p.id === id);
        if (stored !== undefined && JSON.stringify(stored.plugin) === JSON.stringify(plugin)) return [];
        return [{ id, rules: "2014", enabled: stored?.enabled ?? true, disabledItems: stored?.disabledItems ?? [], plugin, updatedAt: now() }];
      });
      if (changed.length === 0) return set({ lastImport });
      await savePacks(changed);
      set({ ...withPacks([...packs.filter((p) => !changed.some((c) => c.id === p.id)), ...changed]), lastImport });
    }),
    remove: (pack) => queued(async () => {
      await deletePack(pack);
      set(withPacks(get().packs.filter((p) => p.id !== pack)));
    }),
    setPackEnabled: (pack, enabled) => update(pack, (record) => (record.enabled === enabled ? null : { enabled })),
    setItemEnabled: (pack, contentType, key, enabled) =>
      update(pack, ({ disabledItems }) => {
        const others = disabledItems.filter(([t, k]) => t !== contentType || k !== key);
        if ((others.length < disabledItems.length) === !enabled) return null;
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
      const toMap = (packs: PackRecord[]) => Object.fromEntries(packs.map((p) => [p.id, p.plugin]));
      let packs = shaped;
      if (shaped.length > 0 && buildProblem(toMap(shaped)) !== null) {
        packs = [];
        for (const pack of shaped) {
          const reason = buildProblem(toMap([...packs, pack]));
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

/** packs, sorted by name so the homebrew is the same after a reload, and the homebrew built from them. */
function withPacks(packs: PackRecord[]): Pick<HomebrewState, "packs" | "homebrew"> {
  const sorted = [...packs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const enabled = sorted.filter((p) => p.enabled);
  return { packs: sorted, homebrew: enabled.length === 0 ? undefined : Object.fromEntries(enabled.map((p) => [p.id, withoutDisabled(p)])) };
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
