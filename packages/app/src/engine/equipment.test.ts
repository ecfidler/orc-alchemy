import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { changeCustomItem, customItems, addCustomItem, setAttuned, setCarried, setQuantity, storedItems, wield } from "./equipment.ts";
import { toSheet } from "./sheet.ts";

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const readJson = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));

beforeAll(() => loadEngine());

/** fighter-20 without its armor, magic items, hands and attunement: as it is before the Equipment step. */
function unequippedFighter20() {
  const strict = readJson("fighter-20.strict.json");
  const lists = ["~:armor", "~:magic-weapons", "~:other-magic-items"];
  strict["~:orcpub.entity.strict/selections"] = strict["~:orcpub.entity.strict/selections"].filter(
    (s: Record<string, string>) => !lists.includes(s["~:orcpub.entity.strict/key"]),
  );
  for (const key of ["worn-armor", "wielded-shield", "main-hand-weapon", "attuned-magic-items"]) {
    delete strict["~:orcpub.entity.strict/values"][`~:orcpub.dnd.e5.character/${key}`];
  }
  return strict;
}

test("fighter-20 equipped from scratch by the builder's calls builds as the fixture", () => {
  const e = engine();
  let entity: StrictEntity = unequippedFighter20();
  entity = e.addInventoryItem(entity, "armor", "plate");
  entity = e.addInventoryItem(entity, "magic-weapons", "longsword-1");
  entity = e.addInventoryItem(entity, "other-magic-items", "amulet-of-health");
  entity = wield(e, entity, "worn-armor", "plate");
  entity = wield(e, entity, "wielded-shield", "shield");
  entity = wield(e, entity, "main-hand-weapon", "longsword-1");
  entity = setAttuned(e, entity, "amulet-of-health", true);

  const { built } = e.evaluate(entity);
  const actual = JSON.parse(JSON.stringify(built));
  const expected = readJson("fighter-20.expected.json");
  // The builder sets the off hand to none, as the old app; the golden has none set.
  expect(actual["off-hand-weapon"]).toBe("none");
  delete actual["off-hand-weapon"];
  delete expected["off-hand-weapon"];
  expect(actual).toEqual(expected);

  const sheet = toSheet(built, entity);
  expect(sheet.armorClass).toBe(20);
  expect(sheet.maxHitPoints).toBe(204);
  expect(sheet.weaponAttacks.find((w) => w.key === "longsword-1")).toMatchObject({ name: "Longsword 1", attackBonus: 12, damageModifier: 6 });
});

test("a carried change keeps the starting-equipment flags; a quantity change drops them, as the old builder", () => {
  const e = engine();
  const entity = readJson("fighter-20.strict.json");
  const raw = (entity: StrictEntity) =>
    JSON.parse(JSON.stringify(entity))
      ["~:orcpub.entity.strict/selections"].find((s: Record<string, string>) => s["~:orcpub.entity.strict/key"] === "~:equipment")
      ["~:orcpub.entity.strict/options"].find((o: Record<string, string>) => o["~:orcpub.entity.strict/key"] === "~:clothes-common")[
      "~:orcpub.entity.strict/map-value"
    ];
  const flag = "~:orcpub.dnd.e5.character.equipment/background-starting-equipment?";
  expect(raw(entity)[flag]).toBe(true);

  const uncarried = setCarried(e, entity, "equipment", "clothes-common", false);
  expect(raw(uncarried)[flag]).toBe(true);
  expect(storedItems(uncarried, "equipment").find((i) => i.key === "clothes-common")).toEqual({ key: "clothes-common", quantity: 1, equipped: false });

  const two = setQuantity(e, uncarried, "equipment", "clothes-common", 2);
  expect(raw(two)).toEqual({
    "~:orcpub.dnd.e5.character.equipment/equipped?": false,
    "~:orcpub.dnd.e5.character.equipment/quantity": 2,
  });
  expect(e.evaluate(two).built.equipment!["clothes-common"]).toEqual({
    "orcpub.dnd.e5.character.equipment/equipped?": false,
    "orcpub.dnd.e5.character.equipment/quantity": 2,
  });
});

test("custom items: add, rename, carry and count", () => {
  const e = engine();
  let entity: StrictEntity = e.emptyCharacter();
  entity = addCustomItem(e, entity, "custom-treasure");
  expect(customItems(entity, "custom-treasure")).toEqual([{ name: "New Custom Item", quantity: 1, equipped: true, starting: false }]);
  entity = changeCustomItem(e, entity, "custom-treasure", 0, { name: "Ruby" });
  entity = changeCustomItem(e, entity, "custom-treasure", 0, { equipped: false });
  entity = changeCustomItem(e, entity, "custom-treasure", 0, { quantity: 3 });
  expect(customItems(entity, "custom-treasure")).toEqual([{ name: "Ruby", quantity: 3, equipped: false, starting: false }]);
});

test("Dueling: the main hand set by the builder sets the off hand to none, which gives fighter-5 its +2 damage", () => {
  const e = engine();
  const strict = readJson("fighter-5.strict.json");
  for (const key of ["main-hand-weapon", "off-hand-weapon"]) delete strict["~:orcpub.entity.strict/values"][`~:orcpub.dnd.e5.character/${key}`];
  const damage = (entity: StrictEntity) =>
    toSheet(e.evaluate(entity).built, entity).weaponAttacks.find((w) => w.key === "longsword")!.damageModifier;
  const base = damage(e.setValue(strict, "main-hand-weapon", "~:longsword"));
  expect(damage(wield(e, strict, "main-hand-weapon", "longsword"))).toBe(base + 2);
});
