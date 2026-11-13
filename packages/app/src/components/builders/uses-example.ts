// The example character of the uses preview and the one sentence under it
// (docs/design/homebrew-forms.md, "Preview"). The numbers of the example
// come from the engine folder (uses-preview.ts), so the preview and the
// sentence give the same amount.
import { scaledAmount, ABILITY_NAMES } from "../../engine/sheet.ts";
import { exampleNumbers } from "../../engine/uses-preview.ts";
import { baseAbility, baseOf, plusText, scaledNumber, scaledNumberOrDefault, scaledOf } from "./uses.ts";

/** The example character's level and ability score when the preview opens. */
export const EXAMPLE_LEVEL = 5;
export const EXAMPLE_SCORE = 16;

/**
 * The one sentence under the preview for a scaled amount: "Uses equal 5 ×
 * your paladin level. A level 5 character gets 25." levelName is the class
 * of a class or subclass form, or null in other forms, where a level is the
 * character level.
 */
export function usesSentence(frequency: unknown, levelName: string | null, level: number, score: number): string {
  const base = baseOf(frequency);
  const ability = baseAbility(frequency);
  const times = scaledNumberOrDefault(frequency, "times");
  const plus = scaledNumberOrDefault(frequency, "plus");
  const min = scaledNumber(frequency, "min");
  const parts: string[] = [];
  if (ability) parts.push(`your ${ABILITY_NAMES[ability]} modifier`);
  else if (base === "prof") parts.push("your proficiency bonus");
  else if (base === "level") parts.push(`${times === 1 ? "" : `${times} × `}your ${levelName ? levelName.toLowerCase() : "character"} level`);
  if (parts.length === 0) parts.push(String(plus));
  else if (plus !== 0) parts.push(plusText(plus));
  if (typeof min === "number") parts.push(`(minimum ${min})`);
  const n = scaledAmount(scaledOf(frequency), exampleNumbers(level, score));
  return `Uses equal ${parts.join(" ")}. A level ${level} character${ability ? ` with ${score} ${ABILITY_NAMES[ability]}` : ""} gets ${n}.`;
}
