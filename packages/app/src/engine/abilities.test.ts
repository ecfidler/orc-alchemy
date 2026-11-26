import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import {
  abilityIncreases,
  abilityRows,
  asiSource,
  baseScores,
  canDecrease,
  canIncrease,
  foldIncreases,
  increaseSectionName,
  type Method,
  nextPointCost,
  pointsLeft,
  rollScores,
  type Scores,
  STANDARD_SCORES,
  setBaseScores,
  swapAbilities,
} from "./abilities.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const readJson = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));
const imported = (name: string): StrictEntity => engine().importCharacter(readJson(`${name}.strict.json`)).entity;
const short = (abilities: Record<string, number>) => Object.fromEntries(Object.entries(abilities).map(([k, v]) => [k.slice(k.indexOf("/") + 1), v]));
const builtAbilities = (entity: StrictEntity) => short(engine().evaluate(entity).built.abilities);
const all = (n: number): Scores => ({ str: n, dex: n, con: n, int: n, wis: n, cha: n });

beforeAll(() => loadEngine());

test("point buy costs 27 points for 15 15 15 8 8 8, and counts too many as negative", () => {
  expect(pointsLeft(all(8))).toBe(27);
  expect(pointsLeft({ ...all(8), str: 15, dex: 15, con: 15 })).toBe(0);
  expect(pointsLeft({ ...all(8), str: 14, dex: 13, con: 12 })).toBe(27 - 7 - 5 - 4);
  // wizard-5 was bought at 29 points.
  expect(pointsLeft({ str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 })).toBe(-2);
  // A score outside 8 to 15 has no cost.
  expect(pointsLeft({ ...all(8), str: 16 })).toBeNull();
  expect(pointsLeft({ ...all(8), str: 7 })).toBeNull();
});

test("point buy increases stop at 15, at a total of 20, and when the next step costs more than is left", () => {
  expect(canIncrease(all(8), "str", 8)).toBe(true);
  expect(canIncrease({ ...all(8), str: 15 }, "str", 15)).toBe(false);
  expect(canIncrease(all(8), "str", 20)).toBe(false);
  // 15 15 13 11 8 8 leaves 1 point: 13 to 14 costs 2, 8 to 9 costs 1.
  const scores = { ...all(8), str: 15, dex: 15, con: 13, int: 11 };
  expect(pointsLeft(scores)).toBe(1);
  expect(canIncrease(scores, "con", 13)).toBe(false);
  expect(canIncrease(scores, "wis", 8)).toBe(true);
  expect(canIncrease({ ...all(8), str: 15, dex: 15, con: 15 }, "int", 8)).toBe(false);
  // Out of range: no increase, but a decrease above 8.
  expect(canIncrease({ ...all(8), str: 16 }, "dex", 8)).toBe(false);
  expect(canDecrease({ ...all(8), str: 16 }, "str")).toBe(true);
  expect(canDecrease(all(8), "str")).toBe(false);
});

test("a roll is 4d6 dropping the lowest die, for each ability", () => {
  // Dice 1 2 3 4 for str, then 6 6 6 1, then 1 1 1 1, and so on round.
  const dice = [1, 2, 3, 4, 6, 6, 6, 1, 1, 1, 1, 1];
  let i = 0;
  const random = () => (dice[i++ % dice.length] - 1) / 6;
  expect(rollScores(random)).toEqual({ str: 9, dex: 18, con: 3, int: 9, wis: 18, cha: 3 });
  for (const score of Object.values(rollScores())) {
    expect(score).toBeGreaterThanOrEqual(3);
    expect(score).toBeLessThanOrEqual(18);
  }
});

test("a swap gives two abilities each other's scores", () => {
  expect(swapAbilities(STANDARD_SCORES, "str", "dex")).toEqual({ str: 14, dex: 15, con: 13, int: 12, wis: 10, cha: 8 });
  expect(swapAbilities(STANDARD_SCORES, "cha", "str")).toEqual({ str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 });
  // Two equal scores, or an ability with itself: nothing changes.
  expect(swapAbilities(all(10), "str", "wis")).toEqual(all(10));
  expect(swapAbilities(STANDARD_SCORES, "con", "con")).toEqual(STANDARD_SCORES);
});

test("the cost of the next point: 1 to 13, 2 from 13 to 15, none at 15 or outside 8 to 15", () => {
  const scores = { str: 8, dex: 12, con: 13, int: 14, wis: 15, cha: 16 };
  expect([nextPointCost(scores, "str"), nextPointCost(scores, "dex"), nextPointCost(scores, "con"), nextPointCost(scores, "int")]).toEqual([1, 1, 2, 2]);
  expect(nextPointCost(scores, "wis")).toBeNull();
  expect(nextPointCost(scores, "cha")).toBeNull();
  expect(nextPointCost({ ...all(8), str: 7 }, "str")).toBeNull();
});

test("the base scores read back as they were set, for each method", () => {
  expect(baseScores(engine().emptyCharacter())).toEqual({ method: "standard-scores", scores: STANDARD_SCORES });
  expect(baseScores(readJson("fighter-5.strict.json"))).toEqual({
    method: "standard-roll",
    scores: { str: 16, dex: 12, con: 15, int: 10, wis: 13, cha: 8 },
  });
  const scores = { str: 9, dex: 10, con: 11, int: 12, wis: 13, cha: 14 };
  for (const method of ["manual-entry", "point-buy", "standard-roll", "standard-scores"] as Method[]) {
    const entity = setBaseScores(engine().emptyCharacter(), method, scores);
    expect(baseScores(entity)).toEqual({ method, scores });
    // As JSON text too, as storage may hold it.
    expect(baseScores(JSON.stringify(entity))).toEqual({ method, scores });
  }
});

test.each(["manual-entry", "point-buy", "standard-roll", "standard-scores"] as Method[])("%s builds the base scores plus the race's increases", (method) => {
  // A dwarf has Con +2.
  const dwarf = engine().select(engine().emptyCharacter(), ["race"], "dwarf");
  const scores = { str: 15, dex: 8, con: 14, int: 10, wis: 12, cha: 9 };
  expect(builtAbilities(setBaseScores(dwarf, method, scores))).toEqual({ ...scores, con: 16 });
});

test("an option without scores has 8s for point buy, and the standard scores otherwise", () => {
  const withOption = (key: string) => ({
    "~:orcpub.entity.strict/selections": [
      { "~:orcpub.entity.strict/key": "~:ability-scores", "~:orcpub.entity.strict/option": { "~:orcpub.entity.strict/key": key } },
    ],
  });
  expect(baseScores(withOption("~:point-buy"))).toEqual({ method: "point-buy", scores: all(8) });
  expect(baseScores(withOption("~:manual-entry"))).toEqual({ method: "manual-entry", scores: STANDARD_SCORES });
});

test("fighter-5's rows show race, subrace and the improvement it picked", () => {
  const { built, selections } = engine().evaluate(imported("fighter-5"));
  expect(abilityRows(built, selections)).toEqual({
    race: { str: 0, dex: 0, con: 2, int: 0, wis: 0, cha: 0 },
    subrace: { str: 0, dex: 0, con: 0, int: 0, wis: 1, cha: 0 },
    improvements: { str: 2, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    other: all(0),
    total: { str: 18, dex: 12, con: 17, int: 10, wis: 14, cha: 8 },
    modifier: { str: 4, dex: 1, con: 3, int: 0, wis: 2, cha: -1 },
  });
});

test("the half-elf's choice of two abilities is an improvement", () => {
  const { built, selections } = engine().evaluate(imported("fighter-3-wizard-2"));
  const rows = abilityRows(built, selections);
  expect(rows.race).toEqual({ ...all(0), cha: 2 });
  expect(rows.improvements).toEqual({ ...all(0), str: 1, int: 1 });
  expect(rows.other).toEqual(all(0));
});

test("fighter-1's scores are reproduced by hand: a standard human with the standard scores", () => {
  let entity: StrictEntity = engine().select(engine().emptyCharacter(), ["race"], "human");
  entity = engine().select(entity, ["race", "human", "subrace"], "damaran");
  entity = engine().select(entity, ["race", "human", "variant"], "standard-human");
  entity = setBaseScores(entity, "standard-scores", { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 });
  expect(engine().evaluate(entity).built.abilities).toEqual(readJson("fighter-1.expected.json").abilities);
  expect(builtAbilities(entity)).toEqual({ str: 16, dex: 15, con: 14, int: 13, wis: 11, cha: 9 });
});

test("the source of a choice of increases comes from its path", () => {
  expect(asiSource(["race", "half-elf", "asi"])).toBe("Race");
  expect(asiSource(["race", "human", "subrace", "x", "asi"])).toBe("Subrace");
  expect(asiSource(["class", "fighter", "levels", "level-4", "asi-or-feat", "ability-score-improvement", "asi"])).toBe("Improvement");
  expect(asiSource(["class", "fighter", "levels", "level-4", "asi-or-feat", "feat", "feats", "resilient", "asi"])).toBe("Feat");
  expect(asiSource(["something", "asi"])).toBe("Other");
});

test("fighter-5's increases by source: Race, Subrace and Improvement, which add up to the total", () => {
  const entity = imported("fighter-5");
  const { built, selections } = engine().evaluate(entity);
  const increases = abilityIncreases(built, selections, baseScores(entity).scores);
  expect(increases).toEqual({
    str: [{ label: "Improvement", amount: 2 }],
    dex: [],
    con: [{ label: "Race", amount: 2 }],
    int: [],
    wis: [{ label: "Subrace", amount: 1 }],
    cha: [],
  });
});

test("the half-elf's two points are Race increases, with its fixed Cha +2", () => {
  const entity = imported("fighter-3-wizard-2");
  const { built, selections } = engine().evaluate(entity);
  const increases = abilityIncreases(built, selections, baseScores(entity).scores);
  expect([increases.str, increases.int, increases.cha, increases.dex]).toEqual([
    [{ label: "Race", amount: 1 }],
    [{ label: "Race", amount: 1 }],
    [{ label: "Race", amount: 2 }],
    [],
  ]);
});

test("fighter-20's improvements add up per ability, with the human's +1, and its Amulet of Health is Other", () => {
  const entity = imported("fighter-20");
  const { built, selections } = engine().evaluate(entity);
  const increases = abilityIncreases(built, selections, baseScores(entity).scores);
  expect(increases.str).toEqual([
    { label: "Race", amount: 1 },
    { label: "Improvement", amount: 4 },
  ]);
  // Con 13 + 1 + 3 is 17, and the amulet makes it 19.
  expect(increases.con).toEqual([
    { label: "Race", amount: 1 },
    { label: "Improvement", amount: 3 },
    { label: "Other", amount: 2 },
  ]);
});

test("a box holds two tokens; more fold into one token with the sum of the rest", () => {
  const three = [
    { label: "Race", amount: 2 },
    { label: "Improvement", amount: 2 },
    { label: "Other", amount: 1 },
  ] as const;
  expect(foldIncreases([...three].slice(0, 2))).toEqual(three.slice(0, 2));
  expect(foldIncreases([...three])).toEqual([
    { label: "Race", amount: 2 },
    { label: "more", amount: 3 },
  ]);
  expect(foldIncreases([])).toEqual([]);
});

test("the heading of a choice of increases names the kind of choice and its source", () => {
  const asi = (actualPath: string[], sources: string[]) => increaseSectionName({ name: "Ability Score Improvement", sources, actualPath });
  expect(asi(["race", "half-elf", "asi"], ["Half-Elf"])).toBe("Ability Score Increase: Half-Elf");
  expect(asi(["class", "fighter", "levels", "level-4", "asi-or-feat", "ability-score-improvement", "asi"], ["Fighter"])).toBe(
    "Ability Score Improvement: Fighter 4",
  );
  expect(asi(["class", "fighter", "levels", "level-4", "asi-or-feat", "feat", "feats", "resilient", "asi"], ["Resilient"])).toBe(
    "Ability Score Increase: Resilient",
  );
  expect(asi(["asi"], [])).toBe("Ability Score Improvement");
});
