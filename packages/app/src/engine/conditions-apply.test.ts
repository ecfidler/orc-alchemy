import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { applyConditions } from "./conditions-apply.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { applyHitPoints } from "./hit-points-apply.ts";
import { setConcentration, setConditions, setCurrentHitPoints, setDeathSaves, setExhaustion, setTempHitPoints } from "./play.ts";
import { toSheet } from "./sheet.ts";

beforeAll(() => loadEngine());

/** Any maximum: these actions do not read it. */
const MAX = 44;

const warlock = (): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/warlock-10-drow.strict.json"), "utf8"));

test("add and remove write the whole set of conditions in the order of the list, and the rest of the record stays", () => {
  const e = engine();
  const added = applyConditions(e, setConditions(e, warlock(), ["prone"]), MAX, { kind: "add", condition: "blinded" });
  expect(added).toEqual({ entity: setConditions(e, warlock(), ["blinded", "prone"]), status: "Blinded added." });
  const removed = applyConditions(e, added.entity, MAX, { kind: "remove", condition: "prone" });
  expect(removed).toEqual({ entity: setConditions(e, warlock(), ["blinded"]), status: "Prone removed." });
  // The last condition takes the key away: the record is as it was.
  expect(applyConditions(e, removed.entity, MAX, { kind: "remove", condition: "blinded" })).toEqual({ entity: warlock(), status: "Blinded removed." });
});

test("an action that changes nothing keeps the record and gives no status", () => {
  const e = engine();
  const entity = setConditions(e, warlock(), ["prone"]);
  expect(applyConditions(e, entity, MAX, { kind: "add", condition: "prone" })).toEqual({ entity, status: "" });
  expect(applyConditions(e, entity, MAX, { kind: "remove", condition: "poisoned" })).toEqual({ entity, status: "" });
  expect(applyConditions(e, entity, MAX, { kind: "end-concentration", name: "Bless" })).toEqual({ entity, status: "" });
});

test("the X of the concentration mark removes the mark and nothing else", () => {
  const e = engine();
  const entity = setConcentration(e, setConditions(e, warlock(), ["prone"]), "hold-person");
  expect(applyConditions(e, entity, MAX, { kind: "end-concentration", name: "Hold Person" })).toEqual({
    entity: setConditions(e, warlock(), ["prone"]),
    status: "Concentration on Hold Person ended.",
  });
});

test("the sheet shows the conditions and speed 0 with its cause; Unconscious at 0 hit points is not in the record", () => {
  const e = engine();
  const sheetOf = (entity: StrictEntity) => toSheet(e.evaluate(entity).built, entity);
  const plain = sheetOf(warlock());
  expect(plain).toMatchObject({ conditions: [], speedCause: null });
  expect(plain.speeds[0]?.feet).toBeGreaterThan(0);
  const restrained = sheetOf(setConditions(e, warlock(), ["restrained", "poisoned"]));
  expect(restrained.conditions).toEqual(["poisoned", "restrained"]);
  expect(restrained.speedCause).toBe("Restrained");
  expect(restrained.speeds.map((speed) => speed.feet)).toEqual(plain.speeds.map(() => 0));
  expect(restrained.speeds.map((speed) => speed.label)).toEqual(plain.speeds.map((speed) => speed.label));
  const down = setCurrentHitPoints(e, warlock(), 0);
  expect(sheetOf(down)).toMatchObject({ conditions: [], speedCause: "Unconscious" });
});

test("Damage with a concentration mark gives the note with the DC from the full damage; without a mark or damage, no note", () => {
  const e = engine();
  const marked = setTempHitPoints(e, setConcentration(e, warlock(), "bless"), 10);
  expect(applyHitPoints(e, marked, 44, { kind: "damage", amount: 30 }).note).toEqual({ spell: "bless", dc: 15 });
  expect(applyHitPoints(e, marked, 44, { kind: "damage", amount: 4 }).note).toEqual({ spell: "bless", dc: 10 });
  expect(applyHitPoints(e, marked, 44, { kind: "damage", amount: 0 }).note).toBeUndefined();
  expect(applyHitPoints(e, marked, 44, { kind: "heal", amount: 5 }).note).toBeUndefined();
  expect(applyHitPoints(e, warlock(), 44, { kind: "damage", amount: 30 }).note).toBeUndefined();
  // Damage does not end the concentration.
  expect(applyHitPoints(e, marked, 44, { kind: "damage", amount: 30 }).entity).toEqual(setCurrentHitPoints(e, setConcentration(e, warlock(), "bless"), 24));
});

// Exhaustion (ORC-323).

const sheetOf = (entity: StrictEntity) => toSheet(engine().evaluate(entity).built, entity);
/** The hit point maximum of the engine for the warlock, and its half. */
const full = () => sheetOf(warlock()).baseMaxHitPoints;
const half = () => Math.floor(full() / 2);
const exhaust = (entity: StrictEntity, level: number) => applyConditions(engine(), entity, full(), { kind: "exhaustion", level });

test("the menu adds exhaustion at level 1; the circles change it; level 0 takes the key away", () => {
  const e = engine();
  expect(exhaust(warlock(), 1)).toEqual({ entity: setExhaustion(e, warlock(), 1), status: "Exhaustion added." });
  expect(exhaust(setExhaustion(e, warlock(), 1), 2)).toEqual({ entity: setExhaustion(e, warlock(), 2), status: "Exhaustion 1 → 2." });
  expect(exhaust(setExhaustion(e, warlock(), 2), 0)).toEqual({ entity: warlock(), status: "Exhaustion removed." });
  // The same level, or a level past 6, changes nothing past the limit.
  const two = setExhaustion(e, warlock(), 2);
  expect(exhaust(two, 2)).toEqual({ entity: two, status: "" });
  expect(exhaust(setExhaustion(e, warlock(), 6), 7)).toEqual({ entity: setExhaustion(e, warlock(), 6), status: "" });
});

test("level 4 writes the current hit points down to the halved maximum; they do not come back below level 4", () => {
  const e = engine();
  const four = exhaust(setExhaustion(e, warlock(), 3), 4);
  expect(four).toEqual({
    entity: setCurrentHitPoints(e, setExhaustion(e, warlock(), 4), half()),
    status: `Exhaustion 3 → 4, hit points ${full()} → ${half()}.`,
  });
  expect(sheetOf(four.entity)).toMatchObject({ currentHitPoints: half(), maxHitPoints: half(), baseMaxHitPoints: full() });
  const three = exhaust(four.entity, 3);
  expect(three.entity).toEqual(setCurrentHitPoints(e, setExhaustion(e, warlock(), 3), half()));
  expect(sheetOf(three.entity)).toMatchObject({ currentHitPoints: half(), maxHitPoints: full() });
  // Hit points at the halved maximum or below stay.
  const low = setCurrentHitPoints(e, setExhaustion(e, warlock(), 3), 10);
  expect(exhaust(low, 4)).toEqual({ entity: setCurrentHitPoints(e, setExhaustion(e, warlock(), 4), 10), status: "Exhaustion 3 → 4." });
});

test("level 6 shows Dead and changes no hit points and no death saves", () => {
  const e = engine();
  const start = setDeathSaves(e, setCurrentHitPoints(e, setExhaustion(e, warlock(), 5), 7), { successes: 1, failures: 1 });
  const six = exhaust(start, 6);
  expect(six.entity).toEqual(setDeathSaves(e, setCurrentHitPoints(e, setExhaustion(e, warlock(), 6), 7), { successes: 1, failures: 1 }));
  expect(sheetOf(six.entity)).toMatchObject({ exhaustion: 6, currentHitPoints: 7, deathSaves: { successes: 1, failures: 1 } });
  expect(sheetOf(six.entity).speeds.every((speed) => speed.feet === 0)).toBe(true);
});

test("the sheet at each level from 0 to 6: the speed halves from 2 and is 0 from 5, the maximum halves from 4", () => {
  const e = engine();
  const plain = sheetOf(warlock());
  const speed = plain.speeds[0]?.feet ?? 0;
  const rows = [0, 1, 2, 3, 4, 5, 6].map((level) => {
    const sheet = sheetOf(setExhaustion(e, warlock(), level));
    return [sheet.speeds[0]?.feet, sheet.speedCause, sheet.maxHitPoints];
  });
  const h = Math.floor(speed / 2);
  expect(rows).toEqual([
    [speed, null, full()],
    [speed, null, full()],
    [h, "Exhaustion", full()],
    [h, "Exhaustion", full()],
    [h, "Exhaustion", half()],
    [0, "Exhaustion", half()],
    [0, "Exhaustion", half()],
  ]);
});

test("Damage, Heal and Set HP use the halved maximum; at it they write the number, not full hit points", () => {
  const e = engine();
  const four = setExhaustion(e, warlock(), 4);
  const at = (hp: number) => setCurrentHitPoints(e, four, hp);
  expect(applyHitPoints(e, at(5), full(), { kind: "heal", amount: 999 })).toEqual({ entity: at(half()), status: "999 healed." });
  expect(applyHitPoints(e, at(5), full(), { kind: "set", amount: 999 })).toEqual({ entity: at(half()), status: `Hit points set to ${half()}.` });
  // With no stored value (full), the hit points that show are the halved maximum.
  expect(applyHitPoints(e, four, full(), { kind: "damage", amount: 2 })).toEqual({ entity: at(half() - 2), status: "2 damage." });
  // Instant death: the damage past 0 is the halved maximum or more.
  expect(applyHitPoints(e, at(1), full(), { kind: "damage", amount: 1 + half() }).entity).toEqual(setDeathSaves(e, at(0), { successes: 0, failures: 3 }));
  // Below level 4, a heal to the full maximum writes full hit points.
  expect(applyHitPoints(e, setCurrentHitPoints(e, warlock(), 5), full(), { kind: "heal", amount: 999 }).entity).toEqual(warlock());
});
