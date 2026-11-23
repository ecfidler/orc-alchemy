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
  key: "srd52:ability-score-improvement",
  selections: [{ key: "increase", option: { key: "one-and-one", selections: [{ key: "abilities", options: [{ key: "str" }, { key: "con" }] }] } }],
};

export function fighterCharacter(choices: Choices): Entity2024 {
  const {
    level,
    scores = { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
    backgroundAbilities = twoAndOne("str", "con"),
    fightingStyle = "srd52:defense",
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
      { key: "ability-scores", option: { key: "standard-array", value: scores } },
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
      { key: "species", option: { key: "srd52:dwarf" } },
      {
        key: "background",
        option: {
          key: "srd52:soldier",
          selections: [
            { key: "ability-scores", option: backgroundAbilities },
            { key: "tool", option: { key: "srd52:dice" } },
          ],
        },
      },
      { key: "languages", options: [{ key: "srd52:dwarvish" }, { key: "srd52:giant" }] },
      { key: "weapon-mastery", options: masteries.map((key) => ({ key })) },
      ...(armor ? [{ key: "armor", option: { key: armor } }] : []),
      { key: "weapons", options: weapons.map((key) => ({ key })) },
    ],
  };
}

/** The envelope of a test pack file, without records. */
export function testPackEnvelope(id = "test") {
  return { format: "alchemy-content", version: 1, rules: "2024", pack: { id, name: "Test" } } as const;
}

/** A pack file with the id `test` and the given records, for `loadContentPack`. */
export function testPackFile(records: Record<string, unknown[]>): unknown {
  return { ...testPackEnvelope(), ...records };
}

/** A class record with no features: a d8, Dexterity and Intelligence saves, and two skills of three. `more` adds or replaces fields. */
export function testClass(key: string, more: Record<string, unknown> = {}) {
  return {
    key,
    name: key[0].toUpperCase() + key.slice(1),
    hitDie: 8,
    savingThrows: ["dex", "int"],
    skills: { choose: 2, from: ["stealth", "perception", "arcana"] },
    ...more,
  };
}
