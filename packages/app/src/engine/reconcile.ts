// Missing content (quirk R8, docs/CONTENT_RECONCILIATION.md in the fork):
// the option keys of a character that the loaded packs do not resolve, with
// the engine's suggestions, and a remap of one key to a suggestion.
import type { ContentSuggestion } from "@pubdoor/dmv";
import { OPTION_KEY } from "./content.ts";
import { type Content, engine, type StrictEntity } from "./engine.ts";

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
const KEY = OPTION_KEY;
const OPTION = "~:orcpub.entity.strict/option";
const OPTIONS = "~:orcpub.entity.strict/options";

type Node = Record<string, unknown>;

const notFound = (path: string[]) => new Error(`The option ${path.join(" / ")} is not in the character`);

/**
 * The parent with the option at path changed: path alternates selection
 * and option keys. change gets the option and its selection, and gives the
 * new option, or null to remove it; a selection left with no option goes
 * too. missing gives the result when the path is not in the parent.
 */
function changeOptionAt(parent: Node, path: string[], change: (option: Node, selection: Node) => Node | null, missing: () => Node): Node {
  const [selectionKey, optionKey, ...rest] = path;
  const selections = parent[SELECTIONS];
  if (!Array.isArray(selections)) return missing();
  const index = selections.findIndex((s: Node) => s[KEY] === `~:${selectionKey}`);
  if (index === -1) return missing();
  const selection = selections[index] as Node;

  const next = (option: Node) => (rest.length === 0 ? change(option, selection) : changeOptionAt(option, rest, change, missing));
  let changed: Node | null;
  const single = selection[OPTION] as Node | undefined;
  if (single?.[KEY] === `~:${optionKey}`) {
    const option = next(single);
    changed = option === null ? null : { ...selection, [OPTION]: option };
  } else {
    const options = selection[OPTIONS];
    if (!Array.isArray(options)) return missing();
    const at = options.findIndex((o: Node) => o[KEY] === `~:${optionKey}`);
    if (at === -1) return missing();
    const option = next(options[at]);
    const kept = option === null ? options.filter((_, i) => i !== at) : options.map((o: Node, i) => (i === at ? option : o));
    changed = kept.length === 0 ? null : { ...selection, [OPTIONS]: kept };
  }
  if (changed !== null) return { ...parent, [SELECTIONS]: selections.map((s, i) => (i === index ? changed : s)) };
  // An option with no selection left has no selections key, as the engine writes it.
  const { [SELECTIONS]: _, ...withoutSelections } = parent;
  return selections.length === 1 ? withoutSelections : { ...parent, [SELECTIONS]: selections.filter((_, i) => i !== index) };
}

/** The entity as a node: a stored entity is an object; the engine also takes Transit-JSON text. */
const rootOf = (entity: StrictEntity) => (typeof entity === "string" ? JSON.parse(entity) : entity) as Node;

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
  return changeOptionAt(
    rootOf(entity),
    path,
    (option, selection) => {
      const options = selection[OPTIONS];
      if (Array.isArray(options) && options.some((o: Node) => o[KEY] === `~:${newKey}`)) {
        throw new Error(`The character already has ${newKey} under ${path.at(-2)}`);
      }
      return { ...option, [KEY]: `~:${newKey}` };
    },
    () => {
      throw notFound(path);
    },
  );
}

/**
 * The entity without the option at path, which alternates selection and
 * option keys, and without its own selections. A selection left with no
 * option goes too. The entity as it is when the path is not in it.
 */
export function withoutOption(entity: StrictEntity, path: string[]): StrictEntity {
  if (path.length < 2 || path.length % 2 !== 0) return entity;
  let found = true;
  const result = changeOptionAt(
    rootOf(entity),
    path,
    () => null,
    () => {
      found = false;
      return {};
    },
  );
  return found ? result : entity;
}
