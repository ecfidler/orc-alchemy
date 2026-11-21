// The Spells step (ORC-60): the SRD spell records, which give the level
// filter its levels and the spell lookup its SRD records (ORC-280), and the
// prepared spells and the spent spell slots (ORC-282), read from and written
// to the strict entity. Only this file knows their Transit keys.
import { useEffect, useState } from "react";
import { asSet, setItems, tag, untag } from "./content.ts";
import type { Engine, StrictEntity } from "./engine.ts";
import type { SlotTotal } from "./sheet.ts";
import type { SpellRecord } from "./spell-records.ts";

const BY_CLASS = "~:orcpub.dnd.e5.character/prepared-spells-by-class";
const CLASS_NAME = "~:orcpub.dnd.e5.character/class-name";
const PREPARED = "~:orcpub.dnd.e5.character/prepared-spells";

/** The values map of a strict entity, from its object or its JSON text; {} without one. */
function strictValues(entity: StrictEntity): Record<string, unknown> {
  const strict = (typeof entity === "string" ? JSON.parse(entity) : entity) as { "~:orcpub.entity.strict/values"?: Record<string, unknown> };
  return strict["~:orcpub.entity.strict/values"] ?? {};
}

/** The SRD spells, as spell key to record. */
export type SpellContent = ReadonlyMap<string, SpellRecord>;

let loading: Promise<SpellContent> | undefined;
let loaded: SpellContent | undefined;

/**
 * Loads the SRD spells once, as their own chunk, as spell key to record. A
 * load that fails is not kept, so the next call tries again.
 */
export function loadSpellContent(): Promise<SpellContent> {
  loading ??= import("@pubdoor/dmv/content/spells.json").then(
    (mod) => (loaded = new Map((mod.default as SpellRecord[]).map((spell) => [spell.key, spell]))),
    (error) => {
      loading = undefined;
      throw error;
    },
  );
  return loading;
}

const NO_SPELLS: SpellContent = new Map();

/**
 * The SRD spells; null until they load. If the load fails, for example
 * offline or after a new deploy, it gives no SRD spells: the caller then
 * shows what it has without them, and the next mount tries the load again.
 */
export function useSpellContent(): SpellContent | null {
  const [content, setContent] = useState(loaded ?? null);
  useEffect(() => {
    if (content !== null) return;
    loadSpellContent().then(setContent, (error) => {
      console.error(error);
      setContent(NO_SPELLS);
    });
  }, [content]);
  return content;
}

/**
 * A spell's level: from the SRD content, or else from a "N - " prefix of
 * its option name, such as "1 - Alarm". A homebrew spell can have neither;
 * its level is then null.
 */
export function spellLevelOf(key: string, name: string, content: SpellContent | null): number | null {
  const level = content?.get(key)?.level;
  if (level !== undefined) return level;
  const prefix = /^(\d) - /.exec(name);
  return prefix ? Number(prefix[1]) : null;
}

/**
 * The entity's prepared-spells-by-class, as class name to spell keys. built
 * has it as null, so this reads the strict entity's verbose Transit-JSON:
 * [{ "~:…/class-name": "Wizard", "~:…/prepared-spells": { "~#set": ["~:alarm", …] } }].
 */
export function preparedSpells(entity: StrictEntity): Record<string, Set<string>> {
  const byClass = (strictValues(entity)[BY_CLASS] ?? []) as Record<string, unknown>[];
  return Object.fromEntries(
    byClass.map((entry) => {
      return [entry[CLASS_NAME] as string, new Set(setItems(entry[PREPARED]).map(untag))];
    }),
  );
}

/**
 * Prepares a class's spell, or stops preparing it. setValue cannot write the
 * stored list of records, but it takes a map of class name to a set and
 * stores that as the list. The value replaces the list, so this writes every
 * class.
 */
export function setPrepared(e: Engine, entity: StrictEntity, className: string, spellKey: string, prepared: boolean) {
  const byClass = preparedSpells(entity);
  const spells = (byClass[className] ??= new Set());
  if (prepared) spells.add(spellKey);
  else spells.delete(spellKey);
  const value = Object.fromEntries(Object.entries(byClass).map(([name, keys]) => [name, asSet([...keys].map(tag))]));
  return e.setValue(entity, "prepared-spells-by-class", value);
}

// Spent spell slots (ORC-282, docs/design/spells-panel.md "The record").
// The strict entity holds them as a map of a level key to a set of slot
// positions from 0: { "~:…/slots-1": { "~#set": [0, 2] } }. built has only
// the slot totals.

const SLOTS_USED = "orcpub.dnd.e5.spells/slots-used";
const slotLevelKey = (level: number) => tag(`orcpub.dnd.e5.spells/slots-${level}`);
const SLOT_LEVEL_KEY = /^~:orcpub\.dnd\.e5\.spells\/slots-(\d)$/;
/** The integer key of a synthetic record ("~i1"), as in fixtures/legacy/r3-slots-used-vectors. The old app does not read it. */
const INT_LEVEL_KEY = /^~i(\d)$/;

/**
 * The stored slot positions of each level, as level to positions. A level
 * value can be a set or, in a record from the old app, a vector (quirk R3).
 * A level key can also be an integer key; both forms of one level are
 * joined. The positions are as stored: they can have gaps, and can be past
 * the slot total.
 */
export function slotPositions(entity: StrictEntity): Map<number, Set<number>> {
  const used = strictValues(entity)[tag(SLOTS_USED)];
  const positions = new Map<number, Set<number>>();
  if (used === null || typeof used !== "object") return positions;
  for (const [key, value] of Object.entries(used)) {
    const level = SLOT_LEVEL_KEY.exec(key)?.[1] ?? INT_LEVEL_KEY.exec(key)?.[1];
    if (level === undefined) continue;
    const items = Array.isArray(value) ? value : setItems(value);
    const set = positions.get(Number(level)) ?? new Set();
    for (const item of items) if (Number.isInteger(item) && (item as number) >= 0) set.add(item as number);
    positions.set(Number(level), set);
  }
  return positions;
}

/**
 * The number of spent slots in the positions `from` to `to - 1` of a level:
 * the number of stored positions in that range. A position past it does
 * not count. For the slots of a level, `from` is 0 and `to` is the slot
 * total.
 */
export function spentSlots(positions: Map<number, Set<number>>, level: number, to: number, from = 0): number {
  let spent = 0;
  for (const position of positions.get(level) ?? []) if (position >= from && position < to) spent++;
  return spent;
}

/**
 * Writes the spent slots, as level to stored positions. The value replaces
 * the full map, so give each level. A level with no positions is left out;
 * with none at all the value is {}, which removes the key.
 */
function writeSlotPositions(e: Engine, entity: StrictEntity, positions: Map<number, number[]>) {
  const value = Object.fromEntries(
    [...positions]
      .filter(([, list]) => list.length > 0)
      .sort(([a], [b]) => a - b)
      .map(([level, list]) => [slotLevelKey(level), asSet([...list].sort((a, b) => a - b))]),
  );
  return e.setValue(entity, SLOTS_USED, value);
}

const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

/**
 * Sets the number of spent slots of one level. `totals` are the slot totals
 * of the levels (built's spell slots). Each level is written again as a
 * clean set, positions 0 to k - 1 for k spent slots, so a stored position
 * past the total, a gap, a vector or an integer key goes. `spent` is kept
 * between 0 and the total of its level.
 */
export function setSpentSlots(e: Engine, entity: StrictEntity, totals: SlotTotal[], level: number, spent: number) {
  const positions = slotPositions(entity);
  const written = new Map(
    totals.map(({ level: l, count }) => [l, range(0, l === level ? Math.max(0, Math.min(spent, count)) : spentSlots(positions, l, count))]),
  );
  return writeSlotPositions(e, entity, written);
}
