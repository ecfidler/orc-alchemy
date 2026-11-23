// The hook `ability-score-increase`: a feat increases one or more ability
// scores, up to a cap (SRD 5.2.1 p87 to p88). An increase is an object on
// the sheet, so a value of the content format cannot hold it. The cap is 20,
// and 30 for an Epic Boon. The Ability Score Improvement feat is a
// `selection` of two options that call this hook: +2 to one ability, or +1
// to two.

import { z } from "zod";
import { selection } from "../../core/template.ts";
import { ABILITY_KEYS, Ability } from "../../format/schema.ts";
import { ABILITY_CAP, abilityIncreaseOptions } from "../abilities.ts";
import { type Built2024, m } from "../built.ts";
import { defineHook } from "./hook.ts";

export const abilityScoreIncreaseHook = defineHook({
  name: "ability-score-increase",
  args: z
    .strictObject({
      /** The abilities that can increase. Default: all six. */
      abilities: z
        .array(Ability)
        .min(1)
        .default([...ABILITY_KEYS]),
      amount: z.int().min(1).default(1),
      /** How many different abilities of the list increase. */
      choose: z.int().min(1).default(1),
      max: z.int().min(1).max(30).default(ABILITY_CAP),
    })
    .refine((args) => args.choose <= new Set(args.abilities).size, "choose is more than the number of abilities"),
  apply: ({ abilities, amount, choose, max }, call) => {
    // No choice when every ability of the list increases.
    if (choose === abilities.length) {
      return { modifiers: abilities.map((ability) => m.push("abilityIncreases", { ability, amount, max, source: call.record })), selections: [] };
    }
    return {
      modifiers: [],
      selections: [
        selection<Built2024>({
          name: choose === 1 ? "Ability" : "Abilities",
          min: choose,
          max: choose,
          options: abilityIncreaseOptions(abilities, amount, call.record, { max }),
        }),
      ],
    };
  },
});
