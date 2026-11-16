// The weapons table (SRD 5.2.1 p91). The mastery of each weapon is also in
// docs/kb/srd-5.2-rules-delta.md §B9, and weapons.test.ts compares the two.

import { nameToKey } from "../../core/template.ts";

export type WeaponMastery = "cleave" | "graze" | "nick" | "push" | "sap" | "slow" | "topple" | "vex";
export type WeaponProperty = "ammunition" | "finesse" | "heavy" | "light" | "loading" | "reach" | "thrown" | "two-handed" | "versatile";

export interface Weapon {
  key: string;
  name: string;
  category: "simple" | "martial";
  ranged: boolean;
  /** `die: 1` is a fixed amount, as for the Blowgun. */
  damage: { count: number; die: number };
  damageType: "bludgeoning" | "piercing" | "slashing";
  properties: readonly WeaponProperty[];
  mastery: WeaponMastery;
}

type Row = [name: string, damage: string, damageType: Weapon["damageType"], properties: readonly WeaponProperty[], mastery: WeaponMastery];

function rows(category: Weapon["category"], ranged: boolean, table: readonly Row[]): Weapon[] {
  return table.map(([name, damage, damageType, properties, mastery]) => {
    const [count, die = "1"] = damage.split("d");
    return {
      key: nameToKey(name),
      name,
      category,
      ranged,
      damage: { count: Number(count), die: Number(die) },
      damageType,
      properties,
      mastery,
    };
  });
}

export const WEAPONS: readonly Weapon[] = [
  ...rows("simple", false, [
    ["Club", "1d4", "bludgeoning", ["light"], "slow"],
    ["Dagger", "1d4", "piercing", ["finesse", "light", "thrown"], "nick"],
    ["Greatclub", "1d8", "bludgeoning", ["two-handed"], "push"],
    ["Handaxe", "1d6", "slashing", ["light", "thrown"], "vex"],
    ["Javelin", "1d6", "piercing", ["thrown"], "slow"],
    ["Light Hammer", "1d4", "bludgeoning", ["light", "thrown"], "nick"],
    ["Mace", "1d6", "bludgeoning", [], "sap"],
    ["Quarterstaff", "1d6", "bludgeoning", ["versatile"], "topple"],
    ["Sickle", "1d4", "slashing", ["light"], "nick"],
    ["Spear", "1d6", "piercing", ["thrown", "versatile"], "sap"],
  ]),
  ...rows("simple", true, [
    ["Dart", "1d4", "piercing", ["finesse", "thrown"], "vex"],
    ["Light Crossbow", "1d8", "piercing", ["ammunition", "loading", "two-handed"], "slow"],
    ["Shortbow", "1d6", "piercing", ["ammunition", "two-handed"], "vex"],
    ["Sling", "1d4", "bludgeoning", ["ammunition"], "slow"],
  ]),
  ...rows("martial", false, [
    ["Battleaxe", "1d8", "slashing", ["versatile"], "topple"],
    ["Flail", "1d8", "bludgeoning", [], "sap"],
    ["Glaive", "1d10", "slashing", ["heavy", "reach", "two-handed"], "graze"],
    ["Greataxe", "1d12", "slashing", ["heavy", "two-handed"], "cleave"],
    ["Greatsword", "2d6", "slashing", ["heavy", "two-handed"], "graze"],
    ["Halberd", "1d10", "slashing", ["heavy", "reach", "two-handed"], "cleave"],
    ["Lance", "1d10", "piercing", ["heavy", "reach", "two-handed"], "topple"],
    ["Longsword", "1d8", "slashing", ["versatile"], "sap"],
    ["Maul", "2d6", "bludgeoning", ["heavy", "two-handed"], "topple"],
    ["Morningstar", "1d8", "piercing", [], "sap"],
    ["Pike", "1d10", "piercing", ["heavy", "reach", "two-handed"], "push"],
    ["Rapier", "1d8", "piercing", ["finesse"], "vex"],
    ["Scimitar", "1d6", "slashing", ["finesse", "light"], "nick"],
    ["Shortsword", "1d6", "piercing", ["finesse", "light"], "vex"],
    ["Trident", "1d8", "piercing", ["thrown", "versatile"], "topple"],
    ["Warhammer", "1d8", "bludgeoning", ["versatile"], "push"],
    ["War Pick", "1d8", "piercing", ["versatile"], "sap"],
    ["Whip", "1d4", "slashing", ["finesse", "reach"], "slow"],
  ]),
  ...rows("martial", true, [
    ["Blowgun", "1", "piercing", ["ammunition", "loading"], "vex"],
    ["Hand Crossbow", "1d6", "piercing", ["ammunition", "light", "loading"], "vex"],
    ["Heavy Crossbow", "1d10", "piercing", ["ammunition", "heavy", "loading", "two-handed"], "push"],
    ["Longbow", "1d8", "piercing", ["ammunition", "heavy", "two-handed"], "slow"],
    ["Musket", "1d12", "piercing", ["ammunition", "loading", "two-handed"], "slow"],
    ["Pistol", "1d10", "piercing", ["ammunition", "loading"], "vex"],
  ]),
];
