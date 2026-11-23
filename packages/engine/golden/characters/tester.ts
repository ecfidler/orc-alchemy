// The small character that proves the harness: the level 1 character of
// ORC-225 on a test class with no features, as a Dwarf Soldier. The Dwarf
// and the Soldier ask no choice that changes a value below, other than the
// background's ability increases (SRD 5.2.1 p83, p84).

import { testClass, testPackFile } from "../../src/rules2024/testing.ts";
import { defineGolden } from "../define.ts";

export const tester = defineGolden({
  name: "Tester (test class)",
  // A d8 class with Dexterity and Intelligence saves and two of three skills, Light armor and Simple weapons.
  packs: [testPackFile({ classes: [testClass("tester", { weaponProficiencies: ["simple"], armorTraining: ["light"] })] })],
  checks: [
    {
      level: 1,
      entity: {
        selections: [
          // Standard Array (p21): Str 8, Dex 15, Con 14, Int 13, Wis 12, Cha 10.
          { key: "ability-scores", option: { key: "standard-array", value: { str: 8, dex: 15, con: 14, int: 13, wis: 12, cha: 10 } } },
          {
            key: "class",
            options: [
              {
                key: "test:tester",
                selections: [
                  { key: "skill-proficiencies", options: [{ key: "stealth" }, { key: "perception" }] },
                  { key: "levels", options: [{ key: "level-1" }] },
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
                {
                  key: "ability-scores",
                  option: {
                    key: "two-and-one",
                    selections: [
                      { key: "plus-two", option: { key: "dex" } },
                      { key: "plus-one", option: { key: "con" } },
                    ],
                  },
                },
                { key: "tool", option: { key: "srd52:dice" } },
                { key: "starting-equipment", option: { key: "b" } },
              ],
            },
          },
          { key: "languages", options: [{ key: "srd52:draconic" }, { key: "srd52:elvish" }] },
        ],
      },
      expected: {
        // The Standard Array, then the Soldier: Dex 15 + 2 = 17, Con 14 + 1 = 15 (p21, p83).
        abilities: { str: 8, dex: 17, con: 15, int: 13, wis: 12, cha: 10 },
        // Modifier = (score - 10) / 2, rounded down (p6): 8 -> -1, 17 -> +3, 15 -> +2, 13 -> +1, 12 -> +1, 10 -> 0.
        abilityModifiers: { str: -1, dex: 3, con: 2, int: 1, wis: 1, cha: 0 },
        // Character Advancement table, level 1 (p23).
        proficiencyBonus: 2,
        // Level 1: the full Hit Point Die 8 + Con +2 = 10 (p22), + Dwarven Toughness 1 = 11 (p84).
        maxHitPoints: 11,
        // Saves: the modifier, + PB 2 for Dex and Int, the saves of the test class (p22): Dex 3 + 2 = 5, Int 1 + 2 = 3.
        saveBonuses: { str: -1, dex: 5, con: 2, int: 3, wis: 1, cha: 0 },
        // Passive Perception = 10 + Wisdom (Perception) = 10 + (Wis 1 + PB 2) = 13 (p22).
        passivePerception: 13,
        // No armor: 10 + Dex 3 = 13 (p22).
        armorClass: 13,
        // Initiative: the Dexterity modifier (p22).
        initiative: 3,
        // Carrying Capacity: Str 8 x 15 for a Medium creature = 120 pounds (p178).
        carryingCapacity: 120,
        // Every character knows Common and two Standard Languages (p20).
        languages: ["srd52:common", "srd52:draconic", "srd52:elvish"],
      },
    },
  ],
});
