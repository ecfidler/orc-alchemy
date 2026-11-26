// The picks that a change removes, and the question before it (ORC-344, docs/design/character-builder.md "A change
// that removes picks"): the five changes of the spec's table, a change in two rows, and a change that removes no pick.
import type { AvailableSelection } from "@pubdoor/dmv";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { addFirstClass, newCharacter } from "./new-character.ts";
import { type PickChange, planChange } from "./removed-picks.ts";
import { WOOD_KIN_PACKS } from "./test-races.ts";

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
    rows: [{ place: "Proficiencies", selection: "Skills", picks: ["Insight", "Religion"] }],
  });
  expect(removed).toEqual([
    [...CLERIC_SKILLS, "insight"],
    [...CLERIC_SKILLS, "religion"],
  ]);

  const changed = apply();
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
      { place: "Proficiencies", selection: "Skills", picks: ["Perception", "Stealth"] },
      // The languages of the race and the background are one selection: Acolyte keeps two, and the last pick goes.
      { place: "Proficiencies", selection: "Languages", picks: ["Goblin"] },
    ],
  });

  const changed = apply();
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
  expect(one(apply(), "background/acolyte/languages").selected).toEqual([]);
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
      { place: "Proficiencies", selection: "Skills (Half-Elf)", picks: ["Perception"] },
      { place: "Proficiencies", selection: "Skills (Fighter)", picks: ["Intimidation"] },
    ],
  });
  const changed = apply();
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
    ["Proficiencies", "Skills", 1],
    ["Equipment", expect.stringMatching(/Armor/), 1],
  ]);
  expect(one(apply(), "class").selected).toEqual(["rogue"]);
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

test("a lower level: the picks of the levels that go, by level; the hit-point method of a level is not a pick", () => {
  const entity = fighter5();
  const { question, removed, apply } = plan(entity, { kind: "lower-level", classKey: "fighter", level: 3 });
  expect(question?.title).toBe("Lower Fighter to level 3?");
  expect(question?.action).toBe("Remove");
  expect(question?.rows).toEqual([{ place: "Level 4", selection: "Ability Score Improvement or Feat", picks: ["Ability Score Improvement"] }]);
  expect(removed.filter((path) => path.includes("hit-points"))).toEqual([]);
  const changed = apply();
  expect(one(changed, "class/fighter/levels").selected).toEqual(["level-1", "level-2", "level-3"]);
  // A level with only its hit points asks nothing.
  expect(plan(entity, { kind: "lower-level", classKey: "fighter", level: 4 }).question).toBeNull();
});

test("a removed class: each pick of the class goes", () => {
  const e = engine();
  let entity = e.addClass(character("fighter", []), "rogue", content) as StrictEntity;
  entity = e.select(entity, ["class", "rogue", "multiclass-skill-proficiency"], "stealth", content) as StrictEntity;
  const { question, apply } = plan(entity, { kind: "remove-class", classKey: "rogue" });
  expect(question).toMatchObject({ title: "Remove Rogue?", action: "Remove" });
  expect(question?.rows.find((row) => row.picks.includes("Stealth"))?.place).toBe("Proficiencies");
  expect(question?.rows.some((row) => row.selection.startsWith("Hit Points"))).toBe(false);
  expect(one(apply(), "class").selected).toEqual(["fighter"]);
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
    expect(one(apply(), change.path.join("/")).selected).toEqual([change.to]);
  }
  // A race in the place of a race with no pick, and a class at level 1 with no pick.
  const dwarf = engine().select(entity, ["race"], "dwarf", content) as StrictEntity;
  expect(plan(dwarf, { kind: "pick", path: ["race"], to: "elf" }).question).toBeNull();
  expect(plan(entity, { kind: "replace-class", from: "fighter", to: "rogue" }).question).toBeNull();
});

test("the picks of a row are in the order of the selection's picks, from each group: a Half-Elf with Perception and Stealth takes Elf", () => {
  const entity = character("fighter", [
    [["race"], "half-elf"],
    [["race", "half-elf", "skill-proficiency"], "perception"],
    [["race", "half-elf", "skill-proficiency"], "stealth"],
  ]);
  const { question, removed } = plan(entity, { kind: "pick", path: ["race"], to: "elf" });
  // Elf gives Perception, so that pick goes before the change, and Stealth goes with Half-Elf: two groups, one row.
  expect(removed.map((path) => path.at(-1))).toEqual(["stealth", "perception"]);
  expect(question?.rows).toEqual([{ place: "Proficiencies", selection: "Skills", picks: ["Perception", "Stealth"] }]);
});

test("a tool and an expertise selection have the name of their kind in a row, and two rows of one name are one", () => {
  const e = engine();
  let monk = character("monk", [[["class", "monk", "tool-selection"], "artisans-tools"]]);
  const tool = selections(monk).find((s) => s.key.startsWith("tool-selection--"))!;
  monk = e.select(monk, tool.actualPath, "smiths-tools", content) as StrictEntity;
  // The tool choice and the tool that it opens have one name and one source: one row.
  expect(plan(monk, { kind: "replace-class", from: "monk", to: "fighter" }).question?.rows).toEqual([
    { place: "Proficiencies", selection: "Tools", picks: ["Artisans Tools", "Smith's Tools"] },
  ]);
  const rogue = character("rogue", [[["class", "rogue", "expertise"], "two-skills"]]);
  expect(plan(rogue, { kind: "replace-class", from: "rogue", to: "fighter" }).question?.rows).toEqual([
    { place: "Proficiencies", selection: "Expertise", picks: ["Two Skills"] },
  ]);
});

const SUBRACE_CONTENT = { homebrew: WOOD_KIN_PACKS };

test("a different subrace: each pick of the old subrace goes, and the title names the two subraces", () => {
  const e = engine();
  const subrace = ["race", "elf", "subrace"];
  let entity = addFirstClass(e, newCharacter(e), "wizard", SUBRACE_CONTENT);
  entity = e.select(entity, ["race"], "elf", SUBRACE_CONTENT) as StrictEntity;
  entity = e.select(entity, subrace, "high-elf", SUBRACE_CONTENT) as StrictEntity;
  const cantrip = e.evaluate(entity, SUBRACE_CONTENT).selections.find((s) => s.key === "high-elf-cantrips-known")!;
  entity = e.select(entity, cantrip.actualPath, "fire-bolt", SUBRACE_CONTENT) as StrictEntity;
  const { question, apply } = planChange({ engine: e, entity, content: SUBRACE_CONTENT }, { kind: "pick", path: subrace, to: "wood-kin" });
  expect(question).toEqual({
    title: "Replace High Elf with Wood Kin?",
    action: "Replace",
    rows: [{ place: "Spells", selection: "High Elf Cantrips Known", picks: ["Fire Bolt"] }],
  });
  const changed = e.evaluate(apply(), SUBRACE_CONTENT).selections;
  expect(changed.find((s) => s.path.join("/") === subrace.join("/"))?.selected).toEqual(["wood-kin"]);
});
