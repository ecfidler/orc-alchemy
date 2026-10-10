// Key conflicts in an .orcbrew import (docs/CONFLICT_RESOLUTION.md in the
// fork): the user's choice for each conflict the engine's parseOrcbrew
// reports, applied to the homebrew it parsed, before anything is stored.
import type { ContentType, KeyConflict } from "@pubdoor/dmv";
import { engine } from "./engine.ts";
import { disabledInFile, tag, withoutItem } from "./content.ts";

export type { KeyConflict };

/**
 * What to do with one conflict. External conflicts take all three choices;
 * internal ones take rename and skip.
 * - rename: the imported item gets the engine's suggested key. For an
 *   internal conflict, every copy except the kept one gets its suggested
 *   key (see internalCopies).
 * - skip: the imported item is not imported. For an internal conflict,
 *   only the kept copy stays.
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

/** The engine sets the fields a conflict of its type has; a missing one is an engine fault. */
function field(conflict: KeyConflict, name: "import-source" | "existing-source" | "suggested-new-key"): string {
  const value = conflict[name];
  if (value === undefined) throw new Error(`The conflict on ${conflict.key} has no ${name}`);
  return value;
}

/** For an internal conflict: the packs that share the key, each with its item's name if it has one. */
export const conflictSources = (conflict: KeyConflict) => (conflict.sources ?? []) as { source: string; name?: string }[];

/**
 * For an internal conflict: the packs whose copies a choice changes, each
 * with its suggested key, and the pack whose copy keeps the key. The copy
 * that keeps it is the one the old app uses: the last copy that is on. A
 * copy is off if its pack or the item carries the old app's :disabled? flag
 * in the homebrew. If every copy is off, the last copy keeps the key.
 */
export function internalCopies(
  conflict: KeyConflict,
  homebrew: Record<string, object>,
): { others: { source: string; newKey: string }[]; kept: string } {
  const sources = conflictSources(conflict).map((s) => s.source);
  const renames = conflict["suggested-renames"] ?? [];
  const on = (source: string) =>
    !disabledInFile(homebrew[source]) && !disabledInFile(itemsOf(homebrew, source, conflict["content-type"])?.[tag(conflict.key)]);
  const lastOn = sources.findLastIndex(on);
  const keptIndex = lastOn === -1 ? sources.length - 1 : lastOn;
  const others = sources.flatMap((source, i) => {
    if (i === keptIndex) return [];
    const newKey = renames.find((r) => r.source === source)?.["new-key"];
    if (newKey === undefined) throw new Error(`The conflict on ${conflict.key} has no suggested key for ${source}`);
    return [{ source, newKey }];
  });
  return { others, kept: sources[keptIndex] ?? "" };
}

/**
 * The internal conflict whose choice settles an external one, or undefined.
 * A key can have both kinds, for example in a multi-pack file loaded a
 * second time. Both choices on an internal conflict rename or remove every
 * copy but the kept one, so an external conflict on one of those copies has
 * nothing left to choose.
 */
export function settledBy(conflict: KeyConflict, conflicts: KeyConflict[], homebrew: Record<string, object>): KeyConflict | undefined {
  if (conflict.type !== "external") return undefined;
  return conflicts.find(
    (c) =>
      c.type === "internal" &&
      c["content-type"] === conflict["content-type"] &&
      c.key === conflict.key &&
      internalCopies(c, homebrew).others.some((o) => o.source === conflict["import-source"]),
  );
}

/** The conflicts that need a choice: all but the ones settledBy settles. */
export const conflictsToChoose = (conflicts: KeyConflict[], homebrew: Record<string, object>) =>
  conflicts.filter((c) => settledBy(c, conflicts, homebrew) === undefined);

/**
 * Applies a choice to each conflict that needs one, and returns the new
 * homebrew and the renames made. Renames go through the engine's renameKey,
 * which rewrites the references in the same pack. Throws, with the
 * conflict's key, in these cases:
 * - a conflict that needs a choice has none, or has one its type does not offer
 * - a conflict lacks a field that the engine sets for its type
 * - a rename fails
 */
export function applyResolutions(
  homebrew: Record<string, object>,
  conflicts: KeyConflict[],
  choices: Record<string, Resolution>,
): { homebrew: Record<string, object>; renames: AppliedRename[] } {
  let result = homebrew;
  const renames: AppliedRename[] = [];
  const contentType = (c: KeyConflict) => c["content-type"];

  function rename(c: KeyConflict, pack: string, to: string) {
    try {
      result = engine().renameKey(result, { pack, contentType: contentType(c) as ContentType, from: c.key, to });
    } catch (e) {
      throw new Error(`The key ${c.key} in ${pack} could not be renamed to ${to}: ${e instanceof Error ? e.message : String(e)}`);
    }
    renames.push({ pack, contentType: contentType(c), from: c.key, to });
  }

  const toChoose = conflictsToChoose(conflicts, homebrew);
  for (const c of toChoose) {
    const choice = choices[c.id];
    if (choice === undefined || !resolutionsFor(c).includes(choice)) {
      throw new Error(`The conflict on ${c.key} has no valid choice`);
    }
  }
  for (const c of toChoose) {
    const choice = choices[c.id];
    if (c.type === "external") {
      const imported = field(c, "import-source");
      // Two external conflicts can share one imported copy, when two loaded
      // packs have the key; after the first renames or skips it, the second has nothing to do.
      if (!hasItem(result, imported, contentType(c), c.key)) continue;
      if (choice === "rename") rename(c, imported, field(c, "suggested-new-key"));
      else if (choice === "skip") result = withoutPackItem(result, imported, contentType(c), c.key);
      else result = withoutPackItem(result, field(c, "existing-source"), contentType(c), c.key);
    } else {
      // From the homebrew as parsed: an earlier conflict's rename does not change which copy keeps this key.
      const { others } = internalCopies(c, homebrew);
      for (const { source, newKey } of others) {
        if (choice === "rename") rename(c, source, newKey);
        else result = withoutPackItem(result, source, contentType(c), c.key);
      }
    }
  }
  return { homebrew: result, renames };
}

/**
 * The items of one content type in one pack. The parsed homebrew is
 * Transit-encoded, so a content type such as "orcpub.dnd.e5/races" is
 * "~:orcpub.dnd.e5/races" there, and a key such as "elf" is "~:elf".
 */
const itemsOf = (homebrew: Record<string, object>, pack: string, contentType: string) =>
  (homebrew[pack] as Record<string, Record<string, unknown>> | undefined)?.[tag(contentType)];

const hasItem = (homebrew: Record<string, object>, pack: string, contentType: string, key: string) =>
  tag(key) in (itemsOf(homebrew, pack, contentType) ?? {});

/** The homebrew without one item, or the same homebrew if it does not have the item. */
function withoutPackItem(homebrew: Record<string, object>, pack: string, contentType: string, key: string): Record<string, object> {
  if (!hasItem(homebrew, pack, contentType, key)) return homebrew;
  return { ...homebrew, [pack]: withoutItem(homebrew[pack], tag(contentType), tag(key)) };
}
