// The changes that a builder makes to an entity. Each function returns a new
// entity and leaves its argument as it was. Each one throws with the reason
// where the change is not allowed, as the 2014 facade does
// (`@pubdoor/dmv` select, deselect, setValue, setField, addLevel and
// removeLevel).
//
// A path is the actual path of a selection: the path where its choices are
// stored. For a selection with a ref, that is the ref.

import { type ActiveSelection, activeSelections, actualPath, availableSelections, build, canChoose, samePath } from "./build.ts";
import {
  type ChoiceTree,
  chosenOptions,
  chosenPaths,
  flattenOptions,
  type OptionValue,
  optionsAt,
  type Path,
  type StrictEntity,
  type StrictOption,
  type StrictSelection,
} from "./entity.ts";
import type { Template } from "./template.ts";

/** A change that the template does not allow. */
export class MutationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MutationError";
  }
}

const show = (path: Path) => path.join("/");

/**
 * Replaces the chosen options of the selection at `path` with the result of
 * `update`. A selection that is not in the entity yet is added, as a
 * multiselect (`options`) or a single-select (`option`). A selection that is
 * left with no options is removed. Throws when an option on the way to the
 * selection is not chosen.
 */
function updateOptionsAt(
  selections: readonly StrictSelection[] = [],
  path: Path,
  update: (options: StrictOption[]) => StrictOption[],
  multiselect: boolean,
): StrictSelection[] {
  const [key, optionKey, ...rest] = path;
  const index = selections.findIndex((s) => s.key === key);
  const current: StrictSelection = index >= 0 ? selections[index] : { key };
  const options = chosenOptions(current);
  let next: StrictSelection | null;

  if (path.length === 1) {
    const updated = update(options);
    // Keep the form that the entity has. A new selection takes the form of the template.
    const asList = current.options !== undefined || (current.option === undefined && multiselect);
    next = updated.length === 0 ? null : asList ? { key, options: updated } : { key, option: updated[0] };
  } else {
    const at = options.findIndex((o) => o.key === optionKey);
    if (at < 0) throw new MutationError(`The option "${optionKey}" of "${key}" is not chosen`);
    const child: StrictOption = { ...options[at], selections: updateOptionsAt(options[at].selections, rest, update, multiselect) };
    if (child.selections?.length === 0) delete child.selections;
    next = current.options ? { key, options: options.with(at, child) } : { key, option: child };
  }

  if (index < 0) return next ? [...selections, next] : [...selections];
  return next ? selections.with(index, next) : selections.toSpliced(index, 1);
}

function withOptionsAt<E extends ChoiceTree>(entity: E, path: Path, update: (options: StrictOption[]) => StrictOption[], multiselect: boolean): E {
  return { ...entity, selections: updateOptionsAt(entity.selections, path, update, multiselect) };
}

/** The offered selection whose choices are stored at `path`, with each ref pool as one selection. */
function offeredSelection<S>(template: Template<S>, entity: ChoiceTree, built: S, path: Path): ActiveSelection<S> {
  const found = availableSelections(entity, built, template).find((s) => samePath(actualPath(s), path));
  if (!found) throw new MutationError(`No selection is offered at "${show(path)}"`);
  return found;
}

/**
 * The selection at `path` for a removal: the offered selection with each ref
 * pool as one, or, when the template no longer offers it, the first active
 * selection at the path. Undefined for a choice that the template does not
 * have.
 */
function selectionToEdit<S>(template: Template<S>, entity: StrictEntity<NoInfer<S>>, path: Path): ActiveSelection<S> | undefined {
  const offered = availableSelections(entity, build(entity, template), template).find((s) => samePath(actualPath(s), path));
  return offered ?? activeSelections(template, chosenPaths(flattenOptions(entity))).find((s) => samePath(actualPath(s), path));
}

/** The first option of a sequential selection that is not chosen. */
function nextInSequence<S>(selection: ActiveSelection<S>, chosen: ReadonlySet<string>) {
  return selection.options.find((o) => !chosen.has(o.key));
}

/**
 * Chooses `optionKey` in the selection at `path`. In a single-select, it
 * replaces the chosen option and its choices. Throws for an option that
 * is not in the selection, is already chosen, fails a prerequisite, or does
 * not fit because the selection has its maximum. In a sequential
 * selection, only the next option can be chosen.
 */
export function select<S, E extends StrictEntity<NoInfer<S>>>(template: Template<S>, entity: E, path: Path, optionKey: string, value?: OptionValue): E {
  const built = build(entity, template);
  const selection = offeredSelection(template, entity, built, path);
  const option = selection.options.find((o) => o.key === optionKey);
  if (!option) throw new MutationError(`"${optionKey}" is not an option of "${selection.name}"`);
  const chosen = new Set(optionsAt(entity, path).map((o) => o.key));
  if (chosen.has(optionKey)) throw new MutationError(`"${option.name}" is already chosen in "${selection.name}"`);
  // "Can choose" reads the character without the option. In a single-select, the option replaces the current
  // choice, so the test reads the character without that choice too.
  const before =
    !selection.multiselect && chosen.size > 0
      ? build(
          withOptionsAt(entity, path, () => [], false),
          template,
        )
      : built;
  if (!canChoose(option, before)) {
    const labels = option.prereqs.filter((p) => !p.canChoose(before)).map((p) => p.label);
    throw new MutationError(`"${option.name}" needs: ${labels.join(", ")}`);
  }
  if (selection.sequential && nextInSequence(selection, chosen) !== option) {
    throw new MutationError(`"${selection.name}" takes its options in order, and "${option.name}" is not the next one`);
  }
  const added: StrictOption = value === undefined ? { key: optionKey } : { key: optionKey, value };
  if (!selection.multiselect) return withOptionsAt(entity, path, () => [added], false);
  if (selection.max !== null && chosen.size >= selection.max) {
    throw new MutationError(`"${selection.name}" has its maximum of ${selection.max}`);
  }
  return withOptionsAt(entity, path, (options) => [...options, added], true);
}

/**
 * Removes `optionKey` and its choices from the selection at `path`. Throws
 * for an option that is not chosen, for a single-select that needs a
 * choice (choose another option instead), and in a sequential selection
 * for an option that is not the last one. A choice that the template no
 * longer offers can always be removed.
 */
export function deselect<S, E extends StrictEntity<NoInfer<S>>>(template: Template<S>, entity: E, path: Path, optionKey: string): E {
  const chosen = optionsAt(entity, path);
  if (!chosen.some((o) => o.key === optionKey)) throw new MutationError(`"${optionKey}" is not chosen at "${show(path)}"`);
  const selection = selectionToEdit(template, entity, path);
  if (selection && !selection.multiselect && selection.min >= 1) {
    throw new MutationError(`"${selection.name}" needs a choice: choose another option in place of "${optionKey}"`);
  }
  if (selection?.sequential && chosen[chosen.length - 1].key !== optionKey) {
    throw new MutationError(`"${selection.name}" removes its options from the last one`);
  }
  return withOptionsAt(entity, path, (options) => options.filter((o) => o.key !== optionKey), true);
}

/** Sets a free value of the entity, such as the name. `undefined` removes it. */
export function setValue<V, K extends keyof V & string>(entity: StrictEntity<V>, key: K, value: V[K] | undefined): StrictEntity<V> {
  const values: Partial<V> = { ...entity.values };
  if (value === undefined) delete values[key];
  else values[key] = value;
  return { ...entity, values };
}

/**
 * Sets the value of the chosen option at `path`, which is the actual path
 * of a selection and the option key: for example a rolled Hit Point number.
 * `undefined` removes the value.
 */
export function setOptionValue<E extends ChoiceTree>(entity: E, path: Path, value: OptionValue | undefined): E {
  const selectionPath = path.slice(0, -1);
  const optionKey = path[path.length - 1];
  if (!optionsAt(entity, selectionPath).some((o) => o.key === optionKey)) throw new MutationError(`"${optionKey}" is not chosen at "${show(selectionPath)}"`);
  return withOptionsAt(
    entity,
    selectionPath,
    (options) =>
      options.map((o) => {
        if (o.key !== optionKey) return o;
        const { value: _old, ...rest } = o;
        return value === undefined ? rest : { ...rest, value };
      }),
    true,
  );
}

/** Chooses the next option of the sequential selection at `path`, such as the next class level. */
export function addNext<S, E extends StrictEntity<NoInfer<S>>>(template: Template<S>, entity: E, path: Path): E {
  const selection = offeredSelection(template, entity, build(entity, template), path);
  if (!selection.sequential) throw new MutationError(`"${selection.name}" is not sequential`);
  const next = nextInSequence(selection, new Set(optionsAt(entity, path).map((o) => o.key)));
  if (!next) throw new MutationError(`"${selection.name}" has no more options`);
  return select(template, entity, path, next.key);
}

/** Removes the last chosen option of the sequential selection at `path`. It keeps the minimum of the selection. */
export function removeLast<S, E extends StrictEntity<NoInfer<S>>>(template: Template<S>, entity: E, path: Path): E {
  const chosen = optionsAt(entity, path);
  const selection = selectionToEdit(template, entity, path);
  if (!selection?.sequential) throw new MutationError(`No sequential selection is at "${show(path)}"`);
  if (chosen.length <= selection.min) throw new MutationError(`"${selection.name}" needs at least ${selection.min}`);
  return deselect(template, entity, path, chosen[chosen.length - 1].key);
}
