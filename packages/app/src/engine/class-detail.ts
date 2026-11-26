// What the modal of a class shows (ORC-349, docs/design/character-builder.md "The class cards"): the description, the
// facts (the hit die, the saving throws, the armor and weapons, the skill picks, the subclass with its level) and the
// features table by level.
//
// The engine's content list of the classes has only the key and the name of each class, and its template has the
// choices but not the features. So the facts and the features come from a trial character: a new character with the
// class, built with the character's content, at level 1 for the facts and at each level from 1 to 20 for the features.
// The same rules thus give the text of an SRD class and of a pack class. The description of a pack class is the help of
// its record; the engine has no description of an SRD class, so the app holds one sentence for each.

import type { Built2014, TemplateOption, TemplateSelection } from "@pubdoor/dmv";
import { templateShape } from "./builder.ts";
import type { Content, ContentType, Engine, StrictEntity } from "./engine.ts";
import { addFirstClass, newCharacter } from "./new-character.ts";
import { countWord, type DetailFact, type OptionDetail } from "./origin-detail.ts";
import { ABILITIES, ABILITY_NAMES, abilityOfKey, keyToName, SKILLS } from "./sheet.ts";

/** The content type of the classes. */
export const CLASS_TYPE: ContentType = "orcpub.dnd.e5/classes";

/** One sentence about each SRD class, for the modal: the engine has no description of an SRD class. */
export const SRD_CLASS_DESCRIPTIONS: Record<string, string> = {
  barbarian: "A fierce warrior who can enter a battle rage.",
  bard: "A performer whose music holds magic and gives heart to allies.",
  cleric: "A priest who uses divine magic in the service of a god.",
  druid: "A priest of nature who takes the shapes of beasts.",
  fighter: "A master of weapons and armor.",
  monk: "A martial artist who uses the power of the body.",
  paladin: "A holy warrior bound to a sacred oath.",
  ranger: "A hunter who fights at the edge of the wild.",
  rogue: "A scoundrel who uses stealth and skill.",
  sorcerer: "A caster whose magic comes from a gift or a bloodline.",
  warlock: "A caster who made a pact with a being of great power.",
  wizard: "A scholar of magic who keeps spells in a book.",
};

/** The features that a class gets at one level: the row of the features table. */
export interface ClassFeatureRow {
  level: number;
  names: string[];
}

/** What the facts and the features read: the engine and the content that the character builds against. */
export interface ClassInput {
  engine: Engine;
  content: Content;
}

/** The option of the class with the key in the template of the content, with its choices; undefined for no such class. */
export const templateClass = (key: string, content: Content): TemplateOption | undefined =>
  templateShape(content)
    .find((s) => s.key === "class")
    ?.options.find((o) => o.key === key);

/** The trial character: a new character with the class at level 1, with no race and no background. */
const trial = ({ engine: e, content }: ClassInput, key: string): StrictEntity => addFirstClass(e, newCharacter(e), key, content);

/** The texts joined with commas and "and": "light, medium and heavy". */
const listText = (parts: string[]) => (parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`);

const ARMOR = ["light", "medium", "heavy"];
const WEAPON_GROUPS = ["simple", "martial"];

/**
 * The armor and weapons of a built character as one text: "All armor, shields; simple and martial weapons", "Light
 * armor; simple weapons, Crossbow Hand, Longsword". "No armor" when it has none.
 */
export function armorWeaponsText(armorProfs: string[], weaponProfs: string[]): string {
  const armor = ARMOR.filter((a) => armorProfs.includes(a));
  const armorParts = [
    ...(armor.length === ARMOR.length ? ["all armor"] : armor.length > 0 ? [`${listText(armor)} armor`] : []),
    ...(armorProfs.includes("shields") ? ["shields"] : []),
  ];
  const groups = WEAPON_GROUPS.filter((g) => weaponProfs.includes(g));
  const weapons = [...(groups.length > 0 ? [`${listText(groups)} weapons`] : []), ...weaponProfs.filter((w) => !WEAPON_GROUPS.includes(w)).map(keyToName)];
  const text = [armorParts.length > 0 ? armorParts.join(", ") : "no armor", ...(weapons.length > 0 ? [weapons.join(", ")] : [])].join("; ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The skill choice of a class option: "Two of Athletics, History", or "Three of your choice" when it has all the skills. Null with none. */
function skillText(option: TemplateOption | undefined): string | null {
  const selection = option?.selections?.find((s) => s.key === "skill-proficiency");
  const n = selection?.max ?? selection?.min ?? 0;
  if (selection === undefined || n <= 0) return null;
  if (selection.options.length >= SKILLS.length) return `${countWord(n)} of your choice`;
  return `${countWord(n)} of ${selection.options.map((o) => o.name).join(", ")}`;
}

/** The level options of a class option: "level-1" to "level-20". */
const levelOptions = (option: TemplateOption | undefined): TemplateOption[] => option?.selections?.find((s) => s.key === "levels")?.options ?? [];

/** The subclass of a class option and the level of its choice: "Martial Archetype, at level 3". Null when it has none. */
function subclassText(option: TemplateOption | undefined): string | null {
  const levels = levelOptions(option);
  for (const [i, level] of levels.entries()) {
    const subclass = level.selections?.find((s) => (s.tags ?? []).includes("subclass"));
    if (subclass) return `${subclass.name}, at level ${i + 1}`;
  }
  return null;
}

/**
 * The description and the facts of the class with the key, from a trial character at level 1 (one build): Hit die,
 * Saving throws, "Armor, weapons", Skills and Subclass, each only when the class gives it. `description` is the help
 * of the record of a pack class, or else the SRD sentence. The detail has no traits: the features table has them.
 */
export function classFacts(input: ClassInput, key: string, description?: string): OptionDetail {
  const built = input.engine.evaluate(trial(input, key), input.content).built as Built2014;
  const option = templateClass(key, input.content);
  const facts: DetailFact[] = [];
  const add = (label: string, value: string | null) => {
    if (value !== null && value !== "") facts.push({ label, value });
  };
  const die = built.levels?.[key]?.["hit-die"];
  add("Hit die", die ? `d${die}` : null);
  const saves = new Set((built["saving-throws"] ?? []).map(abilityOfKey));
  add(
    "Saving throws",
    ABILITIES.filter((a) => saves.has(a))
      .map((a) => ABILITY_NAMES[a])
      .join(", "),
  );
  add("Armor, weapons", armorWeaponsText(built["armor-profs"] ?? [], built["weapon-profs"] ?? []));
  add("Skills", skillText(option));
  add("Subclass", subclassText(option));
  return { description: (description ?? SRD_CLASS_DESCRIPTIONS[key] ?? "").trim(), facts, traits: [] };
}

/**
 * Whether a choice of a class is a row of the features table. Not the hit points, the levels, the starting equipment,
 * a skill or tool choice (but an expertise choice is), or the spells known of each level.
 */
function isFeatureChoice(selection: TemplateSelection): boolean {
  const tags = selection.tags ?? [];
  if (selection.key === "hit-points" || selection.key === "levels" || tags.includes("starting-equipment")) return false;
  if (tags.includes("profs") && !tags.includes("expertise")) return false;
  return !/(Cantrips|Spells) Known$/.test(selection.name);
}

/** The features of a built character, in the order traits, actions, bonus actions, reactions. */
const featureNames = (built: Built2014) => [...built.traits, ...built.actions, ...built["bonus-actions"], ...built.reactions].map((f) => f.name);

/**
 * The features table of the class with the key, one step for each level from 1 to 20; each step builds the trial
 * character once. The value at the end is the rows, one for each level with a feature. A level has:
 *
 * * the choices of the level in the template (isFeatureChoice), and at level 1 the choices of the class, such as
 *   Fighting Style. A choice whose name starts with the name of a feature of the class, such as "Mystic Arcanum: Spell
 *   Level 6", is part of that feature;
 * * the features that the built character has first at the level: its traits, actions, bonus actions and reactions;
 * * "Spellcasting", or "Pact Magic", at the first level with spell slots;
 * * "Extra Attack" at each level where the number of attacks goes up, "Extra Attack (2)" for the third attack, when the
 *   level has no feature of that name.
 *
 * A name is once in a level. A trial character that the engine refuses gives the rows up to that level.
 */
export function* classFeatureSteps(input: ClassInput, key: string): Generator<void, ClassFeatureRow[]> {
  const { engine: e, content } = input;
  const option = templateClass(key, content);
  const levels = levelOptions(option);
  const rows: { level: number; choices: string[]; features: string[] }[] = [];
  const seen = new Set<string>();
  let attacks = 1;
  let casts = false;
  let entity: StrictEntity | null = null;
  for (let level = 1; level <= 20; level++) {
    let built: Built2014;
    try {
      entity = entity === null ? trial(input, key) : (e.addLevel(entity, key, content) as StrictEntity);
      built = e.evaluate(entity, content).built as Built2014;
    } catch {
      break;
    }
    const choices = [...(level === 1 ? (option?.selections ?? []) : []), ...(levels[level - 1]?.selections ?? [])].filter(isFeatureChoice).map((s) => s.name);
    const features = featureNames(built).filter((name) => !seen.has(name));
    for (const name of features) seen.add(name);
    if (!casts && Object.keys(built["spell-slots"] ?? {}).length > 0) {
      casts = true;
      features.push(built["pact-magic?"] ? "Pact Magic" : "Spellcasting");
    }
    const n = built["number-of-attacks"] ?? 1;
    if (n > attacks && !features.some((name) => name.startsWith("Extra Attack"))) features.push(n === 2 ? "Extra Attack" : `Extra Attack (${n - 1})`);
    attacks = Math.max(attacks, n);
    rows.push({ level, choices, features });
    yield;
  }
  const partOf = (name: string) => [...seen].some((feature) => name !== feature && (name.startsWith(`${feature} `) || name.startsWith(`${feature}:`)));
  const table = rows
    .map(({ level, choices, features }) => ({ level, names: [...new Set([...choices.filter((c) => !partOf(c)), ...features])] }))
    .filter((row) => row.names.length > 0);
  const known = madeTables.get(content) ?? new Map<string, ClassFeatureRow[]>();
  madeTables.set(content, known.set(key, table));
  return table;
}

/** The features tables that classFeatureSteps made, by the content and the class key. */
const madeTables = new WeakMap<Content, Map<string, ClassFeatureRow[]>>();

/** The features table of the class with the key for the content, when classFeatureSteps made it already; else undefined. */
export const knownClassFeatures = (content: Content, key: string): ClassFeatureRow[] | undefined => madeTables.get(content)?.get(key);

/** The features table of the class with the key (classFeatureSteps), all at once, or the one made already. */
export function classFeatures(input: ClassInput, key: string): ClassFeatureRow[] {
  const known = knownClassFeatures(input.content, key);
  if (known !== undefined) return known;
  const steps = classFeatureSteps(input, key);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}
