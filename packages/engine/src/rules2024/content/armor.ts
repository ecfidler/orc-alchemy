// The armor table (SRD 5.2.1 p92).

import { nameToKey } from "../../core/template.ts";

export interface Armor {
  key: string;
  name: string;
  category: "light" | "medium" | "heavy";
  /** The Armor Class before the Dexterity modifier. */
  base: number;
  /** The most Dexterity modifier that counts: null for no limit, 0 for none. */
  dexLimit: number | null;
}

const armor = (name: string, category: Armor["category"], base: number): Armor => ({
  key: nameToKey(name),
  name,
  category,
  base,
  dexLimit: category === "light" ? null : category === "medium" ? 2 : 0,
});

export const ARMOR: readonly Armor[] = [
  armor("Padded Armor", "light", 11),
  armor("Leather Armor", "light", 11),
  armor("Studded Leather Armor", "light", 12),
  armor("Hide Armor", "medium", 12),
  armor("Chain Shirt", "medium", 13),
  armor("Scale Mail", "medium", 14),
  armor("Breastplate", "medium", 14),
  armor("Half Plate Armor", "medium", 15),
  armor("Ring Mail", "heavy", 14),
  armor("Chain Mail", "heavy", 16),
  armor("Splint Armor", "heavy", 17),
  armor("Plate Armor", "heavy", 18),
];
