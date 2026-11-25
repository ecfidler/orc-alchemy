import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { applyConditions } from "./conditions-apply.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { applyHitPoints } from "./hit-points-apply.ts";
import { setConcentration, setConditions, setCurrentHitPoints, setTempHitPoints } from "./play.ts";
import { toSheet } from "./sheet.ts";

beforeAll(() => loadEngine());

const warlock = (): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/warlock-10-drow.strict.json"), "utf8"));

test("add and remove write the whole set of conditions in the order of the list, and the rest of the record stays", () => {
  const e = engine();
  const added = applyConditions(e, setConditions(e, warlock(), ["prone"]), { kind: "add", condition: "blinded" });
  expect(added).toEqual({ entity: setConditions(e, warlock(), ["blinded", "prone"]), status: "Blinded added." });
  const removed = applyConditions(e, added.entity, { kind: "remove", condition: "prone" });
  expect(removed).toEqual({ entity: setConditions(e, warlock(), ["blinded"]), status: "Prone removed." });
  // The last condition takes the key away: the record is as it was.
  expect(applyConditions(e, removed.entity, { kind: "remove", condition: "blinded" })).toEqual({ entity: warlock(), status: "Blinded removed." });
});

test("an action that changes nothing keeps the record and gives no status", () => {
  const e = engine();
  const entity = setConditions(e, warlock(), ["prone"]);
  expect(applyConditions(e, entity, { kind: "add", condition: "prone" })).toEqual({ entity, status: "" });
  expect(applyConditions(e, entity, { kind: "remove", condition: "poisoned" })).toEqual({ entity, status: "" });
  expect(applyConditions(e, entity, { kind: "end-concentration", name: "Bless" })).toEqual({ entity, status: "" });
});

test("the X of the concentration mark removes the mark and nothing else", () => {
  const e = engine();
  const entity = setConcentration(e, setConditions(e, warlock(), ["prone"]), "hold-person");
  expect(applyConditions(e, entity, { kind: "end-concentration", name: "Hold Person" })).toEqual({
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
