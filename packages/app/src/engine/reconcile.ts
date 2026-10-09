// Missing content (quirk R8, docs/CONTENT_RECONCILIATION.md in the fork):
// the option keys of a character that the loaded packs do not resolve, with
// the engine's suggestions, and a remap of one key to a suggestion.
import type { ContentSuggestion } from "@pubdoor/dmv";
import { engine, type Homebrew, type StrictEntity } from "./engine.ts";

export type { ContentSuggestion };

export interface UnresolvedKey {
  /** The content type, such as "Subclass", or "Option" for any other option. */
  label: string;
  key: string;
  /** The option's path of keys, such as ["background", "noble"]. */
  path: string[];
  /** Loaded content that might replace the key, best first. Always empty for an "Option". */
  suggestions: ContentSuggestion[];
}

/** The option keys of the entity that do not resolve against the homebrew, or against the SRD alone without it. */
export function missingContent(entity: StrictEntity, homebrew: Homebrew | undefined): UnresolvedKey[] {
  const report = engine().reconcileMissingContent(entity, homebrew);
  return [
    ...report.items.map(({ label, key, path, suggestions }) => ({ label, key, path, suggestions })),
    ...report.unresolvedOptions.map(({ key, path }) => ({ label: "Option", key, path, suggestions: [] })),
  ];
}

// The strict entity's Transit-JSON keys.
const SELECTIONS = "~:orcpub.entity.strict/selections";
const KEY = "~:orcpub.entity.strict/key";
const OPTION = "~:orcpub.entity.strict/option";
const OPTIONS = "~:orcpub.entity.strict/options";

type Node = Record<string, unknown>;

/**
 * The entity with the option at path given the key to. path alternates
 * selection and option keys, as an UnresolvedKey's path does, and ends with
 * the option's key. The option keeps its own selections, so a remapped class
 * keeps its levels; the ones that do not fit the new key show as unresolved.
 * Throws if the path is not in the entity, or if the option's selection
 * already has an option with the key to.
 */
export function remapOption(entity: StrictEntity, path: string[], to: string): StrictEntity {
  if (typeof entity !== "object" || path.length < 2 || path.length % 2 !== 0) {
    throw new Error(`The option ${path.join(" / ")} is not in the character`);
  }
  return remapIn(entity as Node, path, to, path);
}

function remapIn(parent: Node, [selectionKey, optionKey, ...rest]: string[], to: string, path: string[]): Node {
  const notFound = () => new Error(`The option ${path.join(" / ")} is not in the character`);
  const selections = parent[SELECTIONS];
  if (!Array.isArray(selections)) throw notFound();
  const index = selections.findIndex((s: Node) => s[KEY] === `~:${selectionKey}`);
  if (index === -1) throw notFound();
  const selection = selections[index] as Node;

  const change = (option: Node): Node =>
    rest.length === 0 ? { ...option, [KEY]: `~:${to}` } : remapIn(option, rest, to, path);
  let changed: Node;
  const single = selection[OPTION] as Node | undefined;
  if (single?.[KEY] === `~:${optionKey}`) {
    changed = { ...selection, [OPTION]: change(single) };
  } else {
    const options = selection[OPTIONS];
    if (!Array.isArray(options)) throw notFound();
    const at = options.findIndex((o: Node) => o[KEY] === `~:${optionKey}`);
    if (at === -1) throw notFound();
    if (rest.length === 0 && options.some((o: Node) => o[KEY] === `~:${to}`)) {
      throw new Error(`The character already has ${to} under ${selectionKey}`);
    }
    changed = { ...selection, [OPTIONS]: options.map((o: Node, i) => (i === at ? change(o) : o)) };
  }
  return { ...parent, [SELECTIONS]: selections.map((s, i) => (i === index ? changed : s)) };
}
