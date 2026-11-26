// The built 2024 character (ORC-225). This file and base-rules.ts are the
// 2024 counterpart of dnd/e5/template_base.cljc. base-rules.ts has the base
// (the values before any choice and the values derived from others) and the
// rules that every character has (`base`, `RULES`). The names are 2024
// names: `species`, not `race`.

import type { z } from "zod";
import { type Modifier, modifiersFor } from "../core/modifiers.ts";
import { nameToKey } from "../core/template.ts";
import { parseReference } from "../format/keys.ts";
import {
  ABILITY_KEYS,
  type Armor,
  type FEAT_CATEGORIES,
  type Recovery as RecoverySchema,
  type Size as SizeSchema,
  type WEAPON_MASTERIES,
  type Weapon,
} from "../format/schema.ts";

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
  /** The class whose spell list the spell came from, when the record lets the player choose a list (Magic Initiate). */
  list?: string;
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

/** A row of the armor table, for the armor that the character wears (SRD 5.2.1 p92). `key` is the reference of the record. */
export type ArmorStats = z.infer<typeof Armor> & { key: string; name: string };

/**
 * A row of the weapons table, for a weapon that the character uses (SRD
 * 5.2.1 p90 to p91). `key` is the reference of the record, and `damageType`
 * is the reference of the damage type record.
 */
export type WeaponStats = z.infer<typeof Weapon> & { key: string; name: string; damageType: string };

export type WeaponMastery = (typeof WEAPON_MASTERIES)[number];

/** An item that the character carries. `source` is the record whose starting equipment gave it. */
export interface InventoryItem {
  /** The reference of the equipment record. */
  item: string;
  quantity: number;
  source?: string;
}

/** The attack line of a weapon that the character uses (SRD 5.2.1 p90). */
export interface WeaponAttack {
  /** The reference of the weapon record, or `UNARMED_STRIKE`. */
  weapon: string;
  name: string;
  attackBonus: number;
  /** For example "2d6+3". */
  damage: string;
  /** The damage with two hands, for a Versatile weapon. */
  versatileDamage?: string;
  /** A damage type reference, for example `srd52:slashing`. */
  damageType: string;
  /** Property keys, for example "finesse". */
  properties: readonly string[];
  /** Feet: the normal range and the long range, for a Ranged or Thrown weapon. */
  range?: readonly [number, number];
  /** The mastery property, when the character has the mastery of the weapon. */
  mastery: WeaponMastery | null;
  /** True for a Heavy weapon without Strength 13 (Melee) or Dexterity 13 (Ranged): Disadvantage on the attack rolls (SRD 5.2.1 p89). */
  disadvantage: boolean;
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
  /**
   * Class key to the class columns of the table row at its class level, for
   * example `{ "rage-damage-bonus": 2 }` or `{ "sneak-attack": "1d6" }`.
   */
  classColumns: Readonly<Record<string, Readonly<Record<string, number | string>>>>;
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
  /** The spellcasting ability that the player chose for the spells of a record, by a key of that record. */
  spellcastingAbilities: Readonly<Record<string, Ability>>;

  /** The reference of the worn armor. */
  wornArmor: string | null;
  /** The armor table row of the worn armor. */
  wornArmorStats: ArmorStats | null;
  /** The category of the worn armor, for a rule such as "while you aren't wearing Heavy armor" (SRD 5.2.1 p29). */
  wornArmorCategory: ArmorStats["category"] | null;
  /** True when the worn armor gives Disadvantage on Dexterity (Stealth) checks (SRD 5.2.1 p92). */
  stealthDisadvantage: boolean;
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

  /** The references of the weapons whose mastery properties the character can use. */
  weaponMasteries: readonly string[];
  /** The weapons that the character uses. */
  weapons: readonly WeaponStats[];
  /** Added to attack rolls with Ranged weapons. */
  rangedAttackBonus: number;
  attacksPerAction: number;
  /**
   * The die of Martial Arts, for example 6 for 1d6, or 0 without Martial
   * Arts (SRD 5.2.1 p50). Without armor and a Shield, the Monk weapons and
   * the Unarmed Strike use it: see `weaponAttacks`.
   */
  martialArtsDie: number;
  /** The lowest d20 roll that is a Critical Hit. */
  criticalHitMinimum: number;
  weaponAttacks: readonly WeaponAttack[];
  savingThrowAttacks: readonly SavingThrowAttack[];

  /** The items that the character carries. */
  inventory: readonly InventoryItem[];
  /** Gold pieces. */
  gold: number;
  /** The tools that the player chose in the typed tool field of a record, by the reference of the record. Starting equipment reads them. */
  chosenTools: Readonly<Record<string, readonly string[]>>;
}

/** The modifier constructors for the built 2024 character. */
export const m = modifiersFor<Built2024>();

/**
 * The `order` of an `add` to a value that a `set` can change, for example
 * the Speed of a species: after the modifiers of the same value that have
 * no order, so that the `set` does not hide the `add`.
 */
export const ADD_ORDER = 1;

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

function signed(bonus: number): string {
  return bonus === 0 ? "" : bonus > 0 ? `+${bonus}` : `${bonus}`;
}

/** Whether the character has proficiency with a weapon: by its category, or by the weapon itself, as the Rogue has with the Rapier. */
export function isProficient(weapon: Pick<WeaponStats, "key" | "category">, proficiencies: readonly string[]): boolean {
  return proficiencies.includes(weapon.category) || proficiencies.includes(weapon.key) || proficiencies.includes(parseReference(weapon.key).key);
}

function dice({ count, die }: { count: number; die: number }): string {
  return die === 1 ? `${count}` : `${count}d${die}`;
}

/** The `weapon` of the Unarmed Strike line of Martial Arts. It is not a reference, because no record has it. */
export const UNARMED_STRIKE = "unarmed-strike";

/** A Monk weapon: a Simple Melee weapon, or a Martial Melee weapon that has the Light property (SRD 5.2.1 p50). */
export function isMonkWeapon(weapon: Pick<WeaponStats, "category" | "ranged" | "properties">): boolean {
  return !weapon.ranged && (weapon.category === "simple" || weapon.properties.includes("light"));
}

/** The score that a Heavy weapon needs: Strength for a Melee weapon, Dexterity for a Ranged weapon (SRD 5.2.1 p89). */
const HEAVY_MINIMUM = 13;

/**
 * The attack line of a weapon (SRD 5.2.1 p89, p90, p177). A Finesse weapon
 * uses the better of Strength and Dexterity, a Ranged weapon Dexterity,
 * and any other weapon Strength. The Dart is Ranged and Finesse, so Finesse
 * comes first. The ability modifier adds to the attack roll and to the
 * damage, and the Proficiency Bonus adds to the attack roll only.
 */
export function weaponAttack(
  weapon: WeaponStats,
  scores: AbilityScores,
  proficiency: number,
  { rangedBonus, mastery, martialArtsDie = 0 }: { rangedBonus: number; mastery: boolean; martialArtsDie?: number },
): WeaponAttack {
  const str = abilityModifier(scores.str);
  const dex = abilityModifier(scores.dex);
  // Martial Arts (p50): a Monk weapon can use Dexterity, and the Martial Arts die in place of a smaller die.
  const martialArts = martialArtsDie > 0 && isMonkWeapon(weapon);
  const ability = weapon.properties.includes("finesse") || martialArts ? Math.max(str, dex) : weapon.ranged ? dex : str;
  const damageDie = (roll: { count: number; die: number }) =>
    martialArts && roll.count === 1 && martialArtsDie > roll.die ? { count: 1, die: martialArtsDie } : roll;
  const heavyScore = weapon.ranged ? scores.dex : scores.str;
  return {
    weapon: weapon.key,
    name: weapon.name,
    attackBonus: ability + proficiency + (weapon.ranged ? rangedBonus : 0),
    damage: `${dice(damageDie(weapon.damage))}${signed(ability)}`,
    ...(weapon.versatile ? { versatileDamage: `${dice(damageDie(weapon.versatile))}${signed(ability)}` } : {}),
    damageType: weapon.damageType,
    properties: weapon.properties,
    ...(weapon.range ? { range: weapon.range } : {}),
    mastery: mastery ? weapon.mastery : null,
    disadvantage: weapon.properties.includes("heavy") && heavyScore < HEAVY_MINIMUM,
  };
}

/**
 * The Unarmed Strike with Martial Arts (SRD 5.2.1 p50): the better of
 * Strength and Dexterity, the Proficiency Bonus (p190), and the Martial
 * Arts die in place of the 1 of an Unarmed Strike. Bludgeoning damage.
 */
export function unarmedStrike(scores: AbilityScores, proficiency: number, martialArtsDie: number): WeaponAttack {
  const ability = Math.max(abilityModifier(scores.str), abilityModifier(scores.dex));
  return {
    weapon: UNARMED_STRIKE,
    name: "Unarmed Strike",
    attackBonus: ability + proficiency,
    damage: `${dice({ count: 1, die: martialArtsDie })}${signed(ability)}`,
    damageType: "srd52:bludgeoning",
    properties: [],
    mastery: null,
    disadvantage: false,
  };
}
