// The prepare rule (ORC-287, docs/design/spells-panel.md "Preparing
// spells"): for a known spell, can the user change it, and for a class that
// prepares, what is its prepare count and the state of that count. The
// Spells panel and the Spells step of the builder (ORC-288) use it. It has
// no knowledge of React or of the panel.
import type { KnownSpell, SheetClass, Spellcaster, Spellcasting } from "./sheet.ts";
import { type SpellLookup, spellName } from "./spell-records.ts";

/**
 * How a known spell takes part in preparing:
 *
 * - `can-change`: a leveled spell of a class that prepares, not always
 *   prepared. The user prepares it, or stops preparing it.
 * - `always`: always prepared, for example a domain spell. It cannot
 *   change, and it is not in the count.
 * - `known`: a leveled spell of a source that does not prepare, for example
 *   a sorcerer or a race. It is always ready.
 * - `cantrip`: a spell of level 0. It is always ready.
 */
export type PrepareKind = "can-change" | "always" | "known" | "cantrip";

/** The spellcasters, with whether each prepares. */
type Casters = Pick<Spellcaster, "name" | "prepares">[];

/** The prepare kind of a known spell of spell level `level`. */
export function prepareKind(spell: Pick<KnownSpell, "source" | "alwaysPrepared"> & { level: number }, casters: Casters): PrepareKind {
  if (spell.level === 0) return "cantrip";
  const prepares = casters.some((caster) => caster.name === spell.source && caster.prepares);
  if (!prepares) return "known";
  return spell.alwaysPrepared ? "always" : "can-change";
}

/** True for a spell that has a box in prepare mode: a spell that the user can change, or an always-prepared spell. */
export const hasPrepareBox = (kind: PrepareKind): kind is "can-change" | "always" => kind === "can-change" || kind === "always";

/** A spell with a prepare box: its spell level, its prepare kind, and its display name. */
export type PrepareSpellRow = KnownSpell & { level: number; kind: "can-change" | "always" };

/**
 * The spells of the class `className` that have a prepare box, in the order
 * of `byLevel`: the leveled spells that the user can change, and the
 * always-prepared spells. With a lookup, the name is the name of the spell
 * record (spellName); with none, the name from the key.
 */
export function prepareSpells(spellcasting: Pick<Spellcasting, "casters" | "byLevel">, className: string, lookup?: SpellLookup | null): PrepareSpellRow[] {
  return spellcasting.byLevel.flatMap(({ level, spells }) =>
    spells.flatMap((spell): PrepareSpellRow[] => {
      if (spell.source !== className) return [];
      const kind = prepareKind({ ...spell, level }, spellcasting.casters);
      if (!hasPrepareBox(kind)) return [];
      return [{ ...spell, level, kind, name: lookup ? spellName(lookup, spell.key, spell.name) : spell.name }];
    }),
  );
}

/**
 * The state of a prepare count: under the limit, at it, over it, or
 * "no-limit" for a class with no known limit (`prepare-spell-count` has no
 * value, as for some homebrew classes).
 */
export type PrepareState = "under" | "at" | "over" | "no-limit";

/** The prepare count of one class that prepares. */
export interface PrepareCount {
  /** The class name, for example "Cleric": the `source` of its spells. */
  className: string;
  /** The prepared spells of the class that count: not the always-prepared spells, and not the cantrips. */
  prepared: number;
  /** The spells that the class can prepare; null when the limit is not known. */
  limit: number | null;
  state: PrepareState;
  /** The number of spells to remove to come back to the limit: 0 unless the state is "over". */
  remove: number;
}

/**
 * The prepare count of each class that prepares, in the order of `classes`:
 * the order in which the character took them, as in the class line of the
 * panel header. A caster that is not in `classes` comes last. A spell counts
 * when the user can change it and it is prepared.
 */
export function prepareCounts(spellcasting: Pick<Spellcasting, "casters" | "byLevel">, classes: Pick<SheetClass, "name">[] = []): PrepareCount[] {
  const { casters, byLevel } = spellcasting;
  const order = (name: string) => {
    const at = classes.findIndex((c) => c.name === name);
    return at === -1 ? classes.length : at;
  };
  return casters
    .filter((caster) => caster.prepares)
    .sort((a, b) => order(a.name) - order(b.name))
    .map((caster) => {
      const prepared = prepareSpells({ casters, byLevel }, caster.name).filter((spell) => spell.kind === "can-change" && spell.prepared).length;
      const limit = caster.canPrepare;
      const state: PrepareState = limit === null ? "no-limit" : prepared < limit ? "under" : prepared === limit ? "at" : "over";
      return { className: caster.name, prepared, limit, state, remove: limit === null ? 0 : Math.max(0, prepared - limit) };
    });
}

/**
 * The text of a prepare count: "5 of 8 prepared", "9 of 8 prepared. Remove 1
 * spell.", or "3 prepared" with no known limit. With `withClass`, the class
 * name is first: "Cleric: 8 of 8 prepared". A character with two classes
 * that prepare shows the class name.
 */
export function prepareCountText(count: PrepareCount, withClass: boolean): string {
  const name = withClass ? `${count.className}: ` : "";
  if (count.limit === null) return `${name}${count.prepared} prepared`;
  const text = `${name}${count.prepared} of ${count.limit} prepared`;
  if (count.remove === 0) return text;
  return `${text}. Remove ${count.remove} ${count.remove === 1 ? "spell" : "spells"}.`;
}
