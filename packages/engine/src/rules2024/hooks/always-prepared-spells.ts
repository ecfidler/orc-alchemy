// The hook `always-prepared-spells`: the spells of a trait, such as Elven
// Lineage (SRD 5.2.1 p84 to p86). Each spell comes at a character level and
// is always prepared. The player chooses the spellcasting ability of the
// trait when they choose the trait, so with more than one ability the hook
// opens that choice. A spell can have casts without a spell slot.
//
// A value of the content format cannot be an object, so the spell entry of
// the sheet needs a hook. ORC-229 adds the slots and the spell lists.

import { z } from "zod";
import type { OptionModifier } from "../../core/modifiers.ts";
import { option, selection } from "../../core/template.ts";
import { Ability, ContentReference, Recovery } from "../../format/schema.ts";
import { ABILITY_NAMES } from "../abilities.ts";
import { type Ability as AbilityKey, type Built2024, m } from "../built.ts";
import { defineHook } from "./hook.ts";

const Spell = z.strictObject({
  spell: ContentReference,
  /** The character level from which the trait gives the spell. */
  level: z.int().min(1).max(20).default(1),
  /** The casts without a spell slot: a number, or the Proficiency Bonus. */
  uses: z.strictObject({ amount: z.union([z.int().min(1), z.literal("proficiency-bonus")]), recover: z.array(Recovery).min(1) }).optional(),
});

export const alwaysPreparedSpellsHook = defineHook({
  name: "always-prepared-spells",
  args: z.strictObject({
    /** The abilities that the player can choose for the spells. One ability is no choice. */
    abilities: z.array(Ability).min(1),
    spells: z.array(Spell).min(1),
  }),
  apply: ({ abilities, spells }, call) => {
    const modifiers = (ability: AbilityKey): OptionModifier<Built2024>[] =>
      spells.map(({ spell, level, uses }) =>
        m.push(
          "spells",
          (q) => ({
            spell,
            source: call.record,
            ability,
            ...(uses ? { uses: { amount: uses.amount === "proficiency-bonus" ? q("proficiencyBonus") : uses.amount, recover: uses.recover } } : {}),
          }),
          { deps: ["totalLevel", "proficiencyBonus"], when: (q) => q("totalLevel") >= level },
        ),
      );
    if (abilities.length === 1) return { modifiers: modifiers(abilities[0]), selections: [] };
    return {
      modifiers: [],
      selections: [
        selection<Built2024>({
          name: "Spellcasting Ability",
          options: abilities.map((ability) => option<Built2024>({ key: ability, name: ABILITY_NAMES[ability], modifiers: modifiers(ability) })),
        }),
      ],
    };
  },
});
