// The built 2024 character and its base: the values before any choice, the
// values derived from others, and the rules that every character has
// (ORC-225). This file is the 2024 counterpart of
// dnd/e5/template_base.cljc. The names are 2024 names: `species`, not
// `race`.

import type { z } from "zod";
import { type Base, type Modifier, modifiersFor } from "../core/modifiers.ts";
import { nameToKey } from "../core/template.ts";
import { referenceTo, SRD_PACK } from "../format/keys.ts";
import { ABILITY_KEYS, type FEAT_CATEGORIES, type Recovery as RecoverySchema, Size as SizeSchema } from "../format/schema.ts";
import { ARMOR } from "./content/armor.ts";
import { WEAPONS, type WeaponMastery } from "./content/weapons.ts";

// The words that the content format also uses come from its schema, so that the two cannot differ.

export const ABILITIES = ABILITY_KEYS;
export type Ability = (typeof ABILITIES)[number];
/** The sizes of a creature (SRD 5.2.1 p176). */
export type Size = z.infer<typeof SizeSchema>;

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

export type FeatCategory = (typeof FEAT_CATEGORIES)[number];

export interface FeatTaken {
  key: string;
  name: string;
  category: FeatCategory;
}

/** What a rest restores: a number of uses, or all of them (the `recover` of the content format). */
export type Recovery = z.infer<typeof RecoverySchema>;

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

/**
 * A way to calculate the base Armor Class without armor: `base` plus the
 * modifiers of `abilities`. Unarmored Defense is one (SRD 5.2.1 p28).
 */
export interface ArmorClassFormula {
  key: string;
  name: string;
  base: number;
  abilities: readonly Ability[];
  /** False when the formula does not apply with a Shield, as for the Monk (SRD 5.2.1 p50). */
  shield: boolean;
}

/** The base calculation of every character: 10 plus the Dexterity modifier (SRD 5.2.1 p177). */
export const UNARMORED: ArmorClassFormula = { key: "unarmored", name: "Unarmored: 10 + Dexterity modifier", base: 10, abilities: ["dex"], shield: true };

/** The key of `armorClassFormula` when the character wears armor. */
export const WORN_ARMOR = "armor";

export function formulaValue(formula: ArmorClassFormula, modifiers: AbilityScores): number {
  return formula.abilities.reduce((sum, ability) => sum + modifiers[ability], formula.base);
}

/** The modifier that gives `baseArmorClass` when `formula` is the base calculation in use. */
export function formulaModifier(formula: ArmorClassFormula): Modifier<Built2024> {
  return m.add("baseArmorClass", (q) => formulaValue(formula, q("abilityModifiers")), {
    deps: ["abilityModifiers", "armorClassFormula"],
    when: (q) => q("armorClassFormula") === formula.key,
    name: formula.name,
  });
}

/**
 * A spell that a trait gives, always prepared, with the ability of its
 * casts. ORC-229 adds the spells of the classes, the slots and the lists.
 */
export interface GrantedSpell {
  /** The spell reference, for example `srd52:misty-step`. */
  spell: string;
  /** The reference of the record that gives it. */
  source: string;
  ability: Ability;
  /** The casts without a spell slot, when the trait gives some. */
  uses?: Uses;
}

/** An attack that forces a saving throw, such as Breath Weapon (SRD 5.2.1 p84). */
export interface SavingThrowAttack {
  key: string;
  name: string;
  source: string;
  save: Ability;
  dc: number;
  /** For example "2d10". */
  damage: string;
  /** A damage type reference, for example `srd52:fire`. */
  damageType: string;
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
  /** The key of the lineage, legacy or ancestry chosen in the species, for example "drow". */
  lineage: string | null;
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

  /**
   * The Hit Points of each level without the Constitution modifier: the
   * full die at level 1 of the first class, then the fixed or rolled number.
   */
  hitPointsPerLevel: readonly number[];
  /** The number of Hit Point Dice of each size, for example `{ d10: 3 }`. */
  hitPointDice: Readonly<Record<string, number>>;
  maxHitPoints: number;

  savingThrowProficiencies: readonly Ability[];
  saveBonuses: AbilityScores;
  skillProficiencies: readonly Skill[];
  /** The skills with Expertise. Expertise counts only with the proficiency. */
  expertise: readonly Skill[];
  skillBonuses: Readonly<Record<Skill, number>>;
  passivePerception: number;
  toolProficiencies: readonly string[];
  /** Weapon categories: "simple" and "martial". */
  weaponProficiencies: readonly string[];
  /** Armor categories: "light", "medium", "heavy" and "shield". */
  armorTraining: readonly string[];
  /** Language references, for example `srd52:common`. */
  languages: readonly string[];
  resistances: readonly string[];

  /** Sizes above the character's size for the carrying capacity: 1 for Powerful Build (SRD 5.2.1 p86). */
  carryingSizeBonus: number;
  /** Pounds. */
  carryingCapacity: number;
  /** Pounds. */
  dragLiftPush: number;

  feats: readonly FeatTaken[];
  features: readonly Feature[];
  spells: readonly GrantedSpell[];

  wornArmor: string | null;
  shield: boolean;
  /**
   * True when the character wears Light, Medium or Heavy armor without
   * training: Disadvantage on D20 Tests with Strength or Dexterity, and no
   * spellcasting (SRD 5.2.1 p92). The sheet shows it, and the spellcasting
   * of ORC-229 reads it.
   */
  armorWithoutTraining: boolean;
  /** The unarmored formulas that features give, beside `UNARMORED`. */
  armorClassFormulas: readonly ArmorClassFormula[];
  /** The key of the base calculation in use: `WORN_ARMOR`, or the key of the best unarmored formula that applies. */
  armorClassFormula: string;
  /**
   * The value of the base calculation in use. Its contribution names the
   * armor or the formula. The contributions of `armorClass` are the parts
   * after it, so the parts of the Armor Class are the two lists together.
   */
  baseArmorClass: number;
  /** The best formula without armor and without a shield. */
  unarmoredArmorClass: number;
  /** The base calculation, then the Shield and the other bonuses. */
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
  savingThrowAttacks: readonly SavingThrowAttack[];
}

/** The modifier constructors for the built 2024 character. */
export const m = modifiersFor<Built2024>();

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

/** The key of a feature, a formula or an attack of a source: the key of the source, then the key of the name. */
export function traitKey(source: string, name: string): string {
  return `${source}/${nameToKey(name)}`;
}

/** A feature with its key (`traitKey`). */
export function feature(source: string, name: string, summary: string, more: Pick<Feature, "level" | "uses"> = {}): Feature {
  return { key: traitKey(source, name), name, summary, source, ...more };
}

/** A value for each ability. */
export function forEachAbility(value: (ability: Ability) => number): AbilityScores {
  return Object.fromEntries(ABILITIES.map((ability) => [ability, value(ability)])) as AbilityScores;
}

/** The unarmored formulas of a character, the base calculation first. */
function unarmoredFormulas(formulas: readonly ArmorClassFormula[], shield: boolean): ArmorClassFormula[] {
  return [UNARMORED, ...formulas].filter((formula) => !shield || formula.shield);
}

/** The best formula of a list. On a tie, the first. */
function bestFormula(formulas: readonly ArmorClassFormula[], modifiers: AbilityScores): ArmorClassFormula {
  return formulas.reduce((best, formula) => (formulaValue(formula, modifiers) > formulaValue(best, modifiers) ? formula : best));
}

/** The Carry factor of each size; Drag/Lift/Push is two times it (SRD 5.2.1 p178). Small and Medium share a row. */
const CARRY_FACTORS: Readonly<Record<Size, number>> = { tiny: 7.5, small: 15, medium: 15, large: 30, huge: 60, gargantuan: 120 };

function carryFactor(size: Size, sizesAbove: number): number {
  const sizes = SizeSchema.options;
  return CARRY_FACTORS[sizes[Math.min(sizes.length - 1, sizes.indexOf(size) + sizesAbove)]];
}

function signed(bonus: number): string {
  return bonus === 0 ? "" : bonus > 0 ? `+${bonus}` : `${bonus}`;
}

export const base: Base<Built2024> = {
  name: "",
  species: null,
  lineage: null,
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

  hitPointsPerLevel: [],
  hitPointDice: m.derived(["classLevels", "hitDice"], (q) => {
    const dice: Record<string, number> = {};
    for (const [classRef, level] of Object.entries(q("classLevels"))) {
      const die = `d${q("hitDice")[classRef]}`;
      dice[die] = (dice[die] ?? 0) + level;
    }
    return dice;
  }),
  // Each level adds its number and the Constitution modifier, at least 1. The modifier counts for every level,
  // so a later increase raises earlier levels too (SRD 5.2.1 p23).
  maxHitPoints: m.derived(["hitPointsPerLevel", "abilityModifiers"], (q) =>
    q("hitPointsPerLevel").reduce((sum, hitPoints) => sum + Math.max(1, hitPoints + q("abilityModifiers").con), 0),
  ),

  savingThrowProficiencies: [],
  // The ability modifier. The Proficiency Bonus is a rule (RULES), so the contributions show it.
  saveBonuses: m.derived(["abilityModifiers"], (q) => q("abilityModifiers")),
  skillProficiencies: [],
  expertise: [],
  skillBonuses: m.derived(
    ["abilityModifiers"],
    (q) => Object.fromEntries(Object.entries(SKILLS).map(([skill, ability]) => [skill, q("abilityModifiers")[ability]])) as Record<Skill, number>,
  ),
  passivePerception: m.derived(["skillBonuses"], (q) => 10 + q("skillBonuses").perception),
  toolProficiencies: [],
  weaponProficiencies: [],
  armorTraining: [],
  // Every character knows Common (SRD 5.2.1 p20).
  languages: [referenceTo(SRD_PACK, "common")],
  resistances: [],

  carryingSizeBonus: 0,
  carryingCapacity: m.derived(["abilities", "size", "carryingSizeBonus"], (q) => q("abilities").str * carryFactor(q("size"), q("carryingSizeBonus"))),
  dragLiftPush: m.derived(["carryingCapacity"], (q) => q("carryingCapacity") * 2),

  feats: [],
  features: [],
  spells: [],

  wornArmor: null,
  shield: false,
  armorWithoutTraining: m.derived(["wornArmor", "armorTraining"], (q) => {
    const armor = ARMOR.find((a) => a.key === q("wornArmor"));
    return armor !== undefined && !q("armorTraining").includes(armor.category);
  }),
  armorClassFormulas: [],
  // A character uses one base calculation (SRD 5.2.1 p177). Worn armor gives its own. Without armor, the engine
  // takes the best formula that applies: a formula that does not allow a Shield does not apply with one.
  armorClassFormula: m.derived(["wornArmor", "shield", "armorClassFormulas", "abilityModifiers"], (q) =>
    q("wornArmor") !== null ? WORN_ARMOR : bestFormula(unarmoredFormulas(q("armorClassFormulas"), q("shield")), q("abilityModifiers")).key,
  ),
  // 0 until the modifier of the base calculation in use: the worn armor, UNARMORED in RULES, or the formula of a feature.
  baseArmorClass: 0,
  unarmoredArmorClass: m.derived(["armorClassFormulas", "abilityModifiers"], (q) =>
    formulaValue(bestFormula(unarmoredFormulas(q("armorClassFormulas"), false), q("abilityModifiers")), q("abilityModifiers")),
  ),
  armorClass: m.derived(["baseArmorClass"], (q) => q("baseArmorClass")),
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
  savingThrowAttacks: [],
};

/** Adds the Proficiency Bonus once to each entry of `keys` that `scores` has. */
function withBonus<K extends string>(scores: Readonly<Record<K, number>>, keys: readonly K[], bonus: number): Record<K, number> {
  const result: Record<K, number> = { ...scores };
  for (const key of new Set(keys)) if (key in result) result[key] += bonus;
  return result;
}

/**
 * The rules that every character has. They are modifiers, not derived
 * values, so that `contributions` shows them as parts of the value.
 */
export const RULES: readonly Modifier<Built2024>[] = [
  // SRD 5.2.1 p8: add the Proficiency Bonus to a saving throw or a check with the proficiency.
  m.update("saveBonuses", (scores, q) => withBonus(scores, q("savingThrowProficiencies"), q("proficiencyBonus")), {
    deps: ["savingThrowProficiencies", "proficiencyBonus"],
    when: (q) => q("savingThrowProficiencies").length > 0,
    name: "Proficiency Bonus",
  }),
  m.update("skillBonuses", (bonuses, q) => withBonus(bonuses, q("skillProficiencies"), q("proficiencyBonus")), {
    deps: ["skillProficiencies", "proficiencyBonus"],
    when: (q) => q("skillProficiencies").length > 0,
    name: "Proficiency Bonus",
  }),
  // SRD 5.2.1 p182: Expertise doubles the Proficiency Bonus of a skill with the proficiency, one time only.
  m.update(
    "skillBonuses",
    (bonuses, q) =>
      withBonus(
        bonuses,
        q("expertise").filter((skill) => q("skillProficiencies").includes(skill)),
        q("proficiencyBonus"),
      ),
    {
      deps: ["expertise", "skillProficiencies", "proficiencyBonus"],
      when: (q) => q("expertise").some((skill) => q("skillProficiencies").includes(skill)),
      name: "Expertise",
    },
  ),
  formulaModifier(UNARMORED),
];
