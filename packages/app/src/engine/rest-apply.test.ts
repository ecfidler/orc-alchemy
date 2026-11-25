import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import {
  inspiration,
  setConcentration,
  setConditions,
  setCurrentHitPoints,
  setDeathSaves,
  setExhaustion,
  setFeatureUsesSpent,
  setHitDiceSpent,
  setInspiration,
  setTempHitPoints,
} from "./play.ts";
import { type DawnBack, dawnStart, dawnUses } from "./rest.ts";
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

test("a short rest keeps the conditions, Unconscious among them, and the concentration mark (ORC-322)", () => {
  const e = engine();
  const start = setConcentration(e, setConditions(e, multiclass(), ["unconscious", "poisoned", "restrained"]), "bless");
  const result = shortRest(start, []);
  expect(result).toEqual({ entity: start, status: "Short rest finished." });
});

const DAY = "orcpub.dnd.e5.units/day";

/** The play state that no rest changes: inspiration, the conditions, and the uses of the groups round, minute and hour. */
function untouched(entity: StrictEntity) {
  const e = engine();
  let next = setInspiration(e, entity, true);
  next = setConditions(e, next, ["prone", "poisoned"]);
  for (const unit of ["round", "minute", "hour"]) next = setFeatureUsesSpent(e, next, `orcpub.dnd.e5.units/${unit}`, `A ${unit} use`, 1);
  return next;
}

/** Wizard 3 / warlock 2 after a hard day, with the play state that no rest changes. */
function tired() {
  const e = engine();
  let entity = setCurrentHitPoints(e, untouched(wizardWarlock()), 3);
  entity = setTempHitPoints(e, entity, 4);
  entity = setDeathSaves(e, entity, { successes: 1, failures: 2 });
  entity = setConcentration(e, entity, "bless");
  entity = setExhaustion(e, entity, 2);
  // 1 of 2 d8 and 3 of 3 d6 spent: half of 5 is 2, so the d8 and one d6 come back.
  entity = setHitDiceSpent(
    e,
    entity,
    new Map([
      [8, 1],
      [6, 3],
    ]),
  );
  entity = setFeatureUsesSpent(e, entity, DAY, "Arcane Recovery", 1);
  entity = setFeatureUsesSpent(e, entity, "orcpub.dnd.e5.units/long-rest", "Divine Sense", 1);
  entity = setFeatureUsesSpent(e, entity, "orcpub.dnd.e5.units/rest", "Channel Divinity", 2);
  entity = setFeatureUsesSpent(e, entity, "orcpub.dnd.e5.units/short-rest", "Action Surge", 1);
  return spendSlots(entity, [
    [1, 2],
    [2, 1],
    ["pact", 2],
  ]);
}

const longRest = (entity: StrictEntity, ate: boolean, dawn: boolean, back?: DawnBack) => {
  const sheet = sheetOf(entity);
  return applyRest(engine(), entity, sheet, { kind: "long", ate, dawn, back: back ?? dawnStart(dawnUses(sheet)) });
};

test("a long rest writes each change at once and keeps inspiration, the conditions and the round, minute and hour uses", () => {
  const e = engine();
  const result = longRest(tired(), true, true);
  expect(result.status).toBe("Long rest finished.");
  // The whole record: full hit points, no temporary hit points, death saves, concentration or spent slots; one d6 spent;
  // exhaustion 1; the uses of short-rest, rest, long-rest and day back.
  let expected = setHitDiceSpent(e, untouched(wizardWarlock()), new Map([[6, 2]]));
  expected = setExhaustion(e, expected, 1);
  expect(result.entity).toEqual(expected);
});

test("a long rest with 'Ate and drank' off keeps the exhaustion level; with 'Dawn came during the rest' off, the Dawn uses stay spent", () => {
  const e = engine();
  let expected = setHitDiceSpent(e, untouched(wizardWarlock()), new Map([[6, 2]]));
  expected = setExhaustion(e, expected, 2);
  expected = setFeatureUsesSpent(e, expected, DAY, "Arcane Recovery", 1);
  expect(longRest(tired(), false, false).entity).toEqual(expected);
});

test("the hit dice of a long rest: half the total, at least 1, the largest die first; a long rest at level 1 gives back the one die", () => {
  const e = engine();
  // All 5 dice spent: 2 come back, both d8.
  const spent = setHitDiceSpent(
    e,
    wizardWarlock(),
    new Map([
      [8, 2],
      [6, 3],
    ]),
  );
  expect(longRest(spent, true, true).entity).toEqual(setHitDiceSpent(e, wizardWarlock(), new Map([[6, 3]])));
  const wizard1 = read("../../../../fixtures/characters/wizard-1.strict.json");
  expect(longRest(setHitDiceSpent(e, wizard1, new Map([[6, 1]])), true, true).entity).toEqual(setCurrentHitPoints(e, wizard1, null));
});

test("the Dawn dialog gives back the numbers of its fields, up to the spent count, and nothing else", () => {
  const e = engine();
  const start = untouched(setFeatureUsesSpent(e, tired(), DAY, "Arcane Recovery", 1));
  const sheet = sheetOf(start);
  const [arcane] = dawnUses(sheet);
  const dawn = (back: DawnBack) => applyRest(e, start, sheet, { kind: "dawn", back });
  expect(dawn(new Map([[arcane?.key ?? "", 5]]))).toEqual({ entity: setFeatureUsesSpent(e, start, DAY, "Arcane Recovery", 0), status: "Dawn finished." });
  // 0 back changes nothing.
  expect(dawn(new Map([[arcane?.key ?? "", 0]])).entity).toEqual(start);
  // A long rest with Dawn and 0 in the field keeps the Dawn use spent.
  expect(longRest(tired(), true, true, new Map([[arcane?.key ?? "", 0]])).entity).toEqual(
    setFeatureUsesSpent(e, setExhaustion(e, setHitDiceSpent(e, untouched(wizardWarlock()), new Map([[6, 2]])), 1), DAY, "Arcane Recovery", 1),
  );
});

test("a long rest and a Dawn that change nothing keep the record as it is", () => {
  const entity = untouched(setCurrentHitPoints(engine(), wizardWarlock(), null));
  expect(longRest(entity, true, true)).toEqual({ entity, status: "Long rest finished." });
  expect(applyRest(engine(), entity, sheetOf(entity), { kind: "dawn", back: new Map() })).toEqual({ entity, status: "Dawn finished." });
});

test("a long rest at exhaustion level 4: with 'Ate and drank' the hit points go to full; without it, to the halved maximum as a number (ORC-323)", () => {
  const e = engine();
  const half = Math.floor(sheetOf(wizardWarlock()).maxHitPoints / 2);
  const start = setCurrentHitPoints(e, setExhaustion(e, wizardWarlock(), 4), 3);
  expect(longRest(start, true, false).entity).toEqual(setExhaustion(e, wizardWarlock(), 3));
  expect(longRest(start, false, false).entity).toEqual(setCurrentHitPoints(e, setExhaustion(e, wizardWarlock(), 4), half));
  // The halved maximum is a number in the record: it does not come back when the level goes down.
  expect(sheetOf(setExhaustion(e, longRest(start, false, false).entity, 3)).currentHitPoints).toBe(half);
});

test("no rest changes inspiration: a short rest, a long rest and a Dawn keep it set, and keep it off (ORC-324)", () => {
  const e = engine();
  for (const on of [true, false]) {
    const start = setInspiration(e, tired(), on);
    const sheet = sheetOf(start);
    const rests = [
      applyRest(e, start, sheet, { kind: "short", dice: [{ die: 8, roll: 5 }], arcaneRecovery: new Map() }),
      longRest(start, true, true),
      applyRest(e, start, sheet, { kind: "dawn", back: dawnStart(dawnUses(sheet)) }),
    ];
    expect(rests.map((rest) => inspiration(rest.entity))).toEqual([on, on, on]);
  }
});
