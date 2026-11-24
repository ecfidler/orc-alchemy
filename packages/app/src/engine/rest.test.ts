import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { setCurrentHitPoints, setFeatureUsesSpent, setHitDiceSpent } from "./play.ts";
import {
  arcaneRecoveryLimit,
  canPickSlot,
  canSpendDie,
  hitPointsAfter,
  restKinds,
  type ShortRest,
  shortRest,
  shortRestRows,
  signed,
  slotLevelSum,
  validDice,
  validSlotPicks,
} from "./rest.ts";
import { toSheet } from "./sheet.ts";
import { setSpentSlots, slotLayout } from "./spells.ts";

beforeAll(() => loadEngine());

const read = (file: string): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, file), "utf8"));
/** Cleric 6 / paladin 3 / rogue 1 / wizard 1: 3 d10, 7 d8 and 1 d6, Constitution +1, 91 hit points; Channel Divinity of two classes. */
const multiclass = () => read("../../e2e/cleric-6-paladin-3-rogue-1-wizard-1.strict.json");
/** Wizard 3 / warlock 2: 2 d8 and 3 d6; 4 1st-level and 2 2nd-level slots, and 2 pact slots of the 1st level. */
const wizardWarlock = () => read("../../e2e/wizard-3-warlock-2.strict.json");
/** Wizard 5: 5 d6; slots of the 1st to the 3rd level. */
const wizard5 = () => read("../../../../fixtures/characters/wizard-5.strict.json");
/** Wizard 11: slots up to the 6th level. */
const wizard11 = () => read("../../../../fixtures/characters/wizard-11.strict.json");
/** Fighter 5: Second Wind and Action Surge, which come back at a rest; 40 of 54 hit points. */
const fighter = () => read("../../../../fixtures/characters/fighter-5.strict.json");

const built = (entity: StrictEntity) => engine().evaluate(entity).built;
const sheetOf = (entity: StrictEntity) => toSheet(built(entity), entity);
const spendSlots = (entity: StrictEntity, spent: [group: number | "pact", n: number][]) =>
  spent.reduce((next, [group, n]) => setSpentSlots(engine(), next, slotLayout(built(entity)), group, n), entity as object);

const NONE = { dice: [], arcaneRecovery: new Map() };

test("the Rest menu has Short rest; Long rest and Dawn come with ORC-319", () => {
  expect(restKinds(sheetOf(fighter()))).toEqual(["short"]);
});

test("Arcane Recovery gives back slot levels up to half the wizard level, rounded up", () => {
  expect([1, 2, 3, 4, 5, 11, 20].map(arcaneRecoveryLimit)).toEqual([1, 1, 2, 2, 3, 6, 10]);
});

test("a short rest reads the hit points, the dice, the pact slots and the spent uses of the groups short-rest and rest by name", () => {
  const e = engine();
  let entity = setCurrentHitPoints(e, multiclass(), 50);
  entity = setHitDiceSpent(e, entity, new Map([[8, 2]]));
  // Channel Divinity of the cleric (2 uses) and of the paladin (1 use) share one count: one row.
  entity = setFeatureUsesSpent(e, entity, "orcpub.dnd.e5.units/rest", "Channel Divinity", 2);
  // A use of the group long-rest does not come back.
  entity = setFeatureUsesSpent(e, entity, "orcpub.dnd.e5.units/long-rest", "Divine Sense", 1);
  const rest = shortRest(sheetOf(entity));
  expect(rest).toEqual({
    current: 50,
    max: 91,
    conModifier: 1,
    dice: [
      { die: 10, total: 3, left: 3 },
      { die: 8, total: 7, left: 5 },
      { die: 6, total: 1, left: 1 },
    ],
    pactSpent: 0,
    uses: [{ name: "Channel Divinity", spent: 2 }],
    arcaneRecovery: { use: { units: "orcpub.dnd.e5.units/day", name: "Arcane Recovery" }, limit: 1, slots: [] },
  });
});

test("Arcane Recovery lists only spent slots that are not pact slots, of the 5th level or lower and not above the limit", () => {
  // Wizard 3: the limit is 2. The 1st and the 2nd level can come back; the pact slots cannot.
  const warlock = spendSlots(wizardWarlock(), [
    [1, 3],
    [2, 1],
    ["pact", 2],
  ]);
  const rest = shortRest(sheetOf(warlock));
  expect(rest.pactSpent).toBe(2);
  expect(rest.arcaneRecovery).toEqual({
    use: { units: "orcpub.dnd.e5.units/day", name: "Arcane Recovery" },
    limit: 2,
    slots: [
      { level: 1, spent: 3 },
      { level: 2, spent: 1 },
    ],
  });
  // Wizard 11: the limit is 6, but no slot of the 6th level comes back. A level with no spent slot is not listed.
  const w11 = spendSlots(wizard11(), [
    [1, 1],
    [5, 1],
    [6, 1],
  ]);
  expect(shortRest(sheetOf(w11)).arcaneRecovery?.slots).toEqual([
    { level: 1, spent: 1 },
    { level: 5, spent: 1 },
  ]);
});

test("Arcane Recovery is not in a short rest when its use is spent, or without the feature", () => {
  const e = engine();
  const spent = setFeatureUsesSpent(e, wizard5(), "orcpub.dnd.e5.units/day", "Arcane Recovery", 1);
  expect(shortRest(sheetOf(spent)).arcaneRecovery).toBeNull();
  expect(shortRest(sheetOf(fighter())).arcaneRecovery).toBeNull();
});

test("the picks of Arcane Recovery: the sum of the levels stays at the limit or below, and only spent slots come back", () => {
  const recovery = {
    use: { units: null, name: "Arcane Recovery" },
    limit: 3,
    slots: [
      { level: 1, spent: 2 },
      { level: 2, spent: 1 },
      { level: 3, spent: 1 },
    ],
  };
  const picks = (...entries: [number, number][]) => new Map(entries);
  expect(canPickSlot(recovery, picks(), 3)).toBe(true);
  expect(canPickSlot(recovery, picks([2, 1]), 1)).toBe(true);
  expect(canPickSlot(recovery, picks([2, 1]), 2)).toBe(false);
  expect(canPickSlot(recovery, picks([2, 1], [1, 1]), 1)).toBe(false);
  expect(canPickSlot(recovery, picks([1, 2]), 1)).toBe(false);
  expect(canPickSlot(recovery, picks(), 4)).toBe(false);
  expect(slotLevelSum(picks([1, 2], [3, 1]))).toBe(5);
  // A pick past a limit is left out: the lowest level first.
  expect([...validSlotPicks(recovery, picks([3, 1], [1, 5], [4, 1]))]).toEqual([[1, 2]]);
  expect([...validSlotPicks(recovery, picks([2, 1], [1, 1]))]).toEqual([
    [1, 1],
    [2, 1],
  ]);
  expect([...validSlotPicks(null, picks([1, 1]))]).toEqual([]);
});

const rest = (current: number, dice: { die: number; total: number; left: number }[]): ShortRest => ({
  current,
  max: 44,
  conModifier: 2,
  dice,
  pactSpent: 0,
  uses: [],
  arcaneRecovery: null,
});

test("hit dice heal the roll and the Constitution modifier, and stop at the maximum; no die can be spent at full hit points", () => {
  const r = rest(30, [{ die: 10, total: 5, left: 2 }]);
  expect(hitPointsAfter(r, [{ die: 10, roll: 4 }])).toBe(36);
  expect(
    hitPointsAfter(r, [
      { die: 10, roll: 10 },
      { die: 10, roll: 10 },
    ]),
  ).toBe(44);
  expect(canSpendDie(r, [{ die: 10, roll: 4 }], 10)).toBe(true);
  // No die left.
  expect(
    canSpendDie(
      r,
      [
        { die: 10, roll: 1 },
        { die: 10, roll: 1 },
      ],
      10,
    ),
  ).toBe(false);
  // Full hit points.
  expect(
    canSpendDie(
      r,
      [
        { die: 10, roll: 10 },
        { die: 10, roll: 10 },
      ],
      10,
    ),
  ).toBe(false);
  expect(canSpendDie(rest(44, [{ die: 10, total: 5, left: 5 }]), [], 10)).toBe(false);
  // A die past full hit points, past the dice left, of a size that is not there, or with a roll that is not valid, is left out.
  expect(
    validDice(r, [
      { die: 10, roll: 0 },
      { die: 8, roll: 3 },
      { die: 10, roll: 9 },
      { die: 10, roll: 9 },
      { die: 10, roll: 9 },
    ]),
  ).toEqual([
    { die: 10, roll: 9 },
    { die: 10, roll: 9 },
  ]);
  const almost = rest(40, [{ die: 10, total: 5, left: 5 }]);
  expect(
    validDice(almost, [
      { die: 10, roll: 5 },
      { die: 10, roll: 5 },
    ]),
  ).toEqual([{ die: 10, roll: 5 }]);
});

test("the rows of 'This rest will change' are a fixed set; counts have a sign and the hit points an arrow", () => {
  const e = engine();
  let entity = setCurrentHitPoints(e, multiclass(), 50);
  entity = setFeatureUsesSpent(e, entity, "orcpub.dnd.e5.units/rest", "Channel Divinity", 1);
  entity = spendSlots(entity, [[1, 2]]);
  const r = shortRest(sheetOf(entity));
  expect(shortRestRows(r, NONE)).toEqual([
    { label: "Hit points", change: null },
    { label: "Hit dice (d10)", change: null },
    { label: "Hit dice (d8)", change: null },
    { label: "Hit dice (d6)", change: null },
    { label: "Channel Divinity", change: "+1" },
    { label: "1st-level slots", change: null },
    { label: "Arcane Recovery", change: null },
  ]);
  const picked = shortRestRows(r, {
    dice: [
      { die: 8, roll: 5 },
      { die: 8, roll: 2 },
      { die: 6, roll: 4 },
    ],
    arcaneRecovery: new Map([[1, 1]]),
  });
  expect(picked).toEqual([
    { label: "Hit points", change: "50 → 64 / 91" },
    { label: "Hit dice (d10)", change: null },
    { label: "Hit dice (d8)", change: "−2" },
    { label: "Hit dice (d6)", change: "−1" },
    { label: "Channel Divinity", change: "+1" },
    { label: "1st-level slots", change: "+1" },
    { label: "Arcane Recovery", change: "−1" },
  ]);
  expect(picked.map((row) => row.label)).toEqual(shortRestRows(r, NONE).map((row) => row.label));
});

test("a rested character has no row, and the pact slots have one row with all of them", () => {
  expect(shortRestRows(shortRest(sheetOf(setFeatureUsesSpent(engine(), wizard5(), "orcpub.dnd.e5.units/day", "Arcane Recovery", 1))), NONE)).toEqual([]);
  // Full hit points: no row for the hit points and the dice. The wizard has Arcane Recovery and no spent slot: only its use row.
  const warlock = spendSlots(wizardWarlock(), [["pact", 1]]);
  expect(shortRestRows(shortRest(sheetOf(warlock)), NONE)).toEqual([
    { label: "Pact Magic slots", change: "+1" },
    { label: "Arcane Recovery", change: null },
  ]);
});

test("signed counts use the minus sign U+2212", () => {
  expect([signed(2), signed(0), signed(-1)]).toEqual(["+2", "+0", "−1"]);
});
