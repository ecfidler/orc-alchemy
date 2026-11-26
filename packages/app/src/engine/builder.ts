// The builder's selection pane (ORC-55): evaluate's flat selections joined
// to their template options, nested under the option that opens them, and
// grouped into the ten steps of the step rail (ORC-339,
// docs/design/character-builder.md).

import type { AvailableSelection, TemplateSelection } from "@pubdoor/dmv";
import { useMemo } from "react";
import { type Content, engine } from "./engine.ts";
import type { SheetClass, Spellcasting } from "./sheet.ts";
import { prepareCounts } from "./spell-prepare.ts";

export interface BuilderOption {
  key: string;
  name: string;
  selected: boolean;
  /** How many prerequisites the template gives the option (TemplateOption prereqs); 0 for none. */
  prereqs: number;
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
  /** Takes a number with its pick, such as hit points. */
  requireValue: boolean;
  /** The template's tags, such as starting-equipment; a merged selection has its first position's. */
  tags: string[];
  /**
   * The names of the class, subclass, background, race, subrace or feat
   * options that open the selection, such as ["Fighter"]: the nearest one
   * above each position. A merged selection has the source of each
   * position once, in the order class, background, race, feat. Empty for a
   * top-level selection.
   */
  sources: string[];
  options: BuilderOption[];
  /**
   * The selections that moved to a step from under this selection's options,
   * such as the tool of a background: shown on that step, not here. pickName
   * finds a pick in them; nodes does not walk them, so that each selection
   * shows once.
   */
  moved: BuilderSelection[];
}

/** The ten steps of the builder, in the order of the step rail (spec, "The step rail"). */
export const STEP_NAMES = ["Name", "Class", "Background", "Race", "Abilities", "Proficiencies", "Feats", "Spells", "Equipment", "Description"] as const;
export type StepName = (typeof STEP_NAMES)[number];

/** The step that a new character opens on, with the focus in the name field (`/build/{id}?step=Name`). */
export const NAME_STEP: StepName = "Name";

/** The step that Enter in the name field goes to. */
export const CLASS_STEP: StepName = "Class";

/** The step of the skills, the expertise, the languages and the tools (ORC-346). */
export const PROFICIENCIES_STEP: StepName = "Proficiencies";

/** The class level of a key of the path under a class's "levels", such as "6" for "level-6"; else null. */
export const levelOfKey = (key: string | undefined): string | null => key?.match(/^level-(\d+)$/)?.[1] ?? null;

/**
 * The heading of a section that names its sources: what it gives, the sources, and a class level when it has one:
 * "Skills: Fighter", "Expertise: Rogue 6", "Ability Score Improvement: Fighter 4".
 */
export const sourcedHeading = (what: string, sources: string[], level?: string | null) => `${what}: ${sources.join(", ")}${level ? ` ${level}` : ""}`;

export interface BuilderStep {
  name: StepName;
  selections: BuilderSelection[];
  /**
   * The step has nothing to pick for this character: no selection, or only
   * selections that allow no pick and have none, such as the feats of a
   * character with no feat to take. Name and Description are never empty,
   * because they hold fields. Spells is not empty when a class of the
   * character prepares spells, because it has spells to prepare.
   */
  empty: boolean;
}

// The steps that hold fields, so they are never empty. Name has no selection.
const FIELD_STEPS: StepName[] = ["Name", "Description"];

// A selection with one of these tags shows on the step with it, at any depth
// in the tree, as the old builder moves a class's starting equipment
// (ORC-59) and a class's or a subrace's spells (ORC-60). It stays under its
// option when that option's selection shows on the same step, such as the
// choice a starting equipment option opens. The first tag that matches wins:
// Alignment is tagged background and description.
const MOVED_TO_STEP: [tag: string, step: StepName][] = [
  ["description", "Description"],
  ["starting-equipment", "Equipment"],
  ["spells", "Spells"],
  // Skills (skill-profs), expertise, languages (language-profs), tools (tool-profs), and the armor and weapons of a custom race.
  ["profs", "Proficiencies"],
  ["feats", "Feats"],
  // The ability scores and each choice of increases (asi). The Ability Score
  // Improvement or Feat choice of a class level is tagged ability-scores
  // too, but also level, and it stays on the Class step.
  ["ability-scores", "Abilities"],
];

// A top-level selection with no tag above shows on the step of its tag here.
const TOP_LEVEL_STEP: [tag: string, step: StepName][] = [
  ["class", "Class"],
  ["background", "Background"],
  ["race", "Race"],
  ["equipment", "Equipment"],
];

/** The step that a selection with these tags moves to, if any. */
function movedStep(tags: string[]): StepName | undefined {
  return MOVED_TO_STEP.find(([tag]) => tags.includes(tag) && !(tag === "ability-scores" && tags.includes("level")))?.[1];
}

// The selections whose options are sources: a selection below one of their
// options has the option's name as its source, and the nearest one counts.
// They are the top-level class, background and race, and a subclass, a
// subrace (or a variant) and a feat at any depth. A choice of a class level,
// such as the pact boon, is tagged class too, so the class counts only at
// the top level.
const TOP_LEVEL_SOURCE_TAGS = ["class", "background", "race"];
const SOURCE_TAGS = ["subclass", "subrace", "feats"];
const isSource = (selection: BuilderSelection) =>
  selection.tags.some((tag) => SOURCE_TAGS.includes(tag) || (selection.actualPath.length === 1 && TOP_LEVEL_SOURCE_TAGS.includes(tag)));
// The order of the sources of a merged selection: by the step of its
// position's top-level selection, as the Proficiencies step orders its
// sections (class, background, race, feat).
const SOURCE_ORDER = ["class", "background", "race", "feats"];

/** Remaining picks as the engine counts them: up to min, or down to max. */
export function remainingOf(min: number | null, max: number | null, count: number) {
  if (count < (min ?? 0)) return (min ?? 0) - count;
  if (max !== null && count > max) return max - count;
  return 0;
}

/**
 * Builds the ten steps from evaluate's selections and the template shape. A
 * ref selection can appear at several tree positions, such as languages from
 * race and background. It is then one selection at each of them, as the old
 * entity/combine-selections makes it. Its min and max are the sums, and its
 * options are the union. A selection shows under the option that opens it,
 * or on the step of MOVED_TO_STEP. Top-level selections whose tags match no
 * step are left out, and so are selections the template does not have.
 */
export function builderSteps(selections: AvailableSelection[], shape: TemplateSelection[]): BuilderStep[] {
  const byPath = new Map<string, BuilderSelection>();
  const byRef = new Map<string, BuilderSelection>();
  // A merged ref selection has the template of each of its positions.
  const templates = new Map<BuilderSelection, TemplateSelection[]>();
  // The template order of each option and selection, to sort by.
  const orders = new Map<BuilderOption | BuilderSelection, number | undefined>();
  // The step that shows each selection, itself or under an option; its first position's for a merged one.
  const homes = new Map<BuilderSelection, StepName>();
  // The sources of each selection's positions, with the rank of their top-level selection.
  const sources = new Map<BuilderSelection, { name: string; rank: number }[]>();
  const steps: BuilderStep[] = STEP_NAMES.map((name) => ({ name, selections: [], empty: false }));

  for (const s of selections) {
    // The parent is the selection at the path without the last option and
    // selection keys. Under a ref selection, that path is its actualPath.
    // evaluate lists a parent before its children.
    const parentKey = JSON.stringify(s.path.slice(0, -2));
    const parent = byPath.get(parentKey) ?? byRef.get(parentKey);
    const siblings =
      s.path.length === 1 ? shape : parent && templates.get(parent)!.flatMap((t) => t.options.find((o) => o.key === s.path.at(-2))?.selections ?? []);
    const template = siblings?.find((t) => t.key === s.key);
    // Not in the template, or under a selection that is not: nowhere to show it.
    if (template === undefined) continue;
    const tags = template.tags ?? [];
    const options = template.options.map((o) => {
      const option: BuilderOption = { key: o.key, name: o.name, selected: s.selected.includes(o.key), prereqs: o.prereqs ?? 0, selections: [] };
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
        requireValue: s.requireValue === true,
        tags,
        sources: [],
        options,
        moved: [],
      };
      orders.set(node, template.order);
      if (s.ref) byRef.set(JSON.stringify(s.actualPath), node);
      templates.set(node, [template]);
      sources.set(node, []);
    }
    byPath.set(JSON.stringify(s.path), node);

    // The source of this position: the option above it if its selection is a
    // source, or else the sources of the parent.
    const rank = SOURCE_ORDER.indexOf(s.path[0]);
    const own =
      parent === undefined
        ? []
        : isSource(parent)
          ? [{ name: parent.options.find((o) => o.key === s.path.at(-2))?.name ?? s.path.at(-2)!, rank }]
          : sources.get(parent)!.map(({ name }) => ({ name, rank }));
    sources.get(node)!.push(...own);

    const parentHome = parent && homes.get(parent);
    const target = movedStep(tags) ?? (parent ? undefined : TOP_LEVEL_STEP.find(([tag]) => tags.includes(tag))?.[1]);
    if (parent && (target === undefined || target === parentHome)) {
      parent.options.find((o) => o.key === s.path.at(-2))?.selections.push(node);
      if (parentHome && !homes.has(node)) homes.set(node, parentHome);
    } else if (target) {
      // A merged ref selection, such as Wizard Spells Known, moves from each
      // of its positions, but shows on its step once.
      const step = steps.find((x) => x.name === target)!;
      if (!step.selections.includes(node)) step.selections.push(node);
      if (parent && !parent.moved.includes(node)) parent.moved.push(node);
      if (!homes.has(node)) homes.set(node, target);
    }
  }

  for (const [node, list] of sources) {
    const ranked = list.map((source, i) => ({ ...source, i, rank: source.rank === -1 ? SOURCE_ORDER.length : source.rank }));
    ranked.sort((a, b) => a.rank - b.rank || a.i - b.i);
    node.sources = [...new Set(ranked.map(({ name }) => name))];
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
  for (const step of steps) {
    sortSelections(step.selections);
    step.empty = !FIELD_STEPS.includes(step.name) && step.selections.every((node) => node.max === 0 && node.selected.length === 0);
  }
  return steps;
}

/**
 * Each node in the selections and the selections their options open, once, in tree order. `picked`: only the
 * selections of the selected options. `seen`: the nodes to leave out, which the walk adds to, so that walks of more
 * than one list give each node once.
 */
export function treeNodes(
  selections: BuilderSelection[],
  { picked = false, seen = new Set<BuilderSelection>() }: { picked?: boolean; seen?: Set<BuilderSelection> } = {},
): BuilderSelection[] {
  return selections.flatMap((node) => {
    if (seen.has(node)) return [];
    seen.add(node);
    return [node, ...node.options.flatMap((o) => (picked && !o.selected ? [] : treeNodes(o.selections, { picked, seen })))];
  });
}

const nodes = (selections: BuilderSelection[], seen?: Set<BuilderSelection>) => treeNodes(selections, { seen });

/**
 * The selections with picks to make or remove, as the old validate-selections: each merged selection once, in tree
 * order. Only tests use it now, as the count of the old validate-selections.
 */
export function unfilled(steps: BuilderStep[]): BuilderSelection[] {
  return nodes(steps.flatMap((step) => step.selections)).filter((node) => node.remaining !== 0);
}

/**
 * The name of the pick at path in the selection's tree, as "Subrace (Hill
 * Dwarf)": the name of its selection and of its option. path alternates
 * selection and option keys, as an UnresolvedKey's path does. The tree
 * has the selections that moved from it to a step, such as the languages
 * of a race. The bare option key when the tree does not have the pick.
 */
export function pickName(selection: BuilderSelection, path: string[]): string {
  const key = path.at(-1) ?? "";
  const parent = path.slice(0, -1).join("/");
  // With the selections that moved to a step from under the tree's options.
  const tree = (list: BuilderSelection[], seen = new Set<BuilderSelection>()): BuilderSelection[] =>
    nodes(list, seen).flatMap((node) => [node, ...tree(node.moved, seen)]);
  const node = tree([selection]).find((s) => s.actualPath.join("/") === parent);
  const option = node?.options.find((o) => o.key === key);
  return node && option ? `${node.name} (${option.name})` : key;
}

/**
 * The picks to make (toDo) and to remove (tooMany) in each step; the old
 * sum-remaining is their sum. Each pick counts one time, on the step that
 * shows its selection, such as a class's skills on Proficiencies and a
 * class's or a subrace's spells on Spells. A merged selection counts only in
 * the first step that shows it. Unlike the summary, this counts starting
 * equipment, as the old section headings do.
 */
export function remainingByStep(steps: BuilderStep[]): { toDo: number; tooMany: number }[] {
  const seen = new Set<BuilderSelection>();
  return steps.map((step) =>
    nodes(step.selections, seen).reduce(
      (count, { remaining }) => (remaining > 0 ? { ...count, toDo: count.toDo + remaining } : { ...count, tooMany: count.tooMany - remaining }),
      { toDo: 0, tooMany: 0 },
    ),
  );
}

/**
 * The step that the Edit button of a sheet opens (spec, "The step that opens"): the first step with picks to make or
 * to remove, or Class when no step has one.
 */
export function openingStep(steps: BuilderStep[]): StepName {
  const counts = remainingByStep(steps);
  return steps.find((_, i) => counts[i].toDo > 0 || counts[i].tooMany > 0)?.name ?? "Class";
}

/** What withSpellsToPrepare takes from the sheet. */
type PrepareSheet = { spellcasting: Spellcasting | null; classes: Pick<SheetClass, "name">[] };

/**
 * The steps with the Spells step not empty when a class of the character prepares spells: the step then has spells
 * to prepare, even with no spell to pick (spec, "The step rail"). A step that changes is a copy; steps does not change.
 */
export function withSpellsToPrepare(steps: BuilderStep[], sheet: PrepareSheet | null): BuilderStep[] {
  const prepares = sheet?.spellcasting ? prepareCounts(sheet.spellcasting, sheet.classes).length > 0 : false;
  return prepares ? steps.map((step) => (step.name === "Spells" && step.empty ? { ...step, empty: false } : step)) : steps;
}

// The template shape of the last content: the engine builds a template in about 100 ms, and does not keep it.
let shapeMemo: { homebrew: Content["homebrew"]; magicItems: Content["magicItems"]; shape: TemplateSelection[] } | null = null;

/** The template shape for the content, as builderSteps takes it. It is built again only when the content changes. */
export function templateShape({ homebrew, magicItems }: Content): TemplateSelection[] {
  if (shapeMemo === null || shapeMemo.homebrew !== homebrew || shapeMemo.magicItems !== magicItems)
    shapeMemo = { homebrew, magicItems, shape: engine().buildTemplate(homebrew, { magicItems }).shape };
  return shapeMemo.shape;
}

/**
 * The builder steps for the open character's selections; the template is built once per content. `sheet` is the open
 * character's sheet, for the Spells step of a class that prepares spells (withSpellsToPrepare).
 */
export function useBuilderSteps(
  selections: AvailableSelection[] | null,
  content: Content = { homebrew: undefined },
  sheet: PrepareSheet | null = null,
): BuilderStep[] {
  const { homebrew, magicItems } = content;
  const shape = useMemo(() => templateShape({ homebrew, magicItems }), [homebrew, magicItems]);
  const steps = useMemo(() => (selections === null ? [] : builderSteps(selections, shape)), [selections, shape]);
  return useMemo(() => withSpellsToPrepare(steps, sheet), [steps, sheet]);
}
