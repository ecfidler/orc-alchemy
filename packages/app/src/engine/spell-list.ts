// The spells that the sheet and the Spells panel show (ORC-285,
// docs/design/spells-panel.md "The list"): which known spells show, the name
// to show, and the order A to Z in each level. The Spellcasting section of the
// sheet and the list of the panel use this one rule.
import { type KnownSpell, ordinal, type Sheet, type Spellcasting } from "./sheet.ts";
import { type SpellLookup, spellName } from "./spell-records.ts";
import type { SlotGroup } from "./spells.ts";

/** A known spell as the sheet and the panel show it: `name` is the name to show, and `level` is its spell level. */
export interface ListedSpell extends KnownSpell {
  level: number;
}

/** The spells of one spell level that show. Level 0 is the cantrips. */
export interface SpellGroup {
  level: number;
  spells: ListedSpell[];
}

/**
 * The spells that the character can cast now, in one group for each level,
 * cantrips first:
 *
 * - the cantrips;
 * - the prepared spells of each class that prepares, the always-prepared
 *   spells included;
 * - all known spells of each other source.
 *
 * A spell that two sources give is two entries. Each spell has the name of
 * its record, or the name from its key when it has no record or the lookup
 * is null (the spell chunk is not loaded). In a group the spells are A to Z
 * by that name. A level with slots (or the pact slots) and no spell that
 * shows has a group with no spells. A level with no slots and no spell has
 * no group.
 */
export function spellGroups(spellcasting: Pick<Spellcasting, "casters" | "byLevel" | "slots" | "pact">, lookup: SpellLookup | null): SpellGroup[] {
  const { casters, byLevel, slots, pact } = spellcasting;
  const prepares = new Map(casters.map((caster) => [caster.name, caster.prepares]));
  const shown = new Map(
    byLevel.map(({ level, spells }) => [
      level,
      spells
        .filter((spell) => level === 0 || spell.prepared || !prepares.get(spell.source))
        .map((spell): ListedSpell => ({ ...spell, level, name: lookup ? spellName(lookup, spell.key, spell.name) : spell.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ]),
  );
  const levels = new Set([...slots.filter((slot) => slot.count > 0).map((slot) => slot.level), ...(pact ? [pact.slotLevel] : [])]);
  for (const [level, spells] of shown) if (spells.length > 0) levels.add(level);
  return [...levels].sort((a, b) => a - b).map((level) => ({ level, spells: shown.get(level) ?? [] }));
}

/** The identity of a listed spell: its source and its key, because a spell that two sources give is two entries. */
export const spellId = (spell: Pick<KnownSpell, "source" | "key">) => `${spell.source}/${spell.key}`;

/** The heading of a level in the list of the panel: "Cantrips", or "1st level". */
export const levelHeading = (level: number) => (level === 0 ? "Cantrips" : `${ordinal(level)} level`);

/**
 * The groups with only the spells whose shown name has the search text, in
 * any case. Text with only spaces matches all. A group with no spell that
 * matches is not in the result, also a group with no spells.
 */
export function searchSpellGroups(groups: SpellGroup[], text: string): SpellGroup[] {
  const query = text.trim().toLocaleLowerCase();
  if (query === "") return groups;
  return groups
    .map((group) => ({ ...group, spells: group.spells.filter((spell) => spell.name.toLocaleLowerCase().includes(query)) }))
    .filter((group) => group.spells.length > 0);
}

/**
 * The sources of the spells: the casters, then each other source of a known
 * spell, in that order, each one time. A source is a class, race or feat
 * that gives the character spells.
 */
export function spellSources(spellcasting: Pick<Spellcasting, "casters" | "byLevel">): string[] {
  const { casters, byLevel } = spellcasting;
  return [...new Set([...casters.map((caster) => caster.name), ...byLevel.flatMap((row) => row.spells.map((spell) => spell.source))])];
}

/**
 * The class and level of each class that gives spells, in the order the
 * character took them: "Cleric 9", or "Cleric 5 / Warlock 3". A class gives
 * spells when it is a caster or the source of a known spell. "" when no
 * class gives spells, for example when only a race does.
 */
export function spellClassLine(classes: Sheet["classes"], spellcasting: Pick<Spellcasting, "casters" | "byLevel">): string {
  const sources = new Set(spellSources(spellcasting));
  return classes
    .filter((c) => sources.has(c.name))
    .map((c) => `${c.name} ${c.level}`)
    .join(" / ");
}

// The slot groups that the sheet and the Spells panel show (ORC-282, ORC-283,
// ORC-286; docs/design/spells-panel.md "Spent spell slots"). The sheet, the
// Spell slots block and the level headings of the panel take the groups, their
// names and their state from here.

/** A group of slots as the sheet and the panel show it: the other slots of a level, or the pact slots. */
export interface ShownSlots {
  /** The group that a change sets (see `setSpentSlots`). */
  group: SlotGroup;
  /** The spell level of the slots. */
  level: number;
  /** The name that a screen reader gives the group: "1st-level slots", or "Pact slots, 5th level". */
  label: string;
  count: number;
  spent: number;
}

/** The other slots of a level, as a shown group; null when the level has none. */
export function levelSlots(spellcasting: Pick<Spellcasting, "slots">, level: number): ShownSlots | null {
  const slot = spellcasting.slots.find((s) => s.level === level);
  return slot && slot.count > 0 ? { group: level, level, label: `${ordinal(level)}-level slots`, count: slot.count, spent: slot.spent } : null;
}

/** The pact slots, as a shown group; null without Pact Magic. */
export function pactSlotGroup(spellcasting: Pick<Spellcasting, "pact">): ShownSlots | null {
  const { pact } = spellcasting;
  return pact && pact.count > 0
    ? { group: "pact", level: pact.slotLevel, label: `Pact slots, ${ordinal(pact.slotLevel)} level`, count: pact.count, spent: pact.spent }
    : null;
}

/** The slot groups of a level: its other slots, then the pact slots when it is the pact slot level. */
export function slotGroupsOf(spellcasting: Pick<Spellcasting, "slots" | "pact">, level: number): ShownSlots[] {
  const pact = pactSlotGroup(spellcasting);
  return [levelSlots(spellcasting, level), pact?.level === level ? pact : null].filter((group) => group !== null);
}

/** The state of a slot group for a screen reader: "2 of 4 spent". */
export const spentText = (spent: number, count: number) => `${spent} of ${count} spent`;

/**
 * True when the Spell slots block of the panel shows one column for each
 * level: the character has slots of the 5th level or higher, the pact slots
 * included. Else it shows one row for each level.
 */
export function slotColumns(spellcasting: Pick<Spellcasting, "slots" | "pact">): boolean {
  const pact = pactSlotGroup(spellcasting);
  return spellcasting.slots.some((slot) => slot.count > 0 && slot.level >= 5) || (pact !== null && pact.level >= 5);
}
