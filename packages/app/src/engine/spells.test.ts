import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { setQuantity } from "./equipment.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { toSheet } from "./sheet.ts";
import { loadSpellContent, preparedSpells, setPrepared, spellLevelOf } from "./spells.ts";

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const readJson = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));
const q = (key: string) => `~:orcpub.dnd.e5.character/${key}`;
const BY_CLASS = q("prepared-spells-by-class");

type StrictOption = { "~:orcpub.entity.strict/key": string; "~:orcpub.entity.strict/selections"?: StrictSelection[] };
type StrictSelection = {
  "~:orcpub.entity.strict/key": string;
  "~:orcpub.entity.strict/option"?: StrictOption;
  "~:orcpub.entity.strict/options"?: StrictOption[];
};
/** The option keys stored at a path of selection and option keys, in the entity's order. */
function stored(entity: { "~:orcpub.entity.strict/selections"?: StrictSelection[] }, path: string[]): string[] {
  let selections = entity["~:orcpub.entity.strict/selections"];
  for (let i = 0; i < path.length; i += 2) {
    const selection = selections?.find((s) => s["~:orcpub.entity.strict/key"] === `~:${path[i]}`);
    const single = selection?.["~:orcpub.entity.strict/option"];
    const options = selection?.["~:orcpub.entity.strict/options"] ?? (single ? [single] : []);
    if (i + 1 === path.length) return options.map((o) => o["~:orcpub.entity.strict/key"].replace(/^~:/, ""));
    selections = options.find((o) => o["~:orcpub.entity.strict/key"] === `~:${path[i + 1]}`)?.["~:orcpub.entity.strict/selections"];
  }
  return [];
}
/** The stored prepared spells, with each set sorted, to compare as sets. */
const preparedOf = (entity: StrictEntity) =>
  ((JSON.parse(JSON.stringify(entity))["~:orcpub.entity.strict/values"][BY_CLASS] ?? []) as Record<string, { "~#set": string[] }>[]).map(
    (entry) => ({ ...entry, [q("prepared-spells")]: { "~#set": [...entry[q("prepared-spells")]["~#set"]].sort() } }),
  );

beforeAll(() => loadEngine());

test("wizard-20 by the builder's calls builds as the fixture, with its prepared spells", () => {
  const e = engine();
  const golden = readJson("wizard-20.strict.json");
  let entity: StrictEntity = e.emptyCharacter();
  const select = (path: string[], ...keys: string[]) => {
    for (const key of keys) entity = e.select(entity, path, key);
  };
  const copy = (path: string[]) => select(path, ...stored(golden, path));

  copy(["race"]);
  copy(["race", "human", "subrace"]);
  copy(["race", "human", "variant"]);
  copy(["background"]);
  copy(["background", "acolyte", "starting-equipment-holy-symbol"]);
  copy(["background", "acolyte", "starting-equipment-prayer-book-wheel"]);
  copy(["alignment"]);
  // The fixture also picks Common, which the engine refuses: a human knows it.
  select(["languages"], ...stored(golden, ["languages"]).filter((key) => key !== "common"));
  const scores = golden["~:orcpub.entity.strict/selections"].find(
    (s: StrictSelection) => s["~:orcpub.entity.strict/key"] === "~:ability-scores",
  )["~:orcpub.entity.strict/option"];
  entity = e.setField(entity, ["ability-scores", "standard-scores"], scores["~:orcpub.entity.strict/map-value"]);

  const wizard = ["class", "wizard"];
  entity = e.setClass(entity, 0, "wizard");
  for (const key of ["starting-equipment-melee-weapon", "starting-equipment-equipment-pack", "starting-equipment-spellcasting-equipment", "skill-proficiency"]) {
    copy([...wizard, key]);
  }
  for (let n = 2; n <= 20; n++) {
    const level = [...wizard, "levels", `level-${n}`];
    entity = e.addLevel(entity, "wizard");
    // Every level after the first stores the average, 4.
    entity = e.setField(entity, [...level, "hit-points", "average"], 4);
    if (n === 2) copy([...level, "arcane-tradition"]);
    const [asiOrFeat] = stored(golden, [...level, "asi-or-feat"]);
    if (asiOrFeat !== undefined) {
      select([...level, "asi-or-feat"], asiOrFeat);
      for (const ability of stored(golden, [...level, "asi-or-feat", asiOrFeat, "asi"])) {
        entity = e.increaseAbility(entity, [...level, "asi-or-feat", asiOrFeat, "asi"], ability.replace(/^orcpub\.dnd\.e5\.character\//, ""));
      }
    }
  }
  // The merged spell selections, then the level 18 and 20 picks, which take known spells.
  copy([...wizard, "wizard-cantrips-known"]);
  copy([...wizard, "wizard-spells-known"]);
  copy([...wizard, "levels", "level-18", "spell-mastery-level-1-spell"]);
  copy([...wizard, "levels", "level-18", "spell-mastery-level-2-spell"]);
  copy([...wizard, "levels", "level-20", "signature-spells"]);
  const values = golden["~:orcpub.entity.strict/values"] as Record<string, unknown>;
  entity = e.setValue(entity, "character-name", values[q("character-name")]);
  entity = e.setValue(entity, "xps", values[q("xps")]);
  // The acolyte's 15 gp, changed to 1500 on the Equipment step.
  entity = setQuantity(e, entity, "treasure", "gp", 1500);
  for (const key of preparedSpells(golden).Wizard!) entity = setPrepared(e, entity, "Wizard", key, true);

  const built = JSON.parse(JSON.stringify(e.evaluate(entity).built));
  const expected = readJson("wizard-20.expected.json");
  expect(Object.keys(built).sort()).toEqual(Object.keys(expected).sort());
  // Trait order follows the order of the entity's top-level selections; see classes.test.ts.
  const byName = (traits: { name: string }[]) => [...traits].sort((a, b) => a.name.localeCompare(b.name));
  expect(byName(built.traits)).toEqual(byName(expected.traits));
  for (const key of Object.keys(expected)) {
    if (key !== "traits") expect({ [key]: built[key] }).toEqual({ [key]: expected[key] });
  }
  expect(preparedOf(entity)).toEqual(preparedOf(golden));
  // Alone it takes about 2 seconds; with the whole suite in parallel, longer.
}, 20_000);

test("a wizard 3 and cleric 2 has the slots of a level 5 caster", () => {
  const e = engine();
  let entity = e.setField(
    e.emptyCharacter(),
    ["ability-scores", "standard-scores"],
    Object.fromEntries(Object.entries({ str: 8, dex: 14, con: 13, int: 15, wis: 13, cha: 10 }).map(([a, n]) => [q(a), n])),
  );
  entity = e.setClass(entity, 0, "wizard");
  entity = e.addLevel(entity, "wizard");
  entity = e.addLevel(entity, "wizard");
  entity = e.addClass(entity, "cleric");
  entity = e.addLevel(entity, "cleric");
  const built = e.evaluate(entity).built;
  expect(built["spell-slots"]).toEqual({ "1": 4, "2": 3, "3": 2 });
  const spellcasting = toSheet(built, entity).spellcasting!;
  expect(spellcasting.slots).toEqual([
    { level: 1, count: 4 },
    { level: 2, count: 3 },
    { level: 3, count: 2 },
  ]);
  expect(spellcasting.knownModes).toMatchObject({ Cleric: "all" });
});

test("setPrepared adds and removes a spell, in the golden shape, for each class", () => {
  const e = engine();
  let entity: StrictEntity = e.emptyCharacter();
  entity = setPrepared(e, entity, "Wizard", "alarm", true);
  entity = setPrepared(e, entity, "Wizard", "charm-person", true);
  entity = setPrepared(e, entity, "Cleric", "bless", true);
  expect(preparedSpells(entity)).toEqual({ Wizard: new Set(["alarm", "charm-person"]), Cleric: new Set(["bless"]) });
  const stored = JSON.parse(JSON.stringify(entity))["~:orcpub.entity.strict/values"][BY_CLASS];
  expect(stored).toContainEqual({ [q("class-name")]: "Wizard", [q("prepared-spells")]: { "~#set": expect.arrayContaining(["~:alarm", "~:charm-person"]) } });

  entity = setPrepared(e, entity, "Wizard", "alarm", false);
  expect(preparedSpells(entity)).toEqual({ Wizard: new Set(["charm-person"]), Cleric: new Set(["bless"]) });
  // The sheet reads them through preparedSpells.
  expect(preparedSpells(readJson("wizard-20.strict.json")).Wizard!.size).toBe(25);
});

test("spellLevelOf reads the SRD level, else the name's prefix", async () => {
  const content = await loadSpellContent();
  expect(content.size).toBe(319);
  expect(spellLevelOf("acid-splash", "Acid Splash", content)).toBe(0);
  expect(spellLevelOf("alarm", "1 - Alarm", content)).toBe(1);
  expect(spellLevelOf("my-spell", "3 - My Spell", content)).toBe(3);
  expect(spellLevelOf("my-cantrip", "My Cantrip", content)).toBeNull();
  expect(spellLevelOf("alarm", "1 - Alarm", null)).toBe(1);
});
