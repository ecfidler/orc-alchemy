// The rules of a class block (ORC-351, docs/design/character-builder.md "The class block" and "A second class"): a
// second class that the character cannot take and what it needs, the highest character level, the left mark of a
// closed block, and Remove of a class with picks.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { type BuilderOption, builderSteps } from "./builder.ts";
import {
  blockMark,
  canAddClass,
  characterLevel,
  classLevel,
  classNeeds,
  classStepLines,
  levelRefusal,
  needsReason,
  needsText,
  raiseLevel,
  replaceClass,
  unavailableClasses,
} from "./class-block.ts";
import { classHitPoints, storedHitPoints, withAverageHitPoints } from "./classes.ts";
import { buildTemplate, engine, loadEngine, type StrictEntity } from "./engine.ts";
import { addFirstClass, newCharacter } from "./new-character.ts";
import { planChange } from "./removed-picks.ts";
import { refusalLabels } from "./selection-control.ts";

beforeAll(() => loadEngine());

const content = { homebrew: undefined };
const fixture = (): StrictEntity =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/fighter-3-wizard-2.strict.json"), "utf8"));

/** The steps of the entity, its class selection and its class options by key. */
function build(entity: StrictEntity) {
  const e = engine();
  const { built, selections } = e.evaluate(entity, content);
  const steps = builderSteps(selections, buildTemplate(undefined).shape);
  const selection = steps.find((s) => s.name === "Class")!.selections.find((s) => s.key === "class")!;
  const option = (key: string) => selection.options.find((o) => o.key === key)! as BuilderOption;
  return { built, steps, selection, option };
}

test("a second class that the character cannot take: the engine's prerequisite, in short, on the card and in the modal", () => {
  // fighter-3-wizard-2 has STR 16, DEX 13, INT 15, WIS 10 and CHA 10.
  const entity = fixture();
  const { selection } = build(entity);
  const free = selection.options.filter((o) => !o.selected);
  const needs = unavailableClasses(engine(), entity, content, free);
  expect(Object.fromEntries([...needs].map(([key, need]) => [key, needsText(need)]))).toEqual({
    bard: "Needs Cha 13",
    cleric: "Needs Wis 13",
    druid: "Needs Wis 13",
    monk: "Needs Wis 13 and Dex 13",
    paladin: "Needs Str 13 and Cha 13",
    ranger: "Needs Wis 13 and Dex 13",
    sorcerer: "Needs Cha 13",
    warlock: "Needs Cha 13",
  });
  // Barbarian and Rogue are open to the character.
  expect(free.map((o) => o.key).filter((key) => !needs.has(key))).toEqual(["barbarian", "rogue"]);
  expect(needsText(needs.get("monk")!)).toBe("Needs Wis 13 and Dex 13");
  expect(needsReason(needs.get("sorcerer")!)).toBe("It needs Cha 13.");
});

test("what a class needs, from the prerequisite labels of the engine", () => {
  const texts = (labels: string[]) => [needsText(classNeeds(labels)), needsReason(classNeeds(labels))];
  expect(texts(["Requires Strength 13 and Charisma 13"])).toEqual(["Needs Str 13 and Cha 13", "It needs Str 13 and Cha 13."]);
  expect(texts(["Requires CHA 13 or higher"])).toEqual(["Needs Cha 13", "It needs Cha 13."]);
  expect(texts(["Requires INT 13 or higher"])).toEqual(["Needs Int 13", "It needs Int 13."]);
  expect(texts(["Requires the feat Grappler"])).toEqual(["Needs the feat Grappler", "It needs the feat Grappler."]);
});

test("a pack class with two prerequisites: the engine joins the labels with a comma, and the texts join their parts with and", () => {
  // The refusal of the engine's addClass for a class with two prerequisite labels.
  const labels = refusalLabels("Cannot add Rune Knight: it requires Requires STR 13 or higher, Requires DEX 13 or higher.");
  expect(labels).toEqual(["Requires STR 13 or higher", "Requires DEX 13 or higher"]);
  const needs = classNeeds(labels!);
  expect(needsText(needs)).toBe("Needs Str 13 and Dex 13");
  expect(needsReason(needs)).toBe("It needs Str 13 and Dex 13.");
  expect(refusalLabels("Cannot add Rune Knight: no selections remain.")).toBeNull();
});

test("a label that does not start with Requires keeps its text, after what the class needs", () => {
  const needs = classNeeds(["Requires Wisdom 13", "You must have a level in Druid."]);
  expect(needs).toEqual({ needs: ["Wis 13"], others: ["You must have a level in Druid"] });
  expect(needsText(needs)).toBe("Needs Wis 13. You must have a level in Druid");
  expect(needsReason(needs)).toBe("It needs Wis 13. You must have a level in Druid.");
  const only = classNeeds(["Must have the feat Grappler"]);
  expect([needsText(only), needsReason(only)]).toEqual(["Must have the feat Grappler", "Must have the feat Grappler."]);
});

test("no class can be added at character level 20", () => {
  expect(canAddClass(19)).toBe(true);
  expect(canAddClass(20)).toBe(false);
});

test("a level change: a class level is from 1 to 20, and a higher level cannot make the character level more than 20", () => {
  // Fighter 18 and Wizard 2: character level 20.
  const e = engine();
  let entity = fixture();
  for (let n = 3; n < 18; n++) entity = e.addLevel(entity, "fighter", content) as StrictEntity;
  const { selection } = build(entity);
  const picked = selection.selected.map((key) => selection.options.find((o) => o.key === key)!);
  expect(picked.map(classLevel)).toEqual([18, 2]);
  expect(characterLevel(picked)).toBe(20);
  // The engine checks only the level of the one class: it takes Fighter 19.
  expect(() => e.addLevel(entity, "fighter", content)).not.toThrow();
  expect(levelRefusal(picked, "fighter", 19)).toBe("A character has 20 levels at most.");
  expect(levelRefusal(picked, "wizard", 3)).toBe("A character has 20 levels at most.");
  // A lower level is always possible.
  expect(levelRefusal(picked, "fighter", 17)).toBeNull();
  expect(levelRefusal(picked, "wizard", 1)).toBeNull();
  for (const level of [0, 21, 2.5]) expect(levelRefusal(picked, "wizard", level)).toBe("A class level is from 1 to 20.");
  // At character level 19, one more level is possible.
  const lower = build(e.removeLevel(entity, "fighter", content) as StrictEntity).selection;
  const lowerPicked = lower.selected.map((key) => lower.options.find((o) => o.key === key)!);
  expect(levelRefusal(lowerPicked, "wizard", 3)).toBeNull();
  expect(levelRefusal(lowerPicked, "wizard", 4)).toBe("A character has 20 levels at most.");
});

test("a higher level: the new levels get the average with the method Average, and no hit points with By level", () => {
  const e = engine();
  const entity = addFirstClass(e, newCharacter(e), "fighter", content);
  const path = (level: number) => ["class", "fighter", "levels", `level-${level}`, "hit-points"];
  const average = raiseLevel(e, entity, "fighter", 1, 3, "average", content);
  expect(build(average).built.levels.fighter["class-level"]).toBe(3);
  expect([2, 3].map((level) => storedHitPoints(average, path(level)))).toEqual([
    { method: "average", value: 6 },
    { method: "average", value: 6 },
  ]);
  const byLevel = raiseLevel(e, entity, "fighter", 1, 3, "by-level", content);
  expect([2, 3].map((level) => storedHitPoints(byLevel, path(level)))).toEqual([null, null]);
});

test("a class that is not the first, replaced, gets the average hit points in the same change (ORC-352)", () => {
  const e = engine();
  const entity = replaceClass(e, fixture(), "wizard", "rogue", content);
  expect(build(entity).selection.selected).toEqual(["fighter", "rogue"]);
  // The new class is at level 1. A d8: the average is 5.
  expect(storedHitPoints(entity, ["class", "rogue", "levels", "level-1", "hit-points"])).toEqual({ method: "average", value: 5 });
  // The first class, replaced, has the maximum at level 1, and gets no hit points written.
  const first = replaceClass(e, fixture(), "fighter", "rogue", content);
  expect(first).toEqual(e.setClass(fixture(), 0, "rogue", content));
  // The planned change of the question writes the same entity.
  expect(planChange({ engine: e, entity: fixture(), content }, { kind: "replace-class", from: "wizard", to: "rogue" }).apply()).toEqual(entity);
});

test("the left mark of a block counts its Choices and its hit points left", () => {
  const e = engine();
  let entity = addFirstClass(e, newCharacter(e), "fighter", content);
  entity = e.addLevel(e.addLevel(entity, "fighter", content), "fighter", content) as StrictEntity;
  // Fighting Style, Martial Archetype, and the hit points of levels 2 and 3.
  expect(blockMark(build(entity).option("fighter"))).toBe(4);
  entity = withAverageHitPoints(e, entity, "fighter", content);
  expect(blockMark(build(entity).option("fighter"))).toBe(2);
  entity = e.select(entity, ["class", "fighter", "fighting-style"], "defense", content) as StrictEntity;
  entity = e.select(entity, ["class", "fighter", "levels", "level-3", "martial-archetype"], "champion", content) as StrictEntity;
  expect(blockMark(build(entity).option("fighter"))).toBe(0);
});

test("the lines of Also choose of each class: only the selections under that class", () => {
  const { steps, selection } = build(fixture());
  const kinds = (key: string) => classStepLines(selection, steps, key).map((line) => `${line.kind}: ${line.picks.join(", ")} (${line.step})`);
  expect(kinds("fighter")).toEqual([
    "Skills: Athletics, Perception (Proficiencies)",
    "Starting equipment: Chain Mail, Martial Weapon and Shield, Longsword, Two Handaxes, Dungeoneer's Pack (Equipment)",
  ]);
  // The engine names a spell of a list with its level first; the line has the name of the spell.
  expect(kinds("wizard")).toEqual([
    "Cantrip: Acid Splash, Chill Touch, Dancing Lights (Spells)",
    "Spells: Alarm, Burning Hands, Charm Person, Color Spray, Comprehend Languages, Detect Magic, Disguise Self, Expeditious Retreat (Spells)",
  ]);
});

test("the points or the feat of an improvement row are not a line: the row has its own line", () => {
  const e = engine();
  let entity = addFirstClass(e, newCharacter(e), "fighter", content);
  for (let n = 1; n < 4; n++) entity = e.addLevel(entity, "fighter", content) as StrictEntity;
  entity = e.select(entity, ["class", "fighter", "levels", "level-4", "asi-or-feat"], "ability-score-improvement", content) as StrictEntity;
  const { steps, selection } = build(entity);
  expect(classStepLines(selection, steps, "fighter").map((line) => line.kind)).toEqual(["Skills", "Starting equipment"]);
});

test("Remove of the first class with picks: the question lists its picks; the next class is first, with the die at level 1", () => {
  const e = engine();
  const entity = fixture();
  const { question, apply } = planChange({ engine: e, entity, content }, { kind: "remove-class", classKey: "fighter" });
  expect(question?.title).toBe("Remove Fighter?");
  expect(question?.action).toBe("Remove");
  const rows = question!.rows.map((row) => `${row.place}: ${row.selection}: ${row.picks.join(", ")}`);
  expect(rows).toContain("Class: Fighting Style: Defense");
  expect(rows).toContain("Level 3: Martial Archetype: Champion");
  expect(rows).toContain("Proficiencies: Skills: Athletics, Perception");
  // A pick of a level of the next class names that class.
  expect(rows).toContain("Wizard level 2: Arcane Tradition: School of Evocation");
  // No row is a hit point value: they are not picks.
  expect(rows.some((row) => row.includes("Hit Points"))).toBe(false);

  // The engine makes the wizard the first class, at level 1 (removeClass): its level 1 has the maximum of the die.
  const after = apply();
  const { built, option } = build(after);
  const [wizard] = classHitPoints(after, built, [option("wizard")]);
  expect(wizard.levels).toEqual([{ level: 1, path: null, value: 6, stored: null }]);
  expect(wizard.total).toBe(built["max-hit-points"]);
});
