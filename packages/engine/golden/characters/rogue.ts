// The golden Rogue (ORC-252): a Halfling Criminal Rogue, Thief, at levels
// 1, 3 and 20. The Rogue is SRD 5.2.1 p61 to p64, the Halfling p85, the
// Criminal p83, the feats p87 to p88, the languages p20, the armor and
// weapons p89 to p92, the carrying capacity p178.
//
// The choices:
//   Standard Array (p21): Str 10, Dex 15, Con 14, Int 12, Wis 13, Cha 8.
//   Criminal (p83): Dex +2, Int +1, so Dex 17, Int 13; Alert; Sleight of Hand, Stealth; Thieves' Tools.
//   Rogue skills: Acrobatics, Deception, Investigation, Perception.
//   Expertise: Stealth and Sleight of Hand, then Perception and Acrobatics at level 6.
//   Languages: Halfling and Elvish; Thieves' Cant and Goblin from the Rogue.
//   Weapon Mastery: the Rapier and the Shortbow. Leather Armor, a Rapier and a Shortbow.
//   Level 3: Thief.
//   Level 4, Ability Score Improvement: Dex +1, Con +1 (Dex 18, Con 15).
//   Level 8, Ability Score Improvement: Dex +2 (Dex 20).
//   Level 10, Ability Score Improvement: Con +1, Wis +1 (Con 16, Wis 14).
//   Level 12, Ability Score Improvement: Con +2 (Con 18).
//   Level 16, Ability Score Improvement: Int +1, Wis +1 (Int 14, Wis 15).
//   Level 19, Epic Boon: Boon of the Night Spirit, Dex +1 (the maximum is 30).
//
// Hit Points (p61, p23): 8 at level 1, then the fixed 5 for each level,
// + the current Con modifier for each level (p23).

import type { StrictSelection } from "../../src/core/entity.ts";
import type { Entity2024 } from "../../src/rules2024/evaluate.ts";
import { classLevels, plusOneAndOne, plusTwo } from "../choices.ts";
import { defineGolden } from "../define.ts";

/** The choices at each Rogue level that has one. */
const LEVEL_CHOICES: Record<number, StrictSelection[]> = {
  1: [
    { key: "expertise", options: [{ key: "stealth" }, { key: "sleight-of-hand" }] },
    { key: "thieves-cant", option: { key: "srd52:goblin" } },
  ],
  3: [{ key: "subclass", option: { key: "srd52:thief" } }],
  4: [{ key: "ability-score-improvement", option: plusOneAndOne("dex", "con") }],
  6: [{ key: "expertise", options: [{ key: "perception" }, { key: "acrobatics" }] }],
  8: [{ key: "ability-score-improvement", option: plusTwo("dex") }],
  10: [{ key: "ability-score-improvement", option: plusOneAndOne("con", "wis") }],
  12: [{ key: "ability-score-improvement", option: plusTwo("con") }],
  16: [{ key: "ability-score-improvement", option: plusOneAndOne("int", "wis") }],
  19: [{ key: "epic-boon", option: { key: "srd52:boon-of-the-night-spirit", selections: [{ key: "ability", option: { key: "dex" } }] } }],
};

export function rogueAt(level: number): Entity2024 {
  const levels = classLevels(level, (n) => LEVEL_CHOICES[n] ?? []);
  return {
    values: { name: "Pip" },
    selections: [
      { key: "ability-scores", option: { key: "standard-array", value: { str: 10, dex: 15, con: 14, int: 12, wis: 13, cha: 8 } } },
      {
        key: "class",
        options: [
          {
            key: "srd52:rogue",
            selections: [
              { key: "skill-proficiencies", options: [{ key: "acrobatics" }, { key: "deception" }, { key: "investigation" }, { key: "perception" }] },
              { key: "starting-equipment", option: { key: "a" } },
              { key: "levels", options: levels },
            ],
          },
        ],
      },
      { key: "species", option: { key: "srd52:halfling" } },
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
                  { key: "plus-one", option: { key: "int" } },
                ],
              },
            },
            { key: "starting-equipment", option: { key: "b" } },
          ],
        },
      },
      { key: "languages", options: [{ key: "srd52:halfling" }, { key: "srd52:elvish" }] },
      { key: "weapon-mastery", options: [{ key: "srd52:rapier" }, { key: "srd52:shortbow" }] },
      { key: "armor", option: { key: "srd52:leather-armor" } },
      { key: "weapons", options: [{ key: "srd52:rapier" }, { key: "srd52:shortbow" }] },
    ],
  };
}

/** The values that are the same at each checked level. */
const ALWAYS = {
  // The Halfling: Small, Speed 30 feet, no Darkvision (p85).
  size: "small",
  speed: 30,
  darkvision: 0,
  resistances: [],
  // Rogue: Acrobatics, Deception, Investigation, Perception. Criminal: Sleight of Hand, Stealth (p61, p83).
  skillProficiencies: ["acrobatics", "deception", "investigation", "perception", "sleight-of-hand", "stealth"],
  // Simple weapons and Martial weapons that have the Finesse or Light property; Light armor (p61).
  weaponProficiencies: ["simple", "rapier", "scimitar", "shortsword", "whip", "hand-crossbow"],
  armorTraining: ["light"],
  // Thieves' Tools from the Rogue and from the Criminal: one proficiency (p61, p83).
  toolProficiencies: ["srd52:thieves-tools"],
  // Common; Thieves' Cant and one other language (p62); the two Standard Languages of the choice (p20).
  languages: ["srd52:common", "srd52:thieves-cant", "srd52:goblin", "srd52:halfling", "srd52:elvish"],
  // Leather Armor: Light, 11 + Dex (p92).
  wornArmor: "srd52:leather-armor",
  wornArmorCategory: "light",
  // Weapon Mastery: two kinds of weapons with proficiency; the Rogue has no more (p61, p62).
  weaponMasteries: ["srd52:rapier", "srd52:shortbow"],
  // One attack at every level: the Rogue has no Extra Attack (p62).
  attacksPerAction: 1,
  // Small: Str 10 x 15 = 150; drag, lift or push: x 30 = 300 (p178).
  carryingCapacity: 150,
  dragLiftPush: 300,
  // Rogue starting equipment A: 8 GP. Criminal B: 50 GP (p61, p83). 8 + 50 = 58.
  gold: 58,
} as const;

/** The Rapier, Finesse, and the Shortbow, Ranged: Dex for both. Rapier 1d8 Piercing, Vex; Shortbow 1d6 Piercing, 80/320, Vex (p90, p91). */
function attacks(bonus: number, dex: number) {
  return [
    {
      weapon: "srd52:rapier",
      name: "Rapier",
      attackBonus: bonus,
      damage: `1d8+${dex}`,
      damageType: "srd52:piercing",
      properties: ["finesse"],
      mastery: "vex",
      disadvantage: false,
    },
    {
      weapon: "srd52:shortbow",
      name: "Shortbow",
      attackBonus: bonus,
      damage: `1d6+${dex}`,
      damageType: "srd52:piercing",
      properties: ["ammunition", "two-handed"],
      range: [80, 320],
      mastery: "vex",
      disadvantage: false,
    },
  ] as const;
}

/** The skills at a level with PB 2 and Str 0, Dex 3, Int 1, Wis 1, Cha -1: levels 1 and 3. */
const SKILLS_TIER_ONE = {
  // Proficient: Acrobatics 3 + 2 = 5, Deception -1 + 2 = 1, Investigation 1 + 2 = 3, Perception 1 + 2 = 3.
  // Expertise (two times the PB, p182): Sleight of Hand and Stealth 3 + 4 = 7. The others are the modifier (p14, p22).
  acrobatics: 5,
  "animal-handling": 1,
  arcana: 1,
  athletics: 0,
  deception: 1,
  history: 1,
  insight: 1,
  intimidation: -1,
  investigation: 3,
  medicine: 1,
  nature: 1,
  perception: 3,
  performance: -1,
  persuasion: -1,
  religion: 1,
  "sleight-of-hand": 7,
  stealth: 7,
  survival: 1,
};

/** The values of levels 1 and 3, which have the same scores and Proficiency Bonus. */
const TIER_ONE = {
  // Dex 15 + 2 = 17, Int 12 + 1 = 13 (p83).
  abilities: { str: 10, dex: 17, con: 14, int: 13, wis: 13, cha: 8 },
  // (score - 10) / 2, rounded down (p6): 10 -> 0, 17 -> 3, 14 -> 2, 13 -> 1, 13 -> 1, 8 -> -1.
  abilityModifiers: { str: 0, dex: 3, con: 2, int: 1, wis: 1, cha: -1 },
  // Rogue Features table, levels 1 to 4: +2 (p62).
  proficiencyBonus: 2,
  // Leather Armor 11 + Dex 3 = 14 (p92).
  armorClass: 14,
  // Saving throws: Dexterity and Intelligence (p61). Dex 3 + 2 = 5, Int 1 + 2 = 3; the others are the modifier (p22).
  savingThrowProficiencies: ["dex", "int"],
  saveBonuses: { str: 0, dex: 5, con: 2, int: 3, wis: 1, cha: -1 },
  // Expertise at level 1: Stealth and Sleight of Hand (p61).
  expertise: ["stealth", "sleight-of-hand"],
  skillBonuses: SKILLS_TIER_ONE,
  // 10 + Perception 3 (p22).
  passivePerception: 13,
  // Dex 3 + Alert: the Proficiency Bonus 2 = 5 (p22, p87).
  initiative: 5,
  // Rapier and Shortbow: Dex 3 + PB 2 = +5; 1d8 + 3 and 1d6 + 3 (p89 to p91).
  weaponAttacks: attacks(5, 3),
} as const;

export const rogue = defineGolden({
  name: "Rogue (Halfling Criminal, Thief)",
  checks: [
    {
      level: 1,
      entity: rogueAt(1),
      expected: {
        ...ALWAYS,
        ...TIER_ONE,
        // 8 + Con 2 = 10 (p61, p23).
        maxHitPoints: 10,
        // One d8 Hit Point Die for each Rogue level (p61).
        hitPointDice: { d8: 1 },
        subclasses: {},
        // Sneak Attack column, level 1: 1d6 (p62).
        classColumns: { "srd52:rogue": { "sneak-attack": "1d6" } },
      },
    },
    {
      level: 3,
      entity: rogueAt(3),
      expected: {
        ...ALWAYS,
        ...TIER_ONE,
        // 8 + 5 + 5 = 18, + Con 2 x 3 = 6, = 24 (p61, p23).
        maxHitPoints: 24,
        // One d8 for each Rogue level (p61).
        hitPointDice: { d8: 3 },
        // Rogue Subclass at level 3: Thief (p62, p64).
        subclasses: { "srd52:rogue": "srd52:thief" },
        // Sneak Attack column, level 3: 2d6 (p62).
        classColumns: { "srd52:rogue": { "sneak-attack": "2d6" } },
      },
    },
    {
      level: 20,
      entity: rogueAt(20),
      expected: {
        ...ALWAYS,
        // Dex 17 + 1 + 2 = 20, then the Boon + 1 = 21 (max 30). Con 14 + 1 + 1 + 2 = 18. Int 13 + 1 = 14. Wis 13 + 1 + 1 = 15 (p87, p88).
        abilities: { str: 10, dex: 21, con: 18, int: 14, wis: 15, cha: 8 },
        // 21 -> 5, 18 -> 4, 14 -> 2, 15 -> 2 (p6).
        abilityModifiers: { str: 0, dex: 5, con: 4, int: 2, wis: 2, cha: -1 },
        // Levels 17 to 20: +6 (p62).
        proficiencyBonus: 6,
        // 8 + 5 x 19 = 103, + Con 4 x 20 = 80, = 183 (p61, p23).
        maxHitPoints: 183,
        // One d8 for each Rogue level (p61).
        hitPointDice: { d8: 20 },
        // Rogue Subclass at level 3: Thief (p62, p64).
        subclasses: { "srd52:rogue": "srd52:thief" },
        // Leather Armor 11 + Dex 5 = 16 (p92).
        armorClass: 16,
        // Slippery Mind at level 15: Wisdom and Charisma saves too (p63). Dex 5 + 6 = 11, Int 2 + 6 = 8, Wis 2 + 6 = 8, Cha -1 + 6 = 5.
        savingThrowProficiencies: ["dex", "int", "wis", "cha"],
        saveBonuses: { str: 0, dex: 11, con: 4, int: 8, wis: 8, cha: 5 },
        // Expertise at level 6: Perception and Acrobatics (p61).
        expertise: ["stealth", "sleight-of-hand", "perception", "acrobatics"],
        // Expertise: Acrobatics, Sleight of Hand and Stealth 5 + 12 = 17; Perception 2 + 12 = 14.
        // Proficient: Deception -1 + 6 = 5, Investigation 2 + 6 = 8. The others are the modifier (p14, p22, p182).
        skillBonuses: {
          acrobatics: 17,
          "animal-handling": 2,
          arcana: 2,
          athletics: 0,
          deception: 5,
          history: 2,
          insight: 2,
          intimidation: -1,
          investigation: 8,
          medicine: 2,
          nature: 2,
          perception: 14,
          performance: -1,
          persuasion: -1,
          religion: 2,
          "sleight-of-hand": 17,
          stealth: 17,
          survival: 2,
        },
        // 10 + Perception 14 (p22).
        passivePerception: 24,
        // Dex 5 + Alert 6 = 11 (p22, p87).
        initiative: 11,
        // Sneak Attack column, level 20: 10d6 (p62).
        classColumns: { "srd52:rogue": { "sneak-attack": "10d6" } },
        // Rapier and Shortbow: Dex 5 + PB 6 = +11; 1d8 + 5 and 1d6 + 5 (p89 to p91).
        weaponAttacks: attacks(11, 5),
      },
    },
  ],
});
