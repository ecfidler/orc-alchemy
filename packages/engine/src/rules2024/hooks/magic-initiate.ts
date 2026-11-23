// The hook `magic-initiate`: two cantrips and one level 1 spell from one
// spell list, with a spellcasting ability (SRD 5.2.1 p87). The level 1 spell
// is always prepared, and the feat gives one cast of it without a slot each
// Long Rest. The spells of a list are the spell records whose `classes`
// name the class of the list.
//
// A background can fix the list with `featSpellList`. Otherwise the player
// chooses one of `lists`. The feat is repeatable with a different list each
// time, so a list that the feat already gives is not offered again.

import { z } from "zod";
import type { OptionModifier } from "../../core/modifiers.ts";
import { type OptionParts, option, type Prereq, selection } from "../../core/template.ts";
import { parseReference } from "../../format/keys.ts";
import { Ability, ContentReference } from "../../format/schema.ts";
import { ABILITY_NAMES } from "../abilities.ts";
import { type Ability as AbilityKey, type Built2024, m, type Uses } from "../built.ts";
import { type Content, findRecord, recordsOf } from "../content.ts";
import { defineHook } from "./hook.ts";

/** One cast without a spell slot, regained on a Long Rest. */
const ONE_FREE_CAST: Uses = { amount: 1, recover: [{ on: "long-rest", amount: "all" }] };

const args = z.strictObject({
  /** The class references whose spell lists the player can choose from. */
  lists: z.array(ContentReference).min(1),
  abilities: z.array(Ability).min(1).default(["int", "wis", "cha"]),
  cantrips: z.int().min(0).default(2),
  spells: z.int().min(0).default(1),
});
type Args = z.infer<typeof args>;

/** The choices of one spell list: the ability, the cantrips and the level 1 spells. */
function listParts(content: Content, record: string, list: string, { abilities, cantrips, spells }: Args): OptionParts<Built2024> {
  // The key of the ability of this feat and this list in `spellcastingAbilities`.
  const slot = `${record}/${parseReference(list).key}`;
  const grant = (spell: string, uses?: Uses): OptionModifier<Built2024> =>
    m.push("spells", (q) => ({ spell, source: record, list, ability: q("spellcastingAbilities")[slot], ...(uses ? { uses } : {}) }), {
      deps: ["spellcastingAbilities"],
      when: (q) => q("spellcastingAbilities")[slot] !== undefined,
    });
  const choice = (name: string, level: number, count: number, uses?: Uses) =>
    selection<Built2024>({
      name,
      min: count,
      max: count,
      options: recordsOf(content, "spells")
        .filter(({ record: spell }) => spell.level === level && spell.classes.includes(list))
        .map(({ reference, record: spell }) => option<Built2024>({ key: reference, name: spell.name, modifiers: [grant(reference, uses)] })),
    });
  const setAbility = (ability: AbilityKey) => m.put("spellcastingAbilities", slot, ability);
  return {
    modifiers: abilities.length === 1 ? [setAbility(abilities[0])] : [],
    selections: [
      ...(abilities.length === 1
        ? []
        : [
            selection<Built2024>({
              name: "Spellcasting Ability",
              options: abilities.map((ability) => option<Built2024>({ key: ability, name: ABILITY_NAMES[ability], modifiers: [setAbility(ability)] })),
            }),
          ]),
      ...(cantrips > 0 ? [choice("Cantrips", 0, cantrips)] : []),
      ...(spells > 0 ? [choice("Level 1 Spell", 1, spells, ONE_FREE_CAST)] : []),
    ],
  };
}

/**
 * The list is not one that this feat gives already: a second Magic
 * Initiate takes another list (SRD 5.2.1 p87). The choice stays valid while
 * the spells of the list are only the ones of this choice, `count` or less.
 */
function differentList(record: string, list: string, count: number): Prereq<Built2024> {
  const fromList = (built: Built2024) => built.spells.filter((s) => s.source === record && s.list === list).length;
  return {
    label: "A spell list that this feat does not give already",
    canChoose: (built) => fromList(built) === 0,
    stillValid: (built) => fromList(built) <= count,
  };
}

export const magicInitiateHook = defineHook({
  name: "magic-initiate",
  args,
  apply: (parsed, call) => {
    if (call.featSpellList) return listParts(call.content, call.record, call.featSpellList, parsed);
    return {
      modifiers: [],
      selections: [
        selection<Built2024>({
          name: "Spell List",
          options: parsed.lists.map((list) =>
            option<Built2024>({
              key: list,
              name: findRecord(call.content, "classes", list)?.name ?? list,
              ...listParts(call.content, call.record, list, parsed),
              prereqs: [differentList(call.record, list, parsed.cantrips + parsed.spells)],
            }),
          ),
        }),
      ],
    };
  },
});
