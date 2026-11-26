// The picks that a change removes, and the question before it (ORC-344, docs/design/character-builder.md "A change
// that removes picks"). One plan covers the five changes of the spec's table: a different class in the place of a
// class, a lower level, a removed class, a different background or race (any one-pick selection), and an option that
// gives a skill, a language or a tool that the player picked for a different source. The plan names the picks that go,
// and gives the entity with those picks removed before the engine gets the change, so the engine never gets the two
// picks together (the dead end of the ORC-329 research: a Cleric with Insight and Religion takes Acolyte).

import { type BuilderSelection, type BuilderStep, builderSteps, levelOfKey, STEP_NAMES, type StepName, templateShape, treeNodes } from "./builder.ts";
import { replaceClass } from "./class-block.ts";
import type { Content, Engine, StrictEntity } from "./engine.ts";
import { isSoleSubracePick, withSoleSubrace } from "./race-step.ts";
import { withoutOption } from "./reconcile.ts";
import { proficiencyKind } from "./selection-control.ts";
import { keyOf, optionsOf, rootOf, type StrictNode, selectionsOf } from "./strict.ts";

/** A change that can remove picks. Each key is an option key, as the engine takes it. */
export type PickChange =
  /** A pick in a selection of one pick, such as the race or the background: `to` in the place of the current pick. */
  | { kind: "pick"; path: string[]; to: string }
  /** The class `from` replaced with `to`, at level 1, in its place (setClass). */
  | { kind: "replace-class"; from: string; to: string }
  /** The class lowered to `level` (removeLevel until it is there). */
  | { kind: "lower-level"; classKey: string; level: number }
  /** The class removed (removeClass). */
  | { kind: "remove-class"; classKey: string };

/** The button of the question that makes the change. */
export type ChangeAction = "Replace" | "Remove" | "Change";

/** A row of the question: the step or the level at the left, the selection and its picks that go at the right. */
export interface RemovedRow {
  /**
   * The step, such as "Proficiencies", or the level of a class's level choice, such as "Level 4"; for a class other
   * than the class of the change, with its name: "Wizard level 2".
   */
  place: string;
  /**
   * The selection's name: "Skills", "Tools", "Languages" or "Expertise" for a selection of skills, tools, languages
   * or expertise, and else the engine's name, such as "Fighting Style".
   */
  selection: string;
  /** The names of the picks that go, in the order of the selection's picks. */
  picks: string[];
}

/** The question before a change that removes picks: "Replace Half-Elf with Dwarf?", the rows, and the action. */
export interface ChangeQuestion {
  title: string;
  action: ChangeAction;
  /** In the order of the steps of the rail, and of the levels on the Class step. */
  rows: RemovedRow[];
}

/** What planChange reads: the engine, the character, and the content that it builds against. */
export interface ChangeInput {
  engine: Engine;
  entity: StrictEntity;
  content: Content;
}

export interface ChangePlan {
  /** The entity that the plan is for. */
  entity: StrictEntity;
  /** The question to ask, or null when no pick goes: then the change asks nothing. */
  question: ChangeQuestion | null;
  /**
   * The entity paths of the picks that go (selection and option keys from the root): the picks that the change
   * itself removes, and the picks that the builder removes before it.
   */
  removed: string[][];
  /**
   * The entity of the plan with the picks removed that the engine keeps, and then with the change. Throws as the engine
   * does. For another entity, make a new plan.
   */
  apply: () => StrictEntity;
}

/** The path of each option of the entity, at any depth, as selection and option keys from the root. A pick comes before the picks under it. */
function picksOf(entity: StrictEntity): string[][] {
  const walk = (node: StrictNode, at: string[]): string[][] =>
    selectionsOf(node).flatMap((selection) =>
      optionsOf(selection).flatMap((option) => {
        const path = [...at, keyOf(selection), keyOf(option)];
        return [path, ...walk(option, path)];
      }),
    );
  return walk(rootOf(entity), []);
}

/** The number of levels of the class in the entity. */
const levelsOf = (entity: StrictEntity, classKey: string) =>
  picksOf(entity).filter((path) => path.length === 4 && path[0] === "class" && path[1] === classKey && path[2] === "levels").length;

/** The builder steps of the entity. */
const stepsOf = ({ engine, entity, content }: ChangeInput): BuilderStep[] => builderSteps(engine.evaluate(entity, content).selections, templateShape(content));

/**
 * Each selection of the steps, and the selections under its options, with the step that shows it. A selection that
 * moved to a step is in the selections of that step.
 */
function homes(steps: BuilderStep[]): Map<BuilderSelection, StepName> {
  const home = new Map<BuilderSelection, StepName>();
  const seen = new Set<BuilderSelection>();
  for (const step of steps) for (const node of treeNodes(step.selections, { seen })) home.set(node, step.name);
  return home;
}

/** The selections of the steps by the text of their actualPath. */
function byPath(steps: BuilderStep[]): Map<string, BuilderSelection> {
  return new Map([...homes(steps).keys()].map((node) => [node.actualPath.join("/"), node]));
}

/** A top-level inventory list, such as Equipment: its items are not picks of an option. */
const isInventory = (node: BuilderSelection) => node.actualPath.length === 1 && node.tags.includes("equipment");

/** The engine's change, with no pick removed first. */
function mutate(e: Engine, entity: StrictEntity, content: Content, change: PickChange): StrictEntity {
  switch (change.kind) {
    // The pick of a race with one subrace picks the subrace too (ORC-348).
    case "pick":
      return withSoleSubrace(e, e.select(entity, change.path, change.to, content) as StrictEntity, change.path, change.to, content);
    case "replace-class":
      return replaceClass(e, entity, change.from, change.to, content);
    case "remove-class":
      return e.removeClass(entity, change.classKey, content) as StrictEntity;
    case "lower-level": {
      let next = entity;
      for (let count = levelsOf(entity, change.classKey); count > change.level; count--) next = e.removeLevel(next, change.classKey, content) as StrictEntity;
      return next;
    }
  }
}

/** The kind and key of each skill, tool and language of the built character, as "{kind}:{key}". */
function proficiencies(e: Engine, entity: StrictEntity, content: Content): Set<string> {
  const built = e.evaluate(entity, content).built;
  return new Set([
    ...Object.keys(built["skill-profs"] ?? {}).map((key) => `skill:${key}`),
    ...Object.keys(built["tool-profs"] ?? {}).map((key) => `tool:${key}`),
    ...(built.languages ?? []).map((key) => `language:${key}`),
  ]);
}

/**
 * The place of a pick: its step, or for a level choice on the Class step its level ("Level 4"). A level of a class
 * other than `own`, the class of the change, names its class ("Wizard level 2"), such as the next class when the first
 * goes. With no `own`, a level has no class name. `className` gives the name of a class by its key.
 */
function placeOf(step: StepName, path: string[], own: string | null, className: (key: string) => string): { place: string; rank: number } {
  const level = step === "Class" && path[2] === "levels" ? levelOfKey(path[3]) : null;
  const rank = STEP_NAMES.indexOf(step) * 1000;
  if (!level) return { place: step, rank };
  // The levels of the class of the change come first, then those of each other class.
  if (own === null || path[1] === own) return { place: `Level ${level}`, rank: rank + Number(level) };
  return { place: `${className(path[1])} level ${level}`, rank: rank + 100 + Number(level) };
}

/** The names, with a count for a name that repeats, such as two picks of Strength: "Strength ×2". */
function counted(names: string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].map(([name, count]) => (count > 1 ? `${name} ×${count}` : name));
}

// The name of a row of a selection of these kinds (spec: "Skills: Perception, Stealth").
const KIND_NAMES = { skill: "Skills", tool: "Tools", language: "Languages" } as const;

/** The name of the selection in a row: the kind of its picks, such as "Skills", or the engine's name. */
function rowName(node: BuilderSelection): string {
  if (node.key.includes("expertise")) return "Expertise";
  const kind = proficiencyKind(node);
  return kind === null ? node.name : KIND_NAMES[kind];
}

/**
 * The rows of the picks at the paths, named from the steps of the entity that has them. The picks of a row are in the
 * order of the selection's picks.
 */
function rowsOf(paths: string[][], steps: BuilderStep[], own: string | null): RemovedRow[] {
  const home = homes(steps);
  const nodes = byPath(steps);
  const className = (key: string) => nodes.get("class")?.options.find((option) => option.key === key)?.name ?? key;
  const groups = new Map<BuilderSelection, { place: string; rank: number; order: number; keys: string[] }>();
  for (const path of paths) {
    const node = nodes.get(path.slice(0, -1).join("/"));
    const step = node && home.get(node);
    if (!node || !step) continue;
    const group = groups.get(node) ?? { ...placeOf(step, path, own, className), order: groups.size, keys: [] };
    group.keys.push(path.at(-1)!);
    groups.set(node, group);
  }
  // Two rows of one place and one name, such as two skill selections, name the sources of each, when their sources
  // are not the same.
  const sources = new Map<string, Set<string>>();
  const nameKey = (node: BuilderSelection, place: string) => `${place}|${rowName(node)}`;
  for (const [node, { place }] of groups) sources.set(nameKey(node, place), (sources.get(nameKey(node, place)) ?? new Set()).add(node.sources.join(", ")));
  const rows = [...groups]
    .sort(([, a], [, b]) => a.rank - b.rank || a.order - b.order)
    .map(([node, { place, keys }]): RemovedRow => {
      const name = rowName(node);
      // A key that is not in the selection's picks, which no plan gives, comes last.
      const rank = (key: string) => {
        const at = node.selected.indexOf(key);
        return at === -1 ? node.selected.length : at;
      };
      const ordered = keys.map((key, i) => ({ key, i })).sort((a, b) => rank(a.key) - rank(b.key) || a.i - b.i);
      return {
        place,
        selection: (sources.get(nameKey(node, place))?.size ?? 0) > 1 && node.sources.length > 0 ? `${name} (${node.sources.join(", ")})` : name,
        picks: counted(ordered.map(({ key }) => node.options.find((option) => option.key === key)?.name ?? key)),
      };
    });
  // Two selections of one kind and one source in one place, such as a Monk's tool choice and the tool that it opens,
  // are one row: "Tools: Artisans Tools, Smith's Tools".
  const merged: RemovedRow[] = [];
  for (const row of rows) {
    const same = merged.find((other) => other.place === row.place && other.selection === row.selection);
    if (same) same.picks.push(...row.picks);
    else merged.push(row);
  }
  return merged;
}

const pathKey = (path: string[]) => path.join("/");

/**
 * The plan of a change: the picks that it removes, the question that names them, and the entity after it.
 *
 * The picks that go are:
 *
 * * the picks that the engine's change removes: each pick under the old option at any depth, also the picks that
 *   moved to other steps, such as the skills of a race on Proficiencies or a class's starting equipment on Equipment.
 *   The option itself, a class's levels, the hit-point method of a level and the items of an inventory list do not
 *   count;
 * * in a selection that has more picks than its max after the change, such as the languages of a race and a
 *   background, the last picks over the max;
 * * a skill, a tool or a language that the new option gives as fixed, and that the player picked in a selection of
 *   a different source. The fixed ones are the proficiencies that the change adds to the character with no picked
 *   skill, tool or language.
 *
 * The question is null when no pick goes. `apply` removes the picks that the engine keeps from the entity of the
 * plan, and then makes the change.
 */
export function planChange(input: ChangeInput, change: PickChange): ChangePlan {
  const { engine: e, entity, content } = input;
  const steps = stepsOf(input);
  const nodes = byPath(steps);
  const nameIn = (path: string, key: string) => nodes.get(path)?.options.find((option) => option.key === key)?.name ?? key;

  // The option that the change takes away, which the question names in its title.
  const old = change.kind === "pick" ? nodes.get(pathKey(change.path))?.selected[0] : change.kind === "replace-class" ? change.from : change.classKey;
  const target = change.kind === "pick" ? (old === undefined ? null : [...change.path, old]) : ["class", old!];
  // The one subrace of a race is part of the race, not a pick of the player (ORC-348).
  const counts = (path: string[]) => {
    const node = nodes.get(pathKey(path.slice(0, -1)));
    return node !== undefined && !isInventory(node) && node.key !== "levels" && node.key !== "hit-points" && !isSoleSubracePick(path, content);
  };

  // The picks of a skill, a tool or a language, and the fixed ones that the change gives.
  const proficiencyPicks = [...nodes.values()].flatMap((node) => {
    const kind = proficiencyKind(node);
    return kind === null ? [] : node.selected.map((key) => ({ path: [...node.actualPath, key], id: `${kind}:${key}` }));
  });
  let collisions: string[][] = [];
  if ((change.kind === "pick" || change.kind === "replace-class") && proficiencyPicks.length > 0) {
    const bare = proficiencyPicks.reduce((result, { path }) => withoutOption(result, path), entity);
    const before = proficiencies(e, bare, content);
    let gained: string[] = [];
    try {
      gained = [...proficiencies(e, mutate(e, bare, content, change), content)].filter((id) => !before.has(id));
    } catch {
      // The engine refuses the change: apply throws with its message.
    }
    collisions = proficiencyPicks.filter(({ id }) => gained.includes(id)).map(({ path }) => path);
  }

  // The picks that the engine's change removes, and the picks over the max after it.
  const first = collisions.reduce((result, path) => withoutOption(result, path), entity);
  let dropped: string[][] = [];
  let overMax: string[][] = [];
  let after: StrictEntity | null = null;
  try {
    after = mutate(e, first, content, change);
    const left = new Set(picksOf(after).map(pathKey));
    const isTarget = (path: string[]) => target !== null && pathKey(path) === pathKey(target);
    dropped = picksOf(first).filter((path) => !left.has(pathKey(path)) && !isTarget(path) && counts(path));
    const tooMany = (node: BuilderSelection | undefined) => Math.max(0, -(node?.remaining ?? 0));
    for (const [path, node] of byPath(stepsOf({ engine: e, entity: after, content }))) {
      // A selection that the change gives more picks than its max loses its last picks, as many as the change adds.
      const extra = tooMany(node) - tooMany(nodes.get(path));
      if (extra > 0 && !isInventory(node)) overMax.push(...node.selected.slice(-extra).map((key) => [...node.actualPath, key]));
    }
    overMax = overMax.filter((path) => counts(path));
  } catch {
    // The engine refuses the change: apply throws with its message.
  }

  // The engine keeps these picks: the builder removes them before it gives the change to the engine.
  const kept = [...collisions, ...overMax];
  // With no pick over a max, the change is the one made above. A change that the engine refuses is made again, so that
  // apply throws with its message.
  const apply = () =>
    overMax.length === 0 && after !== null
      ? after
      : mutate(
          e,
          kept.reduce((result, path) => withoutOption(result, path), entity),
          content,
          change,
        );
  const removed = [...dropped, ...overMax, ...collisions];
  if (removed.length === 0) return { entity, question: null, removed, apply };

  const replaced = dropped.length + overMax.length > 0;
  const title = (() => {
    switch (change.kind) {
      case "pick":
        return old !== undefined && replaced
          ? `Replace ${nameIn(pathKey(change.path), old)} with ${nameIn(pathKey(change.path), change.to)}?`
          : `Change to ${nameIn(pathKey(change.path), change.to)}?`;
      case "replace-class":
        return `Replace ${nameIn("class", change.from)} with ${nameIn("class", change.to)}?`;
      case "lower-level":
        return `Lower ${nameIn("class", change.classKey)} to level ${change.level}?`;
      case "remove-class":
        return `Remove ${nameIn("class", change.classKey)}?`;
    }
  })();
  const action: ChangeAction =
    change.kind === "lower-level" || change.kind === "remove-class" ? "Remove" : change.kind === "replace-class" || replaced ? "Replace" : "Change";
  // The class of the change: its levels need no class name in the question.
  const own = change.kind === "pick" ? (change.path[0] === "class" ? change.path[1] : null) : change.kind === "replace-class" ? change.from : change.classKey;
  return { entity, question: { title, action, rows: rowsOf(removed, steps, own) }, removed, apply };
}
