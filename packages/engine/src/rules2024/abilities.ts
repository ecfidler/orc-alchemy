// Rules that several kinds of content share: the ability score increases of
// a background (+2 and +1, or +1 to three) and of a feat, and the rule that
// a feat is taken once. The record converter and the hooks use them.

import { type Option, option, type Prereq, type Selection, selection } from "../core/template.ts";
import { type Ability, type Built2024, m } from "./built.ts";
import { notAlready } from "./choices.ts";

export const ABILITY_NAMES: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** The cap of an ability score increase, except an Epic Boon (SRD 5.2.1 p21). */
export const ABILITY_CAP = 20;

/** One option for each ability. Choosing it increases the score, to at most `max`. */
export function abilityIncreaseOptions(
  abilities: readonly Ability[],
  amount: number,
  source: string,
  { max = ABILITY_CAP, prereq }: { max?: number; prereq?: (ability: Ability) => Prereq<Built2024> } = {},
): Option<Built2024>[] {
  return abilities.map((ability) =>
    option({
      key: ability,
      name: ABILITY_NAMES[ability],
      modifiers: [m.push("abilityIncreases", { ability, amount, max, source })],
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
          selection({ name: "Increase by 2", key: "plus-two", options: abilityIncreaseOptions(abilities, 2, source, { prereq: notTakenBy(1) }) }),
          selection({ name: "Increase by 1", key: "plus-one", options: abilityIncreaseOptions(abilities, 1, source, { prereq: notTakenBy(2) }) }),
        ],
      }),
      option({
        name: "+1 to all three",
        key: "three-ones",
        modifiers: abilities.map((ability) => m.push("abilityIncreases", { ability, amount: 1, max: ABILITY_CAP, source })),
      }),
    ],
  });
}

/**
 * The prerequisite of a feat that is not repeatable (SRD 5.2.1 p87). Once
 * the feat is chosen, the built character has it one time, and that is
 * still valid. Two times is a problem.
 */
export function notTakenAlready(featKey: string): Prereq<Built2024> {
  return notAlready("Not taken already", (built) => built.feats.map((f) => f.key), featKey);
}
