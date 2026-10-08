// The Abilities step (ORC-57): the base scores and how they were set, read
// from and written to the strict entity, with the old character_builder.cljs
// rules for point buy, rolls and swaps, and the increases built adds to them.
import type { AvailableSelection, Built2014, Homebrew } from "@pubdoor/dmv";
import { engine, type StrictEntity } from "./engine.ts";
import { ABILITIES, unqualify, type Ability } from "./sheet.ts";

export type Scores = Record<Ability, number>;

/** The ability-scores option keys: how the base scores were set. */
export type Method = "manual-entry" | "point-buy" | "standard-roll" | "standard-scores";

export const STANDARD_SCORES: Scores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
export const POINT_BUY_POINTS = 27;
/** The point cost of each score from 8 to 15. */
export const POINT_BUY_COSTS: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

const scoresOf = (score: (ability: Ability) => number) =>
  Object.fromEntries(ABILITIES.map((ability) => [ability, score(ability)])) as Scores;

/** Point buy starts each score at 8. */
export const POINT_BUY_START: Scores = scoresOf(() => 8);

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
export function setBaseScores(entity: StrictEntity, method: Method, scores: Scores, homebrew?: Homebrew): StrictEntity {
  const value = Object.fromEntries(ABILITIES.map((a) => [scoreKey(a), scores[a]]));
  return engine().setField(entity, ["ability-scores", method], value, { homebrew });
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
  if (left === null || score >= 15 || total >= 20) return false;
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

/** Swaps an ability's score with its left (-1) or right (1) neighbour's; str and cha are neighbours. */
export function swapScores(scores: Scores, ability: Ability, direction: -1 | 1): Scores {
  const i = ABILITIES.indexOf(ability);
  const other = ABILITIES[(i + direction + ABILITIES.length) % ABILITIES.length];
  return { ...scores, [ability]: scores[other], [other]: scores[ability] };
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
