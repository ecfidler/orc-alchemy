import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { averageHitPoints, rollHitPoints, storedHitPoints } from "./classes.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";

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
    ...[
      "alarm",
      "burning-hands",
      "charm-person",
      "color-spray",
      "comprehend-languages",
      "detect-magic",
      "disguise-self",
      "expeditious-retreat",
    ],
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
