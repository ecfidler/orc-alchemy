// The spells that the sheet and the Spells panel show (ORC-285,
// docs/design/spells-panel.md "The list"): which known spells show, the name
// to show, and the order A to Z in each level. The Spellcasting section of the
// sheet and the list of the panel use this one rule.
//
// The "Add spells" popup of the Spells step of the builder (ORC-357,
// docs/design/character-builder.md "The Spells and Equipment steps") shows the
// options of one spell selection in the same list: optionSpellGroups.
import type { BuilderSelection } from "./builder.ts";
import type { Ability, KnownSpell, Sheet, Spellcasting } from "./sheet.ts";
import { ordinal } from "./sheet-text.ts";
import { prepareKind } from "./spell-prepare.ts";
import { type SpellLookup, spellName } from "./spell-records.ts";
import { slotEntries } from "./spell-slots.ts";
import { splitLevelPrefix } from "./spells.ts";

/** A known spell as the sheet and the panel show it: `name` is the name to show, and `level` is its spell level. */
export interface ListedSpell extends KnownSpell {
  level: number;
}

/** What a row of the list of spells needs: a known spell of the sheet, or a spell option of the builder. */
export type ListSpell = Pick<ListedSpell, "key" | "source" | "name" | "castNote" | "level">;

/** The spells of one spell level that show. Level 0 is the cantrips. */
export interface SpellGroup<S extends ListSpell = ListedSpell> {
  level: number;
  spells: S[];
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
 * With `unprepared` (prepare mode of the Spells panel, ORC-287), the groups
 * also have the spells that a class that prepares can prepare and has not
 * prepared. The order stays A to Z.
 *
 * A spell that two sources give is two entries. Each spell has the name of
 * its record, or the name from its key when it has no record or the lookup
 * is null (the spell chunk is not loaded). In a group the spells are A to Z
 * by that name. A level with slots (or the pact slots) and no spell that
 * shows has a group with no spells. A level with no slots and no spell has
 * no group.
 */
export function spellGroups(
  spellcasting: Pick<Spellcasting, "casters" | "byLevel" | "slots" | "pact">,
  lookup: SpellLookup | null,
  { unprepared = false }: { unprepared?: boolean } = {},
): SpellGroup[] {
  const { casters, byLevel, slots, pact } = spellcasting;
  const shown = new Map(
    byLevel.map(({ level, spells }) => [
      level,
      spells
        .filter((spell) => unprepared || prepareKind({ ...spell, level }, casters) !== "can-change" || spell.prepared)
        .map((spell): ListedSpell => ({ ...spell, level, name: lookup ? spellName(lookup, spell.key, spell.name) : spell.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    ]),
  );
  // A level with slots: the same rule as the slot groups that show.
  const levels = new Set(slotEntries({ slots, pact }).map((entry) => entry.level));
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
export function searchSpellGroups<S extends ListSpell>(groups: SpellGroup<S>[], text: string): SpellGroup<S>[] {
  const query = text.trim().toLocaleLowerCase();
  if (query === "") return groups;
  return groups
    .map((group) => ({ ...group, spells: group.spells.filter((spell) => spell.name.toLocaleLowerCase().includes(query)) }))
    .filter((group) => group.spells.length > 0);
}

/** A spell option of a builder selection as a row of the list: `selected` is true when the character has the pick. */
export interface OptionSpell extends ListSpell {
  selected: boolean;
}

/**
 * True when the options of a builder selection are spells (ORC-357): each
 * option has a spell record. Such a selection on the Spells step has the
 * "Add spells" popup. Another selection there, for example Eldritch
 * Invocations, has the control of its kind (SelectionControl). A selection
 * with no options is not a spell selection.
 */
export const isSpellSelection = (selection: Pick<BuilderSelection, "options">, lookup: SpellLookup) =>
  selection.options.length > 0 && selection.options.every((option) => lookup(option.key) !== undefined);

/**
 * The options of a spell selection of the builder (ORC-357), in one group for
 * each level, cantrips first, A to Z by name in a group. The source of each
 * spell is the selection name, so `spellId` tells the rows apart. The level
 * comes from the "N - " prefix of the option name, which the engine gives a
 * spell of a class list, or else from the record of the spell (`lookup`), or
 * else it is 0. The name is the name of the record, or else the option name
 * without its prefix. A level with no option has no group.
 */
export function optionSpellGroups(selection: Pick<BuilderSelection, "name" | "options">, lookup: SpellLookup | null): SpellGroup<OptionSpell>[] {
  const byLevel = new Map<number, OptionSpell[]>();
  for (const option of selection.options) {
    const record = lookup?.(option.key)?.record;
    const prefix = splitLevelPrefix(option.name);
    const level = prefix.level ?? record?.level ?? 0;
    const spell = { key: option.key, source: selection.name, name: record?.name ?? prefix.name, castNote: null, level, selected: option.selected };
    const spells = byLevel.get(level);
    if (spells) spells.push(spell);
    else byLevel.set(level, [spell]);
  }
  return [...byLevel].sort(([a], [b]) => a - b).map(([level, spells]) => ({ level, spells: spells.sort((a, b) => a.name.localeCompare(b.name)) }));
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

/** The numbers of one source for the header of the Spells panel. A source with no caster has no save DC and no attack bonus. */
export interface SourceNumbers {
  /** The source name, for example "Cleric" or "High Elf": the `source` of its spells. */
  name: string;
  saveDc: number | null;
  attackBonus: number | null;
  ability: Ability;
}

/**
 * The numbers of each source (ORC-289): the classes in the order the
 * character took them, as in the class line, then each other source, for
 * example a race or a feat, in the order of `spellSources`. The numbers come
 * from the caster of the source. A source with no caster takes the ability
 * of its first spell, and has no save DC and no attack bonus.
 */
export function sourceNumbers(classes: Sheet["classes"], spellcasting: Pick<Spellcasting, "casters" | "byLevel">): SourceNumbers[] {
  const sources = spellSources(spellcasting);
  const classIndex = (source: string) => {
    const i = classes.findIndex((c) => c.name === source);
    return i < 0 ? classes.length : i;
  };
  // Array.prototype.sort is stable: the sources that are not classes keep their order.
  return [...sources]
    .sort((a, b) => classIndex(a) - classIndex(b))
    .map((name) => {
      const caster = spellcasting.casters.find((c) => c.name === name);
      if (caster) return { name, saveDc: caster.saveDc, attackBonus: caster.attackBonus, ability: caster.ability };
      const spell = spellcasting.byLevel.flatMap((row) => row.spells).find((s) => s.source === name);
      return { name, saveDc: null, attackBonus: null, ability: spell!.ability };
    });
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
