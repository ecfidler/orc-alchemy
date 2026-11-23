// Backgrounds (SRD 5.2.1 p83). The slice has the Soldier.

import { nameToKey, type Option, option, selection } from "../../core/template.ts";
import { backgroundAbilitySelection } from "../abilities.ts";
import { type Ability, type Built2024, m, type Skill } from "../built.ts";
import { grantFeat } from "./feats.ts";

interface Background {
  name: string;
  abilities: readonly [Ability, Ability, Ability];
  feat: string;
  skills: readonly [Skill, Skill];
  /** A fixed tool, or a choice of one from a list. */
  tool: string | { name: string; choices: readonly string[] };
}

function backgroundOption(background: Background): Option<Built2024> {
  const feat = grantFeat(background.feat);
  const tool = background.tool;
  return option({
    name: background.name,
    modifiers: [
      m.set("background", nameToKey(background.name)),
      ...background.skills.map((skill) => m.push("skillProficiencies", skill)),
      ...(typeof tool === "string" ? [m.push("toolProficiencies", tool)] : []),
      ...feat.modifiers,
    ],
    selections: [
      backgroundAbilitySelection(background.abilities, background.name),
      ...(typeof tool === "string"
        ? []
        : [selection({ name: tool.name, options: tool.choices.map((name) => option({ name, modifiers: [m.push("toolProficiencies", nameToKey(name))] })) })]),
      ...feat.selections,
    ],
  });
}

export const BACKGROUNDS: readonly Option<Built2024>[] = [
  backgroundOption({
    name: "Soldier",
    abilities: ["str", "dex", "con"],
    feat: "savage-attacker",
    skills: ["athletics", "intimidation"],
    // The kinds of Gaming Set (SRD 5.2.1 p94).
    tool: { name: "Gaming Set", choices: ["Dice", "Dragonchess", "Playing Cards", "Three-Dragon Ante"] },
  }),
];
