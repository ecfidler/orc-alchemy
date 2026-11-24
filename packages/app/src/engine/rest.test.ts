import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { setConcentration, setCurrentHitPoints, setDeathSaves, setExhaustion, setFeatureUsesSpent, setHitDiceSpent, setTempHitPoints } from "./play.ts";
import {
  arcaneRecoveryLimit,
  canPickSlot,
  canSpendDie,
  dawnStart,
  dawnUses,
  hitDiceBack,
  hitPointsAfter,
  longRest,
  longRestChangesNothing,
  longRestPicks,
  longRestReserve,
  longRestRows,
  nothingChanges,
  type RestRow,
  restKinds,
  type ShortRest,
  shortRest,
  shortRestPicks,
  shortRestRows,
  signed,
  slotLevelSum,
  validBack,
  validDice,
  validSlotPicks,
} from "./rest.ts";
import { type SheetFeature, toSheet } from "./sheet.ts";
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

/** The rows without their keys. */
const plain = (rows: RestRow[]) => rows.map(({ label, change }) => ({ label, change }));

test("the Rest menu has Short rest and Long rest, and Dawn only with one feature or more with Dawn uses", () => {
  expect(restKinds(sheetOf(fighter()))).toEqual(["short", "long"]);
  // Arcane Recovery comes back at dawn, also when it is not spent.
  expect(restKinds(sheetOf(wizard5()))).toEqual(["short", "long", "dawn"]);
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
    uses: [
      {
        key: "orcpub.dnd.e5.units/rest\nChannel Divinity",
        use: { units: "orcpub.dnd.e5.units/rest", name: "Channel Divinity" },
        name: "Channel Divinity",
        spent: 2,
      },
    ],
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
  expect(plain(shortRestRows(r, NONE))).toEqual([
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
  expect(plain(picked)).toEqual([
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
  expect(plain(shortRestRows(shortRest(sheetOf(warlock)), NONE))).toEqual([
    { label: "Pact Magic slots", change: "+1" },
    { label: "Arcane Recovery", change: null },
  ]);
});

test("signed counts use the minus sign U+2212", () => {
  expect([signed(2), signed(0), signed(-1)]).toEqual(["+2", "+0", "−1"]);
});

/** A feature with uses, spent or not, for a sheet made by hand. */
const feature = (name: string, unit: string, amount: number, spent: number): SheetFeature => ({
  name,
  text: "",
  uses: { amount, recharge: null, units: `orcpub.dnd.e5.units/${unit}`, name, spent },
});

/** A sheet with these features in its traits. */
const withTraits = (entity: StrictEntity, traits: SheetFeature[]) => {
  const sheet = sheetOf(entity);
  return { ...sheet, features: { ...sheet.features, traits } };
};

test("two features with the same name in two groups give two rows, each with its own key", () => {
  const sheet = withTraits(fighter(), [feature("Second Wind", "short-rest", 1, 1), feature("Second Wind", "rest", 1, 1)]);
  const rows = shortRestRows(shortRest(sheet), NONE).filter((row) => row.label === "Second Wind");
  expect(rows.map((row) => row.change)).toEqual(["+1", "+1"]);
  expect(new Set(rows.map((row) => row.key)).size).toBe(2);
  // The keys of a long rest are also unique.
  const long = longRestRows(longRest(sheet), { ate: true });
  expect(new Set(long.map((row) => row.key)).size).toBe(long.length);
});

test("a long rest gives back half the hit dice, rounded down and at least 1, the largest die first, and only spent dice", () => {
  // Wizard 3 / warlock 2: 2 d8 and 3 d6, so 2 dice come back; the d8 first.
  expect(
    hitDiceBack([
      { die: 8, total: 2, left: 0 },
      { die: 6, total: 3, left: 0 },
    ]),
  ).toEqual([{ die: 8, back: 2 }]);
  // One d8 is spent: it comes back, then one d6.
  expect(
    hitDiceBack([
      { die: 8, total: 2, left: 1 },
      { die: 6, total: 3, left: 0 },
    ]),
  ).toEqual([
    { die: 8, back: 1 },
    { die: 6, back: 1 },
  ]);
  // The order of the input does not count: the largest die comes back first.
  expect(
    hitDiceBack([
      { die: 6, total: 3, left: 0 },
      { die: 10, total: 1, left: 0 },
    ]),
  ).toEqual([
    { die: 10, back: 1 },
    { die: 6, back: 1 },
  ]);
  // Level 1: half of 1 rounded down is 0, so 1 comes back. Level 3: 1 comes back.
  expect(hitDiceBack([{ die: 10, total: 1, left: 0 }])).toEqual([{ die: 10, back: 1 }]);
  expect(hitDiceBack([{ die: 10, total: 3, left: 0 }])).toEqual([{ die: 10, back: 1 }]);
  // No die is spent: none comes back.
  expect(hitDiceBack([{ die: 10, total: 4, left: 4 }])).toEqual([]);
});

/** Wizard 3 / warlock 2 after a hard day: each value that a long rest changes, and the values that it must not change. */
function tired() {
  const e = engine();
  let entity = setCurrentHitPoints(e, wizardWarlock(), 3);
  entity = setTempHitPoints(e, entity, 4);
  entity = setDeathSaves(e, entity, { successes: 1, failures: 2 });
  entity = setConcentration(e, entity, "bless");
  entity = setExhaustion(e, entity, 2);
  entity = setHitDiceSpent(
    e,
    entity,
    new Map([
      [8, 1],
      [6, 3],
    ]),
  );
  entity = setFeatureUsesSpent(e, entity, "orcpub.dnd.e5.units/day", "Arcane Recovery", 1);
  return spendSlots(entity, [
    [1, 2],
    [2, 1],
    ["pact", 2],
  ]);
}

test("a long rest reads each value that it changes, and lists them in a fixed set of rows", () => {
  const sheet = withTraits(tired(), [
    ...sheetOf(tired()).features.traits,
    feature("Action Surge", "short-rest", 1, 1),
    feature("Channel Divinity", "rest", 2, 2),
    feature("Divine Sense", "long-rest", 3, 1),
    feature("Bardic Inspiration", "long-rest", 3, 0),
    feature("Rage of the round", "round", 1, 1),
    feature("Wand of Magic Missiles", "day", 7, 3),
  ]);
  const rest = longRest(sheet);
  expect(rest.dice).toEqual([
    { die: 8, back: 1 },
    { die: 6, back: 1 },
  ]);
  expect(rest.dawn.map(({ name, spent }) => [name, spent])).toEqual([
    ["Arcane Recovery", 1],
    ["Wand of Magic Missiles", 3],
  ]);
  const rows = (ate: boolean) => longRestRows(rest, { ate }).map(({ label, change }) => [label, change]);
  expect(rows(true)).toEqual([
    ["Hit points", "3 → 11 / 11"],
    ["Temporary hit points", "4 → 0"],
    ["1st-level slots", "+2"],
    ["2nd-level slots", "+1"],
    ["Pact Magic slots", "+2"],
    ["Action Surge", "+1"],
    ["Channel Divinity", "+2"],
    ["Divine Sense", "+1"],
    ["Hit dice (d8)", "+1"],
    ["Hit dice (d6)", "+1"],
    ["Death saves", "cleared"],
    ["Concentration", "cleared"],
    ["Exhaustion", "2 → 1"],
  ]);
  // "Ate and drank" off: the Exhaustion row stays, with no change.
  expect(rows(false).at(-1)).toEqual(["Exhaustion", null]);
  expect(rows(false).map(([label]) => label)).toEqual(rows(true).map(([label]) => label));
  expect(longRestPicks(rest)).toBe(true);
});

test("the Dawn list: each use of the group day, spent or not; the fields start at the spent count and stop at it", () => {
  const sheet = withTraits(fighter(), [feature("Wand", "day", 7, 3), feature("Cape", "day", 1, 0), feature("Boots", "long-rest", 1, 1)]);
  const uses = dawnUses(sheet);
  expect(uses.map(({ name, spent }) => [name, spent])).toEqual([
    ["Wand", 3],
    ["Cape", 0],
  ]);
  const [wand, cape] = uses.map((u) => u.key);
  expect([...dawnStart(uses)]).toEqual([
    [wand, 3],
    [cape, 0],
  ]);
  // Above the spent count stops at it; 0, a number below 0 and a key of no use give nothing back.
  expect([...validBack(uses, new Map([[wand ?? "", 9]]))]).toEqual([[wand, 3]]);
  expect([
    ...validBack(
      uses,
      new Map([
        [wand ?? "", 0],
        [cape ?? "", 1],
        ["other", 2],
      ]),
    ),
  ]).toEqual([]);
  expect([...validBack(uses, new Map([[wand ?? "", -2]]))]).toEqual([]);
});

test("a rest that changes nothing says so: a rested long rest, one with its checkboxes off, and a short rest with no picks", () => {
  const e = engine();
  // The fighter has 40 of 54 hit points: full hit points are no value.
  const rested = longRest(sheetOf(setCurrentHitPoints(e, fighter(), null)));
  expect(longRestRows(rested, { ate: true })).toEqual([]);
  expect(longRestChangesNothing(rested, { ate: true, dawn: true, back: new Map() })).toBe(true);
  expect(longRestPicks(rested)).toBe(false);
  // Exhaustion and a spent Dawn use: something changes only with a checkbox on and a number above 0.
  const wizard = longRest(
    sheetOf(setFeatureUsesSpent(e, setExhaustion(e, setCurrentHitPoints(e, wizard5(), null), 1), "orcpub.dnd.e5.units/day", "Arcane Recovery", 1)),
  );
  const back = dawnStart(wizard.dawn);
  expect(longRestChangesNothing(wizard, { ate: true, dawn: false, back })).toBe(false);
  expect(longRestChangesNothing(wizard, { ate: false, dawn: true, back })).toBe(false);
  expect(longRestChangesNothing(wizard, { ate: false, dawn: true, back: new Map() })).toBe(true);
  expect(longRestChangesNothing(wizard, { ate: false, dawn: false, back })).toBe(true);
  // The dialog keeps the space of the line only when the picks can take the rest to nothing and back.
  expect(longRestReserve(wizard)).toBe(true);
  expect(longRestReserve(rested)).toBe(false);
  // The hit points always come back, so the line is never needed.
  expect(longRestReserve(longRest(sheetOf(setExhaustion(e, setCurrentHitPoints(e, wizard5(), 10), 1))))).toBe(false);
  // A short rest with only rows that wait for a pick.
  const short = shortRestRows(shortRest(sheetOf(setCurrentHitPoints(e, fighter(), 10))), NONE);
  expect(short.length).toBeGreaterThan(0);
  expect(nothingChanges(short)).toBe(true);
  expect(shortRestPicks(shortRest(sheetOf(setCurrentHitPoints(e, fighter(), 10))))).toBe(true);
  // Channel Divinity always comes back, so the line is never needed.
  expect(
    shortRestPicks(shortRest(sheetOf(setFeatureUsesSpent(e, setCurrentHitPoints(e, multiclass(), 10), "orcpub.dnd.e5.units/rest", "Channel Divinity", 1)))),
  ).toBe(false);
});
