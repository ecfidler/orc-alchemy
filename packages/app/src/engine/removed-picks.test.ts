// The picks that a change removes, and the question before it (ORC-344, docs/design/character-builder.md "A change
// that removes picks"): the five changes of the spec's table, a change in two rows, and a change that removes no pick.
import type { AvailableSelection } from "@pubdoor/dmv";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { addFirstClass, newCharacter } from "./new-character.ts";
import { type PickChange, planChange } from "./removed-picks.ts";

beforeAll(() => loadEngine());

const content = { homebrew: undefined };
const plan = (entity: StrictEntity, change: PickChange) => planChange({ engine: engine(), entity, content }, change);
const selections = (entity: StrictEntity) => engine().evaluate(entity, content).selections;
const at = (entity: StrictEntity, path: string) => selections(entity).filter((s) => s.path.join("/") === path);
const one = (entity: StrictEntity, path: string): AvailableSelection => {
  const found = at(entity, path);
  expect(found).toHaveLength(1);
  return found[0];
};

/** The new character with the first class, then each pick: [path, key] selects, [path, key, "+"] increases an ability. */
function character(classKey: string, picks: [path: string[], key: string, how?: "+"][]): StrictEntity {
  const e = engine();
  let entity = addFirstClass(e, newCharacter(e), classKey, content);
  for (const [path, key, how] of picks)
    entity = (how === "+" ? e.increaseAbility(entity, path, key, content) : e.select(entity, path, key, content)) as StrictEntity;
  return entity;
}

const CLERIC_SKILLS = ["class", "cleric", "skill-proficiency"];
const clericWithInsightAndReligion = () =>
  character("cleric", [
    [CLERIC_SKILLS, "insight"],
    [CLERIC_SKILLS, "religion"],
  ]);

test("before: a Cleric with Insight and Religion that takes Acolyte is in a dead end", () => {
  const taken = engine().select(clericWithInsightAndReligion(), ["background"], "acolyte", content) as StrictEntity;
  // Two selections with one path, which no pick can fill (the ORC-329 research).
  expect(at(taken, "background/acolyte/skill-proficiency")).toHaveLength(2);
  expect(() => engine().select(taken, ["background", "acolyte", "skill-proficiency"], "arcana", content)).toThrow(/More than one selection/);
});

test("a Cleric with Insight and Religion that takes Acolyte: the question lists the two skills, and after Change the Cleric picks 2 again", () => {
  const entity = clericWithInsightAndReligion();
  const { question, removed, apply } = plan(entity, { kind: "pick", path: ["background"], to: "acolyte" });
  expect(question).toEqual({
    title: "Change to Acolyte?",
    action: "Change",
    rows: [{ place: "Proficiencies", selection: "Skill Proficiency", picks: ["Insight", "Religion"] }],
  });
  expect(removed).toEqual([
    [...CLERIC_SKILLS, "insight"],
    [...CLERIC_SKILLS, "religion"],
  ]);

  const changed = apply(entity);
  const cleric = one(changed, "class/cleric/skill-proficiency");
  expect(cleric.selected).toEqual([]);
  expect(cleric.remaining).toBe(2);
  // The engine reports no error: Acolyte opens no skill selection to fill, and gives the two skills.
  expect(selections(changed).filter((s) => s.key === "skill-proficiency" && s.path[0] === "background")).toEqual([]);
  expect(Object.keys(engine().evaluate(changed, content).built["skill-profs"] ?? {}).sort()).toEqual(["insight", "religion"]);
  // A pick of the Cleric now works.
  expect(() => engine().select(changed, CLERIC_SKILLS, "medicine", content)).not.toThrow();
});

/** A half-elf fighter with each half-elf pick made: two +1s, two skills, and its language with the two of Acolyte. */
const halfElf = () =>
  character("fighter", [
    [["race"], "half-elf"],
    [["race", "half-elf", "asi"], "str", "+"],
    [["race", "half-elf", "asi"], "con", "+"],
    [["race", "half-elf", "skill-proficiency"], "perception"],
    [["race", "half-elf", "skill-proficiency"], "stealth"],
    [["background"], "acolyte"],
    [["languages"], "giant"],
    [["languages"], "gnomish"],
    [["languages"], "goblin"],
  ]);

test("a different race for a Half-Elf with its picks made: each Half-Elf pick goes, on each step, and the language over the max", () => {
  const entity = halfElf();
  const { question, apply } = plan(entity, { kind: "pick", path: ["race"], to: "dwarf" });
  expect(question).toEqual({
    title: "Replace Half-Elf with Dwarf?",
    action: "Replace",
    rows: [
      { place: "Abilities", selection: "Ability Score Improvement", picks: ["Strength", "Constitution"] },
      { place: "Proficiencies", selection: "Skill Proficiency", picks: ["Perception", "Stealth"] },
      // The languages of the race and the background are one selection: Acolyte keeps two, and the last pick goes.
      { place: "Proficiencies", selection: "Languages", picks: ["Goblin"] },
    ],
  });

  const changed = apply(entity);
  expect(one(changed, "race").selected).toEqual(["dwarf"]);
  expect(one(changed, "background/acolyte/languages")).toMatchObject({ selected: ["giant", "gnomish"], remaining: 0 });
  expect(selections(changed).filter((s) => s.remaining < 0)).toEqual([]);
});

test("a different race that gives a language that the player picked for the background: that pick goes too", () => {
  const entity = character("fighter", [
    [["race"], "human"],
    [["background"], "acolyte"],
    [["languages"], "dwarvish"],
  ]);
  const { question, apply } = plan(entity, { kind: "pick", path: ["race"], to: "dwarf" });
  // Human has a language pick of its own with no pick made, so the only pick that goes is Dwarvish, which Dwarf gives.
  expect(question).toEqual({ title: "Change to Dwarf?", action: "Change", rows: [{ place: "Proficiencies", selection: "Languages", picks: ["Dwarvish"] }] });
  expect(one(apply(entity), "background/acolyte/languages").selected).toEqual([]);
});

test("a change in two rows lists the picks of both, and its action is Replace", () => {
  // A Half-Orc gives Intimidation, which this Fighter picked.
  const entity = character("fighter", [
    [["class", "fighter", "skill-proficiency"], "intimidation"],
    [["race"], "half-elf"],
    [["race", "half-elf", "skill-proficiency"], "perception"],
  ]);
  const { question, apply } = plan(entity, { kind: "pick", path: ["race"], to: "half-orc" });
  expect(question).toEqual({
    title: "Replace Half-Elf with Half-Orc?",
    action: "Replace",
    rows: [
      { place: "Proficiencies", selection: "Skill Proficiency (Half-Elf)", picks: ["Perception"] },
      { place: "Proficiencies", selection: "Skill Proficiency (Fighter)", picks: ["Intimidation"] },
    ],
  });
  const changed = apply(entity);
  expect(one(changed, "class/fighter/skill-proficiency")).toMatchObject({ selected: [], remaining: 2 });
});

test("a different class in the place of a class: each pick of the class on each step goes", () => {
  const fighter = ["class", "fighter"];
  const entity = character("fighter", [
    [[...fighter, "fighting-style"], "archery"],
    [[...fighter, "skill-proficiency"], "athletics"],
    [[...fighter, "starting-equipment-armor"], "chain-mail"],
  ]);
  const { question, apply } = plan(entity, { kind: "replace-class", from: "fighter", to: "rogue" });
  expect(question?.title).toBe("Replace Fighter with Rogue?");
  expect(question?.action).toBe("Replace");
  expect(question?.rows.map(({ place, selection, picks }) => [place, selection, picks.length])).toEqual([
    ["Class", "Fighting Style", 1],
    ["Proficiencies", "Skill Proficiency", 1],
    ["Equipment", expect.stringMatching(/Armor/), 1],
  ]);
  expect(one(apply(entity), "class").selected).toEqual(["rogue"]);
});

/** A fighter 5 with the hit points of each level, and an improvement at level 4. */
function fighter5(): StrictEntity {
  const e = engine();
  let entity = character("fighter", []);
  for (let level = 2; level <= 5; level++) {
    entity = e.addLevel(entity, "fighter", content) as StrictEntity;
    entity = e.setField(entity, ["class", "fighter", "levels", `level-${level}`, "hit-points", "average"], 6, content) as StrictEntity;
  }
  return e.select(entity, ["class", "fighter", "levels", "level-4", "asi-or-feat"], "ability-score-improvement", content) as StrictEntity;
}

test("a lower level: the picks of the levels that go, by level", () => {
  const entity = fighter5();
  const { question, apply } = plan(entity, { kind: "lower-level", classKey: "fighter", level: 3 });
  expect(question?.title).toBe("Lower Fighter to level 3?");
  expect(question?.action).toBe("Remove");
  expect(question?.rows).toEqual([
    { place: "Level 4", selection: "Hit Points: Fighter 4", picks: ["Average"] },
    { place: "Level 4", selection: "Ability Score Improvement or Feat", picks: ["Ability Score Improvement"] },
    { place: "Level 5", selection: "Hit Points: Fighter 5", picks: ["Average"] },
  ]);
  const changed = apply(entity);
  expect(one(changed, "class/fighter/levels").selected).toEqual(["level-1", "level-2", "level-3"]);
});

test("a removed class: each pick of the class goes", () => {
  const e = engine();
  let entity = e.addClass(character("fighter", []), "rogue", content) as StrictEntity;
  entity = e.select(entity, ["class", "rogue", "multiclass-skill-proficiency"], "stealth", content) as StrictEntity;
  const { question, apply } = plan(entity, { kind: "remove-class", classKey: "rogue" });
  expect(question).toMatchObject({ title: "Remove Rogue?", action: "Remove" });
  expect(question?.rows.find((row) => row.picks.includes("Stealth"))?.place).toBe("Proficiencies");
  expect(one(apply(entity), "class").selected).toEqual(["fighter"]);
});

test("a change that removes no pick asks nothing, and apply makes the change", () => {
  const entity = character("fighter", []);
  for (const change of [
    { kind: "pick", path: ["background"], to: "acolyte" },
    { kind: "pick", path: ["race"], to: "dwarf" },
  ] satisfies PickChange[]) {
    const { question, removed, apply } = plan(entity, change);
    expect(question).toBeNull();
    expect(removed).toEqual([]);
    expect(one(apply(entity), change.path.join("/")).selected).toEqual([change.to]);
  }
  // A race in the place of a race with no pick, and a class at level 1 with no pick.
  const dwarf = engine().select(entity, ["race"], "dwarf", content) as StrictEntity;
  expect(plan(dwarf, { kind: "pick", path: ["race"], to: "elf" }).question).toBeNull();
  expect(plan(entity, { kind: "replace-class", from: "fighter", to: "rogue" }).question).toBeNull();
});
