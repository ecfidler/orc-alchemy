// The rules of a class block (ORC-351, docs/design/character-builder.md "The class block" and "A second class"): a
// second class that the character cannot take and what it needs, the highest character level, the left mark of a
// closed block, and Remove of a class with picks.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { type BuilderOption, builderSteps } from "./builder.ts";
import { blockMark, canAddClass, classNeeds, classStepLines, needsReason, needsText, unavailableClasses } from "./class-block.ts";
import { classHitPoints, withAverageHitPoints } from "./classes.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { addFirstClass, newCharacter } from "./new-character.ts";
import { planChange } from "./removed-picks.ts";

beforeAll(() => loadEngine());

const content = { homebrew: undefined };
const fixture = (): StrictEntity =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/fighter-3-wizard-2.strict.json"), "utf8"));

/** The steps of the entity, its class selection and its class options by key. */
function build(entity: StrictEntity) {
  const e = engine();
  const { built, selections } = e.evaluate(entity, content);
  const steps = builderSteps(selections, e.buildTemplate(undefined).shape);
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
  expect(Object.fromEntries(needs)).toEqual({
    bard: "Cha 13",
    cleric: "Wis 13",
    druid: "Wis 13",
    monk: "Wis 13 and Dex 13",
    paladin: "Str 13 and Cha 13",
    ranger: "Wis 13 and Dex 13",
    sorcerer: "Cha 13",
    warlock: "Cha 13",
  });
  // Barbarian and Rogue are open to the character.
  expect(free.map((o) => o.key).filter((key) => !needs.has(key))).toEqual(["barbarian", "rogue"]);
  expect(needsText(needs.get("monk")!)).toBe("Needs Wis 13 and Dex 13");
  expect(needsReason(needs.get("sorcerer")!)).toBe("It needs Cha 13.");
});

test("what a class needs, from the reason text of the engine's labels", () => {
  expect(classNeeds("It needs Strength 13 and Charisma 13.")).toBe("Str 13 and Cha 13");
  expect(classNeeds("It needs CHA 13 or higher.")).toBe("Cha 13");
  expect(classNeeds("It needs INT 13 or higher.")).toBe("Int 13");
  expect(classNeeds("It needs the feat Grappler.")).toBe("the feat Grappler");
});

test("no class can be added at character level 20", () => {
  expect(canAddClass(19)).toBe(true);
  expect(canAddClass(20)).toBe(false);
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

test("the lines of Picked on other steps of each class: only the selections under that class", () => {
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
  // No row is a hit point value: they are not picks.
  expect(rows.some((row) => row.includes("Hit Points"))).toBe(false);

  // The engine makes the wizard the first class, at level 1 (removeClass): its level 1 has the maximum of the die.
  const after = apply();
  const { built, option } = build(after);
  const [wizard] = classHitPoints(after, built, [option("wizard")]);
  expect(wizard.levels).toEqual([{ level: 1, path: null, value: 6, stored: null }]);
  expect(wizard.total).toBe(built["max-hit-points"]);
});
