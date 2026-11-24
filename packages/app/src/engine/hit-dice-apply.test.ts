import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { applyHitDice } from "./hit-dice-apply.ts";
import { currentHitPoints, deathSaves, hitDiceSpent, setCurrentHitPoints, setDeathSaves, setHitDiceSpent, setTempHitPoints, tempHitPoints } from "./play.ts";
import { toSheet } from "./sheet.ts";

beforeAll(() => loadEngine());

/** Cleric 6 / paladin 3 / rogue 1 / wizard 1: 3 d10, 7 d8 and 1 d6, Constitution +1, 91 hit points. */
const multiclass = (): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, "../../e2e/cleric-6-paladin-3-rogue-1-wizard-1.strict.json"), "utf8"));
const sheetOf = (entity: StrictEntity) => toSheet(engine().evaluate(entity).built, entity);

test("Spend heals by the Heal rule, clears the death saves and spends one die of that size", () => {
  const e = engine();
  let entity = setCurrentHitPoints(e, multiclass(), 10);
  entity = setDeathSaves(e, entity, { successes: 1, failures: 1 });
  entity = setTempHitPoints(e, entity, 4);
  const result = applyHitDice(e, entity, sheetOf(entity), { kind: "spend", die: 8, roll: 5 });
  expect(result.status).toBe("Hit die d8: 5 + 1 = 6 healed.");
  expect(currentHitPoints(result.entity)).toBe(16);
  expect(deathSaves(result.entity)).toEqual({ successes: 0, failures: 0 });
  expect(tempHitPoints(result.entity)).toBe(4);
  expect([...hitDiceSpent(result.entity)]).toEqual([[8, 1]]);
  expect(sheetOf(result.entity).hitDice).toEqual([
    { die: 10, total: 3, left: 3 },
    { die: 8, total: 7, left: 6 },
    { die: 6, total: 1, left: 1 },
  ]);
});

test("Spend at full hit points spends the die and keeps full hit points as no value", () => {
  const e = engine();
  const entity = multiclass();
  const result = applyHitDice(e, entity, sheetOf(entity), { kind: "spend", die: 10, roll: 10 });
  expect(result.status).toBe("Hit die d10: 10 + 1 = 11 healed.");
  expect(currentHitPoints(result.entity)).toBeNull();
  expect([...hitDiceSpent(result.entity)]).toEqual([[10, 1]]);
});

test("Spend stops at the maximum and writes no value there", () => {
  const e = engine();
  const entity = setCurrentHitPoints(e, multiclass(), 88);
  const result = applyHitDice(e, entity, sheetOf(entity), { kind: "spend", die: 6, roll: 6 });
  expect(currentHitPoints(result.entity)).toBeNull();
  expect([...hitDiceSpent(result.entity)]).toEqual([[6, 1]]);
});

test("Regain gives one die back and does not change the hit points or the death saves", () => {
  const e = engine();
  let entity = setCurrentHitPoints(e, multiclass(), 0);
  entity = setDeathSaves(e, entity, { successes: 0, failures: 2 });
  entity = setHitDiceSpent(
    e,
    entity,
    new Map([
      [10, 2],
      [8, 1],
    ]),
  );
  const result = applyHitDice(e, entity, sheetOf(entity), { kind: "regain", die: 10 });
  expect(result.status).toBe("Hit die d10 regained.");
  expect(currentHitPoints(result.entity)).toBe(0);
  expect(deathSaves(result.entity)).toEqual({ successes: 0, failures: 2 });
  expect([...hitDiceSpent(result.entity)]).toEqual([
    [10, 1],
    [8, 1],
  ]);
  // The last die back removes the entry, and with no entry the key goes.
  const once = applyHitDice(e, result.entity, sheetOf(result.entity), { kind: "regain", die: 10 });
  const twice = applyHitDice(e, once.entity, sheetOf(once.entity), { kind: "regain", die: 8 });
  expect([...hitDiceSpent(twice.entity)]).toEqual([]);
});

test("an action that cannot be done changes nothing: Spend with no die left, Regain with none spent", () => {
  const e = engine();
  const entity = setHitDiceSpent(e, multiclass(), new Map([[6, 1]]));
  const sheet = sheetOf(entity);
  expect(applyHitDice(e, entity, sheet, { kind: "spend", die: 6, roll: 3 })).toEqual({ entity, status: "" });
  expect(applyHitDice(e, entity, sheet, { kind: "regain", die: 8 })).toEqual({ entity, status: "" });
});

test("a stored count above the dice of a size counts as all spent; Regain writes one less than the dice", () => {
  const e = engine();
  const entity = setHitDiceSpent(e, multiclass(), new Map([[10, 9]]));
  const result = applyHitDice(e, entity, sheetOf(entity), { kind: "regain", die: 10 });
  expect([...hitDiceSpent(result.entity)]).toEqual([[10, 2]]);
});
