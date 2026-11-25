// The calculated amount of a spell at a higher level (ORC-320,
// docs/design/sheet-interactivity.md "The calculated amount"). The app reads
// the amount from the "At Higher Levels" text of the spell record when the
// text says "for each slot level above". For other words, or when the app
// cannot read one amount with a unit that it can show, the menu shows the
// text. The app does not guess.
import type { SpellRecord } from "./spell-records.ts";
import { descriptionParts } from "./spell-text.ts";

/**
 * The amount that each slot level above a base level adds: dice ("1d6"), or a count with a unit ("1 dart").
 * `above` is the base level, the ordinal after "above" in the text: 2 for "above 2nd"; null when the text names none.
 */
export type HigherAmount = { above: number | null } & (
  | { kind: "dice"; count: number; die: number }
  | {
      kind: "count";
      count: number;
      /** The unit for a count of 1, such as "dart". */
      one: string;
      /** The unit for another count, such as "darts". */
      many: string;
    }
);

/** What a spell gives at a higher level. */
export type HigherLevels =
  /** The text says "for each slot level above", and the app read one amount from it. */
  | { kind: "amount"; amount: HigherAmount }
  /** The "At Higher Levels" text, with words that the app does not calculate. */
  | { kind: "text"; text: string }
  /** The spell has no "At Higher Levels" text. */
  | { kind: "none" };

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const NUMBER = `(\\d+|${Object.keys(NUMBER_WORDS).join("|")})`;
const numberOf = (text: string) => NUMBER_WORDS[text.toLowerCase()] ?? Number(text);

const FOR_EACH = /for each slot level above/i;
/** The base level after "above": "for each slot level above 2nd". */
const ABOVE = /for each slot level above (\d+)(?:st|nd|rd|th)\b/i;
/**
 * The unit of an amount after "by" with no unit, from the words before it: "hit points increase by an additional 5"
 * and "the amount of healing increases by 10" count hit points, and "the challenge rating increases by 1" counts
 * challenge rating. With other words the app has no unit to show, so it reads no amount.
 */
const SUBJECT_UNITS: readonly [RegExp, string, string][] = [
  [/\b(?:hit points?|healing)\b/i, "hit point", "hit points"],
  [/\bchallenge rating\b/i, "challenge rating", "challenge rating"],
];
/** Dice, such as "1d6". */
const DICE = /\b(\d+)d(\d+)\b/g;
/** A count of things: "one more dart", "two additional undead creatures", "5 additional temporary hit points". */
const COUNT = new RegExp(`\\b${NUMBER} (?:additional|more) ([a-z][a-z ]*?)(?=,| for each|\\.|$)`, "gi");
/** A number after "by": "by 5 feet", "by an additional 5", "by 1". Not dice. */
const BY = new RegExp(`\\bby (?:an additional )?${NUMBER}(?!d\\d)(?: (feet|foot|hours?|minutes?|days?|miles?))?(?= for each|,|\\.|$)`, "gi");
/** The longest noun of a count that the app keeps; a longer phrase keeps only its first word ("bolt leaps from…" gives "bolt"). */
const MAX_NOUN_WORDS = 3;

/** The plural of a unit: "dart" gives "darts", "foot" gives "feet". */
function plural(unit: string): string {
  if (unit === "") return "";
  if (/\bfoot$/.test(unit)) return unit.replace(/foot$/, "feet");
  return unit.endsWith("s") || /\bfeet$/.test(unit) ? unit : `${unit}s`;
}

/** The singular of a unit: "creatures" gives "creature", "feet" gives "foot". */
function singular(unit: string): string {
  if (/\bfeet$/.test(unit)) return unit.replace(/feet$/, "foot");
  return unit.endsWith("s") ? unit.slice(0, -1) : unit;
}

const countAmount = (above: number | null, count: number, unit: string): HigherAmount => ({
  kind: "count",
  count,
  one: singular(unit),
  many: plural(unit),
  above,
});

/**
 * The one amount of the sentence that says "for each slot level above", with
 * the base level after "above", or null when the sentence has no amount or
 * more than one, such as "2d8 and 2d6", or "10 additional gallons, or … by 5
 * feet". A number after "by" with no unit needs a unit from SUBJECT_UNITS.
 */
export function readHigherAmount(text: string): HigherAmount | null {
  const sentence = text.split(/(?<=\.)\s+/).find((s) => FOR_EACH.test(s));
  if (sentence === undefined) return null;
  const baseLevel = ABOVE.exec(sentence)?.[1];
  const above = baseLevel === undefined ? null : Number(baseLevel);
  // The words after "or higher," say what grows; the part before names the slot level.
  const body = sentence.replace(/^.*?\bor higher(?: level)?,\s*/i, "");
  const dice = [...body.matchAll(DICE)];
  const counts = [...body.matchAll(COUNT)];
  const bys = [...body.matchAll(BY)];
  if (dice.length + counts.length + bys.length !== 1) return null;
  if (dice[0]) return { kind: "dice", count: Number(dice[0][1]), die: Number(dice[0][2]), above };
  if (counts[0]) {
    const words = counts[0][2].trim().toLowerCase().split(/\s+/);
    return countAmount(above, numberOf(counts[0][1]), (words.length > MAX_NOUN_WORDS ? words.slice(0, 1) : words).join(" "));
  }
  const by = bys[0];
  if (!by) return null;
  if (by[2]) return countAmount(above, numberOf(by[1]), by[2].toLowerCase());
  const subject = SUBJECT_UNITS.find(([words]) => words.test(body.slice(0, by.index)));
  return subject ? { kind: "count", count: numberOf(by[1]), one: subject[1], many: subject[2], above } : null;
}

/** What the spell of this record gives at a higher level: an amount, the text, or nothing. */
export function higherLevels(record: Pick<SpellRecord, "description"> | undefined): HigherLevels {
  const parts = record?.description ? descriptionParts(record.description).higherLevels : null;
  if (!parts || parts.length === 0) return { kind: "none" };
  const text = parts.join("\n");
  if (FOR_EACH.test(text)) {
    const amount = readHigherAmount(text);
    if (amount) return { kind: "amount", amount };
  }
  return { kind: "text", text };
}

/**
 * The amount at a number of slot levels above the base level, with a sign:
 * "+2d6", "+2 darts", "+10 feet". "" for 0 levels or fewer.
 */
export function amountAt(amount: HigherAmount, levelsAbove: number): string {
  if (levelsAbove <= 0) return "";
  const n = amount.count * levelsAbove;
  if (amount.kind === "dice") return `+${n}d${amount.die}`;
  return `+${n} ${n === 1 ? amount.one : amount.many}`;
}
