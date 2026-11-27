// The ability and skill lists, and the names and number text that the sheet and the forms show.
import type { Amount } from "@pubdoor/dmv";
import { unqualify, untag } from "./content.ts";
import type { Ability, Named } from "./sheet.ts";

export const ABILITIES: Ability[] = ["str", "dex", "con", "int", "wis", "cha"];

/** The name of each ability. */
export const ABILITY_NAMES: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

/** The ability of a stored or built ability key, bare or qualified ("~:wis", "orcpub.dnd.e5.character/wis"), or null for another value. */
export function abilityOfKey(key: unknown): Ability | null {
  if (typeof key !== "string") return null;
  const name = unqualify(untag(key));
  return (ABILITIES as string[]).includes(name) ? (name as Ability) : null;
}

/** The 18 skills, in name order. */
export const SKILLS: [key: string, name: string, ability: Ability][] = [
  ["acrobatics", "Acrobatics", "dex"],
  ["animal-handling", "Animal Handling", "wis"],
  ["arcana", "Arcana", "int"],
  ["athletics", "Athletics", "str"],
  ["deception", "Deception", "cha"],
  ["history", "History", "int"],
  ["insight", "Insight", "wis"],
  ["intimidation", "Intimidation", "cha"],
  ["investigation", "Investigation", "int"],
  ["medicine", "Medicine", "wis"],
  ["nature", "Nature", "int"],
  ["perception", "Perception", "wis"],
  ["performance", "Performance", "cha"],
  ["persuasion", "Persuasion", "cha"],
  ["religion", "Religion", "int"],
  ["sleight-of-hand", "Sleight of Hand", "dex"],
  ["stealth", "Stealth", "dex"],
  ["survival", "Survival", "wis"],
];

/** The text with a capital first letter: "at will" → "At will". */
export const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The old app's capitalised kw-to-name: "crossbow-light" → "Crossbow Light". */
export const keyToName = (key: string) => unqualify(key).split("-").map(capitalized).join(" ");

export const named = (key: string): Named => ({ key, name: keyToName(key) });

/** The old app's sentensize: capitalise the first letter and end with a full stop. */
export const sentence = (text: string) => {
  const trimmed = text.trim();
  if (trimmed === "") return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1) + (trimmed.endsWith(".") ? "" : ".");
};

export const byName = <T extends { name: string }>(items: T[]) => items.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

/** The name a feature or special attack shows when the engine gives it none. */
export const UNNAMED_FEATURE = "Unnamed feature";
// The engine's types say every feature has a name, but homebrew can leave a
// name out. Engine 0.3.1 also gave the Hunter's Evasion feature none (ORC-177).
export const nameOf = (feature: { name?: string | null }) => feature.name || UNNAMED_FEATURE;

/** The old app's bonus-str, for ability, save, skill and other bonuses: "+3", "-1", and "0" for zero. */
export const bonusStr = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/** A modifier as the builder shows it: bonusStr with a true minus sign (U+2212), "+2", "0", "−1". */
export const modifierText = (n: number) => (n < 0 ? `−${-n}` : bonusStr(n));

/** The old app's mod-str, for initiative and attack and damage rolls: "+0" for zero. */
export const modStr = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** A number as an English ordinal for a level: 1st, 2nd, 3rd, 4th. */
export const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

export const blankToNull = (value: unknown) => ((typeof value === "string" && value.trim() !== "") || typeof value === "number" ? String(value) : null);

/** The old display's unit-amount-description: "1 minute", "60 feet", "2 rounds". */
export const unitAmount = (value: Amount) => {
  const { amount = 1, units, singular, plural } = value as Amount & { singular?: string; plural?: string };
  const unit = unqualify(units);
  if (amount === 1) return `${amount} ${singular ? unqualify(singular) : unit}`;
  return `${amount} ${plural ? unqualify(plural) : unit === "feet" ? unit : `${unit}s`}`;
};
