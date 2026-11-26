import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { AvailableSelection, Homebrew, TemplateSelection } from "@pubdoor/dmv";
import { beforeAll, expect, test } from "vitest";
import { type BuilderSelection, builderSteps, pickName, remainingByStep, remainingOf, unfilled } from "./builder.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");
const charactersDir = join(fixturesDir, "characters");
const readFixture = (name: string): StrictEntity => JSON.parse(readFileSync(join(charactersDir, `${name}.strict.json`), "utf8"));

beforeAll(() => loadEngine());

const stepsOf = (entity: StrictEntity, homebrew?: Homebrew) =>
  builderSteps(engine().evaluate(entity, { homebrew }).selections, engine().buildTemplate(homebrew).shape);
const step = (entity: StrictEntity, name: string) => stepsOf(entity).find((s) => s.name === name)!;
/** The selection keyed key under the selected option keyed option. */
const child = (selection: BuilderSelection, option: string, key: string) =>
  selection.options.find((o) => o.key === option)!.selections.find((s) => s.key === key)!;

const LISTS = ["armor", "equipment", "magic-armor", "magic-weapons", "other-magic-items", "treasure", "weapons"];

const STEP_ORDER = ["Name", "Class", "Background", "Race", "Abilities", "Proficiencies", "Feats", "Spells", "Equipment", "Description"];
/** Each step's name and the actual paths of its selections, with their sources. */
const placed = (entity: StrictEntity) =>
  Object.fromEntries(stepsOf(entity).map((s) => [s.name, s.selections.map((x) => `${x.actualPath.join("/")} [${x.sources.join(", ")}]`)]));

test("emptyCharacter has the ten steps, and each selection is on its step with its source", () => {
  const steps = stepsOf(engine().emptyCharacter());
  expect(steps.map((s) => s.name)).toEqual(STEP_ORDER);
  expect(placed(engine().emptyCharacter())).toEqual({
    // Name and Description hold fields; Name has no selection.
    Name: [],
    Class: ["class []"],
    Background: ["background []"],
    Race: ["race []"],
    Abilities: ["ability-scores []"],
    // The barbarian's two skills.
    Proficiencies: ["class/barbarian/skill-proficiency [Barbarian]"],
    // The top-level feats selection, which allows no pick at level 1.
    Feats: ["feats []"],
    Spells: [],
    // The barbarian's starting equipment has an order, so it goes first.
    Equipment: [
      "class/barbarian/starting-equipment-martial-weapon [Barbarian]",
      "class/barbarian/starting-equipment-simple-weapon [Barbarian]",
      ...LISTS.map((list) => `${list} []`),
    ],
    // Alignment moves here from the Background step.
    Description: ["alignment []"],
  });
});

test("a step with nothing to pick stays, flagged empty, and Name and Description never are", () => {
  // A barbarian 1 has no spell and no feat to pick.
  const empty = (entity: StrictEntity) =>
    stepsOf(entity)
      .filter((s) => s.empty)
      .map((s) => s.name);
  expect(empty(engine().emptyCharacter())).toEqual(["Feats", "Spells"]);
  expect(empty(readFixture("wizard-20"))).toEqual(["Feats"]);
  // warlock-10-drow has a feat to pick at level 4 or 8.
  expect(empty(readFixture("warlock-10-drow"))).toEqual([]);
  const name = step(engine().emptyCharacter(), "Name");
  expect(name).toEqual({ name: "Name", selections: [], empty: false });
});

test("wizard-20 has each selection on its step, with its source", () => {
  const steps = placed(readFixture("wizard-20"));
  expect(steps.Name).toEqual([]);
  expect(steps.Class).toEqual(["class []"]);
  expect(steps.Background).toEqual(["background []"]);
  expect(steps.Race).toEqual(["race []"]);
  // The points of the Ability Score Improvement at levels 4, 8, 12, 16 and 19.
  expect(steps.Abilities).toEqual([
    "ability-scores []",
    ...[4, 8, 12, 16, 19].map((level) => `class/wizard/levels/level-${level}/asi-or-feat/ability-score-improvement/asi [Wizard]`),
  ]);
  // The human's language and the acolyte's two are one selection, with the sources in step order.
  expect(steps.Proficiencies).toEqual(["class/wizard/skill-proficiency [Wizard]", "languages [Acolyte, Human]"]);
  expect(steps.Feats).toEqual(["feats []"]);
  expect(steps.Spells).toHaveLength(5);
  expect(steps.Description).toEqual(["alignment []"]);
  // The Ability Score Improvement or Feat choice stays at its level on the Class step.
  const [klass] = step(readFixture("wizard-20"), "Class").selections;
  const level4 = child(child(klass, "wizard", "levels"), "level-4", "asi-or-feat");
  expect(level4).toMatchObject({ selected: ["ability-score-improvement"], sources: ["Wizard"] });
  expect(child(level4, "ability-score-improvement", "asi")).toBeUndefined();
});

test("fighter-3-wizard-2 has each selection on its step, with its source", () => {
  expect(stepsOf(readFixture("fighter-3-wizard-2")).map((s) => s.name)).toEqual(STEP_ORDER);
  const steps = placed(readFixture("fighter-3-wizard-2"));
  expect(steps.Name).toEqual([]);
  expect(steps.Class).toEqual(["class []"]);
  expect(steps.Background).toEqual(["background []"]);
  expect(steps.Race).toEqual(["race []"]);
  // The half-elf's two +1.
  expect(steps.Abilities).toEqual(["ability-scores []", "race/half-elf/asi [Half-Elf]"]);
  // A wizard taken second gives no skill.
  expect(steps.Proficiencies).toEqual([
    "race/half-elf/skill-proficiency [Half-Elf]",
    "class/fighter/skill-proficiency [Fighter]",
    "languages [Acolyte, Half-Elf]",
  ]);
  expect(steps.Feats).toEqual(["feats []"]);
  expect(steps.Spells).toEqual(["class/wizard/wizard-cantrips-known [Wizard]", "class/wizard/wizard-spells-known [Wizard]"]);
  expect(steps.Description).toEqual(["alignment []"]);
  // Nothing of these stays under the race or the background.
  const under = (name: string) =>
    stepsOf(readFixture("fighter-3-wizard-2"))
      .find((s) => s.name === name)!
      .selections.flatMap((s) => s.options.flatMap((o) => o.selections.map((x) => x.key)));
  expect(under("Race")).toEqual([]);
  expect(under("Background")).toEqual([]);
});

test("a feat selection is on the Feats step with its source, and each pick counts there once", () => {
  // A variant human picks a feat, a skill and two +1.
  let entity = engine().select(engine().emptyCharacter(), ["race"], "human");
  entity = engine().select(entity, ["race", "human", "variant"], "variant-human");
  const steps = stepsOf(entity);
  const feats = steps.find((s) => s.name === "Feats")!;
  expect(feats.selections).toEqual([expect.objectContaining({ actualPath: ["feats"], sources: ["Variant Human"], remaining: 1 })]);
  expect(feats.empty).toBe(false);
  expect(steps.find((s) => s.name === "Abilities")!.selections.map((s) => [s.actualPath.join("/"), s.sources])).toContainEqual([
    "race/human/variant/variant-human/asi",
    ["Variant Human"],
  ]);
  expect(steps.find((s) => s.name === "Proficiencies")!.selections.map((s) => [s.actualPath.join("/"), s.sources])).toContainEqual([
    "race/human/variant/variant-human/skill-proficiency",
    ["Variant Human"],
  ]);
  const [race] = steps.find((s) => s.name === "Race")!.selections;
  const variant = child(race, "human", "variant");
  expect(variant.options.find((o) => o.key === "variant-human")!.selections).toEqual([]);
  // Feats 1, Abilities 2, Proficiencies: the human's language, the variant's skill and the barbarian's two skills.
  const counts = Object.fromEntries(steps.map((s, i) => [s.name, remainingByStep(steps)[i].toDo]));
  expect(counts).toMatchObject({ Feats: 1, Abilities: 2, Proficiencies: 4, Race: 1 });
});

test("an expertise and a tool selection are on the Proficiencies step with their source", () => {
  // A rogue 1 picks expertise; a dwarf picks a tool.
  let entity = engine().setClass(engine().emptyCharacter(), 0, "rogue");
  entity = engine().select(entity, ["race"], "dwarf");
  const proficiencies = step(entity, "Proficiencies").selections.map((s) => [s.actualPath.join("/"), s.sources]);
  expect(proficiencies).toEqual(
    expect.arrayContaining([
      ["class/rogue/expertise", ["Rogue"]],
      ["class/rogue/skill-proficiency", ["Rogue"]],
      ["race/dwarf/tool-proficiency", ["Dwarf"]],
    ]),
  );
  // The expertise's options open their skills under it, not as more sections.
  expect(proficiencies.filter(([path]) => (path as string).startsWith("skill-expertise"))).toEqual([]);
});

test("fighter-3-wizard-2's starting equipment is in the Equipment step, not under its class and background", () => {
  const steps = stepsOf(readFixture("fighter-3-wizard-2"));
  const equipment = steps.find((s) => s.name === "Equipment")!.selections;
  expect(equipment.map((s) => s.actualPath.join("/")).sort()).toEqual(
    [
      "background/acolyte/starting-equipment-holy-symbol",
      "background/acolyte/starting-equipment-prayer-book-wheel",
      "class/fighter/starting-equipment-additional-weapons",
      "class/fighter/starting-equipment-armor",
      "class/fighter/starting-equipment-equipment-pack",
      "class/fighter/starting-equipment-weapons",
      ...LISTS,
    ].sort(),
  );
  const [klass] = steps.find((s) => s.name === "Class")!.selections;
  expect(klass.options.find((o) => o.key === "fighter")!.selections.some((s) => s.tags.includes("starting-equipment"))).toBe(false);
  const background = steps.find((s) => s.name === "Background")!.selections.find((s) => s.key === "background")!;
  expect(background.options.find((o) => o.key === "acolyte")!.selections.some((s) => s.tags.includes("starting-equipment"))).toBe(false);
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
  const weapons = step(readFixture("fighter-3-wizard-2"), "Equipment").selections.find((s) => s.key === "starting-equipment-weapons")!;
  expect(child(weapons, "martial-weapon-and-shield", "starting-equipment-martial-weapon").selected).toEqual(["longsword"]);
});

test("a ref selection at several positions is one merged selection", () => {
  // Half-elf gives 1 language and acolyte 2; the character has 4. It shows once, on the Proficiencies step.
  const languages = step(readFixture("fighter-3-wizard-2"), "Proficiencies").selections.filter((s) => s.key === "languages");
  expect(languages).toEqual([expect.objectContaining({ actualPath: ["languages"], min: 3, max: 3, remaining: -1, sources: ["Acolyte", "Half-Elf"] })]);
  expect(languages[0].selected).toEqual(["common", "elvish", "dwarvish", "orc"]);
  expect(languages[0].options).toHaveLength(16);
  const klass = step(readFixture("fighter-3-wizard-2"), "Class").selections;

  // Spells known at wizard levels 1 and 2: 6 + 2, with no maximum. It shows once, on the Spells step.
  const spells = step(readFixture("fighter-3-wizard-2"), "Spells").selections.filter((s) => s.key === "wizard-spells-known");
  expect(spells).toEqual([expect.objectContaining({ actualPath: ["class", "wizard", "wizard-spells-known"], min: 8, max: null, remaining: 0 })]);
  expect(child(child(klass[0], "wizard", "levels"), "level-1", "wizard-spells-known")).toBeUndefined();
});

test("wizard-20's spell selections are on the Spells step, not under the wizard's levels", () => {
  const steps = stepsOf(readFixture("wizard-20"));
  const spells = steps.find((s) => s.name === "Spells")!.selections;
  // In template order: the class's selections, then those of the levels.
  expect(spells.map((s) => [s.name, s.min, s.max, s.selected.length])).toEqual([
    ["Wizard Cantrips Known", 5, 5, 5],
    ["Wizard Spells Known", 44, null, 44],
    ["Signature Spells", 2, 2, 2],
    ["Spell Mastery Level 1 Spell", 1, 1, 1],
    ["Spell Mastery Level 2 Spell", 1, 1, 1],
  ]);
  const [klass] = steps.find((s) => s.name === "Class")!.selections;
  const levels = child(klass, "wizard", "levels");
  const underLevels = levels.options.flatMap((o) => o.selections);
  expect(underLevels.filter((s) => s.tags.includes("spells"))).toEqual([]);
  expect(steps.map((s) => s.name)).toEqual(STEP_ORDER);
  expect(remainingByStep(steps)[steps.findIndex((s) => s.name === "Spells")]).toEqual({ toDo: 0, tooMany: 0 });
});

test("a subrace's cantrips are on the Spells step too", () => {
  // wizard-1 is a high elf.
  const spells = step(readFixture("wizard-1"), "Spells").selections;
  expect(spells.map((s) => [s.name, s.selected.length])).toContainEqual(["High Elf Cantrips Known", 1]);
});

test("the Spells step counts the picks it shows", () => {
  // A wizard 1 picks 3 cantrips and 6 spells.
  const entity = engine().setClass(engine().emptyCharacter(), 0, "wizard");
  const steps = stepsOf(entity);
  expect(steps.find((s) => s.name === "Spells")!.selections.map((s) => s.remaining)).toEqual([3, 6]);
  expect(remainingByStep(steps)[steps.findIndex((s) => s.name === "Spells")]).toEqual({ toDo: 9, tooMany: 0 });
});

test("a merged ref selection counts every pick once", () => {
  // Human gives 1 language and acolyte 2.
  let entity = engine().select(engine().emptyCharacter(), ["race"], "human");
  entity = engine().select(entity, ["background"], "acolyte");
  const languages = () => step(entity, "Proficiencies").selections.find((s) => s.key === "languages")!;
  expect(languages().remaining).toBe(3);
  entity = engine().select(entity, languages().actualPath, "dwarvish");
  expect(languages().remaining).toBe(2);
});

test("a merged ref selection sorts the union of its options and finds children in any position's template", () => {
  // Languages at two positions; only the second offers Giant, which opens a selection.
  const languages = (options: TemplateSelection["options"]) => ({ key: "languages", name: "Languages", min: 1, max: 1, ref: ["languages"], options });
  const shape: TemplateSelection[] = [
    {
      key: "race",
      name: "Race",
      min: 1,
      max: 1,
      tags: ["race"],
      options: [{ key: "x", name: "X", selections: [languages([{ key: "common", name: "Common" }])] }],
    },
    {
      key: "background",
      name: "Background",
      min: 1,
      max: 1,
      tags: ["background"],
      options: [
        {
          key: "y",
          name: "Y",
          selections: [
            languages([
              {
                key: "giant",
                name: "Giant",
                selections: [{ key: "rune", name: "Rune", min: 1, max: 1, options: [{ key: "dwarf-rune", name: "Dwarf Rune" }] }],
              },
              { key: "abyssal", name: "Abyssal" },
            ]),
          ],
        },
      ],
    },
  ];
  const selection = (path: string[], actualPath = path, selected: string[] = [], ref = false): AvailableSelection => ({
    key: path.at(-1)!,
    name: path.at(-1)!,
    path,
    actualPath,
    min: 1,
    max: 1,
    remaining: 0,
    optionCount: 0,
    selected,
    ...(ref && { ref: ["languages"] }),
  });
  const steps = builderSteps(
    [
      selection(["race"], ["race"], ["x"]),
      selection(["race", "x", "languages"], ["languages"], ["giant"], true),
      selection(["background"], ["background"], ["y"]),
      selection(["background", "y", "languages"], ["languages"], ["giant"], true),
      selection(["languages", "giant", "rune"]),
    ],
    shape,
  );
  // The languages have no tag, so they stay under the option that opens them.
  const merged = child(steps.find((s) => s.name === "Race")!.selections[0], "x", "languages");
  expect(merged.options.map((o) => o.key)).toEqual(["abyssal", "common", "giant"]);
  expect(child(merged, "giant", "rune").options.map((o) => o.key)).toEqual(["dwarf-rune"]);
});

test("remainingOf counts a ref selection at one position as the engine does", () => {
  let checked = 0;
  for (const name of ["fighter-3-wizard-2", "warlock-10-drow", "wizard-20"]) {
    const entity = readFixture(name);
    const selections = engine()
      .evaluate(entity)
      .selections.filter((s) => s.ref);
    const counts = new Map<string, number>();
    for (const s of selections) counts.set(s.actualPath.join("\0"), (counts.get(s.actualPath.join("\0")) ?? 0) + 1);
    const single = selections.filter((s) => counts.get(s.actualPath.join("\0")) === 1);
    for (const s of single) {
      checked++;
      expect(remainingOf(s.min, s.max, s.selected.length)).toBe(s.remaining);
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
  const expected = selections.map((s) => JSON.stringify(s.actualPath));
  expect([...shown].sort()).toEqual([...new Set(expected)].sort());
});

test("a selection an option of a ref selection opens nests under that option", () => {
  // Children of an invocation have paths under the ref path, not the levels.
  // Invocations are tagged spells, so they are on the Spells step, and the rituals stay under them.
  const invocations = step(readFixture("warlock-10-drow"), "Spells").selections.find((s) => s.key === "eldritch-invocations")!;
  expect(child(invocations, "book-of-ancient-secrets", "book-of-ancient-secrets-rituals").selected).toEqual(["detect-poison-and-disease", "illusory-script"]);
});

const metaFixtures = ["legacy", "characters"].flatMap((dir) =>
  readdirSync(join(fixturesDir, dir))
    .filter((f) => f.endsWith(".meta.json"))
    .map((f) => `${dir}/${f.slice(0, -".meta.json".length)}`),
);
const readJson = (file: string) => JSON.parse(readFileSync(join(fixturesDir, file), "utf8"));
/** The packs in fixtures/orcbrew, loaded as the app loads them. */
function loadPacks(packs: string[]): Homebrew | undefined {
  let homebrew: Homebrew | undefined;
  for (const pack of packs) {
    const text = readFileSync(join(fixturesDir, "orcbrew", pack), "utf8");
    homebrew = engine().parseOrcbrew(text, { name: pack.replace(".orcbrew", ""), existing: homebrew }).data!;
  }
  return homebrew;
}

// The meta files count each position of a ref selection alone, and list
// only picks to make. The old builder merges the positions, and also flags
// picks to remove. These characters differ, as "actualPath remaining".
// ORC-118 fixes the golden ones in the fork and records picks to remove.
// Remove their entries then.
const KNOWN_UNFILLED: Record<string, string[]> = {
  // A Champion above level 10 has two fighting styles; these have one.
  "characters/fighter-11": ["class/fighter/fighting-style 1"],
  "characters/fighter-20": ["class/fighter/fighting-style 1"],
  // The feat option at levels 4 and 8, but only Keen Mind.
  "characters/warlock-10-drow": ["feats 1"],
  // Common and Elvish are picked in the half-elf's choice of 1, which a half-elf knows anyway.
  "characters/fighter-3-wizard-2": ["languages -1"],
  // Real data, so it stays. Noble is not in the SRD, so its language choice is missing,
  // and the two languages picked are one too many for the human's choice of 1.
  "legacy/character-test-2": ["class/fighter/skill-proficiency 2", "languages -1"],
};

test.each(metaFixtures)("%s has the picks its meta file records, with its packs loaded", (name) => {
  const meta = readJson(`${name}.meta.json`);
  const homebrew = loadPacks(meta.orcbrew);
  const entity = engine().importCharacter(readJson(`${name}.strict.json`)).entity;
  const steps = stepsOf(entity, homebrew);
  const actual = unfilled(steps).map((s) => `${s.actualPath.join("/")} ${s.remaining}`);
  if (name in KNOWN_UNFILLED) {
    expect(actual.sort()).toEqual([...KNOWN_UNFILLED[name]].sort());
  } else {
    // The meta files give paths only, and only picks to make, so there must be no picks to remove.
    const expected = (meta.unfilledSelections as string[][]).map((p) => p.join("/"));
    expect(unfilled(steps).filter((s) => s.remaining < 0)).toEqual([]);
    expect(
      unfilled(steps)
        .map((s) => s.actualPath.join("/"))
        .sort(),
    ).toEqual(expected.sort());
  }
});

test("remainingByStep counts picks to remove apart from picks to make", () => {
  // fighter-3-wizard-2's half-elf has Common and Elvish in its choice of 1 language: 1 too many.
  const steps = stepsOf(engine().importCharacter(readJson("characters/fighter-3-wizard-2.strict.json")).entity);
  expect(remainingByStep(steps)[steps.findIndex((s) => s.name === "Proficiencies")]).toEqual({ toDo: 0, tooMany: 1 });
  expect(remainingByStep(steps)[steps.findIndex((s) => s.name === "Race")]).toEqual({ toDo: 0, tooMany: 0 });
});

test("unfilled and remainingByStep count a merged selection once", () => {
  // Human gives 1 language and acolyte 2: one selection with 3 to choose.
  let entity = engine().select(engine().emptyCharacter(), ["race"], "human");
  entity = engine().select(entity, ["background"], "acolyte");
  const steps = stepsOf(entity);
  expect(unfilled(steps).filter((s) => s.key === "languages")).toEqual([expect.objectContaining({ remaining: 3 })]);
  // Race: subrace 1 and variant 1. Proficiencies: the 3 languages and the
  // barbarian's 2 skills. Equipment: the barbarian's 2 weapons, and the
  // acolyte's holy symbol and prayer book. Description: alignment 1.
  const toDo = remainingByStep(steps).map((count) => count.toDo);
  expect(Object.fromEntries(steps.map((s, i) => [s.name, toDo[i]]))).toEqual({
    Name: 0,
    Class: 0,
    Background: 0,
    Race: 2,
    Abilities: 0,
    Proficiencies: 5,
    Feats: 0,
    Spells: 0,
    Equipment: 4,
    Description: 1,
  });
  expect(remainingByStep(steps).every((count) => count.tooMany === 0)).toBe(true);
});

test("pickName names a pick by its selection and its option, at any depth, and gives the bare key for a pick not in the tree", () => {
  const race = step(readFixture("fighter-20"), "Race").selections.find((s) => s.key === "race")!;
  expect(pickName(race, ["race", "human", "subrace", "illuskan"])).toBe("Subrace (Illuskan)");
  expect(pickName(race, ["race", "human", "variant", "standard-human"])).toBe("Variant (Standard Human)");
  expect(pickName(race, ["race", "human"])).toBe("Race (Human)");
  // The human's languages moved to the Proficiencies step, but they are still in the race's tree.
  const language = step(readFixture("fighter-20"), "Proficiencies").selections.find((s) => s.key === "languages")!.selected[0];
  expect(pickName(race, ["languages", language])).toMatch(/^Languages \(\w+\)$/);
  // A key that the tree does not have, such as a pick under an option that is gone.
  expect(pickName(race, ["race", "human", "subrace", "no-such-subrace"])).toBe("no-such-subrace");
  expect(pickName(race, ["race", "dwarf", "subrace", "hill-dwarf"])).toBe("hill-dwarf");
});
