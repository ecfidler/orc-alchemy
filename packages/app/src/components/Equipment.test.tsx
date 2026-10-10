import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { attunedItems, customItems } from "../engine/equipment.ts";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { toSheet } from "../engine/sheet.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { Builder } from "./Builder.tsx";

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");

/** fighter-20 without its armor, magic items, hands and attunement: as it is before the Equipment step. */
function unequippedFighter20(): StrictEntity {
  const strict = JSON.parse(readFileSync(join(charactersDir, "fighter-20.strict.json"), "utf8"));
  const lists = ["~:armor", "~:magic-weapons", "~:other-magic-items"];
  strict["~:orcpub.entity.strict/selections"] = strict["~:orcpub.entity.strict/selections"].filter(
    (s: Record<string, string>) => !lists.includes(s["~:orcpub.entity.strict/key"]),
  );
  for (const key of ["worn-armor", "wielded-shield", "main-hand-weapon", "attuned-magic-items"]) {
    delete strict["~:orcpub.entity.strict/values"][`~:orcpub.dnd.e5.character/${key}`];
  }
  return strict;
}

beforeAll(() => loadEngine());
afterEach(cleanup);

/** Opens the entity in the builder, on the Equipment step. */
function open(entity: StrictEntity) {
  useCharacter.getState().load("equipment", entity);
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Equipment/ }));
}

const entity = () => useCharacter.getState().entity!;
const sheet = () => toSheet(engine().evaluate(entity()).built, entity());
const region = (name: string) => within(screen.getByRole("region", { name: new RegExp(`^${name}`) }));
// getByLabelText is slow on a page of four long item lists; every control here has an aria-label.
const labelled = (label: string) => document.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
const choose = (label: string, value: string) => fireEvent.change(labelled(label), { target: { value } });

test("fighter-20 equipped through the Equipment step has its AC, hit points and attacks", () => {
  open(unequippedFighter20());
  expect(sheet().armorClass).toBe(18);
  choose("Add an item to Armor", "plate");
  choose("Add an item to Magic Weapons", "longsword-1");
  choose("Add an item to Other Magic Items", "amulet-of-health");
  // An item in the list is not offered again.
  expect(labelled("Add an item to Armor").querySelector('option[value="plate"]')).toBeNull();
  expect(labelled("Carried: Plate").checked).toBe(true);
  choose("Worn armor", "plate");
  choose("Wielded shield", "shield");
  choose("Main hand", "longsword-1");
  // A longsword +1 is not a dual-wield weapon, so the off hand is not offered.
  expect(document.querySelector('[aria-label="Off hand"]')).toBeNull();
  fireEvent.click(labelled("Attuned: Amulet of Health"));

  const built = engine().evaluate(entity()).built;
  expect(built["worn-armor"]).toBe("plate");
  expect(built["main-hand-weapon"]).toBe("longsword-1");
  expect(built["off-hand-weapon"]).toBe("none");
  expect(built["attuned-magic-items"]).toEqual(["amulet-of-health"]);
  expect(sheet().armorClass).toBe(20);
  expect(sheet().maxHitPoints).toBe(204);
  expect(sheet().weaponAttacks.find((w) => w.key === "longsword-1")).toMatchObject({ attackBonus: 12, damageModifier: 6 });

  // Quantity and Remove.
  choose("Quantity: Plate", "2");
  expect(engine().evaluate(entity()).built.armor!.plate["orcpub.dnd.e5.character.equipment/quantity"]).toBe(2);
  fireEvent.click(screen.getByText("Remove Plate"));
  expect(engine().evaluate(entity()).built.armor!.plate).toBeUndefined();
  // Each change renders the four long item lists again, which jsdom is slow at.
}, 20_000);

test("a custom item is added, renamed, counted and removed", () => {
  open(engine().emptyCharacter());
  const treasure = region("Treasure");
  fireEvent.click(treasure.getByRole("button", { name: "Add custom item" }));
  fireEvent.change(treasure.getByLabelText("Custom item 1 name"), { target: { value: "Ruby" } });
  fireEvent.change(treasure.getByLabelText("Quantity: Ruby"), { target: { value: "3" } });
  fireEvent.click(treasure.getByLabelText("Carried: Ruby"));
  expect(customItems(entity(), "custom-treasure")).toEqual([{ name: "Ruby", quantity: 3, equipped: false, starting: false }]);
  fireEvent.click(treasure.getByRole("button", { name: "Remove Ruby" }));
  expect(customItems(entity(), "custom-treasure")).toEqual([]);
});

test("no more than 3 magic items are attuned at once", () => {
  open(engine().emptyCharacter());
  // Removing an item that is not attuned does not store the attuned items.
  fireEvent.click(screen.getByText("Remove Explorer's Pack"));
  expect(JSON.stringify(entity())).not.toContain("attuned-magic-items");
  for (const key of ["amulet-of-health", "cloak-of-protection", "ring-of-protection", "bag-of-holding"]) {
    choose("Add an item to Other Magic Items", key);
  }
  for (const name of ["Amulet of Health", "Cloak of Protection", "Ring of Protection"]) fireEvent.click(labelled(`Attuned: ${name}`));
  const bag = labelled("Attuned: Bag of Holding");
  expect(bag.disabled).toBe(true);
  fireEvent.click(labelled("Attuned: Ring of Protection"));
  expect(bag.disabled).toBe(false);
  // A removed item is no longer attuned, so it frees its place.
  fireEvent.click(labelled("Attuned: Ring of Protection"));
  expect(labelled("Attuned: Bag of Holding").disabled).toBe(true);
  fireEvent.click(screen.getByText("Remove Amulet of Health"));
  expect(attunedItems(entity())).toEqual(["cloak-of-protection", "ring-of-protection"]);
  expect(labelled("Attuned: Bag of Holding").disabled).toBe(false);
});

test("an imported magic item is offered, and wearing it changes the build", async () => {
  const edn = readFileSync(join(charactersDir, "../magic-items/custom-items.edn"), "utf8");
  await useHomebrew.getState().loadMagicItems(engine().readServerEdn(edn));
  try {
    open(unequippedFighter20());
    const built = () => engine().evaluate(entity(), useHomebrew.getState().content).built;
    const wis = built().abilities["orcpub.dnd.e5.character/wis"];
    choose("Add an item to Other Magic Items", "circlet-of-the-hawk");
    fireEvent.click(labelled("Attuned: Circlet of the Hawk"));
    expect(built().abilities["orcpub.dnd.e5.character/wis"]).toBe(wis + 2);

    choose("Add an item to Magic Armor", "wardens-plate");
    choose("Worn armor", "wardens-plate");
    expect(built()["worn-armor"]).toBe("wardens-plate");
    // Plate is 18, and Warden's Plate adds 2.
    expect(toSheet(built(), entity()).armorClass).toBe(20);
  } finally {
    for (const { id } of useHomebrew.getState().magicItems) await useHomebrew.getState().removeMagicItem(id);
  }
}, 20_000);
