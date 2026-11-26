// The Abilities step (ORC-57): the base scores and how they were set, read
// from and written to the strict entity, with the old character_builder.cljs
// rules for point buy, rolls and swaps, and the increases built adds to them.
import type { AvailableSelection, Built2014 } from "@pubdoor/dmv";
import { levelOfKey, sourcedHeading } from "./builder.ts";
import { unqualify } from "./content.ts";
import { type Content, engine, type StrictEntity } from "./engine.ts";
import { type Ability } from "./sheet.ts";
import { ABILITIES } from "./sheet-text.ts";

export type Scores = Record<Ability, number>;

/** The ability-scores option keys: how the base scores were set. */
export type Method = "manual-entry" | "point-buy" | "standard-roll" | "standard-scores";

export const STANDARD_SCORES: Scores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
export const POINT_BUY_POINTS = 27;
/** The point cost of each score from 8 to 15. */
export const POINT_BUY_COSTS: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

const scoresOf = (score: (ability: Ability) => number) => Object.fromEntries(ABILITIES.map((ability) => [ability, score(ability)])) as Scores;

/** Point buy starts each score at 8. */
export const POINT_BUY_START: Scores = scoresOf(() => 8);

/** The highest base score that point buy gives. */
export const POINT_BUY_MAX = 15;

/** An ability's key in the strict entity's scores. */
const scoreKey = (ability: Ability) => `~:orcpub.dnd.e5.character/${ability}`;

/**
 * The entity's method and base scores, from the strict entity's ability-scores
 * selection. As the old app, an option without scores has 8s for point buy
 * and the standard scores otherwise. method is null without the selection.
 */
export function baseScores(entity: StrictEntity): { method: Method | null; scores: Scores } {
  const strict = (typeof entity === "string" ? JSON.parse(entity) : entity) as {
    "~:orcpub.entity.strict/selections"?: Record<string, unknown>[];
  };
  const option = strict["~:orcpub.entity.strict/selections"]?.find((s) => s["~:orcpub.entity.strict/key"] === "~:ability-scores")?.[
    "~:orcpub.entity.strict/option"
  ] as Record<string, unknown> | undefined;
  const key = option?.["~:orcpub.entity.strict/key"] as string | undefined;
  const method = key === undefined ? null : (key.replace(/^~:/, "") as Method);
  const values = (option?.["~:orcpub.entity.strict/map-value"] ?? {}) as Record<string, number>;
  const fallback = method === "point-buy" ? POINT_BUY_START : STANDARD_SCORES;
  return { method, scores: scoresOf((a) => values[scoreKey(a)] ?? fallback[a]) };
}

/** Sets the method and its base scores in one mutation. */
export function setBaseScores(entity: StrictEntity, method: Method, scores: Scores, content?: Content): StrictEntity {
  const value = Object.fromEntries(ABILITIES.map((a) => [scoreKey(a), scores[a]]));
  return engine().setField(entity, ["ability-scores", method], value, content);
}

/** Point-buy points left of 27; negative for too many, and null when a score is outside 8 to 15, so has no cost. */
export function pointsLeft(scores: Scores): number | null {
  let spent = 0;
  for (const a of ABILITIES) {
    const cost = POINT_BUY_COSTS[scores[a]];
    if (cost === undefined) return null;
    spent += cost;
  }
  return POINT_BUY_POINTS - spent;
}

/** As the old point buy: not above 15, nor a total of 20, nor with too few points left. */
export function canIncrease(scores: Scores, ability: Ability, total: number): boolean {
  const left = pointsLeft(scores);
  const score = scores[ability];
  if (left === null || score >= POINT_BUY_MAX || total >= 20) return false;
  return POINT_BUY_COSTS[score + 1] - POINT_BUY_COSTS[score] <= left;
}

/** As the old point buy: not below 8. */
export const canDecrease = (scores: Scores, ability: Ability) => scores[ability] > 8;

/** The old standard-ability-rolls: 4d6, dropping the lowest die, for each ability. */
export function rollScores(random: () => number = Math.random): Scores {
  return scoresOf(() => {
    const dice = [0, 1, 2, 3].map(() => 1 + Math.floor(random() * 6));
    return dice.reduce((sum, die) => sum + die, 0) - Math.min(...dice);
  });
}

/** The two abilities change their scores, for a drag of one score to a different box or two clicks (ORC-345). */
export function swapAbilities(scores: Scores, a: Ability, b: Ability): Scores {
  return { ...scores, [a]: scores[b], [b]: scores[a] };
}

/**
 * The point-buy cost of one point more on the ability, as "next: 2 pt" shows it (ORC-345). null at 15, and for a score
 * outside 8 to 15, which has no cost.
 */
export function nextPointCost(scores: Scores, ability: Ability): number | null {
  const score = scores[ability];
  const now = POINT_BUY_COSTS[score];
  const next = POINT_BUY_COSTS[score + 1];
  return now === undefined || next === undefined ? null : next - now;
}

export interface AbilityRows {
  race: Scores;
  subrace: Scores;
  /** The ability score improvements picked, such as at fighter level 4 or the half-elf's choice. */
  improvements: Scores;
  /** Increases built has besides race and subrace, such as from feats. */
  other: Scores;
  total: Scores;
  modifier: Scores;
}

/** Ability keys to amounts, by short name; homebrew can use unqualified keys. */
const byAbility = (map: unknown) => {
  const scores = scoresOf(() => 0);
  for (const [key, n] of Object.entries((map ?? {}) as Record<string, number>)) {
    const ability = unqualify(key) as Ability;
    if (ability in scores) scores[ability] += n;
  }
  return scores;
};

/** The rows the builder shows under the base scores, computed and read-only. */
export function abilityRows(built: Built2014, selections: AvailableSelection[]): AbilityRows {
  const race = byAbility(built["race-ability-increases"]);
  const subrace = byAbility(built["subrace-ability-increases"]);
  const increases = byAbility(built["ability-increases"]);
  const improvements = scoresOf(() => 0);
  for (const s of selections) {
    if (s.key !== "asi") continue;
    for (const key of s.selected) {
      const ability = unqualify(key) as Ability;
      if (ability in improvements) improvements[ability]++;
    }
  }
  return {
    race,
    subrace,
    improvements,
    other: scoresOf((a) => increases[a] - race[a] - subrace[a]),
    total: byAbility(built.abilities),
    modifier: byAbility(built["ability-bonuses"]),
  };
}

/** Where an increase of an ability score comes from, in the order that the box shows the tokens (ORC-345). */
export const INCREASE_SOURCES = ["Race", "Subrace", "Improvement", "Feat", "Other"] as const;
export type IncreaseSource = (typeof INCREASE_SOURCES)[number];

/** An increase of one ability from one kind of source, for example +2 from the race. A label "more" folds the rest. */
export interface Increase {
  label: IncreaseSource | "more";
  amount: number;
}

/**
 * The kind of source of an asi selection (a choice of increases), from its path: under a feat it is "Feat", under the
 * race "Race" (the half-elf's two +1) or "Subrace", under a class "Improvement" (an Ability Score Improvement).
 */
export function asiSource(path: readonly string[]): IncreaseSource {
  if (path.includes("feats")) return "Feat";
  if (path[0] === "race") return path.includes("subrace") ? "Subrace" : "Race";
  if (path[0] === "class") return "Improvement";
  return "Other";
}

/**
 * The increases of each ability by the kind of their source, in the order of INCREASE_SOURCES, without the zeros. The
 * race and the subrace come from built's fixed increases, plus the points of the asi selections under them. The asi
 * selections give the points of the class levels and the feats. "Other" is what is left of built's total after the
 * base score and the rest, for example from a magic item: so the tokens always add up to the total less the base.
 */
export function abilityIncreases(built: Built2014, selections: AvailableSelection[], base: Scores): Record<Ability, Increase[]> {
  const race = byAbility(built["race-ability-increases"]);
  const subrace = byAbility(built["subrace-ability-increases"]);
  const total = byAbility(built.abilities);
  const by = Object.fromEntries(ABILITIES.map((a) => [a, { Race: race[a], Subrace: subrace[a], Improvement: 0, Feat: 0, Other: 0 }])) as Record<
    Ability,
    Record<IncreaseSource, number>
  >;
  for (const s of selections) {
    if (s.key !== "asi") continue;
    const source = asiSource(s.actualPath);
    for (const key of s.selected) {
      const ability = unqualify(key) as Ability;
      if (ability in by) by[ability][source]++;
    }
  }
  // A feat with fixed increases (no asi selection) shows its points as "Other": the engine gives no source for them.
  for (const a of ABILITIES) {
    const known = INCREASE_SOURCES.reduce((sum, source) => sum + by[a][source], 0);
    by[a].Other += total[a] - base[a] - known;
  }
  return Object.fromEntries(
    ABILITIES.map((a) => [a, INCREASE_SOURCES.filter((source) => by[a][source] !== 0).map((source) => ({ label: source, amount: by[a][source] }))]),
  ) as Record<Ability, Increase[]>;
}

/** The number of tokens that the token area of a box holds: two lines of one token (ORC-345). */
export const INCREASE_ROOM = 2;

/**
 * The tokens that a box shows: all increases when they fit in `room`, or else the first ones and one token "more" with
 * the sum of the rest. The box gives the whole list to a screen reader.
 */
export function foldIncreases(increases: Increase[], room = INCREASE_ROOM): Increase[] {
  if (increases.length <= room) return increases;
  const rest = increases.slice(room - 1).reduce((sum, i) => sum + i.amount, 0);
  return [...increases.slice(0, room - 1), { label: "more", amount: rest }];
}

/**
 * The heading of the section of a choice of increases (ORC-345): the kind of choice and its source. A choice of a class
 * level is "Ability Score Improvement: Fighter 4"; a choice of a race, a subrace or a feat is "Ability Score Increase:
 * Half-Elf". Without a source, the selection's own name.
 */
export function increaseSectionName({ name, sources, actualPath }: { name: string; sources: string[]; actualPath: readonly string[] }): string {
  if (sources.length === 0) return name;
  if (asiSource(actualPath) === "Improvement") return sourcedHeading("Ability Score Improvement", sources, levelOfKey(actualPath[3]));
  return sourcedHeading("Ability Score Increase", sources);
}
