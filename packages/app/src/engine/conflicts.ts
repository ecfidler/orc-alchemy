// Key conflicts in an .orcbrew import (docs/CONFLICT_RESOLUTION.md in the
// fork): the user's choice for each conflict the engine's parseOrcbrew
// reports, applied to the homebrew it parsed, before anything is stored.
import type { KeyConflict } from "@pubdoor/dmv";
import { engine } from "./engine.ts";

export type { KeyConflict };

/**
 * What to do with one conflict. External conflicts take all three choices;
 * internal ones take rename and skip.
 * - rename: the imported item gets the engine's suggested key. For an
 *   internal conflict, every copy except the last gets its suggested key.
 * - skip: the imported item is not imported. For an internal conflict,
 *   only the last copy is kept.
 * - replace: the imported item replaces the loaded one.
 */
export type Resolution = "rename" | "skip" | "replace";

/** The choices that a conflict of this type offers. */
export const resolutionsFor = (conflict: KeyConflict): Resolution[] =>
  conflict.type === "external" ? ["rename", "skip", "replace"] : ["rename", "skip"];

/** One key that a rename changed, as the old import log lists it. */
export interface AppliedRename {
  pack: string;
  contentType: string;
  from: string;
  to: string;
}

/**
 * For an internal conflict: the packs whose copies a choice changes, each
 * with its suggested key, and the pack whose copy keeps the key. The last
 * copy keeps it.
 */
export function internalCopies(conflict: KeyConflict): { others: { source: string; newKey: string }[]; kept: string } {
  const sources = (conflict.sources ?? []) as { source: string }[];
  const renames = conflict["suggested-renames"] ?? [];
  const others = sources.slice(0, -1).map(({ source }) => ({
    source,
    newKey: renames.find((r) => r.source === source)?.["new-key"] ?? `${conflict.key}-${source}`,
  }));
  return { others, kept: sources[sources.length - 1]?.source ?? "" };
}

/**
 * Applies a choice to every conflict and returns the new homebrew and the
 * renames made. Renames go through the engine's renameKey, which rewrites
 * the references in the same pack. Throws, with the conflict's key, if a
 * conflict has no choice, has a choice its type does not offer, or if a
 * rename fails.
 */
export function resolveConflicts(
  homebrew: Record<string, object>,
  conflicts: KeyConflict[],
  choices: Record<string, Resolution>,
): { homebrew: Record<string, object>; renames: AppliedRename[] } {
  let result = homebrew;
  const renames: AppliedRename[] = [];
  const contentType = (c: KeyConflict) => c["content-type"];

  function rename(c: KeyConflict, pack: string, to: string) {
    try {
      result = engine().renameKey(result, { pack, contentType: contentType(c) as never, from: c.key, to });
    } catch (e) {
      throw new Error(`The key ${c.key} in ${pack} could not be renamed to ${to}: ${e instanceof Error ? e.message : String(e)}`);
    }
    renames.push({ pack, contentType: contentType(c), from: c.key, to });
  }

  for (const c of conflicts) {
    const choice = choices[c.id];
    if (choice === undefined || !resolutionsFor(c).includes(choice)) {
      throw new Error(`The conflict on ${c.key} has no valid choice`);
    }
    if (c.type === "external") {
      const imported = c["import-source"] ?? "";
      if (choice === "rename") rename(c, imported, c["suggested-new-key"] ?? `${c.key}-${imported}`);
      else if (choice === "skip") result = withoutItem(result, imported, contentType(c), c.key);
      else result = withoutItem(result, c["existing-source"] ?? "", contentType(c), c.key);
    } else {
      const { others } = internalCopies(c);
      for (const { source, newKey } of others) {
        if (choice === "rename") rename(c, source, newKey);
        else result = withoutItem(result, source, contentType(c), c.key);
      }
    }
  }
  return { homebrew: result, renames };
}

/**
 * The homebrew without one item. The parsed homebrew is Transit-encoded, so
 * a content type such as "orcpub.dnd.e5/races" is "~:orcpub.dnd.e5/races"
 * there, and a key such as "elf" is "~:elf".
 */
function withoutItem(homebrew: Record<string, object>, pack: string, contentType: string, key: string): Record<string, object> {
  const plugin = homebrew[pack] as Record<string, Record<string, unknown>> | undefined;
  const items = plugin?.[`~:${contentType}`];
  if (items === undefined || !(`~:${key}` in items)) return homebrew;
  const { [`~:${key}`]: _removed, ...rest } = items;
  return { ...homebrew, [pack]: { ...plugin, [`~:${contentType}`]: rest } };
}
