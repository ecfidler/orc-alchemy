// The rules of the section Choices of a class block (ORC-350, docs/design/character-builder.md "Choices"): which
// selections of a class are choice rows, their groups by level, what the head of a row shows, which rows are open when
// the step opens, and the line of the row "Ability Score Improvement or Feat" to the step that has its pick. The hit
// points of each level are not choice rows: they are the section Hit points (engine/classes.ts, ORC-351).

import { type BuilderOption, type BuilderSelection, type BuilderStep, levelOfKey, movedStep, type StepName, treeNodes } from "./builder.ts";
import { isHitPoints } from "./classes.ts";
import { unqualify } from "./content.ts";
import { ABILITY_NAMES, type Ability } from "./sheet.ts";

/** The key of the selection "Ability Score Improvement or Feat" of a class level. */
export const IMPROVEMENT_KEY = "asi-or-feat";

/** The option of IMPROVEMENT_KEY that gives the points of an Ability Score Improvement; the other one is "feat". */
export const IMPROVEMENT_OPTION = "ability-score-improvement";

/** How a choice row shows its control: the subclass dialog, the cards and the line of the improvement, or the control rule. */
export type ChoiceKind = "subclass" | "improvement" | "control";

/** One choice row: a selection of the class on the Class step, at the level that gives it. */
export interface ChoiceRow {
  selection: BuilderSelection;
  /** The key of the row, the same while the step is open: the text of the actualPath of its selection. */
  id: string;
  level: number;
  kind: ChoiceKind;
}

/** The rows of one class level that has a choice. */
export interface ChoiceLevel {
  level: number;
  rows: ChoiceRow[];
}

/** True for the subclass selection of a class, such as Martial Archetype. */
const isSubclass = (selection: Pick<BuilderSelection, "tags">) => selection.tags.includes("subclass");

const kindOf = (selection: BuilderSelection): ChoiceKind =>
  isSubclass(selection) ? "subclass" : selection.key === IMPROVEMENT_KEY ? "improvement" : "control";

/**
 * The choice rows of a picked class option, in groups by level, the levels in order. A level with no choice has no
 * group.
 *
 * * The selections of the class option itself, such as the Fighting Style of a fighter, are at level 1. The selections
 *   of each picked level option are at that level.
 * * The selections that a pick in a row opens on this step, such as the Dragon Ancestor of a Draconic Bloodline, are
 *   rows after it, at its level.
 * * A selection that two options share, such as the Fighting Style of a fighter and of a Champion, is one row, at the
 *   first place where it shows.
 * * The hit points of a level (isHitPoints) and a selection with no pick to make and none made are not rows.
 */
export function choiceLevels(option: BuilderOption): ChoiceLevel[] {
  const seen = new Set<BuilderSelection>();
  const rows: ChoiceRow[] = [];
  const add = (selection: BuilderSelection, level: number) => {
    if (seen.has(selection)) return;
    seen.add(selection);
    if (isHitPoints(selection) || (selection.max === 0 && selection.selected.length === 0)) return;
    rows.push({ selection, id: JSON.stringify(selection.actualPath), level, kind: kindOf(selection) });
    for (const picked of selection.options) if (picked.selected) for (const child of picked.selections) add(child, level);
  };
  for (const selection of option.selections) if (!selection.sequential) add(selection, 1);
  for (const levels of option.selections.filter((s) => s.sequential))
    for (const level of levels.options) {
      const n = Number(levelOfKey(level.key));
      if (level.selected && n > 0) for (const selection of level.selections) add(selection, n);
    }
  const byLevel = new Map<number, ChoiceRow[]>();
  for (const row of rows) byLevel.set(row.level, [...(byLevel.get(row.level) ?? []), row]);
  return [...byLevel.entries()].sort(([a], [b]) => a - b).map(([level, list]) => ({ level, rows: list }));
}

/**
 * What the head of a row shows at the right: the names of its picks when it has no pick to make or to remove, or else
 * null, for the left mark. A row with no pick and none to make shows null too: the mark "Done".
 */
export function rowPicks(selection: BuilderSelection): string[] | null {
  if (selection.remaining !== 0 || selection.selected.length === 0) return null;
  return selection.selected.map((key) => selection.options.find((o) => o.key === key)?.name ?? key);
}

/** True when the row is open when the step opens: it has picks to make or to remove. */
export const opensAtStart = (selection: BuilderSelection) => selection.remaining !== 0;

/**
 * True when a pick in the selection asks first when it removes picks (ORC-344): a choice of one pick of a class, such
 * as the subclass or "Ability Score Improvement or Feat". A pick of the class itself asks in the class block.
 */
export function asksBeforeClassPick({ actualPath, multiselect, max, tags }: BuilderSelection): boolean {
  return actualPath[0] === "class" && actualPath.length > 2 && !multiselect && max === 1 && movedStep(tags) === undefined;
}

/** The line of the row "Ability Score Improvement or Feat" after its pick: the step that has the pick, and its state. */
export interface ImprovementLine {
  step: StepName;
  /** "Place 2 points on the Abilities step", or "Pick the feat on the Feats step" ("the feats" for more than one pick). */
  text: string;
  /** The picks on that step, such as ["+1 Strength", "+1 Dexterity"] or ["Grappler"]. */
  picks: string[];
  /** Picks still to make on that step; negative for too many. */
  remaining: number;
}

/** The points of an Ability Score Improvement as text, in the order of the abilities: "+2 Strength", "+1 Dexterity". */
export function pointsText(keys: string[]): string[] {
  const count = new Map<string, number>();
  for (const key of keys) count.set(unqualify(key), (count.get(unqualify(key)) ?? 0) + 1);
  return (Object.keys(ABILITY_NAMES) as Ability[]).filter((a) => count.has(a)).map((a) => `+${count.get(a)} ${ABILITY_NAMES[a]}`);
}

/**
 * The line of the row "Ability Score Improvement or Feat" (IMPROVEMENT_KEY) after its pick, or null before the pick:
 * the selection that the pick opens on the Abilities step or the Feats step of `steps`, with its picks and the picks
 * left. The feats of all sources are one selection of the engine, so the line of a feat shows the picks and the mark
 * of that one selection.
 */
export function improvementLine(selection: BuilderSelection, steps: BuilderStep[]): ImprovementLine | null {
  const picked = selection.selected[0];
  if (picked === undefined) return null;
  const node = selection.moved.find((m) => (picked === IMPROVEMENT_OPTION ? m.key === "asi" : m.tags.includes("feats")));
  if (node === undefined) return null;
  const step = steps.find((s) => treeNodes(s.selections).includes(node))?.name;
  if (step === undefined) return null;
  if (picked === IMPROVEMENT_OPTION) {
    const n = node.max ?? node.min ?? 0;
    return { step, text: `Place ${n} ${n === 1 ? "point" : "points"} on the ${step} step`, picks: pointsText(node.selected), remaining: node.remaining };
  }
  const picks = node.selected.map((key) => node.options.find((o) => o.key === key)?.name ?? key);
  // The one selection of the feats can have more than one pick in all, such as two rows of a Fighter 6.
  const many = (node.max ?? node.min ?? 1) > 1;
  return { step, text: `Pick the ${many ? "feats" : "feat"} on the ${step} step`, picks, remaining: node.remaining };
}
