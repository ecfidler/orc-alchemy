import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import type { CastAction } from "./cast.ts";
import { applyCast } from "./cast-apply.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { concentration, setConcentration, setFeatureUsesSpent } from "./play.ts";
import { featureUses, toSheet } from "./sheet.ts";
import { setSpentSlots, slotLayout } from "./spells.ts";

beforeAll(() => loadEngine());

const read = (file: string): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, file), "utf8"));
/** Wizard 3 / warlock 2: 4 1st-level and 2 2nd-level slots, and 2 pact slots of the 1st level. */
const wizardWarlock = () => read("../../e2e/wizard-3-warlock-2.strict.json");
/** Warlock 20: 4 pact slots of the 5th level, Mystic Arcanum with 4 uses, and Thief of Five Fates (Bane) and Sign of Ill Omen (Bestow Curse). */
const warlock = () => read("../../e2e/warlock-20.strict.json");

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

// A spell with its own uses (ORC-321).

const LONG_REST = "orcpub.dnd.e5.units/long-rest";
const ARCANUM = { units: LONG_REST, name: "Mystic Arcanum" };
const FATES = { units: LONG_REST, name: "Eldritch Invocation: Thief of Five Fates" };
const suggestion: CastAction = {
  kind: "uses",
  key: "mass-suggestion",
  name: "Mass Suggestion",
  level: 6,
  feature: ARCANUM,
  label: "Mystic Arcanum",
  pact: false,
  concentration: false,
};
const bane: CastAction = { kind: "uses", key: "bane", name: "Bane", level: 1, feature: FATES, label: "Thief of Five Fates", pact: true, concentration: true };
/** The spent count that the use bubble of the sheet shows for a feature. */
const bubble = (entity: StrictEntity, name: string) => featureUses(sheetOf(entity)).find((uses) => uses.name === name)?.spent;

test("a Mystic Arcanum spell spends one use, which the use bubble of the sheet shows; a second cast of the same spell spends one more", () => {
  const e = engine();
  const start = warlock();
  const once = cast(start, suggestion);
  expect(once.status).toBe("Cast Mass Suggestion. Mystic Arcanum −1 (3 left).");
  expect(once.entity).toEqual(setFeatureUsesSpent(e, start, LONG_REST, "Mystic Arcanum", 1));
  expect(bubble(once.entity, "Mystic Arcanum")).toBe(1);
  // No slot is spent.
  expect(sheetOf(once.entity).spellcasting?.pact?.spent).toBe(0);
  const twice = cast(once.entity, suggestion);
  expect(twice.status).toBe("Cast Mass Suggestion. Mystic Arcanum −1 (2 left).");
  expect(bubble(twice.entity, "Mystic Arcanum")).toBe(2);
});

test("an invocation spell spends the use of its invocation and a pact slot, and sets the concentration mark, in one record", () => {
  const e = engine();
  const start = warlock();
  const result = cast(start, bane);
  expect(result.status).toBe("Cast Bane at 5th level. Thief of Five Fates −1 (0 left), Pact slots −1 (3 left).");
  const expected = setConcentration(e, spend(setFeatureUsesSpent(e, start, LONG_REST, FATES.name, 1), "pact", 1), "bane");
  expect(result.entity).toEqual(expected);
  expect(bubble(result.entity, FATES.name)).toBe(1);
  expect(sheetOf(result.entity).spellcasting?.pact?.spent).toBe(1);
});

test("a cast with no use left, with no pact slot left, or with a feature that the sheet does not have changes nothing", () => {
  const e = engine();
  const spentUse = setFeatureUsesSpent(e, warlock(), LONG_REST, FATES.name, 1);
  expect(cast(spentUse, bane)).toEqual({ entity: spentUse, status: "" });
  const allArcanum = setFeatureUsesSpent(e, warlock(), LONG_REST, "Mystic Arcanum", 4);
  expect(cast(allArcanum, suggestion)).toEqual({ entity: allArcanum, status: "" });
  // No pact slot left: the use is not spent either.
  const noSlot = spend(warlock(), "pact", 4);
  expect(cast(noSlot, bane)).toEqual({ entity: noSlot, status: "" });
  const start = warlock();
  expect(cast(start, { ...suggestion, feature: { units: LONG_REST, name: "Fey Step" } })).toEqual({ entity: start, status: "" });
});
