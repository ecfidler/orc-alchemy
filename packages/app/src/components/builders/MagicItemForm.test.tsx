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
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
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

/** Waits for the form and its fields, which show when the content lists are read. */
async function form(name: string) {
  await screen.findByRole("form", { name });
  await screen.findByLabelText("Rarity");
}
const save = () => screen.getByRole<HTMLButtonElement>("button", { name: "Save" });
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const group = (name: string) => within(screen.getByRole("group", { name }));
const stored = (key: string) => useHomebrew.getState().magicItems.find((r) => r.id === key);
const MI = "~:orcpub.dnd.e5.magic-items/";
const W = "~:orcpub.dnd.e5.weapons/";

/** Fills the new magic item form with Hawk Eye Circlet: attuned, WIS +2, fire resistance. */
async function authorCirclet() {
  const router = renderAt("/content/new/magicItem");
  await form("New magic item");
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
  await form("New magic item");
  expect(screen.queryByLabelText("Option source (pack)")).toBeNull();
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
  await form("Edit magic item");
  expect(screen.queryByLabelText("Option source (pack)")).toBeNull();
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
  await form("Edit magic item");
  type("Name", "Falcon Circlet");
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(useHomebrew.getState().magicItems.map((r) => [r.id, r.enabled])).toEqual([["falcon-circlet", false]]);
});

test("a new or renamed item may not take the key of another stored item; an edit under its own key may", async () => {
  await authorCirclet();
  await useHomebrew.getState().loadMagicItems([{ [`${MI}name`]: "Ring of Warmth", [`${MI}type`]: "~:ring", [`${MI}rarity`]: "~:common" }]);
  const taken = (name: string) => `A magic item named ${name} already exists. Change the name.`;

  fireEvent.click(screen.getByRole("link", { name: "New magic item" }));
  await form("New magic item");
  type("Name", "Hawk Eye Circlet");
  expect(screen.getByRole("list", { name: "Problems: Name" }).textContent).toBe(taken("Hawk Eye Circlet"));
  expect(save().disabled).toBe(true);
  type("Name", "Owl Circlet");
  expect(save().disabled).toBe(false);
  cleanup();

  renderAt("/content/edit/magicItem/hawk-eye-circlet");
  await form("Edit magic item");
  expect(screen.queryByRole("list", { name: "Problems: Name" })).toBeNull();
  expect(save().disabled).toBe(false);
  type("Name", "Ring of Warmth");
  expect(screen.getByRole("list", { name: "Problems: Name" }).textContent).toBe(taken("Ring of Warmth"));
  expect(save().disabled).toBe(true);
  expect(stored("ring-of-warmth")!.item).toMatchObject({ [`${MI}type`]: "~:ring" });
});

test("an edit of a magic item that is not stored says so", async () => {
  renderAt("/content/edit/magicItem/nothing");
  expect(await screen.findByRole("heading", { name: "There is no magic item nothing" })).toBeTruthy();
});

test("a weapon stores its base weapons, and All replaces the others", async () => {
  renderAt("/content/new/magicItem");
  await form("New magic item");
  type("Name", "Flame Blade");
  type("Type", "weapon");
  const base = group("Base weapon");
  fireEvent.click(await base.findByLabelText("Longsword"));
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

test("the base weapons are Custom, the All choices, then the weapons by name, as the old list", async () => {
  renderAt("/content/new/magicItem");
  await form("New magic item");
  type("Type", "weapon");
  const base = group("Base weapon");
  await base.findByLabelText("Longsword");
  const names = base.getAllByRole("checkbox").map((box) => box.parentElement!.textContent!.trim());
  expect(names.slice(0, 7)).toEqual(["Custom", "All", "All Swords", "All Axes", "Battleaxe", "Blowgun", "Club"]);
  expect(names).toHaveLength(44);
  expect(names.at(-1)).toBe("Whip");
});

test("the attunement classes include a class of an enabled pack", async () => {
  await useHomebrew.getState().saveItem("Tinkers", "~:orcpub.dnd.e5/classes", { "~:key": "~:artificer", "~:name": "Artificer", "~:option-pack": "Tinkers" });
  renderAt("/content/new/magicItem");
  await form("New magic item");
  type("Name", "Spanner of Power");
  fireEvent.click(screen.getByLabelText("Requires attunement"));
  const attunement = group("Attunement");
  fireEvent.click(await attunement.findByLabelText("Artificer (Tinkers)"));
  expect(attunement.getByLabelText("Spellcaster")).toBeTruthy();
  expect(attunement.getByLabelText("Wizard")).toBeTruthy();
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect((stored("spanner-of-power")!.item as Record<string, unknown>)[`${MI}attunement`]).toEqual(["~:artificer"]);
});

test("a Custom base weapon stores the old details, and another base weapon removes them", async () => {
  renderAt("/content/new/magicItem");
  await form("New magic item");
  type("Name", "Bone Club");
  type("Type", "weapon");
  const base = group("Base weapon");
  fireEvent.click(await base.findByLabelText("Longsword"));
  expect(screen.queryByRole("group", { name: "Base weapon details" })).toBeNull();
  fireEvent.click(base.getByLabelText("Custom"));
  expect(base.getByLabelText<HTMLInputElement>("Longsword").checked).toBe(false);
  // The old first details (magic_items.cljc apply-subtype-toggle).
  const details = group("Base weapon details");
  expect(details.getByLabelText<HTMLSelectElement>("Damage die number").value).toBe("1");
  expect(details.getByLabelText<HTMLSelectElement>("Damage die").value).toBe("4");
  expect(details.getByLabelText<HTMLSelectElement>("Simple / martial").value).toBe("~:simple");
  expect(details.getByLabelText<HTMLSelectElement>("Melee / ranged").value).toBe("melee");
  expect(details.getByLabelText<HTMLSelectElement>("Damage type").value).toBe("~:bludgeoning");
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
  fireEvent.click(edit.getByLabelText("Finesse?"));
  fireEvent.click(edit.getByLabelText("Two-Handed?"));
  fireEvent.click(edit.getByLabelText("Thrown?"));
  fireEvent.click(edit.getByLabelText("Thrown?"));
  fireEvent.click(edit.getByLabelText("Versatile?"));
  fireEvent.change(edit.getByLabelText("Versatile damage die"), { target: { value: "10" } });
  fireEvent.change(edit.getByLabelText("Damage die number"), { target: { value: "2" } });
  fireEvent.change(edit.getByLabelText("Damage die"), { target: { value: "6" } });
  fireEvent.change(edit.getByLabelText("Simple / martial"), { target: { value: "~:martial" } });
  fireEvent.change(edit.getByLabelText("Damage type"), { target: { value: "~:piercing" } });
  fireEvent.change(edit.getByLabelText("Melee / ranged"), { target: { value: "ranged" } });
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
  const add = document.querySelector<HTMLSelectElement>('[aria-label="Add an item to Magic Weapons"]')!;
  expect(add.querySelector('option[value="bone-club"]')).not.toBeNull();
  cleanup();

  // As the old save, Versatile without its dice is not stored. All, or a base weapon, removes the details.
  renderAt("/content/edit/magicItem/bone-club");
  await form("Edit magic item");
  fireEvent.click(group("Base weapon details").getByLabelText("Versatile?"));
  fireEvent.click(group("Base weapon details").getByLabelText("Versatile?"));
  expect(group("Base weapon details").getByLabelText<HTMLInputElement>("Versatile?").checked).toBe(true);
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(stored("bone-club")!.item).not.toHaveProperty([`${W}versatile`]);

  for (const [choice, subtypes] of [
    ["All", ["~:all"]],
    ["Club", ["~:club"]],
  ] as const) {
    await useHomebrew.getState().loadMagicItems([{ ...defaults, [`${W}finesse?`]: true, [`${W}range`]: { [`${W}min`]: 20 } }]);
    cleanup();
    renderAt("/content/edit/magicItem/bone-club");
    await form("Edit magic item");
    fireEvent.click(await group("Base weapon").findByLabelText(choice));
    expect(screen.queryByRole("group", { name: "Base weapon details" })).toBeNull();
    fireEvent.click(save());
    await screen.findByRole("heading", { name: "My Content" });
    expect(stored("bone-club")!.item).toEqual({ [`${MI}name`]: "Bone Club", [`${MI}type`]: "~:weapon", [`${MI}rarity`]: "~:common", [`${MI}subtypes`]: subtypes });
  }
}, 30_000);
