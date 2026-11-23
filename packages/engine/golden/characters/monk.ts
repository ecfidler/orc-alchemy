// The golden Monk (ORC-251): a Human Criminal Monk, Warrior of the Open
// Hand, at levels 1, 5 and 20. The Monk is SRD 5.2.1 p49 to p52, the Human
// p85, the Criminal p83, the feats p87 to p88, the weapons p89 to p91, the
// Unarmed Strike p190, the carrying capacity p178.
//
// The choices:
//   Standard Array (p21): Str 8, Dex 15, Con 13, Int 10, Wis 14, Cha 12.
//   Criminal (p83): Dex +2, Con +1, so Dex 17, Con 14; Alert; Sleight of Hand, Stealth; Thieves' Tools.
//   Human (p85): Medium; Skillful: Perception; Versatile: Savage Attacker.
//   Monk skills: Acrobatics, Insight. Monk tool: a Flute. No armor and no Shield. A Spear and a Shortsword.
//   Level 3: Warrior of the Open Hand.
//   Level 4, Ability Score Improvement: Dex +1, Wis +1 (Dex 18, Wis 15).
//   Level 8, Ability Score Improvement: Dex +2 (Dex 20).
//   Level 12, Ability Score Improvement: Wis +2 (Wis 17).
//   Level 16, Ability Score Improvement: Wis +1, Con +1 (Wis 18, Con 15).
//   Level 19, Epic Boon: Boon of Irresistible Offense, Dex +1 (the maximum is 30).
//   Level 20, Body and Mind: Dex +4 and Wis +4, to a maximum of 25.
//
// Hit Points (p49, p23): 8 at level 1, then the fixed 5 for each level,
// + the current Con modifier for each level (p23).

import type { StrictSelection } from "../../src/core/entity.ts";
import type { Entity2024 } from "../../src/rules2024/evaluate.ts";
import { classLevels, plusOneAndOne, plusTwo } from "../choices.ts";
import { defineGolden } from "../define.ts";

/** The choices at each Monk level that has one. */
const LEVEL_CHOICES: Record<number, StrictSelection[]> = {
  3: [{ key: "subclass", option: { key: "srd52:warrior-of-the-open-hand" } }],
  4: [{ key: "ability-score-improvement", option: plusOneAndOne("dex", "wis") }],
  8: [{ key: "ability-score-improvement", option: plusTwo("dex") }],
  12: [{ key: "ability-score-improvement", option: plusTwo("wis") }],
  16: [{ key: "ability-score-improvement", option: plusOneAndOne("wis", "con") }],
  19: [{ key: "epic-boon", option: { key: "srd52:boon-of-irresistible-offense", selections: [{ key: "ability", option: { key: "dex" } }] } }],
};

export function monkAt(level: number): Entity2024 {
  const levels = classLevels(level, (n) => LEVEL_CHOICES[n] ?? []);
  return {
    values: { name: "Mei" },
    selections: [
      { key: "ability-scores", option: { key: "standard-array", value: { str: 8, dex: 15, con: 13, int: 10, wis: 14, cha: 12 } } },
      {
        key: "class",
        options: [
          {
            key: "srd52:monk",
            selections: [
              { key: "skill-proficiencies", options: [{ key: "acrobatics" }, { key: "insight" }] },
              { key: "tool-proficiencies", option: { key: "srd52:flute" } },
              { key: "starting-equipment", option: { key: "a" } },
              { key: "levels", options: levels },
            ],
          },
        ],
      },
      {
        key: "species",
        option: {
          key: "srd52:human",
          selections: [
            { key: "size", option: { key: "medium" } },
            { key: "skillful", option: { key: "perception" } },
            { key: "versatile", option: { key: "srd52:savage-attacker" } },
          ],
        },
      },
      {
        key: "background",
        option: {
          key: "srd52:criminal",
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
            { key: "starting-equipment", option: { key: "b" } },
          ],
        },
      },
      { key: "languages", options: [{ key: "srd52:dwarvish" }, { key: "srd52:elvish" }] },
      { key: "weapons", options: [{ key: "srd52:spear" }, { key: "srd52:shortsword" }] },
    ],
  };
}

/** The values that are the same at each checked level. */
const ALWAYS = {
  // The Human: Medium (chosen), Speed 30 feet, no Darkvision (p85).
  size: "medium",
  darkvision: 0,
  resistances: [],
  // Monk: Acrobatics, Insight. Human Skillful: Perception. Criminal: Sleight of Hand, Stealth (p49, p85, p83).
  skillProficiencies: ["acrobatics", "insight", "perception", "sleight-of-hand", "stealth"],
  // Simple weapons and Martial weapons that have the Light property; no armor training (p49).
  weaponProficiencies: ["simple", "scimitar", "shortsword", "hand-crossbow"],
  armorTraining: [],
  // Monk: the Flute. Criminal: Thieves' Tools (p49, p83).
  toolProficiencies: ["srd52:flute", "srd52:thieves-tools"],
  // Common, and the two Standard Languages of the choice (p20).
  languages: ["srd52:common", "srd52:dwarvish", "srd52:elvish"],
  // No armor: Unarmored Defense is the base calculation (p50, p177).
  wornArmor: null,
  shield: false,
  armorClassFormula: "srd52:monk/unarmored-defense",
  // Medium: Str 8 x 15 = 120; drag, lift or push: x 30 = 240 (p178).
  carryingCapacity: 120,
  dragLiftPush: 240,
  // Monk starting equipment A: 11 GP. Criminal B: 50 GP (p49, p83). 11 + 50 = 61.
  gold: 61,
} as const;

/**
 * The Spear, the Shortsword and the Unarmed Strike with Martial Arts (p50): Dex in place of Str, and the
 * Martial Arts die in place of a smaller die. The Spear is Simple Melee, and the Shortsword is Martial Melee
 * and Light, so both are Monk weapons. Spear: 1d6 Piercing, Versatile 1d8, Thrown 20/60, Sap. Shortsword:
 * 1d6 Piercing, Finesse, Light, Vex (p90, p91). The Monk has no Weapon Mastery, so no mastery (p89).
 */
function attacks(bonus: number, die: number, dex: number) {
  return [
    {
      weapon: "srd52:spear",
      name: "Spear",
      attackBonus: bonus,
      damage: `1d${Math.max(6, die)}+${dex}`,
      versatileDamage: `1d${Math.max(8, die)}+${dex}`,
      damageType: "srd52:piercing",
      properties: ["thrown", "versatile"],
      range: [20, 60],
      mastery: null,
      disadvantage: false,
    },
    {
      weapon: "srd52:shortsword",
      name: "Shortsword",
      attackBonus: bonus,
      damage: `1d${Math.max(6, die)}+${dex}`,
      damageType: "srd52:piercing",
      properties: ["finesse", "light"],
      mastery: null,
      disadvantage: false,
    },
    // The Unarmed Strike: the Martial Arts die in place of 1, Bludgeoning (p50, p190).
    {
      weapon: "unarmed-strike",
      name: "Unarmed Strike",
      attackBonus: bonus,
      damage: `1d${die}+${dex}`,
      damageType: "srd52:bludgeoning",
      properties: [],
      mastery: null,
      disadvantage: false,
    },
  ] as const;
}

export const monk = defineGolden({
  name: "Monk (Human Criminal, Open Hand)",
  checks: [
    {
      level: 1,
      entity: monkAt(1),
      expected: {
        ...ALWAYS,
        // Dex 15 + 2 = 17, Con 13 + 1 = 14 (p83).
        abilities: { str: 8, dex: 17, con: 14, int: 10, wis: 14, cha: 12 },
        // (score - 10) / 2, rounded down (p6): 8 -> -1, 17 -> 3, 14 -> 2, 10 -> 0, 14 -> 2, 12 -> 1.
        abilityModifiers: { str: -1, dex: 3, con: 2, int: 0, wis: 2, cha: 1 },
        // Monk Features table, level 1: +2 (p50).
        proficiencyBonus: 2,
        // 8 + Con 2 = 10 (p49, p23).
        maxHitPoints: 10,
        // One d8 Hit Point Die for each Monk level (p49).
        hitPointDice: { d8: 1 },
        // Unarmored Defense: 10 + Dex 3 + Wis 2 = 15 (p50).
        armorClass: 15,
        // Speed 30 (p85). Unarmored Movement comes at level 2 (p51).
        speed: 30,
        // Saving throws: Strength and Dexterity (p49). Str -1 + 2 = 1, Dex 3 + 2 = 5; the others are the modifier (p22).
        savingThrowProficiencies: ["str", "dex"],
        saveBonuses: { str: 1, dex: 5, con: 2, int: 0, wis: 2, cha: 1 },
        // Proficient: Acrobatics, Sleight of Hand and Stealth 3 + 2 = 5; Insight and Perception 2 + 2 = 4. The others are the modifier (p14, p22).
        skillBonuses: {
          acrobatics: 5,
          "animal-handling": 2,
          arcana: 0,
          athletics: -1,
          deception: 1,
          history: 0,
          insight: 4,
          intimidation: 1,
          investigation: 0,
          medicine: 2,
          nature: 0,
          perception: 4,
          performance: 1,
          persuasion: 1,
          religion: 0,
          "sleight-of-hand": 5,
          stealth: 5,
          survival: 2,
        },
        // 10 + Perception 4 (p22).
        passivePerception: 14,
        // Dex 3 + Alert: the Proficiency Bonus 2 = 5 (p22, p87).
        initiative: 5,
        // One attack until Extra Attack at level 5 (p51).
        attacksPerAction: 1,
        // Martial Arts column, level 1: 1d6 (p50).
        martialArtsDie: 6,
        // Monk Features table, level 1: Martial Arts 1d6, no Focus Points, no Unarmored Movement (p50).
        classColumns: { "srd52:monk": { "martial-arts-die": 6, "focus-points": 0, "unarmored-movement-bonus": 0 } },
        // Dex 3 + PB 2 = +5; the Martial Arts die 1d6 is not larger than the d6, so 1d6 + 3; Versatile 1d8 + 3 (p50).
        weaponAttacks: attacks(5, 6, 3),
      },
    },
    {
      level: 5,
      entity: monkAt(5),
      expected: {
        ...ALWAYS,
        // Level 4, Ability Score Improvement: Dex 17 + 1 = 18, Wis 14 + 1 = 15 (p87).
        abilities: { str: 8, dex: 18, con: 14, int: 10, wis: 15, cha: 12 },
        // 18 -> 4, 15 -> 2 (p6).
        abilityModifiers: { str: -1, dex: 4, con: 2, int: 0, wis: 2, cha: 1 },
        // Level 5: +3 (p50).
        proficiencyBonus: 3,
        // 8 + 5 x 4 = 28, + Con 2 x 5 = 10, = 38 (p49, p23).
        maxHitPoints: 38,
        // One d8 for each Monk level (p49).
        hitPointDice: { d8: 5 },
        // Unarmored Defense: 10 + Dex 4 + Wis 2 = 16 (p50).
        armorClass: 16,
        // Unarmored Movement +10 ft. at level 5: 30 + 10 = 40 (p50, p51).
        speed: 40,
        // Str -1 + 3 = 2, Dex 4 + 3 = 7 (p49, p22).
        savingThrowProficiencies: ["str", "dex"],
        saveBonuses: { str: 2, dex: 7, con: 2, int: 0, wis: 2, cha: 1 },
        // Proficient: Acrobatics, Sleight of Hand and Stealth 4 + 3 = 7; Insight and Perception 2 + 3 = 5 (p14, p22).
        skillBonuses: {
          acrobatics: 7,
          "animal-handling": 2,
          arcana: 0,
          athletics: -1,
          deception: 1,
          history: 0,
          insight: 5,
          intimidation: 1,
          investigation: 0,
          medicine: 2,
          nature: 0,
          perception: 5,
          performance: 1,
          persuasion: 1,
          religion: 0,
          "sleight-of-hand": 7,
          stealth: 7,
          survival: 2,
        },
        // 10 + Perception 5 (p22).
        passivePerception: 15,
        // Dex 4 + Alert 3 = 7 (p22, p87).
        initiative: 7,
        // Warrior of the Open Hand at level 3 (p51, p52).
        subclasses: { "srd52:monk": "srd52:warrior-of-the-open-hand" },
        // Extra Attack: two attacks (p51).
        attacksPerAction: 2,
        // Martial Arts column, level 5: 1d8 (p50).
        martialArtsDie: 8,
        // Monk Features table, level 5: Martial Arts 1d8, Focus Points 5, Unarmored Movement +10 ft. (p50).
        classColumns: { "srd52:monk": { "martial-arts-die": 8, "focus-points": 5, "unarmored-movement-bonus": 10 } },
        // Dex 4 + PB 3 = +7; the d8 replaces the d6; Versatile 1d8 + 4 (p50).
        weaponAttacks: attacks(7, 8, 4),
      },
    },
    {
      level: 20,
      entity: monkAt(20),
      expected: {
        ...ALWAYS,
        // Dex 18, then 20 at level 8. Wis 15, then 17 at level 12 and 18 at level 16. Con 14 + 1 = 15 at level 16 (p87).
        // The increases with the lower maximum apply first. Body and Mind: Dex 20 + 4 = 24, Wis 18 + 4 = 22, at most 25 (p52).
        // Boon of Irresistible Offense: Dex 24 + 1 = 25, at most 30 (p88).
        abilities: { str: 8, dex: 25, con: 15, int: 10, wis: 22, cha: 12 },
        // 25 -> 7, 15 -> 2, 22 -> 6 (p6).
        abilityModifiers: { str: -1, dex: 7, con: 2, int: 0, wis: 6, cha: 1 },
        // Levels 17 to 20: +6 (p50).
        proficiencyBonus: 6,
        // 8 + 5 x 19 = 103, + Con 2 x 20 = 40, = 143 (p49, p23).
        maxHitPoints: 143,
        // One d8 for each Monk level (p49).
        hitPointDice: { d8: 20 },
        // Unarmored Defense: 10 + Dex 7 + Wis 6 = 23 (p50).
        armorClass: 23,
        // Unarmored Movement +30 ft. from level 18: 30 + 30 = 60 (p50).
        speed: 60,
        // Disciplined Survivor at level 14: proficiency in all saving throws (p52). Each is the modifier + 6.
        savingThrowProficiencies: ["str", "dex", "con", "int", "wis", "cha"],
        saveBonuses: { str: 5, dex: 13, con: 8, int: 6, wis: 12, cha: 7 },
        // Proficient: Acrobatics, Sleight of Hand and Stealth 7 + 6 = 13; Insight and Perception 6 + 6 = 12 (p14, p22).
        skillBonuses: {
          acrobatics: 13,
          "animal-handling": 6,
          arcana: 0,
          athletics: -1,
          deception: 1,
          history: 0,
          insight: 12,
          intimidation: 1,
          investigation: 0,
          medicine: 6,
          nature: 0,
          perception: 12,
          performance: 1,
          persuasion: 1,
          religion: 0,
          "sleight-of-hand": 13,
          stealth: 13,
          survival: 6,
        },
        // 10 + Perception 12 (p22).
        passivePerception: 22,
        // Dex 7 + Alert 6 = 13 (p22, p87).
        initiative: 13,
        // Warrior of the Open Hand at level 3 (p51, p52).
        subclasses: { "srd52:monk": "srd52:warrior-of-the-open-hand" },
        // Extra Attack: still two attacks (p51).
        attacksPerAction: 2,
        // Martial Arts column, level 20: 1d12 (p50).
        martialArtsDie: 12,
        // Monk Features table, level 20: Martial Arts 1d12, Focus Points 20, Unarmored Movement +30 ft. (p50).
        classColumns: { "srd52:monk": { "martial-arts-die": 12, "focus-points": 20, "unarmored-movement-bonus": 30 } },
        // Dex 7 + PB 6 = +13; the d12 replaces the d6 and the d8 (p50).
        weaponAttacks: attacks(13, 12, 7),
      },
    },
  ],
});
