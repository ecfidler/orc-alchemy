import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { setQuantity } from "./equipment.ts";
import { characterFile, readCharacterFile } from "./import.ts";
import { toSheet } from "./sheet.ts";
import {
  loadSpellContent,
  pactSlots,
  pactSlotsAt,
  preparedSpells,
  setPrepared,
  setSpentSlots,
  slotLayout,
  slotPositions,
  spellLevelOf,
  spentSlots,
} from "./spells.ts";

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const readJson = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));
const q = (key: string) => `~:orcpub.dnd.e5.character/${key}`;
const BY_CLASS = q("prepared-spells-by-class");

type StrictOption = { "~:orcpub.entity.strict/key": string; "~:orcpub.entity.strict/selections"?: StrictSelection[] };
type StrictSelection = {
  "~:orcpub.entity.strict/key": string;
  "~:orcpub.entity.strict/option"?: StrictOption;
  "~:orcpub.entity.strict/options"?: StrictOption[];
};
/** The option keys stored at a path of selection and option keys, in the entity's order. */
function stored(entity: { "~:orcpub.entity.strict/selections"?: StrictSelection[] }, path: string[]): string[] {
  let selections = entity["~:orcpub.entity.strict/selections"];
  for (let i = 0; i < path.length; i += 2) {
    const selection = selections?.find((s) => s["~:orcpub.entity.strict/key"] === `~:${path[i]}`);
    const single = selection?.["~:orcpub.entity.strict/option"];
    const options = selection?.["~:orcpub.entity.strict/options"] ?? (single ? [single] : []);
    if (i + 1 === path.length) return options.map((o) => o["~:orcpub.entity.strict/key"].replace(/^~:/, ""));
    selections = options.find((o) => o["~:orcpub.entity.strict/key"] === `~:${path[i + 1]}`)?.["~:orcpub.entity.strict/selections"];
  }
  return [];
}
/** The stored prepared spells, with each set sorted, to compare as sets. */
const preparedOf = (entity: StrictEntity) =>
  ((JSON.parse(JSON.stringify(entity))["~:orcpub.entity.strict/values"][BY_CLASS] ?? []) as Record<string, { "~#set": string[] }>[]).map((entry) => ({
    ...entry,
    [q("prepared-spells")]: { "~#set": [...entry[q("prepared-spells")]["~#set"]].sort() },
  }));

beforeAll(() => loadEngine());

test("wizard-20 by the builder's calls builds as the fixture, with its prepared spells", () => {
  const e = engine();
  const golden = readJson("wizard-20.strict.json");
  let entity: StrictEntity = e.emptyCharacter();
  const select = (path: string[], ...keys: string[]) => {
    for (const key of keys) entity = e.select(entity, path, key);
  };
  const copy = (path: string[]) => select(path, ...stored(golden, path));

  copy(["race"]);
  copy(["race", "human", "subrace"]);
  copy(["race", "human", "variant"]);
  copy(["background"]);
  copy(["background", "acolyte", "starting-equipment-holy-symbol"]);
  copy(["background", "acolyte", "starting-equipment-prayer-book-wheel"]);
  copy(["alignment"]);
  // The fixture also picks Common, which the engine refuses: a human knows it.
  select(["languages"], ...stored(golden, ["languages"]).filter((key) => key !== "common"));
  const scores = golden["~:orcpub.entity.strict/selections"].find((s: StrictSelection) => s["~:orcpub.entity.strict/key"] === "~:ability-scores")[
    "~:orcpub.entity.strict/option"
  ];
  entity = e.setField(entity, ["ability-scores", "standard-scores"], scores["~:orcpub.entity.strict/map-value"]);

  const wizard = ["class", "wizard"];
  entity = e.setClass(entity, 0, "wizard");
  for (const key of [
    "starting-equipment-melee-weapon",
    "starting-equipment-equipment-pack",
    "starting-equipment-spellcasting-equipment",
    "skill-proficiency",
  ]) {
    copy([...wizard, key]);
  }
  for (let n = 2; n <= 20; n++) {
    const level = [...wizard, "levels", `level-${n}`];
    entity = e.addLevel(entity, "wizard");
    // Every level after the first stores the average, 4.
    entity = e.setField(entity, [...level, "hit-points", "average"], 4);
    if (n === 2) copy([...level, "arcane-tradition"]);
    const [asiOrFeat] = stored(golden, [...level, "asi-or-feat"]);
    if (asiOrFeat !== undefined) {
      select([...level, "asi-or-feat"], asiOrFeat);
      for (const ability of stored(golden, [...level, "asi-or-feat", asiOrFeat, "asi"])) {
        entity = e.increaseAbility(entity, [...level, "asi-or-feat", asiOrFeat, "asi"], ability.replace(/^orcpub\.dnd\.e5\.character\//, ""));
      }
    }
  }
  // The merged spell selections, then the level 18 and 20 picks, which take known spells.
  copy([...wizard, "wizard-cantrips-known"]);
  copy([...wizard, "wizard-spells-known"]);
  copy([...wizard, "levels", "level-18", "spell-mastery-level-1-spell"]);
  copy([...wizard, "levels", "level-18", "spell-mastery-level-2-spell"]);
  copy([...wizard, "levels", "level-20", "signature-spells"]);
  const values = golden["~:orcpub.entity.strict/values"] as Record<string, unknown>;
  entity = e.setValue(entity, "character-name", values[q("character-name")]);
  entity = e.setValue(entity, "xps", values[q("xps")]);
  // The acolyte's 15 gp, changed to 1500 on the Equipment step.
  entity = setQuantity(e, entity, "treasure", "gp", 1500);
  for (const key of preparedSpells(golden).Wizard!) entity = setPrepared(e, entity, "Wizard", key, true);

  const built = JSON.parse(JSON.stringify(e.evaluate(entity).built));
  const expected = readJson("wizard-20.expected.json");
  expect(Object.keys(built).sort()).toEqual(Object.keys(expected).sort());
  // Trait order follows the order of the entity's top-level selections; see classes.test.ts.
  const byName = (traits: { name: string }[]) => [...traits].sort((a, b) => a.name.localeCompare(b.name));
  expect(byName(built.traits)).toEqual(byName(expected.traits));
  for (const key of Object.keys(expected)) {
    if (key !== "traits") expect({ [key]: built[key] }).toEqual({ [key]: expected[key] });
  }
  expect(preparedOf(entity)).toEqual(preparedOf(golden));
  // Alone it takes about 2 seconds; with the whole suite in parallel, longer.
}, 20_000);

test("a wizard 3 and cleric 2 has the slots of a level 5 caster", () => {
  const e = engine();
  let entity = e.setField(
    e.emptyCharacter(),
    ["ability-scores", "standard-scores"],
    Object.fromEntries(Object.entries({ str: 8, dex: 14, con: 13, int: 15, wis: 13, cha: 10 }).map(([a, n]) => [q(a), n])),
  );
  entity = e.setClass(entity, 0, "wizard");
  entity = e.addLevel(entity, "wizard");
  entity = e.addLevel(entity, "wizard");
  entity = e.addClass(entity, "cleric");
  entity = e.addLevel(entity, "cleric");
  const built = e.evaluate(entity).built;
  expect(built["spell-slots"]).toEqual({ "1": 4, "2": 3, "3": 2 });
  const spellcasting = toSheet(built, entity).spellcasting!;
  expect(spellcasting.slots).toEqual([
    { level: 1, count: 4, spent: 0 },
    { level: 2, count: 3, spent: 0 },
    { level: 3, count: 2, spent: 0 },
  ]);
  expect(spellcasting.knownModes).toMatchObject({ Cleric: "all" });
});

test("setPrepared adds and removes a spell, in the golden shape, for each class", () => {
  const e = engine();
  let entity: StrictEntity = e.emptyCharacter();
  entity = setPrepared(e, entity, "Wizard", "alarm", true);
  entity = setPrepared(e, entity, "Wizard", "charm-person", true);
  entity = setPrepared(e, entity, "Cleric", "bless", true);
  expect(preparedSpells(entity)).toEqual({ Wizard: new Set(["alarm", "charm-person"]), Cleric: new Set(["bless"]) });
  const stored = JSON.parse(JSON.stringify(entity))["~:orcpub.entity.strict/values"][BY_CLASS];
  expect(stored).toContainEqual({ [q("class-name")]: "Wizard", [q("prepared-spells")]: { "~#set": expect.arrayContaining(["~:alarm", "~:charm-person"]) } });

  entity = setPrepared(e, entity, "Wizard", "alarm", false);
  expect(preparedSpells(entity)).toEqual({ Wizard: new Set(["charm-person"]), Cleric: new Set(["bless"]) });
  // The sheet reads them through preparedSpells.
  expect(preparedSpells(readJson("wizard-20.strict.json")).Wizard!.size).toBe(25);
});

test("spellLevelOf reads the SRD level, else the name's prefix", async () => {
  const content = await loadSpellContent();
  expect(content.size).toBe(319);
  expect(spellLevelOf("acid-splash", "Acid Splash", content)).toBe(0);
  expect(spellLevelOf("alarm", "1 - Alarm", content)).toBe(1);
  expect(spellLevelOf("my-spell", "3 - My Spell", content)).toBe(3);
  expect(spellLevelOf("my-cantrip", "My Cantrip", content)).toBeNull();
  expect(spellLevelOf("alarm", "1 - Alarm", null)).toBe(1);
});

// Spent spell slots (ORC-282, docs/design/spells-panel.md "The record").

const SLOTS_USED = "orcpub.dnd.e5.spells/slots-used";
const slotKey = (level: number) => `~:orcpub.dnd.e5.spells/slots-${level}`;
const valuesOf = (entity: StrictEntity) => JSON.parse(JSON.stringify(entity))["~:orcpub.entity.strict/values"] as Record<string, unknown>;
const storedSlots = (entity: StrictEntity) => (valuesOf(entity) ?? {})[`~:${SLOTS_USED}`];
const legacyDir = join(import.meta.dirname, "../../../../fixtures/legacy");
/** The spent slots of each level, as the sheet gives them. */
const spentOf = (entity: StrictEntity) =>
  toSheet(engine().evaluate(entity).built, entity).spellcasting!.slots.map(({ level, count, spent }) => [level, spent, count]);
/** The slot groups of the sheet, which setSpentSlots takes. */
const layoutOf = (entity: StrictEntity) => toSheet(engine().evaluate(entity).built, entity).spellcasting!;
/** The whole stored entity, with these spent slots in its values and nothing else changed; no slots-used key without them. */
const withSlots = (entity: StrictEntity, slotsUsed?: object) => {
  const copy = JSON.parse(JSON.stringify(entity));
  const values = copy["~:orcpub.entity.strict/values"];
  delete values[`~:${SLOTS_USED}`];
  if (slotsUsed) values[`~:${SLOTS_USED}`] = slotsUsed;
  return copy;
};

test("wizard-5: a spent slot is written as a clean set for each level, read back, and {} removes the key", () => {
  const e = engine();
  const wizard: StrictEntity = readJson("wizard-5.strict.json");
  expect(storedSlots(wizard)).toBeUndefined();
  expect(spentOf(wizard)).toEqual([
    [1, 0, 4],
    [2, 0, 3],
    [3, 0, 2],
  ]);
  const layout = layoutOf(wizard);

  let entity = setSpentSlots(e, wizard, layout, 1, 2);
  entity = setSpentSlots(e, entity, layout, 3, 1);
  // The whole record: the write changes only the spent slots.
  expect(entity).toEqual(withSlots(wizard, { [slotKey(1)]: { "~#set": [0, 1] }, [slotKey(3)]: { "~#set": [0] } }));
  expect(spentOf(entity)).toEqual([
    [1, 2, 4],
    [2, 0, 3],
    [3, 1, 2],
  ]);
  // One less: the last position goes. A level with none is not written.
  entity = setSpentSlots(e, entity, layout, 1, 1);
  entity = setSpentSlots(e, entity, layout, 3, 0);
  expect(storedSlots(entity)).toEqual({ [slotKey(1)]: { "~#set": [0] } });
  // No spent slot at all: the value {} removes the key.
  entity = setSpentSlots(e, entity, layout, 1, 0);
  expect(entity).toEqual(withSlots(wizard));
  expect(Object.hasOwn(valuesOf(entity), `~:${SLOTS_USED}`)).toBe(false);
  // The number stays between 0 and the total.
  expect(storedSlots(setSpentSlots(e, wizard, layout, 2, 7))).toEqual({ [slotKey(2)]: { "~#set": [0, 1, 2] } });
  expect(storedSlots(setSpentSlots(e, wizard, layout, 2, -1))).toBeUndefined();
});

test("a stored position past the slot total does not show and is not counted, and a gap counts", () => {
  const e = engine();
  const wizard: StrictEntity = readJson("wizard-5.strict.json");
  // wizard-5 has 4, 3 and 2 slots, and no 9th-level slot.
  const entity = e.setValue(wizard, SLOTS_USED, {
    [slotKey(1)]: { "~#set": [0, 2] },
    [slotKey(3)]: { "~#set": [1, 2, 7] },
    [slotKey(9)]: { "~#set": [0] },
  });
  expect(spentOf(entity)).toEqual([
    [1, 2, 4],
    [2, 0, 3],
    [3, 1, 2],
  ]);
  expect(spentSlots(slotPositions(entity), 3, 2)).toBe(1);
  // The next change writes clean sets, and leaves out what is past the totals.
  expect(storedSlots(setSpentSlots(e, entity, layoutOf(entity), 2, 1))).toEqual({
    [slotKey(1)]: { "~#set": [0, 1] },
    [slotKey(2)]: { "~#set": [0] },
    [slotKey(3)]: { "~#set": [0] },
  });
});

test("r3-slots-used-vectors: the vectors read as spent slots, and the next change writes clean sets", () => {
  const e = engine();
  const r3: StrictEntity = JSON.parse(readFileSync(join(legacyDir, "r3-slots-used-vectors.strict.json"), "utf8"));
  // The fixture stores { "~i1": [1, 3], "~i2": [2] }: vectors, with integer level keys.
  expect(storedSlots(r3)).toEqual({ "~i1": [1, 3], "~i2": [2] });
  expect(spentOf(r3)).toEqual([
    [1, 2, 4],
    [2, 1, 3],
    [3, 0, 2],
  ]);
  // The same after an import, which makes the vectors sets.
  const imported = e.importCharacter(r3).entity;
  expect(storedSlots(imported)).toEqual({ "~i1": { "~#set": [1, 3] }, "~i2": { "~#set": [2] } });
  expect(spentOf(imported)).toEqual(spentOf(r3));

  const changed = setSpentSlots(e, r3, layoutOf(r3), 1, 3);
  expect(storedSlots(changed)).toEqual({ [slotKey(1)]: { "~#set": [0, 1, 2] }, [slotKey(2)]: { "~#set": [0] } });
  expect(spentOf(changed)).toEqual([
    [1, 3, 4],
    [2, 1, 3],
    [3, 0, 2],
  ]);
});

test("an export and an import keep the spent slots", () => {
  const e = engine();
  const wizard: StrictEntity = readJson("wizard-5.strict.json");
  const layout = layoutOf(wizard);
  const entity = setSpentSlots(e, setSpentSlots(e, wizard, layout, 1, 3), layout, 2, 1);
  const text = JSON.stringify(characterFile({ name: "Wizard", entity }));
  const [character] = readCharacterFile(text).characters;
  // The whole strict values of the imported entity are those of the exported one.
  expect(valuesOf(character!.entity)).toEqual(valuesOf(entity));
  expect(storedSlots(character!.entity)).toEqual({ [slotKey(1)]: { "~#set": [0, 1, 2] }, [slotKey(2)]: { "~#set": [0] } });
  expect(spentOf(character!.entity)).toEqual([
    [1, 3, 4],
    [2, 1, 3],
    [3, 0, 2],
  ]);
});

// Pact Magic slots (ORC-283, docs/design/spells-panel.md "Pact Magic slots").

/** The spec's table of pact slots: warlock levels, pact slots, slot level. */
const PACT_TABLE: [levels: number[], count: number, slotLevel: number][] = [
  [[1], 1, 1],
  [[2], 2, 1],
  [[3, 4], 2, 2],
  [[5, 6], 2, 3],
  [[7, 8], 2, 4],
  [[9, 10], 2, 5],
  [[11, 12, 13, 14, 15, 16], 3, 5],
  [[17, 18, 19, 20], 4, 5],
];

/** A character of these classes and levels, with Charisma 15 for the multiclass rule, built by the builder's calls. */
function buildClasses(classes: [key: string, level: number][], picks: [path: string[], keys: string[]][] = []): StrictEntity {
  const e = engine();
  let entity = e.setField(
    e.emptyCharacter(),
    ["ability-scores", "standard-scores"],
    Object.fromEntries(Object.entries({ str: 8, dex: 14, con: 13, int: 13, wis: 13, cha: 15 }).map(([a, n]) => [q(a), n])),
  );
  classes.forEach(([key, level], i) => {
    entity = i === 0 ? e.setClass(entity, 0, key) : e.addClass(entity, key);
    for (let n = 2; n <= level; n++) entity = e.addLevel(entity, key);
  });
  for (const [path, keys] of picks) for (const key of keys) entity = e.select(entity, path, key);
  return entity;
}

test.each(PACT_TABLE)(
  "warlock levels %j have %i pact slots of level %i, as the engine adds them",
  (levels, count, slotLevel) => {
    for (const level of levels) {
      expect(pactSlotsAt(level)).toEqual({ count, slotLevel });
      // The engine's slot total of a warlock with no other caster class is the pact slots.
      const built = engine().evaluate(buildClasses([["warlock", level]])).built;
      expect(built["spell-slots"]).toEqual({ [slotLevel]: count });
      expect(pactSlots(built)).toEqual({ count, slotLevel });
      expect(slotLayout(built)).toEqual({ slots: [], pact: { count, slotLevel } });
    }
  },
  30_000,
);

test("no Pact Magic gives no pact slots", () => {
  expect(pactSlotsAt(0)).toBeNull();
  expect(pactSlotsAt(21)).toBeNull();
  const wizard = readJson("wizard-5.expected.json");
  expect(wizard["pact-magic?"]).toBeNull();
  expect(pactSlots(wizard)).toBeNull();
  expect(slotLayout(wizard).pact).toBeNull();
  // Pact Magic with no warlock level, which the engine does not make: no pact slots.
  expect(pactSlots({ "pact-magic?": true, levels: {} })).toBeNull();
});

/** A warlock 10 with sorcerer 9, with spells of each class, so that the sheet has a Spellcasting section. */
const warlockSorcerer = () =>
  buildClasses(
    [
      ["warlock", 10],
      ["sorcerer", 9],
    ],
    [
      [
        ["class", "warlock", "warlock-cantrips-known"],
        ["eldritch-blast", "minor-illusion"],
      ],
      [
        ["class", "warlock", "warlock-spells-known"],
        ["hellish-rebuke", "misty-step", "hold-monster"],
      ],
      [["class", "sorcerer", "sorcerer-cantrips-known"], ["fire-bolt"]],
      [
        ["class", "sorcerer", "sorcerer-spells-known"],
        ["shield", "fireball", "cone-of-cold"],
      ],
    ],
  );

test("e2e/warlock-10-sorcerer-9.strict.json is this character, by the builder's calls, with a name", () => {
  const file = JSON.parse(readFileSync(join(import.meta.dirname, "../../e2e/warlock-10-sorcerer-9.strict.json"), "utf8"));
  expect(file).toEqual(JSON.parse(JSON.stringify(engine().setValue(warlockSorcerer(), "character-name", "Vex Arden"))));
}, 20_000);

test("a warlock 10 with sorcerer 9 has one other 5th-level slot and two pact slots", () => {
  const entity = warlockSorcerer();
  const built = engine().evaluate(entity).built;
  expect(built["pact-magic?"]).toBe(true);
  expect(built.levels.warlock!["class-level"]).toBe(10);
  expect(built["spell-slots"]).toEqual({ "1": 4, "2": 3, "3": 3, "4": 3, "5": 3 });
  const { slots, pact } = toSheet(built, entity).spellcasting!;
  expect(slots).toEqual([
    { level: 1, count: 4, spent: 0 },
    { level: 2, count: 3, spent: 0 },
    { level: 3, count: 3, spent: 0 },
    { level: 4, count: 3, spent: 0 },
    { level: 5, count: 1, spent: 0 },
  ]);
  expect(pact).toEqual({ slotLevel: 5, count: 2, spent: 0 });
}, 20_000);

test("a spent pact slot and a spent other slot of the same level are written apart, and read back apart", () => {
  const e = engine();
  const entity = warlockSorcerer();
  const layout = layoutOf(entity);
  // One other 5th-level slot (position 0) and two pact slots (positions 1 and 2).
  let changed = setSpentSlots(e, entity, layout, "pact", 1);
  expect(storedSlots(changed)).toEqual({ [slotKey(5)]: { "~#set": [1] } });
  changed = setSpentSlots(e, changed, layout, 5, 1);
  changed = setSpentSlots(e, changed, layout, 2, 2);
  // The whole record: the writes change only the spent slots.
  const expected = JSON.parse(JSON.stringify(entity));
  expected["~:orcpub.entity.strict/values"] = {
    ...expected["~:orcpub.entity.strict/values"],
    [`~:${SLOTS_USED}`]: { [slotKey(2)]: { "~#set": [0, 1] }, [slotKey(5)]: { "~#set": [0, 1] } },
  };
  expect(JSON.parse(JSON.stringify(changed))).toEqual(expected);
  const { slots, pact } = layoutOf(changed);
  expect(slots.find((slot) => slot.level === 5)).toEqual({ level: 5, count: 1, spent: 1 });
  expect(pact).toEqual({ slotLevel: 5, count: 2, spent: 1 });

  // The pact slots and the other slot change apart: positions 0 to k - 1 and n to n + j - 1.
  expect(storedSlots(setSpentSlots(e, changed, layout, 5, 0))).toEqual({ [slotKey(2)]: { "~#set": [0, 1] }, [slotKey(5)]: { "~#set": [1] } });
  expect(storedSlots(setSpentSlots(e, changed, layout, "pact", 2))).toEqual({ [slotKey(2)]: { "~#set": [0, 1] }, [slotKey(5)]: { "~#set": [0, 1, 2] } });
  expect(storedSlots(setSpentSlots(e, changed, layout, "pact", 9))).toEqual({ [slotKey(2)]: { "~#set": [0, 1] }, [slotKey(5)]: { "~#set": [0, 1, 2] } });
  const none = setSpentSlots(e, setSpentSlots(e, setSpentSlots(e, changed, layout, "pact", 0), layout, 5, 0), layout, 2, 0);
  expect(storedSlots(none)).toBeUndefined();
}, 20_000);

test("warlock-10-drow: its pact slots are positions 0 and 1 of the 5th level, as it has no other 5th-level slot", () => {
  const e = engine();
  const warlock: StrictEntity = readJson("warlock-10-drow.strict.json");
  const layout = layoutOf(warlock);
  expect(layout.slots).toEqual([]);
  expect(layout.pact).toEqual({ slotLevel: 5, count: 2, spent: 0 });
  const changed = setSpentSlots(e, warlock, layout, "pact", 1);
  const expected = JSON.parse(JSON.stringify(warlock));
  expected["~:orcpub.entity.strict/values"] = { ...expected["~:orcpub.entity.strict/values"], [`~:${SLOTS_USED}`]: { [slotKey(5)]: { "~#set": [0] } } };
  expect(JSON.parse(JSON.stringify(changed))).toEqual(expected);
  expect(layoutOf(changed).pact).toEqual({ slotLevel: 5, count: 2, spent: 1 });
  // A write of another group has none here: the pact slots stay.
  expect(storedSlots(setSpentSlots(e, changed, layout, 5, 1))).toEqual({ [slotKey(5)]: { "~#set": [0] } });
});
