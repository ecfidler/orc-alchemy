// The built 2024 character and its base: the values before any choice, and
// the values derived from others. This file is the 2024 counterpart of
// dnd/e5/template_base.cljc, for the keys the Fighter slice needs. The
// names are 2024 names: `species`, not `race`.

import { type Base, modifiersFor } from "../core/modifiers.ts";
import { nameToKey } from "../core/template.ts";
import { ARMOR } from "./content/armor.ts";
import { WEAPONS, type WeaponMastery } from "./content/weapons.ts";

export const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Ability = (typeof ABILITIES)[number];
/** The sizes of a creature (SRD 5.2.1 p176). */
export type Size = "tiny" | "small" | "medium" | "large" | "huge" | "gargantuan";

export type AbilityScores = Readonly<Record<Ability, number>>;

/** Each skill and its ability (SRD 5.2.1 p9). */
export const SKILLS = {
  acrobatics: "dex",
  "animal-handling": "wis",
  arcana: "int",
  athletics: "str",
  deception: "cha",
  history: "int",
  insight: "wis",
  intimidation: "cha",
  investigation: "int",
  medicine: "wis",
  nature: "int",
  perception: "wis",
  performance: "cha",
  persuasion: "cha",
  religion: "int",
  "sleight-of-hand": "dex",
  stealth: "dex",
  survival: "wis",
} as const satisfies Record<string, Ability>;
export type Skill = keyof typeof SKILLS;

/** An increase to one ability score. It cannot raise the score above `max`. */
export interface AbilityIncrease {
  ability: Ability;
  amount: number;
  max: number;
  source: string;
}

export type FeatCategory = "origin" | "general" | "fighting-style" | "epic-boon";

export interface FeatTaken {
  key: string;
  name: string;
  category: FeatCategory;
}

/** What a rest restores: a number of uses, or all of them (the `recover` of the content format). */
export interface Recovery {
  on: "short-rest" | "long-rest";
  amount: number | "all";
}

/**
 * The uses of a feature and how they come back. A 2024 feature can have two
 * rules: Second Wind regains one use on a Short Rest and all on a Long Rest.
 */
export interface Uses {
  amount: number;
  recover: readonly Recovery[];
}

export interface Feature {
  key: string;
  name: string;
  summary: string;
  /** The key of the class, species, background or feat that grants it. */
  source: string;
  /** The class level that grants it, for a class feature. */
  level?: number;
  uses?: Uses;
}

export interface WeaponAttack {
  weapon: string;
  name: string;
  attackBonus: number;
  /** For example "2d6+3". */
  damage: string;
  damageType: string;
  /** The mastery property, when the character can use it. */
  mastery: WeaponMastery | null;
}

/** The built 2024 character: every value that `evaluate` computes from the choices. */
export interface Built2024 {
  name: string;
  species: string | null;
  creatureType: string;
  size: Size;
  /** Feet. */
  speed: number;
  /** Feet, 0 without Darkvision. */
  darkvision: number;
  background: string | null;

  baseAbilities: AbilityScores;
  abilityIncreases: readonly AbilityIncrease[];
  abilities: AbilityScores;
  abilityModifiers: AbilityScores;

  /** Class keys, the first class first. */
  classes: readonly string[];
  classLevels: Readonly<Record<string, number>>;
  /** Class key to subclass key. */
  subclasses: Readonly<Record<string, string>>;
  /** Class key to the size of its Hit Point Die. */
  hitDice: Readonly<Record<string, number>>;
  totalLevel: number;
  proficiencyBonus: number;

  /** The Hit Points from the class at each level, without the Constitution modifier. */
  hitPointsFromLevels: number;
  maxHitPoints: number;

  savingThrowProficiencies: readonly Ability[];
  saveBonuses: AbilityScores;
  skillProficiencies: readonly Skill[];
  skillBonuses: Readonly<Record<Skill, number>>;
  passivePerception: number;
  toolProficiencies: readonly string[];
  /** Weapon categories: "simple" and "martial". */
  weaponProficiencies: readonly string[];
  /** Armor categories: "light", "medium", "heavy" and "shield". */
  armorTraining: readonly string[];
  languages: readonly string[];
  resistances: readonly string[];

  feats: readonly FeatTaken[];
  features: readonly Feature[];

  wornArmor: string | null;
  shield: boolean;
  /** Without armor and without a shield. */
  unarmoredArmorClass: number;
  /** With the worn armor and shield. */
  armorClass: number;
  initiative: number;

  /** Weapon keys. */
  weaponMasteries: readonly string[];
  /** Carried weapon keys. */
  weapons: readonly string[];
  /** Added to attack rolls with Ranged weapons. */
  rangedAttackBonus: number;
  attacksPerAction: number;
  /** The lowest d20 roll that is a Critical Hit. */
  criticalHitMinimum: number;
  weaponAttacks: readonly WeaponAttack[];
}

/** The modifier constructors for the built 2024 character. */
export const m = modifiersFor<Built2024>();

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** A feature with its key: the key of its source, then the key of its name. */
export function feature(source: string, name: string, summary: string, more: Pick<Feature, "level" | "uses"> = {}): Feature {
  return { key: `${source}/${nameToKey(name)}`, name, summary, source, ...more };
}

/** A value for each ability. */
export function forEachAbility(value: (ability: Ability) => number): AbilityScores {
  return Object.fromEntries(ABILITIES.map((ability) => [ability, value(ability)])) as AbilityScores;
}

function signed(bonus: number): string {
  return bonus === 0 ? "" : bonus > 0 ? `+${bonus}` : `${bonus}`;
}

export const base: Base<Built2024> = {
  name: "",
  species: null,
  creatureType: "humanoid",
  size: "medium",
  speed: 30,
  darkvision: 0,
  background: null,

  baseAbilities: forEachAbility(() => 10),
  abilityIncreases: [],
  // Increases apply in the order of the choices. Each stops at its own maximum (SRD 5.2.1 p21, p87).
  abilities: m.derived(["baseAbilities", "abilityIncreases"], (q) => {
    const scores = { ...q("baseAbilities") };
    for (const { ability, amount, max } of q("abilityIncreases")) {
      scores[ability] = Math.max(scores[ability], Math.min(max, scores[ability] + amount));
    }
    return scores;
  }),
  abilityModifiers: m.derived(["abilities"], (q) => forEachAbility((ability) => abilityModifier(q("abilities")[ability]))),

  classes: [],
  classLevels: {},
  subclasses: {},
  hitDice: {},
  totalLevel: m.derived(["classLevels"], (q) => Object.values(q("classLevels")).reduce((sum, level) => sum + level, 0)),
  // SRD 5.2.1 p23.
  proficiencyBonus: m.derived(["totalLevel"], (q) => 2 + Math.floor((Math.max(q("totalLevel"), 1) - 1) / 4)),

  hitPointsFromLevels: 0,
  // The Constitution modifier counts for every level, so a later increase raises earlier levels too (SRD 5.2.1 p23).
  maxHitPoints: m.derived(
    ["hitPointsFromLevels", "totalLevel", "abilityModifiers"],
    (q) => q("hitPointsFromLevels") + q("totalLevel") * q("abilityModifiers").con,
  ),

  savingThrowProficiencies: [],
  saveBonuses: m.derived(["abilityModifiers", "savingThrowProficiencies", "proficiencyBonus"], (q) =>
    forEachAbility((ability) => q("abilityModifiers")[ability] + (q("savingThrowProficiencies").includes(ability) ? q("proficiencyBonus") : 0)),
  ),
  skillProficiencies: [],
  skillBonuses: m.derived(
    ["abilityModifiers", "skillProficiencies", "proficiencyBonus"],
    (q) =>
      Object.fromEntries(
        Object.entries(SKILLS).map(([skill, ability]) => [
          skill,
          q("abilityModifiers")[ability] + (q("skillProficiencies").includes(skill as Skill) ? q("proficiencyBonus") : 0),
        ]),
      ) as Record<Skill, number>,
  ),
  passivePerception: m.derived(["skillBonuses"], (q) => 10 + q("skillBonuses").perception),
  toolProficiencies: [],
  weaponProficiencies: [],
  armorTraining: [],
  languages: ["common"],
  resistances: [],

  feats: [],
  features: [],

  wornArmor: null,
  shield: false,
  unarmoredArmorClass: m.derived(["abilityModifiers"], (q) => 10 + q("abilityModifiers").dex),
  // SRD 5.2.1 p92: the armor gives the base, and a Shield adds 2.
  armorClass: m.derived(["wornArmor", "shield", "abilityModifiers", "unarmoredArmorClass"], (q) => {
    const armor = ARMOR.find((a) => a.key === q("wornArmor"));
    const dex = q("abilityModifiers").dex;
    const armored = armor ? armor.base + (armor.dexLimit === null ? dex : Math.min(dex, armor.dexLimit)) : q("unarmoredArmorClass");
    return armored + (q("shield") ? 2 : 0);
  }),
  initiative: m.derived(["abilityModifiers"], (q) => q("abilityModifiers").dex),

  weaponMasteries: [],
  weapons: [],
  rangedAttackBonus: 0,
  attacksPerAction: 1,
  criticalHitMinimum: 20,
  weaponAttacks: m.derived(["weapons", "abilityModifiers", "proficiencyBonus", "weaponProficiencies", "weaponMasteries", "rangedAttackBonus"], (q) =>
    q("weapons").flatMap((key) => {
      const weapon = WEAPONS.find((w) => w.key === key);
      if (!weapon) return [];
      const { str, dex } = q("abilityModifiers");
      const ability = weapon.ranged ? dex : weapon.properties.includes("finesse") ? Math.max(str, dex) : str;
      const proficiency = q("weaponProficiencies").includes(weapon.category) ? q("proficiencyBonus") : 0;
      const dice = weapon.damage.die === 1 ? `${weapon.damage.count}` : `${weapon.damage.count}d${weapon.damage.die}`;
      return [
        {
          weapon: weapon.key,
          name: weapon.name,
          attackBonus: ability + proficiency + (weapon.ranged ? q("rangedAttackBonus") : 0),
          damage: `${dice}${signed(ability)}`,
          damageType: weapon.damageType,
          mastery: q("weaponMasteries").includes(weapon.key) ? weapon.mastery : null,
        },
      ];
    }),
  ),
};
