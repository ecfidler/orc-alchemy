import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { type BuilderOption, builderSteps } from "./builder.ts";
import {
  averageHitPoints,
  changeableLevels,
  classHitPoints,
  hitDieText,
  keptLevels,
  rollHitPoints,
  rollLevels,
  setHitPointsMethod,
  storedHitPoints,
  typeHitPoints,
  withAverageHitPoints,
} from "./classes.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { addFirstClass, newCharacter } from "./new-character.ts";

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const readJson = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));

beforeAll(() => loadEngine());

test("fighter-3-wizard-2 by the builder's calls builds as the fixture, and removing the wizard leaves the fighter 3", () => {
  const e = engine();
  const strict = readJson("fighter-3-wizard-2.strict.json");
  const q = (ability: string) => `~:orcpub.dnd.e5.character/${ability}`;
  let entity: StrictEntity = e.emptyCharacter();
  const select = (path: string[], ...keys: string[]) => {
    for (const key of keys) entity = e.select(entity, path, key);
  };
  const average = (path: string[], n: number) => (entity = e.setField(entity, [...path, "hit-points", "average"], n));

  select(["race"], "half-elf");
  entity = e.increaseAbility(entity, ["race", "half-elf", "asi"], "str");
  entity = e.increaseAbility(entity, ["race", "half-elf", "asi"], "int");
  select(["race", "half-elf", "skill-proficiency"], "deception", "persuasion");
  select(["background"], "acolyte");
  select(["background", "acolyte", "starting-equipment-holy-symbol"], "amulet");
  select(["background", "acolyte", "starting-equipment-prayer-book-wheel"], "prayer-book");
  select(["alignment"], "chaotic-neutral");
  const scores = { str: 15, dex: 13, con: 14, int: 14, wis: 10, cha: 8 };
  entity = e.setField(entity, ["ability-scores", "standard-scores"], Object.fromEntries(Object.entries(scores).map(([a, n]) => [q(a), n])));

  const fighter = ["class", "fighter"];
  entity = e.setClass(entity, 0, "fighter");
  select([...fighter, "fighting-style"], "defense");
  select([...fighter, "starting-equipment-armor"], "chain-mail");
  select([...fighter, "starting-equipment-weapons"], "martial-weapon-and-shield");
  select([...fighter, "starting-equipment-weapons", "martial-weapon-and-shield", "starting-equipment-martial-weapon"], "longsword");
  select([...fighter, "starting-equipment-additional-weapons"], "two-handaxes");
  select([...fighter, "starting-equipment-equipment-pack"], "dungeoneers-pack");
  select([...fighter, "skill-proficiency"], "athletics", "perception");
  entity = e.addLevel(entity, "fighter");
  average([...fighter, "levels", "level-2"], 6);
  entity = e.addLevel(entity, "fighter");
  average([...fighter, "levels", "level-3"], 6);
  select([...fighter, "levels", "level-3", "martial-archetype"], "champion");
  // The fixture also picks Common and Elvish here, which the engine refuses: a half-elf knows them.
  select(["languages"], "dwarvish", "orc");
  // setValue cannot write prepared-spells-by-class ("nth not supported"); it does not change built.
  for (const [key, value] of Object.entries(strict["~:orcpub.entity.strict/values"] as Record<string, unknown>)) {
    if (key.endsWith("/prepared-spells-by-class")) continue;
    entity = e.setValue(entity, key.replace(/^~:/, ""), value);
  }
  const fighter3 = JSON.parse(JSON.stringify(entity));

  const wizard = ["class", "wizard"];
  entity = e.addClass(entity, "wizard");
  average([...wizard, "levels", "level-1"], 4);
  select([...wizard, "wizard-cantrips-known"], "acid-splash", "chill-touch", "dancing-lights");
  entity = e.addLevel(entity, "wizard");
  average([...wizard, "levels", "level-2"], 4);
  select([...wizard, "levels", "level-2", "arcane-tradition"], "school-of-evocation");
  select(
    [...wizard, "wizard-spells-known"],
    ...["alarm", "burning-hands", "charm-person", "color-spray", "comprehend-languages", "detect-magic", "disguise-self", "expeditious-retreat"],
  );

  const built = JSON.parse(JSON.stringify(e.evaluate(entity).built));
  const expected = readJson("fighter-3-wizard-2.expected.json");
  expect(Object.keys(built).sort()).toEqual(Object.keys(expected).sort());
  // Trait order follows the order of the entity's top-level selections.
  // emptyCharacter has class before race; the golden entity was written by
  // hand with race first, and no mutation moves class.
  const byName = (traits: { name: string }[]) => [...traits].sort((a, b) => a.name.localeCompare(b.name));
  expect(byName(built.traits)).toEqual(byName(expected.traits));
  for (const key of Object.keys(expected)) {
    if (key !== "traits") expect({ [key]: built[key] }).toEqual({ [key]: expected[key] });
  }

  entity = e.removeLevel(entity, "wizard");
  entity = e.removeClass(entity, "wizard");
  expect(JSON.parse(JSON.stringify(entity))).toEqual(fighter3);
  // Alone it takes about 1 second; with the whole suite in parallel, it takes about 5.
}, 20_000);

test("storedHitPoints reads the method and value at a hit-points path", () => {
  const entity = readJson("fighter-3-wizard-2.strict.json");
  expect(storedHitPoints(entity, ["class", "wizard", "levels", "level-1", "hit-points"])).toEqual({ method: "average", value: 4 });
  expect(storedHitPoints(entity, ["class", "fighter", "levels", "level-3", "hit-points"])).toEqual({ method: "average", value: 6 });
  // The first class's level 1 has none, and nor does a class not taken.
  expect(storedHitPoints(entity, ["class", "fighter", "levels", "level-1", "hit-points"])).toBeNull();
  expect(storedHitPoints(entity, ["class", "rogue", "levels", "level-2", "hit-points"])).toBeNull();
  const rolled = engine().setField(entity, ["class", "wizard", "levels", "level-2", "hit-points", "roll"], 3);
  expect(storedHitPoints(rolled, ["class", "wizard", "levels", "level-2", "hit-points"])).toEqual({ method: "roll", value: 3 });
});

test("the average is half the hit die plus 1, and a roll is from 1 to the die", () => {
  expect([6, 8, 10, 12].map(averageHitPoints)).toEqual([4, 5, 6, 7]);
  expect(rollHitPoints(10, () => 0)).toBe(1);
  expect(rollHitPoints(10, () => 0.999)).toBe(10);
});

// The section Hit points of a class block (ORC-351, docs/design/character-builder.md "Hit points").

const content = { homebrew: undefined };

/** The Hit points section of each class of the entity, and the engine's hit point maximum. */
function sections(entity: StrictEntity) {
  const e = engine();
  const { built, selections } = e.evaluate(entity, content);
  const classSelection = builderSteps(selections, e.buildTemplate(undefined).shape)
    .find((s) => s.name === "Class")!
    .selections.find((s) => s.key === "class")!;
  const options = classSelection.selected.map((key) => classSelection.options.find((o) => o.key === key)!) as BuilderOption[];
  return { hp: classHitPoints(entity, built, options), max: built["max-hit-points"] };
}

/** A new character with the class at the level; the engine gives the new levels no hit points. */
function classAt(classKey: string, level: number): StrictEntity {
  const e = engine();
  let entity = addFirstClass(e, newCharacter(e), classKey, content);
  for (let n = 1; n < level; n++) entity = e.addLevel(entity, classKey, content) as StrictEntity;
  return entity;
}

test("Average: each level has the average, level 1 of the first class the die; the totals are the sheet's maximum", () => {
  const { hp, max } = sections(readJson("fighter-3-wizard-2.strict.json"));
  const [fighter, wizard] = hp;
  expect(fighter.method).toBe("average");
  // Level 1 of the first class cannot change: it has the maximum of the die.
  expect(fighter.levels).toEqual([
    { level: 1, path: null, value: 10, stored: null },
    { level: 2, path: ["class", "fighter", "levels", "level-2", "hit-points"], value: 6, stored: "average" },
    { level: 3, path: ["class", "fighter", "levels", "level-3", "hit-points"], value: 6, stored: "average" },
  ]);
  // Con 14 is +2 at each level: 10 + 6 + 6 + 3 × 2 = 28, and 4 + 4 + 2 × 2 = 12.
  expect([fighter.total, wizard.total]).toEqual([28, 12]);
  expect(fighter.total + wizard.total).toBe(max);
  expect(wizard.levels.map((l) => l.path === null)).toEqual([false, false]);
  expect(hitDieText(fighter)).toBe("Hit die d10, and +2 from Constitution at each level");
  expect(changeableLevels(fighter)).toEqual([2, 3]);
});

test("By level: the averages become typed numbers, a typed number and a roll count, and Average writes the averages again", () => {
  const e = engine();
  let entity: StrictEntity = readJson("fighter-3-wizard-2.strict.json");
  const wizard = () => sections(entity).hp[1];
  entity = setHitPointsMethod(e, entity, wizard(), "by-level", content);
  expect(wizard().method).toBe("by-level");
  expect(wizard().levels.map((l) => [l.stored, l.value])).toEqual([
    ["manual-entry", 4],
    ["manual-entry", 4],
  ]);
  // The total does not change with the method.
  expect(wizard().total).toBe(12);

  entity = typeHitPoints(e, entity, wizard().levels[0].path!, 6, content);
  // A roll with a given random number is exact: 0.5 of a d6 is 4, and 0 is 1.
  entity = rollLevels(e, entity, wizard(), [2], () => 0, content);
  expect(wizard().levels.map((l) => [l.stored, l.value])).toEqual([
    ["manual-entry", 6],
    ["roll", 1],
  ]);
  let { hp, max } = sections(entity);
  expect(hp[1].total).toBe(6 + 1 + 2 * 2);
  expect(hp[0].total + hp[1].total).toBe(max);
  // Roll all rolls each level that can change.
  entity = rollLevels(e, entity, wizard(), changeableLevels(wizard()), () => 0.5, content);
  expect(wizard().levels.map((l) => l.value)).toEqual([4, 4]);

  entity = setHitPointsMethod(e, entity, wizard(), "average", content);
  expect(wizard().method).toBe("average");
  expect(wizard().levels.map((l) => [l.stored, l.value])).toEqual([
    ["average", 4],
    ["average", 4],
  ]);
  ({ hp, max } = sections(entity));
  expect(hp[0].total + hp[1].total).toBe(max);
});

test("the rolled numbers come back after Average and then By level; Average with kept levels still writes the averages (ORC-352)", () => {
  const e = engine();
  let entity: StrictEntity = readJson("fighter-3-wizard-2.strict.json");
  const wizard = () => sections(entity).hp[1];
  entity = setHitPointsMethod(e, entity, wizard(), "by-level", content);
  entity = rollLevels(e, entity, wizard(), [1, 2], () => 0, content);
  // By level to Average keeps the levels of now; another change keeps what was kept.
  let kept = keptLevels(undefined, wizard(), "by-level", "average");
  expect(kept).toEqual(wizard().levels);
  entity = setHitPointsMethod(e, entity, wizard(), "average", content, kept);
  expect(wizard().levels.map((l) => [l.stored, l.value])).toEqual([
    ["average", 4],
    ["average", 4],
  ]);
  kept = keptLevels(kept, wizard(), "average", "by-level");
  entity = setHitPointsMethod(e, entity, wizard(), "by-level", content, kept);
  expect(wizard().levels.map((l) => [l.stored, l.value])).toEqual([
    ["roll", 1],
    ["roll", 1],
  ]);
  expect(keptLevels(undefined, wizard(), "average", "average")).toBeUndefined();
});

test("a new level has no hit points: it is left, the class is By level, and the average fills it", () => {
  const e = engine();
  let entity = classAt("fighter", 3);
  let [fighter] = sections(entity).hp;
  expect(fighter.method).toBe("by-level");
  expect(fighter.left).toBe(2);
  expect(fighter.levels.map((l) => l.value)).toEqual([10, null, null]);
  entity = withAverageHitPoints(e, entity, "fighter", content);
  const after = sections(entity);
  [fighter] = after.hp;
  expect([fighter.method, fighter.left, fighter.levels.map((l) => l.value)]).toEqual(["average", 0, [10, 6, 6]]);
  expect(fighter.total).toBe(10 + 6 + 6 + 3 * fighter.constitution);
  expect(fighter.total).toBe(after.max);
  // A first class at level 1 has no level that can change: it has no method.
  expect(sections(classAt("wizard", 1)).hp[0]).toMatchObject({ method: null, left: 0, levels: [{ level: 1, path: null, value: 6, stored: null }] });
});

test("a bonus of each level other than Constitution counts in the class, and the text names it", () => {
  const e = engine();
  // A hill dwarf has 1 more hit point at each level.
  const entity = withAverageHitPoints(
    e,
    e.select(e.select(classAt("fighter", 2), ["race"], "dwarf", content), ["race", "dwarf", "subrace"], "hill-dwarf", content) as StrictEntity,
    "fighter",
    content,
  );
  const { hp, max } = sections(entity);
  expect(hp[0].otherPerLevel).toBe(1);
  expect(hp[0].total).toBe(max);
  expect(hitDieText(hp[0])).toMatch(/^Hit die d10, [+−]\d from Constitution and \+1 from other bonuses at each level$/);
});
