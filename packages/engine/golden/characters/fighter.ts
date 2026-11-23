// The golden Fighter (ORC-230): a Dwarf Soldier Fighter, Champion, at
// levels 1, 3, 5, 11 and 20. The Fighter is SRD 5.2.1 p47 to p49, the Dwarf
// p84, the Soldier p83, the feats p87 to p88, the armor and weapons p89 to
// p92.
//
// The choices:
//   Standard Array (p21): Str 15, Dex 13, Con 14, Int 8, Wis 12, Cha 10.
//   Soldier (p83): Str +2, Con +1, so Str 17, Con 15; Savage Attacker; Athletics, Intimidation; a Dice Set.
//   Fighter skills: Perception, Survival. Fighting Style: Defense. Chain Mail, a Greatsword and a Longbow.
//   Level 4, Ability Score Improvement: Str +1, Con +1 (Str 18, Con 16).
//   Level 6, Ability Score Improvement: Str +2 (Str 20).
//   Level 7, Additional Fighting Style: Archery.
//   Level 8, Ability Score Improvement: Con +2 (Con 18).
//   Level 12, Ability Score Improvement: Con +2 (Con 20).
//   Level 14, Grappler: Dex +1 (Dex 14).
//   Level 16, Ability Score Improvement: Wis +2 (Wis 14).
//   Level 19, Epic Boon: Boon of Irresistible Offense, Str +1 to 21 (the maximum is 30).
//
// Hit Points (p47, p23): 10 at level 1, then the fixed 6 for each level,
// + the Con modifier for each level, + 1 for each level from Dwarven
// Toughness (p84). The Con modifier is the one at that level.

import type { StrictOption, StrictSelection } from "../../src/core/entity.ts";
import type { Entity2024 } from "../../src/rules2024/evaluate.ts";
import { defineGolden } from "../define.ts";

const asi = (increase: StrictOption): StrictOption => ({ key: "srd52:ability-score-improvement", selections: [{ key: "increase", option: increase }] });
const plusTwo = (ability: string) => asi({ key: "two", selections: [{ key: "ability", option: { key: ability } }] });
const plusOneAndOne = (first: string, second: string) =>
  asi({ key: "one-and-one", selections: [{ key: "abilities", options: [{ key: first }, { key: second }] }] });

/** The choices at each Fighter level that has one. */
const LEVEL_CHOICES: Record<number, StrictSelection[]> = {
  1: [{ key: "fighting-style", option: { key: "srd52:defense" } }],
  3: [
    {
      key: "subclass",
      option: { key: "srd52:champion", selections: [{ key: "additional-fighting-style", option: { key: "srd52:archery" } }] },
    },
  ],
  4: [{ key: "ability-score-improvement", option: plusOneAndOne("str", "con") }],
  6: [{ key: "ability-score-improvement", option: plusTwo("str") }],
  8: [{ key: "ability-score-improvement", option: plusTwo("con") }],
  12: [{ key: "ability-score-improvement", option: plusTwo("con") }],
  14: [{ key: "ability-score-improvement", option: { key: "srd52:grappler", selections: [{ key: "ability", option: { key: "dex" } }] } }],
  16: [{ key: "ability-score-improvement", option: plusTwo("wis") }],
  19: [{ key: "epic-boon", option: { key: "srd52:boon-of-irresistible-offense", selections: [{ key: "ability", option: { key: "str" } }] } }],
};

/** Weapon Mastery: 3 kinds, 4 from level 4, 5 from level 10, 6 from level 16 (p47). */
const MASTERIES = ["srd52:greatsword", "srd52:longbow", "srd52:flail", "srd52:dagger", "srd52:longsword", "srd52:handaxe"];
const masteryCount = (level: number) => (level >= 16 ? 6 : level >= 10 ? 5 : level >= 4 ? 4 : 3);

function fighterAt(level: number): Entity2024 {
  const levels = Array.from({ length: level }, (_, i): StrictOption => {
    const n = i + 1;
    // The Additional Fighting Style of the subclass is a choice from level 7 only.
    const choices = (LEVEL_CHOICES[n] ?? []).map((choice) =>
      choice.key === "subclass" && level < 7 ? { ...choice, option: { key: "srd52:champion" } } : choice,
    );
    return { key: `level-${n}`, ...(choices.length ? { selections: choices } : {}) };
  });
  return {
    values: { name: "Brunhild" },
    selections: [
      { key: "ability-scores", option: { key: "standard-array", value: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 } } },
      {
        key: "class",
        options: [
          {
            key: "srd52:fighter",
            selections: [
              { key: "skill-proficiencies", options: [{ key: "perception" }, { key: "survival" }] },
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
      { key: "armor", option: { key: "srd52:chain-mail" } },
      { key: "weapons", options: [{ key: "srd52:greatsword" }, { key: "srd52:longbow" }] },
    ],
  };
}

/** The values that are the same at each checked level. */
const ALWAYS = {
  // The Dwarf: Medium, Speed 30, Darkvision 120 feet, Resistance to Poison damage (p84).
  size: "medium",
  speed: 30,
  darkvision: 120,
  resistances: ["srd52:poison"],
  // Saving throw proficiencies: Strength and Constitution (p47).
  savingThrowProficiencies: ["str", "con"],
  // Fighter: Perception, Survival. Soldier: Athletics, Intimidation (p83).
  skillProficiencies: ["perception", "survival", "athletics", "intimidation"],
  // Simple and Martial weapons; Light, Medium and Heavy armor and Shields (p47).
  weaponProficiencies: ["simple", "martial"],
  armorTraining: ["light", "medium", "heavy", "shield"],
  // Common, and the two Standard Languages of the choice (p20).
  languages: ["srd52:common", "srd52:dwarvish", "srd52:giant"],
  // Chain Mail: 16, Heavy, no Dexterity modifier (p92). Defense: +1 while you wear armor (p87). 16 + 1 = 17.
  armorClass: 17,
  // Chain Mail: Strength 13 and Disadvantage on Dexterity (Stealth) checks (p92).
  stealthDisadvantage: true,
  // Fighter starting equipment C: 155 GP. Soldier B: 50 GP (p47, p83). 155 + 50 = 205.
  gold: 205,
} as const;

export const fighter = defineGolden({
  name: "Fighter (Dwarf Soldier, Champion)",
  checks: [
    {
      level: 1,
      entity: fighterAt(1),
      expected: {
        ...ALWAYS,
        // Str 15 + 2 = 17, Con 14 + 1 = 15 (p83).
        abilities: { str: 17, dex: 13, con: 15, int: 8, wis: 12, cha: 10 },
        // (score - 10) / 2, rounded down (p6): 17 -> 3, 13 -> 1, 15 -> 2, 8 -> -1, 12 -> 1, 10 -> 0.
        abilityModifiers: { str: 3, dex: 1, con: 2, int: -1, wis: 1, cha: 0 },
        // Fighter Features table, level 1: +2 (p47).
        proficiencyBonus: 2,
        // 10 + Con 2 + Dwarven Toughness 1 = 13 (p47, p84).
        maxHitPoints: 13,
        // One d10 Hit Point Die for each Fighter level (p47).
        hitPointDice: { d10: 1 },
        // Saves of the Fighter (p47): Str 3 + 2 = 5, Con 2 + 2 = 4; the others are the modifier (p22).
        saveBonuses: { str: 5, dex: 1, con: 4, int: -1, wis: 1, cha: 0 },
        // Proficient: Athletics 3 + 2 = 5, Intimidation 0 + 2 = 2, Perception 1 + 2 = 3, Survival 1 + 2 = 3. The others are the modifier (p14, p22).
        skillBonuses: {
          acrobatics: 1,
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
          "sleight-of-hand": 1,
          stealth: 1,
          survival: 3,
        },
        // 10 + Perception 3 (p22).
        passivePerception: 13,
        // Initiative: the Dexterity modifier, 1 (p22).
        initiative: 1,
        // Str 17 x 15 = 255; drag, lift or push: x 30 = 510 (p178).
        carryingCapacity: 255,
        dragLiftPush: 510,
        // One attack until Extra Attack at level 5 (p48).
        attacksPerAction: 1,
        // A Critical Hit on a 20 only, until Improved Critical (p49).
        criticalHitMinimum: 20,
        // Weapon Mastery column of the Fighter Features table (p47): 3, 4 from level 4, 5 from 10, 6 from 16.
        weaponMasteries: ["srd52:greatsword", "srd52:longbow", "srd52:flail"],
        weaponAttacks: [
          // Greatsword, Melee: Str 3 + PB 2 = +5; 2d6 + 3 Slashing; Heavy (Str 17 >= 13), Two-Handed; Graze (p91).
          {
            weapon: "srd52:greatsword",
            name: "Greatsword",
            attackBonus: 5,
            damage: "2d6+3",
            damageType: "srd52:slashing",
            properties: ["heavy", "two-handed"],
            mastery: "graze",
            disadvantage: false,
          },
          // Longbow, Ranged: Dex 1 + PB 2 = +3; 1d8 + 1 Piercing; 150/600; Heavy (Dex 13 >= 13); Slow (p91).
          {
            weapon: "srd52:longbow",
            name: "Longbow",
            attackBonus: 3,
            damage: "1d8+1",
            damageType: "srd52:piercing",
            properties: ["ammunition", "heavy", "two-handed"],
            range: [150, 600],
            mastery: "slow",
            disadvantage: false,
          },
        ],
      },
    },
    {
      level: 3,
      entity: fighterAt(3),
      expected: {
        ...ALWAYS,
        // No increase before level 4: as at level 1 (p47, p83).
        abilities: { str: 17, dex: 13, con: 15, int: 8, wis: 12, cha: 10 },
        // Fighter Features table, levels 1 to 4: +2 (p47).
        proficiencyBonus: 2,
        // 10 + 6 + 6 = 22, + Con 2 x 3 = 6, + Dwarven Toughness 3 = 31 (p47, p84).
        maxHitPoints: 31,
        // One d10 for each Fighter level (p47).
        hitPointDice: { d10: 3 },
        // Fighter Subclass at level 3: Champion (p47, p49).
        subclasses: { "srd52:fighter": "srd52:champion" },
        // Still one attack before level 5 (p48).
        attacksPerAction: 1,
        // Improved Critical: 19 or 20 (p49).
        criticalHitMinimum: 19,
      },
    },
    {
      level: 5,
      entity: fighterAt(5),
      expected: {
        ...ALWAYS,
        // Level 4, Ability Score Improvement: Str 17 + 1 = 18, Con 15 + 1 = 16 (p87).
        abilities: { str: 18, dex: 13, con: 16, int: 8, wis: 12, cha: 10 },
        // 18 -> 4, 16 -> 3 (p6).
        abilityModifiers: { str: 4, dex: 1, con: 3, int: -1, wis: 1, cha: 0 },
        // Level 5: +3 (p47).
        proficiencyBonus: 3,
        // 10 + 6 x 4 = 34, + Con 3 x 5 = 15, + 5 = 54 (p47, p84).
        maxHitPoints: 54,
        // One d10 for each Fighter level (p47).
        hitPointDice: { d10: 5 },
        // Saves (p47, p22): Str 4 + 3 = 7, Con 3 + 3 = 6.
        saveBonuses: { str: 7, dex: 1, con: 6, int: -1, wis: 1, cha: 0 },
        // 10 + Wis 1 + PB 3 = 14 (p22).
        passivePerception: 14,
        // Extra Attack: two attacks (p48).
        attacksPerAction: 2,
        // Improved Critical: 19 or 20 until level 15 (p49).
        criticalHitMinimum: 19,
        // Weapon Mastery column of the Fighter Features table (p47): 3, 4 from level 4, 5 from 10, 6 from 16.
        weaponMasteries: ["srd52:greatsword", "srd52:longbow", "srd52:flail", "srd52:dagger"],
      },
    },
    {
      level: 11,
      entity: fighterAt(11),
      expected: {
        ...ALWAYS,
        // Level 6: Str 18 + 2 = 20. Level 8: Con 16 + 2 = 18 (p87).
        abilities: { str: 20, dex: 13, con: 18, int: 8, wis: 12, cha: 10 },
        // 20 -> 5, 18 -> 4 (p6).
        abilityModifiers: { str: 5, dex: 1, con: 4, int: -1, wis: 1, cha: 0 },
        // Levels 9 to 12: +4 (p47).
        proficiencyBonus: 4,
        // 10 + 6 x 10 = 70, + Con 4 x 11 = 44, + 11 = 125 (p47, p84).
        maxHitPoints: 125,
        // One d10 for each Fighter level (p47).
        hitPointDice: { d10: 11 },
        // Saves: Str 5 + PB 4 = 9, Con 4 + PB 4 = 8; the others are the modifier (p47, p22).
        saveBonuses: { str: 9, dex: 1, con: 8, int: -1, wis: 1, cha: 0 },
        // 10 + Wis 1 + PB 4 = 15 (p22).
        passivePerception: 15,
        // Str 20 x 15 = 300; x 30 = 600 (p178).
        carryingCapacity: 300,
        dragLiftPush: 600,
        // Two Extra Attacks: three attacks (p48).
        attacksPerAction: 3,
        // Improved Critical: 19 or 20 until level 15 (p49).
        criticalHitMinimum: 19,
        // Weapon Mastery column of the Fighter Features table (p47): 3, 4 from level 4, 5 from 10, 6 from 16.
        weaponMasteries: ["srd52:greatsword", "srd52:longbow", "srd52:flail", "srd52:dagger", "srd52:longsword"],
        // Archery from level 7: +2 to attack rolls with Ranged weapons (p87).
        rangedAttackBonus: 2,
        weaponAttacks: [
          // Str 5 + PB 4 = +9; 2d6 + 5 (p89, p91).
          {
            weapon: "srd52:greatsword",
            name: "Greatsword",
            attackBonus: 9,
            damage: "2d6+5",
            damageType: "srd52:slashing",
            properties: ["heavy", "two-handed"],
            mastery: "graze",
            disadvantage: false,
          },
          // Dex 1 + PB 4 + Archery 2 = +7; 1d8 + 1 (p87, p89, p91).
          {
            weapon: "srd52:longbow",
            name: "Longbow",
            attackBonus: 7,
            damage: "1d8+1",
            damageType: "srd52:piercing",
            properties: ["ammunition", "heavy", "two-handed"],
            range: [150, 600],
            mastery: "slow",
            disadvantage: false,
          },
        ],
      },
    },
    {
      level: 20,
      entity: fighterAt(20),
      expected: {
        ...ALWAYS,
        // Level 12: Con 18 + 2 = 20. Level 14, Grappler: Dex 13 + 1 = 14. Level 16: Wis 12 + 2 = 14 (p87).
        // Level 19, Boon of Irresistible Offense: Str 20 + 1 = 21, above 20 (p88).
        abilities: { str: 21, dex: 14, con: 20, int: 8, wis: 14, cha: 10 },
        // 21 -> 5, 14 -> 2, 20 -> 5 (p6).
        abilityModifiers: { str: 5, dex: 2, con: 5, int: -1, wis: 2, cha: 0 },
        // Levels 17 to 20: +6 (p47).
        proficiencyBonus: 6,
        // 10 + 6 x 19 = 124, + Con 5 x 20 = 100, + 20 = 244 (p47, p84).
        maxHitPoints: 244,
        // One d10 for each Fighter level (p47).
        hitPointDice: { d10: 20 },
        // Saves (p47, p22): Str 5 + 6 = 11, Con 5 + 6 = 11.
        saveBonuses: { str: 11, dex: 2, con: 11, int: -1, wis: 2, cha: 0 },
        // Proficient: Athletics 5 + 6 = 11, Intimidation 0 + 6 = 6, Perception 2 + 6 = 8, Survival 2 + 6 = 8. The others are the modifier (p14, p22).
        skillBonuses: {
          acrobatics: 2,
          "animal-handling": 2,
          arcana: -1,
          athletics: 11,
          deception: 0,
          history: -1,
          insight: 2,
          intimidation: 6,
          investigation: -1,
          medicine: 2,
          nature: -1,
          perception: 8,
          performance: 0,
          persuasion: 0,
          religion: -1,
          "sleight-of-hand": 2,
          stealth: 2,
          survival: 8,
        },
        // 10 + Perception 8 = 18 (p22).
        passivePerception: 18,
        // Initiative: the Dexterity modifier, 2 (p22).
        initiative: 2,
        // Str 21 x 15 = 315; x 30 = 630 (p178).
        carryingCapacity: 315,
        dragLiftPush: 630,
        // Three Extra Attacks: four attacks (p48).
        attacksPerAction: 4,
        // Superior Critical: 18 to 20 (p49).
        criticalHitMinimum: 18,
        // Weapon Mastery column of the Fighter Features table (p47): 3, 4 from level 4, 5 from 10, 6 from 16.
        weaponMasteries: MASTERIES,
        weaponAttacks: [
          // Str 5 + PB 6 = +11; 2d6 + 5 (p89, p91).
          {
            weapon: "srd52:greatsword",
            name: "Greatsword",
            attackBonus: 11,
            damage: "2d6+5",
            damageType: "srd52:slashing",
            properties: ["heavy", "two-handed"],
            mastery: "graze",
            disadvantage: false,
          },
          // Dex 2 + PB 6 + Archery 2 = +10; 1d8 + 2 (p87, p89, p91).
          {
            weapon: "srd52:longbow",
            name: "Longbow",
            attackBonus: 10,
            damage: "1d8+2",
            damageType: "srd52:piercing",
            properties: ["ammunition", "heavy", "two-handed"],
            range: [150, 600],
            mastery: "slow",
            disadvantage: false,
          },
        ],
      },
    },
  ],
});
