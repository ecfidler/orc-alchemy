// The kind of each value of the built 2024 character, for the effects of
// the content format. An effect names a sheet value by its name, so the
// converter checks the name and the kind: `add` needs a number, and `push`
// needs a list. The `satisfies` clause makes the table complete.

import type { Built2024 } from "./built.ts";

export type SheetValueKind = "number" | "string" | "boolean" | "list" | "record" | "nullable";

export const SHEET_VALUES = {
  name: "string",
  species: "nullable",
  creatureType: "string",
  size: "string",
  speed: "number",
  darkvision: "number",
  background: "nullable",
  baseAbilities: "record",
  abilityIncreases: "list",
  abilities: "record",
  abilityModifiers: "record",
  classes: "list",
  classLevels: "record",
  subclasses: "record",
  hitDice: "record",
  totalLevel: "number",
  proficiencyBonus: "number",
  hitPointsFromLevels: "number",
  maxHitPoints: "number",
  savingThrowProficiencies: "list",
  saveBonuses: "record",
  skillProficiencies: "list",
  skillBonuses: "record",
  passivePerception: "number",
  toolProficiencies: "list",
  weaponProficiencies: "list",
  armorTraining: "list",
  languages: "list",
  resistances: "list",
  feats: "list",
  features: "list",
  wornArmor: "nullable",
  shield: "boolean",
  unarmoredArmorClass: "number",
  armorClass: "number",
  initiative: "number",
  weaponMasteries: "list",
  weapons: "list",
  rangedAttackBonus: "number",
  attacksPerAction: "number",
  criticalHitMinimum: "number",
  weaponAttacks: "list",
} as const satisfies Record<keyof Built2024, SheetValueKind>;

export type SheetValueName = keyof typeof SHEET_VALUES;

export function isSheetValue(name: string): name is SheetValueName {
  return Object.hasOwn(SHEET_VALUES, name);
}
