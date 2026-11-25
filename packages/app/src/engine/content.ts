// The content of one homebrew pack, as the old My Content page lists it
// (views.cljs my-content-item): one list per content type, in its order.
import type { ContentType } from "@pubdoor/dmv";
import type { Engine, StrictEntity } from "./engine.ts";

/** The old page's lists, in its order, with the name for one item and for more, and the validator of an item. */
export const CONTENT_TYPES: { type: ContentType; one: string; many: string; validator: keyof Engine["validate"] }[] = [
  { type: "orcpub.dnd.e5/spells", one: "spell", many: "spells", validator: "spell" },
  { type: "orcpub.dnd.e5/monsters", one: "monster", many: "monsters", validator: "monster" },
  { type: "orcpub.dnd.e5/encounters", one: "encounter", many: "encounters", validator: "encounter" },
  { type: "orcpub.dnd.e5/backgrounds", one: "background", many: "backgrounds", validator: "background" },
  { type: "orcpub.dnd.e5/races", one: "race", many: "races", validator: "race" },
  { type: "orcpub.dnd.e5/subraces", one: "subrace", many: "subraces", validator: "subrace" },
  { type: "orcpub.dnd.e5/classes", one: "class", many: "classes", validator: "class" },
  { type: "orcpub.dnd.e5/subclasses", one: "subclass", many: "subclasses", validator: "subclass" },
  { type: "orcpub.dnd.e5/invocations", one: "eldritch invocation", many: "eldritch invocations", validator: "invocation" },
  { type: "orcpub.dnd.e5/boons", one: "pact boon", many: "pact boons", validator: "boon" },
  { type: "orcpub.dnd.e5/feats", one: "feat", many: "feats", validator: "feat" },
  { type: "orcpub.dnd.e5/languages", one: "language", many: "languages", validator: "language" },
  { type: "orcpub.dnd.e5/selections", one: "selection", many: "selections", validator: "selection" },
];

/**
 * The fields of a pack content type's form (BuilderType) that CONTENT_TYPES
 * holds: the content type, its validator, and the name of one item. Throws
 * for a type that is not in CONTENT_TYPES.
 */
export function packType(type: ContentType): { contentType: ContentType; validator: keyof Engine["validate"]; one: string } {
  const entry = CONTENT_TYPES.find((t) => t.type === type);
  if (entry === undefined) throw new Error(`${type} is not a pack content type`);
  return { contentType: type, validator: entry.validator, one: entry.one };
}

/** The pack name that the old class list leaves off a class's name. */
export const DEFAULT_PACK = "Default Option Source";

/**
 * A content type or key as a stored pack has it: Transit-encoded, so the type
 * "orcpub.dnd.e5/races" is "~:orcpub.dnd.e5/races" and the key "elf" is "~:elf".
 */
export const tag = (name: string) => `~:${name}`;

/** The name of a tagged keyword, without its "~:": the reverse of tag. A value that is not a string gives its text, or "" for none. */
export const untag = (value: unknown) => String(value ?? "").replace(/^~:/, "");

/** An integer map key as a stored pack has it: Transit encodes the key 3 as "~i3". */
export const intKey = (n: number) => `~i${n}`;

/** The integer of an encoded map key: the reverse of intKey. */
export const intKeyValue = (key: string) => Number(key.replace(/^~i/, ""));

/** A set as a stored pack has it: Transit encodes the set #{:a} as { "~#set": ["~:a"] }. */
export const asSet = (items: unknown[]) => ({ "~#set": items });

/** The items of a Transit-encoded set, or [] for a value that is not one. */
export const setItems = (value: unknown): unknown[] => (value as { "~#set"?: unknown[] } | undefined)?.["~#set"] ?? [];

/** Whether the value is a Transit-encoded set. */
export const isSet = (value: unknown): boolean => value !== null && typeof value === "object" && Array.isArray((value as { "~#set"?: unknown })["~#set"]);

/** A class's name as the old class list shows it: with its pack after it, unless the pack is the default one. */
export const classDisplayName = (name: string, pack: string) => (pack === DEFAULT_PACK ? name : `${name} (${pack})`);

/** The field of an item that names its pack, its option source, Transit-encoded. */
export const OPTION_PACK = "~:option-pack";

/** The key of an option in a strict entity, Transit-encoded. */
export const OPTION_KEY = "~:orcpub.entity.strict/key";

/** Whether the value is a map: an object that is not null and not an array. */
export const isMap = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The items of one tagged content type in a plugin. */
export const itemsAt = (plugin: object, taggedType: string) => (plugin as Record<string, Record<string, object> | undefined>)[taggedType];

/** One item of a plugin, by its tagged type and key. */
export const itemAt = (plugin: object, taggedType: string, taggedKey: string): object | undefined => itemsAt(plugin, taggedType)?.[taggedKey];

/** The plugin with one item replaced, by its tagged type and key. */
export const withItem = (plugin: object, taggedType: string, taggedKey: string, item: object): object => ({
  ...plugin,
  [taggedType]: { ...itemsAt(plugin, taggedType), [taggedKey]: item },
});

/** The plugin without one item, or the same plugin if it does not have the item. Takes the tagged type and key. */
export function withoutItem(plugin: object, taggedType: string, taggedKey: string): object {
  const items = itemsAt(plugin, taggedType);
  if (items === undefined || !(taggedKey in items)) return plugin;
  const { [taggedKey]: _removed, ...rest } = items;
  return { ...plugin, [taggedType]: rest };
}

/**
 * The old app's own on/off flag, :disabled?, which an .orcbrew file can carry
 * on a pack or an item. The engine leaves out a pack or item that has it.
 */
const DISABLED = "~:disabled?";

/**
 * True if the pack or item carries the old app's flag that turns it off. As
 * in the engine, any value of the flag but false and nil turns it off.
 */
export function disabledInFile(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const flag = (value as Record<string, unknown>)[DISABLED];
  return flag !== undefined && flag !== null && flag !== false;
}

/** The pack or item with the old app's flag that turns it off. */
export const withDisabledFlag = (value: object): object => ({ ...value, [DISABLED]: true });

/** The pack or item without the old app's flag. */
export function withoutDisabledFlag(value: object): object {
  const { [DISABLED]: _flag, ...rest } = value as Record<string, unknown>;
  return rest;
}

export interface PackItem {
  key: string;
  /** The key as the pack has it, for the store's item actions. */
  tagged: string;
  /** The name to show: the item's name, or its key if it has none. A class's name ends with its pack, as in the old class list. */
  name: string;
}

/** One pack's items of one content type, sorted by key as the old page sorts them. The plugin is Transit-encoded, as a stored pack is. */
export function packItems(pack: string, plugin: object, type: ContentType): PackItem[] {
  const items = (plugin as Record<string, Record<string, Record<string, unknown>> | undefined>)[tag(type)] ?? {};
  return Object.entries(items)
    .map(([tagged, item]) => {
      const key = untag(tagged);
      const name = typeof item?.["~:name"] === "string" && item["~:name"] !== "" ? item["~:name"] : key;
      return { key, tagged, name: type === "orcpub.dnd.e5/classes" ? classDisplayName(name, pack) : name };
    })
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** A name as a key, as common/name-to-kw keys it: "Lawful Good" to "lawful-good", and "Thieves' Tools" to "thieves-tools". */
export const nameToKw = (name: string) => name.toLowerCase().replace(/'/g, "").replace(/\W+/g, "-");

/** The content type of the backgrounds, whose option key comes from the name (optionKeyOf). */
export const BACKGROUND_TYPE: ContentType = "orcpub.dnd.e5/backgrounds";

/** The content type of the subraces. */
export const SUBRACE_TYPE: ContentType = "orcpub.dnd.e5/subraces";

/**
 * The key of the option that the engine makes from a pack item of the
 * content type. The engine keys a background by the nameToKw key of its
 * name and ignores the stored key (doc 01 §Known quirks, ORC-130), with each
 * "-" kept: "Sage (Custom)" is sage-custom-. Each other item, and a
 * background without a name, has its stored key, else `tagged`, its key in
 * the plugin map.
 */
export function optionKeyOf(contentType: ContentType, item: Record<string, unknown>, tagged = ""): string {
  const name = item["~:name"];
  if (contentType === BACKGROUND_TYPE && typeof name === "string" && name !== "") return nameToKw(name);
  return untag(item["~:key"] ?? tagged);
}

/** A background whose stored key is not the key of its name. */
export interface BackgroundKeyWarning {
  pack: string;
  name: string;
  key: string;
  /** The key of the name: the one a character gets the background by. */
  nameKey: string;
}

/**
 * The backgrounds of a pack whose key differs from the key of the name. The
 * engine keys a background option from its name and ignores the stored key
 * (doc 01 §Known quirks), so a character with the stored key does not find
 * the background.
 */
export function backgroundKeyWarnings(pack: string, plugin: object): BackgroundKeyWarning[] {
  const backgrounds = (itemsAt(plugin, tag(BACKGROUND_TYPE)) ?? {}) as Record<string, Record<string, unknown> | null>;
  return Object.entries(backgrounds).flatMap(([tagged, item]) => {
    const name = item?.["~:name"];
    if (item === null || typeof name !== "string" || name === "") return [];
    const key = untag(item["~:key"] ?? tagged);
    const nameKey = optionKeyOf(BACKGROUND_TYPE, item, tagged);
    return key === nameKey ? [] : [{ pack, name, key, nameKey }];
  });
}

/**
 * Whether a value of a record is the same as no value: a field that the
 * user empties holds "", a checkbox that the user clears holds false, and
 * a list with no picks holds an empty list or set.
 */
function empty(value: unknown): boolean {
  if (value === undefined || value === "" || value === false) return true;
  if (typeof value !== "object" || value === null) return false;
  return Array.isArray(value) ? value.length === 0 : filled(value).length === 0;
}

/** The entries of the object that have a value. */
const filled = (record: object) => Object.entries(record).filter(([, value]) => !empty(value));

/**
 * Whether two values of a form's record are the same. The order of the keys
 * of an object does not count, and a key with an empty value is the same
 * as no key. Thus a change that the user reverses is not a change.
 */
export function sameRecord(a: unknown, b: unknown): boolean {
  if (Object.is(a, b) || (empty(a) && empty(b))) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => sameRecord(value, b[i]));
  }
  const left = filled(a);
  const right = new Map(filled(b));
  return left.length === right.size && left.every(([key, value]) => right.has(key) && sameRecord(value, right.get(key)));
}

/** The values map of a strict entity, from its object or its JSON text; {} without one. */
export function strictValues(entity: StrictEntity): Record<string, unknown> {
  const strict = (typeof entity === "string" ? JSON.parse(entity) : entity) as { "~:orcpub.entity.strict/values"?: Record<string, unknown> };
  return strict["~:orcpub.entity.strict/values"] ?? {};
}
