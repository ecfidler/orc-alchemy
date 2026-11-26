// The strict entity as the app reads it (src/cljc/orcpub/entity/strict.cljc in the fork): its Transit-JSON keys, the
// parse of an entity that is a text, and the walk of its selections and options. The modules that read or change the
// entity's tree take the keys from here.
import type { StrictEntity } from "./engine.ts";

export const SELECTIONS = "~:orcpub.entity.strict/selections";
export const KEY = "~:orcpub.entity.strict/key";
/** The one option of a selection that takes one pick. */
export const OPTION = "~:orcpub.entity.strict/option";
/** The options of a selection that takes more than one pick. */
export const OPTIONS = "~:orcpub.entity.strict/options";
export const MAP_VALUE = "~:orcpub.entity.strict/map-value";
export const VALUES = "~:orcpub.entity.strict/values";

/** A node of the entity: the root, a selection or an option. */
export type StrictNode = Record<string, unknown>;

/** The entity as a node: a stored entity is an object; the engine also takes Transit-JSON text. */
export const rootOf = (entity: StrictEntity) => (typeof entity === "string" ? JSON.parse(entity) : entity) as StrictNode;

/** A Transit keyword, such as "~:fighter", without its "~:". */
export const unkeyword = (key: string) => key.replace(/^~:/, "");

/** The key of a selection or an option, without its "~:". */
export const keyOf = (node: StrictNode) => unkeyword(String(node[KEY]));

/** The selections of a node, or [] when it has none. */
export const selectionsOf = (node: StrictNode): StrictNode[] => (Array.isArray(node[SELECTIONS]) ? (node[SELECTIONS] as StrictNode[]) : []);

/** The options of a selection node: its one option, or its list of options. */
export function optionsOf(selection: StrictNode): StrictNode[] {
  const single = selection[OPTION];
  if (single !== undefined) return [single as StrictNode];
  const options = selection[OPTIONS];
  return Array.isArray(options) ? (options as StrictNode[]) : [];
}

/** The keys of the classes of the entity, in its order. */
export function classesOf(entity: StrictEntity): string[] {
  const selection = selectionsOf(rootOf(entity)).find((s) => s[KEY] === "~:class");
  return selection === undefined ? [] : optionsOf(selection).map(keyOf);
}
