// Test characters that several test files share. Not part of the package
// exports.
//
// The test Fighter: a Dwarf Soldier Fighter, Champion from level 3. Scores before increases, from
// the Standard Array: Str 15, Dex 13, Con 14, Int 8, Wis 12, Cha 10. The
// background gives Str +2 and Con +1.

import type { StrictOption, StrictSelection } from "../core/entity.ts";
import type { Built2024 } from "./built.ts";
import { type Entity2024, evaluate } from "./evaluate.ts";

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

/** The value of a column of a class table at `level`: the last step at or below it, or undefined before the first step. */
export const stepAt = (level: number, table: [number, number][]) => table.filter(([from]) => level >= from).at(-1)?.[1];

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
    masteries = level >= 4 ? ["srd52:greatsword", "srd52:longbow", "srd52:flail", "srd52:dagger"] : ["srd52:greatsword", "srd52:longbow", "srd52:flail"],
    armor = "srd52:chain-mail",
    weapons = ["srd52:greatsword", "srd52:longbow", "srd52:dagger"],
    rolledHitPoints = {},
    level4Feat = strAndCon,
  } = choices;

  const levelSelections: Record<number, StrictSelection[]> = {
    1: [{ key: "fighting-style", option: { key: fightingStyle } }],
    3: [{ key: "subclass", option: { key: "srd52:champion" } }],
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
            key: "srd52:fighter",
            selections: [
              { key: "skill-proficiencies", options: [{ key: "perception" }, { key: "survival" }] },
              // The 155 GP.
              { key: "starting-equipment", option: { key: "c" } },
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
            // The 50 GP: option A gives other weapons than the ones of these tests.
            { key: "starting-equipment", option: { key: "b" } },
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

/** The test Fighter, evaluated with the 2024 rules. */
export const buildFighter = (choices: Choices) => evaluate(fighterCharacter(choices), { rules: "2024" });

/** The attack line of a weapon, by the `weapon` of the line. */
export const weaponAttackOf = (built: Built2024, weapon: string) => built.weaponAttacks.find((a) => a.weapon === weapon);

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
