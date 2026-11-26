// The rules of a class block that are not its Choices or its hit points (ORC-351, docs/design/character-builder.md
// "The class block" and "A second class"): the level of a class and of the character, a higher level of a class and
// the highest levels, the left mark of a closed block, the class that the character cannot take as a second class and
// what it needs, and the character level at which no class can be added.

import type { BuilderOption, BuilderSelection, BuilderStep } from "./builder.ts";
import { choiceLevels, IMPROVEMENT_KEY } from "./class-choices.ts";
import { type ClassHitPointsMethod, hitPointSelections, withAverageHitPoints } from "./classes.ts";
import type { Content, Engine, StrictEntity } from "./engine.ts";
import { type OtherStepLine, otherStepLines, stepMark } from "./other-steps.ts";
import { listText, reasonText, refusalLabels, requiredText } from "./selection-control.ts";
import { classesOf } from "./strict.ts";

/** The highest character level: the sum of the levels of the classes. */
export const MAX_CHARACTER_LEVEL = 20;

/** The highest level of a class. */
export const MAX_CLASS_LEVEL = 20;

/** The text of the status toast for a class level that is not from 1 to MAX_CLASS_LEVEL. */
const CLASS_LEVEL_TEXT = `A class level is from 1 to ${MAX_CLASS_LEVEL}.`;

/** The text of the status toast for a level that makes the character level more than MAX_CHARACTER_LEVEL. */
const CHARACTER_LEVEL_TEXT = `A character has ${MAX_CHARACTER_LEVEL} levels at most.`;

/** True when the character can have one more class: its level is below MAX_CHARACTER_LEVEL. "Add a class" is disabled else. */
export const canAddClass = (characterLevel: number) => characterLevel < MAX_CHARACTER_LEVEL;

/** The level of a class option: the picks of its levels selection. */
export const classLevel = (option: BuilderOption) => option.selections.find((s) => s.key === "levels")?.selected.length ?? 1;

/** The character level: the sum of the levels of the picked class options. */
export const characterLevel = (options: BuilderOption[]) => options.reduce((sum, option) => sum + classLevel(option), 0);

/**
 * Why the class `classKey` of the picked class options cannot have the level, as the text of the status toast; null
 * when it can. A class level is from 1 to 20, and a higher level cannot make the character level more than 20. The
 * engine checks only the level of the one class. A lower level is always possible, also for an imported character
 * with more than 20 levels.
 */
export function levelRefusal(options: BuilderOption[], classKey: string, level: number): string | null {
  if (!Number.isInteger(level) || level < 1 || level > MAX_CLASS_LEVEL) return CLASS_LEVEL_TEXT;
  const option = options.find((o) => o.key === classKey);
  const now = option === undefined ? 0 : classLevel(option);
  if (level > now && characterLevel(options) - now + level > MAX_CHARACTER_LEVEL) return CHARACTER_LEVEL_TEXT;
  return null;
}

/**
 * The entity with the class raised from level `from` to level `to` with the engine's addLevel. With the method
 * Average, the new levels get the average; By level leaves them with no hit points. The caller checks the level with
 * levelRefusal first.
 */
export function raiseLevel(
  e: Engine,
  entity: StrictEntity,
  classKey: string,
  from: number,
  to: number,
  method: ClassHitPointsMethod,
  content?: Content,
): StrictEntity {
  let next = entity;
  for (let n = from; n < to; n++) next = e.addLevel(next, classKey, content) as StrictEntity;
  return method === "average" ? withAverageHitPoints(e, next, classKey, content) : next;
}

/**
 * The entity with the class `from` replaced by the class `to`, with the engine's setClass. A new class that is not the
 * first gets the average hit points at each level, as a class added with "Add a class": Average is the method of a new
 * class. The first class needs none at level 1, which has the maximum of the die.
 */
export function replaceClass(e: Engine, entity: StrictEntity, from: string, to: string, content?: Content): StrictEntity {
  const at = classesOf(entity).indexOf(from);
  const next = e.setClass(entity, at, to, content) as StrictEntity;
  return at > 0 ? withAverageHitPoints(e, next, to, content) : next;
}

/**
 * The left mark of a class block, for its header when it is closed: the picks left in its Choices and its hit points
 * (a level with no hit points), or else the picks to remove as a negative number, or 0 (LeftMark).
 */
export function blockMark(option: BuilderOption): number {
  const rows = choiceLevels(option).flatMap(({ rows }) => rows.map((row) => row.selection));
  return stepMark([...rows, ...hitPointSelections(option)]);
}

/**
 * The lines of "Picked on other steps" of the class `optionKey` of the class selection: the kinds that the class gives
 * on another step, such as Skills, Expertise, Tools, Spells and Starting equipment. The points or the feat of an "Ability
 * Score Improvement or Feat" row are not lines: the row has its own line to that step.
 */
export function classStepLines(selection: BuilderSelection, steps: BuilderStep[], optionKey: string): OtherStepLine[] {
  return otherStepLines(selection, steps, optionKey, (node) => node.actualPath.includes(IMPROVEMENT_KEY));
}

const ABILITY_SHORT: [RegExp, string][] = [
  [/\b(strength|str)\b/gi, "Str"],
  [/\b(dexterity|dex)\b/gi, "Dex"],
  [/\b(constitution|con)\b/gi, "Con"],
  [/\b(intelligence|int)\b/gi, "Int"],
  [/\b(wisdom|wis)\b/gi, "Wis"],
  [/\b(charisma|cha)\b/gi, "Cha"],
];

/** A text with the short names of the abilities and with no "or higher": "Wisdom 13 or higher" is "Wis 13". */
function short(text: string): string {
  let result = text.replace(/ or higher/gi, "");
  for (const [name, abbreviation] of ABILITY_SHORT) result = result.replace(name, abbreviation);
  return result;
}

/**
 * What a class needs, from the prerequisite labels of the engine's refusal (refusalLabels), in short (abilities with
 * their short names, with no "or higher"). `needs` has what each "Requires …" label requires: "Wis 13 and Dex 13",
 * "Cha 13". `others` has each other label, such as "You must have the feat Grappler".
 */
export interface ClassNeeds {
  needs: string[];
  others: string[];
}

/** The ClassNeeds of the prerequisite labels. */
export function classNeeds(labels: string[]): ClassNeeds {
  const needs: string[] = [];
  const others: string[] = [];
  for (const label of labels) {
    const required = requiredText(label);
    if (required === null) others.push(short(label.trim().replace(/\.+$/, "")));
    else needs.push(short(required));
  }
  return { needs, others };
}

/** The small text of a class card that the character cannot take: "Needs Str 13 and Dex 13", then each other label. */
export const needsText = ({ needs, others }: ClassNeeds) => [...(needs.length > 0 ? [`Needs ${listText(needs)}`] : []), ...others].join(". ");

/**
 * The class options that the character cannot add, by key, with what each needs (classNeeds): the engine's addClass
 * refuses them for their multiclass prerequisites. A class with no prerequisite is always available. A class that the
 * engine refuses for another reason is not in the map: its add shows the refusal in the status toast.
 */
export function unavailableClasses(e: Engine, entity: StrictEntity, content: Content, options: BuilderOption[]): Map<string, ClassNeeds> {
  const needs = new Map<string, ClassNeeds>();
  for (const { key, prereqs } of options) {
    if (prereqs === 0) continue;
    try {
      e.addClass(entity, key, content);
    } catch (error) {
      const labels = refusalLabels(error instanceof Error ? error.message : String(error));
      if (labels !== null) needs.set(key, classNeeds(labels));
    }
  }
  return needs;
}

/**
 * The reason of the modal of a class that the character cannot take, beside the disabled "Add {class}": "It needs Str
 * 13 and Dex 13.", then each other label as a sentence.
 */
export const needsReason = ({ needs, others }: ClassNeeds) =>
  [...(needs.length > 0 ? [reasonText(`Requires ${listText(needs)}`)] : []), ...others.map(reasonText)].join(" ");
