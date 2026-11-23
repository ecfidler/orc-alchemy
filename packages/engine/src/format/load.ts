// The loader of a 2024 content pack: read the version, upgrade an older pack
// one version at a time, refuse a newer pack, then validate
// (docs/design/2024-content-format.md, section "The schema and the version").
//
// A record that fails validation does not stop the pack. The loader drops
// the record, keeps the others, and reports the record with the path of
// each bad value.

import type { z } from "zod";
import { isReference, parseReference } from "./keys.ts";
import { type AnyRecord, CURRENT_VERSION, Envelope, FORMAT, type Pack, RECORD_SCHEMAS, RECORD_TYPES, type RecordType } from "./schema.ts";

/** The path of a value in a pack file or a record: `["feats", 2, "effects", 0, "add"]`. */
export type IssuePath = (string | number)[];

/** One issue that the loader found. */
export interface LoadIssue {
  /** The path of the bad value in the pack file. */
  path: IssuePath;
  message: string;
  /**
   * What the loader did. `pack`: it refused the whole pack. `record`: it
   * dropped the record. `effects`: it kept the display layer of the record
   * and dropped its effects. `none`: it kept the record as it is, for an
   * unknown field of the pack and for a reference that does not resolve.
   */
  dropped: "pack" | "record" | "effects" | "none";
}

export interface LoadResult {
  /** null when the loader refused the pack. */
  pack: Pack | null;
  issues: LoadIssue[];
}

/** Changes a pack of one version into a pack of the next version. */
export type Upgrade = (pack: Record<string, unknown>) => Record<string, unknown>;

export interface LoadOptions {
  /** The version that the loader reads. The default is the version of this engine. */
  version?: number;
  /** The upgrade from each older version to the next: `upgrades[1]` takes a version 1 pack to version 2. */
  upgrades?: Readonly<Record<number, Upgrade>>;
  /** The names of the hooks that the engine has. A record that calls another hook loses its effects. */
  hooks?: ReadonlySet<string>;
}

/** The upgrades of the real format. Version 1 is the first, so there are none yet. */
export const UPGRADES: Readonly<Record<number, Upgrade>> = {};

/**
 * The issues of a Zod error as load issues. For a value that matches no
 * branch of a union, the issues of the branch that got furthest stand for
 * the union, so that the path names the bad field.
 */
function toIssues(issues: readonly z.core.$ZodIssue[], base: IssuePath, dropped: LoadIssue["dropped"]): LoadIssue[] {
  return issues.flatMap((issue) => {
    const path = [...base, ...issue.path.map((p) => (typeof p === "symbol" ? String(p) : p))];
    if (issue.code === "invalid_union" && issue.errors.length > 0) {
      const depth = (branch: readonly z.core.$ZodIssue[]) =>
        Math.max(...branch.map((i) => i.path.length + (i.code === "unrecognized_keys" || i.code === "invalid_type" ? 0 : 1)));
      const best = [...issue.errors].sort((a, b) => depth(b) - depth(a) || a.length - b.length)[0];
      return toIssues(best, path, dropped);
    }
    return [{ path, message: issue.message, dropped }];
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Each string field named `field` in a tree of effects, with its path. */
function fieldsNamed(value: unknown, field: string, path: IssuePath): { value: string; path: IssuePath }[] {
  if (Array.isArray(value)) return value.flatMap((item, i) => fieldsNamed(item, field, [...path, i]));
  if (!isObject(value)) return [];
  const own = typeof value[field] === "string" ? [{ value: value[field], path: [...path, field] }] : [];
  return [...own, ...Object.entries(value).flatMap(([key, child]) => (key === field ? [] : fieldsNamed(child, field, [...path, key])))];
}

/** Each hook that the effects of a record name, with its path in the record. */
function hookCalls(record: unknown): { hook: string; path: IssuePath }[] {
  return fieldsNamed(record, "hook", []).map(({ value, path }) => ({ hook: value, path }));
}

/**
 * Reads a pack file that `JSON.parse` gave. Refuses a value that is not a
 * pack of this format and a pack of a newer version.
 */
export function loadPack(input: unknown, options: LoadOptions = {}): LoadResult {
  const current = options.version ?? CURRENT_VERSION;
  const upgrades = options.upgrades ?? UPGRADES;
  const refuse = (path: IssuePath, message: string): LoadResult => ({ pack: null, issues: [{ path, message, dropped: "pack" }] });

  if (!isObject(input)) return refuse([], "A pack is a JSON object");
  if (input.format !== FORMAT) return refuse(["format"], `This is not a content pack: "format" must be "${FORMAT}"`);
  const version = input.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) return refuse(["version"], '"version" must be a whole number from 1');
  if (version > current) {
    return refuse(["version"], `This pack has format version ${version}, and this app reads version ${current} or older. Update the app to load the pack.`);
  }

  let data: Record<string, unknown> = input;
  for (let v = version; v < current; v += 1) {
    const upgrade = upgrades[v];
    if (!upgrade) return refuse(["version"], `No upgrade from format version ${v} to ${v + 1}`);
    const upgraded = upgrade(data);
    if (!isObject(upgraded)) return refuse(["version"], `The upgrade from format version ${v} to ${v + 1} did not give a pack`);
    data = { ...upgraded, version: v + 1 };
  }

  const envelope = Envelope.safeParse({ format: data.format, version: data.version, rules: data.rules, pack: data.pack });
  if (!envelope.success) return { pack: null, issues: toIssues(envelope.error.issues, [], "pack") };

  const issues: LoadIssue[] = [];
  const known = new Set(["format", "version", "rules", "pack", ...RECORD_TYPES]);
  for (const key of Object.keys(data)) {
    if (!known.has(key)) issues.push({ path: [key], message: `"${key}" is not a record type, so the loader skips it`, dropped: "none" });
  }

  const pack = { ...envelope.data } as Pack;
  for (const type of RECORD_TYPES) {
    const list = data[type] ?? [];
    const records: AnyRecord[] = [];
    if (!Array.isArray(list)) {
      issues.push({ path: [type], message: `"${type}" must be a list of records`, dropped: "record" });
    } else {
      const keys = new Set<string>();
      list.forEach((raw, index) => {
        const parsed = RECORD_SCHEMAS[type].safeParse(raw);
        if (!parsed.success) {
          issues.push(...toIssues(parsed.error.issues, [type, index], "record"));
          return;
        }
        const record = parsed.data as AnyRecord;
        if (keys.has(record.key)) {
          issues.push({ path: [type, index, "key"], message: `Two ${type} records have the key "${record.key}"`, dropped: "record" });
          return;
        }
        keys.add(record.key);
        records.push(withKnownHooks(record, [type, index], options.hooks, issues));
      });
    }
    (pack as Record<RecordType, AnyRecord[]>)[type] = records;
  }

  return { pack, issues };
}

/** The record, or the record without its rules when one of them calls a hook that the engine does not have. */
function withKnownHooks(record: AnyRecord, path: IssuePath, hooks: ReadonlySet<string> | undefined, issues: LoadIssue[]): AnyRecord {
  if (!hooks) return record;
  const unknown = hookCalls(record).filter((call) => !hooks.has(call.hook));
  if (unknown.length === 0) return record;
  for (const call of unknown) {
    issues.push({
      path: [...path, ...call.path],
      message: `The engine has no hook "${call.hook}", so the record loads without its effects`,
      dropped: "effects",
    });
  }
  return withoutRules(record);
}

/** Whether the record has a rules layer: its effects, and for a class or a subclass also the effects of its levels. */
export function hasRules(record: AnyRecord): boolean {
  return "effects" in record || "levels" in record;
}

/** The record with its display layer only: without its effects and the effects of its levels. */
export function withoutRules(record: AnyRecord): AnyRecord {
  const display: Record<string, unknown> = { ...record };
  delete display.effects;
  delete display.levels;
  return display as AnyRecord;
}

// References.

/**
 * Each reference field of a record type, with the record type that it
 * points to. The field of a reference gives the type, so "srd52:shield"
 * can be a spell and an item of equipment.
 */
interface ReferenceAt {
  path: IssuePath;
  reference: string;
  type: RecordType;
}

function referencesInEffects(value: unknown, path: IssuePath): ReferenceAt[] {
  return fieldsNamed(value, "grantFeat", path).map((found) => ({ path: found.path, reference: found.value, type: "feats" }));
}

function equipmentReferences(options: unknown, path: IssuePath): ReferenceAt[] {
  if (!Array.isArray(options)) return [];
  return options.flatMap((option, i) =>
    isObject(option) && Array.isArray(option.items)
      ? option.items.flatMap((item, j) =>
          isObject(item) && typeof item.item === "string" ? [{ path: [...path, i, "items", j, "item"], reference: item.item, type: "equipment" as const }] : [],
        )
      : [],
  );
}

function referenceList(value: unknown, path: IssuePath, type: RecordType): ReferenceAt[] {
  if (typeof value === "string") return [{ path, reference: value, type }];
  if (Array.isArray(value)) return value.flatMap((item, i) => referenceList(item, [...path, i], type));
  if (isObject(value) && Array.isArray(value.from)) return referenceList(value.from, [...path, "from"], type);
  return [];
}

/** The references that a record holds, with the type that each must point to. */
export function referencesOf(type: RecordType, record: AnyRecord, path: IssuePath = []): ReferenceAt[] {
  const r = record as Record<string, unknown>;
  const found = [...referencesInEffects(r.effects, [...path, "effects"]), ...referencesInEffects(r.levels, [...path, "levels"])];
  if (type === "subclasses") found.push({ path: [...path, "class"], reference: String(r.class), type: "classes" });
  if (type === "spells") found.push(...referenceList(r.classes, [...path, "classes"], "classes"));
  if (type === "backgrounds") {
    found.push({ path: [...path, "feat"], reference: String(r.feat), type: "feats" });
    found.push(...referenceList(r.tool, [...path, "tool"], "equipment"));
  }
  if (type === "classes") found.push(...referenceList(r.tools, [...path, "tools"], "equipment"));
  found.push(...equipmentReferences(r.startingEquipment, [...path, "startingEquipment"]));
  return found.filter((ref) => isReference(ref.reference));
}

/**
 * Checks that each reference in the packs points to a record of the right
 * type in one of the packs. A reference to a pack that is not in the list
 * is reported too: load the packs that a pack refers to together.
 */
export function checkReferences(packs: readonly Pack[]): LoadIssue[] {
  const byPack = new Map(packs.map((pack) => [pack.pack.id, pack]));
  const issues: LoadIssue[] = [];
  for (const pack of packs) {
    for (const type of RECORD_TYPES) {
      pack[type].forEach((record, index) => {
        for (const ref of referencesOf(type, record, [type, index])) {
          const { pack: packId, key } = parseReference(ref.reference);
          const target = byPack.get(packId);
          if (!target) {
            issues.push({
              path: [pack.pack.id, ...ref.path],
              message: `"${ref.reference}" refers to the pack "${packId}", which is not loaded`,
              dropped: "none",
            });
            continue;
          }
          if ((target[ref.type] as AnyRecord[]).some((r) => r.key === key)) continue;
          const elsewhere = RECORD_TYPES.find((t) => (target[t] as AnyRecord[]).some((r) => r.key === key));
          issues.push({
            path: [pack.pack.id, ...ref.path],
            message: elsewhere
              ? `"${ref.reference}" is a record of ${elsewhere}, and this field needs a record of ${ref.type}`
              : `"${ref.reference}" is not a record of ${ref.type} in "${packId}"`,
            dropped: "none",
          });
        }
      });
    }
  }
  return issues;
}
