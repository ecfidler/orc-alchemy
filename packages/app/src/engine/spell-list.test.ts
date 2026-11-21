import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { type KnownSpell, type Spellcasting, toSheet } from "./sheet.ts";
import { levelHeading, searchSpellGroups, spellClassLine, spellGroups, spellId, spellSources } from "./spell-list.ts";
import { spellLookup } from "./spell-records.ts";
import { loadSpellContent, setPrepared } from "./spells.ts";

beforeAll(() => loadEngine());

const q = (key: string) => `~:orcpub.dnd.e5.character/${key}`;
const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const readJson = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));

/** The prepared spells of the Life cleric 9 of the e2e tests: under the limit of 12. */
const CLERIC_PREPARED = ["healing-word", "shield-of-faith", "aid", "prayer-of-healing", "dispel-magic", "spirit-guardians", "banishment", "flame-strike"];

/** A Life cleric 9 with WIS 16, four cantrips and eight prepared spells, by the builder's calls. */
function lifeCleric9(): StrictEntity {
  const e = engine();
  let entity = e.setField(
    e.emptyCharacter(),
    ["ability-scores", "standard-scores"],
    Object.fromEntries(Object.entries({ str: 10, dex: 12, con: 14, int: 8, wis: 16, cha: 13 }).map(([a, n]) => [q(a), n])),
  );
  entity = e.setClass(entity, 0, "cleric");
  for (let n = 2; n <= 9; n++) entity = e.addLevel(entity, "cleric");
  entity = e.select(entity, ["class", "cleric", "levels", "level-1", "divine-domain"], "life-domain");
  for (const key of ["guidance", "light", "sacred-flame", "spare-the-dying"]) entity = e.select(entity, ["class", "cleric", "cleric-cantrips-known"], key);
  for (const key of CLERIC_PREPARED) entity = setPrepared(e, entity, "Cleric", key, true);
  return e.setValue(entity, "character-name", "Ilsa Brightwater");
}

test("e2e/life-cleric-9.strict.json is the Life cleric 9, by the builder's calls", () => {
  const file = JSON.parse(readFileSync(join(import.meta.dirname, "../../e2e/life-cleric-9.strict.json"), "utf8"));
  expect(file).toEqual(JSON.parse(JSON.stringify(lifeCleric9())));
}, 20_000);

/** The names of each group, by level. */
const namesOf = (groups: ReturnType<typeof spellGroups>) => groups.map((group) => [group.level, group.spells.map((spell) => spell.name)]);
const srd = () => loadSpellContent().then((content) => spellLookup(content, undefined));

test("a Life cleric 9 shows its cantrips, its prepared spells and its domain spells, A to Z by the record name", async () => {
  const entity = lifeCleric9();
  const sheet = toSheet(engine().evaluate(entity).built, entity);
  const groups = spellGroups(sheet.spellcasting!, await srd());
  expect(namesOf(groups)).toEqual([
    [0, ["Guidance", "Light", "Sacred Flame", "Spare the Dying"]],
    [1, ["Bless", "Cure Wounds", "Healing Word", "Shield of Faith"]],
    [2, ["Aid", "Lesser Restoration", "Prayer of Healing", "Spiritual Weapon"]],
    [3, ["Beacon of Hope", "Dispel Magic", "Revivify", "Spirit Guardians"]],
    [4, ["Banishment", "Death Ward", "Guardian of Faith"]],
    [5, ["Flame Strike", "Mass Cure Wounds", "Raise Dead"]],
  ]);
  // The domain spells are always prepared; the others are the user's picks.
  expect(groups[1]!.spells.filter((spell) => spell.alwaysPrepared).map((spell) => spell.key)).toEqual(["bless", "cure-wounds"]);
  expect(spellClassLine(sheet.classes, sheet.spellcasting!)).toBe("Cleric 9");
  expect(spellSources(sheet.spellcasting!)).toEqual(["Cleric"]);
}, 20_000);

test("wizard-5 shows no unprepared spellbook spell, and its 3rd level, with slots and no prepared spell, keeps its group", async () => {
  const sheet = toSheet(readJson("wizard-5.expected.json"), readJson("wizard-5.strict.json"));
  const groups = spellGroups(sheet.spellcasting!, await srd());
  expect(namesOf(groups)).toEqual([
    [0, ["Acid Splash", "Chill Touch", "Dancing Lights", "Fire Bolt"]],
    [1, ["Alarm", "Burning Hands", "Charm Person", "Color Spray", "Comprehend Languages", "Detect Magic", "Disguise Self", "Expeditious Retreat"]],
    [2, ["Alter Self"]],
    [3, []],
  ]);
});

/** A known spell of a source. */
const known = (key: string, name: string, source: string, prepared = false): KnownSpell => ({
  key,
  name,
  source,
  ability: "int",
  alwaysPrepared: false,
  prepared,
  castNote: null,
});
const caster = (name: string, prepares: boolean) => ({ name, ability: "int" as const, saveDc: 13, attackBonus: 5, prepares, canPrepare: prepares ? 4 : null });

test("a spell that two sources give is two entries; a source that does not prepare shows all its spells; with no lookup the names come from the keys", () => {
  const spellcasting: Spellcasting = {
    slots: [{ level: 1, count: 2, spent: 0 }],
    pact: null,
    casters: [caster("Wizard", true), caster("Sorcerer", false)],
    byLevel: [{ level: 1, spells: [known("shield", "Shield", "Sorcerer"), known("shield", "Shield", "Wizard", true), known("sleep", "Sleep", "Wizard")] }],
    knownModes: {},
  };
  const [first] = spellGroups(spellcasting, null);
  expect(first!.spells.map(spellId)).toEqual(["Sorcerer/shield", "Wizard/shield"]);
  // The SRD record name wins over the name from the key, as on the sheet.
  const lookup = (key: string) => (key === "shield" ? { record: { key, name: "Shield!", level: 1, school: "abjuration" }, from: "SRD" as const } : undefined);
  expect(spellGroups(spellcasting, lookup)[0]!.spells.map((spell) => spell.name)).toEqual(["Shield!", "Shield!"]);
  expect(spellSources(spellcasting)).toEqual(["Wizard", "Sorcerer"]);
  expect(spellClassLine([{ key: "wizard", name: "Wizard", level: 5, hitDie: 6, subclass: null }], spellcasting)).toBe("Wizard 5");
});

test("the class line has each class that gives spells, in the order taken, and no other class", () => {
  const entity = JSON.parse(readFileSync(join(import.meta.dirname, "../../e2e/warlock-10-sorcerer-9.strict.json"), "utf8"));
  const sheet = toSheet(engine().evaluate(entity).built, entity);
  expect(spellClassLine(sheet.classes, sheet.spellcasting!)).toBe("Warlock 10 / Sorcerer 9");
  // A fighter with a High Elf cantrip only: no class gives spells.
  const elf = { ...sheet.spellcasting!, casters: [caster("High Elf", false)], byLevel: [{ level: 0, spells: [known("light", "Light", "High Elf")] }] };
  expect(spellClassLine([{ key: "fighter", name: "Fighter", level: 3, hitDie: 10, subclass: null }], elf)).toBe("");
}, 20_000);

test("the search keeps the spells whose shown name has the text, in any case, and leaves out a group with no match", async () => {
  const sheet = toSheet(readJson("wizard-5.expected.json"), readJson("wizard-5.strict.json"));
  const groups = spellGroups(sheet.spellcasting!, await srd());
  expect(namesOf(searchSpellGroups(groups, "  CH "))).toEqual([
    [0, ["Chill Touch"]],
    [1, ["Charm Person"]],
  ]);
  expect(namesOf(searchSpellGroups(groups, "alter"))).toEqual([[2, ["Alter Self"]]]);
  expect(searchSpellGroups(groups, "tsunami")).toEqual([]);
  // Only spaces: no search, and the group with no spells stays.
  expect(searchSpellGroups(groups, "  ")).toBe(groups);
});

test("a level heading is Cantrips, or the ordinal and level", () => {
  expect([0, 1, 2, 3, 9].map(levelHeading)).toEqual(["Cantrips", "1st level", "2nd level", "3rd level", "9th level"]);
});
