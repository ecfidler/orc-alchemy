// The rules of a class block that are not its Choices or its hit points (ORC-351, docs/design/character-builder.md
// "The class block" and "A second class"): the left mark of a closed block, the class that the character cannot take
// as a second class and what it needs, and the character level at which no class can be added.

import type { BuilderOption, BuilderSelection, BuilderStep } from "./builder.ts";
import { choiceLevels, IMPROVEMENT_KEY } from "./class-choices.ts";
import { hitPointSelections } from "./classes.ts";
import type { Content, Engine, StrictEntity } from "./engine.ts";
import { type OtherStepLine, otherStepLines, stepMark } from "./other-steps.ts";
import { reasonText, refusalReason } from "./selection-control.ts";

/** The highest character level: the sum of the levels of the classes. */
export const MAX_CHARACTER_LEVEL = 20;

/** True when the character can have one more class: its level is below MAX_CHARACTER_LEVEL. "Add a class" is disabled else. */
export const canAddClass = (characterLevel: number) => characterLevel < MAX_CHARACTER_LEVEL;

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

/**
 * What a class needs, in short, from the reason text of the engine's refusal ("It needs Wisdom 13 and Dexterity 13.",
 * "It needs CHA 13 or higher."): "Wis 13 and Dex 13", "Cha 13". The abilities have their short names, and "or higher"
 * goes: a score of 13 is "13 or higher".
 */
export function classNeeds(reason: string): string {
  let text = reason
    .replace(/^It needs /, "")
    .replace(/\.$/, "")
    .replace(/ or higher/gi, "");
  for (const [name, short] of ABILITY_SHORT) text = text.replace(name, short);
  return text;
}

/** The small text of a class card that the character cannot take: "Needs Str 13". */
export const needsText = (needs: string) => `Needs ${needs}`;

/**
 * The class options that the character cannot add, by key, with what each needs (classNeeds): the engine's addClass
 * refuses them for their multiclass prerequisites. A class with no prerequisite is always available. A class that the
 * engine refuses for another reason is not in the map: its add shows the refusal in the status toast.
 */
export function unavailableClasses(e: Engine, entity: StrictEntity, content: Content, options: BuilderOption[]): Map<string, string> {
  const needs = new Map<string, string>();
  for (const { key, prereqs } of options) {
    if (prereqs === 0) continue;
    try {
      e.addClass(entity, key, content);
    } catch (error) {
      const reason = refusalReason(error instanceof Error ? error.message : String(error));
      if (reason !== null) needs.set(key, classNeeds(reason));
    }
  }
  return needs;
}

/** The reason of the modal of a class that the character cannot take, beside the disabled "Add {class}": "It needs Str 13." */
export const needsReason = (needs: string) => reasonText(`Requires ${needs}`);
