import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import type { CastAction } from "./cast.ts";
import { applyCast } from "./cast-apply.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { concentration, setConcentration } from "./play.ts";
import { toSheet } from "./sheet.ts";
import { setSpentSlots, slotLayout } from "./spells.ts";

beforeAll(() => loadEngine());

const read = (file: string): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, file), "utf8"));
/** Wizard 3 / warlock 2: 4 1st-level and 2 2nd-level slots, and 2 pact slots of the 1st level. */
const wizardWarlock = () => read("../../e2e/wizard-3-warlock-2.strict.json");

const built = (entity: StrictEntity) => engine().evaluate(entity).built;
const sheetOf = (entity: StrictEntity) => toSheet(built(entity), entity);
const cast = (entity: StrictEntity, action: CastAction) => applyCast(engine(), entity, sheetOf(entity), action);
const spend = (entity: StrictEntity, group: number | "pact", n: number) => setSpentSlots(engine(), entity, slotLayout(built(entity)), group, n);

const missile = (group: number | "pact"): CastAction => ({ kind: "slot", key: "magic-missile", name: "Magic Missile", level: 1, group, concentration: false });

test("a cast spends one slot of its group and writes the whole record as one value", () => {
  const start = spend(wizardWarlock(), 1, 1);
  const result = cast(start, missile(1));
  expect(result.status).toBe("Cast Magic Missile. 1st-level slots −1 (2 left).");
  expect(result.entity).toEqual(spend(start, 1, 2));
});

test("a cast at a higher level spends that level, and a pact cast spends a pact slot, apart from the other slots of its level", () => {
  const start = wizardWarlock();
  const higher = cast(start, missile(2));
  expect(higher.status).toBe("Cast Magic Missile at 2nd level. 2nd-level slots −1 (1 left).");
  expect(higher.entity).toEqual(spend(start, 2, 1));
  const pact = cast(start, missile("pact"));
  expect(pact.status).toBe("Cast Magic Missile. Pact slots −1 (1 left).");
  expect(pact.entity).toEqual(spend(start, "pact", 1));
  expect(sheetOf(pact.entity).spellcasting?.slots.find((s) => s.level === 1)?.spent).toBe(0);
});

test("a cast with no slot left in its group, or with a group that cannot cast the spell, changes nothing", () => {
  const start = spend(wizardWarlock(), 2, 2);
  expect(cast(start, missile(2))).toEqual({ entity: start, status: "" });
  expect(cast(start, missile(5))).toEqual({ entity: start, status: "" });
  // The pact slots are of the 1st level, so they cannot cast a 2nd-level spell.
  const hold: CastAction = { kind: "slot", key: "hold-person", name: "Hold Person", level: 2, group: "pact", concentration: true };
  expect(cast(start, hold)).toEqual({ entity: start, status: "" });
});

test("a spell that needs concentration sets the mark with the slot, in one record; it replaces the mark of another spell", () => {
  const e = engine();
  const start = setConcentration(e, wizardWarlock(), "hold-person");
  const action: CastAction = { kind: "slot", key: "invisibility", name: "Invisibility", level: 2, group: 2, concentration: true };
  const result = cast(start, action);
  expect(result.status).toBe("Cast Invisibility. 2nd-level slots −1 (1 left).");
  expect(result.entity).toEqual(setConcentration(e, spend(start, 2, 1), "invisibility"));
  expect(concentration(result.entity)).toBe("invisibility");
});

test("the Concentrate button only sets the mark", () => {
  const e = engine();
  const start = wizardWarlock();
  const result = cast(start, { kind: "concentrate", key: "guidance", name: "Guidance" });
  expect(result).toEqual({ entity: setConcentration(e, start, "guidance"), status: "Concentrating on Guidance." });
});
