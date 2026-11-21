// The text rules of the spell view (ORC-284, docs/design/spells-panel.md
// "The spell view"): the level line, the duration with its concentration
// tag, the components line and the paragraphs of the description. Each
// function takes the values of a spell record, so other pages can use them.
import type { SpellRecord } from "./spell-records.ts";

/** A number as an English ordinal for a level: 1st, 2nd, 3rd, 4th. */
export const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;

const capitalized = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The level and the school: "1st-level enchantment", or "Enchantment
 * cantrip". The importer gives the school "unknown" to a pack spell that
 * has none; the line then has only the level: "1st level", or "Cantrip".
 */
export function levelLine({ level, school }: Pick<SpellRecord, "level" | "school">): string {
  const known = school !== "" && school !== "unknown";
  if (level === 0) return known ? `${capitalized(school)} cantrip` : "Cantrip";
  return known ? `${ordinal(level)}-level ${school}` : `${ordinal(level)} level`;
}

/** A duration, with concentration apart: its first word, and the words after it, as the data has them. */
export interface DurationParts {
  concentration: boolean;
  /** The words after "concentration" and its comma, or the whole duration when there is no concentration. "" when there are none. */
  rest: string;
}

const CONCENTRATION = /^\s*concentration\b[\s,]*/i;

/**
 * The duration with concentration apart. The record has no concentration
 * flag: a duration that starts with the word "concentration", in any case,
 * needs it. "Concentration, up to 1 minute" gives the words "up to 1
 * minute". The words keep their case, so "up" stays lower case after the
 * tag.
 */
export function durationParts(duration: string): DurationParts {
  const match = CONCENTRATION.exec(duration);
  if (match === null) return { concentration: false, rest: duration.trim() };
  return { concentration: true, rest: duration.slice(match[0].length).trim() };
}

/**
 * The components line: the letters V, S and M of the spell, then the
 * material text in parentheses: "V, S, M (a sprinkling of holy water)".
 * The material text shows only with the M. Null when the spell has no
 * component.
 */
export function componentsLine(components: SpellRecord["components"]): string | null {
  if (components === undefined) return null;
  const letters = [components.verbal && "V", components.somatic && "S", components.material && "M"].filter(Boolean).join(", ");
  if (letters === "") return null;
  const material = components["material-component"]?.trim();
  return components.material && material ? `${letters} (${material})` : letters;
}

/** A description as paragraphs, with its "At Higher Levels" part apart. */
export interface DescriptionParts {
  /** The paragraphs before "At Higher Levels", or all of them. */
  paragraphs: string[];
  /** The paragraphs of the "At Higher Levels" part, without those words; null when the description has no such part. */
  higherLevels: string[] | null;
}

/**
 * The three forms of "At Higher Levels" in the data: after a line break with
 * a full stop; in the same line as the sentence before it, with a full stop;
 * and after a line break and four spaces, with a colon.
 */
const HIGHER_LEVELS = /\nAt Higher Levels\. |(?<=[.!?]) At Higher Levels\. |\n {4}At Higher Levels: /;

const paragraphsOf = (text: string) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

/**
 * The description of a spell as paragraphs. The text is plain text: each
 * line break starts a new paragraph, and the app does not read Markdown in
 * it. The first "At Higher Levels" in one of the three forms of the data
 * starts the part apart. If no form matches, there is no part apart, and
 * the text shows as it is.
 */
export function descriptionParts(description: string): DescriptionParts {
  const match = HIGHER_LEVELS.exec(description);
  if (match === null) return { paragraphs: paragraphsOf(description), higherLevels: null };
  return {
    paragraphs: paragraphsOf(description.slice(0, match.index)),
    higherLevels: paragraphsOf(description.slice(match.index + match[0].length)),
  };
}
