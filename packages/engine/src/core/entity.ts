// The strict entity: the stored character. It records only the choices, as
// a tree of selections and options. Port of orcpub.entity.strict and the
// option walk in orcpub.entity (entity.cljc:274-300).
//
// The Clojure engine has two forms, the strict entity and a raw entity whose
// selections are a map. This port has one form. Selections stay arrays, so
// their order is kept without the array-map care that entity.cljc:176 needs.

/** The value an option carries, such as a rolled hit point number or a map of ability scores. */
export type OptionValue = number | string | { readonly [key: string]: unknown };

/** One chosen option. `selections` holds the choices that the option opens. */
export interface StrictOption {
  key: string;
  value?: OptionValue;
  selections?: StrictSelection[];
}

/** The choices made in one selection. A single-select uses `option`, and a multiselect uses `options`. */
export interface StrictSelection {
  key: string;
  option?: StrictOption;
  options?: StrictOption[];
}

/** A stored character. `V` is the type of the free values, such as the name. */
export interface StrictEntity<V = Record<string, unknown>> {
  selections: StrictSelection[];
  values?: Partial<V>;
}

/** The part of an entity that the option walks read. */
export type ChoiceTree = Pick<StrictEntity, "selections">;

/** Selection key, option key, selection key, and so on. */
export type Path = readonly string[];

/** A chosen option with its full path, which ends in the option key. */
export interface FlatOption {
  path: string[];
  value?: OptionValue;
}

// The unit separator cannot occur in a key that came from a name.
const PATH_SEPARATOR = "\u001f";

/** A path as one string, for use as a map key. */
export function pathKey(path: Path): string {
  return path.join(PATH_SEPARATOR);
}

/** The options that a strict selection holds, as a list. */
export function chosenOptions(selection: StrictSelection): StrictOption[] {
  if (selection.options) return selection.options;
  return selection.option ? [selection.option] : [];
}

/**
 * Every chosen option in the entity, parents before children
 * (entity/flatten-options). The order is the order of the entity.
 */
export function flattenOptions(entity: ChoiceTree): FlatOption[] {
  const flat: FlatOption[] = [];
  const walk = (selections: StrictSelection[], path: string[]) => {
    for (const selection of selections) {
      for (const option of chosenOptions(selection)) {
        const optionPath = [...path, selection.key, option.key];
        flat.push(option.value === undefined ? { path: optionPath } : { path: optionPath, value: option.value });
        if (option.selections) walk(option.selections, optionPath);
      }
    }
  };
  walk(entity.selections, []);
  return flat;
}

/** The set of chosen option paths (entity/make-path-map). */
export function chosenPaths(flatOptions: FlatOption[]): Set<string> {
  return new Set(flatOptions.map((option) => pathKey(option.path)));
}

/**
 * The options chosen in the selection at `path`, which ends in a selection
 * key (entity/get-option with a selection's actual path). Empty when a
 * parent option is not chosen.
 */
export function optionsAt(entity: ChoiceTree, path: Path): StrictOption[] {
  let selections: StrictSelection[] | undefined = entity.selections;
  for (let i = 0; i < path.length; i += 2) {
    const selection: StrictSelection | undefined = selections?.find((s) => s.key === path[i]);
    if (!selection) return [];
    const options = chosenOptions(selection);
    if (i === path.length - 1) return options;
    selections = options.find((o) => o.key === path[i + 1])?.selections;
  }
  return [];
}
