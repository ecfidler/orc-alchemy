// The uses preview of the homebrew forms (ORC-204, docs/design/homebrew-forms.md,
// "Preview"): a pack feature as the sheet shows it for an example character.
// It builds the feature as the engine builds it, with scaledAmount for a
// scaled amount, then gives it to the sheet's own toSheetFeature and
// sectionOf. The forms import this, and never the engine's built shape.
import type { Amount, Feature } from "@pubdoor/dmv";
import { untag } from "./content.ts";
import { scaledAmount, sectionOf, toSheetFeature, type FeatureSection, type ScaleNumbers, type SheetFeature } from "./sheet.ts";

/** A stored map in verbose Transit-JSON, such as a feature of a pack. */
type TransitMap = Record<string, unknown>;

const isMap = (value: unknown): value is TransitMap => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The numbers of the example character: every ability score is `score`,
 * and the level is both the character level and the class level. The
 * proficiency bonus is 2 at level 1, and 1 more at each 4 levels; an ability
 * modifier is (score - 10) / 2, rounded down. scaledAmount gives 0 for an
 * ability key that is none of the six, as the engine does.
 */
export function exampleNumbers(level: number, score: number): ScaleNumbers {
  return { level, proficiencyBonus: 2 + Math.floor((level - 1) / 4), abilityModifier: () => Math.floor((score - 10) / 2) };
}

/**
 * The stored :frequency as the engine builds it for a character with these
 * numbers: the unit without its "~:", and the amount as a number. No unit
 * and no amount stay absent; the sheet shows no amount as 1 use, and no
 * unit with no tag. Undefined for no uses.
 */
export function builtFrequency(frequency: unknown, numbers: ScaleNumbers): Partial<Amount> | undefined {
  if (!isMap(frequency)) return undefined;
  const built: Partial<Amount> = {};
  const units = frequency["~:units"];
  if (typeof units === "string") built.units = untag(units);
  const amount = frequency["~:amount"];
  if (typeof amount === "number") built.amount = amount;
  else if (isMap(amount)) built.amount = scaledAmount(amount, numbers);
  return built;
}

/** A stored feature in the preview: its sheet section, and the feature as the sheet shows it. */
export interface PreviewFeature {
  section: FeatureSection;
  feature: SheetFeature;
}

/**
 * The stored feature (a map of :name, :type, :description and :frequency)
 * as the sheet shows it for a character with these numbers, and the sheet
 * section that its type gives.
 */
export function previewFeature(trait: TransitMap, numbers: ScaleNumbers): PreviewFeature {
  const storedType = trait["~:type"];
  const type = typeof storedType === "string" && storedType !== "" ? untag(storedType) : undefined;
  const built: Feature = {
    name: String(trait["~:name"] ?? ""),
    description: String(trait["~:description"] ?? ""),
    type,
    frequency: builtFrequency(trait["~:frequency"], numbers) as Amount | undefined,
  };
  return { section: sectionOf(type), feature: toSheetFeature(built) };
}
