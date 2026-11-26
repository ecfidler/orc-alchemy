import { beforeAll, expect, test } from "vitest";
import { baseScores, STANDARD_SCORES } from "./abilities.ts";
import { builderSteps, remainingByStep } from "./builder.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { storedItems } from "./equipment.ts";
import { addFirstClass, newCharacter } from "./new-character.ts";
import { toSheet } from "./sheet.ts";

beforeAll(() => loadEngine());

const LISTS = ["armor", "equipment", "magic-armor", "magic-weapons", "other-magic-items", "treasure", "weapons"];
const items = (entity: StrictEntity) => LISTS.flatMap((list) => storedItems(entity, list).map((item) => `${list}/${item.key}`));
const sheetOf = (entity: StrictEntity) => toSheet(engine().evaluate(entity).built, entity);

test("the new character has no class and no class equipment, and the standard scores stay", () => {
  const entity = newCharacter(engine());
  expect(engine().evaluate(entity).built.classes).toEqual([]);
  expect(items(entity)).toEqual([]);
  expect(baseScores(entity)).toEqual({ method: "standard-scores", scores: STANDARD_SCORES });
  // The class selection has nothing picked under it: no level, no choice of a level.
  expect(
    engine()
      .evaluate(entity)
      .selections.filter((s) => s.path[0] === "class"),
  ).toEqual([expect.objectContaining({ key: "class", path: ["class"], selected: [] })]);
});

test("the engine builds the new character, and the sheet values read with no error", () => {
  const sheet = sheetOf(newCharacter(engine()));
  expect(sheet).toMatchObject({ name: null, classes: [], totalLevel: 0, background: null, race: null, hitDice: [], weaponAttacks: [] });
  // The engine gives 1 for the maximum with no class; the sheet shows no hit points (CharacterSheet).
  expect(sheet.maxHitPoints).toBe(1);
  expect(sheet.abilities.map((a) => a.score)).toEqual([15, 14, 13, 12, 10, 8]);
});

test("the Class step of the new character has 1 pick left, from the engine's count", () => {
  const e = engine();
  const entity = newCharacter(e);
  const classSelection = e.evaluate(entity).selections.find((s) => s.key === "class")!;
  expect([classSelection.min, classSelection.max, classSelection.remaining]).toEqual([1, null, 1]);
  const steps = builderSteps(e.evaluate(entity).selections, e.buildTemplate().shape);
  expect(remainingByStep(steps)[steps.findIndex((s) => s.name === "Class")].toDo).toBe(1);
});

test("addFirstClass adds the first class at level 1 with its starting equipment, with no multiclass prerequisite", () => {
  const e = engine();
  // The standard scores have INT 12: addClass refuses a wizard, as a multiclass needs INT 13.
  expect(() => e.addClass(newCharacter(e), "wizard")).toThrow(/INT 13/);
  const wizard = addFirstClass(e, newCharacter(e), "wizard");
  expect(sheetOf(wizard).classes.map((c) => [c.key, c.level])).toEqual([["wizard", 1]]);
  expect(items(wizard)).toEqual(["equipment/spellbook"]);
  expect(baseScores(wizard)).toEqual({ method: "standard-scores", scores: STANDARD_SCORES });
  // The stand-in class is a barbarian, so a barbarian has its own stand-in.
  const barbarian = addFirstClass(e, newCharacter(e), "barbarian");
  expect(sheetOf(barbarian).classes.map((c) => c.key)).toEqual(["barbarian"]);
  expect(items(barbarian)).toEqual(expect.arrayContaining(["weapons/javelin", "equipment/explorers-pack"]));
  expect(() => addFirstClass(e, barbarian, "fighter")).toThrow("The character has a class already.");
});
