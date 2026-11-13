import "fake-indexeddb/auto";
import { optionNames, pickOption, removeToken } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt } from "../../engine/content.ts";
import { engine, loadEngine } from "../../engine/engine.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";
import { choose, pick, shown, tokens, unpick } from "./test-picks.ts";

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
const clickIn = (group: string, label: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("checkbox", { name: label }));
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
const stored = (key: string) => {
  const pack = useHomebrew.getState().packs.find((p) => p.id === DEFAULT);
  return pack && (itemAt(pack.plugin, "~:orcpub.dnd.e5/classes", `~:${key}`) as Record<string, unknown> | undefined);
};
async function saved(router: ReturnType<typeof renderAt>) {
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
}
const group = (name: string) => screen.getByRole("group", { name });
/** Adds the level named `level`, such as "Level 6", with the "+ Add a level" menu of the chips in the section `section`. */
const addChip = (section: string, add: string, level: string) => pickOption(within(group(section)).getByRole("button", { name: add }), level);

/** A selection in the default pack, so a class level can give it. */
const addRuneCarvings = () =>
  useHomebrew.getState().saveItem(DEFAULT, "~:orcpub.dnd.e5/selections", {
    "~:name": "Rune Carvings",
    "~:key": "~:rune-carvings",
    "~:option-pack": DEFAULT,
    "~:options": [{ "~:name": "Fire Rune" }, { "~:name": "Stone Rune" }, { "~:name": "Hill Rune" }],
  });

test("each problem shows under its field, and Save is off until the class is valid", async () => {
  renderAt("/content/new/class");
  await screen.findByRole("textbox", { name: "Name" });
  expect(problems("Name")).toBe("Name is required.");
  expect(save().disabled).toBe(true);
  type("Name", "1 Rune");
  expect(problems("Name")).toBe("Name must start with a letter.");
  type("Name", "Rune Knight");
  expect(problems("Name")).toBeNull();
  expect(save().disabled).toBe(false);
  expect(screen.queryByRole("list", { name: "Problems" })).toBeNull();
});

// About 20 picks in a large form, and each pick renders the whole form again: it takes over 10 s, more under load.
test("Save stores the class as the old app stores it, and Edit loads it back", async () => {
  await addRuneCarvings();
  const router = renderAt("/content/new/class");
  await screen.findByRole("textbox", { name: "Name" });
  type("Name", "Rune Knight");
  type("Description", "A warrior of runes.");
  await choose("Hit die", "10");
  await choose("Subclass chosen at level", "3");
  type("Subclass title, such as Path or Circle", "Rune Path");
  type("Subclass description", "The runes you follow.");
  clickIn("Saving throws", "Strength");
  clickIn("Saving throws", "Constitution");
  clickIn("Saving throws", "Constitution");
  await removeToken(group("Ability increase levels"), "Level 4");
  await addChip("Ability increase levels", "Add a level", "Level 6");
  await choose("Spell slots", "Yes");
  await choose("Spell list", "Wizard");
  await choose("Spellcasting ability", "Intelligence");
  await choose("First spell slots at level", "2");
  await choose("Skill Proficiency Choice: choose", "2");
  // A removed token stores false, as the old second click on a checkbox.
  await pick("Skill Proficiency Choice", "Add a skill option", ["Athletics", "History", "Arcana"]);
  await unpick("Skill Proficiency Choice", "Arcana");
  await pick("Skill Expertise Choice", "Add a skill option", "Stealth");
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Add a level modifier" }));
  await choose("Modifier 1 type", "Armor Proficiency");
  fireEvent.click(screen.getByRole("button", { name: "Delete modifier 1" }));
  await choose("Modifier 1 type", "Weapon Proficiency");
  await choose("Modifier 1 value", "All martial");
  // A new row's level shows "-", so level 1 can be picked and stored.
  expect(shown("Modifier 1 level")).toBe("-");
  await choose("Modifier 1 level", "1");
  await choose("Modifier 2 type", "Spell");
  await choose("Modifier 2 level", "3");
  await choose("Modifier 2 spell level", "Cantrip");
  await choose("Modifier 2 spellcasting ability", "Intelligence");
  await choose("Modifier 2 spell", "Fire Bolt");
  fireEvent.click(screen.getByRole("button", { name: "Add selection" }));
  await choose("Selection 1 type", "Rune Carvings");
  await choose("Selection 1 level", "2");
  await choose("Selection 1 amount", "2");
  fireEvent.click(screen.getByRole("button", { name: "Add a feature" }));
  type("Feature 1 name", "Rune Carver");
  await choose("Feature 1 type", "Bonus Action");
  await choose("Feature 1 level", "2");
  type("Feature 1 description", "You carve a rune.");
  await saved(router);

  expect(stored("rune-knight")).toEqual({
    "~:name": "Rune Knight",
    "~:key": "~:rune-knight",
    "~:option-pack": DEFAULT,
    "~:help": "A warrior of runes.",
    "~:hit-die": 10,
    "~:subclass-level": 3,
    "~:subclass-title": "Rune Path",
    "~:subclass-help": "The runes you follow.",
    "~:ability-increase-levels": [6, 8, 12, 16, 19],
    "~:profs": {
      "~:save": { "~:orcpub.dnd.e5.character/str": true },
      "~:skill-options": { "~:choose": 2, "~:options": { "~:athletics": true, "~:history": true, "~:arcana": false } },
      "~:skill-expertise-options": { "~:options": { "~:stealth": true } },
    },
    "~:spellcasting": {
      "~:level-factor": 2,
      "~:known-mode": "~:schedule",
      "~:ability": "~:orcpub.dnd.e5.character/int",
      "~:spells-known": { "~i2": 2, "~i3": 1, "~i5": 1, "~i7": 1, "~i9": 1, "~i11": 1, "~i13": 1, "~i15": 1, "~i17": 1, "~i19": 1 },
      "~:spell-list-kw": "~:wizard",
    },
    "~:level-modifiers": [
      { "~:type": "~:weapon-prof", "~:value": "~:martial", "~:level": 1 },
      { "~:type": "~:spell", "~:level": 3, "~:value": { "~:level": 0, "~:ability": "~:orcpub.dnd.e5.character/int", "~:key": "~:fire-bolt" } },
    ],
    "~:level-selections": [{ "~:type": "~:rune-carvings", "~:level": 2, "~:num": 2 }],
    "~:traits": [{ "~:name": "Rune Carver", "~:type": "~:b-action", "~:level": 2, "~:description": "You carve a rune." }],
  });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);

  cleanup();
  renderAt(`/content/edit/class/${encodeURIComponent(DEFAULT)}/rune-knight`);
  await screen.findByRole("textbox", { name: "Name" });
  expect(screen.getByRole("form", { name: "Edit class" })).toBeTruthy();
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe("Rune Knight");
  expect(shown("Hit die")).toBe("10");
  expect(within(group("Saving throws")).getByRole("checkbox", { name: "Strength" })).toBeChecked();
  expect(tokens("Ability increase levels")).toEqual(["6", "8", "12", "16", "19"]);
  expect(shown("Spell list")).toBe("Wizard");
  expect(shown("First spell slots at level")).toBe("2");
  expect(tokens("Skill Proficiency Choice")).toEqual(["Athletics", "History"]);
  expect(tokens("Skill Expertise Choice")).toEqual(["Stealth"]);
  expect(shown("Modifier 2 spell")).toBe("Fire Bolt");
  expect(shown("Selection 1 type")).toBe("Rune Carvings");
  expect(shown("Feature 1 type")).toBe("Bonus Action");
  expect(save().disabled).toBe(false);
}, 40_000);

test("a class with a custom spell list stores its cantrips and spells by level", async () => {
  const router = renderAt("/content/new/class");
  await screen.findByRole("textbox", { name: "Name" });
  type("Name", "Hedge Mage");
  await choose("Spell slots", "Yes");
  await choose("First spell slots at level", "1");
  await choose("Cantrips", "Yes");
  await choose("Cantrips known at level 1", "2");
  await addChip("Extra cantrips at level", "Add a level", "Level 12");
  await addChip("Extra cantrips at level", "Add a level", "Level 4");
  await removeToken(group("Extra cantrips at level"), "Level 4");
  await addChip("Extra cantrips at level", "Add a level", "Level 10");
  expect(tokens("Extra cantrips at level")).toEqual(["10", "12"]);
  await removeToken(group("Extra cantrips at level"), "Level 12");
  await pick("Cantrips", "Add a cantrip", "Fire Bolt");
  await pick("Level 1 spells", "Add a 1st-level spell", ["Magic Missile", "Shield"]);
  await unpick("Level 1 spells", "Shield");
  await pick("Level 9 spells", "Add a 9th-level spell", "Wish");
  await saved(router);

  expect(stored("hedge-mage")!["~:spellcasting"]).toEqual({
    "~:level-factor": 1,
    "~:known-mode": "~:schedule",
    "~:ability": "~:orcpub.dnd.e5.character/cha",
    "~:spells-known": { "~i1": 2, "~i2": 1, "~i3": 1, "~i4": 1, "~i5": 1, "~i6": 1, "~i7": 1, "~i8": 1, "~i9": 1, "~i10": 1, "~i11": 1, "~i13": 1, "~i15": 1, "~i17": 1 },
    "~:cantrips?": true,
    "~:cantrips-known": { "~i1": 2, "~i10": 1 },
    "~:spell-list": { "~i0": { "~#set": ["~:fire-bolt"] }, "~i1": { "~#set": ["~:magic-missile"] }, "~i9": { "~#set": ["~:wish"] } },
  });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
  // At level 1 the class picks its two cantrips and two spells from its own list.
  const e = engine();
  const content = { homebrew: useHomebrew.getState().homebrew };
  const { selections } = e.evaluate(e.setClass(e.emptyCharacter(), 0, "hedge-mage", content), content);
  const known = (key: string) => selections.find((s) => s.key === key);
  expect(known("hedge-mage-cantrips-known")).toMatchObject({ optionCount: 1, min: 2 });
  expect(known("hedge-mage-spells-known")).toMatchObject({ optionCount: 1, min: 2 });
});

test("the spell lists include a list that a spell of an enabled pack is on, as the old list (::spells/spell-lists)", async () => {
  await useHomebrew.getState().saveItem("Tinkers", "~:orcpub.dnd.e5/spells", {
    "~:key": "~:spark",
    "~:name": "Spark",
    "~:option-pack": "Tinkers",
    "~:level": 0,
    "~:school": "evocation",
    "~:spell-lists": { "~:artificer": true, "~:monk": false, "~:wizard": true },
  });
  renderAt("/content/new/class");
  await screen.findByRole("textbox", { name: "Name" });
  await choose("Spell slots", "Yes");
  const lists = await optionNames(screen.getByRole("combobox", { name: "Spell list" }));
  expect(lists).toEqual(["Custom", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard", "Artificer"]);
});

test("the level modifier types are in order of use, and the class form has no modifier list", async () => {
  renderAt("/content/new/class");
  await screen.findByRole("textbox", { name: "Name" });
  expect(screen.queryByRole("button", { name: "Add a modifier" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add a level modifier" }));
  expect(await optionNames(screen.getByRole("combobox", { name: "Modifier 1 type" }))).toEqual([
    "<select type>",
    "Spell",
    "Armor Proficiency",
    "Weapon Proficiency",
    "Damage Resistance",
    "Damage Immunity",
    "Flying Speed",
    "Flying Speed Equals Walking Speed",
    "Number of Attacks",
    "Saving Throw Advantage",
    "Skill Proficiency",
    "Swimming Speed",
    "Tool Proficiency",
  ]);
});

test("a new class starts with the ability increase levels 4, 8, 12, 16 and 19, as the old default class", async () => {
  const router = renderAt("/content/new/class");
  await screen.findByRole("textbox", { name: "Name" });
  type("Name", "Tide Caller");
  expect(tokens("Ability increase levels")).toEqual(["4", "8", "12", "16", "19"]);
  // The menu has the levels 4 to 20 that are not on a chip.
  expect(await optionNames(within(group("Ability increase levels")).getByRole("button", { name: "Add a level" }))).toEqual(
    [5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 20].map((n) => `Level ${n}`),
  );
  await removeToken(group("Ability increase levels"), "Level 19");
  await addChip("Ability increase levels", "Add a level", "Level 20");
  await addChip("Ability increase levels", "Add a level", "Level 5");
  expect(tokens("Ability increase levels")).toEqual(["4", "5", "8", "12", "16", "20"]);
  await saved(router);
  expect(stored("tide-caller")!["~:ability-increase-levels"]).toEqual([4, 5, 8, 12, 16, 20]);
});

test("the class form: saving throws are one checkbox row, and the subclass fields have their labels above them", async () => {
  renderAt("/content/new/class");
  await screen.findByRole("textbox", { name: "Name" });
  const saves = within(group("Saving throws")).getAllByRole("checkbox");
  expect(saves.map((box) => box.closest("label")?.textContent)).toEqual(["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"]);
  for (const label of ["Subclass title, such as Path or Circle", "Subclass description"]) {
    const field = screen.getByRole("textbox", { name: label }).closest("label")!;
    // The label is its own line: the first child of the grid label, before the input.
    expect(field.className).toContain("ui-field-label");
    expect(field.firstElementChild!.textContent).toBe(label);
  }
  expect(screen.getByText(/Martial Maneuvers, Fighting Style or Eldritch Invocations/)).toBeTruthy();
});

test("an imported class opens with its spell list, levels and false values, and a save keeps it as it was", async () => {
  const item = {
    "~:name": "Tide Sage",
    "~:key": "~:tide-sage",
    "~:option-pack": "Reef",
    "~:hit-die": 8,
    "~:subclass-level": 2,
    "~:ability-increase-levels": [3, 6, 9, 12, 15, 18],
    "~:profs": {
      "~:save": { "~:orcpub.dnd.e5.character/wis": true, "~:orcpub.dnd.e5.character/int": false },
      "~:skill-options": { "~:choose": 2, "~:options": { "~:nature": true, "~:arcana": false, "~:survival": true } },
      "~:skill-expertise-options": { "~:options": { "~:stealth": false } },
    },
    "~:spellcasting": {
      "~:level-factor": 1,
      "~:known-mode": "~:schedule",
      "~:ability": "~:orcpub.dnd.e5.character/wis",
      "~:spells-known": { "~i1": 2, "~i2": 1 },
      "~:cantrips?": true,
      "~:cantrips-known": { "~i1": 3, "~i4": 1, "~i10": 2 },
      // A spell of a pack that is not here, an empty level and a level with spells.
      "~:spell-list": { "~i0": { "~#set": ["~:shocking-grasp", "~:tide-call"] }, "~i1": { "~#set": [] }, "~i2": { "~#set": ["~:misty-step", "~:hold-person"] } },
    },
    "~:level-modifiers": [],
    "~:traits": [],
  };
  await useHomebrew.getState().saveItem("Reef", "~:orcpub.dnd.e5/classes", item);
  const router = renderAt("/content/edit/class/Reef/tide-sage");
  await screen.findByRole("textbox", { name: "Name" });
  expect(tokens("Ability increase levels")).toEqual(["3", "6", "9", "12", "15", "18"]);
  expect(tokens("Extra cantrips at level")).toEqual(["4", "10"]);
  // The key of a spell that no list has is its token. The tokens are in the order of the list.
  expect(tokens("Cantrips")).toEqual(["Shocking Grasp", "tide-call"]);
  expect(tokens("Level 1 spells")).toEqual([]);
  expect(tokens("Level 2 spells")).toEqual(["Hold Person", "Misty Step"]);
  expect(tokens("Skill Proficiency Choice")).toEqual(["Nature", "Survival"]);
  expect(tokens("Skill Expertise Choice")).toEqual([]);
  expect(within(group("Saving throws")).getByRole("checkbox", { name: "Wisdom" })).toBeChecked();
  expect(within(group("Saving throws")).getByRole("checkbox", { name: "Intelligence" })).not.toBeChecked();
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  const pack = useHomebrew.getState().packs.find((p) => p.id === "Reef")!;
  expect(itemAt(pack.plugin, "~:orcpub.dnd.e5/classes", "~:tide-sage")).toEqual(item);
});

test("a spell list picker has search, and a removed spell of another pack leaves the set while the others stay", async () => {
  const item = {
    "~:name": "Tide Sage",
    "~:key": "~:tide-sage",
    "~:option-pack": DEFAULT,
    "~:hit-die": 8,
    "~:ability-increase-levels": [4, 8, 12, 16, 19],
    "~:spellcasting": { "~:level-factor": 1, "~:known-mode": "~:schedule", "~:ability": "~:orcpub.dnd.e5.character/wis", "~:spells-known": { "~i1": 2 }, "~:spell-list": { "~i1": { "~#set": ["~:tide-touch", "~:bless"] } } },
    "~:level-modifiers": [],
    "~:traits": [],
  };
  await useHomebrew.getState().saveItem(DEFAULT, "~:orcpub.dnd.e5/classes", item);
  const router = renderAt(`/content/edit/class/${encodeURIComponent(DEFAULT)}/tide-sage`);
  await screen.findByRole("textbox", { name: "Name" });
  fireEvent.click(within(group("Level 1 spells")).getByRole("button", { name: "Add a 1st-level spell" }));
  const dialog = await screen.findByRole("dialog", { name: "Add a 1st-level spell" });
  fireEvent.change(within(dialog).getByRole("searchbox", { name: "Search" }), { target: { value: "cure" } });
  expect([...dialog.querySelectorAll(".ui-list-row")].map((row) => row.getAttribute("aria-label"))).toEqual(["Cure Wounds"]);
  fireEvent.click(within(dialog).getByRole("button", { name: "Cure Wounds" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await unpick("Level 1 spells", "tide-touch");
  expect(tokens("Level 1 spells")).toEqual(["Bless", "Cure Wounds"]);
  await saved(router);
  expect(stored("tide-sage")!["~:spellcasting"]).toEqual({ ...item["~:spellcasting"], "~:spell-list": { "~i1": { "~#set": ["~:bless", "~:cure-wounds"] } } });
});
