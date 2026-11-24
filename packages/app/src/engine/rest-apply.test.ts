import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { setCurrentHitPoints, setDeathSaves, setFeatureUsesSpent, setHitDiceSpent, setTempHitPoints } from "./play.ts";
import { applyRest } from "./rest-apply.ts";
import { toSheet } from "./sheet.ts";
import { setSpentSlots, slotLayout } from "./spells.ts";

beforeAll(() => loadEngine());

const read = (file: string): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, file), "utf8"));
/** Cleric 6 / paladin 3 / rogue 1 / wizard 1: 3 d10, 7 d8 and 1 d6, Constitution +1, 91 hit points. */
const multiclass = () => read("../../e2e/cleric-6-paladin-3-rogue-1-wizard-1.strict.json");
/** Wizard 3 / warlock 2: Constitution +1, 11 hit points; 2 d8 and 3 d6; 4 1st-level and 2 2nd-level slots, and 2 pact slots. */
const wizardWarlock = () => read("../../e2e/wizard-3-warlock-2.strict.json");

const built = (entity: StrictEntity) => engine().evaluate(entity).built;
const sheetOf = (entity: StrictEntity) => toSheet(built(entity), entity);
const spendSlots = (entity: StrictEntity, spent: [group: number | "pact", n: number][]) =>
  spent.reduce((next, [group, n]) => setSpentSlots(engine(), next, slotLayout(built(entity)), group, n), entity as object);
const shortRest = (entity: StrictEntity, dice: { die: number; roll: number }[], picks: [number, number][] = []) =>
  applyRest(engine(), entity, sheetOf(entity), { kind: "short", dice, arcaneRecovery: new Map(picks) });

test("a short rest spends the dice, heals by the Heal rule, gives back the uses of short-rest and rest, and writes the whole record at once", () => {
  const e = engine();
  const start = multiclass();
  let entity = setCurrentHitPoints(e, start, 50);
  entity = setDeathSaves(e, entity, { successes: 1, failures: 0 });
  entity = setTempHitPoints(e, entity, 3);
  entity = setHitDiceSpent(e, entity, new Map([[8, 1]]));
  entity = setFeatureUsesSpent(e, entity, "orcpub.dnd.e5.units/rest", "Channel Divinity", 2);
  entity = setFeatureUsesSpent(e, entity, "orcpub.dnd.e5.units/long-rest", "Divine Sense", 1);
  entity = spendSlots(entity, [
    [1, 2],
    [2, 1],
  ]);
  const result = shortRest(
    entity,
    [
      { die: 8, roll: 5 },
      { die: 10, roll: 7 },
    ],
    [[1, 1]],
  );
  expect(result.status).toBe("Short rest finished.");
  // The whole record: the rest changes only the play state and the spent slots, as one value.
  let expected = setCurrentHitPoints(e, start, 64);
  expected = setTempHitPoints(e, expected, 3);
  expected = setHitDiceSpent(
    e,
    expected,
    new Map([
      [10, 1],
      [8, 2],
    ]),
  );
  expected = setFeatureUsesSpent(e, expected, "orcpub.dnd.e5.units/long-rest", "Divine Sense", 1);
  expected = setFeatureUsesSpent(e, expected, "orcpub.dnd.e5.units/day", "Arcane Recovery", 1);
  expected = spendSlots(expected, [
    [1, 1],
    [2, 1],
  ]);
  expect(result.entity).toEqual(expected);
});

test("the pact slots come back; Arcane Recovery gives back the picked slots and spends its use; the dice stop at full hit points", () => {
  const e = engine();
  const start = wizardWarlock();
  let entity = setCurrentHitPoints(e, start, 2);
  entity = spendSlots(entity, [
    [1, 3],
    [2, 2],
    ["pact", 2],
  ]);
  // Each d6 roll of 6 heals 7: 2 + 7 = 9, then the second die stops at the maximum of 11, so the d8 is past full hit points and is not spent.
  const result = shortRest(
    entity,
    [
      { die: 6, roll: 6 },
      { die: 6, roll: 6 },
      { die: 8, roll: 1 },
    ],
    [[2, 1]],
  );
  // Full hit points are no value.
  let expected = setHitDiceSpent(e, start, new Map([[6, 2]]));
  expected = setFeatureUsesSpent(e, expected, "orcpub.dnd.e5.units/day", "Arcane Recovery", 1);
  expected = spendSlots(expected, [
    [1, 3],
    [2, 1],
  ]);
  expect(result.entity).toEqual(expected);
});

test("picks that the rules do not allow change nothing: slot levels above the limit, a slot that is not spent, a used Arcane Recovery", () => {
  const e = engine();
  const start = spendSlots(wizardWarlock(), [[1, 1]]);
  // Limit 2: one 2nd-level slot is not spent, so it is not a pick; two 1st-level slots are more than the spent one.
  const result = shortRest(
    start,
    [],
    [
      [2, 1],
      [1, 2],
    ],
  );
  expect(result.entity).toEqual(setFeatureUsesSpent(e, spendSlots(start, [[1, 0]]), "orcpub.dnd.e5.units/day", "Arcane Recovery", 1));
  const used = setFeatureUsesSpent(e, start, "orcpub.dnd.e5.units/day", "Arcane Recovery", 1);
  expect(shortRest(used, [], [[1, 1]]).entity).toEqual(used);
});

test("a rest that changes nothing keeps the record as it is", () => {
  const entity = multiclass();
  expect(shortRest(entity, [{ die: 10, roll: 5 }])).toEqual({ entity, status: "Short rest finished." });
});
