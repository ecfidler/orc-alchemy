// The facade of the 2024 engine: the functions that the app calls
// (docs/design/2024-engine.md, section "The facade"). The shapes copy the
// facade of `@pubdoor/dmv` where the shape is neutral. The built character
// is the engine's own `Built2024`.

import { autofill as autofillCore } from "../core/autofill.ts";
import { actualPath, availableSelections, buildWithContributions, countRemaining, findProblems, type Problem, selectedKeys } from "../core/build.ts";
import type { OptionValue, Path, StrictEntity } from "../core/entity.ts";
import type { Contributions } from "../core/modifiers.ts";
import * as core from "../core/mutations.ts";
import type { Pack } from "../format/schema.ts";
import type { Built2024 } from "./built.ts";
import { template2024 } from "./template.ts";

/** A stored 2024 character: the choices, and the free values. The `rules` tag is on its envelope, not here. */
export type Entity2024 = StrictEntity<Pick<Built2024, "name">>;

/**
 * One selection that the character can make now. The shape is the
 * `AvailableSelection` of the 2014 facade (`@pubdoor/dmv` 0.4.0), so the
 * builder reads both engines the same way. A `ref` pool is one entry.
 */
export interface AvailableSelection {
  key: string;
  name: string;
  path: string[];
  /** The path where the selection's choices are stored. It differs from `path` for a ref selection. */
  actualPath: string[];
  min: number;
  max: number | null;
  /** Positive when the selection needs more choices, negative when it has too many. */
  remaining: number;
  optionCount: number;
  /** The keys of the chosen options. */
  selected: string[];
  ref?: string[];
  multiselect?: true;
  sequential?: true;
  requireValue?: true;
}

/** A content pack of the user, from `loadContentPack`. Homebrew in `evaluate` arrives with ORC-235. */
export type ContentPack = Pack;

export interface EvaluateOptions2024 {
  rules: "2024";
  /** The homebrew packs of the user. The built-in content is always present. Empty until ORC-235. */
  packs?: readonly ContentPack[];
}

export interface Evaluation2024 {
  built: Built2024;
  selections: AvailableSelection[];
  problems: Problem[];
  /** For each value of `built` that modifiers changed, the changes with their name and source. */
  contributions: Contributions<Built2024>;
}

export type MutationOptions2024 = EvaluateOptions2024;

/** The template for the options. Throws for another edition, and for packs until ORC-235. */
function templateFor(options: EvaluateOptions2024) {
  if (options.rules !== "2024") throw new Error(`Unsupported rules edition: ${String(options.rules)}`);
  if (options.packs?.length) throw new Error("Homebrew packs in evaluate are not supported yet (ORC-235)");
  return template2024;
}

/** The built 2024 character of an entity, as prerequisites read it. */
export function buildCharacter(entity: Entity2024): Built2024 {
  return buildWithContributions<Built2024>(entity, template2024).built;
}

/**
 * Builds a 2024 character. Throws when options.rules is not "2024": the
 * 2014 rules are in `@pubdoor/dmv`.
 */
export function evaluate(entity: Entity2024, options: EvaluateOptions2024): Evaluation2024 {
  const template = templateFor(options);
  const { built, contributions } = buildWithContributions<Built2024>(entity, template);

  const selections = availableSelections(entity, built, template).map((selection): AvailableSelection => {
    const selected = selectedKeys(entity, selection);
    return {
      key: selection.key,
      name: selection.name,
      path: selection.path,
      actualPath: [...actualPath(selection)],
      min: selection.min,
      max: selection.max,
      remaining: countRemaining(entity, selection),
      optionCount: selection.options.length,
      selected,
      ...(selection.ref ? { ref: [...selection.ref] } : {}),
      ...(selection.multiselect ? { multiselect: true as const } : {}),
      ...(selection.sequential ? { sequential: true as const } : {}),
      ...(selection.requireValue ? { requireValue: true as const } : {}),
    };
  });

  return { built, selections, problems: findProblems(entity, built, template), contributions };
}

// The mutations. Each takes an entity and returns a new one. A path is the
// `actualPath` of a selection in `evaluate`'s selections. Each throws a
// `MutationError` with the reason where the builder must refuse the change.

const DEFAULT_OPTIONS: EvaluateOptions2024 = { rules: "2024" };

/** The path of the class levels: one sequential selection for each class. */
const levelsPath = (classKey: string): Path => ["class", classKey, "levels"];

/** Chooses `optionKey` in the selection at `path`. In a single-select, it replaces the chosen option. */
export function select(entity: Entity2024, path: Path, optionKey: string, options: MutationOptions2024 = DEFAULT_OPTIONS): Entity2024 {
  return core.select(templateFor(options), entity, path, optionKey);
}

/** Removes `optionKey` and its choices from the selection at `path`. */
export function deselect(entity: Entity2024, path: Path, optionKey: string, options: MutationOptions2024 = DEFAULT_OPTIONS): Entity2024 {
  return core.deselect(templateFor(options), entity, path, optionKey);
}

/** Sets a free value of the character, such as the name. */
export function setValue<K extends keyof NonNullable<Entity2024["values"]>>(
  entity: Entity2024,
  key: K,
  value: NonNullable<Entity2024["values"]>[K] | undefined,
): Entity2024 {
  return core.setValue(entity, key, value);
}

/**
 * Sets the value of the chosen option at `path`, a selection's actualPath
 * and the option key: the ability scores, or a rolled Hit Point number.
 */
export function setOptionValue(entity: Entity2024, path: Path, value: OptionValue | undefined): Entity2024 {
  return core.setOptionValue(entity, path, value);
}

/** Adds the next level of class `classKey`. */
export function addLevel(entity: Entity2024, classKey: string, options: MutationOptions2024 = DEFAULT_OPTIONS): Entity2024 {
  return core.addNext(templateFor(options), entity, levelsPath(classKey));
}

/** Removes the highest level of class `classKey` and its choices. Level 1 stays. */
export function removeLevel(entity: Entity2024, classKey: string, options: MutationOptions2024 = DEFAULT_OPTIONS): Entity2024 {
  return core.removeLast(templateFor(options), entity, levelsPath(classKey));
}

export interface AutofillOptions2024 extends MutationOptions2024 {
  /** A 32-bit integer. The same seed and the same entity give the same result. */
  seed: number;
}

/**
 * Completes each open selection of the character at random. It never
 * changes a choice that the entity has. It goes back from a choice that
 * leaves a selection with nothing to choose.
 */
export function autofill(entity: Entity2024, options: AutofillOptions2024): Entity2024 {
  return autofillCore(templateFor(options), entity, { seed: options.seed });
}
