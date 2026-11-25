import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { applyHitDiceAction, type HitDie, hitDiceLeft, hitDiceTotals, hitDieHealing, regainStatus, rollDie, spendStatus, validRoll } from "./hit-dice.ts";
import { hitDiceSpent, setHitDiceSpent } from "./play.ts";
import { toSheet } from "./sheet.ts";

beforeAll(() => loadEngine());

const strict = (path: string): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, path), "utf8"));
const e2e = (name: string) => strict(`../../e2e/${name}.strict.json`);
const sheetOf = (entity: StrictEntity) => toSheet(engine().evaluate(entity).built, entity);

test("a multiclass character has one entry for each die size, the largest first; two classes with one die size share it", () => {
  // Cleric 6 (d8), paladin 3 (d10), rogue 1 (d8), wizard 1 (d6).
  const sheet = sheetOf(e2e("cleric-6-paladin-3-rogue-1-wizard-1"));
  expect(sheet.hitDice).toEqual([
    { die: 10, total: 3, left: 3 },
    { die: 8, total: 7, left: 7 },
    { die: 6, total: 1, left: 1 },
  ]);
});

test("a multiclass character with two die sizes: wizard 3 (d6) and warlock 2 (d8)", () => {
  expect(sheetOf(e2e("wizard-3-warlock-2")).hitDice).toEqual([
    { die: 8, total: 2, left: 2 },
    { die: 6, total: 3, left: 3 },
  ]);
});

test("two classes with the same die size are one pair: cleric 5 and warlock 3 are 8 d8", () => {
  expect(sheetOf(e2e("cleric-5-warlock-3")).hitDice).toEqual([{ die: 8, total: 8, left: 8 }]);
});

test("the sheet reads the spent dice of the record, and a count above the dice of a size reads as all spent", () => {
  const e = engine();
  const entity = setHitDiceSpent(
    e,
    e2e("cleric-6-paladin-3-rogue-1-wizard-1"),
    new Map([
      [8, 2],
      [6, 4],
      [12, 1],
    ]),
  );
  expect(sheetOf(entity).hitDice).toEqual([
    { die: 10, total: 3, left: 3 },
    { die: 8, total: 7, left: 5 },
    { die: 6, total: 1, left: 0 },
  ]);
});

test("hitDiceTotals sums the levels by die size and leaves out a class with no die or no level", () => {
  const totals = hitDiceTotals([
    { hitDie: 6, level: 2 },
    { hitDie: 12, level: 1 },
    { hitDie: 6, level: 3 },
    { hitDie: 0, level: 4 },
    { hitDie: 8, level: 0 },
  ]);
  expect([...totals]).toEqual([
    [12, 1],
    [6, 5],
  ]);
  expect(hitDiceLeft(totals, new Map([[6, 9]]))).toEqual([
    { die: 12, total: 1, left: 1 },
    { die: 6, total: 5, left: 0 },
  ]);
});

test("a roll is a whole number from 1 to the die size", () => {
  expect(validRoll(1, 10)).toBe(1);
  expect(validRoll(10, 10)).toBe(10);
  for (const roll of [0, 11, -1, 2.5, null, undefined, Number.NaN]) expect(validRoll(roll, 10)).toBeNull();
});

test("Roll for me gives each face of the die from the random source", () => {
  expect(rollDie(10, () => 0)).toBe(1);
  expect(rollDie(10, () => 0.65)).toBe(7);
  expect(rollDie(10, () => 0.9999)).toBe(10);
  expect(rollDie(6, () => 1)).toBe(6);
});

test("a die heals the roll and the Constitution modifier, 0 or more", () => {
  expect(hitDieHealing(7, 2)).toBe(9);
  expect(hitDieHealing(4, -1)).toBe(3);
  expect(hitDieHealing(1, -3)).toBe(0);
});

test("the status texts", () => {
  expect(spendStatus(10, 7, 2)).toBe("Hit die d10: 7 + 2 = 9 healed.");
  expect(spendStatus(8, 5, 0)).toBe("Hit die d8: 5 + 0 = 5 healed.");
  expect(spendStatus(6, 4, -1)).toBe("Hit die d6: 4 − 1 = 3 healed.");
  expect(spendStatus(6, 1, -3)).toBe("Hit die d6: 1 − 3 = −2, 0 healed.");
  expect(regainStatus(10)).toBe("Hit die d10 regained.");
});

const dice: HitDie[] = [
  { die: 10, total: 3, left: 0 },
  { die: 8, total: 7, left: 5 },
];

test("Spend: one more die of that size is spent, and the heal is the roll and the modifier", () => {
  expect(applyHitDiceAction(dice, 2, { kind: "spend", die: 8, roll: 6 })).toEqual({ die: 8, spent: 3, heal: 8, status: "Hit die d8: 6 + 2 = 8 healed." });
});

test("Spend cannot spend a die of a size with none left, take a roll that is not valid, or spend a size the character does not have", () => {
  expect(applyHitDiceAction(dice, 2, { kind: "spend", die: 10, roll: 5 })).toBeNull();
  expect(applyHitDiceAction(dice, 2, { kind: "spend", die: 8, roll: 9 })).toBeNull();
  expect(applyHitDiceAction(dice, 2, { kind: "spend", die: 8, roll: 0 })).toBeNull();
  expect(applyHitDiceAction(dice, 2, { kind: "spend", die: 6, roll: 3 })).toBeNull();
});

test("Regain gives one spent die back and does not heal; with none spent it does nothing", () => {
  expect(applyHitDiceAction(dice, 2, { kind: "regain", die: 10 })).toEqual({ die: 10, spent: 2, heal: null, status: "Hit die d10 regained." });
  expect(applyHitDiceAction([{ die: 8, total: 7, left: 7 }], 2, { kind: "regain", die: 8 })).toBeNull();
});

test("the reader clamps the spent count to the dice of the size", () => {
  const entity = setHitDiceSpent(engine(), e2e("wizard-3-warlock-2"), new Map([[8, 5]]));
  expect([...hitDiceSpent(entity, hitDiceTotals(sheetOf(entity).classes))]).toEqual([[8, 2]]);
});
