// Building an entity against a template. Port of the build half of
// orcpub.entity (entity.cljc:423-621 and :723-759).

import { type ChoiceTree, chosenPaths, type FlatOption, flattenOptions, optionsAt, pathKey, type StrictEntity } from "./entity.ts";
import { applyModifiers, type Base, type Modifier } from "./modifiers.ts";
import type { Option, Selection, Template } from "./template.ts";

/** A selection that the entity's choices make active, with its place in the tree. */
export interface ActiveSelection<S> extends Selection<S> {
  path: string[];
}

/** Where the choices of a selection are stored (entity/actual-path). */
export function actualPath<S>(selection: ActiveSelection<S>): readonly string[] {
  return selection.ref ?? selection.path;
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
 * (entity/collect-modifiers-2). A deferred modifier gets the value of its
 * option. A chosen option that the template does not have gives nothing.
 */
export function collectModifiers<S>(flatOptions: readonly FlatOption[], selections: readonly ActiveSelection<S>[]): Modifier<S>[] {
  const options = templateOptions(selections);
  return flatOptions.flatMap(({ path, value }) =>
    (options.get(pathKey(path))?.modifiers ?? []).flatMap((modifier) => {
      if (!("deferred" in modifier)) return [modifier];
      const optionValue = value ?? modifier.defaultValue;
      return optionValue === undefined ? [] : modifier.deferred(optionValue);
    }),
  );
}

/** The built entity: the base, the entity's values, and the modifiers of its choices (entity/build). */
export function build<S>(entity: StrictEntity<S>, template: Template<S>): S {
  const flatOptions = flattenOptions(entity);
  const selections = activeSelections(template, chosenPaths(flatOptions));
  const base = { ...template.base, ...entity.values } as Base<S>;
  return applyModifiers(base, collectModifiers(flatOptions, selections));
}

/**
 * Selections with the same ref as one selection: the counts add up and
 * the options merge, sorted by key (entity/combine-ref-selections). The
 * result takes its other fields from the first of them.
 */
function combineRefSelections<S>(selections: readonly ActiveSelection<S>[]): ActiveSelection<S> {
  const options = new Map<string, Option<S>>();
  for (const selection of selections) for (const option of selection.options) if (!options.has(option.key)) options.set(option.key, option);
  return {
    ...selections[0],
    min: selections.reduce((sum, s) => sum + s.min, 0),
    max: selections.every((s) => s.max !== null) ? selections.reduce((sum, s) => sum + (s.max ?? 0), 0) : null,
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
  return optionsAt(entity, selection.ref ?? selection.path)
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

/** true when the built entity meets every prereq of the option (entity/meets-prereqs?). */
export function meetsPrereqs<S>(option: Option<S>, built: S): boolean {
  return option.prereqs.every((prereq) => prereq.test(built));
}
