// Character-local content (ORC-133): the customized options that one
// character holds in its record's `custom`, a single-plugin map in the form of
// a stored pack's plugin. The character builds against the loaded content
// with `custom` added as one more pack, named CUSTOM_PACK. Other characters
// never see it.
import { nameToKw, tag } from "./content.ts";
import { type Content, engine, type StrictEntity } from "./engine.ts";

/** The reserved pack name of a character's custom content. An imported or saved pack cannot have it. */
export const CUSTOM_PACK = "Custom (this character)";

/** The error message when a pack has the reserved name. */
export const reservedPackMessage = (name: string = CUSTOM_PACK) =>
  `The pack name ${name} is reserved for content that one character customizes. Rename the pack.`;

const isMap = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

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

/** The plugin content type of each type that reconcileMissingContent reports with its contentType. */
const REPORTED_TYPES: Record<string, string> = {
  race: tag("orcpub.dnd.e5/races"),
  subrace: tag("orcpub.dnd.e5/subraces"),
  background: tag("orcpub.dnd.e5/backgrounds"),
  class: tag("orcpub.dnd.e5/classes"),
  subclass: tag("orcpub.dnd.e5/subclasses"),
  feat: tag("orcpub.dnd.e5/feats"),
};
const reportedTypes = new Set(Object.values(REPORTED_TYPES));

const OPTION_KEY = "~:orcpub.entity.strict/key";

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

/**
 * The custom content without the items that the entity does not select, or
 * undefined when no item is left. custom itself when nothing is dropped.
 * content is what the character builds against without custom. A race,
 * subrace, background, class, subclass or feat stays if
 * reconcileMissingContent, against content, reports its type and key as
 * missing (a subclass also by the key of its name, which its option takes).
 * An item of another type stays if the entity has an option with
 * its key, at any depth. Needs the engine loaded.
 */
export function pruneCustom(entity: StrictEntity, content: Content, custom: object | undefined): object | undefined {
  if (!hasCustomItems(custom)) return undefined;
  const report = engine().reconcileMissingContent(entity, content.homebrew, { magicItems: content.magicItems });
  const missing = new Set(report.items.map(({ contentType, key }) => `${REPORTED_TYPES[contentType]} ${tag(key)}`));
  const selected = optionKeys(entity);
  let dropped = false;
  const kept: Record<string, unknown> = {};
  for (const [type, items] of Object.entries(custom)) {
    if (!isMap(items)) {
      kept[type] = items;
      continue;
    }
    const keep = Object.entries(items).filter(([key, item]) => {
      if (!reportedTypes.has(type)) return selected.has(key);
      // A subclass option takes its key from the subclass name, not from the item's key.
      const name = isMap(item) && typeof item["~:name"] === "string" ? tag(nameToKw(item["~:name"])) : key;
      return missing.has(`${type} ${key}`) || (type === REPORTED_TYPES.subclass && missing.has(`${type} ${name}`));
    });
    if (keep.length < Object.keys(items).length) dropped = true;
    if (keep.length > 0) kept[type] = Object.fromEntries(keep);
  }
  if (!dropped) return custom;
  return hasCustomItems(kept) ? kept : undefined;
}

/** A short hash of the custom content, for a character summary's fingerprint; undefined with no items. */
export function customHash(custom: object | undefined): string | undefined {
  if (!hasCustomItems(custom)) return undefined;
  // FNV-1a, 32 bits.
  const text = JSON.stringify(custom);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * The fingerprint of a character summary: the homebrew fingerprint, and,
 * when the character has custom content, its customHash.
 */
export function summaryFingerprint(homebrewFingerprint: string, hash: string | undefined): string {
  return hash === undefined ? homebrewFingerprint : `${homebrewFingerprint}+custom:${hash}`;
}
