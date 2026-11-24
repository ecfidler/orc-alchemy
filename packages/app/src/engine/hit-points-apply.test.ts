import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { applyHitPoints } from "./hit-points-apply.ts";
import { currentHitPoints, deathSaves, setCurrentHitPoints, setDeathSaves, setTempHitPoints, tempHitPoints } from "./play.ts";

beforeAll(() => loadEngine());

const warlock = (): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/warlock-10-drow.strict.json"), "utf8"));

test("writes the current hit points, the temporary hit points and the death saves of the rule", () => {
  const e = engine();
  let entity = setTempHitPoints(e, warlock(), 5);
  entity = setCurrentHitPoints(e, entity, 20);
  const result = applyHitPoints(e, entity, 44, { kind: "damage", amount: 12 });
  expect(result.status).toBe("12 damage (5 from the temporary hit points).");
  expect(currentHitPoints(result.entity)).toBe(13);
  expect(tempHitPoints(result.entity)).toBe(0);
});

test("full hit points are written as no value, and Heal clears the death saves", () => {
  const e = engine();
  let entity = setCurrentHitPoints(e, warlock(), 0);
  entity = setDeathSaves(e, entity, { successes: 1, failures: 2 });
  const result = applyHitPoints(e, entity, 44, { kind: "heal", amount: 50 });
  expect(result.status).toBe("50 healed.");
  expect(currentHitPoints(result.entity)).toBeNull();
  expect(deathSaves(result.entity)).toEqual({ successes: 0, failures: 0 });
});

test("a temporary hit points action keeps a stored current value above the maximum", () => {
  const e = engine();
  // A stored 30 above a maximum of 22, as with exhaustion level 4.
  const entity = setCurrentHitPoints(e, warlock(), 30);
  const set = applyHitPoints(e, entity, 22, { kind: "set-temp", amount: 6 });
  expect(set.status).toBe("Temporary hit points set to 6.");
  expect(currentHitPoints(set.entity)).toBe(30);
  expect(tempHitPoints(set.entity)).toBe(6);
  const removed = applyHitPoints(e, set.entity, 22, { kind: "remove-temp" });
  expect(currentHitPoints(removed.entity)).toBe(30);
  expect(tempHitPoints(removed.entity)).toBe(0);
});
