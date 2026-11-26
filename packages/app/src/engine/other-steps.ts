// What the block of the main pick of the Background and Race steps shows (ORC-347, docs/design/character-builder.md
// "After the pick"): the left mark of the step, and the list "Picked on other steps", one line for each kind of pick
// that the option gives on another step, with the picks or the left mark and the step.

import { type BuilderSelection, type BuilderStep, type StepName, treeNodes } from "./builder.ts";
import { proficiencyKind } from "./selection-control.ts";

/** One line of "Picked on other steps": the kind, the picks, the picks left, and the step that has them. */
export interface OtherStepLine {
  kind: string;
  step: StepName;
  /** The names of the picks, in the order of the selections. */
  picks: string[];
  /** Picks still to make; negative for too many. */
  remaining: number;
}

// The kinds of line, in their order in the list, by the first rule that matches the selection.
const KINDS: [kind: string, matches: (selection: BuilderSelection) => boolean][] = [
  ["Ability scores", ({ tags }) => tags.includes("ability-scores") || tags.includes("asi")],
  ["Skills", (s) => proficiencyKind(s) === "skill"],
  ["Expertise", (s) => s.key.includes("expertise")],
  ["Languages", (s) => proficiencyKind(s) === "language"],
  ["Tools", (s) => proficiencyKind(s) === "tool"],
  ["Other proficiencies", ({ tags }) => tags.some((tag) => tag.endsWith("profs"))],
  ["Cantrip", ({ tags, key, name }) => tags.includes("spells") && /cantrip/i.test(`${key} ${name}`)],
  ["Spells", ({ tags }) => tags.includes("spells")],
  ["Feat", ({ tags }) => tags.includes("feats")],
  ["Starting equipment", ({ tags }) => tags.includes("starting-equipment")],
];

/** The kind of the line of a selection: the first of KINDS that matches it, or else its name. */
export function lineKind(selection: BuilderSelection): string {
  return KINDS.find(([, matches]) => matches(selection))?.[0] ?? selection.name;
}

/**
 * The lines of "Picked on other steps" for the main pick of `selection`, a top-level selection such as the
 * background: each selection that its picked option opens on another step of `steps`, and the selections that those
 * open, in lines by kind. A line has the picks and the picks left of all its selections. The lines are in the order of
 * KINDS, then of the names of the other kinds. A selection that two sources share, such as the Languages of a race and
 * a background, is on the line with all its picks. Empty when the option opens nothing on another step.
 */
export function otherStepLines(selection: BuilderSelection, steps: BuilderStep[]): OtherStepLine[] {
  const own = treeNodes([selection], { picked: true });
  const moved = treeNodes(
    own.flatMap((node) => node.moved),
    { picked: true },
  );
  const stepOf = new Map<BuilderSelection, StepName>();
  for (const step of steps) for (const node of treeNodes(step.selections)) if (!stepOf.has(node)) stepOf.set(node, step.name);
  const lines = new Map<string, OtherStepLine>();
  for (const node of moved) {
    const step = stepOf.get(node);
    if (step === undefined || node.max === 0) continue;
    const kind = lineKind(node);
    const line = lines.get(kind) ?? { kind, step, picks: [], remaining: 0 };
    const names = node.selected.map((key) => node.options.find((o) => o.key === key)?.name ?? key);
    lines.set(kind, { ...line, picks: [...line.picks, ...names], remaining: line.remaining + node.remaining });
  }
  const order = (kind: string) => {
    const i = KINDS.findIndex(([k]) => k === kind);
    return i < 0 ? KINDS.length : i;
  };
  return [...lines.values()].sort((a, b) => order(a.kind) - order(b.kind) || a.kind.localeCompare(b.kind));
}

/**
 * The left mark of a step from its selections and the selections that their picks open: the picks to make, or else the
 * picks to remove as a negative number, or 0. LeftMark takes it.
 */
export function stepMark(selections: BuilderSelection[]): number {
  let toDo = 0;
  let tooMany = 0;
  for (const { remaining } of treeNodes(selections, { picked: true })) {
    if (remaining > 0) toDo += remaining;
    else tooMany -= remaining;
  }
  return toDo > 0 ? toDo : tooMany > 0 ? -tooMany : 0;
}
