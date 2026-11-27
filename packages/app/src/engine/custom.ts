// Character-local content (ORC-133): the customized options that one
// character holds in its record's `custom`, a single-plugin map in the form of
// a stored pack's plugin. The character builds against the loaded content
// with `custom` added as one more pack, named CUSTOM_PACK. Other characters
// never see it.
import type { Built2014 } from "@pubdoor/dmv";
import {
  BACKGROUND_TYPE,
  disabledInFile,
  isMap,
  itemAt,
  itemsAt,
  nameToKw,
  OPTION_KEY,
  OPTION_PACK,
  optionKeyOf,
  tag,
  untag,
  withItem,
  withoutItem,
} from "./content.ts";
import type { Content, ContentType, StrictEntity } from "./engine.ts";
import { missingContent, picksUnder, remapOption, withoutOption } from "./reconcile.ts";
import { capitalized } from "./sheet-text.ts";

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
export const tagKeys = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(tagKeys) : isMap(value) ? Object.fromEntries(Object.entries(value).map(([k, v]) => [tag(k), tagKeys(v)])) : value;

/**
 * The features of an SRD option in the engine's content list, as a form
 * edits them: the summary of a feature without a description is its
 * description, the field that the form edits. [] when traits is not a list.
 */
export function formTraits(traits: unknown): unknown[] {
  return (Array.isArray(traits) ? traits : []).map((trait: Record<string, unknown>) => {
    const { summary, ...more } = trait;
    return more.description === undefined && typeof summary === "string" ? { ...more, description: summary } : trait;
  });
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
