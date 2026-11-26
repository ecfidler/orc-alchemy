// Character-local content (ORC-133): the customized options that one
// character holds in its record's `custom`, a single-plugin map in the form of
// a stored pack's plugin. The character builds against the loaded content
// with `custom` added as one more pack, named CUSTOM_PACK. Other characters
// never see it.
import type { Built2014 } from "@pubdoor/dmv";
import {
  asSet,
  BACKGROUND_TYPE,
  disabledInFile,
  isMap,
  itemAt,
  itemsAt,
  nameToKw,
  OPTION_KEY,
  OPTION_PACK,
  optionKeyOf,
  SUBRACE_TYPE,
  sameRecord,
  tag,
  untag,
  withItem,
  withoutItem,
} from "./content.ts";
import { type Content, type ContentType, engine, type StrictEntity } from "./engine.ts";
import { type AreaAttack, breathWeaponText, hasArea, raceGives } from "./race-gives.ts";
import { pickableSubraces, subraceOptions, subracePick, templateRace } from "./race-step.ts";
import { missingContent, picksUnder, remapOption, withoutOption } from "./reconcile.ts";
import { capitalized } from "./sheet.ts";
import { srdList } from "./srd-lists.ts";

/** The reserved pack name of a character's custom content. An imported or saved pack cannot have it. */
export const CUSTOM_PACK = "Custom (this character)";

/** The error message when a pack has the reserved name. */
export const reservedPackMessage = (name: string = CUSTOM_PACK) =>
  `The pack name ${name} is reserved for content that one character customizes. Rename the pack.`;

/** True if custom holds at least one item. */
export function hasCustomItems(custom: object | undefined): custom is object {
  return custom !== undefined && Object.values(custom).some((items) => isMap(items) && Object.keys(items).length > 0);
}

const memo = new WeakMap<Content, WeakMap<object, Content>>();

/**
 * What a character with this custom content builds against: content itself
 * when custom is undefined or has no items, else content with custom added to
 * its homebrew as the pack CUSTOM_PACK. The same pair gives the same object,
 * so a hook that memoizes on it does not run again.
 */
export function characterContent(content: Content, custom: object | undefined): Content {
  if (!hasCustomItems(custom)) return content;
  let forContent = memo.get(content);
  if (forContent === undefined) {
    forContent = new WeakMap();
    memo.set(content, forContent);
  }
  let result = forContent.get(custom);
  if (result === undefined) {
    // The app's content always holds a multi-plugin map; the engine's text form cannot take another pack.
    if (typeof content.homebrew === "string") throw new Error("Custom content needs the homebrew as a multi-plugin map");
    result = { ...content, homebrew: { ...content.homebrew, [CUSTOM_PACK]: custom } };
    forContent.set(custom, result);
  }
  return result;
}

/** Each tagged option key in the entity, at any depth. */
function optionKeys(entity: StrictEntity): Set<string> {
  const keys = new Set<string>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (isMap(node)) {
      if (typeof node[OPTION_KEY] === "string") keys.add(node[OPTION_KEY]);
      Object.values(node).forEach(walk);
    }
  };
  walk(typeof entity === "string" ? JSON.parse(entity) : entity);
  return keys;
}

const SUBCLASSES = tag("orcpub.dnd.e5/subclasses");

/**
 * The custom content without the items that the entity does not select, or
 * undefined when no item is left. custom itself when nothing is dropped. An
 * item stays if the entity has an option with its key, at any depth; a
 * subclass also stays by the key of its name, which its option takes. So an
 * item whose key a loaded pack also has stays, and an item can stay for an
 * option of another type with the same key: that costs only storage.
 */
export function pruneCustom(entity: StrictEntity, custom: object | undefined): object | undefined {
  if (!hasCustomItems(custom)) return undefined;
  const selected = optionKeys(entity);
  let dropped = false;
  const kept: Record<string, unknown> = {};
  for (const [type, items] of Object.entries(custom)) {
    if (!isMap(items)) {
      kept[type] = items;
      continue;
    }
    const keep = Object.entries(items).filter(([key, item]) => {
      if (selected.has(key)) return true;
      return type === SUBCLASSES && isMap(item) && typeof item["~:name"] === "string" && selected.has(tag(nameToKw(item["~:name"])));
    });
    if (keep.length < Object.keys(items).length) dropped = true;
    if (keep.length > 0) kept[type] = Object.fromEntries(keep);
  }
  if (!dropped) return custom;
  return hasCustomItems(kept) ? kept : undefined;
}

// Customize (ORC-134): a character's copy of one option, such as a feat. The
// copy is an item of custom, and the character selects it in place of the
// option it copies. The option itself stays in the lists.

/** The name that a copy of the option named `name` opens with. */
export const customName = (name: string) => `${name} (Custom)`;

/**
 * The key of a copy of the content type with the name, which is also the
 * key of its option. A background's copy has the key that the engine gives
 * a background with the name (optionKeyOf), with each "-" kept: "Sage
 * (Custom)" is sage-custom-. A copy of each other type has the nameToKw key
 * without a "-" at the start or the end: "Skill Expert (Custom)" is
 * skill-expert-custom. The engine keys a feat or a race by its stored key,
 * which customizeOption sets to this key. "" for a name without letters or
 * digits.
 */
export function copyKey(contentType: ContentType, name: string): string {
  const trimmed = nameToKw(name).replace(/^-+|-+$/g, "");
  if (trimmed === "") return "";
  return contentType === BACKGROUND_TYPE ? optionKeyOf(contentType, { "~:name": name }) : trimmed;
}

/** The copy key of the item's name (copyKey), or "" when the item has no name. */
export function copyKeyOf(contentType: ContentType, item: object): string {
  const name = (item as Record<string, unknown>)[tag("name")];
  return typeof name === "string" ? copyKey(contentType, name) : "";
}

/**
 * The item of the plugin's content type that gives the option with the
 * key: the item at the key, or for a background the last item with that
 * option key (optionKeyOf), as the engine finds it.
 */
function itemFor(plugin: object, contentType: ContentType, key: string): unknown {
  const type = tag(contentType);
  if (contentType !== BACKGROUND_TYPE) return itemAt(plugin, type, tag(key));
  return Object.entries(itemsAt(plugin, type) ?? {}).findLast(([tagged, item]) => isMap(item) && optionKeyOf(contentType, item, tagged) === key)?.[1];
}

/**
 * Where a selected option comes from, by its content type and key:
 * - "custom": the character's custom content has an item with the key. The
 *   character builds with custom as the last pack, so its item is the one
 *   that the character has, even when a loaded pack has the key too.
 *   A background's item is found by the key of its name (optionKeyOf).
 * - "pack": an enabled loaded pack has an enabled item with the key. With
 *   several, the last pack in the homebrew's order, which the engine merges
 *   last.
 * - "built-in": neither has it, so it is the engine's own SRD content. The
 *   engine cannot give a built-in option as a pack item.
 * homebrew is the loaded content's, without custom.
 */
export type OptionOrigin =
  | { from: "custom"; item: Record<string, unknown> }
  | { from: "pack"; pack: string; item: Record<string, unknown> }
  | { from: "built-in" };

export function optionOrigin(homebrew: Content["homebrew"], custom: object | undefined, contentType: ContentType, key: string): OptionOrigin {
  const own = custom && itemFor(custom, contentType, key);
  if (isMap(own)) return { from: "custom", item: own };
  // The app's content always holds a multi-plugin map (characterContent).
  if (isMap(homebrew)) {
    for (const [pack, plugin] of Object.entries(homebrew).reverse()) {
      const item = isMap(plugin) && !disabledInFile(plugin) ? itemFor(plugin, contentType, key) : undefined;
      if (isMap(item) && !disabledInFile(item)) return { from: "pack", pack, item };
    }
  }
  return { from: "built-in" };
}

const KEY = tag("key");

/** The item as the form edits it: without its key and its option source, which the save sets. */
export function formRecord(item: Record<string, unknown>): Record<string, unknown> {
  const { [KEY]: _key, [OPTION_PACK]: _pack, ...rest } = item;
  return rest;
}

/** The character's features: its traits, actions, bonus actions and reactions, in this order. */
export const features = (built: Built2014) => [built.traits, built.actions, built["bonus-actions"], built.reactions].flatMap((list) => list ?? []);

/**
 * The text of a built-in option, such as an SRD feat, for its copy: the
 * description, or else the summary, of the character's feature with the
 * option's name, with a capital first letter. "" when the character has no
 * such feature. The engine gives no other text for a built-in option.
 * built is the character as the engine builds it (useOpenCharacter).
 */
export function builtInText(built: Built2014, name: string): string {
  const feature = features(built).find((f) => f.name === name);
  return capitalized((feature?.description ?? feature?.summary ?? "").trim());
}

export interface Customization {
  contentType: ContentType;
  /** The path of the option that the character selects now, as remapOption takes it, such as ["feats", "skill-expert"]. */
  path: string[];
  /** The copy, as the form's validator returned it. Its key comes from its name (copyKey). */
  item: object;
  /** The key of the copy in custom that item replaces, when the user edits a copy. */
  replacedKey?: string;
  /**
   * The paths of the picks under the option whose values the copy has
   * (BuiltInCopy held). The save removes them, and saveCopy does not list
   * them as removed.
   */
  held?: string[][];
}

/**
 * The item as custom stores a copy of the content type: keyed by copyKeyOf
 * of its name, with CUSTOM_PACK as its option source. key is "" for a name
 * without letters or digits.
 */
export function storedCopy(contentType: ContentType, item: object): { key: string; stored: Record<string, unknown> } {
  const key = copyKeyOf(contentType, item);
  return { key, stored: { ...item, [KEY]: tag(key), [OPTION_PACK]: CUSTOM_PACK } };
}

/** True when the option with the key is a copy in the character's custom content (optionOrigin "custom"). */
export const isCustomCopy = (homebrew: Content["homebrew"], custom: object | undefined, contentType: ContentType, key: string) =>
  optionOrigin(homebrew, custom, contentType, key).from === "custom";

/**
 * Saves a copy in one change: writes item into custom under its content
 * type, keyed by copyKey of its name, with CUSTOM_PACK as its option
 * source, and gives the option at path the copy's key (remapOption), so its
 * own selections stay. An edit with replacedKey replaces that item; when the
 * name gives a new key, the old item goes and the option is remapped again.
 * Throws if the name gives no key, or as remapOption throws.
 */
export function customizeOption(
  entity: StrictEntity,
  custom: object | undefined,
  { contentType, path, item, replacedKey }: Customization,
): { entity: StrictEntity; custom: object } {
  const { key, stored } = storedCopy(contentType, item);
  if (key === "") throw new Error("The copy needs a name with a letter or a digit");
  const type = tag(contentType);
  const without = replacedKey === undefined || replacedKey === key ? (custom ?? {}) : withoutItem(custom ?? {}, type, tag(replacedKey));
  const next = withItem(without, type, tag(key), stored);
  return { entity: untag(path.at(-1)) === key ? entity : remapOption(entity, path, key), custom: next };
}

/** The value with each key of each map at any depth as a Transit keyword, as a pack item has its keys. */
const tagKeys = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(tagKeys) : isMap(value) ? Object.fromEntries(Object.entries(value).map(([k, v]) => [tag(k), tagKeys(v)])) : value;

/** The prefix of the name of a background's equipment choice in the template, as "Starting Equipment: Holy Symbol". */
const CHOICE_PREFIX = "Starting Equipment: ";

/**
 * The equipment choices of the SRD background with the key that the
 * engine's template has and that the content list leaves out, such as the
 * holy symbol of Acolyte, in the form's :equipment-choices shape. The
 * template gives each choice's name and options. A copy with the choice
 * keeps the character's pick under it: the engine keys the choice as
 * "starting-equipment-" and the key of its name.
 */
function templateChoices(key: string, listed: unknown[]): Record<string, unknown>[] {
  const option = engine()
    .buildTemplate()
    .shape.find((s) => s.key === "background")
    ?.options.find((o) => o.key === key);
  const has = new Set(listed.map((c) => `starting-equipment-${nameToKw(String((c as Record<string, unknown>).name ?? ""))}`));
  return (option?.selections ?? [])
    .filter((s) => (s.tags ?? []).includes("starting-equipment") && !has.has(s.key) && s.name.startsWith(CHOICE_PREFIX))
    .map((s) => ({
      name: s.name.slice(CHOICE_PREFIX.length),
      options: Object.fromEntries(s.options.filter((o) => o.key !== "none").map((o) => [o.key, 1])),
    }));
}

/**
 * The features of an SRD option in the engine's content list, as a form
 * edits them: the summary of a feature without a description is its
 * description, the field that the form edits. [] when traits is not a list.
 */
function formTraits(traits: unknown): unknown[] {
  return (Array.isArray(traits) ? traits : []).map((trait: Record<string, unknown>) => {
    const { summary, ...more } = trait;
    return more.description === undefined && typeof summary === "string" ? { ...more, description: summary } : trait;
  });
}

/**
 * The SRD background with the key as a form record, for its copy, or
 * undefined if the SRD has no such background. The source is the engine's
 * content list (content/backgrounds.json), which has each SRD background
 * with the fields of a pack background (BackgroundForm.tsx). The keys are
 * made Transit keywords, and the features are as the form edits them
 * (formTraits). An equipment choice that the list leaves out comes from
 * the engine's template (templateChoices), so the copy keeps the
 * character's pick. The SRD list loads once, as its own chunk.
 */
export async function srdBackgroundRecord(key: string): Promise<Record<string, unknown> | undefined> {
  const background = (await srdList("backgrounds")).find((b) => b.key === key);
  if (background === undefined) return undefined;
  const { key: _key, traits, "equipment-choices": choices, ...rest } = background;
  const listed = Array.isArray(choices) ? choices : [];
  const allChoices = [...listed, ...templateChoices(key, listed)];
  return tagKeys({ ...rest, ...(allChoices.length > 0 && { "equipment-choices": allChoices }), traits: formTraits(traits) }) as Record<string, unknown>;
}

/** The six ability keys, as a race's :abilities has them. */
const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"].map((a) => `orcpub.dnd.e5.character/${a}`);

/**
 * The Breath Weapon, the only area attack of an SRD race, as a feature
 * of a pack race, which has no attacks: an action with one use for each
 * short rest, with its text (breathWeaponText).
 */
function breathWeaponTrait(attack: AreaAttack): Record<string, unknown> {
  return {
    name: attack.name,
    type: tag("action"),
    frequency: { units: tag("orcpub.dnd.e5.units/short-rest"), amount: 1 },
    description: breathWeaponText(attack),
  };
}

/** The choices of an SRD race that a pack race can hold, by the key of the choice in the template: the key of the choice in :profs. */
const KEPT_CHOICES: Record<string, string> = { languages: "language-options", "skill-proficiency": "skill-options" };

/**
 * The language choice and the skill choice of the SRD race with the key,
 * as the :profs of a pack race: {:language-options {:choose 1 :options
 * {:elvish true}}}. The template gives the number to choose and the
 * options. The engine gives the choice of the copy the key of the SRD
 * choice, so the character's picks stay.
 *
 * With subrace, the key of an SRD subrace of the race, the result also
 * has the choices of the subrace that the character must make, such as
 * the language of the High Elf. A choice of the race and the same choice
 * of the subrace become one choice, of the two numbers together.
 */
function raceChoices(key: string, subrace?: string): Record<string, unknown> {
  // The option of the SRD race in the template, with its choices: the template with no homebrew has the SRD races only.
  const option = templateRace(key, { homebrew: undefined });
  const own = option?.selections ?? [];
  const ofSubrace = subraceOptions(option).find((o) => o.key === subrace)?.selections ?? [];
  const choices: Record<string, { choose: number; options: Record<string, true> }> = {};
  for (const s of [...own, ...ofSubrace]) {
    const field = KEPT_CHOICES[s.key];
    // A choice with a minimum of 0, such as those of the engine's custom subrace, is not one that the character must make.
    const choose = s.min ?? 1;
    if (field === undefined || s.options.length === 0 || choose === 0) continue;
    const choice = choices[field] ?? { choose: 0, options: {} };
    for (const o of s.options) choice.options[o.key] = true;
    choices[field] = { choose: choice.choose + choose, options: choice.options };
  }
  return choices;
}

/** The picks of a character under its race that a copy of the race holds, and the entity that has only them under the race (racePicks). */
interface RacePicks {
  /** The entity without the picks under the race that the copy does not hold as values. */
  entity: StrictEntity;
  /** The paths of the picks that the copy holds as values, such as ["race", "dwarf", "tool-proficiency", "smiths-tools"]. */
  held: string[][];
}

/**
 * The picks under the race with the key that a copy holds as fixed
 * values, because a pack race does not have their choices: the tool of a
 * Dwarf, the ability picks of a Half-Elf, the variant of a Human with its
 * picks, the ancestry of a Dragonborn, and an SRD subrace with the picks
 * under it, such as the cantrip of a High Elf. Not the picks of a choice
 * that the copy keeps (KEPT_CHOICES), and not a pack subrace, whose
 * values come from its record (withSubrace). undefined when the entity
 * has no pick under the race with the key, for example because it has
 * another race.
 */
function racePicks(entity: StrictEntity, key: string): RacePicks | undefined {
  const picks = picksUnder(entity, ["race", key]);
  if (picks.length === 0) return undefined;
  // The engine's custom subrace has picks that the probe does not read, such as a speed, so the copy does not hold it, and Save names it.
  const srdSubraces = new Set(pickableSubraces(templateRace(key, { homebrew: undefined })).map((o) => o.key));
  const dropped = (path: string[]) => (path[2] === "subrace" ? !srdSubraces.has(path[3]) : KEPT_CHOICES[path[2]] !== undefined);
  const top = picks.filter((p) => p.length === 4 && dropped(p));
  return { entity: top.reduce((result, path) => withoutOption(result, path), entity), held: picks.filter((p) => !dropped(p)) };
}

/** A copy of an SRD race for a character (srdRaceCopy). */
export interface RaceCopy {
  record: Record<string, unknown>;
  /** The paths of the character's picks under the race whose values the record has. A save of the copy removes them, but loses nothing. */
  held: string[][];
}

/**
 * The SRD race with the key as a form record in the shape of a pack race
 * (RaceForm.tsx), for its copy, or undefined if the engine's content list
 * (content/races.json) has no such race. The record has what the list has:
 * the name, the description (:help), the size, the speed, the darkvision,
 * the ability score increases, the languages, the weapon proficiencies and
 * the features (formTraits). What the list does not have comes from the
 * engine (raceGives): the skill proficiencies, the damage resistances, the
 * spells, and each trait whose name the list does not have, such as those
 * of the Tiefling. The language choice and the skill choice of the race
 * are choices of the record (raceChoices).
 *
 * With the entity of a character of this race, the record also has what
 * the character's picks under the race give, as fixed values (racePicks):
 * a tool, ability score increases, a skill, a damage resistance, and an
 * attack as a feature (breathWeaponTrait). An SRD subrace is such a pick:
 * the record has its ability score increase, its weapons, its hit points
 * for each level, its features and the spell that the character picked,
 * and its language choice is a choice of the record. held has those
 * picks.
 *
 * Without a variant pick, the Human gets +1 to each ability, which the
 * engine gives with its variant Standard Human. The race form has no
 * saving throw advantage, so the copy has it only as the text of a
 * feature. The copy has no Subrace choice. The SRD list loads once, as
 * its own chunk.
 */
export async function srdRaceCopy(key: string, entity?: StrictEntity | null): Promise<RaceCopy | undefined> {
  const race = (await srdList("races")).find((r) => r.key === key);
  if (race === undefined) return undefined;
  const { key: _key, subraces: _subraces, size, languages, "weapon-proficiencies": weapons, traits, abilities: _abilities, ...rest } = race;
  const picks = entity == null ? undefined : racePicks(entity, key);
  const held = picks?.held ?? [];
  // Without a held pick, the probe is that of the race alone, which is computed once.
  const gives = raceGives(key, held.length > 0 ? picks?.entity : undefined);
  // The engine gives the Human's +1 to each ability with the variant Standard Human, so a Human without a variant pick gets it here.
  const standard = key === "human" && !held.some((p) => p[2] === "variant");
  const abilities = standard ? Object.fromEntries(ABILITY_KEYS.map((a) => [a, 1])) : gives.abilities;
  const flags = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, true]));
  // The list has the weapons of the race. The probe also has those of a subrace.
  const allWeapons = [...new Set([...(Array.isArray(weapons) ? (weapons as string[]) : []), ...gives.weapons])];
  const props = {
    ...(allWeapons.length > 0 && { "weapon-prof": flags(allWeapons) }),
    ...(gives.hitPoints > 0 && { "max-hp-bonus": gives.hitPoints }),
    ...(gives.skills.length > 0 && { "skill-prof": flags(gives.skills) }),
    ...(gives.resistances.length > 0 && { "damage-resistance": flags(gives.resistances) }),
  };
  const profs = {
    ...(gives.tools.length > 0 && { tool: flags(gives.tools) }),
    ...raceChoices(key, subracePick(held)?.[3]),
  };
  const listed = Array.isArray(traits) ? traits : [];
  const names = new Set(listed.map((t: Record<string, unknown>) => t.name));
  const record = tagKeys({
    ...rest,
    ...(Object.keys(abilities).length > 0 && { abilities }),
    ...(Object.keys(props).length > 0 && { props }),
    ...(Object.keys(profs).length > 0 && { profs }),
    traits: [...formTraits([...listed, ...gives.traits.filter((t) => !names.has(t.name))]), ...gives.attacks.filter(hasArea).map(breathWeaponTrait)],
  }) as Record<string, unknown>;
  // A keyword value and a set, which tagKeys does not make.
  return {
    held,
    record: {
      ...record,
      ...(typeof size === "string" && { [tag("size")]: tag(size) }),
      [tag("languages")]: asSet(Array.isArray(languages) ? languages : []),
      // A spell's ability and key are keywords.
      ...(gives.spells.length > 0 && {
        [tag("spells")]: gives.spells.map(({ level, value }) => ({
          [tag("level")]: level,
          [tag("value")]: { [tag("level")]: value.level, [tag("ability")]: tag(value.ability), [tag("key")]: tag(value.key) },
        })),
      }),
    },
  };
}

/** The record of srdRaceCopy for no character: the SRD race with the key, with no value from a pick. */
export const srdRaceRecord = async (key: string): Promise<Record<string, unknown> | undefined> => (await srdRaceCopy(key))?.record;

/** The keys of the numbers of a race and its subrace that the engine adds: the hit points for each level, the number to choose of a choice, and each ability score increase. */
const SUMMED_KEYS = new Set(["max-hp-bonus", "choose", ...ABILITY_KEYS].map(tag));

/**
 * The two values at the key of a race and its subrace as one value: maps
 * as one map, and numbers that the engine adds as their sum. Else the
 * subrace's value, as for a flying speed, where the engine uses that of
 * the subrace.
 */
function merged(key: string, ofRace: unknown, ofSubrace: unknown): unknown {
  if (ofRace === undefined) return ofSubrace;
  if (typeof ofRace === "number" && typeof ofSubrace === "number") {
    return SUMMED_KEYS.has(key) ? ofRace + ofSubrace : ofSubrace;
  }
  if (!isMap(ofRace) || !isMap(ofSubrace)) return ofSubrace;
  const result: Record<string, unknown> = { ...ofRace };
  for (const [k, value] of Object.entries(ofSubrace)) result[k] = merged(k, ofRace[k], value);
  return result;
}

/** The fields of a pack subrace that replace those of the race in withSubrace, and the fields that it adds to those of the race. The other fields are the name, the key, the race and the option source. */
const SUBRACE_OWN_FIELDS = ["size", "speed", "darkvision"].map(tag);
const SUBRACE_ADDED_FIELDS = ["abilities", "props", "profs", "spells", "traits"].map(tag);
const PROFS = tag("profs");
/** The keys of the :profs of a pack subrace that the engine uses. */
const SUBRACE_PROFS = new Set(["tool", "skill-options"].map(tag));

/** The :profs of a pack subrace that the engine uses: the tools and the skill choice. undefined when it has neither. */
function subraceProfs(profs: Record<string, unknown>): Record<string, unknown> | undefined {
  const used = Object.entries(profs).filter(([key]) => SUBRACE_PROFS.has(key));
  return used.length > 0 ? Object.fromEntries(used) : undefined;
}

/**
 * The race record with the values of the pack subrace record as its own,
 * for a copy of the race of a character with that subrace (ORC-248). The
 * size, the speed and the darkvision are those of the subrace when it has
 * them. Ability score increases and the hit points for each level are
 * sums. The proficiencies, the resistances and the options of a choice
 * are those of the two together, and a choice of both has the two numbers
 * to choose together. A flying or swimming speed is that of the subrace.
 * The spells and the features of the subrace come after those of the
 * race. The only choice of a subrace that the engine offers is its skill
 * choice, so the record gets no other choice of the subrace.
 */
export function withSubrace(race: Record<string, unknown>, subrace: Record<string, unknown>): Record<string, unknown> {
  const result = { ...race };
  for (const field of SUBRACE_OWN_FIELDS) if (subrace[field] !== undefined) result[field] = subrace[field];
  for (const field of SUBRACE_ADDED_FIELDS) {
    const ofRace = race[field];
    const ofSubrace = field === PROFS && isMap(subrace[field]) ? subraceProfs(subrace[field]) : subrace[field];
    if (ofSubrace === undefined) continue;
    result[field] = Array.isArray(ofSubrace) ? [...(Array.isArray(ofRace) ? ofRace : []), ...ofSubrace] : merged(field, ofRace, ofSubrace);
  }
  return result;
}

/** The record with the skills as skill proficiencies, and with that many fewer skills to choose in its skill choice. A choice of no skill goes. */
function withPickedSkills(record: Record<string, unknown>, skills: string[]): Record<string, unknown> {
  if (skills.length === 0) return record;
  const [propsKey, skillKey, optionsKey, chooseKey] = ["props", "skill-prof", "skill-options", "choose"].map(tag);
  const props = isMap(record[propsKey]) ? record[propsKey] : {};
  const { [optionsKey]: choice, ...profs } = isMap(record[PROFS]) ? record[PROFS] : {};
  const choose = isMap(choice) ? Number(choice[chooseKey] ?? 0) - skills.length : 0;
  const { [PROFS]: _profs, ...rest } = record;
  const nextProfs = { ...profs, ...(choose > 0 && { [optionsKey]: { ...(choice as object), [chooseKey]: choose } }) };
  return {
    ...rest,
    [propsKey]: {
      ...props,
      [skillKey]: { ...(isMap(props[skillKey]) ? props[skillKey] : {}), ...Object.fromEntries(skills.map((skill) => [tag(skill), true])) },
    },
    ...(Object.keys(nextProfs).length > 0 && { [PROFS]: nextProfs }),
  };
}

/**
 * The copy of the race with the key with the values of the character's
 * pack subrace (withSubrace), and the subrace pick as a held pick. The
 * character's skill picks under the subrace are skill proficiencies of
 * the copy, and held picks: the skill choice of the copy is a choice of
 * the race, so a pick under the subrace does not stay. The copy itself
 * when the character has no subrace of the race, when the copy has the
 * subrace already (an SRD subrace, srdRaceCopy), or when no enabled pack
 * has the subrace. homebrew is the loaded content's.
 */
export function withPickedSubrace(copy: RaceCopy, key: string, entity: StrictEntity | null, homebrew: Content["homebrew"]): RaceCopy {
  const picks = entity === null ? [] : picksUnder(entity, ["race", key]);
  const pick = subracePick(picks);
  if (pick === undefined || copy.held.some((p) => p.join("/") === pick.join("/"))) return copy;
  const origin = optionOrigin(homebrew, undefined, SUBRACE_TYPE, pick[3]);
  if (origin.from !== "pack") return copy;
  const skills = picks.filter((p) => p.length === 6 && p[3] === pick[3] && p[4] === "skill-proficiency");
  return {
    record: withPickedSkills(
      withSubrace(copy.record, origin.item),
      skills.map((p) => p[5]),
    ),
    held: [...copy.held, pick, ...skills],
  };
}

/** The options under the option at path that do not resolve against the content, as missingContent gives them. */
function unresolvedUnder(entity: StrictEntity, path: string[], content: Content) {
  return missingContent(entity, content).filter((u) => u.path.length > path.length && path.every((key, i) => u.path[i] === key));
}

/** The entity without the options at the paths of the unresolved options. */
const withoutAll = (entity: StrictEntity, unresolved: { path: string[] }[]) => unresolved.reduce((result, u) => withoutOption(result, u.path), entity);

/**
 * The entity without the options under the option at path that do not
 * resolve against the content, such as a choice that the original offers
 * and its copy does not. A save of a copy drops them, so the sheet does not
 * show them as content to load. This also drops a pick that is unresolved
 * only because its pack is turned off now. entity itself when there are
 * none.
 */
export function withoutUnresolvedUnder(entity: StrictEntity, path: string[], content: Content): StrictEntity {
  return withoutAll(entity, unresolvedUnder(entity, path, content));
}

export interface SavedCopy {
  /** The entity with the copy selected and the picks under it that do not resolve removed (withoutUnresolvedUnder). */
  entity: StrictEntity;
  custom: object;
  /** The key of the copy (copyKeyOf). */
  key: string;
  /** What the character builds against with the new custom content. */
  content: Content;
  /**
   * The picks that the save removed, as their paths in the entity before
   * the save, such as ["race", "dwarf", "subrace", "custom"]. A pick
   * under a listed pick is not listed. A pick whose value the copy has
   * (Customization held) is not listed.
   */
  removed: string[][];
}

/**
 * The save of a copy: customizeOption, then the picks under the copy that
 * do not resolve go. content is what the character builds against, without
 * custom. The dialog's Save stores the result, and its line of removed
 * picks shows `removed` before Save. Throws as customizeOption throws.
 */
export function saveCopy(entity: StrictEntity, custom: object | undefined, content: Content, customization: Customization): SavedCopy {
  const next = customizeOption(entity, custom, customization);
  const key = copyKeyOf(customization.contentType, customization.item);
  const { path } = customization;
  const at = path.length - 1;
  const copyPath = [...path.slice(0, at), key];
  const withCopy = characterContent(content, next.custom);
  const under = unresolvedUnder(next.entity, copyPath, withCopy);
  const kept = withoutAll(next.entity, under);
  const held = new Set((customization.held ?? []).map((p) => p.join("/")));
  // The picks that do not resolve, and the picks under a held pick, which goes with all its picks.
  const lost = [...under.map((u) => u.path.map((k, i) => (i === at ? path[at] : k))), ...(customization.held ?? []).flatMap((p) => picksUnder(entity, p))];
  const paths = lost.filter((p) => !held.has(p.join("/")));
  const removed = paths.filter((p) => !paths.some((q) => q.length < p.length && q.every((k, i) => p[i] === k)));
  return { entity: kept, custom: next.custom, key, content: withCopy, removed };
}

/** The values of a background's starting equipment that addStartingEquipment gives: the items and the gold. */
const startingEquipment = (record: Record<string, unknown>) => [record[tag("equipment")], record[tag("treasure")]];

/**
 * The entity after a save of a background copy with the key: when the
 * items or the gold of `after` are not those of `before`, the character's
 * background starting equipment is replaced with the copy's, as a new pick
 * of a background does (engine addStartingEquipment). Else entity itself,
 * so other changes to the inventory stay. content is what the character
 * builds against with the copy.
 */
export function withCopyStartingEquipment(
  entity: StrictEntity,
  key: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  content: Content,
): StrictEntity {
  return sameRecord(startingEquipment(before), startingEquipment(after)) ? entity : engine().addStartingEquipment(entity, key, content);
}
