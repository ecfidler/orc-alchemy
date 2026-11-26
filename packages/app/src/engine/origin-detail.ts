// What the detail panel of the Background step shows for an option (ORC-347, docs/design/character-builder.md "The
// list and the panel"): the description, the facts in a definition list (the skills, the languages, the tools and the
// equipment), and the feature. It reads the record of the option: the item of a content pack or of the character's
// custom content, or the SRD background of the engine's content list. The engine builds a character's proficiencies as
// keys, so the names come from the template (proficiencyNames) and from the engine's item lists.

import { isMap, unqualify } from "./content.ts";
import { keyToName } from "./sheet.ts";

/** One fact of the panel, a row of its definition list: "Skills", "Insight, Religion". */
export interface DetailFact {
  label: string;
  value: string;
}

/** One trait or feature of the panel: its name in bold, then its text. */
export interface DetailTrait {
  name: string;
  text: string;
}

/** The content of the detail panel of an option, under its name and its pack. */
export interface OptionDetail {
  description: string;
  facts: DetailFact[];
  traits: DetailTrait[];
}

/** The name of a skill, a tool, a language or an item by its key. */
export type NameOf = (kind: "skill" | "tool" | "language" | "item", key: string) => string;

/**
 * The value with the Transit keyword marks taken off: each key of each map at any depth, and each keyword value, as
 * the engine's content list has them. A pack item has its keys as "~:name".
 */
export function plainRecord(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(plainRecord);
  if (isMap(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k.replace(/^~:/, ""), plainRecord(v)]));
  return typeof value === "string" ? value.replace(/^~:/, "") : value;
}

const WORDS = ["None", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

/** A count as a word with a capital letter, "Two"; a count above ten as its digits. */
export const countWord = (n: number) => WORDS[n] ?? String(n);

/** The keys of a map whose value is not false or 0, as the forms store a set: {:insight true}. */
const keysOf = (value: unknown): string[] => (isMap(value) ? Object.entries(value).filter(([, v]) => v !== false && v !== 0 && v != null) : []).map(([k]) => k);

/** The names of a choice of the player, as the forms store it: {:choose 2 :options {:any true}} or {:choose 1 :options {:a true :b true}}. */
function choiceText(choice: unknown, name: (key: string) => string): string | null {
  if (!isMap(choice)) return null;
  const n = Number(choice.choose ?? 1);
  const options = keysOf(choice.options);
  if (n <= 0) return null;
  if (options.length === 0 || options.includes("any")) return `${countWord(n)} of your choice`;
  return `${countWord(n)} of ${options.map(name).join(", ")}`;
}

// The "Any …" choices of :profs :tool-options, by the key the background form stores (BackgroundForm.tsx).
const TOOL_CHOICES: Record<string, [one: string, many: string]> = {
  "artisans-tool": ["artisan's tool", "artisan's tools"],
  "musical-instrument": ["musical instrument", "musical instruments"],
  "gaming-set": ["gaming set", "gaming sets"],
};

/** The tool choices of :profs :tool-options {:artisans-tool 1}: "One artisan's tool of your choice". */
function toolChoices(options: unknown): string[] {
  if (!isMap(options)) return [];
  return Object.entries(options).flatMap(([key, value]) => {
    const n = Number(value);
    if (!(n > 0)) return [];
    const [one, many] = TOOL_CHOICES[key] ?? [keyToName(key).toLowerCase(), keyToName(key).toLowerCase()];
    return [`${countWord(n)} ${n === 1 ? one : many} of your choice`];
  });
}

/** The fixed proficiencies of a kind and the choices, as one fact value; null when there are none. */
function proficiencyValue(fixed: string[], choices: (string | null)[]): string | null {
  const parts = [...(fixed.length > 0 ? [fixed.join(", ")] : []), ...choices.filter((c): c is string => c !== null)];
  return parts.length > 0 ? parts.join("; ") : null;
}

/** The item with its count when it is more than one: "Incense (5)". */
const counted = (name: string, n: unknown) => (Number(n) > 1 ? `${name} (${n})` : name);

/**
 * The equipment fact of a background: its items, each of its equipment choices as its options with "or", and its
 * gold. Null when it has none.
 */
function equipmentValue(record: Record<string, unknown>, nameOf: NameOf): string | null {
  const items = isMap(record.equipment) ? Object.entries(record.equipment).map(([key, n]) => counted(nameOf("item", key), n)) : [];
  const choices = (Array.isArray(record["equipment-choices"]) ? record["equipment-choices"] : []).flatMap((choice) => {
    if (!isMap(choice)) return [];
    const options = keysOf(choice.options).map((key) => nameOf("item", key));
    return options.length > 0 ? [options.join(" or ")] : typeof choice.name === "string" ? [choice.name] : [];
  });
  const treasure = isMap(record.treasure) ? Object.entries(record.treasure).filter(([, n]) => Number(n) > 0) : [];
  const parts = [...items, ...choices, ...treasure.map(([coin, n]) => `${n} ${coin}`)];
  return parts.length > 0 ? parts.join(", ") : null;
}

/** The traits of a record: the name and the description, or else the summary. A trait with neither has its name only. */
export function traitsOf(record: Record<string, unknown>): DetailTrait[] {
  return (Array.isArray(record.traits) ? record.traits : []).flatMap((trait) =>
    isMap(trait) ? [{ name: String(trait.name ?? "").trim(), text: String(trait.description ?? trait.summary ?? "").trim() }] : [],
  );
}

/**
 * The detail of a background from its plain record (plainRecord): the description (:help), the facts Skills,
 * Languages, Tools and Equipment, each only when the background gives it, and its features.
 */
export function backgroundDetail(record: Record<string, unknown>, nameOf: NameOf): OptionDetail {
  const profs = isMap(record.profs) ? record.profs : {};
  const name = (kind: "skill" | "tool" | "language") => (key: string) => nameOf(kind, key);
  const facts: DetailFact[] = [];
  const add = (label: string, value: string | null) => {
    if (value !== null) facts.push({ label, value });
  };
  add("Skills", proficiencyValue(keysOf(profs.skill).map(name("skill")), [choiceText(profs["skill-options"], name("skill"))]));
  add("Languages", proficiencyValue(keysOf(profs.language).map(name("language")), [choiceText(profs["language-options"], name("language"))]));
  add("Tools", proficiencyValue(keysOf(profs.tool).map(name("tool")), toolChoices(profs["tool-options"])));
  add("Equipment", equipmentValue(record, nameOf));
  return { description: String(record.help ?? "").trim(), facts, traits: traitsOf(record) };
}

/**
 * The function that names a key: the name in `names` by "{kind}:{key}" (proficiencyNames), else the item name in
 * `items`, else the name of the key, "Clothes Common".
 */
export function nameLookup(names: Map<string, string>, items: Map<string, string>): NameOf {
  return (kind, key) => (kind === "item" ? items.get(key) : names.get(`${kind}:${key}`)) ?? keyToName(unqualify(key));
}

/** The SRD backgrounds of the engine's content list, as plain records. They load once, as their own chunk. */
let srd: Promise<Record<string, unknown>[]> | undefined;
export function srdBackgrounds(): Promise<Record<string, unknown>[]> {
  srd ??= import("@pubdoor/dmv/content/backgrounds.json").then((mod) => mod.default as Record<string, unknown>[]);
  return srd;
}

/** The name of each item of the engine's equipment, weapon and armor lists, by key. They load once, as their own chunks. */
let itemNames: Promise<Map<string, string>> | undefined;
export function srdItemNames(): Promise<Map<string, string>> {
  const list = (mod: { default: unknown }) => mod.default as { key: string; name: string }[];
  itemNames ??= Promise.all([
    import("@pubdoor/dmv/content/equipment.json").then(list),
    import("@pubdoor/dmv/content/weapons.json").then(list),
    import("@pubdoor/dmv/content/armor.json").then(list),
  ]).then((lists) => new Map(lists.flat().map(({ key, name }) => [key, name])));
  return itemNames;
}
