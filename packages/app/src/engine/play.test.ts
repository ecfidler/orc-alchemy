import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { characterFile, exportBundle, readCharacterFile } from "./import.ts";
import {
  acPick,
  CONDITION_KEYS,
  concentration,
  conditions,
  currentHitPoints,
  deathSaves,
  exhaustion,
  featureUsesSpent,
  hitDiceSpent,
  inspiration,
  NO_RECHARGE,
  rechargeGroup,
  setAcPick,
  setConcentration,
  setConditions,
  setCurrentHitPoints,
  setDeathSaves,
  setExhaustion,
  setFeatureUsesSpent,
  setHitDiceSpent,
  setInspiration,
  setTempHitPoints,
  setUsesSpent,
  tempHitPoints,
  usesSpent,
} from "./play.ts";

beforeAll(() => loadEngine());

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const readJson = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));
const VALUES = "~:orcpub.entity.strict/values";
const valuesOf = (entity: StrictEntity) => (JSON.parse(JSON.stringify(entity))[VALUES] ?? {}) as Record<string, unknown>;
const storedAt = (entity: StrictEntity, key: string) => valuesOf(entity)[`~:${key}`];
/** The entity with these raw values set, as a record from another source could have them. */
const withRaw = (entity: StrictEntity, raw: Record<string, unknown>) => {
  const copy = JSON.parse(JSON.stringify(entity));
  copy[VALUES] = Object.assign(copy[VALUES] ?? {}, Object.fromEntries(Object.entries(raw).map(([key, value]) => [`~:${key}`, value])));
  return copy;
};

const LONG_REST = "orcpub.dnd.e5.units/long-rest";
const THIEF = "Eldritch Invocation: Thief of Five Fates";

/** Every value that the readers give, to compare after each step. */
const playState = (entity: StrictEntity) => ({
  current: currentHitPoints(entity),
  temp: tempHitPoints(entity),
  deathSaves: deathSaves(entity),
  hitDice: [...hitDiceSpent(entity)],
  uses: [...usesSpent(entity)].map(([group, features]) => [group, [...features]]),
  concentration: concentration(entity),
  conditions: [...conditions(entity)],
  exhaustion: exhaustion(entity),
  inspiration: inspiration(entity),
  acPick: acPick(entity),
});

/** Each feature with uses in built, as [unit, name]. */
function featuresWithUses(built: unknown): [string | undefined, string][] {
  const found: [string | undefined, string][] = [];
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === "object") {
      const { name, frequency } = value as { name?: unknown; frequency?: { units?: string } | null };
      if (typeof name === "string" && frequency) found.push([frequency.units, name]);
      Object.values(value).forEach(walk);
    }
  };
  walk(JSON.parse(JSON.stringify(built)));
  return found;
}

test("setValue takes the key with its full namespace and without ~:", () => {
  const e = engine();
  const warlock = readJson("warlock-10-drow.strict.json");
  expect(valuesOf(e.setValue(warlock, "orc-alchemy.play/temp-hit-points", 5))["~:orc-alchemy.play/temp-hit-points"]).toBe(5);
  // With ~: the engine makes a second tag: the key is lost to the readers.
  expect(Object.keys(valuesOf(e.setValue(warlock, "~:orc-alchemy.play/temp-hit-points", 5)))).toContain("~:~:orc-alchemy.play/temp-hit-points");
});

test("each key goes through setValue, evaluate, addLevel, removeLevel, export and import", () => {
  const e = engine();
  const warlock: StrictEntity = readJson("warlock-10-drow.strict.json");
  const builtBefore = JSON.stringify(e.evaluate(warlock).built);
  let entity: StrictEntity = warlock;
  entity = setCurrentHitPoints(e, entity, 31);
  entity = setTempHitPoints(e, entity, 8);
  entity = setDeathSaves(e, entity, { successes: 2, failures: 1 });
  entity = setHitDiceSpent(e, entity, new Map([[8, 3]]));
  entity = setUsesSpent(
    e,
    entity,
    new Map([
      [LONG_REST, new Map([["Channel Divinity", 1]])],
      [NO_RECHARGE, new Map([[THIEF, 1]])],
    ]),
  );
  entity = setConcentration(e, entity, "hex");
  entity = setConditions(e, entity, ["prone", "poisoned"]);
  entity = setExhaustion(e, entity, 2);
  entity = setInspiration(e, entity, true);
  entity = setAcPick(e, entity, { armor: "leather", shield: null });

  const expected = {
    current: 31,
    temp: 8,
    deathSaves: { successes: 2, failures: 1 },
    hitDice: [[8, 3]],
    uses: [
      [LONG_REST, [["Channel Divinity", 1]]],
      [NO_RECHARGE, [[THIEF, 1]]],
    ],
    concentration: "hex",
    conditions: ["poisoned", "prone"],
    exhaustion: 2,
    inspiration: true,
    acPick: { armor: "leather", shield: null },
  };
  expect(playState(entity)).toEqual(expected);
  const record = valuesOf(entity);
  // The stored form is the table of the spec.
  expect(storedAt(entity, "orc-alchemy.play/death-saves")).toEqual({ "~:successes": 2, "~:failures": 1 });
  expect(storedAt(entity, "orc-alchemy.play/hit-dice-spent")).toEqual({ "~i8": 3 });
  expect(storedAt(entity, "orc-alchemy.play/conditions")).toEqual({ "~#set": ["~:poisoned", "~:prone"] });
  expect(storedAt(entity, "orc-alchemy.play/ac-pick")).toEqual({ "~:armor": "~:leather", "~:shield": null });
  expect(storedAt(entity, "orc-alchemy.play/concentration")).toBe("~:hex");

  // evaluate: built changes only by the current hit points.
  const built = e.evaluate(entity).built;
  expect(built["current-hit-points"]).toBe(31);
  expect(JSON.stringify({ ...built, "current-hit-points": null })).toBe(JSON.stringify({ ...JSON.parse(builtBefore), "current-hit-points": null }));

  // addLevel and removeLevel keep the values.
  entity = e.addLevel(entity, "warlock");
  expect(playState(entity)).toEqual(expected);
  entity = e.removeLevel(entity, "warlock");
  expect(playState(entity)).toEqual(expected);
  expect(valuesOf(entity)).toEqual(record);

  // Export and import, as one file and as a bundle.
  const one = readCharacterFile(JSON.stringify(characterFile({ entity }))).characters[0].entity;
  expect(valuesOf(one)).toEqual(record);
  expect(playState(one)).toEqual(expected);
  const bundle = readCharacterFile(JSON.stringify(exportBundle([{ entity }], "test"))).characters[0].entity;
  expect(valuesOf(bundle)).toEqual(record);
  expect(playState(bundle)).toEqual(expected);
});

test("spent uses: recharge group to feature name to count, with the features of built, keeps through each step", () => {
  const e = engine();
  const warlock: StrictEntity = readJson("warlock-10-drow.strict.json");
  const barbarian: StrictEntity = readJson("barbarian-5.strict.json");
  const features = [...featuresWithUses(e.evaluate(warlock).built), ...featuresWithUses(e.evaluate(barbarian).built)];
  // The engine gives the unit as a namespaced keyword without ~:.
  expect(features).toContainEqual([LONG_REST, "Eldritch Invocation: Mire the Mind"]);
  expect(features).toContainEqual([LONG_REST, "Rage"]);

  let entity: StrictEntity = warlock;
  const names: [string | undefined, string][] = [
    ...features,
    [LONG_REST, "Channel Divinity"],
    [undefined, THIEF],
    // Names that Transit would read in another way without an escape.
    ["orcpub.dnd.e5.units/rest", "~Tilde"],
    ["orcpub.dnd.e5.units/rest", "^Caret"],
    ["orcpub.dnd.e5.units/rest", "`Backtick"],
    ["orcpub.dnd.e5.units/rest", "10"],
  ];
  names.forEach(([units, name], i) => {
    entity = setFeatureUsesSpent(e, entity, units, name, i + 1);
  });
  const stored = storedAt(entity, "orc-alchemy.play/uses-spent") as Record<string, Record<string, number>>;
  expect(stored[`~:${LONG_REST}`]).toMatchObject({ "Eldritch Invocation: Mire the Mind": expect.any(Number), "Channel Divinity": expect.any(Number) });
  expect(stored["~:orc-alchemy.play/no-recharge"]).toEqual({ [THIEF]: names.length - 4 });
  expect(stored["~:orcpub.dnd.e5.units/rest"]).toEqual({
    "~~Tilde": names.length - 3,
    "~^Caret": names.length - 2,
    "~`Backtick": names.length - 1,
    "10": names.length,
  });

  const check = (x: StrictEntity) => names.forEach(([units, name], i) => expect([name, featureUsesSpent(x, units, name)]).toEqual([name, i + 1]));
  check(entity);
  e.evaluate(entity);
  entity = e.addLevel(entity, "warlock");
  check(entity);
  entity = e.removeLevel(entity, "warlock");
  check(entity);
  const imported = readCharacterFile(JSON.stringify(exportBundle([{ entity }], "test"))).characters[0].entity;
  check(imported);
  expect(storedAt(imported, "orc-alchemy.play/uses-spent")).toEqual(stored);
});

test("spent uses: two features of one name and group share a count, and a count reads up to the amount", () => {
  const e = engine();
  let entity: StrictEntity = readJson("warlock-10-drow.strict.json");
  entity = setFeatureUsesSpent(e, entity, LONG_REST, "Channel Divinity", 3);
  expect(featureUsesSpent(entity, LONG_REST, "Channel Divinity", 1)).toBe(1);
  expect(featureUsesSpent(entity, LONG_REST, "Channel Divinity", 2)).toBe(2);
  expect(featureUsesSpent(entity, `~:${LONG_REST}`, "Channel Divinity")).toBe(3);
  expect(featureUsesSpent(entity, "orcpub.dnd.e5.units/rest", "Channel Divinity")).toBe(0);
  // The stored count stays.
  expect(storedAt(entity, "orc-alchemy.play/uses-spent")).toEqual({ [`~:${LONG_REST}`]: { "Channel Divinity": 3 } });
  expect(rechargeGroup(undefined)).toBe(NO_RECHARGE);
  expect(rechargeGroup("")).toBe(NO_RECHARGE);
});

test("each writer writes the empty state as no key", () => {
  const e = engine();
  const warlock: StrictEntity = readJson("warlock-10-drow.strict.json");
  let entity: StrictEntity = warlock;
  entity = setCurrentHitPoints(e, entity, 12);
  entity = setTempHitPoints(e, entity, 4);
  entity = setDeathSaves(e, entity, { successes: 1, failures: 0 });
  entity = setHitDiceSpent(e, entity, new Map([[8, 1]]));
  entity = setFeatureUsesSpent(e, entity, LONG_REST, "Rage", 1);
  entity = setConcentration(e, entity, "bless");
  entity = setConditions(e, entity, ["prone"]);
  entity = setExhaustion(e, entity, 1);
  entity = setInspiration(e, entity, true);
  entity = setAcPick(e, entity, { armor: null, shield: null });

  entity = setCurrentHitPoints(e, entity, null);
  entity = setTempHitPoints(e, entity, 0);
  entity = setDeathSaves(e, entity, { successes: 0, failures: 0 });
  entity = setHitDiceSpent(e, entity, new Map([[8, 0]]));
  entity = setFeatureUsesSpent(e, entity, LONG_REST, "Rage", 0);
  entity = setConcentration(e, entity, null);
  entity = setConditions(e, entity, []);
  entity = setExhaustion(e, entity, 0);
  entity = setInspiration(e, entity, false);
  entity = setAcPick(e, entity, null);
  expect(valuesOf(entity)).toEqual(valuesOf(warlock));
});

test("the writers keep the counts in their limits", () => {
  const e = engine();
  const warlock: StrictEntity = readJson("warlock-10-drow.strict.json");
  expect(storedAt(setCurrentHitPoints(e, warlock, -4), "orcpub.dnd.e5.character/current-hit-points")).toBe(0);
  expect(storedAt(setTempHitPoints(e, warlock, -3), "orc-alchemy.play/temp-hit-points")).toBeUndefined();
  expect(storedAt(setTempHitPoints(e, warlock, 4.7), "orc-alchemy.play/temp-hit-points")).toBe(4);
  expect(storedAt(setDeathSaves(e, warlock, { successes: 5, failures: -1 }), "orc-alchemy.play/death-saves")).toEqual({ "~:successes": 3, "~:failures": 0 });
  expect(storedAt(setExhaustion(e, warlock, 9), "orc-alchemy.play/exhaustion")).toBe(6);
  expect(storedAt(setConditions(e, warlock, ["prone", "bleeding", "blinded"]), "orc-alchemy.play/conditions")).toEqual({
    "~#set": ["~:blinded", "~:prone"],
  });
  expect(
    storedAt(
      setHitDiceSpent(
        e,
        warlock,
        new Map([
          [6, 1],
          [10, 2],
          [8, -1],
        ]),
      ),
      "orc-alchemy.play/hit-dice-spent",
    ),
  ).toEqual({ "~i10": 2, "~i6": 1 });
});

test("a reader gives the empty state for a value that is not valid, and a count above its limit reads as the limit", () => {
  const warlock: StrictEntity = readJson("warlock-10-drow.strict.json");
  const empty = playState(warlock);
  expect(empty).toEqual({
    current: null,
    temp: 0,
    deathSaves: { successes: 0, failures: 0 },
    hitDice: [],
    uses: [],
    concentration: null,
    conditions: [],
    exhaustion: 0,
    inspiration: false,
    acPick: null,
  });
  const junk = withRaw(warlock, {
    "orcpub.dnd.e5.character/current-hit-points": "12",
    "orc-alchemy.play/temp-hit-points": 2.5,
    "orc-alchemy.play/death-saves": [2, 1],
    "orc-alchemy.play/hit-dice-spent": "~i10",
    "orc-alchemy.play/uses-spent": { "~:x": [1] },
    "orc-alchemy.play/concentration": "bless",
    "orc-alchemy.play/conditions": { "~#set": "~:prone" },
    "orc-alchemy.play/exhaustion": -2,
    "orc-alchemy.play/inspiration": "true",
    "orc-alchemy.play/ac-pick": { "~:armor": 3 },
  });
  expect(playState(junk)).toEqual(empty);

  const partly = withRaw(warlock, {
    "orcpub.dnd.e5.character/current-hit-points": 50,
    "orc-alchemy.play/death-saves": { "~:successes": 7, "~:failures": "x" },
    "orc-alchemy.play/hit-dice-spent": { "~i8": 4, "~i6": 0, "8": 2, "~i10": "2" },
    "orc-alchemy.play/uses-spent": { "~:orcpub.dnd.e5.units/rest": { "Second Wind": 2, Bad: -1 }, notTagged: { Rage: 1 } },
    "orc-alchemy.play/conditions": { "~#set": ["~:prone", "~:bleeding", "poisoned"] },
    "orc-alchemy.play/exhaustion": 8,
    "orc-alchemy.play/ac-pick": { "~:armor": "~:leather" },
  });
  expect(playState(partly)).toEqual({
    ...empty,
    current: 50,
    deathSaves: { successes: 3, failures: 0 },
    hitDice: [[8, 4]],
    uses: [["orcpub.dnd.e5.units/rest", [["Second Wind", 2]]]],
    conditions: ["prone"],
    exhaustion: 6,
    acPick: { armor: "leather", shield: null },
  });
  // The limits that depend on the character come from the caller.
  expect(currentHitPoints(partly, 44)).toBe(44);
  expect([...hitDiceSpent(partly, new Map([[8, 3]]))]).toEqual([[8, 3]]);
  expect([...hitDiceSpent(partly, new Map([[10, 3]]))]).toEqual([]);
  expect(featureUsesSpent(partly, "orcpub.dnd.e5.units/rest", "Second Wind", 1)).toBe(1);
});

test("the condition keys are the 14 of the SRD", () => {
  expect(CONDITION_KEYS).toHaveLength(14);
});
