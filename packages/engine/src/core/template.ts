// The template: the tree of every selection and option that a rules edition
// offers. Port of orcpub.template (template.cljc:37-87).

import type { OptionValue } from "./entity.ts";
import type { Base, OptionModifier } from "./modifiers.ts";

/**
 * A condition that the built entity must meet (template/option-prereq).
 *
 * A prerequisite has two meanings. `canChoose` asks if the character can
 * choose the option now, on the built entity without it. `stillValid` asks
 * if a choice that the entity has is still valid, on the built entity with
 * it. The two differ when the choice itself changes the answer: "this feat
 * is not taken already" is false for the feat once it is chosen. Without
 * `stillValid`, the `canChoose` test is used for both.
 */
export interface Prereq<S> {
  label: string;
  canChoose: (built: S) => boolean;
  stillValid?: (built: S) => boolean;
  /** Hide the option when the condition fails, where a list would show it as unavailable. */
  hideIfFail?: boolean;
}

/** The rules that an option or a grant gives: its modifiers and its selections. */
export type OptionParts<S> = Pick<Option<S>, "modifiers" | "selections">;

export interface Option<S> {
  key: string;
  name: string;
  help?: string;
  order?: number;
  /** Applied when the option is chosen. */
  modifiers: readonly OptionModifier<S>[];
  /** Opened when the option is chosen. */
  selections: readonly Selection<S>[];
  prereqs: readonly Prereq<S>[];
  /**
   * A value for `autofill` to give the option, for a selection with
   * `requireValue`. `random` returns a number from 0 up to 1.
   */
  autofillValue?: (random: () => number) => OptionValue;
}

export interface Selection<S> {
  key: string;
  name: string;
  help?: string;
  order?: number;
  options: readonly Option<S>[];
  min: number;
  /** null for no maximum. */
  max: number | null;
  multiselect: boolean;
  /** The options are taken in order, as class levels are. */
  sequential: boolean;
  /** An option counts as chosen only when it has a value. */
  requireValue: boolean;
  tags: readonly string[];
  /**
   * The path where the choices are stored, when it is not the place of the
   * selection in the tree. Selections with the same ref are one pool: their
   * counts add up and their options merge.
   */
  ref?: readonly string[];
  /** The selection is offered only when this passes on the built entity. */
  prereq?: (built: S) => boolean;
}

export interface Template<S> {
  base: Base<S>;
  selections: readonly Selection<S>[];
}

/**
 * A key from a name (common/name-to-kw): lower case, without apostrophes,
 * and with one "-" for each run of characters that are not a letter, a
 * digit or "_". "Thieves' Tools" gives "thieves-tools". The app has the
 * same function for 2014 keys, nameToKw in packages/app/src/engine/content.ts.
 */
export function nameToKey(name: string): string {
  return name.toLowerCase().replace(/'/g, "").replace(/\W+/g, "-");
}

export interface OptionConfig<S> extends Partial<Omit<Option<S>, "name">> {
  name: string;
}

/** An option with the defaults of template/option-cfg. */
export function option<S>(config: OptionConfig<S>): Option<S> {
  return { key: nameToKey(config.name), modifiers: [], selections: [], prereqs: [], ...config };
}

export interface SelectionConfig<S> extends Partial<Omit<Selection<S>, "name" | "options">> {
  name: string;
  options: readonly Option<S>[];
}

/**
 * A selection with the defaults of template/selection-cfg: choose exactly
 * one. Without `max`, the maximum is 1. With `max: null`, a multiselect has
 * no maximum and any other selection has `min` as its maximum. A selection
 * is a multiselect when the config says so or when the given `max` is above
 * 1, so `multiselect: false` does not turn that off.
 */
export function selection<S>(config: SelectionConfig<S>): Selection<S> {
  const min = config.min ?? 1;
  const max = config.max === undefined ? 1 : (config.max ?? (config.multiselect ? null : min));
  return {
    key: nameToKey(config.name),
    sequential: false,
    requireValue: false,
    tags: [],
    ...config,
    min,
    max,
    multiselect: Boolean(config.multiselect) || (config.max ?? 1) > 1,
  };
}
