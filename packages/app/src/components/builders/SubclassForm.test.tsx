import "fake-indexeddb/auto";
import { pickFromPicker, removeToken } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt } from "../../engine/content.ts";
import { engine, loadEngine } from "../../engine/engine.ts";
import { useCharacter } from "../../state/character.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { Builder } from "../Builder.tsx";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";
import { classBuilder } from "./ClassForm.tsx";
import { addList, addModifier, choose, groups, pick, shown, tokens } from "./test-picks.ts";

beforeAll(() => loadEngine());
afterEach(async () => {
  cleanup();
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
});

const DEFAULT = "Default Option Source";

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/content", element: <h1>My Content</h1> },
      { path: "/content/new/:type", element: <HomebrewBuilder /> },
      { path: "/content/edit/:type/:pack/:key", element: <HomebrewBuilder /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const save = () => screen.getByRole<HTMLButtonElement>("button", { name: "Save" });
const type = (label: string, value: string) => fireEvent.change(screen.queryByRole("textbox", { name: label }) ?? screen.getByRole("combobox", { name: label }), { target: { value } });
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
const stored = (key: string) => {
  const pack = useHomebrew.getState().packs.find((p) => p.id === DEFAULT);
  return pack && (itemAt(pack.plugin, "~:orcpub.dnd.e5/subclasses", `~:${key}`) as Record<string, unknown> | undefined);
};
async function saved(router: ReturnType<typeof renderAt>) {
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
}

const SLOT = ["first spell", "second spell"];
const ORDINAL = ["", "1st", "2nd", "3rd", "4th", "5th"];
/** The "+ Add a spell" button of a slot of the spells table: level 1 to 5, slot 1 or 2. */
const slot = (level: number, n: 1 | 2) => screen.getByRole("button", { name: `Add a spell: ${ORDINAL[level]} level, ${SLOT[n - 1]}` });
/** The table of the section `title`: for each row its cells, a token's text, "+" for an add button, or the cell's text. */
const table = (title: string) =>
  // hidden: the table is behind an open picker too.
  [...screen.getByRole("group", { name: title, hidden: true }).querySelectorAll("tr")].map((tr) =>
    [...tr.children].map((cell) => cell.querySelector(".ui-token-label")?.textContent ?? (cell.querySelector("button") ? "+" : cell.textContent)),
  );
/** The names in the open spell picker. */
const listed = (dialog: HTMLElement) => [...dialog.querySelectorAll(".ui-list-row")].map((row) => row.getAttribute("aria-label"));

test("each problem shows under its field, and Save is off until the subclass is valid", async () => {
  renderAt("/content/new/subclass");
  await screen.findByRole("textbox", { name: "Name" });
  expect(problems("Name")).toBe("Name is required.");
  expect(shown("Class")).toBe("Barbarian");
  type("Name", "Path of Frost");
  expect(save().disabled).toBe(false);
  await choose("Class", "<select class>");
  expect(problems("Class")).toBe("Class is required.");
  expect(save().disabled).toBe(true);
  await choose("Class", "Fighter");
  expect(save().disabled).toBe(false);
});

test("a cleric subclass stores its domain spells as the old app stores them, and Edit loads them back", async () => {
  const router = renderAt("/content/new/subclass");
  await screen.findByRole("textbox", { name: "Name" });
  type("Name", "Waves Domain");
  expect(screen.queryByRole("group", { name: "Domain Spells" })).toBeNull();
  await choose("Class", "Cleric");
  // The second pick goes to the other slot of the row, and the picker closes.
  await pickFromPicker(slot(1, 1), ["Fog Cloud", "Bless"]);
  await pickFromPicker(slot(5, 1), "Cone of Cold");
  await addModifier("Skill Proficiency Choice");
  await pick("Skill Proficiency Choice", "Add a skill option", "Religion");
  fireEvent.click(screen.getByRole("button", { name: "Add a level modifier" }));
  await choose("Modifier 1 type", "Swimming Speed");
  await choose("Modifier 1 value", "30 ft.");
  // A new type keeps the value, as the old event does.
  await choose("Modifier 1 type", "Flying Speed");
  await saved(router);

  expect(stored("waves-domain")).toEqual({
    "~:name": "Waves Domain",
    "~:key": "~:waves-domain",
    "~:option-pack": DEFAULT,
    "~:class": "~:cleric",
    "~:cleric-spells": { "~i1": { "~i0": "~:fog-cloud", "~i1": "~:bless" }, "~i5": { "~i0": "~:cone-of-cold" } },
    "~:profs": { "~:skill-options": { "~:options": { "~:religion": true } } },
    "~:level-modifiers": [{ "~:type": "~:flying-speed", "~:value": 30 }],
    "~:traits": [],
  });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);

  cleanup();
  renderAt(`/content/edit/subclass/${encodeURIComponent(DEFAULT)}/waves-domain`);
  await screen.findByRole("textbox", { name: "Name" });
  expect(shown("Class")).toBe("Cleric");
  expect(table("Domain Spells")[1]).toEqual(["1st", "1st", "Fog Cloud", "Bless"]);
  expect(table("Domain Spells")[5]).toEqual(["9th", "5th", "Cone of Cold", "+"]);
  expect(tokens("Skill Proficiency Choice")).toEqual(["Religion"]);
  expect(shown("Modifier 1 value")).toBe("30 ft.");
  expect(groups()).toEqual(["Domain Spells", "Skill Proficiency Choice", "Modifiers", "Features / traits"]);
});

test("a new subclass shows only the common groups, and the add list has the others in form order", async () => {
  renderAt("/content/new/subclass");
  await screen.findByRole("textbox", { name: "Name" });
  expect(groups()).toEqual(["Modifiers", "Features / traits"]);
  expect(await addList()).toEqual(["Skill Proficiency Choice", "Skill Expertise Choice", "Selections"]);
  await addModifier("Selections");
  await addModifier("Skill Expertise Choice");
  expect(groups()).toEqual(["Skill Expertise Choice", "Modifiers", "Selections", "Features / traits"]);
  expect(await addList()).toEqual(["Skill Proficiency Choice"]);
});

test("an imported subclass opens with each group that holds a value, and a save keeps the values of the others", async () => {
  const item = {
    "~:name": "Path of Tides",
    "~:key": "~:path-of-tides",
    "~:option-pack": "Reef",
    "~:class": "~:barbarian",
    "~:profs": { "~:skill-options": { "~:options": { "~:athletics": false } }, "~:skill-expertise-options": { "~:choose": 1, "~:options": { "~:survival": true } } },
    "~:level-modifiers": [],
    "~:level-selections": [{ "~:type": "~:tide-gifts", "~:level": 3, "~:num": 1 }],
    "~:traits": [],
  };
  await useHomebrew.getState().saveItem("Reef", "~:orcpub.dnd.e5/subclasses", item);
  const router = renderAt("/content/edit/subclass/Reef/path-of-tides");
  await screen.findByRole("textbox", { name: "Name" });
  expect(groups()).toEqual(["Skill Expertise Choice", "Modifiers", "Selections", "Features / traits"]);
  expect(shown("Selection 1 level")).toBe("3");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  const pack = useHomebrew.getState().packs.find((p) => p.id === "Reef")!;
  expect(itemAt(pack.plugin, "~:orcpub.dnd.e5/subclasses", "~:path-of-tides")).toEqual(item);
});

test("a fighter subclass can cast wizard spells", async () => {
  const router = renderAt("/content/new/subclass");
  await screen.findByRole("textbox", { name: "Name" });
  type("Name", "Spell Blade");
  await choose("Class", "Fighter");
  await choose("Casts wizard spells", "Yes");
  await saved(router);
  expect(stored("spell-blade")!["~:spellcasting"]).toEqual({ "~:level-factor": 3 });
});

// The done-when of ORC-75: a class and its subclass made in the forms give a
// character the class's level selections and the subclass choice.
test("a class and a subclass authored in the forms are a character's choices, and their pack passes validateForExport", async () => {
  const selection = (name: string, options: string[]) =>
    useHomebrew.getState().saveItem(DEFAULT, "~:orcpub.dnd.e5/selections", {
      "~:name": name,
      "~:key": `~:${name.toLowerCase().replace(" ", "-")}`,
      "~:option-pack": DEFAULT,
      "~:options": options.map((option) => ({ "~:name": option })),
    });
  await selection("Rune Carvings", ["Fire Rune", "Stone Rune", "Hill Rune"]);
  await selection("Frost Gifts", ["Ice Skin", "Cold Breath"]);
  let router = renderAt("/content/new/class");
  await screen.findByRole("textbox", { name: "Name" });
  type("Name", "Rune Knight");
  await choose("Hit die", "10");
  await choose("Subclass chosen at level", "3");
  type("Subclass title, such as Path or Circle", "Rune Path");
  fireEvent.click(screen.getByRole("button", { name: "Add selection" }));
  await choose("Selection 1 type", "Rune Carvings");
  await choose("Selection 1 level", "2");
  await choose("Selection 1 amount", "2");
  await saved(router);

  cleanup();
  router = renderAt("/content/new/subclass");
  await screen.findByRole("textbox", { name: "Name" });
  // The new class is a parent the subclass can have.
  await choose("Class", "Rune Knight");
  type("Name", "Frost Path");
  fireEvent.click(screen.getByRole("button", { name: "Add feature / trait" }));
  type("Feature 1 name", "Frost Rune");
  await choose("Feature 1 level", "3");
  type("Feature 1 description", "Your weapon is cold.");
  await addModifier("Selections");
  fireEvent.click(screen.getByRole("button", { name: "Add selection" }));
  await choose("Selection 1 type", "Frost Gifts");
  await choose("Selection 1 level", "3");
  await saved(router);
  cleanup();

  const e = engine();
  const content = useHomebrew.getState().content;
  let character = e.setClass(e.emptyCharacter(), 0, "rune-knight", content);
  character = e.addLevel(e.addLevel(character, "rune-knight", content), "rune-knight", content);
  useCharacter.getState().load("homebrew-rune-knight", character);
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Class/ }));
  const carvings = screen.getByRole("region", { name: /^Rune Carvings/ });
  // The picks to make are an inline note in the heading.
  expect(within(carvings).getByRole("heading").textContent).toBe("Rune Carvings 2 to choose");
  expect(within(carvings).getByRole("button", { name: "Fire Rune" })).toBeTruthy();
  // Picking the subclass opens its level-3 selection.
  expect(screen.queryByRole("region", { name: /^Frost Gifts/ })).toBeNull();
  fireEvent.click(within(screen.getByRole("region", { name: /^Rune Path/ })).getByRole("button", { name: "Frost Path" }));
  expect(within(screen.getByRole("region", { name: /^Frost Gifts/ })).getByRole("button", { name: "Cold Breath" })).toBeTruthy();

  expect(e.validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
});

test("the spells table: a level column for a paladin and a cleric, none for a warlock, and one help line", async () => {
  renderAt("/content/new/subclass");
  await screen.findByRole("textbox", { name: "Name" });
  await choose("Class", "Paladin");
  const headings = (title: string) => within(screen.getByRole("group", { name: title })).getAllByRole("columnheader").map((h) => h.textContent);
  expect(headings("Spells")).toEqual(["Paladin level", "Spell level", "First spell", "Second spell"]);
  expect(table("Spells").slice(1)).toEqual([
    ["3rd", "1st", "+", "+"],
    ["5th", "2nd", "+", "+"],
    ["9th", "3rd", "+", "+"],
    ["13th", "4th", "+", "+"],
    ["17th", "5th", "+", "+"],
  ]);
  expect(screen.getByText("A paladin of this subclass always has these spells prepared, from the paladin level in the first column.")).toBeTruthy();
  await choose("Class", "Cleric");
  expect(headings("Domain Spells")).toEqual(["Cleric level", "Spell level", "First spell", "Second spell"]);
  expect(table("Domain Spells").slice(1).map((row) => row[0])).toEqual(["1st", "3rd", "5th", "7th", "9th"]);
  await choose("Class", "Warlock");
  expect(headings("Expanded Spells")).toEqual(["Spell level", "First spell", "Second spell"]);
  expect(table("Expanded Spells").slice(1).map((row) => row[0])).toEqual(["1st", "2nd", "3rd", "4th", "5th"]);
  expect(screen.getByText("A warlock of this subclass can choose these spells as warlock spells.")).toBeTruthy();
  await choose("Class", "Fighter");
  expect(screen.queryByRole("table")).toBeNull();
});

test("a spell slot: a pick goes to the slot that was clicked, a picked spell leaves the list, the picker closes at two, and an X empties its slot", async () => {
  const router = renderAt("/content/new/subclass");
  await screen.findByRole("textbox", { name: "Name" });
  type("Name", "Oath of the Lantern");
  await choose("Class", "Paladin");
  // The second slot first: the pick goes to it, and the first slot stays empty.
  fireEvent.click(slot(2, 2));
  let dialog = await screen.findByRole("dialog", { name: "Add a 2nd-level spell" });
  expect(within(dialog).getByRole("status").textContent).toBe("0 of 2 in this row");
  expect(listed(dialog)).toContain("Zone of Truth");
  fireEvent.click(within(dialog).getByRole("button", { name: "Zone of Truth" }));
  expect(table("Spells")[2]).toEqual(["5th", "2nd", "+", "Zone of Truth"]);
  // The picker stays open with one spell in the row, and the picked spell is not in the list.
  expect(within(dialog).getByRole("status").textContent).toBe("1 of 2 in this row");
  expect(listed(dialog)).not.toContain("Zone of Truth");
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  // The first slot then: one pick fills the row, and the picker closes.
  fireEvent.click(slot(2, 1));
  dialog = await screen.findByRole("dialog", { name: "Add a 2nd-level spell" });
  expect(listed(dialog)).not.toContain("Zone of Truth");
  fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search" }), { target: { value: "lesser" } });
  expect(listed(dialog)).toEqual(["Lesser Restoration"]);
  fireEvent.click(within(dialog).getByRole("button", { name: "Lesser Restoration" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(table("Spells")[2]).toEqual(["5th", "2nd", "Lesser Restoration", "Zone of Truth"]);
  // The focus goes to the token of the pick.
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove Lesser Restoration" })));
  // Two picks from the first slot of an empty row fill both slots, in order.
  await pickFromPicker(slot(1, 1), ["Sanctuary", "Bless"]);
  expect(table("Spells")[1]).toEqual(["3rd", "1st", "Sanctuary", "Bless"]);
  await removeToken(screen.getByRole("group", { name: "Spells" }), "Sanctuary");
  expect(table("Spells")[1]).toEqual(["3rd", "1st", "+", "Bless"]);
  await removeToken(screen.getByRole("group", { name: "Spells" }), "Bless");
  await saved(router);
  // An X removes the index, as the old select's clear did: the level map stays, empty.
  expect(stored("oath-of-the-lantern")!["~:paladin-spells"]).toEqual({ "~i1": {}, "~i2": { "~i1": "~:zone-of-truth", "~i0": "~:lesser-restoration" } });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
});

test("an imported paladin, cleric and warlock subclass each open with their spells in their slots, and a save keeps them as they were", async () => {
  const items = [
    {
      "~:name": "Oath of Tides",
      "~:key": "~:oath-of-tides",
      "~:option-pack": "Reef",
      "~:class": "~:paladin",
      // Two spells, one, only the second, none, and a spell of a pack that is not here.
      "~:paladin-spells": { "~i1": { "~i0": "~:sanctuary", "~i1": "~:bless" }, "~i2": { "~i0": "~:zone-of-truth" }, "~i3": { "~i1": "~:tidal-wave" }, "~i4": {} },
      "~:level-modifiers": [],
      "~:traits": [],
    },
    {
      "~:name": "Waves Domain",
      "~:key": "~:waves-domain",
      "~:option-pack": "Reef",
      "~:class": "~:cleric",
      "~:cleric-spells": { "~i1": { "~i1": "~:fog-cloud" }, "~i5": { "~i0": "~:cone-of-cold", "~i1": "~:commune" } },
      "~:profs": { "~:skill-options": { "~:choose": 1, "~:options": { "~:religion": true, "~:history": false } } },
      "~:level-modifiers": [],
      "~:traits": [],
    },
    {
      "~:name": "The Deep",
      "~:key": "~:the-deep",
      "~:option-pack": "Reef",
      "~:class": "~:warlock",
      "~:warlock-spells": { "~i3": { "~i0": "~:water-breathing" } },
      "~:level-modifiers": [],
      "~:traits": [],
    },
  ];
  for (const item of items) await useHomebrew.getState().saveItem("Reef", "~:orcpub.dnd.e5/subclasses", item);
  const expected: Record<string, (string | null)[][]> = {
    "oath-of-tides": [
      ["3rd", "1st", "Sanctuary", "Bless"],
      ["5th", "2nd", "Zone of Truth", "+"],
      ["9th", "3rd", "+", "tidal-wave"],
      ["13th", "4th", "+", "+"],
      ["17th", "5th", "+", "+"],
    ],
    "waves-domain": [
      ["1st", "1st", "+", "Fog Cloud"],
      ["3rd", "2nd", "+", "+"],
      ["5th", "3rd", "+", "+"],
      ["7th", "4th", "+", "+"],
      ["9th", "5th", "Cone of Cold", "Commune"],
    ],
    "the-deep": [
      ["1st", "+", "+"],
      ["2nd", "+", "+"],
      ["3rd", "Water Breathing", "+"],
      ["4th", "+", "+"],
      ["5th", "+", "+"],
    ],
  };
  const titles = ["Spells", "Domain Spells", "Expanded Spells"];
  for (const [i, item] of items.entries()) {
    const key = (item["~:key"] as string).slice(2);
    const router = renderAt(`/content/edit/subclass/Reef/${key}`);
    await screen.findByRole("textbox", { name: "Name" });
    expect(table(titles[i]).slice(1)).toEqual(expected[key]);
    fireEvent.click(save());
    await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
    cleanup();
    const pack = useHomebrew.getState().packs.find((p) => p.id === "Reef")!;
    expect(itemAt(pack.plugin, "~:orcpub.dnd.e5/subclasses", item["~:key"])).toEqual(item);
  }
}, 30_000);
