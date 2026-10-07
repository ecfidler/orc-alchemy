// The builder's selection pane (ORC-55): evaluate's flat selections joined
// to their template options, nested under the option that opens them, and
// grouped into steps, as the old character_builder.cljs pages.
import { useMemo } from "react";
import type { AvailableSelection, Homebrew, TemplateSelection } from "@pubdoor/dmv";
import { engine } from "./engine.ts";

export interface BuilderOption {
  key: string;
  name: string;
  selected: boolean;
  /** The selections this option opens, when it is selected. */
  selections: BuilderSelection[];
}

export interface BuilderSelection {
  key: string;
  name: string;
  /** Where select and deselect write. */
  actualPath: string[];
  min: number | null;
  max: number | null;
  /** Picks still to make; negative for too many. */
  remaining: number;
  selected: string[];
  multiselect: boolean;
  /** Levels: picked in order, one at a time. */
  sequential: boolean;
  /** The template's tags, such as starting-equipment; a merged selection has its first position's. */
  tags: string[];
  options: BuilderOption[];
}

export interface BuilderStep {
  name: string;
  selections: BuilderSelection[];
}

// The steps and the template tags of their top-level selections. Ability
// scores and equipment get their own steps later (ORC-55 slices 2 and 4).
const STEPS: [name: string, tag: string][] = [
  ["Race", "race"],
  ["Background", "background"],
  ["Class", "class"],
  ["Feats", "feats"],
];

/** Remaining picks as the engine counts them: up to min, or down to max. */
export function remainingOf(min: number | null, max: number | null, count: number) {
  if (count < (min ?? 0)) return (min ?? 0) - count;
  if (max !== null && count > max) return max - count;
  return 0;
}

/**
 * Builds the steps from evaluate's selections and the template shape. A ref
 * selection can appear at several tree positions, such as languages from
 * race and background. It is then one selection at each of them, as the old
 * entity/combine-selections makes it. Its min and max are the sums, and its
 * options are the union. Top-level selections whose tags match no step are
 * left out, and so are selections the template does not have.
 */
export function builderSteps(selections: AvailableSelection[], shape: TemplateSelection[]): BuilderStep[] {
  const byPath = new Map<string, BuilderSelection>();
  const byRef = new Map<string, BuilderSelection>();
  // A merged ref selection has the template of each of its positions.
  const templates = new Map<BuilderSelection, TemplateSelection[]>();
  // The template order of each option and selection, to sort by.
  const orders = new Map<BuilderOption | BuilderSelection, number | undefined>();
  const steps = STEPS.map(([name]) => ({ name, selections: [] as BuilderSelection[] }));

  for (const s of selections) {
    // The parent is the selection at the path without the last option and
    // selection keys. Under a ref selection, that path is its actualPath.
    // evaluate lists a parent before its children.
    const parentKey = JSON.stringify(s.path.slice(0, -2));
    const parent = byPath.get(parentKey) ?? byRef.get(parentKey);
    const siblings =
      s.path.length === 1
        ? shape
        : parent && templates.get(parent)!.flatMap((t) => t.options.find((o) => o.key === s.path.at(-2))?.selections ?? []);
    const template = siblings?.find((t) => t.key === s.key);
    // Not in the template, or under a selection that is not: nowhere to show it.
    if (template === undefined) continue;
    const options = template.options.map((o) => {
      const option: BuilderOption = { key: o.key, name: o.name, selected: s.selected.includes(o.key), selections: [] };
      orders.set(option, o.order);
      return option;
    });
    const shared = s.ref && byRef.get(JSON.stringify(s.actualPath));
    let node: BuilderSelection;
    if (shared) {
      node = shared;
      node.min = node.min === null && s.min === null ? null : (node.min ?? 0) + (s.min ?? 0);
      node.max = node.max === null || s.max === null ? null : node.max + s.max;
      node.remaining = remainingOf(node.min, node.max, node.selected.length);
      for (const o of options) if (!node.options.some((n) => n.key === o.key)) node.options.push(o);
      templates.get(node)!.push(template);
    } else {
      node = {
        key: s.key,
        name: s.name,
        actualPath: s.actualPath,
        min: s.min,
        max: s.max,
        remaining: s.remaining,
        selected: s.selected,
        multiselect: s.multiselect === true,
        sequential: s.sequential === true,
        tags: template.tags ?? [],
        options,
      };
      orders.set(node, template.order);
      if (s.ref) byRef.set(JSON.stringify(s.actualPath), node);
      templates.set(node, [template]);
    }
    byPath.set(JSON.stringify(s.path), node);

    if (parent) {
      parent.options.find((o) => o.key === s.path.at(-2))?.selections.push(node);
    } else {
      const step = STEPS.findIndex(([, tag]) => template.tags?.includes(tag));
      if (step !== -1) steps[step].selections.push(node);
    }
  }

  // Sort once the tree is whole, because a merge adds options to a node.
  // Sort as the old builder: options by order, no order first, then by
  // name. Selections by order, 1000 without one, then by name.
  const byOrder = (missing: number) => (a: BuilderOption | BuilderSelection, b: BuilderOption | BuilderSelection) =>
    (orders.get(a) ?? missing) - (orders.get(b) ?? missing) || a.name.localeCompare(b.name);
  const sorted = new Set<BuilderSelection>();
  const sortSelections = (list: BuilderSelection[]) => {
    list.sort(byOrder(1000));
    for (const node of list) {
      if (sorted.has(node)) continue;
      sorted.add(node);
      node.options.sort(byOrder(-Infinity));
      for (const o of node.options) sortSelections(o.selections);
    }
  };
  for (const step of steps) sortSelections(step.selections);
  return steps.filter((step) => step.selections.length > 0);
}

/** Each node in the selections and the selections their options open, once, in tree order. */
function nodes(selections: BuilderSelection[], seen = new Set<BuilderSelection>()): BuilderSelection[] {
  return selections.flatMap((node) => {
    if (seen.has(node)) return [];
    seen.add(node);
    return [node, ...node.options.flatMap((o) => nodes(o.selections, seen))];
  });
}

/** The selections with picks to make or remove, as the old validate-selections: each merged selection once, in tree order. */
export function unfilled(steps: BuilderStep[]): BuilderSelection[] {
  return nodes(steps.flatMap((step) => step.selections)).filter((node) => node.remaining !== 0);
}

/**
 * The picks to make or remove in each step, as the old sum-remaining. A
 * merged selection counts only in the first step that shows it. Unlike the
 * summary, this counts starting equipment, as the old section headings do.
 */
export function stepRemaining(steps: BuilderStep[]): number[] {
  const seen = new Set<BuilderSelection>();
  return steps.map((step) => nodes(step.selections, seen).reduce((sum, node) => sum + Math.abs(node.remaining), 0));
}

/** The builder steps for the open character's selections; the template is built once per homebrew. */
export function useBuilderSteps(selections: AvailableSelection[] | null, homebrew?: Homebrew): BuilderStep[] {
  const shape = useMemo(() => engine().buildTemplate(homebrew).shape, [homebrew]);
  return useMemo(() => (selections === null ? [] : builderSteps(selections, shape)), [selections, shape]);
}
