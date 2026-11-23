// The small character that proves the harness: the level 1 character of
// ORC-225 on a test class with no features. It has no species and no
// background, so each value comes from the base rules of SRD 5.2.1.

import { testClass, testPackFile } from "../../src/rules2024/testing.ts";
import { defineGolden } from "../harness.ts";

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
          { key: "languages", options: [{ key: "srd52:draconic" }, { key: "srd52:elvish" }] },
        ],
      },
      expected: {
        // The Standard Array as assigned, with no increase: the character has no background (p21).
        abilities: { str: 8, dex: 15, con: 14, int: 13, wis: 12, cha: 10 },
        // Modifier = (score - 10) / 2, rounded down (p6): 8 -> -1, 15 -> +2, 14 -> +2, 13 -> +1, 12 -> +1, 10 -> 0.
        abilityModifiers: { str: -1, dex: 2, con: 2, int: 1, wis: 1, cha: 0 },
        // Character Advancement table, level 1 (p23).
        proficiencyBonus: 2,
        // Level 1: the full Hit Point Die 8 + Con +2 = 10 (p22).
        maxHitPoints: 10,
        // Saves: the modifier, + PB 2 for Dex and Int, the saves of the test class (p22): Dex 2 + 2 = 4, Int 1 + 2 = 3.
        saveBonuses: { str: -1, dex: 4, con: 2, int: 3, wis: 1, cha: 0 },
        // Passive Perception = 10 + Wisdom (Perception) = 10 + (Wis 1 + PB 2) = 13 (p22).
        passivePerception: 13,
        // No armor: 10 + Dex 2 = 12 (p22).
        armorClass: 12,
        // Initiative: the Dexterity modifier (p22).
        initiative: 2,
        // Carrying Capacity: Str 8 x 15 for a Medium creature = 120 pounds (p178).
        carryingCapacity: 120,
        // Every character knows Common and two Standard Languages (p20).
        languages: ["srd52:common", "srd52:draconic", "srd52:elvish"],
      },
    },
  ],
});
