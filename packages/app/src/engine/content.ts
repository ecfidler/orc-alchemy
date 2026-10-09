// The content of one homebrew pack, as the old My Content page lists it
// (views.cljs my-content-item): one list per content type, in its order.
import type { ContentType } from "@pubdoor/dmv";

/** The old page's lists, in its order, with the name for one item and for more. */
export const CONTENT_TYPES: { type: ContentType; one: string; many: string }[] = [
  { type: "orcpub.dnd.e5/spells", one: "spell", many: "spells" },
  { type: "orcpub.dnd.e5/monsters", one: "monster", many: "monsters" },
  { type: "orcpub.dnd.e5/encounters", one: "encounter", many: "encounters" },
  { type: "orcpub.dnd.e5/backgrounds", one: "background", many: "backgrounds" },
  { type: "orcpub.dnd.e5/races", one: "race", many: "races" },
  { type: "orcpub.dnd.e5/subraces", one: "subrace", many: "subraces" },
  { type: "orcpub.dnd.e5/classes", one: "class", many: "classes" },
  { type: "orcpub.dnd.e5/subclasses", one: "subclass", many: "subclasses" },
  { type: "orcpub.dnd.e5/invocations", one: "eldritch invocation", many: "eldritch invocations" },
  { type: "orcpub.dnd.e5/boons", one: "pact boon", many: "pact boons" },
  { type: "orcpub.dnd.e5/feats", one: "feat", many: "feats" },
  { type: "orcpub.dnd.e5/languages", one: "language", many: "languages" },
  { type: "orcpub.dnd.e5/selections", one: "selection", many: "selections" },
];

/** The pack name that the old class list leaves off a class's name. */
export const DEFAULT_PACK = "Default Option Source";

/**
 * A content type or key as a stored pack has it: Transit-encoded, so the type
 * "orcpub.dnd.e5/races" is "~:orcpub.dnd.e5/races" and the key "elf" is "~:elf".
 */
export const tag = (name: string) => `~:${name}`;

/** The plugin without one item, or the same plugin if it does not have the item. Takes the tagged type and key. */
export function withoutItem(plugin: object, taggedType: string, taggedKey: string): object {
  const items = (plugin as Record<string, Record<string, unknown> | undefined>)[taggedType];
  if (items === undefined || !(taggedKey in items)) return plugin;
  const { [taggedKey]: _removed, ...rest } = items;
  return { ...plugin, [taggedType]: rest };
}

/**
 * The old app's own on/off flag, :disabled?, which an .orcbrew file can carry
 * on a pack or an item. The engine leaves out a pack or item that has it.
 */
const DISABLED = "~:disabled?";

/** True if the pack or item carries the old app's flag that turns it off. */
export const disabledInFile = (value: unknown): boolean =>
  typeof value === "object" && value !== null && (value as Record<string, unknown>)[DISABLED] === true;

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
      const key = tagged.replace(/^~:/, "");
      const name = typeof item?.["~:name"] === "string" && item["~:name"] !== "" ? item["~:name"] : key;
      return { key, tagged, name: type === "orcpub.dnd.e5/classes" && pack !== DEFAULT_PACK ? `${name} (${pack})` : name };
    })
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
