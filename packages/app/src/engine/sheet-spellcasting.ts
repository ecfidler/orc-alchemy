// The spellcasting of the sheet: the casters and the known spells, from the built character.
import type { Built2014, StrictEntity } from "@pubdoor/dmv";
import { unqualify } from "./content.ts";
import type { Ability, Spellcasting } from "./sheet.ts";
import { named } from "./sheet-text.ts";
import { preparedSpells, slotLayout, spentSlotGroups } from "./spells.ts";

export function toSpellcasting(built: Built2014, entity: StrictEntity): Spellcasting | null {
  const known = Object.entries(built["spells-known"] ?? {});
  if (known.length === 0) return null;
  const prepares = built["prepares-spells"] ?? {};
  const prepared = preparedSpells(entity);
  const { slots, pact } = spentSlotGroups(entity, slotLayout(built));
  return {
    slots,
    pact,
    casters: Object.values(built["spell-modifiers"] ?? {}).map((caster) => ({
      name: caster.class,
      ability: unqualify(caster.ability) as Ability,
      saveDc: caster["spell-save-dc"],
      attackBonus: caster["spell-attack-modifier"],
      prepares: prepares[caster.class] === true,
      canPrepare: prepares[caster.class] ? (built["prepare-spell-count"]?.[caster.class] ?? null) : null,
    })),
    byLevel: known
      .map(([level, spells]) => ({
        level: Number(level),
        spells: (spells?.__entries ?? [])
          .map(([[source, key], spell]) => {
            const caster = spell.class ?? source;
            // built marks a domain or oath spell always-prepared?, and the
            // old sheet shows it prepared.
            const preparer = Number(level) > 0 && prepares[caster] === true;
            const always = preparer && (spell as { "always-prepared?"?: boolean })["always-prepared?"] === true;
            return {
              ...named(key),
              source: caster,
              ability: unqualify(spell.ability) as Ability,
              alwaysPrepared: always,
              prepared: always || (preparer && (prepared[caster]?.has(key) ?? false)),
              castNote: castNoteOf(spell.qualifier),
            };
          })
          .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
      }))
      .sort((a, b) => a.level - b.level),
    knownModes: built["spells-known-modes"] ?? {},
  };
}

/** The qualifier of a cleric's domain spell (options.cljc cleric-spell). */
const DOMAIN_QUALIFIER = "Domain";

/** A known spell's qualifier as its cast note: null for none, for blank text and for the domain qualifier. */
const castNoteOf = (qualifier: string | null | undefined) => {
  const note = qualifier?.trim();
  return note && note !== DOMAIN_QUALIFIER ? note : null;
};
