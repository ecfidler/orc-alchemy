// Building an entity against a template. Port of the build half of
// orcpub.entity (entity.cljc:423-621 and :711-759), with the problems of the
// 2024 engine added.

import { type ChoiceTree, chosenPaths, type FlatOption, flattenOptions, optionsAt, type Path, pathKey, type StrictEntity } from "./entity.ts";
import { type Applied, applyModifiers, type Base, type Modifier } from "./modifiers.ts";
import type { Option, Prereq, Selection, Template } from "./template.ts";

/** A selection that the entity's choices make active, with its place in the tree. */
export interface ActiveSelection<S> extends Selection<S> {
  path: string[];
}

/** Where the choices of a selection are stored (entity/actual-path). */
export function actualPath<S>(selection: Pick<ActiveSelection<S>, "path" | "ref">): readonly string[] {
  return selection.ref ?? selection.path;
}

/** true when two paths have the same keys. */
export function samePath(a: Path, b: Path): boolean {
  return a.length === b.length && a.every((key, i) => key === b[i]);
}

/**
 * The selections that are active: those at the top of the template, and
 * those under each chosen option (entity/get-all-selections-aux-2). When
 * two selections share a ref, a chosen option opens its own selections
 * once, under the first of them.
 */
export function activeSelections<S>(template: Template<S>, chosen: ReadonlySet<string>): ActiveSelection<S>[] {
  const active: ActiveSelection<S>[] = [];
  const usedRefOptionPaths = new Set<string>();
  const walk = (selections: readonly Selection<S>[], parentPath: readonly string[]) => {
    for (const child of selections) {
      const selection: ActiveSelection<S> = { ...child, path: [...parentPath, child.key] };
      active.push(selection);
      for (const option of selection.options) {
        const optionPath = [...actualPath(selection), option.key];
        const key = pathKey(optionPath);
        if (!chosen.has(key) || usedRefOptionPaths.has(key)) continue;
        if (selection.ref) usedRefOptionPaths.add(key);
        walk(option.selections, optionPath);
      }
    }
  };
  walk(template.selections, []);
  return active;
}

/** Each option of the active selections by the path where a choice of it is stored (entity/make-template-option-map). */
function templateOptions<S>(selections: readonly ActiveSelection<S>[]): Map<string, Option<S>> {
  const options = new Map<string, Option<S>>();
  for (const selection of selections) {
    for (const option of selection.options) options.set(pathKey([...actualPath(selection), option.key]), option);
  }
  return options;
}

/**
 * The modifiers of every chosen option, in the order of the entity
 * (entity/collect-modifiers-2). Each modifier gets the path of its option
 * as its source, and the name of the option when it has no name of its
 * own. A deferred modifier gets the value of its option, or its default
 * value. With neither, it gives nothing: the Clojure core calls the
 * function with nil. A chosen option that the template does not have gives
 * nothing.
 */
export function collectModifiers<S>(flatOptions: readonly FlatOption[], selections: readonly ActiveSelection<S>[]): Modifier<S>[] {
  const options = templateOptions(selections);
  return flatOptions.flatMap(({ path, value }) => {
    const option = options.get(pathKey(path));
    if (!option) return [];
    const sourced = (modifier: Modifier<S>): Modifier<S> => ({ ...modifier, source: path, name: modifier.name ?? option.name });
    return option.modifiers.flatMap((modifier) => {
      if (!("deferred" in modifier)) return [sourced(modifier)];
      const optionValue = value ?? modifier.defaultValue;
      return optionValue === undefined ? [] : [modifier.deferred(optionValue)].flat().map(sourced);
    });
  });
}

/** The built entity and the contributions to each of its keys. */
export function buildWithContributions<S>(entity: StrictEntity<NoInfer<S>>, template: Template<S>): Applied<S> {
  const flatOptions = flattenOptions(entity);
  const selections = activeSelections(template, chosenPaths(flatOptions));
  const base = { ...template.base, ...entity.values } as Base<S>;
  return applyModifiers(base, [...(template.modifiers ?? []), ...collectModifiers(flatOptions, selections)]);
}

/** The built entity: the base, the entity's values, and the modifiers of its choices (entity/build). */
export function build<S>(entity: StrictEntity<NoInfer<S>>, template: Template<S>): S {
  return buildWithContributions(entity, template).built;
}

/**
 * Selections with the same ref as one selection: the counts add up and
 * the options merge, sorted by key (entity/combine-ref-selections). The
 * pool is a multiselect when it takes more than one choice. The result
 * takes its other fields from the first of them.
 */
function combineRefSelections<S>(selections: readonly ActiveSelection<S>[]): ActiveSelection<S> {
  const options = new Map<string, Option<S>>();
  for (const selection of selections) for (const option of selection.options) if (!options.has(option.key)) options.set(option.key, option);
  const max = selections.every((s) => s.max !== null) ? selections.reduce((sum, s) => sum + (s.max ?? 0), 0) : null;
  return {
    ...selections[0],
    min: selections.reduce((sum, s) => sum + s.min, 0),
    max,
    // Two single-selects in one pool take two choices.
    multiselect: selections.some((s) => s.multiselect) || max === null || max > 1,
    options: [...options.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
  };
}

/**
 * The selections to offer for the entity: the active selections whose
 * prereq passes, with each ref pool as one selection
 * (entity/available-selections, then entity/combine-selections without its
 * sort for display).
 */
export function availableSelections<S>(entity: ChoiceTree, built: S, template: Template<S>): ActiveSelection<S>[] {
  const qualified = activeSelections(template, chosenPaths(flattenOptions(entity))).filter((s) => !s.prereq || s.prereq(built));
  const pools = new Map<string, ActiveSelection<S>[]>();
  for (const selection of qualified) {
    if (!selection.ref) continue;
    const key = pathKey(selection.ref);
    pools.set(key, [...(pools.get(key) ?? []), selection]);
  }
  const combined: ActiveSelection<S>[] = [];
  for (const selection of qualified) {
    if (!selection.ref) {
      combined.push(selection);
      continue;
    }
    const pool = pools.get(pathKey(selection.ref));
    if (pool?.[0] === selection) combined.push(combineRefSelections(pool));
  }
  return combined;
}

/** The keys of the options chosen in a selection. With `requireValue`, an option without a value does not count. */
export function selectedKeys<S>(entity: ChoiceTree, selection: Pick<ActiveSelection<S>, "path" | "ref" | "requireValue">): string[] {
  return optionsAt(entity, actualPath(selection))
    .filter((option) => !selection.requireValue || option.value !== undefined)
    .map((option) => option.key);
}

/**
 * How many choices a selection still needs: positive when below `min`,
 * negative when above `max`, else 0 (entity/count-remaining).
 */
export function countRemaining<S>(entity: ChoiceTree, selection: ActiveSelection<S>): number {
  const count = selectedKeys(entity, selection).length;
  if (count < selection.min) return selection.min - count;
  if (selection.max !== null && count > selection.max) return selection.max - count;
  return 0;
}

/**
 * true when the character can choose the option now: the built entity,
 * which does not have the option, meets each prereq (entity/meets-prereqs?).
 */
export function canChoose<S>(option: Option<S>, built: S): boolean {
  return option.prereqs.every((prereq) => prereq.canChoose(built));
}

/** The prereqs of a chosen option that the built entity, which has the option, no longer meets. */
export function failedPrereqs<S>(option: Option<S>, built: S): Prereq<S>[] {
  return option.prereqs.filter((prereq) => !(prereq.stillValid ?? prereq.canChoose)(built));
}

/** What is wrong with one choice of an entity. */
export interface Problem {
  /**
   * `unknown-choice`: the template does not offer the choice, so it gives
   * nothing. `prerequisite`: the choice is in the template, but a
   * prerequisite fails, or its selection is not offered. It still applies.
   */
  kind: "unknown-choice" | "prerequisite";
  /** The path of the chosen option: a selection's actual path and the option key. */
  path: string[];
  reason: string;
}

const startsWith = (path: Path, prefix: Path) => prefix.length <= path.length && prefix.every((key, i) => key === path[i]);

/**
 * The problems of the entity's choices, in the order of the entity. Below
 * an unknown choice, the choices are not reported again.
 */
export function findProblems<S>(entity: ChoiceTree, built: S, template: Template<S>): Problem[] {
  const flatOptions = flattenOptions(entity);
  const selections = activeSelections(template, chosenPaths(flatOptions));
  const options = templateOptions(selections);
  const problems: Problem[] = [];
  const unknown: string[][] = [];

  for (const { path } of flatOptions) {
    if (unknown.some((prefix) => startsWith(path, prefix))) continue;
    const option = options.get(pathKey(path));
    const selectionPath = path.slice(0, -1);
    const selection = selections.find((s) => samePath(actualPath(s), selectionPath));
    if (!option) {
      const optionKey = path[path.length - 1];
      const reason = selection
        ? `"${optionKey}" is not an option of "${selection.name}"`
        : `No selection "${selectionPath[selectionPath.length - 1]}" is offered at this place`;
      problems.push({ kind: "unknown-choice", path, reason });
      unknown.push(path);
      continue;
    }
    // In a ref pool, the choice is offered when one selection of the pool is offered.
    const pool = selections.filter((s) => samePath(actualPath(s), selectionPath));
    if (selection && pool.every((s) => s.prereq && !s.prereq(built))) {
      problems.push({ kind: "prerequisite", path, reason: `"${selection.name}" is not offered: its prerequisite fails` });
    }
    for (const prereq of failedPrereqs(option, built)) {
      problems.push({ kind: "prerequisite", path, reason: `"${option.name}" needs: ${prereq.label}` });
    }
  }
  return problems;
}
