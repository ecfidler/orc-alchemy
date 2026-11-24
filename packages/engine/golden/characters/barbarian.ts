// The golden Barbarian (ORC-250): a Goliath Soldier Barbarian, Path of the
// Berserker, at levels 1, 5 and 20. The Barbarian is SRD 5.2.1 p28 to p30,
// the Goliath p85, the Soldier p83, the feats p87 to p88, the weapons p89
// to p91, the carrying capacity p178.
//
// The choices:
//   Standard Array (p21): Str 15, Dex 14, Con 13, Int 8, Wis 12, Cha 10.
//   Soldier (p83): Str +2, Con +1, so Str 17, Con 14; Savage Attacker; Athletics, Intimidation; a Dice Set.
//   Goliath (p85): Stone's Endurance. Barbarian skills: Perception, Survival.
//   No armor: Unarmored Defense. A Greataxe and a Handaxe.
//   Level 3: Path of the Berserker; Primal Knowledge: Animal Handling.
//   Level 4, Ability Score Improvement: Str +1, Con +1 (Str 18, Con 15).
//   Level 8, Ability Score Improvement: Str +2 (Str 20).
//   Level 12, Ability Score Improvement: Con +2 (Con 17).
//   Level 16, Ability Score Improvement: Con +1, Dex +1 (Con 18, Dex 15).
//   Level 19, Epic Boon: Boon of Irresistible Offense, Str +1 (the maximum is 30).
//   Level 20, Primal Champion: Str +4 and Con +4, to a maximum of 25.
//
// Hit Points (p28, p23): 12 at level 1, then the fixed 7 for each level,
// + the current Con modifier for each level (p23).

import type { StrictSelection } from "../../src/core/entity.ts";
import type { Entity2024 } from "../../src/rules2024/evaluate.ts";
import { classLevels, plusOneAndOne, plusTwo } from "../choices.ts";
import { defineGolden } from "../define.ts";

/** The choices at each Barbarian level that has one. */
const LEVEL_CHOICES: Record<number, StrictSelection[]> = {
  3: [
    { key: "primal-knowledge", option: { key: "animal-handling" } },
    { key: "subclass", option: { key: "srd52:path-of-the-berserker" } },
  ],
  4: [{ key: "ability-score-improvement", option: plusOneAndOne("str", "con") }],
  8: [{ key: "ability-score-improvement", option: plusTwo("str") }],
  12: [{ key: "ability-score-improvement", option: plusTwo("con") }],
  16: [{ key: "ability-score-improvement", option: plusOneAndOne("con", "dex") }],
  19: [{ key: "epic-boon", option: { key: "srd52:boon-of-irresistible-offense", selections: [{ key: "ability", option: { key: "str" } }] } }],
};

/** Weapon Mastery: 2 kinds of Melee weapons, 3 from level 4, 4 from level 10 (p28, p29). */
const MASTERIES = ["srd52:greataxe", "srd52:handaxe", "srd52:maul", "srd52:javelin"];
const masteryCount = (level: number) => (level >= 10 ? 4 : level >= 4 ? 3 : 2);

export function barbarianAt(level: number): Entity2024 {
  const levels = classLevels(level, (n) => LEVEL_CHOICES[n] ?? []);
  return {
    values: { name: "Kavaki" },
    selections: [
      { key: "ability-scores", option: { key: "standard-array", value: { str: 15, dex: 14, con: 13, int: 8, wis: 12, cha: 10 } } },
      {
        key: "class",
        options: [
          {
            key: "srd52:barbarian",
            selections: [
              { key: "skill-proficiencies", options: [{ key: "perception" }, { key: "survival" }] },
              { key: "starting-equipment", option: { key: "a" } },
              { key: "levels", options: levels },
            ],
          },
        ],
      },
      { key: "species", option: { key: "srd52:goliath", selections: [{ key: "giant-ancestry", option: { key: "stone" } }] } },
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
                  { key: "plus-two", option: { key: "str" } },
                  { key: "plus-one", option: { key: "con" } },
                ],
              },
            },
            { key: "tool", option: { key: "srd52:dice" } },
            { key: "starting-equipment", option: { key: "b" } },
          ],
        },
      },
      { key: "languages", options: [{ key: "srd52:dwarvish" }, { key: "srd52:giant" }] },
      { key: "weapon-mastery", options: MASTERIES.slice(0, masteryCount(level)).map((key) => ({ key })) },
      { key: "weapons", options: [{ key: "srd52:greataxe" }, { key: "srd52:handaxe" }] },
    ],
  };
}

/** The values that are the same at each checked level. */
const ALWAYS = {
  // The Goliath: Medium, no Darkvision; Stone's Endurance (p85).
  size: "medium",
  darkvision: 0,
  lineage: "stone",
  resistances: [],
  // Saving throw proficiencies: Strength and Constitution (p28).
  savingThrowProficiencies: ["str", "con"],
  // Simple and Martial weapons; Light and Medium armor and Shields (p28).
  weaponProficiencies: ["simple", "martial"],
  armorTraining: ["light", "medium", "shield"],
  // Common, and the two Standard Languages of the choice (p20).
  languages: ["srd52:common", "srd52:dwarvish", "srd52:giant"],
  // No armor: Unarmored Defense is the base calculation (p28, p177).
  wornArmor: null,
  wornArmorCategory: null,
  armorClassFormula: "srd52:barbarian/unarmored-defense",
  // A Critical Hit on a 20 only: the Berserker does not change it (p30).
  criticalHitMinimum: 20,
  // Barbarian starting equipment A: 15 GP. Soldier B: 50 GP (p28, p83). 15 + 50 = 65.
  gold: 65,
} as const;

export const barbarian = defineGolden({
  name: "Barbarian (Goliath Soldier, Berserker)",
  checks: [
    {
      level: 1,
      entity: barbarianAt(1),
      expected: {
        ...ALWAYS,
        // Str 15 + 2 = 17, Con 13 + 1 = 14 (p83).
        abilities: { str: 17, dex: 14, con: 14, int: 8, wis: 12, cha: 10 },
        // (score - 10) / 2, rounded down (p6): 17 -> 3, 14 -> 2, 14 -> 2, 8 -> -1, 12 -> 1, 10 -> 0.
        abilityModifiers: { str: 3, dex: 2, con: 2, int: -1, wis: 1, cha: 0 },
        // Barbarian Features table, level 1: +2 (p28).
        proficiencyBonus: 2,
        // 12 + Con 2 = 14 (p28, p23).
        maxHitPoints: 14,
        // One d12 Hit Point Die for each Barbarian level (p28).
        hitPointDice: { d12: 1 },
        // Unarmored Defense: 10 + Dex 2 + Con 2 = 14 (p28).
        baseArmorClass: 14,
        unarmoredArmorClass: 14,
        armorClass: 14,
        // The Goliath: Speed 35 feet (p85). Fast Movement comes at level 5 (p29).
        speed: 35,
        // Saves of the Barbarian (p28): Str 3 + 2 = 5, Con 2 + 2 = 4; the others are the modifier (p22).
        saveBonuses: { str: 5, dex: 2, con: 4, int: -1, wis: 1, cha: 0 },
        // Barbarian: Perception, Survival. Soldier: Athletics, Intimidation (p28, p83).
        skillProficiencies: ["perception", "survival", "athletics", "intimidation"],
        // Proficient: Athletics 3 + 2 = 5, Intimidation 0 + 2 = 2, Perception 1 + 2 = 3, Survival 1 + 2 = 3. The others are the modifier (p14, p22).
        skillBonuses: {
          acrobatics: 2,
          "animal-handling": 1,
          arcana: -1,
          athletics: 5,
          deception: 0,
          history: -1,
          insight: 1,
          intimidation: 2,
          investigation: -1,
          medicine: 1,
          nature: -1,
          perception: 3,
          performance: 0,
          persuasion: 0,
          religion: -1,
          "sleight-of-hand": 2,
          stealth: 2,
          survival: 3,
        },
        // 10 + Perception 3 (p22).
        passivePerception: 13,
        // Initiative: the Dexterity modifier, 2 (p22).
        initiative: 2,
        // Powerful Build: one size larger, Large (p85). Large: Str 17 x 30 = 510; drag, lift or push: x 60 = 1020 (p178).
        carryingCapacity: 510,
        dragLiftPush: 1020,
        // One attack until Extra Attack at level 5 (p29).
        attacksPerAction: 1,
        // Barbarian Features table, level 1: Rages 2, Rage Damage +2, Weapon Mastery 2 (p28).
        classColumns: { "srd52:barbarian": { "rage-count": 2, "rage-damage-bonus": 2, "weapon-mastery": 2 } },
        // Weapon Mastery: two kinds of Melee weapons (p29).
        weaponMasteries: ["srd52:greataxe", "srd52:handaxe"],
        weaponAttacks: [
          // Greataxe, Melee: Str 3 + PB 2 = +5; 1d12 + 3 Slashing; Heavy (Str 17 >= 13), Two-Handed; Cleave (p90, p91).
          {
            weapon: "srd52:greataxe",
            name: "Greataxe",
            attackBonus: 5,
            damage: "1d12+3",
            damageType: "srd52:slashing",
            properties: ["heavy", "two-handed"],
            mastery: "cleave",
            disadvantage: false,
          },
          // Handaxe, Melee with Thrown 20/60: Str 3 + PB 2 = +5; 1d6 + 3 Slashing; Light; Vex (p90, p91).
          {
            weapon: "srd52:handaxe",
            name: "Handaxe",
            attackBonus: 5,
            damage: "1d6+3",
            damageType: "srd52:slashing",
            properties: ["light", "thrown"],
            range: [20, 60],
            mastery: "vex",
            disadvantage: false,
          },
        ],
      },
    },
    {
      level: 5,
      entity: barbarianAt(5),
      expected: {
        ...ALWAYS,
        // Level 4, Ability Score Improvement: Str 17 + 1 = 18, Con 14 + 1 = 15 (p87).
        abilities: { str: 18, dex: 14, con: 15, int: 8, wis: 12, cha: 10 },
        // 18 -> 4, 14 -> 2, 15 -> 2 (p6).
        abilityModifiers: { str: 4, dex: 2, con: 2, int: -1, wis: 1, cha: 0 },
        // Level 5: +3 (p28).
        proficiencyBonus: 3,
        // 12 + 7 x 4 = 40, + Con 2 x 5 = 10, = 50 (p28, p23).
        maxHitPoints: 50,
        // One d12 for each Barbarian level (p28).
        hitPointDice: { d12: 5 },
        // Unarmored Defense: 10 + Dex 2 + Con 2 = 14 (p28).
        baseArmorClass: 14,
        unarmoredArmorClass: 14,
        armorClass: 14,
        // Fast Movement: 35 + 10 = 45, without Heavy armor (p29).
        speed: 45,
        // Saves (p28, p22): Str 4 + 3 = 7, Con 2 + 3 = 5.
        saveBonuses: { str: 7, dex: 2, con: 5, int: -1, wis: 1, cha: 0 },
        // Primal Knowledge at level 3: Animal Handling, after the class skills (p29).
        skillProficiencies: ["perception", "survival", "animal-handling", "athletics", "intimidation"],
        // Proficient: Athletics 4 + 3 = 7, Intimidation 0 + 3 = 3, Perception, Survival and Animal Handling 1 + 3 = 4 (p14, p22).
        skillBonuses: {
          acrobatics: 2,
          "animal-handling": 4,
          arcana: -1,
          athletics: 7,
          deception: 0,
          history: -1,
          insight: 1,
          intimidation: 3,
          investigation: -1,
          medicine: 1,
          nature: -1,
          perception: 4,
          performance: 0,
          persuasion: 0,
          religion: -1,
          "sleight-of-hand": 2,
          stealth: 2,
          survival: 4,
        },
        // 10 + Perception 4 (p22).
        passivePerception: 14,
        // Initiative: the Dexterity modifier, 2 (p22).
        initiative: 2,
        // Large: Str 18 x 30 = 540; x 60 = 1080 (p85, p178).
        carryingCapacity: 540,
        dragLiftPush: 1080,
        // Path of the Berserker at level 3 (p29, p30).
        subclasses: { "srd52:barbarian": "srd52:path-of-the-berserker" },
        // Extra Attack: two attacks (p29).
        attacksPerAction: 2,
        // Barbarian Features table, level 5: Rages 3, Rage Damage +2, Weapon Mastery 3 (p28).
        classColumns: { "srd52:barbarian": { "rage-count": 3, "rage-damage-bonus": 2, "weapon-mastery": 3 } },
        // Weapon Mastery 3 from level 4 (p28).
        weaponMasteries: ["srd52:greataxe", "srd52:handaxe", "srd52:maul"],
        weaponAttacks: [
          // Str 4 + PB 3 = +7; 1d12 + 4 (p89, p91).
          {
            weapon: "srd52:greataxe",
            name: "Greataxe",
            attackBonus: 7,
            damage: "1d12+4",
            damageType: "srd52:slashing",
            properties: ["heavy", "two-handed"],
            mastery: "cleave",
            disadvantage: false,
          },
          // Str 4 + PB 3 = +7; 1d6 + 4 (p89, p90).
          {
            weapon: "srd52:handaxe",
            name: "Handaxe",
            attackBonus: 7,
            damage: "1d6+4",
            damageType: "srd52:slashing",
            properties: ["light", "thrown"],
            range: [20, 60],
            mastery: "vex",
            disadvantage: false,
          },
        ],
      },
    },
    {
      level: 20,
      entity: barbarianAt(20),
      expected: {
        ...ALWAYS,
        // Str 18, then 20 at level 8. Con 15, then 17 at level 12 and 18 at level 16. Dex 14 + 1 = 15 at level 16 (p87).
        // The increases with the lower maximum apply first. Primal Champion: Str 20 + 4 = 24, Con 18 + 4 = 22, at most 25 (p30).
        // Boon of Irresistible Offense: Str 24 + 1 = 25, at most 30 (p88).
        abilities: { str: 25, dex: 15, con: 22, int: 8, wis: 12, cha: 10 },
        // 25 -> 7, 15 -> 2, 22 -> 6 (p6).
        abilityModifiers: { str: 7, dex: 2, con: 6, int: -1, wis: 1, cha: 0 },
        // Levels 17 to 20: +6 (p28).
        proficiencyBonus: 6,
        // 12 + 7 x 19 = 145, + Con 6 x 20 = 120, = 265 (p28, p23).
        maxHitPoints: 265,
        // One d12 for each Barbarian level (p28).
        hitPointDice: { d12: 20 },
        // Unarmored Defense: 10 + Dex 2 + Con 6 = 18 (p28).
        baseArmorClass: 18,
        unarmoredArmorClass: 18,
        armorClass: 18,
        // Fast Movement: 35 + 10 = 45 (p29).
        speed: 45,
        // Saves (p28, p22): Str 7 + 6 = 13, Con 6 + 6 = 12.
        saveBonuses: { str: 13, dex: 2, con: 12, int: -1, wis: 1, cha: 0 },
        // Barbarian: Perception, Survival; Primal Knowledge: Animal Handling. Soldier: Athletics, Intimidation (p28, p29, p83).
        skillProficiencies: ["perception", "survival", "animal-handling", "athletics", "intimidation"],
        // Proficient: Athletics 7 + 6 = 13, Intimidation 0 + 6 = 6, Perception, Survival and Animal Handling 1 + 6 = 7 (p14, p22).
        skillBonuses: {
          acrobatics: 2,
          "animal-handling": 7,
          arcana: -1,
          athletics: 13,
          deception: 0,
          history: -1,
          insight: 1,
          intimidation: 6,
          investigation: -1,
          medicine: 1,
          nature: -1,
          perception: 7,
          performance: 0,
          persuasion: 0,
          religion: -1,
          "sleight-of-hand": 2,
          stealth: 2,
          survival: 7,
        },
        // 10 + Perception 7 (p22).
        passivePerception: 17,
        // Initiative: the Dexterity modifier, 2 (p22).
        initiative: 2,
        // Large: Str 25 x 30 = 750; x 60 = 1500 (p85, p178).
        carryingCapacity: 750,
        dragLiftPush: 1500,
        // Path of the Berserker at level 3 (p29, p30).
        subclasses: { "srd52:barbarian": "srd52:path-of-the-berserker" },
        // Extra Attack: still two attacks (p29).
        attacksPerAction: 2,
        // Barbarian Features table, level 20: Rages 6, Rage Damage +4, Weapon Mastery 4 (p28).
        classColumns: { "srd52:barbarian": { "rage-count": 6, "rage-damage-bonus": 4, "weapon-mastery": 4 } },
        // Weapon Mastery 4 from level 10 (p28).
        weaponMasteries: MASTERIES,
        weaponAttacks: [
          // Str 7 + PB 6 = +13; 1d12 + 7 (p89, p91).
          {
            weapon: "srd52:greataxe",
            name: "Greataxe",
            attackBonus: 13,
            damage: "1d12+7",
            damageType: "srd52:slashing",
            properties: ["heavy", "two-handed"],
            mastery: "cleave",
            disadvantage: false,
          },
          // Str 7 + PB 6 = +13; 1d6 + 7 (p89, p90).
          {
            weapon: "srd52:handaxe",
            name: "Handaxe",
            attackBonus: 13,
            damage: "1d6+7",
            damageType: "srd52:slashing",
            properties: ["light", "thrown"],
            range: [20, 60],
            mastery: "vex",
            disadvantage: false,
          },
        ],
      },
    },
  ],
});
