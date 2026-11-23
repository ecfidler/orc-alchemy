// Rules for ability score increases that several kinds of content share: a
// background's +2 and +1 (or +1 to three), a feat's increase. The spike
// content and the record converter both use them.

import { type Option, option, type Prereq, type Selection, selection } from "../core/template.ts";
import { type Ability, type Built2024, m } from "./built.ts";

export const ABILITY_NAMES: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** One option for each ability. Choosing it increases the score, to at most 20. */
export function abilityIncreaseOptions(
  abilities: readonly Ability[],
  amount: number,
  source: string,
  prereq?: (ability: Ability) => Prereq<Built2024>,
): Option<Built2024>[] {
  return abilities.map((ability) =>
    option({
      key: ability,
      name: ABILITY_NAMES[ability],
      modifiers: [m.push("abilityIncreases", { ability, amount, max: 20, source })],
      prereqs: prereq ? [prereq(ability)] : [],
    }),
  );
}

/**
 * The ability score choice of a background: +2 to one listed ability and +1
 * to a different one, or +1 to all three (SRD 5.2.1 p83). `source` names
 * the background in the increases.
 */
export function backgroundAbilitySelection(abilities: readonly [Ability, Ability, Ability], source: string): Selection<Built2024> {
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
          selection({ name: "Increase by 2", key: "plus-two", options: abilityIncreaseOptions(abilities, 2, source, notTakenBy(1)) }),
          selection({ name: "Increase by 1", key: "plus-one", options: abilityIncreaseOptions(abilities, 1, source, notTakenBy(2)) }),
        ],
      }),
      option({
        name: "+1 to all three",
        key: "three-ones",
        modifiers: abilities.map((ability) => m.push("abilityIncreases", { ability, amount: 1, max: 20, source })),
      }),
    ],
  });
}
