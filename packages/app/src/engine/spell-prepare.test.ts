import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { type Spellcaster, toSheet } from "./sheet.ts";
import { type PrepareCount, prepareCounts, prepareCountText, prepareKind } from "./spell-prepare.ts";
import { setPrepared } from "./spells.ts";

// The prepare rule (ORC-287, docs/design/spells-panel.md "Preparing spells").

beforeAll(() => loadEngine());

const q = (key: string) => `~:orcpub.dnd.e5.character/${key}`;
const e2eFile = (name: string): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, `../../e2e/${name}.strict.json`), "utf8"));
const spellcastingOf = (entity: StrictEntity) => toSheet(engine().evaluate(entity).built, entity).spellcasting!;
const prepareAll = (entity: StrictEntity, className: string, keys: string[]) =>
  keys.reduce((current, key) => setPrepared(engine(), current, className, key, true), entity);

/** A character of these classes and levels, with these ability scores, by the builder's calls. */
function build(classes: [key: string, level: number][], scores: Record<string, number>, picks: [path: string[], key: string][] = []): StrictEntity {
  const e = engine();
  let entity = e.setField(e.emptyCharacter(), ["ability-scores", "standard-scores"], Object.fromEntries(Object.entries(scores).map(([a, n]) => [q(a), n])));
  classes.forEach(([key, level], i) => {
    entity = i === 0 ? e.setClass(entity, 0, key) : e.addClass(entity, key);
    for (let n = 2; n <= level; n++) entity = e.addLevel(entity, key);
  });
  for (const [path, key] of picks) entity = e.select(entity, path, key);
  return entity;
}

/** A Life cleric 5 with Wisdom 16: a limit of 8 (5 + 3), and no prepared spell. */
const lifeCleric5 = () =>
  build([["cleric", 5]], { str: 10, dex: 12, con: 14, int: 8, wis: 16, cha: 13 }, [[["class", "cleric", "levels", "level-1", "divine-domain"], "life-domain"]]);

/** Nine spells of the cleric list up to the 3rd level that are not Life domain spells. */
const NINE = ["command", "detect-magic", "guiding-bolt", "healing-word", "sanctuary", "shield-of-faith", "aid", "prayer-of-healing", "spirit-guardians"];

const casters: Pick<Spellcaster, "name" | "prepares">[] = [
  { name: "Cleric", prepares: true },
  { name: "Sorcerer", prepares: false },
];

test("the prepare kind: a leveled spell of a class that prepares can change, unless it is always prepared; a cantrip and a spell of another source are fixed", () => {
  expect(prepareKind({ source: "Cleric", alwaysPrepared: false, level: 1 }, casters)).toBe("can-change");
  expect(prepareKind({ source: "Cleric", alwaysPrepared: true, level: 1 }, casters)).toBe("always");
  expect(prepareKind({ source: "Cleric", alwaysPrepared: false, level: 0 }, casters)).toBe("cantrip");
  expect(prepareKind({ source: "Sorcerer", alwaysPrepared: false, level: 3 }, casters)).toBe("known");
  // A source with no caster entry, for example a race, does not prepare.
  expect(prepareKind({ source: "Tiefling", alwaysPrepared: false, level: 1 }, casters)).toBe("known");
  expect(prepareKind({ source: "Sorcerer", alwaysPrepared: false, level: 0 }, casters)).toBe("cantrip");
});

test("the count text in each state, with and without the class name", () => {
  const count = (prepared: number, limit: number | null): PrepareCount => {
    const [state, remove] =
      limit === null
        ? (["no-limit", 0] as const)
        : prepared < limit
          ? (["under", 0] as const)
          : prepared === limit
            ? (["at", 0] as const)
            : (["over", prepared - limit] as const);
    return { className: "Cleric", prepared, limit, state, remove };
  };
  expect(prepareCountText(count(5, 8), false)).toBe("5 of 8 prepared");
  expect(prepareCountText(count(8, 8), true)).toBe("Cleric: 8 of 8 prepared");
  expect(prepareCountText(count(9, 8), false)).toBe("9 of 8 prepared. Remove 1 spell.");
  expect(prepareCountText(count(10, 8), true)).toBe("Cleric: 10 of 8 prepared. Remove 2 spells.");
  expect(prepareCountText(count(3, null), false)).toBe("3 prepared");
  expect(prepareCountText(count(3, null), true)).toBe("Cleric: 3 prepared");
});

test("the Life cleric 9 of the e2e tests has 8 of 12 prepared: the domain spells and the cantrips are not in the count", () => {
  const spellcasting = spellcastingOf(e2eFile("life-cleric-9"));
  expect(prepareCounts(spellcasting)).toEqual([{ className: "Cleric", prepared: 8, limit: 12, state: "under", remove: 0 }]);
  // A cleric knows its full class list, so the spells that it can prepare and has not prepared are in the sheet model.
  const firstLevel = spellcasting.byLevel.find((row) => row.level === 1)!.spells;
  expect(firstLevel.find((spell) => spell.key === "command")).toMatchObject({ prepared: false, alwaysPrepared: false });
  const kinds = new Map(firstLevel.map((spell) => [spell.key, prepareKind({ ...spell, level: 1 }, spellcasting.casters)]));
  expect([kinds.get("bless"), kinds.get("cure-wounds"), kinds.get("command"), kinds.get("healing-word")]).toEqual([
    "always",
    "always",
    "can-change",
    "can-change",
  ]);
}, 20_000);

test("a cleric with a limit of 8: under, at the limit, and a ninth spell is over, with one spell to remove", () => {
  let entity = lifeCleric5();
  expect(prepareCounts(spellcastingOf(entity))).toEqual([{ className: "Cleric", prepared: 0, limit: 8, state: "under", remove: 0 }]);
  entity = prepareAll(entity, "Cleric", NINE.slice(0, 8));
  expect(prepareCounts(spellcastingOf(entity))[0]).toMatchObject({ prepared: 8, state: "at", remove: 0 });
  // Nothing stops the ninth spell, and nothing is removed.
  entity = prepareAll(entity, "Cleric", NINE.slice(8));
  const [count] = prepareCounts(spellcastingOf(entity));
  expect(count).toEqual({ className: "Cleric", prepared: 9, limit: 8, state: "over", remove: 1 });
  expect(prepareCountText(count!, true)).toBe("Cleric: 9 of 8 prepared. Remove 1 spell.");
}, 20_000);

test("a domain spell in the stored prepared spells is still always prepared, and it is not in the count", () => {
  const entity = prepareAll(lifeCleric5(), "Cleric", ["bless", "command"]);
  const spellcasting = spellcastingOf(entity);
  const bless = spellcasting.byLevel.find((row) => row.level === 1)!.spells.find((spell) => spell.key === "bless")!;
  expect(prepareKind({ ...bless, level: 1 }, spellcasting.casters)).toBe("always");
  expect(prepareCounts(spellcasting)[0]).toMatchObject({ prepared: 1 });
}, 20_000);

test("a sorcerer and a warlock have no class that prepares: no count, and each spell is known or a cantrip", () => {
  const spellcasting = spellcastingOf(e2eFile("warlock-10-sorcerer-9"));
  expect(prepareCounts(spellcasting)).toEqual([]);
  const kinds = new Set(spellcasting.byLevel.flatMap(({ level, spells }) => spells.map((spell) => prepareKind({ ...spell, level }, spellcasting.casters))));
  expect([...kinds].sort()).toEqual(["cantrip", "known"]);
}, 20_000);

test("a cleric 3 / wizard 2 has a count for each class, in the order of the classes of the character, not of the engine casters", () => {
  const entity = prepareAll(
    build(
      [
        ["cleric", 3],
        ["wizard", 2],
      ],
      { str: 8, dex: 12, con: 13, int: 14, wis: 16, cha: 10 },
      [
        [["class", "cleric", "levels", "level-1", "divine-domain"], "life-domain"],
        [["class", "wizard", "wizard-cantrips-known"], "fire-bolt"],
        ...["alarm", "burning-hands", "magic-missile", "shield", "sleep", "mage-armor"].map((key): [string[], string] => [
          ["class", "wizard", "wizard-spells-known"],
          key,
        ]),
      ],
    ),
    "Cleric",
    ["command", "aid"],
  );
  const prepared = prepareAll(entity, "Wizard", ["shield"]);
  const sheet = toSheet(engine().evaluate(prepared).built, prepared);
  // The engine gives the wizard first; the character took the cleric first, as the class line of the header shows.
  expect(sheet.spellcasting!.casters.map((caster) => caster.name)).toEqual(["Wizard", "Cleric"]);
  const counts = prepareCounts(sheet.spellcasting!, sheet.classes);
  expect(counts.map((count) => [count.className, count.prepared, count.state])).toEqual([
    ["Cleric", 2, "under"],
    ["Wizard", 1, "under"],
  ]);
  const limits = new Map(sheet.spellcasting!.casters.map((caster) => [caster.name, caster.canPrepare]));
  expect(counts.map((count) => count.limit)).toEqual([limits.get("Cleric"), limits.get("Wizard")]);
  // Without the classes, the order of the casters stays.
  expect(prepareCounts(sheet.spellcasting!).map((count) => count.className)).toEqual(["Wizard", "Cleric"]);
}, 20_000);

test("a class that prepares with no known limit has the state no-limit and nothing to remove", () => {
  const spellcasting = spellcastingOf(prepareAll(lifeCleric5(), "Cleric", NINE));
  const noLimit = { ...spellcasting, casters: spellcasting.casters.map((caster) => ({ ...caster, canPrepare: null })) };
  const [count] = prepareCounts(noLimit);
  expect(count).toEqual({ className: "Cleric", prepared: 9, limit: null, state: "no-limit", remove: 0 });
  expect(prepareCountText(count!, false)).toBe("9 prepared");
}, 20_000);
