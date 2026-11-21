// The Spells step (ORC-60): the SRD spell records, which give the level
// filter its levels and the spell lookup its SRD records (ORC-280), and the
// prepared spells and the spent spell slots (ORC-282), with the Pact Magic
// slots apart (ORC-283), read from and written to the strict entity. Only
// this file knows their Transit keys.
import { useEffect, useState } from "react";
import { asSet, setItems, tag, untag } from "./content.ts";
import type { Built2014, Engine, StrictEntity } from "./engine.ts";
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
//
// Pact Magic slots (ORC-283) are in the same totals, and in the same set as
// the other slots of their level: for a level with n other slots and p pact
// slots, the positions 0 to n - 1 are the other slots, and n to n + p - 1
// the pact slots. Only slotRanges knows these positions.

/** The number of slots of one spell level. */
export interface SlotTotal {
  level: number;
  count: number;
}

/** The Pact Magic slots: their number and their slot level. */
export interface PactSlots {
  slotLevel: number;
  count: number;
}

/**
 * The slots of a character, in their groups: the other slots of each level,
 * and the pact slots apart. A level whose slots are all pact slots is not in
 * `slots`.
 */
export interface SlotLayout {
  slots: SlotTotal[];
  pact: PactSlots | null;
}

/** A group of slots: the other slots of a spell level, or the pact slots. */
export type SlotGroup = number | "pact";

/**
 * The Pact Magic slots of each warlock level, 1 to 20, as [count, slot level]
 * (the table of the spec, "Pact Magic slots"). The engine has the same table
 * (warlock-spell-slot-schedule) and does not export it.
 */
const PACT_SLOTS: readonly (readonly [count: number, slotLevel: number])[] = [
  [1, 1],
  [2, 1],
  [2, 2],
  [2, 2],
  [2, 3],
  [2, 3],
  [2, 4],
  [2, 4],
  [2, 5],
  [2, 5],
  [3, 5],
  [3, 5],
  [3, 5],
  [3, 5],
  [3, 5],
  [3, 5],
  [4, 5],
  [4, 5],
  [4, 5],
  [4, 5],
];

/** The pact slots of a warlock level from 1 to 20; null for another level. */
export function pactSlotsAt(warlockLevel: number): PactSlots | null {
  const row = PACT_SLOTS[warlockLevel - 1];
  return row ? { count: row[0], slotLevel: row[1] } : null;
}

/**
 * The pact slots of a built character: null without Pact Magic. The engine
 * adds them to the slot total of their level from the level of the class
 * `warlock`, so this reads that level too.
 */
export function pactSlots(built: Pick<Built2014, "pact-magic?" | "levels">): PactSlots | null {
  if (built["pact-magic?"] !== true) return null;
  return pactSlotsAt(built.levels.warlock?.["class-level"] ?? 0);
}

/**
 * The slot groups of a built character. The other slots of the pact slot
 * level are the engine total less the pact slots, never below 0.
 */
export function slotLayout(built: Pick<Built2014, "pact-magic?" | "levels" | "spell-slots">): SlotLayout {
  const pact = pactSlots(built);
  const slots = Object.entries(built["spell-slots"] ?? {})
    .map(([level, total]) => {
      const pactCount = pact?.slotLevel === Number(level) ? pact.count : 0;
      return { level: Number(level), count: Math.max(0, total - pactCount) };
    })
    .filter(({ count }) => count > 0)
    .sort((a, b) => a.level - b.level);
  return { slots, pact };
}

/** The positions of one slot group in the stored set of its level: `from` to `from + count - 1`. */
interface SlotRange {
  group: SlotGroup;
  level: number;
  from: number;
  count: number;
}

/** The positions of each slot group. The pact slots come after the other slots of their level. */
function slotRanges({ slots, pact }: SlotLayout): SlotRange[] {
  const ranges: SlotRange[] = slots.map(({ level, count }) => ({ group: level, level, from: 0, count }));
  if (pact) {
    const others = slots.find(({ level }) => level === pact.slotLevel)?.count ?? 0;
    ranges.push({ group: "pact", level: pact.slotLevel, from: others, count: pact.count });
  }
  return ranges;
}

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
 * not count. For the slots of a level with no pact slots, `from` is 0 and
 * `to` is the slot total; slotGroups reads each group.
 */
export function spentSlots(positions: Map<number, Set<number>>, level: number, to: number, from = 0): number {
  let spent = 0;
  for (const position of positions.get(level) ?? []) if (position >= from && position < to) spent++;
  return spent;
}

/** The slot groups with their spent slots: never more than the slots of the group. */
export interface SpentSlotGroups {
  slots: (SlotTotal & { spent: number })[];
  pact: (PactSlots & { spent: number }) | null;
}

/** The slot groups with their spent slots, read from the strict entity. */
export function slotGroups(entity: StrictEntity, layout: SlotLayout): SpentSlotGroups {
  const positions = slotPositions(entity);
  const spent = new Map(slotRanges(layout).map(({ group, level, from, count }) => [group, spentSlots(positions, level, from + count, from)]));
  return {
    slots: layout.slots.map((slot) => ({ ...slot, spent: spent.get(slot.level) ?? 0 })),
    pact: layout.pact && { ...layout.pact, spent: spent.get("pact") ?? 0 },
  };
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
 * Sets the number of spent slots of one group: the other slots of a level,
 * or the pact slots. `layout` gives the groups (see slotLayout). Each group
 * is written again as a clean range from its first position: for k spent
 * other slots and j spent pact slots of a level with n other slots, the
 * positions 0 to k - 1 and n to n + j - 1. Thus a stored position past the
 * slots, a gap, a vector or an integer key goes. `spent` is kept between 0
 * and the slots of its group.
 */
export function setSpentSlots(e: Engine, entity: StrictEntity, layout: SlotLayout, group: SlotGroup, spent: number) {
  const positions = slotPositions(entity);
  const written = new Map<number, number[]>();
  for (const { group: g, level, from, count } of slotRanges(layout)) {
    const k = g === group ? Math.max(0, Math.min(spent, count)) : spentSlots(positions, level, from + count, from);
    written.set(level, [...(written.get(level) ?? []), ...range(from, k)]);
  }
  return writeSlotPositions(e, entity, written);
}
