import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine } from "../../engine/engine.ts";
import { useCharacter } from "../../state/character.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { listMagicItems, type MagicItemRecord } from "../../storage/packs.ts";
import { Builder } from "../Builder.tsx";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";
import { MyContent } from "../MyContent.tsx";

beforeAll(() => loadEngine());

afterEach(async () => {
  cleanup();
  for (const { id } of useHomebrew.getState().magicItems) await useHomebrew.getState().removeMagicItem(id);
});

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/content", element: <MyContent /> },
      { path: "/content/new/:type", element: <HomebrewBuilder /> },
      { path: "/content/edit/:type/:key", element: <HomebrewBuilder /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const save = () => screen.getByRole<HTMLButtonElement>("button", { name: "Save" });
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const group = (name: string) => within(screen.getByRole("group", { name }));
const stored = (key: string) => useHomebrew.getState().magicItems.find((r) => r.id === key);
const MI = "~:orcpub.dnd.e5.magic-items/";

/** Fills the new magic item form with Hawk Eye Circlet: attuned, WIS +2, fire resistance. */
async function authorCirclet() {
  const router = renderAt("/content/new/magicItem");
  await screen.findByRole("form", { name: "New magic item" });
  type("Name", "Hawk Eye Circlet");
  type("Rarity", "uncommon");
  type("Description", "Your Wisdom increases by 2.");
  fireEvent.click(screen.getByLabelText("Requires attunement"));
  type("WIS change", "ability");
  type("WIS value", "2");
  type("Walking speed change", "speed");
  type("Walking speed value", "10");
  fireEvent.click(group("Damage resistances").getByLabelText("Fire"));
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  return router;
}

test("the form has no option source, and Save is off until the item has a name", async () => {
  renderAt("/content/new/magicItem");
  await screen.findByRole("form", { name: "New magic item" });
  expect(screen.queryByLabelText("Option source")).toBeNull();
  expect(save().disabled).toBe(true);
  type("Name", "1 Ring");
  expect(screen.getByRole("list", { name: "Problems: Name" }).textContent).toBe("Name must start with a letter.");
  type("Name", "Ring of Warmth");
  expect(save().disabled).toBe(false);
});

test("Save stores the item, enabled, in the magic items store as the old server stores it", async () => {
  await authorCirclet();
  const record = stored("hawk-eye-circlet")!;
  expect(record.enabled).toBe(true);
  expect(record.item).toEqual({
    [`${MI}name`]: "Hawk Eye Circlet",
    [`${MI}type`]: "~:wondrous-item",
    [`${MI}rarity`]: "~:uncommon",
    [`${MI}description`]: "Your Wisdom increases by 2.",
    [`${MI}attunement`]: ["~:any"],
    [`${MI}modifiers`]: [
      {
        "~:orcpub.modifiers/key": "~:ability",
        "~:orcpub.modifiers/args": [{ "~:orcpub.modifiers/keyword-arg": "~:orcpub.dnd.e5.character/wis" }, { "~:orcpub.modifiers/int-arg": 2 }],
      },
      { "~:orcpub.modifiers/key": "~:speed", "~:orcpub.modifiers/args": [{ "~:orcpub.modifiers/int-arg": 10 }] },
      { "~:orcpub.modifiers/key": "~:damage-resistance", "~:orcpub.modifiers/args": [{ "~:orcpub.modifiers/keyword-arg": "~:fire" }] },
    ],
  });
  expect(((await listMagicItems()) as MagicItemRecord[]).map((r) => r.id)).toEqual(["hawk-eye-circlet"]);
  // My Content lists it with an Edit link.
  expect(screen.getByRole("link", { name: "Edit Hawk Eye Circlet" }).getAttribute("href")).toBe("/content/edit/magicItem/hawk-eye-circlet");
});

test("Edit loads the stored item; a save keeps the enabled flag, and a rename replaces the old key", async () => {
  await authorCirclet();
  await useHomebrew.getState().setMagicItemEnabled("hawk-eye-circlet", false);
  fireEvent.click(screen.getByRole("link", { name: "Edit Hawk Eye Circlet" }));
  await screen.findByRole("form", { name: "Edit magic item" });
  expect(screen.queryByLabelText("Option source")).toBeNull();
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Hawk Eye Circlet");
  expect(screen.getByLabelText<HTMLSelectElement>("WIS change").value).toBe("ability");
  expect(screen.getByLabelText<HTMLInputElement>("WIS value").value).toBe("2");
  expect(group("Damage resistances").getByLabelText<HTMLInputElement>("Fire").checked).toBe(true);

  type("WIS value", "3");
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(stored("hawk-eye-circlet")!.enabled).toBe(false);
  expect(JSON.stringify(stored("hawk-eye-circlet")!.item)).toContain('"~:orcpub.modifiers/int-arg":3');

  fireEvent.click(screen.getByRole("link", { name: "Edit Hawk Eye Circlet" }));
  await screen.findByRole("form", { name: "Edit magic item" });
  type("Name", "Falcon Circlet");
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(useHomebrew.getState().magicItems.map((r) => [r.id, r.enabled])).toEqual([["falcon-circlet", false]]);
});

test("an edit of a magic item that is not stored says so", async () => {
  renderAt("/content/edit/magicItem/nothing");
  expect(await screen.findByRole("heading", { name: "There is no magic item nothing" })).toBeTruthy();
});

test("a weapon stores its base weapons, and All replaces the others", async () => {
  renderAt("/content/new/magicItem");
  await screen.findByRole("form", { name: "New magic item" });
  type("Name", "Flame Blade");
  type("Type", "weapon");
  const base = group("Base weapon");
  fireEvent.click(base.getByLabelText("Longsword"));
  fireEvent.click(base.getByLabelText("All"));
  expect(base.getByLabelText<HTMLInputElement>("Longsword").checked).toBe(false);
  fireEvent.click(base.getByLabelText("Longsword"));
  fireEvent.click(base.getByLabelText("Scimitar"));
  expect(base.getByLabelText<HTMLInputElement>("All").checked).toBe(false);
  type("Magical attack bonus", "1");
  type("Magical damage bonus", "1");
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  const item = stored("flame-blade")!.item as Record<string, unknown>;
  expect(item[`${MI}subtypes`]).toEqual(["~:longsword", "~:scimitar"]);
  expect(item[`${MI}magical-attack-bonus`]).toBe(1);
  expect(item[`${MI}magical-damage-bonus`]).toBe(1);

  // The engine expands it into one magic weapon for each base weapon.
  cleanup();
  useCharacter.getState().load("homebrew-magic-weapon", engine().emptyCharacter());
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Equipment/ }));
  const add = document.querySelector<HTMLSelectElement>('[aria-label="Add an item to Magic Weapons"]')!;
  expect([...add.options].map((o) => o.value).filter((v) => v.startsWith("flame-blade"))).toEqual(["flame-blade-longsword", "flame-blade-scimitar"]);
}, 20_000);

// The done-when of ORC-128: an item made in the form is in My Content, and a character can equip it.
test("a magic item authored in the form is offered in the Equipment step, and attuning it applies its modifier", async () => {
  await authorCirclet();
  expect(within(screen.getByRole("region", { name: "Magic items" })).getByLabelText("Hawk Eye Circlet")).toBeTruthy();
  cleanup();

  const e = engine();
  useCharacter.getState().load("homebrew-magic-item", e.emptyCharacter());
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Equipment/ }));
  const entity = () => useCharacter.getState().entity!;
  const built = () => e.evaluate(entity(), useHomebrew.getState().content).built;
  const wis = built().abilities["orcpub.dnd.e5.character/wis"];
  const add = document.querySelector<HTMLSelectElement>('[aria-label="Add an item to Other Magic Items"]')!;
  expect(add.querySelector('option[value="hawk-eye-circlet"]')).not.toBeNull();
  fireEvent.change(add, { target: { value: "hawk-eye-circlet" } });
  fireEvent.click(document.querySelector<HTMLInputElement>('[aria-label="Attuned: Hawk Eye Circlet"]')!);
  await waitFor(() => expect(built().abilities["orcpub.dnd.e5.character/wis"]).toBe(wis + 2));
}, 20_000);
