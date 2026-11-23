// Species (SRD 5.2.1 p84 to p86). The slice has the Dwarf.

import { type Option, option } from "../../core/template.ts";
import { type Built2024, feature, m } from "../built.ts";

export const SPECIES: readonly Option<Built2024>[] = [
  option({
    name: "Dwarf",
    modifiers: [
      m.set("species", "dwarf"),
      m.set("size", "medium"),
      m.set("speed", 30),
      m.set("darkvision", 120),
      m.push("resistances", "poison"),
      m.push(
        "features",
        feature(
          "dwarf",
          "Dwarven Resilience",
          "You have Resistance to Poison damage. You have Advantage on saving throws to avoid or end the Poisoned condition.",
        ),
      ),
      m.push("features", feature("dwarf", "Dwarven Toughness", "Your Hit Point maximum increases by 1, and by 1 again whenever you gain a level.")),
      // The trait follows the character level, not a class level.
      m.add("maxHitPoints", (q) => q("totalLevel"), { deps: ["totalLevel"], name: "Dwarven Toughness" }),
      m.push(
        "features",
        (q) =>
          feature(
            "dwarf",
            "Stonecunning",
            "As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes. You must be on or touching a stone surface.",
            {
              uses: { amount: q("proficiencyBonus"), recharge: "long-rest" },
            },
          ),
        { deps: ["proficiencyBonus"] },
      ),
    ],
  }),
];
