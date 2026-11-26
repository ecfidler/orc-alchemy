import { beforeAll, expect, test } from "vitest";
import { armorWeaponsText, type ClassInput, classFacts, classFeatureSteps, knownClassFeatures } from "./class-detail.ts";
import { type Content, engine, loadEngine } from "./engine.ts";
import { allSteps, CLASS_PACKS } from "./test-classes.ts";

/** The features table of the class, all at once. */
const classFeatures = (input: ClassInput, key: string) => allSteps(classFeatureSteps(input, key));

beforeAll(() => loadEngine());

const srd = (): { engine: ReturnType<typeof engine>; content: Content } => ({ engine: engine(), content: { homebrew: undefined } });
const table = (rows: { level: number; names: string[] }[]) => rows.map(({ level, names }) => `${level}: ${names.join(", ")}`);

test("the facts of an SRD class come from a trial character at level 1, and the description is the SRD sentence", () => {
  expect(classFacts(srd(), "fighter")).toEqual({
    description: "A master of weapons and armor.",
    facts: [
      { label: "Hit die", value: "d10" },
      { label: "Saving throws", value: "Strength, Constitution" },
      { label: "Armor, weapons", value: "All armor, shields; simple and martial weapons" },
      { label: "Skills", value: "Two of Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Survival" },
      { label: "Subclass", value: "Martial Archetype, at level 3" },
    ],
    traits: [],
  });
  // A bard picks any three skills; a wizard has no armor and some weapons; a cleric's subclass is at level 1.
  const value = (key: string, label: string) => classFacts(srd(), key).facts.find((f) => f.label === label)?.value;
  expect(value("bard", "Skills")).toBe("Three of your choice");
  expect(value("wizard", "Armor, weapons")).toBe("No armor; Crossbow Light, Dagger, Dart, Quarterstaff, Sling");
  expect(value("cleric", "Subclass")).toBe("Divine Domain, at level 1");
  expect(value("wizard", "Saving throws")).toBe("Intelligence, Wisdom");
});

test("the armor and weapons text", () => {
  expect(armorWeaponsText(["light", "medium", "shields"], ["simple", "martial"])).toBe("Light and medium armor, shields; simple and martial weapons");
  expect(armorWeaponsText(["light"], ["simple", "crossbow-hand"])).toBe("Light armor; simple weapons, Crossbow Hand");
  expect(armorWeaponsText([], [])).toBe("No armor");
});

test("the features table of the fighter: its choices, its features by their first level, and Extra Attack", () => {
  expect(table(classFeatures(srd(), "fighter"))).toEqual([
    "1: Fighting Style, Second Wind",
    "2: Action Surge",
    "3: Martial Archetype",
    "4: Ability Score Improvement or Feat",
    "5: Extra Attack",
    "6: Ability Score Improvement or Feat",
    "8: Ability Score Improvement or Feat",
    "9: Indomitable",
    "11: Extra Attack (2)",
    "12: Ability Score Improvement or Feat",
    "14: Ability Score Improvement or Feat",
    "16: Ability Score Improvement or Feat",
    "19: Ability Score Improvement or Feat",
    "20: Extra Attack (3)",
  ]);
});

test("a caster's table has Spellcasting or Pact Magic, and not its spells known; a choice of a feature is part of the feature", () => {
  const wizard = table(classFeatures(srd(), "wizard"));
  expect(wizard[0]).toBe("1: Arcane Recovery, Spellcasting");
  expect(wizard.join(" / ")).not.toMatch(/Known|Spell Mastery Level/);
  expect(wizard).toContain("18: Spell Mastery");
  const warlock = table(classFeatures(srd(), "warlock"));
  expect(warlock[0]).toBe("1: Otherworldly Patron, Pact Magic");
  // Mystic Arcanum is one feature at level 11; its choices of a spell at 13, 15 and 17 are part of it.
  expect(warlock).toContain("11: Mystic Arcanum");
  expect(warlock.join(" / ")).not.toMatch(/Mystic Arcanum:/);
  // A barbarian's Extra Attack is its own feature, once.
  expect(table(classFeatures(srd(), "barbarian"))).toContain("5: Extra Attack, Fast Movement");
});

test("a pack class: the facts and the features come from the same rules, with the description of its record", () => {
  const input = { engine: engine(), content: { homebrew: CLASS_PACKS } };
  expect(classFacts(input, "rune-knight", "A warrior of runes.")).toEqual({
    description: "A warrior of runes.",
    facts: [
      { label: "Hit die", value: "d10" },
      { label: "Saving throws", value: "Strength, Constitution" },
      { label: "Armor, weapons", value: "Light armor" },
      { label: "Skills", value: "Two of Athletics, History" },
      { label: "Subclass", value: "Rune Path, at level 3" },
    ],
    traits: [],
  });
  expect(knownClassFeatures(input.content, "rune-knight")).toBeUndefined();
  const rows = classFeatures(input, "rune-knight");
  expect(table(rows)).toEqual(["2: Rune Carver", "3: Rune Path", "4: Ability Score Improvement or Feat"]);
  // The table is kept for the content.
  expect(knownClassFeatures(input.content, "rune-knight")).toBe(rows);
});
