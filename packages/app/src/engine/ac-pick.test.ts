import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { AC_MENU_TITLE, acBoxName, acMenu, acRowName, acShown, WORN_ARMOR } from "./ac-pick.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { characterFile, exportBundle, readCharacterFile } from "./import.ts";
import { acPick, setAcPick } from "./play.ts";
import { toSheet } from "./sheet.ts";

// The rows of fighter-20: plate and a shield worn.
const ROWS = [
  { armor: "chain-mail", shield: "shield", ac: 18 },
  { armor: "chain-mail", shield: null, ac: 16 },
  { armor: "plate", shield: "shield", ac: 20 },
  { armor: "plate", shield: null, ac: 18 },
  { armor: null, shield: "shield", ac: 15 },
  { armor: null, shield: null, ac: 13 },
];
const PLATE_SHIELD = { armor: "plate", shield: "shield" };

test("without a pick, the AC of the worn pair shows, and its row is worn and shown", () => {
  expect(acShown(ROWS, PLATE_SHIELD, 13, null)).toEqual({ ac: 20, wornAc: 20, wornRow: 2, shownRow: 2, pick: null });
});

test("a pick of a row of the table shows its AC and marks its row; the worn row stays worn", () => {
  const pick = { armor: "chain-mail", shield: null };
  expect(acShown(ROWS, PLATE_SHIELD, 13, pick)).toEqual({ ac: 16, wornAc: 20, wornRow: 2, shownRow: 1, pick });
  const unarmored = { armor: null, shield: null };
  expect(acShown(ROWS, PLATE_SHIELD, 13, unarmored)).toEqual({ ac: 13, wornAc: 20, wornRow: 2, shownRow: 5, pick: unarmored });
});

test("a pick of a pair that is not in the table is ignored: the AC of the worn armor shows", () => {
  for (const pick of [
    { armor: "leather", shield: null },
    { armor: "plate", shield: "buckler" },
    { armor: null, shield: "shield-of-faith" },
  ])
    expect(acShown(ROWS, PLATE_SHIELD, 13, pick), JSON.stringify(pick)).toEqual({ ac: 20, wornAc: 20, wornRow: 2, shownRow: 2, pick: null });
});

test("with nothing worn, or a worn pair that is not in the table, the best AC shows, no row is worn, and the first row with that AC shows", () => {
  expect(acShown(ROWS, null, 13, null)).toEqual({ ac: 20, wornAc: 20, wornRow: null, shownRow: 2, pick: null });
  expect(acShown(ROWS, { armor: "leather", shield: null }, 13, null)).toEqual({ ac: 20, wornAc: 20, wornRow: null, shownRow: 2, pick: null });
  // An AC of the engine above each row: no row shows it.
  expect(acShown(ROWS.slice(5), null, 15, null)).toEqual({ ac: 15, wornAc: 15, wornRow: null, shownRow: null, pick: null });
  // A pick still works with nothing worn.
  expect(acShown(ROWS, null, 13, { armor: null, shield: "shield" })).toMatchObject({ ac: 15, wornAc: 20, wornRow: null, shownRow: 4 });
});

test("with no rows, the AC of the engine shows, and a pick is ignored", () => {
  expect(acShown([], null, 12, { armor: "plate", shield: null })).toEqual({ ac: 12, wornAc: 12, wornRow: null, shownRow: null, pick: null });
});

const named = (key: string | null, name: string) => (key === null ? null : { key, name });
const NAMED = [
  { armor: named("plate", "Plate"), shield: named("shield", "Shield"), ac: 20, shown: false },
  { armor: named("chain-mail", "Chain Mail"), shield: null, ac: 16, shown: true },
  { armor: null, shield: named("shield", "Shield"), ac: 15, shown: false },
  { armor: null, shield: null, ac: 13, shown: false },
];

test("a row name is its armor and shield, or Unarmored", () => {
  expect(NAMED.map(acRowName)).toEqual(["Plate + Shield", "Chain Mail", "Unarmored + Shield", "Unarmored"]);
});

test("the menu: Worn armor with the worn AC first, then each row with its AC; the row of the pick is checked", () => {
  const { entries, checked } = acMenu(NAMED, 20, true);
  expect(entries.map(({ value, text, note }) => [value, text, note])).toEqual([
    [WORN_ARMOR, "Worn armor", "20"],
    ["plate/shield", "Plate + Shield", "20"],
    ["chain-mail/", "Chain Mail", "16"],
    ["/shield", "Unarmored + Shield", "15"],
    ["/", "Unarmored", "13"],
  ]);
  expect(entries.map((entry) => entry.pick)).toEqual([
    null,
    { armor: "plate", shield: "shield" },
    { armor: "chain-mail", shield: null },
    { armor: null, shield: "shield" },
    { armor: null, shield: null },
  ]);
  expect(checked).toBe("chain-mail/");
  // The values are distinct, so a pick finds one entry.
  expect(new Set(entries.map((entry) => entry.value)).size).toBe(entries.length);
});

test("without a pick, Worn armor is checked, also when a row shows", () => {
  expect(acMenu(NAMED, 16, false).checked).toBe(WORN_ARMOR);
  expect(acMenu([], 12, false)).toMatchObject({ entries: [{ value: WORN_ARMOR, text: "Worn armor", note: "12", pick: null }], checked: WORN_ARMOR });
});

test("pickOf gives the pick of an entry: null for Worn armor and for a value that is not in the menu", () => {
  const { entries, pickOf } = acMenu(NAMED, 20, false);
  expect(entries.map((entry) => pickOf(entry.value))).toEqual(entries.map((entry) => entry.pick));
  expect(pickOf(WORN_ARMOR)).toBeNull();
  expect(pickOf("leather/")).toBeNull();
});

test("a pick of the worn row is a pick: the box keeps that pair when the worn armor changes, and the menu checks that row", () => {
  // The pick names the worn pair, so the AC is the same as without a pick, but the pick stays.
  expect(acShown(ROWS, PLATE_SHIELD, 13, PLATE_SHIELD)).toEqual({ ac: 20, wornAc: 20, wornRow: 2, shownRow: 2, pick: PLATE_SHIELD });
  // Later the character wears chain mail and a shield: the box still shows plate and a shield.
  expect(acShown(ROWS, { armor: "chain-mail", shield: "shield" }, 13, PLATE_SHIELD)).toEqual({
    ac: 20,
    wornAc: 18,
    wornRow: 0,
    shownRow: 2,
    pick: PLATE_SHIELD,
  });
  const rows = NAMED.map((row, i) => ({ ...row, shown: i === 0 }));
  expect(acMenu(rows, 20, true).checked).toBe("plate/shield");
});

test("the name of the box and the title of the menu", () => {
  expect(acBoxName(18)).toBe("Armor class, 18");
  expect(AC_MENU_TITLE).toBe("Armor class shows");
});

describe("with the engine", () => {
  beforeAll(() => loadEngine());
  const VALUES = "~:orcpub.entity.strict/values";
  const valuesOf = (entity: StrictEntity) => (JSON.parse(JSON.stringify(entity))[VALUES] ?? {}) as Record<string, unknown>;
  const fighter = (): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/fighter-20.strict.json"), "utf8"));

  test("a pick writes only the AC pick: the worn armor and the shield stay; Worn armor removes it; export and import keep it", () => {
    const e = engine();
    const before = fighter();
    const record = valuesOf(before);
    let entity = setAcPick(e, before, { armor: "chain-mail", shield: "shield" });
    // The whole record: only the key of the AC pick is new.
    expect(valuesOf(entity)).toEqual({ ...record, "~:orc-alchemy.play/ac-pick": { "~:armor": "~:chain-mail", "~:shield": "~:shield" } });
    const built = e.evaluate(entity).built;
    expect([built["worn-armor"], built["wielded-shield"]]).toEqual(["plate", "shield"]);
    expect(toSheet(built, entity).armorClass).toBe(18);
    // Export and import, as one file and as a bundle: the pick shows.
    for (const read of [readCharacterFile(JSON.stringify(characterFile({ entity }))), readCharacterFile(JSON.stringify(exportBundle([{ entity }], "test")))]) {
      const imported = read.characters[0]!.entity;
      expect(valuesOf(imported)).toEqual(valuesOf(entity));
      const sheet = toSheet(e.evaluate(imported).built, imported);
      expect([sheet.armorClass, sheet.acPick]).toEqual([18, { armor: "chain-mail", shield: "shield" }]);
    }
    entity = setAcPick(e, entity, null);
    expect(valuesOf(entity)).toEqual(record);
    expect(toSheet(e.evaluate(entity).built, entity).armorClass).toBe(20);
  });

  test("a pick of the worn row is stored, and the menu checks that row, not Worn armor", () => {
    const e = engine();
    const entity = setAcPick(e, fighter(), PLATE_SHIELD);
    expect(valuesOf(entity)["~:orc-alchemy.play/ac-pick"]).toEqual({ "~:armor": "~:plate", "~:shield": "~:shield" });
    expect(acPick(entity)).toEqual(PLATE_SHIELD);
    const sheet = toSheet(e.evaluate(entity).built, entity);
    expect([sheet.armorClass, sheet.acPick]).toEqual([20, PLATE_SHIELD]);
    expect(acMenu(sheet.armorClassOptions, sheet.wornArmorClass, sheet.acPick !== null).checked).toBe("plate/shield");
  });

  test("an unarmored pick is kept and read back: it is a pick, not the removal of the pick", () => {
    const e = engine();
    const unarmored = { armor: null, shield: null };
    const entity = setAcPick(e, fighter(), unarmored);
    expect(valuesOf(entity)["~:orc-alchemy.play/ac-pick"]).toEqual({ "~:armor": null, "~:shield": null });
    expect(acPick(entity)).toEqual(unarmored);
    const sheet = toSheet(e.evaluate(entity).built, entity);
    expect([sheet.armorClass, sheet.acPick]).toEqual([13, unarmored]);
    expect(acMenu(sheet.armorClassOptions, sheet.wornArmorClass, true).checked).toBe("/");
  });
});
