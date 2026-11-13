// Suggested uses (ORC-206, docs/design/homebrew-forms.md, "Suggested uses"):
// the app reads the text of a feature and suggests uses and a type. Fixed
// text rules do this in the browser. There is no AI model. This module
// reads only text, and knows nothing of the stored :frequency: uses.ts
// turns a suggestion into the frequency that the uses control writes. The
// form shows a suggestion on a line under the uses control
// (SuggestionLines.tsx). The Review uses page (ORC-207) uses the matched
// sentence and the place of the phrase to mark it.
import type { Ability } from "../../engine/sheet.ts";

/** A part of the text: from start up to, but not including, end. */
export interface Span {
  start: number;
  end: number;
}

/** Where the text says it: the sentence (one or two sentences), its text, and the phrase to mark in it. Both spans count from the start of the whole text. */
export interface TextMatch {
  sentence: Span;
  /** The text of the sentence, as the user wrote it. */
  quote: string;
  /** From the first word of the phrase to its last word. A phrase in two sentences covers the end of the first and the start of the second. */
  phrase: Span;
}

/** The amount of suggested uses: a fixed number, the proficiency bonus, or an ability modifier with a minimum of 1. */
export type SuggestedAmount = { kind: "fixed"; n: number } | { kind: "prof" } | { kind: "ability"; ability: Ability };

/** The rest of suggested uses, by the name of its unit. "Short or long rest" is a short rest. */
export type SuggestedRest = "short-rest" | "long-rest" | "day";

export interface SuggestedUses {
  amount: SuggestedAmount;
  rest: SuggestedRest;
}

/** The text gives uses that the rules read clearly. */
export interface UsesSuggestion {
  kind: "suggestion";
  uses: SuggestedUses;
  match: TextMatch;
}

/**
 * The text names uses, but gives no clear amount. "conflict": two rules
 * give different uses. "unclear": the text has an amount that the rules do
 * not read, such as a level or a "+ 1", or only a phrase such as "regain all
 * expended uses".
 */
export interface UsesHint {
  kind: "hint";
  reason: "conflict" | "unclear";
  match: TextMatch;
}

/** A feature type, as the type select stores it without the "~:". */
export type SuggestedType = "action" | "b-action" | "reaction";

export interface TypeSuggestion {
  type: SuggestedType;
  match: TextMatch;
}

/** What the text of a feature gives. */
export interface TextReading {
  uses: UsesSuggestion | UsesHint | null;
  type: TypeSuggestion | null;
}

/**
 * The text in lower case, with ’ as '. Each character stays one character,
 * so a place in it is the same place in the text.
 */
const normal = (text: string) => text.replace(/[A-Z]/g, (c) => c.toLowerCase()).replace(/[‘’]/g, "'");

/** The sentences of the text: each ends at ".", "!", "?" or a line break. Space around a sentence is not a part of it. */
function sentences(text: string): Span[] {
  const spans: Span[] = [];
  for (const m of text.matchAll(/[^.!?\n]+[.!?]*/g)) {
    const lead = m[0].length - m[0].trimStart().length;
    const start = m.index + lead;
    const end = m.index + m[0].trimEnd().length;
    if (end > start) spans.push({ start, end });
  }
  return spans;
}

/** The index of the sentence that has the place. */
const sentenceAt = (all: Span[], at: number) => {
  const i = all.findIndex((s) => at < s.end);
  return i === -1 ? all.length - 1 : i;
};

/** The match of the phrase in its sentence, or in the two sentences from first to last. */
function matchOf(text: string, all: Span[], phrase: Span): TextMatch {
  const first = all[sentenceAt(all, phrase.start)];
  const last = all[sentenceAt(all, Math.max(phrase.start, phrase.end - 1))];
  const sentence = { start: first.start, end: last.end };
  return { sentence, quote: text.slice(sentence.start, sentence.end), phrase };
}

const COUNT_WORDS: Record<string, number> = { once: 1, twice: 2, thrice: 3, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
/** A count: once, twice, thrice, or "n times" with n as a word or a number. */
const COUNT = String.raw`(once|twice|thrice|(?:\d+|two|three|four|five|six|seven|eight|nine|ten)\s+times)`;
const countOf = (count: string) => {
  const first = count.split(/\s+/)[0];
  return COUNT_WORDS[first] ?? Number(first);
};

/** A rest that a rule reads: "short or long rest" (in either order), "short rest" or "long rest". */
const REST = String.raw`(short\s+or\s+long|long\s+or\s+short|short|long)\s+rests?\b`;
const restOf = (kind: string): SuggestedRest => (kind.startsWith("long") && !kind.includes("short") ? "long-rest" : "short-rest");

/** The thing a phrase uses: "it", "this feature", "your channel divinity". */
const THING = String.raw`(?:it|them|this|that|(?:this|that|the|your)\s+[a-z'-]+(?:\s+[a-z'-]+){0,3}?)`;

const ABILITY_WORDS: Record<string, Ability> = { strength: "str", dexterity: "dex", constitution: "con", intelligence: "int", wisdom: "wis", charisma: "cha" };

/** One reading of one rule: uses, or a part of the text that names an amount the rules do not read. */
type RuleMatch = { uses: SuggestedUses; phrase: Span } | { uses: null; phrase: Span };

/**
 * The rest after a count: the first rest in the sentence of the count,
 * else in the next sentence. The rest can come before the count in its
 * sentence ("When you finish a long rest, you can use it twice").
 */
function restNear(lower: string, all: Span[], at: number): { rest: SuggestedRest; span: Span } | undefined {
  const i = sentenceAt(all, at);
  for (const s of [all[i], all[i + 1]]) {
    if (!s) continue;
    const m = new RegExp(String.raw`\b${REST}`).exec(lower.slice(s.start, s.end));
    if (m) return { rest: restOf(m[1]), span: { start: s.start + m.index, end: s.start + m.index + m[0].length } };
  }
  return undefined;
}

/** The phrase from the first span to the last. */
const join = (a: Span, b: Span): Span => ({ start: Math.min(a.start, b.start), end: Math.max(a.end, b.end) });

/** Each match of a global regex, with its span. */
const each = (lower: string, pattern: string) => [...lower.matchAll(new RegExp(pattern, "g"))].map((m) => ({ m, span: { start: m.index, end: m.index + m[0].length } }));

/** The rules of the table, in its order. Each gives the uses that it reads, or an amount it does not read. */
function ruleMatches(lower: string, all: Span[]): RuleMatch[] {
  const found: RuleMatch[] = [];

  // "can't use it again until you finish a long rest", and "you must finish a short rest before you can use it again".
  const again = String.raw`(?:use|do)\s+(?:${THING}|so)\s+again`;
  for (const { m, span } of each(lower, String.raw`\b(?:can't|cannot|can\s+not)\s+${again}\s+until\s+you\s+(?:finish|complete)\s+an?\s+${REST}`))
    found.push({ uses: { amount: { kind: "fixed", n: 1 }, rest: restOf(m[1]) }, phrase: span });
  for (const { m, span } of each(lower, String.raw`\bmust\s+(?:finish|complete)\s+an?\s+${REST}\s+before\s+you\s+can\s+${again}`))
    found.push({ uses: { amount: { kind: "fixed", n: 1 }, rest: restOf(m[1]) }, phrase: span });

  // "a number of times equal to your proficiency bonus" or "… your Wisdom modifier", then a rest. Any other amount is not read.
  for (const { span } of each(lower, String.raw`\ba\s+number\s+of\s+times\s+equal\s+to\b`)) {
    const after = lower.slice(span.end);
    const read = /^\s+your\s+(?:(proficiency\s+bonus)|(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+modifier)\b(?!\s*(?:\+|plus\b|-|minus\b|times\b|×))/.exec(after);
    const rest = read && restNear(lower, all, span.start);
    if (!read || !rest) {
      found.push({ uses: null, phrase: { start: span.start, end: span.end + (read?.[0].length ?? 0) } });
      continue;
    }
    const amount: SuggestedAmount = read[1] ? { kind: "prof" } : { kind: "ability", ability: ABILITY_WORDS[read[2]] };
    found.push({ uses: { amount, rest: rest.rest }, phrase: join({ start: span.start, end: span.end + read[0].length }, rest.span) });
  }

  // "once / twice / n times per day".
  for (const { m, span } of each(lower, String.raw`\b${COUNT}\s+(?:per|a|each)\s+day\b`))
    found.push({ uses: { amount: { kind: "fixed", n: countOf(m[1]) }, rest: "day" }, phrase: span });

  // "use it once / twice / three times", then a rest. A count for each turn, round or day is not this rule.
  for (const { m, span } of each(lower, String.raw`\buse\s+${THING}\s+${COUNT}\b(?!\s+(?:(?:per|a|each|on|in)\s+(?:[a-z']+\s+){0,3}?(?:turns?|rounds?|day)\b))`)) {
    const rest = restNear(lower, all, span.start);
    found.push(rest ? { uses: { amount: { kind: "fixed", n: countOf(m[1]) }, rest: rest.rest }, phrase: join(span, rest.span) } : { uses: null, phrase: span });
  }
  return found;
}

/** Text that names uses with no amount: "regain all expended uses", or "per day" with no count. */
const HINTS = [String.raw`\b(?:regain|regains|recover|recovers)\s+(?:(?:all|any|one|its|your|of|the)\s+)*(?:expended\s+|spent\s+)?uses\b`, String.raw`\bexpended\s+uses\b`, String.raw`\b(?:per|each)\s+day\b`];

const key = (uses: SuggestedUses) => JSON.stringify(uses);

/** The uses that the text gives: a suggestion, a hint, or null for none. */
function readUses(text: string, lower: string, all: Span[]): UsesSuggestion | UsesHint | null {
  const found = ruleMatches(lower, all).sort((a, b) => a.phrase.start - b.phrase.start);
  const read = found.filter((f): f is { uses: SuggestedUses; phrase: Span } => f.uses !== null);
  const unread = found.find((f) => f.uses === null);
  const results = new Set(read.map((f) => key(f.uses)));
  if (results.size > 1) return { kind: "hint", reason: "conflict", match: matchOf(text, all, read[0].phrase) };
  if (unread) return { kind: "hint", reason: "unclear", match: matchOf(text, all, unread.phrase) };
  if (read.length > 0) return { kind: "suggestion", uses: read[0].uses, match: matchOf(text, all, read[0].phrase) };
  const hint = HINTS.flatMap((pattern) => each(lower, pattern)).sort((a, b) => a.span.start - b.span.start)[0];
  return hint ? { kind: "hint", reason: "unclear", match: matchOf(text, all, hint.span) } : null;
}

/** The phrases of each type. */
const TYPES: [SuggestedType, string][] = [
  ["action", String.raw`\b(?:as\s+an\s+action|use\s+(?:your|an)\s+action)\b`],
  ["b-action", String.raw`\b(?:as\s+a\s+bonus\s+action|use\s+(?:your|a)\s+bonus\s+action)\b`],
  ["reaction", String.raw`\b(?:use\s+your\s+reaction|as\s+a\s+reaction)\b`],
];

/** The type that the text gives, or null when it names no type or two types. */
function readType(text: string, lower: string, all: Span[]): TypeSuggestion | null {
  const found = TYPES.flatMap(([type, pattern]) => each(lower, pattern).map(({ span }) => ({ type, span })));
  if (new Set(found.map((f) => f.type)).size !== 1) return null;
  const first = found.sort((a, b) => a.span.start - b.span.start)[0];
  return { type: first.type, match: matchOf(text, all, first.span) };
}

/**
 * What the text of a feature gives: suggested uses or a hint, and a
 * suggested type. Null when it gives none of them.
 */
export function readFeatureText(text: string): TextReading | null {
  const lower = normal(text);
  const all = sentences(text);
  if (all.length === 0) return null;
  const uses = readUses(text, lower, all);
  const type = readType(text, lower, all);
  return uses === null && type === null ? null : { uses, type };
}
