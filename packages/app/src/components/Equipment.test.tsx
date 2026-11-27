import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { notBusy, pickFromPicker, pickOption } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { attunedItems, customItems } from "../engine/equipment.ts";
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
const labelled = (label: string) => document.querySelector<HTMLElement>(`[aria-label="${label}"]`)!;
const type = (label: string, value: string) => fireEvent.change(labelled(label), { target: { value } });
const choose = (label: string, name: string) => pickOption(labelled(label), name);
const addItems = () => screen.getByRole("button", { name: /^Add items/ });
/** Adds the items with the one "Add items" list modal of the step (ORC-373). */
const add = (...names: string[]) => pickFromPicker(addItems(), names);

test("a starting equipment selection has the control of its rule: option cards to 6 options, then a Choose button (ORC-352)", async () => {
  open(engine().emptyCharacter());
  // The barbarian's martial weapon: 3 options, so option cards, with the source in the name and the left mark.
  const weapon = region("Starting Equipment: Martial Weapon");
  expect(weapon.getByRole("heading").textContent).toBe("Starting Equipment: Martial Weapon,1 left");
  expect(weapon.getAllByRole("button").map((b) => b.textContent)).toEqual(["<none>", "Any Martial Weapon", "Greataxe"]);
  fireEvent.click(weapon.getByRole("button", { name: "Any Martial Weapon" }));
  await notBusy();
  // The pick opens a flat section below it: one pick of more than 6 options, a Choose button.
  const any = screen.getAllByRole("region", { name: /^Starting Equipment: Martial Weapon/ })[1];
  expect(
    within(any)
      .getByRole("button", { name: /^Choose / })
      .getAttribute("aria-haspopup"),
  ).toBe("dialog");
  // The inventory lists do not change: they have no mark.
  expect(region("Armor").getByRole("heading").textContent).toBe("Armor");
});

test("fighter-20 equipped through the Equipment step has its AC, hit points and attacks", async () => {
  open(unequippedFighter20());
  expect(sheet().armorClass).toBe(18);
  await add("Plate", "Longsword +1", "Amulet of Health");
  expect(labelled("Carried: Plate")).toBeChecked();
  await choose("Worn armor", "Plate");
  await choose("Wielded shield", "Shield");
  await choose("Main hand", "Longsword +1");
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
  type("Quantity: Plate", "2");
  expect(engine().evaluate(entity()).built.armor!.plate["orcpub.dnd.e5.character.equipment/quantity"]).toBe(2);
  fireEvent.click(screen.getByText("Remove Plate"));
  expect(engine().evaluate(entity()).built.armor!.plate).toBeUndefined();
  // Each change renders the four long item lists again, which jsdom is slow at.
}, 20_000);

test("one Add items modal has a group for each inventory list and a search; a pick goes to its own list and leaves the modal (ORC-373)", async () => {
  open(engine().emptyCharacter());
  // The lists have no add control of their own.
  expect(screen.getAllByRole("button", { name: /^Add items/ })).toHaveLength(1);
  expect(document.querySelector('[aria-label^="Add an item"]')).toBeNull();
  fireEvent.click(addItems());
  const dialog = within(await screen.findByRole("dialog", { name: "Add items" }));
  const groups = () =>
    dialog
      .getAllByRole("list")
      .map((list) => list.getAttribute("aria-labelledby") && document.getElementById(list.getAttribute("aria-labelledby")!)!.textContent);
  // In the order of the lists on the step.
  // The page is inert under the modal, so the headings are found in the DOM, not by role.
  const lists = [...document.querySelectorAll("section h3")].map((h) => h.textContent);
  expect(groups()).toEqual(["Armor", "Equipment", "Magic Armor", "Magic Weapons", "Other Magic Items", "Treasure", "Weapons"]);
  expect(lists.filter((name) => groups().includes(name!))).toEqual(groups());
  // The search filters the rows of all the groups.
  fireEvent.change(dialog.getByRole("searchbox"), { target: { value: "Longsword" } });
  expect(groups()).toEqual(["Magic Weapons", "Weapons"]);
  fireEvent.click(within(dialog.getAllByRole("list")[1]).getByRole("button", { name: "Longsword" }));
  // The row is busy while its pick is on its way, then it leaves the modal, which stays open.
  expect(within(dialog.getAllByRole("list")[1]).getByRole("button", { name: "Longsword" })).toHaveAttribute("aria-busy", "true");
  await notBusy();
  // Longsword was the one row of Weapons, so the group goes too.
  expect(groups()).toEqual(["Magic Weapons"]);
  expect(dialog.getByRole("status").textContent).toBe("1 added");
  fireEvent.click(dialog.getByRole("button", { name: "Done" }));
  expect(region("Weapons").getByText("Longsword")).toBeTruthy();
  expect(region("Magic Weapons").queryByText("Longsword")).toBeNull();
}, 20_000);

test("a custom item is added, renamed, counted and removed", () => {
  open(engine().emptyCharacter());
  const treasure = region("Treasure");
  fireEvent.click(treasure.getByRole("button", { name: "Add custom item" }));
  fireEvent.change(treasure.getByLabelText("Custom item 1 name"), { target: { value: "Ruby" } });
  fireEvent.change(treasure.getByLabelText("Quantity: Ruby"), { target: { value: "3" } });
  fireEvent.click(treasure.getByRole("checkbox", { name: "Carried: Ruby" }));
  expect(customItems(entity(), "custom-treasure")).toEqual([{ name: "Ruby", quantity: 3, equipped: false, starting: false }]);
  fireEvent.click(treasure.getByRole("button", { name: "Remove Ruby" }));
  expect(customItems(entity(), "custom-treasure")).toEqual([]);
});

test("no more than 3 magic items are attuned at once", async () => {
  open(engine().emptyCharacter());
  // Removing an item that is not attuned does not store the attuned items.
  fireEvent.click(screen.getByText("Remove Explorer's Pack"));
  expect(JSON.stringify(entity())).not.toContain("attuned-magic-items");
  await add("Amulet of Health", "Cloak of Protection", "Ring of Protection", "Bag of Holding");
  for (const name of ["Amulet of Health", "Cloak of Protection", "Ring of Protection"]) fireEvent.click(labelled(`Attuned: ${name}`));
  const bag = labelled("Attuned: Bag of Holding");
  expect(bag).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(labelled("Attuned: Ring of Protection"));
  expect(bag).not.toHaveAttribute("aria-disabled", "true");
  // A removed item is no longer attuned, so it frees its place.
  fireEvent.click(labelled("Attuned: Ring of Protection"));
  expect(labelled("Attuned: Bag of Holding")).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(screen.getByText("Remove Amulet of Health"));
  expect(attunedItems(entity())).toEqual(["cloak-of-protection", "ring-of-protection"]);
  expect(labelled("Attuned: Bag of Holding")).not.toHaveAttribute("aria-disabled", "true");
});

test("an imported magic item is offered, and wearing it changes the build", async () => {
  const edn = readFileSync(join(charactersDir, "../magic-items/custom-items.edn"), "utf8");
  await useHomebrew.getState().loadMagicItems(engine().readServerEdn(edn));
  try {
    open(unequippedFighter20());
    const built = () => engine().evaluate(entity(), useHomebrew.getState().content).built;
    const wis = built().abilities["orcpub.dnd.e5.character/wis"];
    await add("Circlet of the Hawk");
    fireEvent.click(labelled("Attuned: Circlet of the Hawk"));
    expect(built().abilities["orcpub.dnd.e5.character/wis"]).toBe(wis + 2);

    await add("Warden's Plate");
    await choose("Worn armor", "Warden's Plate");
    expect(built()["worn-armor"]).toBe("wardens-plate");
    // Plate is 18, and Warden's Plate adds 2.
    expect(toSheet(built(), entity()).armorClass).toBe(20);
  } finally {
    for (const { id } of useHomebrew.getState().magicItems) await useHomebrew.getState().removeMagicItem(id);
  }
}, 20_000);
