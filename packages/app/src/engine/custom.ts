// Character-local content (ORC-133): the customized options that one
// character holds in its record's `custom`, a single-plugin map in the form of
// a stored pack's plugin. The character builds against the loaded content
// with `custom` added as one more pack, named CUSTOM_PACK. Other characters
// never see it.
import type { Built2014 } from "@pubdoor/dmv";
import { disabledInFile, isMap, itemAt, itemsAt, nameToKw, OPTION_KEY, OPTION_PACK, tag, untag, withItem, withoutItem } from "./content.ts";
import type { Content, ContentType, StrictEntity } from "./engine.ts";
import { missingContent, remapOption } from "./reconcile.ts";

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
 * The key of a copy with the name: its nameToKw key without a "-" at the
 * start or the end, so "Skill Expert (Custom)" is skill-expert-custom. ""
 * for a name without letters or digits.
 */
export const customKey = (name: string) => nameToKw(name).replace(/^-+|-+$/g, "");

const BACKGROUNDS: ContentType = "orcpub.dnd.e5/backgrounds";

/**
 * The key of a copy of the content type with the name: the key that the
 * engine gives the option. The engine keys a background by the nameToKw key
 * of its name and ignores its stored key (ORC-130), so a background's copy
 * has that key, with its dashes: "Sage (Custom)" is sage-custom-. Each other
 * type has customKey. "" for a name without letters or digits.
 */
export function copyKey(contentType: ContentType, name: string): string {
  const key = customKey(name);
  return key !== "" && contentType === BACKGROUNDS ? nameToKw(name) : key;
}

/**
 * The item of the plugin's content type that gives the option with the
 * key: the item at the key, or for a background the last item whose name
 * gives the key, as the engine finds it.
 */
function itemFor(plugin: object, contentType: ContentType, key: string): unknown {
  const type = tag(contentType);
  if (contentType !== BACKGROUNDS) return itemAt(plugin, type, tag(key));
  return Object.values(itemsAt(plugin, type) ?? {}).findLast((item) => isMap(item) && typeof item["~:name"] === "string" && nameToKw(item["~:name"]) === key);
}

/**
 * Where a selected option comes from, by its content type and key:
 * - "custom": the character's custom content has an item with the key. The
 *   character builds with custom as the last pack, so its item is the one
 *   that the character has, even when a loaded pack has the key too.
 *   A background's item is found by the key of its name (copyKey).
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

/**
 * The text of a built-in option, such as an SRD feat, for its copy: the
 * description, or else the summary, of the character's feature with the
 * option's name, with a capital first letter. "" when the character has no
 * such feature. The engine gives no other text for a built-in option.
 * built is the character as the engine builds it (useOpenCharacter).
 */
export function builtInText(built: Built2014, name: string): string {
  const features = [built.traits, built.actions, built["bonus-actions"], built.reactions].flatMap((list) => list ?? []);
  const feature = features.find((f) => f.name === name);
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
  const name = (item as Record<string, unknown>)[tag("name")];
  const key = typeof name === "string" ? copyKey(contentType, name) : "";
  if (key === "") throw new Error("The copy needs a name with a letter or a digit");
  const type = tag(contentType);
  const without = replacedKey === undefined || replacedKey === key ? (custom ?? {}) : withoutItem(custom ?? {}, type, tag(replacedKey));
  const next = withItem(without, type, tag(key), { ...item, [KEY]: tag(key), [OPTION_PACK]: CUSTOM_PACK });
  return { entity: untag(path.at(-1)) === key ? entity : remapOption(entity, path, key), custom: next };
}

/** The value with each key of each map at any depth as a Transit keyword, as a pack item has its keys. */
const tagKeys = (value: unknown): unknown =>
  Array.isArray(value) ? value.map(tagKeys) : isMap(value) ? Object.fromEntries(Object.entries(value).map(([k, v]) => [tag(k), tagKeys(v)])) : value;

/**
 * The SRD background with the key as a form record, for its copy, or
 * undefined if the SRD has no such background. The source is the engine's
 * content list (content/backgrounds.json), which has each SRD background
 * with the fields of a pack background (BackgroundForm.tsx). The keys are
 * made Transit keywords, and the summary of a feature is its description,
 * the field that the form edits. The SRD list loads once, as its own chunk.
 */
export async function srdBackgroundRecord(key: string): Promise<Record<string, unknown> | undefined> {
  const { default: list } = await import("@pubdoor/dmv/content/backgrounds.json");
  const background = (list as Record<string, unknown>[]).find((b) => b.key === key);
  if (background === undefined) return undefined;
  const { key: _key, traits, ...rest } = background;
  const features = (Array.isArray(traits) ? traits : []).map((trait: Record<string, unknown>) => {
    const { summary, ...more } = trait;
    return more.description === undefined && typeof summary === "string" ? { ...more, description: summary } : trait;
  });
  return tagKeys({ ...rest, traits: features }) as Record<string, unknown>;
}

const SELECTIONS = "~:orcpub.entity.strict/selections";
const OPTION = "~:orcpub.entity.strict/option";
const OPTIONS = "~:orcpub.entity.strict/options";

/** The node without the option at path, which alternates selection and option keys. A selection left with no option goes too. The node itself when path is not in it. */
function withoutOptionAt(node: Record<string, unknown>, [selectionKey, optionKey, ...rest]: string[]): Record<string, unknown> {
  const selections = node[SELECTIONS];
  if (!Array.isArray(selections)) return node;
  const changed = selections.flatMap((selection: Record<string, unknown>) => {
    if (selection[OPTION_KEY] !== tag(selectionKey)) return [selection];
    const single = selection[OPTION] as Record<string, unknown> | undefined;
    if (single?.[OPTION_KEY] === tag(optionKey)) return rest.length === 0 ? [] : [{ ...selection, [OPTION]: withoutOptionAt(single, rest) }];
    const options = selection[OPTIONS];
    if (!Array.isArray(options)) return [selection];
    const kept = options.flatMap((option: Record<string, unknown>) =>
      option[OPTION_KEY] !== tag(optionKey) ? [option] : rest.length === 0 ? [] : [withoutOptionAt(option, rest)],
    );
    return kept.length === 0 ? [] : [{ ...selection, [OPTIONS]: kept }];
  });
  return { ...node, [SELECTIONS]: changed };
}

/**
 * The entity without the options under the option at path that do not
 * resolve against the content, such as a choice that the original offers
 * and its copy does not. A save of a copy drops them, so the sheet does not
 * show them as content to load. entity itself when there are none.
 */
export function withoutUnresolvedUnder(entity: StrictEntity, path: string[], content: Content): StrictEntity {
  const under = missingContent(entity, content).filter((u) => u.path.length > path.length && path.every((key, i) => u.path[i] === key));
  if (under.length === 0) return entity;
  const root = (typeof entity === "string" ? JSON.parse(entity) : entity) as Record<string, unknown>;
  return under.reduce((node, u) => withoutOptionAt(node, u.path), root);
}
