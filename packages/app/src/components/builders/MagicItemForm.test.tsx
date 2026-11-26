import "fake-indexeddb/auto";
import { pickOption } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine } from "../../engine/engine.ts";
import { useCharacter } from "../../state/character.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { listMagicItems, type MagicItemRecord } from "../../storage/packs.ts";
import { Builder } from "../Builder.tsx";
import { form, group, MI, renderAt, resetHomebrew, save, stored, type, W } from "./test-magic-item.tsx";
import { addList, addModifier, choose, groups, pick, shown, tokens, unpick } from "./test-picks.ts";

beforeAll(() => loadEngine());

afterEach(resetHomebrew);

/** The modifiers of the add list, in form order. */
const ADDED = [
  "Ability scores",
  "Saving throw bonus",
  "Speed bonus",
  "Damage resistances",
  "Damage vulnerabilities",
  "Damage immunities",
  "Condition immunities",
];
/** A stored modifier entry, as the old save stores it: keyword args, then int args. */
const mod = (key: string, keywords: string[] = [], ints: number[] = []) => ({
  "~:orcpub.modifiers/key": `~:${key}`,
  ...(keywords.length + ints.length > 0 && {
    "~:orcpub.modifiers/args": [
      ...keywords.map((k) => ({ "~:orcpub.modifiers/keyword-arg": `~:${k}` })),
      ...ints.map((n) => ({ "~:orcpub.modifiers/int-arg": n })),
    ],
  }),
});
const wis = (n: number) => mod("ability", ["orcpub.dnd.e5.character/wis"], [n]);

/** Fills the new magic item form with Hawk Eye Circlet: attuned, WIS +2, fire resistance. */
async function authorCirclet() {
  const router = renderAt("/content/new/magicItem");
  await form("New magic item");
  type("Name", "Hawk Eye Circlet");
  await choose("Rarity", "Uncommon");
  type("Description", "Your Wisdom increases by 2.");
  fireEvent.click(screen.getByRole("checkbox", { name: "Requires attunement" }));
  for (const name of ["Ability scores", "Speed bonus", "Damage resistances"]) await addModifier(name);
  await choose("WIS change", "Increases by");
  type("WIS value", "2");
  await choose("Walking speed change", "Increases by");
  type("Walking speed value", "10");
  await pick("Damage resistances", "Add a damage resistance", "Fire");
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
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe("Hawk Eye Circlet");
  expect(shown("WIS change")).toBe("Increases by");
  expect(screen.getByLabelText<HTMLInputElement>("WIS value").value).toBe("2");
  expect(tokens("Damage resistances")).toEqual(["Fire"]);

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

// The done-when of ORC-128: an item made in the form is in My Content, and a character can equip it.
test("a magic item authored in the form is offered in the Equipment step, and attuning it applies its modifier", async () => {
  await authorCirclet();
  expect(within(screen.getByRole("region", { name: "Magic items" })).getByRole("checkbox", { name: "Hawk Eye Circlet" })).toBeTruthy();
  cleanup();

  const e = engine();
  useCharacter.getState().load("homebrew-magic-item", e.emptyCharacter());
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Equipment/ }));
  const entity = () => useCharacter.getState().entity!;
  const built = () => e.evaluate(entity(), useHomebrew.getState().content).built;
  const wis = built().abilities["orcpub.dnd.e5.character/wis"];
  await pickOption(document.querySelector<HTMLElement>('[aria-label="Add an item to Other Magic Items"]')!, "Hawk Eye Circlet");
  fireEvent.click(document.querySelector<HTMLInputElement>('[aria-label="Attuned: Hawk Eye Circlet"]')!);
  await waitFor(() => expect(built().abilities["orcpub.dnd.e5.character/wis"]).toBe(wis + 2));
}, 20_000);

test("the attunement classes include a class of an enabled pack", async () => {
  await useHomebrew.getState().saveItem("Tinkers", "~:orcpub.dnd.e5/classes", { "~:key": "~:artificer", "~:name": "Artificer", "~:option-pack": "Tinkers" });
  renderAt("/content/new/magicItem");
  await form("New magic item");
  type("Name", "Spanner of Power");
  fireEvent.click(screen.getByRole("checkbox", { name: "Requires attunement" }));
  expect(group("Attunement").getByText("No limits: any creature can attune to it.")).toBeTruthy();
  const names = await addList(group("Attunement").getByRole("button", { name: "Add an attunement limit" }), "Add an attunement limit");
  expect(names.slice(0, 2)).toEqual(["Spellcaster", "Barbarian"]);
  expect(names).toContain("Artificer (Tinkers)");
  expect(names.slice(-11)).toEqual([
    "Good",
    "Evil",
    "Lawful Good",
    "Lawful Neutral",
    "Lawful Evil",
    "Neutral Good",
    "Neutral",
    "Neutral Evil",
    "Chaotic Good",
    "Chaotic Neutral",
    "Chaotic Evil",
  ]);
  await pick("Attunement", "Add an attunement limit", "Artificer (Tinkers)");
  expect(group("Attunement").queryByText("No limits: any creature can attune to it.")).toBeNull();
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect((stored("spanner-of-power")!.item as Record<string, unknown>)[`${MI}attunement`]).toEqual(["~:artificer"]);
});

test("a new item shows only its base groups, and the add list has the modifiers in form order", async () => {
  renderAt("/content/new/magicItem");
  await form("New magic item");
  expect(groups()).toEqual(["Attunement", "Item properties", "Other modifiers"]);
  expect(await addList()).toEqual(ADDED);
  await addModifier("Condition immunities");
  await addModifier("Saving throw bonus");
  expect(groups()).toEqual(["Attunement", "Item properties", "Saving throws", "Condition immunities", "Other modifiers"]);
  expect(await addList()).toEqual(ADDED.filter((name) => name !== "Condition immunities" && name !== "Saving throw bonus"));
});

test("an item opens with each modifier that has an entry, also one with a 0 bonus", async () => {
  const item = {
    [`${MI}name`]: "Plain Ring",
    [`${MI}type`]: "~:ring",
    [`${MI}rarity`]: "~:common",
    [`${MI}modifiers`]: [mod("saving-throw-bonus", ["orcpub.dnd.e5.character/dex"], [0]), mod("condition-immunity", ["charmed"])],
  };
  await useHomebrew.getState().loadMagicItems([item]);
  renderAt("/content/edit/magicItem/plain-ring");
  await form("Edit magic item");
  expect(groups()).toEqual(["Attunement", "Item properties", "Saving throws", "Condition immunities", "Other modifiers"]);
  expect(shown("DEX save change")).toBe("Increases by");
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(stored("plain-ring")!.item).toEqual(item);
});

test("Remove takes out only the modifier's entries, and Undo puts each back in its place", async () => {
  const item = {
    [`${MI}name`]: "Tide Ring",
    [`${MI}type`]: "~:ring",
    [`${MI}rarity`]: "~:rare",
    [`${MI}modifiers`]: [wis(2), mod("damage-resistance", ["fire"]), mod("speed", [], [10]), mod("damage-resistance", ["cold"])],
  };
  await useHomebrew.getState().loadMagicItems([item]);
  renderAt("/content/edit/magicItem/tide-ring");
  await form("Edit magic item");
  expect(groups()).toEqual(["Attunement", "Item properties", "Ability scores", "Speeds", "Damage resistances", "Other modifiers"]);
  fireEvent.click(screen.getByRole("button", { name: "Remove Damage resistances" }));
  expect(screen.queryByRole("group", { name: "Damage resistances" })).toBeNull();
  // Another modifier gets an entry, at the end, before Undo.
  await choose("STR change", "Becomes at least");
  type("STR value", "19");
  fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Undo" }));
  expect(tokens("Damage resistances")).toEqual(["Cold", "Fire"]);
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect((stored("tide-ring")!.item as Record<string, unknown>)[`${MI}modifiers`]).toEqual([
    wis(2),
    mod("damage-resistance", ["fire"]),
    mod("speed", [], [10]),
    mod("damage-resistance", ["cold"]),
    mod("ability-override", ["orcpub.dnd.e5.character/str"], [19]),
  ]);
});

test("Remove of the last entries leaves no modifiers key, and a new entry after Remove comes after the restored ones", async () => {
  const item = { [`${MI}name`]: "Ember Ring", [`${MI}type`]: "~:ring", [`${MI}rarity`]: "~:rare", [`${MI}modifiers`]: [mod("damage-immunity", ["fire"])] };
  await useHomebrew.getState().loadMagicItems([item]);
  renderAt("/content/edit/magicItem/ember-ring");
  await form("Edit magic item");
  fireEvent.click(screen.getByRole("button", { name: "Remove Damage immunities" }));
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(stored("ember-ring")!.item).toEqual({ [`${MI}name`]: "Ember Ring", [`${MI}type`]: "~:ring", [`${MI}rarity`]: "~:rare" });
  cleanup();

  await useHomebrew
    .getState()
    .loadMagicItems([{ ...item, [`${MI}modifiers`]: [mod("damage-immunity", ["fire"]), mod("saving-throw-bonus", ["orcpub.dnd.e5.character/con"], [1])] }]);
  renderAt("/content/edit/magicItem/ember-ring");
  await form("Edit magic item");
  fireEvent.click(screen.getByRole("button", { name: "Remove Damage immunities" }));
  await choose("WIS save change", "Increases by");
  fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Undo" }));
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect((stored("ember-ring")!.item as Record<string, unknown>)[`${MI}modifiers`]).toEqual([
    mod("damage-immunity", ["fire"]),
    mod("saving-throw-bonus", ["orcpub.dnd.e5.character/con"], [1]),
    mod("saving-throw-bonus", ["orcpub.dnd.e5.character/wis"], [0]),
  ]);
});

test("Undo puts an entry back at its index, also after the user changed an earlier entry", async () => {
  const item = {
    [`${MI}name`]: "Wave Ring",
    [`${MI}type`]: "~:ring",
    [`${MI}rarity`]: "~:rare",
    [`${MI}modifiers`]: [wis(2), mod("damage-resistance", ["fire"]), mod("speed", [], [10]), mod("damage-resistance", ["cold"])],
  };
  await useHomebrew.getState().loadMagicItems([item]);
  renderAt("/content/edit/magicItem/wave-ring");
  await form("Edit magic item");
  fireEvent.click(screen.getByRole("button", { name: "Remove Damage resistances" }));
  type("WIS value", "3");
  fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Undo" }));
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect((stored("wave-ring")!.item as Record<string, unknown>)[`${MI}modifiers`]).toEqual([
    wis(3),
    mod("damage-resistance", ["fire"]),
    mod("speed", [], [10]),
    mod("damage-resistance", ["cold"]),
  ]);
});

test("Undo puts an entry back at its index between two equal entries of another modifier", async () => {
  // The old app can store an entry twice; each copy keeps its place.
  const twice = mod("condition-immunity", ["charmed"]);
  const item = {
    [`${MI}name`]: "Twin Ring",
    [`${MI}type`]: "~:ring",
    [`${MI}rarity`]: "~:rare",
    [`${MI}modifiers`]: [twice, mod("damage-immunity", ["fire"]), twice, mod("damage-immunity", ["cold"])],
  };
  await useHomebrew.getState().loadMagicItems([item]);
  renderAt("/content/edit/magicItem/twin-ring");
  await form("Edit magic item");
  fireEvent.click(screen.getByRole("button", { name: "Remove Damage immunities" }));
  fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Undo" }));
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(stored("twin-ring")!.item).toEqual(item);
});

test("an imported item with unknown subtypes, limits and args, hidden weapon fields and unknown keys opens, saves and stays equal", async () => {
  const item = {
    [`${MI}name`]: "Old Blade",
    [`${MI}type`]: "~:weapon",
    [`${MI}rarity`]: "~:rare",
    [`${MI}subtypes`]: ["~:longsword", "~:an-old-blade"],
    // A weapon field with a specific subtype: the form does not show it.
    [`${W}finesse?`]: false,
    [`${MI}attunement`]: ["~:wizard", "~:an-old-order", "~:lawful-good"],
    [`${MI}modifiers`]: [
      mod("damage-resistance", ["psionic"]),
      mod("damage-resistance", ["fire"]),
      mod("condition-immunity", ["charmed"]),
      mod("an-old-mod", ["x"]),
    ],
    [`${MI}an-old-field`]: false,
  };
  await useHomebrew.getState().loadMagicItems([item]);
  renderAt("/content/edit/magicItem/old-blade");
  await form("Edit magic item");
  expect(shown("Base weapon")).toBe("Specific");
  expect(await screen.findByRole("button", { name: "Remove an-old-blade" })).toBeTruthy();
  expect(tokens("Base weapon")).toEqual(["Longsword", "an-old-blade"]);
  expect(screen.getByRole("checkbox", { name: "Requires attunement" })).toBeChecked();
  expect(tokens("Attunement")).toEqual(["Wizard", "Lawful Good", "an-old-order"]);
  expect(groups()).toEqual(["Base weapon", "Attunement", "Item properties", "Damage resistances", "Condition immunities", "Other modifiers"]);
  expect(tokens("Damage resistances")).toEqual(["Fire", "psionic"]);
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(stored("old-blade")!.item).toEqual(item);
});

test("in each picker a pick then a remove stores what the old double click stored", async () => {
  const item = {
    [`${MI}name`]: "Old Blade",
    [`${MI}type`]: "~:weapon",
    [`${MI}rarity`]: "~:rare",
    [`${MI}subtypes`]: ["~:longsword"],
    [`${W}finesse?`]: false,
    [`${MI}attunement`]: ["~:any"],
  };
  await useHomebrew.getState().loadMagicItems([item]);
  renderAt("/content/edit/magicItem/old-blade");
  await form("Edit magic item");
  // A base weapon toggle removes the hidden weapon fields, as the old toggle-subtype.
  await pick("Base weapon", "Add a base weapon", "Club");
  await unpick("Base weapon", "Club");
  // With no limit left, the attunement is :any again.
  await pick("Attunement", "Add an attunement limit", ["Wizard", "Chaotic Good"]);
  await unpick("Attunement", "Wizard");
  await unpick("Attunement", "Chaotic Good");
  expect(group("Attunement").getByText("No limits: any creature can attune to it.")).toBeTruthy();
  for (const name of ADDED.slice(3)) await addModifier(name);
  for (const [legend, add, name] of [
    ["Damage resistances", "Add a damage resistance", "Fire"],
    ["Damage vulnerabilities", "Add a damage vulnerability", "Radiant"],
    ["Damage immunities", "Add a damage immunity", "Poison"],
    ["Condition immunities", "Add a condition", "Charmed"],
  ]) {
    await pick(legend, add, name);
    await unpick(legend, name);
  }
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect(stored("old-blade")!.item).toEqual({
    [`${MI}name`]: "Old Blade",
    [`${MI}type`]: "~:weapon",
    [`${MI}rarity`]: "~:rare",
    [`${MI}subtypes`]: ["~:longsword"],
    [`${MI}attunement`]: ["~:any"],
  });
});

test("a damage picker adds an entry at the end, and the X of an arg stored twice removes both entries", async () => {
  const twice = mod("damage-immunity", ["fire"]);
  const item = { [`${MI}name`]: "Twin Ring", [`${MI}type`]: "~:ring", [`${MI}rarity`]: "~:rare", [`${MI}modifiers`]: [twice, wis(1), twice] };
  await useHomebrew.getState().loadMagicItems([item]);
  renderAt("/content/edit/magicItem/twin-ring");
  await form("Edit magic item");
  expect(tokens("Damage immunities")).toEqual(["Fire"]);
  // The footer counts the arg stored twice once.
  fireEvent.click(group("Damage immunities").getByRole("button", { name: "Add a damage immunity" }));
  expect(within(await screen.findByRole("dialog")).getByRole("status").textContent).toBe("1 on the form");
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await pick("Damage immunities", "Add a damage immunity", ["Cold", "Acid"]);
  expect(tokens("Damage immunities")).toEqual(["Acid", "Cold", "Fire"]);
  await unpick("Damage immunities", "Fire");
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" });
  expect((stored("twin-ring")!.item as Record<string, unknown>)[`${MI}modifiers`]).toEqual([
    wis(1),
    mod("damage-immunity", ["cold"]),
    mod("damage-immunity", ["acid"]),
  ]);
});
