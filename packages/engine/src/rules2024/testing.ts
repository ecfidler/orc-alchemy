// Test characters that several test files share. Not part of the package
// exports.
//
// The Fighter of the spike: a Dwarf Soldier. Scores before increases, from
// the Standard Array: Str 15, Dex 13, Con 14, Int 8, Wis 12, Cha 10. The
// background gives Str +2 and Con +1.

import type { StrictOption, StrictSelection } from "../core/entity.ts";
import type { Entity2024 } from "./evaluate.ts";

export interface Choices {
  level: number;
  scores?: Record<string, number>;
  backgroundAbilities?: StrictOption;
  fightingStyle?: string;
  masteries?: string[];
  armor?: string | null;
  weapons?: string[];
  /** The value of each level option from level 2: a rolled Hit Point number. */
  rolledHitPoints?: Record<number, number>;
  level4Feat?: StrictOption;
}

export const twoAndOne = (plusTwo: string, plusOne: string): StrictOption => ({
  key: "two-and-one",
  selections: [
    { key: "plus-two", option: { key: plusTwo } },
    { key: "plus-one", option: { key: plusOne } },
  ],
});

const strAndCon: StrictOption = {
  key: "ability-score-improvement",
  selections: [{ key: "increase", option: { key: "one-and-one", selections: [{ key: "abilities", options: [{ key: "str" }, { key: "con" }] }] } }],
};

export function fighterCharacter(choices: Choices): Entity2024 {
  const {
    level,
    scores = { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    backgroundAbilities = twoAndOne("str", "con"),
    fightingStyle = "defense",
    masteries = level >= 4 ? ["greatsword", "longbow", "flail", "dagger"] : ["greatsword", "longbow", "flail"],
    armor = "chain-mail",
    weapons = ["greatsword", "longbow", "dagger"],
    rolledHitPoints = {},
    level4Feat = strAndCon,
  } = choices;

  const levelSelections: Record<number, StrictSelection[]> = {
    1: [{ key: "fighting-style", option: { key: fightingStyle } }],
    3: [{ key: "subclass", option: { key: "champion" } }],
    4: [{ key: "ability-score-improvement", option: level4Feat }],
  };
  const levels = Array.from({ length: level }, (_, i): StrictOption => {
    const n = i + 1;
    return {
      key: `level-${n}`,
      ...(rolledHitPoints[n] === undefined ? {} : { value: rolledHitPoints[n] }),
      ...(levelSelections[n] ? { selections: levelSelections[n] } : {}),
    };
  });

  return {
    values: { name: "Brunhild" },
    selections: [
      { key: "ability-scores", option: { key: "scores", value: scores } },
      {
        key: "class",
        options: [
          {
            key: "fighter",
            selections: [
              { key: "skill-proficiencies", options: [{ key: "perception" }, { key: "survival" }] },
              { key: "levels", options: levels },
            ],
          },
        ],
      },
      { key: "species", option: { key: "dwarf" } },
      {
        key: "background",
        option: {
          key: "soldier",
          selections: [
            { key: "ability-scores", option: backgroundAbilities },
            { key: "gaming-set", option: { key: "dice" } },
          ],
        },
      },
      { key: "languages", options: [{ key: "dwarvish" }, { key: "giant" }] },
      { key: "weapon-mastery", options: masteries.map((key) => ({ key })) },
      ...(armor ? [{ key: "armor", option: { key: armor } }] : []),
      { key: "weapons", options: weapons.map((key) => ({ key })) },
    ],
  };
}
