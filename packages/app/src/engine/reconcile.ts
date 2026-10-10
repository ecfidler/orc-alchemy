// Missing content (quirk R8, docs/CONTENT_RECONCILIATION.md in the fork):
// the option keys of a character that the loaded packs do not resolve, with
// the engine's suggestions, and a remap of one key to a suggestion.
import type { ContentSuggestion } from "@pubdoor/dmv";
import { engine, type Content, type StrictEntity } from "./engine.ts";

export type { ContentSuggestion };

/** The label of an unresolved option that is not content, such as a skill. */
export const OPTION_LABEL = "Option";

export interface UnresolvedKey {
  /** The content type, such as "Subclass", or OPTION_LABEL for any other option. */
  label: string;
  key: string;
  /** The option's path of keys, such as ["background", "noble"]. */
  path: string[];
  /** Loaded content that might replace the key, best first. Always empty for an OPTION_LABEL key. */
  suggestions: ContentSuggestion[];
}

/** The option keys of the entity that do not resolve against the content, or against the SRD alone without it. */
export function missingContent(entity: StrictEntity, { homebrew, magicItems }: Content = { homebrew: undefined }): UnresolvedKey[] {
  const report = engine().reconcileMissingContent(entity, homebrew, { magicItems });
  return [
    ...report.items.map(({ label, key, path, suggestions }) => ({ label, key, path, suggestions })),
    ...report.unresolvedOptions.map(({ key, path }) => ({ label: OPTION_LABEL, key, path, suggestions: [] })),
  ];
}

// The strict entity's Transit-JSON keys.
const SELECTIONS = "~:orcpub.entity.strict/selections";
const KEY = "~:orcpub.entity.strict/key";
const OPTION = "~:orcpub.entity.strict/option";
const OPTIONS = "~:orcpub.entity.strict/options";

type Node = Record<string, unknown>;

const notFound = (path: string[]) => new Error(`The option ${path.join(" / ")} is not in the character`);

/**
 * Gives the option at path a new key, and returns the new entity. path
 * alternates selection and option keys, as an UnresolvedKey's path does. The
 * option keeps its own selections, so a remapped class keeps its levels.
 * Selections that do not fit the new key show as unresolved. Throws if the
 * path is not in the entity, or if the option's selection already has an
 * option with the new key.
 */
export function remapOption(entity: StrictEntity, path: string[], newKey: string): StrictEntity {
  if (path.length < 2 || path.length % 2 !== 0) throw notFound(path);
  // A stored entity is an object; the engine also takes Transit-JSON text.
  const root = (typeof entity === "string" ? JSON.parse(entity) : entity) as Node;
  return remapIn(root, path, newKey, path);
}

function remapIn(parent: Node, [selectionKey, optionKey, ...rest]: string[], newKey: string, path: string[]): Node {
  const selections = parent[SELECTIONS];
  if (!Array.isArray(selections)) throw notFound(path);
  const index = selections.findIndex((s: Node) => s[KEY] === `~:${selectionKey}`);
  if (index === -1) throw notFound(path);
  const selection = selections[index] as Node;

  const change = (option: Node): Node =>
    rest.length === 0 ? { ...option, [KEY]: `~:${newKey}` } : remapIn(option, rest, newKey, path);
  let changed: Node;
  const single = selection[OPTION] as Node | undefined;
  if (single?.[KEY] === `~:${optionKey}`) {
    changed = { ...selection, [OPTION]: change(single) };
  } else {
    const options = selection[OPTIONS];
    if (!Array.isArray(options)) throw notFound(path);
    const at = options.findIndex((o: Node) => o[KEY] === `~:${optionKey}`);
    if (at === -1) throw notFound(path);
    if (rest.length === 0 && options.some((o: Node) => o[KEY] === `~:${newKey}`)) {
      throw new Error(`The character already has ${newKey} under ${selectionKey}`);
    }
    changed = { ...selection, [OPTIONS]: options.map((o: Node, i) => (i === at ? change(o) : o)) };
  }
  return { ...parent, [SELECTIONS]: selections.map((s, i) => (i === index ? changed : s)) };
}
