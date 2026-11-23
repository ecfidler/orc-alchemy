// Backgrounds (SRD 5.2.1 p83). The slice has the Soldier.

import { nameToKey, type Option, option, type Prereq, type Selection, selection } from "../../core/template.ts";
import { type Ability, type Built2024, m, type Skill } from "../built.ts";
import { abilityIncreaseOptions, grantFeat } from "./feats.ts";

interface Background {
  name: string;
  abilities: readonly [Ability, Ability, Ability];
  feat: string;
  skills: readonly [Skill, Skill];
  /** A fixed tool, or a choice of one from a list. */
  tool: string | { name: string; choices: readonly string[] };
}

/**
 * The ability score choice of a background: +2 to one listed ability and +1
 * to a different one, or +1 to all three (SRD 5.2.1 p83).
 */
function abilityScoreSelection(background: Background): Selection<Built2024> {
  const source = background.name;
  // The +2 and the +1 go to different abilities, so each excludes what the other took.
  const notTakenBy =
    (otherAmount: number) =>
    (ability: Ability): Prereq<Built2024> => ({
      label: "A different ability from the other increase",
      canChoose: (built) => !built.abilityIncreases.some((i) => i.source === source && i.amount === otherAmount && i.ability === ability),
    });
  return selection({
    name: "Ability Scores",
    options: [
      option({
        name: "+2 and +1",
        key: "two-and-one",
        selections: [
          selection({ name: "Increase by 2", key: "plus-two", options: abilityIncreaseOptions(background.abilities, 2, source, notTakenBy(1)) }),
          selection({ name: "Increase by 1", key: "plus-one", options: abilityIncreaseOptions(background.abilities, 1, source, notTakenBy(2)) }),
        ],
      }),
      option({
        name: "+1 to all three",
        key: "three-ones",
        modifiers: background.abilities.map((ability) => m.push("abilityIncreases", { ability, amount: 1, max: 20, source })),
      }),
    ],
  });
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
      abilityScoreSelection(background),
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
