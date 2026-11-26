// The subrace rule of the Race step (ORC-348, docs/design/character-builder.md "The list and the panel"): a race with
// one subrace has no Subrace choice. The pick of the race also picks its subrace, the detail panel shows the subrace as
// a fact, and the block of the race has no Subrace row in Choices. A race with more than one subrace gets a Subrace
// row in Choices.

import type { TemplateOption } from "@pubdoor/dmv";
import { type BuilderOption, type BuilderSelection, templateShape } from "./builder.ts";
import type { Content, Engine, StrictEntity } from "./engine.ts";
import { picksUnder } from "./reconcile.ts";
import { CUSTOM_KEY, shownOptions } from "./selection-control.ts";

/** The key of the Subrace selection under a race option. */
export const SUBRACE_KEY = "subrace";

/** A race option with its selections, as the template has it, or a builder option. */
type WithSelections<O> = { selections?: { key: string; options: O[] }[] };

/** The options of the Subrace selection of a race option, as the template or the builder has them. [] for a race with no subrace. */
export const subraceOptions = <O extends { key: string }>(race: WithSelections<O> | undefined): O[] =>
  race?.selections?.find((s) => s.key === SUBRACE_KEY)?.options ?? [];

/** The subraces of a race option that a player can pick: the options of its Subrace selection, without the engine's Custom subrace. */
export function pickableSubraces(option: WithSelections<{ key: string; name: string }> | undefined): { key: string; name: string }[] {
  return subraceOptions(option)
    .filter((o) => o.key !== CUSTOM_KEY)
    .map(({ key, name }) => ({ key, name }));
}

/** The one subrace of a race option, or null for a race with no subrace or with more than one. */
export function soleSubrace(option: WithSelections<{ key: string; name: string }> | undefined): { key: string; name: string } | null {
  const subraces = pickableSubraces(option);
  return subraces.length === 1 ? subraces[0] : null;
}

/** The subrace pick among the paths of the picks under a race, such as ["race", "dwarf", "subrace", "hill-dwarf"]. */
export const subracePick = (paths: string[][]) => paths.find((p) => p.length === 4 && p[2] === SUBRACE_KEY);

/**
 * The option of the race with the key in the template of the content (templateShape, built once per content), with its
 * selections. undefined when the template has no such race.
 */
export const templateRace = (key: string, content: Content): TemplateOption | undefined =>
  templateShape(content)
    .find((s) => s.key === "race")
    ?.options.find((o) => o.key === key);

/**
 * The entity after the pick of `race` at the path ["race"]: with the one subrace of the race picked too, when the race
 * has one subrace and the entity has no subrace for it. Another path, and a race with no subrace or with more than one,
 * give the entity as it is.
 */
export function withSoleSubrace(e: Engine, entity: StrictEntity, path: string[], race: string, content: Content): StrictEntity {
  if (path.length !== 1 || path[0] !== "race") return entity;
  const sole = soleSubrace(templateRace(race, content));
  if (sole === null || subracePick(picksUnder(entity, ["race", race])) !== undefined) return entity;
  return e.select(entity, ["race", race, SUBRACE_KEY], sole.key, content) as StrictEntity;
}

/**
 * True when the path (selection and option keys from the root) is the pick of the one subrace of a race:
 * ["race", "dwarf", "subrace", "hill-dwarf"]. The pick of the race picks it (withSoleSubrace), so the question before a
 * change does not name it as a pick that goes.
 */
export function isSoleSubracePick(path: string[], content: Content): boolean {
  if (path.length !== 4 || path[0] !== "race" || path[2] !== SUBRACE_KEY) return false;
  return soleSubrace(templateRace(path[1], content))?.key === path[3];
}

/**
 * True when the selection is the Subrace selection of a race with one subrace, and the character has it: the panel
 * shows the subrace as a fact, so Choices has no row for it. A Subrace selection with its one subrace not picked, as in
 * a character from before ORC-348, keeps its row, so that the player can pick it.
 */
export function isSubraceFact(selection: BuilderSelection): boolean {
  if (selection.key !== SUBRACE_KEY || selection.actualPath[0] !== "race") return false;
  const shown = shownOptions(selection);
  return shown.length === 1 && shown[0].selected;
}

/**
 * The selections of the section Choices of the block of a picked option: the selections that the option opens on this
 * step. The Subrace selection of a race with one subrace (isSubraceFact) has no row: the selections that its subrace
 * opens on this step take its place.
 */
export function choiceSelections(option: BuilderOption): BuilderSelection[] {
  return option.selections.flatMap((selection) =>
    isSubraceFact(selection) ? selection.options.filter((o) => o.selected).flatMap((o) => o.selections) : [selection],
  );
}
