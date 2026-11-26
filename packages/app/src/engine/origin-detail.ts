// What the detail panel of the Background and Race steps shows for an option (ORC-347, ORC-348,
// docs/design/character-builder.md "The list and the panel"): the description, the facts in a definition list, and the
// feature or the traits. For a background, the facts are the skills, the languages, the tools and the equipment. For a
// race, they are the ability scores, the size and speed, the languages, and the one subrace of a race with one. It
// reads the record of the option: the item of a content pack or of the character's custom content, or the SRD
// background or race of the engine's content list. The choices of a race are in its option of the template. The engine
// builds a character's proficiencies as keys, so the names come from the template (proficiencyNames) and from the
// engine's item lists.

import type { TemplateOption, TemplateSelection } from "@pubdoor/dmv";
import { isMap, unqualify } from "./content.ts";
import { SUBRACE_KEY, soleSubrace, subraceOptions } from "./race-step.ts";
import { ABILITIES, ABILITY_NAMES, abilityOfKey, keyToName } from "./sheet.ts";
import { srdList } from "./srd-lists.ts";

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

/**
 * The ability score increases of a record (:abilities), the largest first, then in the order of the abilities:
 * "Charisma +2, Intelligence +1".
 */
function abilityText(abilities: unknown): string[] {
  if (!isMap(abilities)) return [];
  const by = new Map(Object.entries(abilities).map(([key, n]) => [abilityOfKey(key), Number(n)]));
  return ABILITIES.flatMap((a) => {
    const n = by.get(a);
    return n ? [[n, a] as const] : [];
  })
    .sort(([a], [b]) => b - a)
    .map(([n, a]) => `${ABILITY_NAMES[a]} ${n > 0 ? "+" : ""}${n}`);
}

/** The ability score increases of a template option, from its modifiers ("ability-increases", name "WIS", value "+1"). */
function modifierAbilities(option: TemplateOption): string[] {
  return (option.modifiers ?? []).flatMap(({ key, name, value }) => {
    const ability = key === "ability-increases" && typeof name === "string" ? abilityOfKey(name.toLowerCase()) : null;
    return ability === null ? [] : [`${ABILITY_NAMES[ability]} ${value}`];
  });
}

/** The selections of a race option (not those of its subraces) with the tag. */
const raceChoices = (option: TemplateOption | undefined, tag: string): TemplateSelection[] =>
  (option?.selections ?? []).filter((s) => s.key !== SUBRACE_KEY && (s.tags ?? []).includes(tag));

/** A choice of the race of `n` from the options: "One of your choice" above six options, else "One of Dwarvish, Elvish". */
function raceChoiceText(selection: TemplateSelection): string {
  const n = selection.max ?? selection.min ?? 1;
  return selection.options.length > 6 ? `${countWord(n)} of your choice` : `${countWord(n)} of ${selection.options.map((o) => o.name).join(", ")}`;
}

/** The languages of a race record: a list, or a set as a pack item stores it ({"~#set": [...]}), in the order of the alphabet. */
function languagesOf(value: unknown): string[] {
  const list = Array.isArray(value) ? value : isMap(value) && Array.isArray(value["~#set"]) ? value["~#set"] : [];
  return list.map(String).sort((a, b) => a.localeCompare(b));
}

/**
 * The detail of a race from its plain record (plainRecord) and its option of the template (with its choices): the
 * description (:help), the facts Ability scores, "Size, speed", Languages and Subrace, each only when the race gives
 * it, and the darkvision and the traits. A choice of the player shows after the fixed part: "Charisma +2; +1 to two of
 * your choice". The Subrace fact is the one subrace of a race with one (soleSubrace), with its ability score
 * increases and its traits: "Hill Dwarf: Wisdom +1". A race with more than one subrace has no Subrace fact: the block
 * of the race has the Subrace row in Choices.
 */
export function raceDetail(record: Record<string, unknown>, option: TemplateOption | undefined): OptionDetail {
  const facts: DetailFact[] = [];
  const add = (label: string, parts: string[]) => {
    if (parts.length > 0) facts.push({ label, value: parts.join("; ") });
  };
  const fixed = (parts: string[]) => (parts.length > 0 ? [parts.join(", ")] : []);
  const increases = raceChoices(option, "ability-scores").map((s) => {
    const amount = s.options[0]?.modifiers?.find((m) => m.value !== undefined)?.value ?? "+1";
    return `${amount} to ${countWord(s.max ?? 1).toLowerCase()} of your choice`;
  });
  add("Ability scores", [...fixed(abilityText(record.abilities)), ...increases]);
  const size = typeof record.size === "string" ? keyToName(record.size) : null;
  const speed = Number(record.speed) > 0 ? `${record.speed} ft.` : null;
  add("Size, speed", [[size, speed].filter((p) => p !== null).join(", ")].filter(Boolean));
  add("Languages", [...fixed(languagesOf(record.languages)), ...raceChoices(option, "language-profs").map(raceChoiceText)]);
  const sole = soleSubrace(option);
  if (sole !== null) {
    const subrace = subraceOptions(option).find((o) => o.key === sole.key);
    const ofRecord = (Array.isArray(record.subraces) ? record.subraces : []).find((s) => isMap(s) && s.name === sole.name);
    const parts = [...(subrace ? modifierAbilities(subrace) : []), ...(isMap(ofRecord) ? traitsOf(ofRecord).map((t) => t.name) : [])];
    add("Subrace", [parts.length > 0 ? `${sole.name}: ${parts.join(", ")}` : sole.name]);
  }
  const darkvision =
    Number(record.darkvision) > 0 ? [{ name: "Darkvision", text: `You see in dim light within ${record.darkvision} feet as in bright light.` }] : [];
  return { description: String(record.help ?? "").trim(), facts, traits: [...darkvision, ...traitsOf(record)] };
}

/** The SRD races of the engine's content list (srdList). */
export const srdRaces = () => srdList("races");

/** The SRD backgrounds of the engine's content list (srdList). */
export const srdBackgrounds = () => srdList("backgrounds");

/** The name of each item of the engine's equipment, weapon and armor lists, by key. The map is made once. */
let itemNames: Promise<Map<string, string>> | undefined;
export function srdItemNames(): Promise<Map<string, string>> {
  itemNames ??= Promise.all([srdList("equipment"), srdList("weapons"), srdList("armor")]).then(
    (lists) => new Map(lists.flat().map(({ key, name }) => [key, name])),
  );
  return itemNames;
}
