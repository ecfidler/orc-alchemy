// The rows of the Review uses page (ORC-207, docs/design/homebrew-forms.md,
// "Review uses page"): each feature of a pack that has no uses and whose
// text gives suggested uses or a hint. The features are the :traits of a
// race, subrace, background, class, subclass, feat and monster, as the forms
// have them, and a feat's own entry, from its :description. This module only
// reads a pack and makes the changed items; the page shows the rows, and the
// store saves the items (useHomebrew saveItems).
import type { Choice } from "../../engine/builder-choices.ts";
import type { ContentType } from "../../engine/engine.ts";
import { CONTENT_TYPES, tag, untag } from "../../engine/content.ts";
import { FEATURE_LIST, setIn, type Options, type Path } from "./fields.tsx";
import { MONSTER_FEATURES } from "./MonsterForm.tsx";
import { readFeatureText, suggestedTypeOption, type TypeSuggestion, type UsesHint, type UsesSuggestion } from "./suggested-uses.ts";
import { suggestedFrequency, usesKind } from "./uses.ts";

type TransitMap = Record<string, unknown>;

/** The content types whose forms have a feature list. */
const WITH_FEATURES: ContentType[] = [
  "orcpub.dnd.e5/monsters",
  "orcpub.dnd.e5/backgrounds",
  "orcpub.dnd.e5/races",
  "orcpub.dnd.e5/subraces",
  "orcpub.dnd.e5/classes",
  "orcpub.dnd.e5/subclasses",
  "orcpub.dnd.e5/feats",
];

/** The content types whose items have features, in the order of My Content, with the name of one item. */
export const FEATURE_HOLDERS = CONTENT_TYPES.filter(({ type }) => WITH_FEATURES.includes(type));

/** One feature with no uses whose text gives suggested uses or a hint. */
export interface UsesRow {
  /**
   * Names the row in its pack: its content type, its item key, the place
   * of the feature and its name. It stays the same after a reload, so the
   * skipped rows (state/skipped-uses.ts) use it.
   */
  id: string;
  /** The tagged content type of the item. */
  contentType: string;
  /** The tagged key of the item in the pack. */
  key: string;
  /** "race", "feat" … */
  one: string;
  itemName: string;
  /** The path of the feature in its item: ["traits", i], or [] for a feat's own entry. */
  path: Path;
  /** The name of the feature. For a feat's own entry, "Feat". */
  featureName: string;
  /** Names the row's controls, as the forms name a feature: "<Item> <Feature>", such as "Tidecaller Song of Courage". */
  name: string;
  /** The stored feature: a trait, or the feat itself. */
  feature: TransitMap;
  uses: UsesSuggestion | UsesHint;
  /** The suggested type, only when the stored type is Other and the type list of the form has it, as the form shows its line. */
  type: { suggestion: TypeSuggestion; value: unknown } | null;
  /** The type list of the form, as its Type select has it. */
  types: Options;
  /**
   * Whose level a level amount counts: a class feature counts its class,
   * named as the class form names it; a subclass feature counts its class,
   * by the key without its "~:"; any other feature counts the character
   * level (null). levelName gives the name that the uses control takes.
   */
  level: { className: string } | { parentClass: string } | null;
}

const isMap = (value: unknown): value is TransitMap => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/**
 * The class whose level a level amount of the row counts, as the uses
 * control takes it, and named as the class and subclass forms name it: a
 * class feature by the class's name, a subclass feature by the name of its
 * class in classes (the class list of the forms). Null for the character
 * level.
 */
export function levelName({ level }: UsesRow, classes: readonly Choice[]): string | null {
  if (level === null) return null;
  if ("className" in level) return level.className;
  return classes.find((c) => c.key === level.parentClass)?.name ?? "Class";
}

/** Whose level a level amount of the item's features counts (UsesRow level). */
function levelOf(type: ContentType, item: TransitMap): UsesRow["level"] {
  // As ClassForm.tsx and SubclassForm.tsx give it to their feature lists.
  if (type === "orcpub.dnd.e5/classes") return { className: text(item[tag("name")]) || "Class" };
  if (type === "orcpub.dnd.e5/subclasses") return { parentClass: untag(item[tag("class")]) };
  return null;
}

/** The row of one feature, or null when it has uses or its text gives no uses and no hint. */
function rowOf(
  holder: { type: ContentType; one: string },
  key: string,
  itemName: string,
  path: Path,
  featureName: string,
  feature: TransitMap,
  types: Options,
  level: UsesRow["level"],
): UsesRow | null {
  if (usesKind(feature[tag("frequency")]) !== "none") return null;
  const description = feature[tag("description")];
  const reading = typeof description === "string" ? readFeatureText(description) : null;
  if (reading?.uses == null) return null;
  const option = suggestedTypeOption(reading.type, feature[tag("type")], types);
  return {
    id: JSON.stringify([holder.type, untag(key), path.join("/"), featureName]),
    contentType: tag(holder.type),
    key,
    one: holder.one,
    itemName,
    path,
    featureName,
    name: `${itemName} ${featureName}`,
    feature,
    uses: reading.uses,
    type: option && reading.type ? { suggestion: reading.type, value: option[0] } : null,
    types,
    level,
  };
}

const cache = new WeakMap<object, UsesRow[]>();

/**
 * The rows of a stored pack (its plugin, Transit-encoded): in the order of
 * FEATURE_HOLDERS, then by item key, then in the order of the features. A
 * feat's own entry comes before its features. The rows of a plugin object
 * are worked out once.
 */
export function usesRows(plugin: object): UsesRow[] {
  const known = cache.get(plugin);
  if (known) return known;
  const rows: UsesRow[] = [];
  for (const holder of FEATURE_HOLDERS) {
    const items = (plugin as Record<string, unknown>)[tag(holder.type)];
    if (!isMap(items)) continue;
    const types = holder.type === "orcpub.dnd.e5/monsters" ? MONSTER_FEATURES.types : FEATURE_LIST.types;
    for (const key of Object.keys(items).sort()) {
      const item = items[key];
      if (!isMap(item)) continue;
      const itemName = text(item[tag("name")]) || untag(key);
      const level = levelOf(holder.type, item);
      const add = (row: UsesRow | null) => row && rows.push(row);
      if (holder.type === "orcpub.dnd.e5/feats") add(rowOf(holder, key, itemName, [], "Feat", item, FEATURE_LIST.types, null));
      const traits = item[tag("traits")];
      if (!Array.isArray(traits)) continue;
      traits.forEach((trait, i) => {
        if (isMap(trait)) add(rowOf(holder, key, itemName, ["traits", i], text(trait[tag("name")]) || `Feature ${i + 1}`, trait, types, level));
      });
    }
  }
  cache.set(plugin, rows);
  return rows;
}

/** The number of rows of the pack that are not skipped: the "N features may have uses" of the import log and My Content. */
export const usesCount = (plugin: object, skipped: readonly string[]) => usesRows(plugin).filter((row) => !skipped.includes(row.id)).length;

/** "1 feature may have uses", "3 features may have uses". */
export const usesCountText = (n: number) => `${n} ${n === 1 ? "feature may" : "features may"} have uses`;

/** The link of the Review uses page of a pack. */
export const reviewUsesPath = (pack: string) => `/content/review-uses/${encodeURIComponent(pack)}`;

/** What the user chose in a row: the frequency to store (undefined for none), and the type to store. */
export interface RowChoice {
  frequency: TransitMap | undefined;
  type: unknown;
}

/**
 * The choice that a row starts with: the suggested uses as the uses control
 * writes them (a hint has none), and the suggested type, or else the stored
 * type.
 */
export function startChoice(row: UsesRow): RowChoice {
  return {
    frequency: row.uses.kind === "suggestion" ? suggestedFrequency(row.uses.uses) : undefined,
    type: row.type ? row.type.value : row.feature[tag("type")],
  };
}

/**
 * The item with the choices of its rows, as the form writes them: :frequency
 * at the path of each feature, and :type when the choice differs from the
 * stored type. A choice with no uses changes nothing. A type of "" stores no type, as the
 * monster's Other. Every other key stays.
 */
export function withChoices(item: object, choices: { row: UsesRow; choice: RowChoice }[]): object {
  return choices.reduce<unknown>((result, { row, choice }) => {
    // A row with no uses writes nothing, not even its type. The page does not send such a row; this is a safety net.
    if (choice.frequency === undefined) return result;
    const withFrequency = setIn(result, [...row.path, "frequency"], choice.frequency);
    if (choice.type === row.feature[tag("type")]) return withFrequency;
    return setIn(withFrequency, [...row.path, "type"], choice.type === "" ? undefined : choice.type);
  }, item) as object;
}
