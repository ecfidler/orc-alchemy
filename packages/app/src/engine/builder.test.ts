import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { builderSteps, type BuilderSelection } from "./builder.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const readFixture = (name: string): StrictEntity => JSON.parse(readFileSync(join(charactersDir, `${name}.strict.json`), "utf8"));

beforeAll(() => loadEngine());

const stepsOf = (entity: StrictEntity) => builderSteps(engine().evaluate(entity).selections, engine().buildTemplate().shape);
const step = (entity: StrictEntity, name: string) => stepsOf(entity).find((s) => s.name === name)!;
/** The selection keyed key under the selected option keyed option. */
const child = (selection: BuilderSelection, option: string, key: string) =>
  selection.options.find((o) => o.key === option)!.selections.find((s) => s.key === key)!;

test("emptyCharacter has the Race, Background, Class and Feats steps, without ability scores or equipment", () => {
  const steps = stepsOf(engine().emptyCharacter());
  expect(steps.map((s) => s.name)).toEqual(["Race", "Background", "Class", "Feats"]);
  expect(steps.map((s) => s.selections.map((x) => x.key))).toEqual([["race"], ["alignment", "background"], ["class"], ["feats"]]);
});

test("each option comes from the template, with its selected state", () => {
  const [race] = step(engine().emptyCharacter(), "Race").selections;
  expect(race.options).toHaveLength(10);
  expect(race.options.find((o) => o.key === "human")).toEqual({ key: "human", name: "Human", selected: false, selections: [] });
  // Custom has order 1000, so it goes last.
  expect(race.options.at(-1)!.key).toBe("custom");

  const [klass] = step(engine().emptyCharacter(), "Class").selections;
  expect(klass.options.filter((o) => o.selected).map((o) => o.key)).toEqual(["barbarian"]);
});

test("fighter-3-wizard-2 nests subclasses under the levels of each class", () => {
  const [klass] = step(readFixture("fighter-3-wizard-2"), "Class").selections;
  const levels = child(klass, "fighter", "levels");
  expect(levels.sequential).toBe(true);
  expect(levels.selected).toEqual(["level-1", "level-2", "level-3"]);
  expect(child(levels, "level-3", "martial-archetype").selected).toEqual(["champion"]);
  expect(child(child(klass, "wizard", "levels"), "level-2", "arcane-tradition").selected).toEqual(["school-of-evocation"]);
  // A starting equipment choice opens its own selection.
  const weapons = child(klass, "fighter", "starting-equipment-weapons");
  expect(child(weapons, "martial-weapon-and-shield", "starting-equipment-martial-weapon").selected).toEqual(["longsword"]);
});

test("a ref selection at several positions is one merged selection", () => {
  // Half-elf gives 1 language and acolyte 2; the character has 4.
  const [race, background, klass] = stepsOf(readFixture("fighter-3-wizard-2")).map((s) => s.selections);
  const fromRace = child(race[0], "half-elf", "languages");
  const fromBackground = child(background[1], "acolyte", "languages");
  expect(fromRace).toBe(fromBackground);
  expect(fromRace).toMatchObject({ actualPath: ["languages"], min: 3, max: 3, remaining: -1 });
  expect(fromRace.selected).toEqual(["common", "elvish", "dwarvish", "orc"]);
  expect(fromRace.options).toHaveLength(16);

  // Spells known at wizard levels 1 and 2: 6 + 2, with no maximum.
  const levels = child(klass[0], "wizard", "levels");
  const spells = child(levels, "level-1", "wizard-spells-known");
  expect(child(levels, "level-2", "wizard-spells-known")).toBe(spells);
  expect(spells).toMatchObject({ actualPath: ["class", "wizard", "wizard-spells-known"], min: 8, max: null, remaining: 0 });
});

test("a merged ref selection counts every pick once", () => {
  // Human gives 1 language and acolyte 2.
  let entity = engine().select(engine().emptyCharacter(), ["race"], "human");
  entity = engine().select(entity, ["background"], "acolyte");
  const languages = () => child(step(entity, "Race").selections[0], "human", "languages");
  expect(languages().remaining).toBe(3);
  entity = engine().select(entity, languages().actualPath, "dwarvish");
  expect(languages().remaining).toBe(2);
});

test("a ref selection at one position keeps the engine's remaining", () => {
  let checked = 0;
  for (const name of ["fighter-3-wizard-2", "warlock-10-drow", "wizard-20"]) {
    const entity = readFixture(name);
    const selections = engine().evaluate(entity).selections.filter((s) => s.ref);
    const counts = new Map<string, number>();
    for (const s of selections) counts.set(s.actualPath.join("\0"), (counts.get(s.actualPath.join("\0")) ?? 0) + 1);
    const single = selections.filter((s) => counts.get(s.actualPath.join("\0")) === 1);
    for (const s of single) {
      checked++;
      const count = s.selected.length;
      const min = s.min ?? 0;
      expect(count < min ? min - count : s.max !== null && count > s.max ? s.max - count : 0).toBe(s.remaining);
    }
  }
  expect(checked).toBeGreaterThan(0);
});

test.each(readdirSync(charactersDir).filter((f) => f.endsWith(".strict.json")))("%s shows every selection under the steps", (file) => {
  // Imported, as the app stores it, and built against the SRD alone.
  const entity = engine().importCharacter(JSON.parse(readFileSync(join(charactersDir, file), "utf8"))).entity;
  const selections = engine().evaluate(entity).selections;
  const shown = new Set<string>();
  const walk = (s: BuilderSelection) => {
    shown.add(JSON.stringify(s.actualPath));
    for (const o of s.options) o.selections.forEach(walk);
  };
  builderSteps(selections, engine().buildTemplate().shape).forEach((step) => step.selections.forEach(walk));
  const outside = ["ability-scores", "treasure", "weapons", "magic-weapons", "armor", "magic-armor", "equipment", "other-magic-items"];
  const expected = selections.filter((s) => !outside.includes(s.path[0])).map((s) => JSON.stringify(s.actualPath));
  expect([...shown].sort()).toEqual([...new Set(expected)].sort());
});

test("a selection an option of a ref selection opens nests under that option", () => {
  // Children of an invocation have paths under the ref path, not the levels.
  const [klass] = step(readFixture("warlock-10-drow"), "Class").selections;
  const invocations = child(child(klass, "warlock", "levels"), "level-2", "eldritch-invocations");
  expect(child(invocations, "book-of-ancient-secrets", "book-of-ancient-secrets-rituals").selected).toEqual([
    "detect-poison-and-disease",
    "illusory-script",
  ]);
});
