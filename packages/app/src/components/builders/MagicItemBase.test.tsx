// The tests of the base weapon or armor section of the magic item form (MagicItemBase.tsx).
import "fake-indexeddb/auto";
import { optionNames, pickOption } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine } from "../../engine/engine.ts";
import { useCharacter } from "../../state/character.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { Builder } from "../Builder.tsx";
import { form, group, MI, renderAt, resetHomebrew, save, stored, type, W } from "./test-magic-item.tsx";
import { addList, choose, pick, shown, tokens, unpick } from "./test-picks.ts";

beforeAll(() => loadEngine());

afterEach(resetHomebrew);

test("a weapon stores its base weapons, and Any replaces the others", async () => {
  renderAt("/content/new/magicItem");
  await form("New magic item");
  type("Name", "Flame Blade");
  await choose("Type", "Weapon");
  // A new weapon has no base weapon: Specific, with no picks.
  expect(shown("Base weapon")).toBe("Specific");
  await pick("Base weapon", "Add a base weapon", "Longsword");
  await choose("Base weapon", "Any");
  expect(screen.queryByRole("button", { name: "Add a base weapon" })).toBeNull();
  await choose("Base weapon", "Specific");
  expect(tokens("Base weapon")).toEqual([]);
  // The tokens are in the order of the list.
  await pick("Base weapon", "Add a base weapon", ["Scimitar", "Longsword"]);
  expect(tokens("Base weapon")).toEqual(["Longsword", "Scimitar"]);
  type("Magical attack bonus", "1");
  type("Magical damage bonus", "1");
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  const item = stored("flame-blade")!.item as Record<string, unknown>;
  // In the order of the picks, as the old checkboxes stored them.
  expect(item[`${MI}subtypes`]).toEqual(["~:scimitar", "~:longsword"]);
  expect(item[`${MI}magical-attack-bonus`]).toBe(1);
  expect(item[`${MI}magical-damage-bonus`]).toBe(1);

  // The engine expands it into one magic weapon for each base weapon.
  cleanup();
  useCharacter.getState().load("homebrew-magic-weapon", engine().emptyCharacter());
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Equipment/ }));
  const add = document.querySelector<HTMLElement>('[aria-label="Add an item to Magic Weapons"]')!;
  expect((await optionNames(add)).filter((name) => name.startsWith("Flame Blade"))).toHaveLength(2);
}, 20_000);

test("the base select has Any, Specific and New weapon; the specific list has the kinds, then the weapons by name, with search", async () => {
  renderAt("/content/new/magicItem");
  await form("New magic item");
  await choose("Type", "Weapon");
  expect(await optionNames(screen.getByRole("combobox", { name: "Base weapon" }))).toEqual(["Any", "Specific", "New weapon"]);
  const add = await group("Base weapon").findByRole("button", { name: "Add a base weapon" });
  const names = await addList(add, "Add a base weapon");
  expect(names.slice(0, 5)).toEqual(["All Swords", "All Axes", "Battleaxe", "Blowgun", "Club"]);
  expect(names).toHaveLength(42);
  expect(names.at(-1)).toBe("Whip");
  fireEvent.click(add);
  expect(within(await screen.findByRole("dialog")).getByRole("searchbox")).toBeTruthy();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  // Armor has no New weapon, and its short list has no search.
  await choose("Type", "Armor");
  expect(await optionNames(screen.getByRole("combobox", { name: "Base armor" }))).toEqual(["Any", "Specific"]);
  const armor = await addList(group("Base armor").getByRole("button", { name: "Add a base armor" }), "Add a base armor");
  expect(armor.slice(0, 4)).toEqual(["All light", "All medium", "All heavy", "Shield"]);
  expect(armor).toHaveLength(17);
  fireEvent.click(group("Base armor").getByRole("button", { name: "Add a base armor" }));
  expect(within(await screen.findByRole("dialog")).queryByRole("searchbox")).toBeNull();
});

test("a Custom base weapon stores the old details, and another base weapon removes them", async () => {
  renderAt("/content/new/magicItem");
  await form("New magic item");
  type("Name", "Bone Club");
  await choose("Type", "Weapon");
  await pick("Base weapon", "Add a base weapon", "Longsword");
  expect(screen.queryByRole("group", { name: "Base weapon details" })).toBeNull();
  await choose("Base weapon", "New weapon");
  expect(screen.queryByRole("button", { name: "Add a base weapon" })).toBeNull();
  // The old first details (magic_items.cljc apply-subtype-toggle).
  const details = group("Base weapon details");
  const detail = (label: string) => details.getByRole("combobox", { name: label }).textContent;
  expect(["Damage die number", "Damage die", "Simple / martial", "Melee / ranged", "Damage type"].map(detail)).toEqual([
    "1",
    "d4",
    "Simple",
    "Melee",
    "bludgeoning",
  ]);
  expect(details.queryByLabelText("Range min")).toBeNull();
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  const defaults = {
    [`${MI}name`]: "Bone Club",
    [`${MI}type`]: "~:weapon",
    [`${MI}rarity`]: "~:common",
    [`${MI}subtypes`]: ["~:other"],
    [`${W}damage-die-count`]: 1,
    [`${W}damage-die`]: 4,
    [`${W}type`]: "~:simple",
    [`${W}damage-type`]: "~:bludgeoning",
    [`${W}melee?`]: true,
    [`${W}ranged?`]: false,
  };
  expect(stored("bone-club")!.item).toEqual(defaults);

  // Each detail is stored as the old events stored it (events.cljs ::mi/toggle-item-..., ::mi/set-item-...).
  fireEvent.click(screen.getByRole("link", { name: "Edit Bone Club" }));
  await form("Edit magic item");
  const edit = group("Base weapon details");
  fireEvent.click(edit.getByRole("checkbox", { name: "Finesse?" }));
  fireEvent.click(edit.getByRole("checkbox", { name: "Two-Handed?" }));
  fireEvent.click(edit.getByRole("checkbox", { name: "Thrown?" }));
  fireEvent.click(edit.getByRole("checkbox", { name: "Thrown?" }));
  fireEvent.click(edit.getByRole("checkbox", { name: "Versatile?" }));
  await pickOption(edit.getByRole("combobox", { name: "Versatile damage die" }), "d10");
  await pickOption(edit.getByRole("combobox", { name: "Damage die number" }), "2");
  await pickOption(edit.getByRole("combobox", { name: "Damage die" }), "d6");
  await pickOption(edit.getByRole("combobox", { name: "Simple / martial" }), "Martial");
  await pickOption(edit.getByRole("combobox", { name: "Damage type" }), "piercing");
  await pickOption(edit.getByRole("combobox", { name: "Melee / ranged" }), "Ranged");
  fireEvent.change(edit.getByLabelText("Range min"), { target: { value: "20" } });
  fireEvent.change(edit.getByLabelText("Range max"), { target: { value: "60" } });
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(stored("bone-club")!.item).toEqual({
    ...defaults,
    [`${W}finesse?`]: true,
    [`${W}two-handed?`]: true,
    [`${W}thrown?`]: false,
    [`${W}versatile`]: { [`${W}damage-die`]: 10 },
    [`${W}damage-die-count`]: 2,
    [`${W}damage-die`]: 6,
    [`${W}type`]: "~:martial",
    [`${W}damage-type`]: "~:piercing",
    [`${W}melee?`]: false,
    [`${W}ranged?`]: true,
    [`${W}range`]: { [`${W}min`]: 20, [`${W}max`]: 60 },
  });
  expect(engine().validate.magicItem(stored("bone-club")!.item).ok).toBe(true);

  // The engine offers the item under its own key, with no base weapon.
  cleanup();
  useCharacter.getState().load("homebrew-custom-weapon", engine().emptyCharacter());
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Equipment/ }));
  expect(await optionNames(document.querySelector<HTMLElement>('[aria-label="Add an item to Magic Weapons"]')!)).toContain("Bone Club");
  cleanup();

  // As the old save, Versatile without its dice is not stored. All, or a base weapon, removes the details.
  renderAt("/content/edit/magicItem/bone-club");
  await form("Edit magic item");
  fireEvent.click(group("Base weapon details").getByRole("checkbox", { name: "Versatile?" }));
  fireEvent.click(group("Base weapon details").getByRole("checkbox", { name: "Versatile?" }));
  expect(group("Base weapon details").getByRole("checkbox", { name: "Versatile?" })).toBeChecked();
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(stored("bone-club")!.item).not.toHaveProperty([`${W}versatile`]);

  for (const [choice, subtypes] of [
    ["Any", ["~:all"]],
    ["Club", ["~:club"]],
  ] as const) {
    await useHomebrew.getState().loadMagicItems([{ ...defaults, [`${W}finesse?`]: true, [`${W}range`]: { [`${W}min`]: 20 } }]);
    cleanup();
    renderAt("/content/edit/magicItem/bone-club");
    await form("Edit magic item");
    expect(shown("Base weapon")).toBe("New weapon");
    if (choice === "Any") await choose("Base weapon", "Any");
    else {
      await choose("Base weapon", "Specific");
      await pick("Base weapon", "Add a base weapon", choice);
    }
    expect(screen.queryByRole("group", { name: "Base weapon details" })).toBeNull();
    fireEvent.click(save());
    await screen.findByRole("heading", { name: "My Content" });
    expect(stored("bone-club")!.item).toEqual({
      [`${MI}name`]: "Bone Club",
      [`${MI}type`]: "~:weapon",
      [`${MI}rarity`]: "~:common",
      [`${MI}subtypes`]: subtypes,
    });
  }
}, 30_000);

test("Specific from Any or New weapon stores what the old app stored for a base weapon picked and then removed", async () => {
  const defaults = {
    [`${W}damage-die-count`]: 1,
    [`${W}damage-die`]: 4,
    [`${W}type`]: "~:simple",
    [`${W}damage-type`]: "~:bludgeoning",
    [`${W}melee?`]: true,
    [`${W}ranged?`]: false,
  };
  const base = { [`${MI}name`]: "Old Blade", [`${MI}type`]: "~:weapon", [`${MI}rarity`]: "~:rare" };
  for (const before of [{ [`${MI}subtypes`]: ["~:all"] }, { [`${MI}subtypes`]: ["~:other"], ...defaults, [`${W}reach?`]: true }]) {
    await useHomebrew.getState().loadMagicItems([{ ...base, ...before }]);
    renderAt("/content/edit/magicItem/old-blade");
    await form("Edit magic item");
    await choose("Base weapon", "Specific");
    fireEvent.click(save());
    await screen.findByRole("heading", { name: "My Content" });
    expect(stored("old-blade")!.item).toEqual(base);
    cleanup();
  }
  // New weapon stores the old first details, as the old Custom checkbox.
  await useHomebrew.getState().loadMagicItems([{ ...base, [`${MI}subtypes`]: ["~:longsword"] }]);
  renderAt("/content/edit/magicItem/old-blade");
  await form("Edit magic item");
  await choose("Base weapon", "New weapon");
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(stored("old-blade")!.item).toEqual({ ...base, [`${MI}subtypes`]: ["~:other"], ...defaults });
});

test("on armor, a stored :other is a token, and its X removes only it: no New weapon details", async () => {
  const item = { [`${MI}name`]: "Odd Mail", [`${MI}type`]: "~:armor", [`${MI}rarity`]: "~:rare", [`${MI}subtypes`]: ["~:other", "~:plate"] };
  await useHomebrew.getState().loadMagicItems([item]);
  renderAt("/content/edit/magicItem/odd-mail");
  await form("Edit magic item");
  expect(shown("Base armor")).toBe("Specific");
  expect(tokens("Base armor")).toEqual(["Plate", "other"]);
  await unpick("Base armor", "other");
  expect(tokens("Base armor")).toEqual(["Plate"]);
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(stored("odd-mail")!.item).toEqual({ ...item, [`${MI}subtypes`]: ["~:plate"] });
});
