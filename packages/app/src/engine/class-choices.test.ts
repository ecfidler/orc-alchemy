// The rules of the section Choices of a class block (ORC-350, docs/design/character-builder.md "Choices"): the choice
// rows in groups by level, the head of a row, the rows that open at the start, the line of "Ability Score Improvement
// or Feat", and the subclass detail of the dialog.
import { beforeAll, expect, test } from "vitest";
import { type BuilderOption, type BuilderStep, builderSteps } from "./builder.ts";
import {
  asksBeforeClassPick,
  choiceLevels,
  hitPointSelections,
  IMPROVEMENT_OPTION,
  improvementLine,
  opensAtStart,
  pointsText,
  rowPicks,
} from "./class-choices.ts";
import { subclassChoice, subclassDescription, subclassFeatures } from "./class-detail.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { addFirstClass, newCharacter } from "./new-character.ts";
import { controlKind } from "./selection-control.ts";

beforeAll(() => loadEngine());

const content = { homebrew: undefined };

/** A new character with the class at the level, and these picks. */
function character(classKey: string, level: number, picks: [path: string[], key: string][] = []): StrictEntity {
  const e = engine();
  let entity = addFirstClass(e, newCharacter(e), classKey, content);
  for (let n = 1; n < level; n++) entity = e.addLevel(entity, classKey, content) as StrictEntity;
  return picks.reduce((next, [path, key]) => e.select(next, path, key, content) as StrictEntity, entity);
}

/** The steps of the entity, and its picked class option. */
function build(entity: StrictEntity): { steps: BuilderStep[]; option: BuilderOption } {
  const e = engine();
  const steps = builderSteps(e.evaluate(entity, content).selections, e.buildTemplate(undefined).shape);
  const option = steps
    .find((s) => s.name === "Class")!
    .selections.find((s) => s.key === "class")!
    .options.find((o) => o.selected)!;
  return { steps, option };
}

/** The rows as "level: name (kind)". */
const rowsText = (option: BuilderOption) =>
  choiceLevels(option).flatMap(({ level, rows }) => rows.map((row) => `${level}: ${row.selection.name} (${row.kind})`));

const FIGHTER_4 = ["class", "fighter", "levels", "level-4", "asi-or-feat"];

test("a Fighter 4 has Fighting Style at level 1, Martial Archetype at 3, and the improvement or feat at 4; no hit points", () => {
  const { option } = build(character("fighter", 4));
  expect(rowsText(option)).toEqual(["1: Fighting Style (control)", "3: Martial Archetype (subclass)", "4: Ability Score Improvement or Feat (improvement)"]);
  // Only a level with a choice has a group.
  expect(choiceLevels(option).map((l) => l.level)).toEqual([1, 3, 4]);
  // The hit points of the levels after 1 stay out of the rows: the block shows them after Choices.
  expect(hitPointSelections(option).map((s) => s.name)).toEqual(["Hit Points: Fighter 2", "Hit Points: Fighter 3", "Hit Points: Fighter 4"]);
  // Fighting Style has 6 options: cards. Each row has a pick to make, so each is open at the start, and shows its mark.
  const rows = choiceLevels(option).flatMap((l) => l.rows);
  expect(controlKind(rows[0].selection)).toBe("cards");
  expect(rows.map((row) => [opensAtStart(row.selection), rowPicks(row.selection)])).toEqual([
    [true, null],
    [true, null],
    [true, null],
  ]);
  // A pick in a subclass or in the improvement asks first when it removes picks. The Fighting Style takes a second
  // pick from a Champion, so it is a multiselect, and a pick in it removes none.
  expect(rows.map((row) => asksBeforeClassPick(row.selection))).toEqual([false, true, true]);
});

test("after the picks, a row shows its pick and is closed at the start; a subclass pick opens its rows after it", () => {
  const entity = character("fighter", 10, [
    [["class", "fighter", "fighting-style"], "defense"],
    [["class", "fighter", "levels", "level-3", "martial-archetype"], "champion"],
  ]);
  const { option } = build(entity);
  const rows = choiceLevels(option).flatMap((l) => l.rows);
  const style = rows.find((row) => row.selection.name === "Fighting Style")!;
  // The Fighting Style of the fighter and of the Champion is one selection: one row, at level 1, with 1 left.
  expect(rows.filter((row) => row.selection.name === "Fighting Style")).toHaveLength(1);
  expect(style.level).toBe(1);
  expect(rowPicks(style.selection)).toBeNull();
  const archetype = rows.find((row) => row.kind === "subclass")!;
  expect(rowPicks(archetype.selection)).toEqual(["Champion"]);
  expect(opensAtStart(archetype.selection)).toBe(false);
  // Levels 4, 6 and 8 have an improvement each.
  expect(choiceLevels(option).map((l) => l.level)).toEqual([1, 3, 4, 6, 8]);
});

test("a choice of 7 options or more: a Sorcerer's Metamagic is a picker, and a Ranger's Favored Terrain is a list", () => {
  const sorcerer = build(character("sorcerer", 3)).option;
  expect(rowsText(sorcerer)).toEqual(["1: Sorcerous Origin (subclass)", "3: Metamagic (control)"]);
  const metamagic = choiceLevels(sorcerer)[1].rows[0].selection;
  expect(metamagic.options.length).toBeGreaterThanOrEqual(7);
  expect(controlKind(metamagic)).toBe("picker");
  // Two picks: not a choice of one pick, so it asks nothing.
  expect(asksBeforeClassPick(metamagic)).toBe(false);

  const ranger = build(character("ranger", 1)).option;
  const terrain = choiceLevels(ranger)[0].rows.find((row) => row.selection.name === "Favored Terrain")!.selection;
  expect(controlKind(terrain)).toBe("list");

  // The pick of the bloodline opens Draconic Ancestry Type, a row after it at level 1 with 10 options: a list.
  const dragon = build(character("sorcerer", 1, [[["class", "sorcerer", "levels", "level-1", "sorcerous-origin"], "draconic-bloodline"]])).option;
  expect(rowsText(dragon)).toEqual(["1: Sorcerous Origin (subclass)", "1: Draconic Ancestry Type (control)"]);
});

test("a class with no choice at its levels has no row", () => {
  expect(choiceLevels(build(character("druid", 1)).option)).toEqual([]);
});

test("the line of the improvement: before the pick none, then the points on Abilities or the feat on Feats", () => {
  const before = build(character("fighter", 4));
  const row = (option: BuilderOption) => choiceLevels(option).at(-1)!.rows[0].selection;
  expect(improvementLine(row(before.option), before.steps)).toBeNull();

  let entity = character("fighter", 4, [[FIGHTER_4, IMPROVEMENT_OPTION]]);
  let { steps, option } = build(entity);
  expect(improvementLine(row(option), steps)).toEqual({ step: "Abilities", text: "Place 2 points on the Abilities step", picks: [], remaining: 2 });
  // The points placed on the Abilities step show on the line.
  const asi = [...FIGHTER_4, IMPROVEMENT_OPTION, "asi"];
  entity = engine().increaseAbility(entity, asi, "orcpub.dnd.e5.character/dex", content) as StrictEntity;
  entity = engine().increaseAbility(entity, asi, "orcpub.dnd.e5.character/str", content) as StrictEntity;
  ({ steps, option } = build(entity));
  expect(improvementLine(row(option), steps)).toEqual({
    step: "Abilities",
    text: "Place 2 points on the Abilities step",
    picks: ["+1 Strength", "+1 Dexterity"],
    remaining: 0,
  });
  // The head of the row shows the option: Ability Score Improvement.
  expect(rowPicks(row(option))).toEqual(["Ability Score Improvement"]);

  ({ steps, option } = build(character("fighter", 4, [[FIGHTER_4, "feat"]])));
  expect(improvementLine(row(option), steps)).toEqual({ step: "Feats", text: "Pick the feat on the Feats step", picks: [], remaining: 1 });
});

test("the points as text, in the order of the abilities", () => {
  expect(pointsText(["orcpub.dnd.e5.character/wis", "orcpub.dnd.e5.character/str", "orcpub.dnd.e5.character/wis"])).toEqual(["+1 Strength", "+2 Wisdom"]);
  expect(pointsText([])).toEqual([]);
});

test("the subclass detail: its choice and level, its features by level, and its description", () => {
  expect(subclassChoice("fighter", content)).toEqual({ key: "martial-archetype", level: 3 });
  expect(subclassChoice("cleric", content)).toEqual({ key: "divine-domain", level: 1 });
  const rows = subclassFeatures({ engine: engine(), content }, "ranger", "hunter").map(({ level, names }) => `${level}: ${names.join(", ")}`);
  expect(rows).toEqual(["3: Hunter's Prey", "7: Defensive Tactics", "11: Multiattack", "15: Superior Hunter's Defense"]);
  // The features that the class gives are not in the table of the subclass.
  const fiend = subclassFeatures({ engine: engine(), content }, "warlock", "the-fiend");
  expect(fiend[0]).toEqual({ level: 1, names: ["Dark One's Blessing"] });
  expect(subclassDescription("champion")).toBe("A fighter who trains the body to deadly perfection.");
  expect(subclassDescription("champion", " A pack text. ")).toBe("A pack text.");
  expect(subclassDescription("no-such-subclass")).toBe("");
});
