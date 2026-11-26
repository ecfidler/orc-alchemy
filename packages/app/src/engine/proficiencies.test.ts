// The Proficiencies step (ORC-346, docs/design/character-builder.md "The Proficiencies step"): the groups, the order
// of the sections, their heading names, the "Already has" line, and the step that counts these picks.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { type BuilderStep, builderSteps, remainingByStep, treeNodes } from "./builder.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { proficiencyGroups, proficiencyNames, proficiencySectionName, proficiencySectionNames } from "./proficiencies.ts";
import { fixedProficiencies, pickSources, topSources, unavailableOptions } from "./selection-control.ts";

beforeAll(() => loadEngine());

const fixture = (name: string): StrictEntity =>
  JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters", `${name}.strict.json`), "utf8"));

/** The steps of the entity, the input of unavailableOptions, and the groups of its Proficiencies step. */
function build(entity: StrictEntity) {
  const e = engine();
  const { built, selections } = e.evaluate(entity);
  const shape = e.buildTemplate(undefined).shape;
  const steps = builderSteps(selections, shape);
  const tops = topSources(steps);
  const input = { engine: e, entity, built, content: { homebrew: undefined }, tops, picks: pickSources(steps) };
  const step = steps.find((s) => s.name === "Proficiencies")!;
  const groups = proficiencyGroups(step.selections, { fixed: fixedProficiencies(input), tops, classes: built.classes, names: proficiencyNames(shape) });
  const names = proficiencySectionNames(step.selections);
  return { steps, step, input, groups, names };
}

/** Each group as its name, its "Already has" tokens and the heading names of its sections. */
const shown = ({ groups, names }: ReturnType<typeof build>) =>
  groups.map((group) => ({ group: group.name, alreadyHas: group.alreadyHas, sections: group.sections.map((s) => names.get(s)) }));

const select = (entity: StrictEntity, path: string[], key: string) => engine().select(entity, path, key) as StrictEntity;

function rogue(level = 1) {
  let entity = engine().setClass(engine().emptyCharacter(), 0, "rogue") as StrictEntity;
  for (let i = 1; i < level; i++) entity = engine().addLevel(entity, "rogue") as StrictEntity;
  return entity;
}

test("a rogue has its skills and then its Expertise in the Skills group, and no Languages or Tools group", () => {
  expect(shown(build(rogue()))).toEqual([{ group: "Skills", alreadyHas: [], sections: ["Skills: Rogue", "Expertise: Rogue"] }]);
  // The Expertise of a class level has the level, as the Abilities step names an improvement.
  expect(shown(build(rogue(6)))).toEqual([{ group: "Skills", alreadyHas: [], sections: ["Skills: Rogue", "Expertise: Rogue", "Expertise: Rogue 6"] }]);
});

test("the Expertise of a rogue opens its choice of skills as a section after it, with its own name", () => {
  let entity = rogue();
  entity = select(entity, ["class", "rogue", "expertise"], "two-skills");
  const { step, names } = build(entity);
  const [skills, expertise] = proficiencyGroups(step.selections, { fixed: [], tops: [], classes: ["rogue"], names: new Map() })[0].sections;
  expect([names.get(skills), names.get(expertise)]).toEqual(["Skills: Rogue", "Expertise: Rogue"]);
  const opened = expertise.options.find((o) => o.selected)!.selections;
  expect(opened.map((s) => names.get(s))).toEqual(["Skill Expertise"]);
});

test("a half-elf acolyte has one merged Languages section that names each source, and what it already has", () => {
  let entity = select(engine().emptyCharacter() as StrictEntity, ["race"], "half-elf");
  entity = select(entity, ["background"], "acolyte");
  expect(shown(build(entity))).toEqual([
    // The class first, then the race; the background gives no skill pick.
    { group: "Skills", alreadyHas: ["Insight (Acolyte)", "Religion (Acolyte)"], sections: ["Skills: Barbarian", "Skills: Half-Elf"] },
    // The engine gives no source of a language: the builder finds the race that gives it.
    { group: "Languages", alreadyHas: ["Common (Half-Elf)", "Elvish (Half-Elf)"], sections: ["Languages: Acolyte, Half-Elf"] },
  ]);
});

test("a character with no Tools selection has no Tools group; a dwarf rogue has one, with what the rogue gives", () => {
  expect(build(engine().emptyCharacter() as StrictEntity).groups.map((g) => g.name)).toEqual(["Skills"]);
  const dwarf = shown(build(select(rogue(), ["race"], "dwarf")));
  expect(dwarf.map((g) => g.group)).toEqual(["Skills", "Tools"]);
  // The engine gives no source name for the thieves' tools of a rogue, so the builder finds it.
  expect(dwarf[1]).toEqual({ group: "Tools", alreadyHas: ["Thieves' Tools (Rogue)"], sections: ["Tools: Dwarf"] });
});

test("a fixed skill with no source name from the engine has its source in the token and in the reason", () => {
  // The engine gives an elf's Perception the source "nil".
  const elf = build(select(engine().emptyCharacter() as StrictEntity, ["race"], "elf"));
  expect(elf.groups[0].alreadyHas).toEqual(["Perception (Elf)"]);
  const barbarian = elf.groups[0].sections[0];
  expect(unavailableOptions(elf.input, barbarian).get("perception")).toBe("From Elf");
});

test("the sections are in the order class, background, race; two classes in the order of the character", () => {
  // The template has the half-elf's skills before the fighter's.
  const { groups, names } = build(fixture("fighter-3-wizard-2"));
  expect(groups.map((g) => [g.name, g.sections.map((s) => names.get(s))])).toEqual([
    ["Skills", ["Skills: Fighter", "Skills: Half-Elf"]],
    ["Languages", ["Languages: Acolyte, Half-Elf"]],
  ]);
});

test("a selection that gives no single kind keeps its own name before its source", () => {
  const custom = build(select(engine().emptyCharacter() as StrictEntity, ["background"], "custom"));
  const tools = custom.step.selections.find((s) => s.key === "tool-language-proficiencies")!;
  expect(proficiencySectionName(tools)).toBe("Tool / Language Proficiencies: Custom");
  expect(shown(custom).map((g) => g.group)).toEqual(["Skills", "Tools"]);
});

/** The selections that each step shows, also the ones that a pick opens, as their template tags. */
const tagsOn = (steps: BuilderStep[], name: string) => treeNodes(steps.find((s) => s.name === name)!.selections).flatMap((s) => s.tags);

test("the Class, Background and Race steps do not show these selections, and only the Proficiencies step counts them", () => {
  let entity = select(engine().emptyCharacter() as StrictEntity, ["race"], "half-elf");
  entity = select(entity, ["background"], "acolyte");
  const { steps } = build(entity);
  for (const name of ["Class", "Background", "Race"]) expect(tagsOn(steps, name).filter((tag) => tag.endsWith("profs"))).toEqual([]);
  const counts = Object.fromEntries(steps.map((s, i) => [s.name, remainingByStep(steps)[i].toDo]));
  // 2 skills of the barbarian, 2 of the half-elf, and 3 languages.
  expect(counts).toMatchObject({ Class: 0, Background: 0, Race: 0, Proficiencies: 7 });
});
