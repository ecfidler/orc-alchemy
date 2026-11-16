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
  sameRecord,
  tag,
  untag,
  withItem,
  withoutItem,
} from "./content.ts";
import { type Content, type ContentType, engine, type StrictEntity } from "./engine.ts";
import { missingContent, remapOption, withoutOption } from "./reconcile.ts";

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
  const text = (feature?.description ?? feature?.summary ?? "").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface Customization {
  contentType: ContentType;
  /** The path of the option that the character selects now, as remapOption takes it, such as ["feats", "skill-expert"]. */
  path: string[];
  /** The copy, as the form's validator returned it. Its key comes from its name (copyKey). */
  item: object;
  /** The key of the copy in custom that item replaces, when the user edits a copy. */
  replacedKey?: string;
}

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
  const key = copyKeyOf(contentType, item);
  if (key === "") throw new Error("The copy needs a name with a letter or a digit");
  const type = tag(contentType);
  const without = replacedKey === undefined || replacedKey === key ? (custom ?? {}) : withoutItem(custom ?? {}, type, tag(replacedKey));
  const next = withItem(without, type, tag(key), { ...item, [KEY]: tag(key), [OPTION_PACK]: CUSTOM_PACK });
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
  const { default: list } = await import("@pubdoor/dmv/content/backgrounds.json");
  const background = (list as Record<string, unknown>[]).find((b) => b.key === key);
  if (background === undefined) return undefined;
  const { key: _key, traits, "equipment-choices": choices, ...rest } = background;
  const listed = Array.isArray(choices) ? choices : [];
  const allChoices = [...listed, ...templateChoices(key, listed)];
  return tagKeys({ ...rest, ...(allChoices.length > 0 && { "equipment-choices": allChoices }), traits: formTraits(traits) }) as Record<string, unknown>;
}

/** The six ability keys, as a race's :abilities has them. */
const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"].map((a) => `orcpub.dnd.e5.character/${a}`);

/**
 * The skill proficiencies that the SRD race with the key gives, such as
 * Perception for the Elf, which its content list does not have: the skills
 * of a new character with only the race, without those of a new character.
 */
function raceSkills(key: string): string[] {
  const e = engine();
  const empty = e.emptyCharacter();
  const skills = (entity: StrictEntity) => Object.keys(e.evaluate(entity).built["skill-profs"] ?? {});
  const before = skills(empty);
  return skills(e.select(empty, ["race"], key)).filter((skill) => !before.includes(skill));
}

/**
 * The SRD race with the key as a form record in the shape of a pack race
 * (RaceForm.tsx), for its copy, or undefined if the engine's content list
 * (content/races.json) has no such race. The record has what the list has:
 * the name, the description (:help), the size, the speed, the darkvision,
 * the ability score increases, the languages, the weapon proficiencies and
 * the features (formTraits). The skill proficiencies, which the list does
 * not have, come from the engine (raceSkills). The Human gets +1 to each
 * ability, which the engine gives with its variant Standard Human, so that a copy keeps
 * a standard Human's scores. The list has no damage resistances, saving
 * throw advantages, spells or choices of the race, and the copy has no
 * subraces, so those are not in the record. The SRD list loads once, as
 * its own chunk.
 */
export async function srdRaceRecord(key: string): Promise<Record<string, unknown> | undefined> {
  const { default: list } = await import("@pubdoor/dmv/content/races.json");
  const race = (list as Record<string, unknown>[]).find((r) => r.key === key);
  if (race === undefined) return undefined;
  const { key: _key, subraces: _subraces, size, languages, "weapon-proficiencies": weapons, traits, ...rest } = race;
  // The list has no ability score increases for the Human: its +1 to each ability comes from the variant Standard Human.
  if (key === "human" && rest.abilities === undefined) rest.abilities = Object.fromEntries(ABILITY_KEYS.map((a) => [a, 1]));
  const skills = raceSkills(key);
  const props = {
    ...(Array.isArray(weapons) && weapons.length > 0 && { "weapon-prof": Object.fromEntries(weapons.map((w) => [w, true])) }),
    ...(skills.length > 0 && { "skill-prof": Object.fromEntries(skills.map((s) => [s, true])) }),
  };
  const record = tagKeys({
    ...rest,
    ...(Object.keys(props).length > 0 && { props }),
    traits: formTraits(traits),
  }) as Record<string, unknown>;
  // A keyword value and a set, which tagKeys does not make.
  return {
    ...record,
    ...(typeof size === "string" && { [tag("size")]: tag(size) }),
    [tag("languages")]: asSet(Array.isArray(languages) ? languages : []),
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
   * the save, such as ["race", "dwarf", "subrace", "hill-dwarf"]. A pick
   * under a removed pick is not listed.
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
  const paths = under.map((u) => u.path.map((k, i) => (i === at ? path[at] : k)));
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
