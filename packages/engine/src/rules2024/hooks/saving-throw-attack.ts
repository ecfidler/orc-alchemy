// The hook `saving-throw-attack`: an attack that forces a saving throw, with
// damage dice that increase at character levels, such as Breath Weapon
// (SRD 5.2.1 p84). The DC is 8 plus the modifier of `dcAbility` and the
// Proficiency Bonus.
//
// A value of the content format cannot be an object, so the attack entry of
// the sheet needs a hook.

import { z } from "zod";
import { nameToKey } from "../../core/template.ts";
import { Ability, ContentReference } from "../../format/schema.ts";
import { m } from "../built.ts";
import { defineHook } from "./hook.ts";

export const savingThrowAttackHook = defineHook({
  name: "saving-throw-attack",
  args: z.strictObject({
    name: z.string().min(1),
    save: Ability,
    dcAbility: Ability,
    die: z.int().min(2),
    /** [character level, number of dice]: the number of dice from each level. The first step is at level 1. */
    dice: z
      .array(z.tuple([z.int().min(1).max(20), z.int().min(1)]))
      .min(1)
      .refine((steps) => steps[0][0] === 1, "The first step is at level 1"),
    damageType: ContentReference,
  }),
  apply: ({ name, save, dcAbility, die, dice, damageType }, call) => ({
    modifiers: [
      m.push(
        "savingThrowAttacks",
        (q) => {
          const count = dice.filter(([level]) => level <= q("totalLevel")).at(-1)?.[1] ?? dice[0][1];
          return {
            key: `${call.record}/${nameToKey(name)}`,
            name,
            source: call.record,
            save,
            dc: 8 + q("abilityModifiers")[dcAbility] + q("proficiencyBonus"),
            damage: `${count}d${die}`,
            damageType,
          };
        },
        { deps: ["totalLevel", "abilityModifiers", "proficiencyBonus"] },
      ),
    ],
    selections: [],
  }),
});
