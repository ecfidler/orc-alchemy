// The base values of the built 2024 character and the rules that every
// character has (ORC-225). built.ts has the types and the helpers.

import type { Base, Modifier } from "../core/modifiers.ts";
import { referenceTo, SRD_PACK } from "../format/keys.ts";
import { Size as SizeSchema } from "../format/schema.ts";
import {
  type AbilityScores,
  type ArmorClassFormula,
  abilityModifier,
  type Built2024,
  forEachAbility,
  formulaModifier,
  formulaValue,
  isProficient,
  m,
  type Size,
  SKILLS,
  type Skill,
  UNARMORED,
  unarmedStrike,
  WORN_ARMOR,
  weaponAttack,
} from "./built.ts";

/** The unarmored formulas of a character, the base calculation first. */
function unarmoredFormulas(formulas: readonly ArmorClassFormula[], shield: boolean): ArmorClassFormula[] {
  return [UNARMORED, ...formulas].filter((formula) => !shield || formula.shield);
}

/** The best unarmored formula that applies, with or without a Shield. On a tie, the first. */
function bestUnarmored(formulas: readonly ArmorClassFormula[], shield: boolean, modifiers: AbilityScores): ArmorClassFormula {
  return unarmoredFormulas(formulas, shield).reduce((best, formula) => (formulaValue(formula, modifiers) > formulaValue(best, modifiers) ? formula : best));
}

/** The Carry factor of each size; Drag/Lift/Push is two times it (SRD 5.2.1 p178). Small and Medium share a row. */
const CARRY_FACTORS: Readonly<Record<Size, number>> = { tiny: 7.5, small: 15, medium: 15, large: 30, huge: 60, gargantuan: 120 };

function carryFactor(size: Size, sizesAbove: number): number {
  const sizes = SizeSchema.options;
  return CARRY_FACTORS[sizes[Math.min(sizes.length - 1, sizes.indexOf(size) + sizesAbove)]];
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
  // Each increase stops at its own maximum (SRD 5.2.1 p21, p87). The increases with the lower maximum apply first,
  // so an Epic Boon (maximum 30) counts after the increases of character creation and of the other feats, whatever the
  // order of the choices.
  abilities: m.derived(["baseAbilities", "abilityIncreases"], (q) => {
    const scores = { ...q("baseAbilities") };
    for (const { ability, amount, max } of q("abilityIncreases").toSorted((a, b) => a.max - b.max)) {
      scores[ability] = Math.max(scores[ability], Math.min(max, scores[ability] + amount));
    }
    return scores;
  }),
  abilityModifiers: m.derived(["abilities"], (q) => forEachAbility((ability) => abilityModifier(q("abilities")[ability]))),

  classes: [],
  classLevels: {},
  subclasses: {},
  hitDice: {},
  classColumns: {},
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
  spellcastingAbilities: {},

  wornArmor: null,
  wornArmorStats: null,
  wornArmorCategory: m.derived(["wornArmorStats"], (q) => q("wornArmorStats")?.category ?? null),
  stealthDisadvantage: m.derived(["wornArmorStats"], (q) => q("wornArmorStats")?.stealthDisadvantage === true),
  shield: false,
  armorWithoutTraining: m.derived(["wornArmorStats", "armorTraining"], (q) => {
    const armor = q("wornArmorStats");
    return armor !== null && !q("armorTraining").includes(armor.category);
  }),
  armorClassFormulas: [],
  // A character uses one base calculation (SRD 5.2.1 p177). Worn armor gives its own. Without armor, the engine
  // takes the best formula that applies: a formula that does not allow a Shield does not apply with one.
  armorClassFormula: m.derived(["wornArmor", "shield", "armorClassFormulas", "abilityModifiers"], (q) =>
    q("wornArmor") !== null ? WORN_ARMOR : bestUnarmored(q("armorClassFormulas"), q("shield"), q("abilityModifiers")).key,
  ),
  // 0 until the modifier of the base calculation in use: the worn armor, UNARMORED in RULES, or the formula of a feature.
  baseArmorClass: 0,
  unarmoredArmorClass: m.derived(["armorClassFormulas", "abilityModifiers"], (q) =>
    formulaValue(bestUnarmored(q("armorClassFormulas"), false, q("abilityModifiers")), q("abilityModifiers")),
  ),
  armorClass: m.derived(["baseArmorClass"], (q) => q("baseArmorClass")),
  initiative: m.derived(["abilityModifiers"], (q) => q("abilityModifiers").dex),

  weaponMasteries: [],
  weapons: [],
  rangedAttackBonus: 0,
  attacksPerAction: 1,
  martialArtsDie: 0,
  criticalHitMinimum: 20,
  // Martial Arts applies without armor and a Shield (p50). It also gives the line of the Unarmed Strike.
  weaponAttacks: m.derived(
    ["weapons", "abilities", "proficiencyBonus", "weaponProficiencies", "weaponMasteries", "rangedAttackBonus", "martialArtsDie", "wornArmor", "shield"],
    (q) => {
      const martialArtsDie = q("wornArmor") === null && !q("shield") ? q("martialArtsDie") : 0;
      const attacks = q("weapons").map((weapon) =>
        weaponAttack(weapon, q("abilities"), isProficient(weapon, q("weaponProficiencies")) ? q("proficiencyBonus") : 0, {
          rangedBonus: q("rangedAttackBonus"),
          mastery: q("weaponMasteries").includes(weapon.key),
          martialArtsDie,
        }),
      );
      return martialArtsDie > 0 ? [...attacks, unarmedStrike(q("abilities"), q("proficiencyBonus"), martialArtsDie)] : attacks;
    },
  ),
  savingThrowAttacks: [],

  inventory: [],
  gold: 0,
  chosenTools: {},
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
