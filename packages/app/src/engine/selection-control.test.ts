// The control rule of a builder selection and the options that are not available (ORC-343,
// docs/design/character-builder.md "The control for each kind of selection", "A pick that the character cannot take").
import { beforeAll, expect, test } from "vitest";
import { setBaseScores } from "./abilities.ts";
import { type BuilderSelection, type BuilderStep, builderSteps } from "./builder.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { fixedProficiencies } from "./proficiencies.ts";
import {
  controlKind,
  featSectionNames,
  fromText,
  hasSearch,
  notAvailableText,
  pickSources,
  reasonText,
  refusalLabels,
  refusalReason,
  sectionNames,
  shownOptions,
  topSources,
  unavailableOptions,
} from "./selection-control.ts";

beforeAll(() => loadEngine());

/** A selection with `count` options and at most `max` picks. */
function selection(count: number, max: number | null, extra: Partial<BuilderSelection> = {}): BuilderSelection {
  return {
    key: "s",
    name: "S",
    actualPath: ["s"],
    min: max,
    max,
    remaining: max ?? 0,
    selected: [],
    multiselect: max === null || max > 1,
    sequential: false,
    requireValue: false,
    tags: [],
    sources: [],
    options: Array.from({ length: count }, (_, i) => ({ key: `o${i}`, name: `O${i}`, selected: false, prereqs: 0, selections: [] })),
    moved: [],
    ...extra,
  };
}

test("6 options are option cards, also with more than one pick", () => {
  expect(controlKind(selection(6, 1))).toBe("cards");
  expect(controlKind(selection(6, 2))).toBe("cards");
});

test("7 options with one pick are a list behind a Choose button, also in a multiselect", () => {
  expect(controlKind(selection(7, 1))).toBe("list");
  expect(controlKind(selection(7, 1, { multiselect: true }))).toBe("list");
});

test("7 options with two picks, or with no limit, are a picker", () => {
  expect(controlKind(selection(7, 2))).toBe("picker");
  expect(controlKind(selection(7, null))).toBe("picker");
});

test("the control counts the shown options: the engine's Custom option does not show, unless it is picked", () => {
  const s = selection(6, 1);
  s.options.push({ key: "custom", name: "Custom", selected: false, prereqs: 0, selections: [] });
  expect(shownOptions(s).map((o) => o.key)).not.toContain("custom");
  expect(controlKind(s)).toBe("cards");
  s.options.at(-1)!.selected = true;
  expect(shownOptions(s).map((o) => o.key)).toContain("custom");
  expect(controlKind(s)).toBe("list");
});

test("a picker or a list has a search field above 20 options", () => {
  expect([hasSearch(20), hasSearch(21)]).toEqual([false, true]);
});

test("the reason texts", () => {
  expect(reasonText("Requires Strength 13 or Dexterity 13")).toBe("It needs Strength 13 or Dexterity 13.");
  expect(reasonText("You already have this feat.")).toBe("You already have this feat.");
  expect(reasonText("You must have at least 5 warlock levels")).toBe("You must have at least 5 warlock levels.");
  expect(refusalReason('Cannot select insight at ["race","half-elf","skill-proficiency"]: it requires You already have this skill.')).toBe(
    "You already have this skill.",
  );
  expect(refusalReason('Cannot select grappler at ["feats"]: no selections remain.')).toBeNull();
  expect(fromText(["Acolyte"])).toBe("From Acolyte");
  expect(fromText(["Acolyte", "Half-Elf"])).toBe("From Acolyte and Half-Elf");
  expect(notAvailableText("It needs Strength 13.")).toBe("Not available. It needs Strength 13.");
});

test("the labels of a refusal split only before a label that starts with Requires, so a comma in a label stays (ORC-352)", () => {
  const labels = (text: string) => refusalLabels(`Cannot add Rune Knight: it requires ${text}.`);
  expect(labels("Requires STR 13 or higher, Requires DEX 13 or higher")).toEqual(["Requires STR 13 or higher", "Requires DEX 13 or higher"]);
  expect(labels("Requires Strength 13, or Dexterity 13")).toEqual(["Requires Strength 13, or Dexterity 13"]);
  expect(labels("Requires a level in Druid, Cleric or Ranger, requires Wisdom 13")).toEqual([
    "Requires a level in Druid, Cleric or Ranger",
    "requires Wisdom 13",
  ]);
  expect(refusalLabels("Cannot add Rune Knight: no selections remain.")).toBeNull();
});

/** The steps of the entity, and the input of unavailableOptions. */
function build(entity: StrictEntity) {
  const e = engine();
  const { built, selections } = e.evaluate(entity);
  const steps = builderSteps(selections, e.buildTemplate(undefined).shape);
  const input = { engine: e, entity, built, content: { homebrew: undefined }, tops: topSources(steps), picks: pickSources(steps) };
  return { steps, input };
}

/** The selection of the step whose sources and name match. */
function find(steps: BuilderStep[], step: string, name: string, source?: string) {
  return steps.find((s) => s.name === step)!.selections.find((s) => s.name === name && (source === undefined || s.sources.includes(source)))!;
}

test("a skill, a language or a tool that the character has is not available, and the reason names its source", () => {
  const e = engine();
  let entity = e.select(e.emptyCharacter(), ["race"], "half-elf") as StrictEntity;
  entity = e.select(entity, ["background"], "acolyte") as StrictEntity;
  entity = e.select(entity, ["class", "barbarian", "skill-proficiency"], "athletics") as StrictEntity;
  const { steps, input } = build(entity);

  // Acolyte gives Insight and Religion; the barbarian picked Athletics.
  const halfElf = unavailableOptions(input, find(steps, "Proficiencies", "Skill Proficiency", "Half-Elf"));
  expect(Object.fromEntries(halfElf)).toEqual({ athletics: "From Barbarian", insight: "From Acolyte", religion: "From Acolyte" });
  // The barbarian's own pick is available to it: it can take it out.
  const barbarian = unavailableOptions(input, find(steps, "Proficiencies", "Skill Proficiency", "Barbarian"));
  expect(barbarian.has("athletics")).toBe(false);

  // The half-elf speaks Common and Elvish.
  const languages = unavailableOptions(input, find(steps, "Proficiencies", "Languages"));
  expect(Object.fromEntries(languages)).toEqual({ common: "From Half-Elf", elvish: "From Half-Elf" });
});

test("a picked skill that a fixed source gives too is in Already has, with the fixed source; a pick alone is not", () => {
  const e = engine();
  let entity = e.setClass(e.emptyCharacter(), 0, "rogue") as StrictEntity;
  entity = e.select(entity, ["class", "rogue", "skill-proficiency"], "perception") as StrictEntity;
  // The rogue picked Perception, and has it from no other source.
  expect(fixedProficiencies(build(entity).input)).toEqual([{ kind: "tool", key: "thieves-tools", sources: ["Rogue"] }]);
  // Then the rogue becomes an elf, who has Perception too.
  entity = e.select(entity, ["race"], "elf") as StrictEntity;
  expect(fixedProficiencies(build(entity).input)).toEqual(
    expect.arrayContaining([
      { kind: "skill", key: "perception", sources: ["Elf"] },
      { kind: "tool", key: "thieves-tools", sources: ["Rogue"] },
    ]),
  );
});

test("an option with a prerequisite that the character does not meet is not available, with the engine's label", () => {
  const e = engine();
  // A variant human with Str 8 and Dex 8 takes a feat; Grappler needs Str 13: the engine says "Requires STR 13 or higher".
  let entity = e.select(e.emptyCharacter(), ["race"], "human") as StrictEntity;
  entity = e.select(entity, ["race", "human", "variant"], "variant-human") as StrictEntity;
  const weak = build(setBaseScores(entity, "standard-scores", { str: 8, dex: 8, con: 15, int: 14, wis: 13, cha: 12 }));
  const feats = find(weak.steps, "Feats", "Feats");
  expect(feats.options.find((o) => o.key === "grappler")!.prereqs).toBeGreaterThan(0);
  expect(unavailableOptions(weak.input, feats).get("grappler")).toBe("It needs STR 13 or higher.");
  // With Str 15, Grappler is available.
  const strong = build(entity);
  expect(unavailableOptions(strong.input, find(strong.steps, "Feats", "Feats")).has("grappler")).toBe(false);
});

test("a full selection still shows the prerequisite, not the count, as the reason", () => {
  const e = engine();
  let entity = e.select(e.emptyCharacter(), ["race"], "half-elf") as StrictEntity;
  entity = e.select(entity, ["background"], "acolyte") as StrictEntity;
  entity = e.select(entity, ["race", "half-elf", "skill-proficiency"], "arcana") as StrictEntity;
  entity = e.select(entity, ["race", "half-elf", "skill-proficiency"], "history") as StrictEntity;
  const { steps, input } = build(entity);
  const halfElf = find(steps, "Proficiencies", "Skill Proficiency", "Half-Elf");
  expect(halfElf.remaining).toBe(0);
  expect(unavailableOptions(input, halfElf).get("insight")).toBe("From Acolyte");
  expect(unavailableOptions(input, halfElf).has("nature")).toBe(false);
});

test("two sections of a step with the same name name their sources in the heading", () => {
  const e = engine();
  const entity = e.select(e.emptyCharacter(), ["race"], "half-elf") as StrictEntity;
  const { steps } = build(entity);
  const names = [...sectionNames(steps.find((s) => s.name === "Proficiencies")!.selections).values()];
  expect(names).toEqual(expect.arrayContaining(["Skill Proficiency: Half-Elf", "Skill Proficiency: Barbarian", "Languages"]));
  // A name that is there one time stays as it is.
  expect([...sectionNames(steps.find((s) => s.name === "Race")!.selections).values()]).toEqual(["Race"]);
});

test("each feat section names its sources, also when no other section has its name (ORC-352)", () => {
  const e = engine();
  let entity = e.select(e.emptyCharacter(), ["race"], "human") as StrictEntity;
  entity = e.select(entity, ["race", "human", "variant"], "variant-human") as StrictEntity;
  const feats = () => build(entity).steps.find((s) => s.name === "Feats")!.selections;
  expect([...featSectionNames(feats()).values()]).toEqual(["Feats: Variant Human"]);
  // The feat of a Barbarian 4 is in the same selection of the engine: its heading names the two sources, the class first.
  for (let level = 1; level < 4; level++) entity = e.addLevel(entity, "barbarian") as StrictEntity;
  entity = e.select(entity, ["class", "barbarian", "levels", "level-4", "asi-or-feat"], "feat") as StrictEntity;
  expect([...featSectionNames(feats()).values()]).toEqual(["Feats: Barbarian, Variant Human"]);
  // On another step, a name that is there one time stays as it is.
  expect([...sectionNames(feats()).values()]).toEqual(["Feats"]);
});
