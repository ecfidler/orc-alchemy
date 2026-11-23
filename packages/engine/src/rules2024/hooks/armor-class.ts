// The hook `armor-class`: a feature gives another way to calculate the base
// Armor Class without armor, for example Unarmored Defense (SRD 5.2.1 p28,
// p50). A character uses one base calculation (p177). The engine takes the
// best formula that applies, in `armorClassFormula`, and only that formula
// gives `baseArmorClass`.

import { z } from "zod";
import { nameToKey } from "../../core/template.ts";
import { Ability } from "../../format/schema.ts";
import { type ArmorClassFormula, formulaValue, m } from "../built.ts";
import { defineHook } from "./hook.ts";

export const armorClassHook = defineHook({
  name: "armor-class",
  args: z.strictObject({
    /** The name in the contributions, for example "Unarmored Defense". */
    name: z.string().min(1),
    base: z.int(),
    /** The abilities whose modifiers the formula adds. */
    abilities: z.array(Ability).default([]),
    /** False when the formula does not apply with a Shield. */
    shield: z.boolean().default(true),
  }),
  apply: (args, call) => {
    const formula: ArmorClassFormula = { key: `${call.record}/${nameToKey(args.name)}`, ...args };
    return {
      modifiers: [
        m.push("armorClassFormulas", formula),
        m.add("baseArmorClass", (q) => formulaValue(formula, q("abilityModifiers")), {
          deps: ["abilityModifiers", "armorClassFormula"],
          when: (q) => q("armorClassFormula") === formula.key,
          name: args.name,
        }),
      ],
      selections: [],
    };
  },
});
