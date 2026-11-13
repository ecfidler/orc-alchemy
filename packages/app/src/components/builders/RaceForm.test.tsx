import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt, withoutDisabledFlag } from "../../engine/content.ts";
import { engine, loadEngine } from "../../engine/engine.ts";
import { exportOrcbrew } from "../../engine/orcbrew-export.ts";
import { orcbrewHomebrew, useHomebrew } from "../../state/homebrew.ts";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";
import { addModifier, choose, groups, pick, shown, tokens, unpick } from "./test-picks.ts";

beforeAll(() => loadEngine());
afterEach(async () => {
  cleanup();
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
});

const orcbrewDir = join(import.meta.dirname, "../../../../../fixtures/orcbrew");

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
const check = (group: string, label: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("checkbox", { name: label }));
const checked = (group: string, label: string) => within(screen.getByRole("group", { name: group })).getByRole("checkbox", { name: label }).getAttribute("aria-checked") === "true";
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
const COMMON = ["Ability Score Increases", "Languages", "Damage Resistances", "Language Proficiency Choice", "Spells"];
/** The modifiers of the add list, in form order. */
const ADDED = [
  "Flying speed",
  "Swimming speed",
  "Armor Class",
  "Weapon Proficiencies",
  "Armor Proficiency",
  "Tool Proficiency",
  "Damage Immunities",
  "Skill Proficiencies",
  "Skill Proficiency Choice",
  "Weapon Proficiency Choice",
];
const stored = (pack: string, key: string) => {
  const plugin = useHomebrew.getState().packs.find((p) => p.id === pack)?.plugin;
  return plugin && itemAt(plugin, "~:orcpub.dnd.e5/races", `~:${key}`);
};

test("the name problem shows under its field, and Save is off until the race has a name", async () => {
  renderAt("/content/new/race");
  await screen.findByRole("button", { name: "Add a spell" });
  expect(problems("Name")).toBe("Name is required.");
  expect(save().disabled).toBe(true);
  type("Name", "1 Bad");
  expect(problems("Name")).toBe("Name must start with a letter.");
  type("Name", "Mezzoloth");
  expect(problems("Name")).toBeNull();
  expect(save().disabled).toBe(false);
});

test("the form recreates the Mezzoloth race of the community fixture, and Edit loads it back", async () => {
  const router = renderAt("/content/new/race");
  await screen.findByRole("button", { name: "Add a spell" });
  type("Option source (pack)", "me");
  type("Name", "Mezzoloth");
  await choose("Darkvision", "60");
  await choose("Constitution", "+2");
  await pick("Languages", "Add a language", ["Common", "Infernal"]);
  fireEvent.click(screen.getByRole("button", { name: "Add a spell" }));
  await choose("Spell 1 spellcasting ability", "Charisma");
  await choose("Spell 1", "Message");
  fireEvent.click(screen.getByRole("button", { name: "Add a spell" }));
  await choose("Spell 2 spell level", "2nd");
  await choose("Spell 2 spellcasting ability", "Charisma");
  await choose("Spell 2", "Darkness");
  // A third spell, deleted again.
  fireEvent.click(screen.getByRole("button", { name: "Add a spell" }));
  await choose("Spell 3", "Light");
  fireEvent.click(screen.getByRole("button", { name: "Delete spell 3" }));
  fireEvent.click(screen.getByRole("button", { name: "Add a feature" }));
  fireEvent.click(screen.getByRole("button", { name: "Add a feature" }));
  type("Feature 1 name", "Natural Weapon");
  type(
    "Feature 1 description",
    "you have razor sharp claws, which are a simple melee weapon you are proficient with, uses a d6 for it's damage die and deals slashing damage",
  );
  type("Feature 2 name", "Multilimbed");
  type(
    "Feature 2 description",
    "You have four arms. All of your arms are strong enough to carry weapons, shields, arcane focuses, other objects, or hold in terrain features such as tree branch or ladder. You cannon gain a benefit from having more than one shield, and holding more than two weapons does not affect how two-weapon fighting works for you",
  );
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });

  const parsed = engine().parseOrcbrew(readFileSync(join(orcbrewDir, "community-mezzoloth-race.orcbrew"), "utf8")).data as Record<string, object>;
  const fixture = itemAt(parsed["Imported Content"], "~:orcpub.dnd.e5/races", "~:mezzoloth");
  expect(fixture).toHaveProperty("~:name", "Mezzoloth");
  // The old save changes nothing that the fixture does not have, so nothing is normalized.
  expect(stored("me", "mezzoloth")).toEqual(fixture);
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
  // My Content's .orcbrew export of the pack reads back as the fixture's pack, without the old pack flag the fixture carries.
  const exported = exportOrcbrew(orcbrewHomebrew(), { pack: "me" });
  if (!("text" in exported)) throw new Error("The pack did not export");
  expect(engine().parseOrcbrew(exported.text, { name: "me" }).data!["me"]).toEqual(withoutDisabledFlag(parsed["Imported Content"]));

  cleanup();
  renderAt("/content/edit/race/me/mezzoloth");
  await screen.findByRole("form", { name: "Edit race" });
  await screen.findByRole("button", { name: "Add a spell" });
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe("Mezzoloth");
  expect(shown("Darkvision")).toBe("60");
  expect(shown("Constitution")).toBe("+2");
  expect(tokens("Languages")).toEqual(["Common", "Infernal"]);
  expect(shown("Spell 2")).toBe("Darkness");
  expect(screen.getByLabelText<HTMLTextAreaElement>("Feature 2 description").value).toMatch(/^You have four arms/);
  expect(save().disabled).toBe(false);
});

test("the modifiers are stored as the old events store them", async () => {
  const router = renderAt("/content/new/race");
  await screen.findByRole("button", { name: "Add a spell" });
  type("Name", "Lizard");
  type("Description", "Scaly.");
  await choose("Size", "small");
  await choose("Speed", "25");
  for (const name of ["Swimming speed", "Armor Class", "Weapon Proficiencies", "Armor Proficiency", "Tool Proficiency", "Damage Immunities", "Skill Proficiencies", "Skill Proficiency Choice", "Weapon Proficiency Choice"]) {
    await addModifier(name);
  }
  await choose("Swimming speed", "30");
  await choose("Armor Class", "13 + DEX");
  await pick("Weapon Proficiencies", "Add a weapon", ["All simple weapons", "Dart"]);
  await unpick("Weapon Proficiencies", "Dart");
  check("Armor Proficiency", "Shields");
  await pick("Tool Proficiency", "Add a tool", "Thieves' Tools");
  await pick("Damage Resistances", "Add a damage resistance", "Poison");
  await pick("Damage Immunities", "Add a damage immunity", "Fire");
  await pick("Skill Proficiencies", "Add a skill", "Stealth");
  await choose("Skill Proficiency Choice: choose", "2");
  await pick("Skill Proficiency Choice", "Add a skill option", "Survival");
  await pick("Language Proficiency Choice", "Add a language option", "Draconic");
  await pick("Weapon Proficiency Choice", "Add a weapon option", "Rapier");
  fireEvent.click(screen.getByRole("button", { name: "Add a spell" }));
  await choose("Spell 1 unlocks at", "Level 3");
  await choose("Spell 1 spell level", "1st");
  await choose("Spell 1", "Shield");
  fireEvent.click(screen.getByRole("button", { name: "Add a feature" }));
  type("Feature 1 name", "Bite");
  await choose("Feature 1 type", "Bonus Action");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });

  expect(stored("Default Option Source", "lizard")).toEqual({
    "~:name": "Lizard",
    "~:key": "~:lizard",
    "~:option-pack": "Default Option Source",
    "~:help": "Scaly.",
    "~:size": "~:small",
    "~:speed": 25,
    "~:languages": { "~#set": [] },
    "~:props": {
      "~:swimming-speed": 30,
      "~:lizardfolk-ac": true,
      "~:weapon-prof": { "~:simple": true, "~:dart": false },
      "~:armor-prof": { "~:shields": true },
      "~:damage-resistance": { "~:poison": true },
      "~:damage-immunity": { "~:fire": true },
      "~:skill-prof": { "~:stealth": true },
    },
    "~:profs": {
      "~:tool": { "~:thieves-tools": true },
      "~:skill-options": { "~:choose": 2, "~:options": { "~:survival": true } },
      "~:language-options": { "~:options": { "~:draconic": true } },
      "~:weapon-proficiency-options": { "~:options": { "~:rapier": true } },
    },
    "~:spells": [{ "~:level": 3, "~:value": { "~:level": 1, "~:key": "~:shield" } }],
    "~:traits": [{ "~:name": "Bite", "~:type": "~:b-action" }],
  });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
});

test("Add a spell alone shows a blank row and stores nothing; its X takes the row away", async () => {
  const router = renderAt("/content/new/race");
  const add = await screen.findByRole("button", { name: "Add a spell" });
  type("Name", "Tidekin");
  expect(screen.queryByRole("combobox", { name: "Spell 1" })).toBeNull();
  fireEvent.click(add);
  expect(screen.getByRole("combobox", { name: "Spell 1" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Delete spell 1" }));
  expect(screen.queryByRole("combobox", { name: "Spell 1" })).toBeNull();
  fireEvent.click(add);
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });

  expect(stored("Default Option Source", "tidekin")).toEqual({
    "~:name": "Tidekin",
    "~:key": "~:tidekin",
    "~:option-pack": "Default Option Source",
    "~:size": "~:medium",
    "~:speed": 30,
    "~:languages": { "~#set": [] },
    "~:traits": [],
  });
});

test("a new race shows only the common modifiers, with the add button after Spells and before Features", async () => {
  renderAt("/content/new/race");
  await screen.findByRole("button", { name: "Add a spell" });
  expect(groups()).toEqual([...COMMON, "Features"]);
  expect(screen.queryByRole("combobox", { name: "Flying speed" })).toBeNull();
  const add = screen.getByRole("button", { name: "Add a modifier" });
  const spells = screen.getByRole("group", { name: "Spells" });
  const features = screen.getByRole("group", { name: "Features" });
  expect(spells.compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(add.compareDocumentPosition(features) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(add);
  const dialog = await screen.findByRole("dialog", { name: "Add a modifier" });
  const rows = within(dialog).getAllByRole("button").filter((b) => b.classList.contains("ui-list-row"));
  expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual(ADDED);
  fireEvent.click(rows[0]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  // Flying speed goes directly after the base fields, and its select takes the focus.
  expect(groups()).toEqual(["Flying speed", ...COMMON, "Features"]);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Flying speed" })));
  expect(shown("Flying speed")).toBe("0");
});

test("an imported race opens with each modifier that holds a value, and a save keeps the values of the others", async () => {
  const item = {
    "~:name": "Reefborn",
    "~:key": "~:reefborn",
    "~:option-pack": "Reef",
    "~:size": "~:medium",
    "~:speed": 30,
    "~:languages": { "~#set": [] },
    "~:props": {
      "~:flying-speed": 0,
      "~:swimming-speed": 30,
      "~:weapon-prof": { "~:dart": false, "~:simple": false },
      "~:armor-prof": { "~:shields": true },
      "~:tortle-ac": false,
    },
    "~:profs": { "~:skill-options": { "~:options": { "~:stealth": false } }, "~:tool": { "~:thieves-tools": true } },
    "~:traits": [],
  };
  await useHomebrew.getState().saveItem("Reef", "~:orcpub.dnd.e5/races", item);
  const router = renderAt("/content/edit/race/Reef/reefborn");
  await screen.findByRole("button", { name: "Add a spell" });
  expect(groups()).toEqual(["Swimming speed", "Ability Score Increases", "Languages", "Armor Proficiency", "Tool Proficiency", "Damage Resistances", "Language Proficiency Choice", "Spells", "Features"]);
  expect(shown("Swimming speed")).toBe("30");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("Reef", "reefborn")).toEqual(item);
});

test("Remove on a race modifier clears its values and leaves no empty map; Undo puts them back", async () => {
  const router = renderAt("/content/new/race");
  await screen.findByRole("button", { name: "Add a spell" });
  type("Name", "Shellback");
  await addModifier("Tool Proficiency");
  await pick("Tool Proficiency", "Add a tool", "Thieves' Tools");
  await addModifier("Armor Class");
  await choose("Armor Class", "Always 17");
  fireEvent.click(screen.getByRole("button", { name: "Remove Tool Proficiency" }));
  expect(screen.getByRole("status").textContent).toMatch(/Removed Tool Proficiency\./);
  fireEvent.click(screen.getByRole("button", { name: "Remove Armor Class" }));
  expect(screen.getByRole("status").textContent).toMatch(/Removed Armor Class\./);
  fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Undo" }));
  expect(shown("Armor Class")).toBe("Always 17");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("Default Option Source", "shellback")).toEqual({
    "~:name": "Shellback",
    "~:key": "~:shellback",
    "~:option-pack": "Default Option Source",
    "~:size": "~:medium",
    "~:speed": 30,
    "~:languages": { "~#set": [] },
    "~:props": { "~:tortle-ac": true },
    "~:traits": [],
  });
});

test("an imported race with both Armor Class values true and false values opens, saves and stays equal; a pick of the select then changes the stored values", async () => {
  const item = {
    "~:name": "Shellkin",
    "~:key": "~:shellkin",
    "~:option-pack": "Reef",
    "~:size": "~:medium",
    "~:speed": 30,
    "~:languages": { "~#set": ["Aquan", "Common"] },
    "~:props": {
      "~:lizardfolk-ac": true,
      "~:tortle-ac": true,
      "~:weapon-prof": { "~:simple": false, "~:trident": true, "~:an-old-weapon": true },
      "~:armor-prof": { "~:light": false, "~:shields": true },
      "~:damage-resistance": { "~:fire": false, "~:cold": true },
      "~:damage-immunity": { "~:poison": false },
      "~:skill-prof": { "~:athletics": true, "~:stealth": false },
    },
    "~:profs": {
      "~:tool": { "~:thieves-tools": false, "~:navigators-tools": true },
      "~:skill-options": { "~:choose": 2, "~:options": { "~:survival": true, "~:history": false } },
      "~:language-options": { "~:options": { "~:aquan": false } },
      "~:weapon-proficiency-options": { "~:choose": 1, "~:options": { "~:net": true } },
    },
    "~:traits": [],
  };
  await useHomebrew.getState().saveItem("Reef", "~:orcpub.dnd.e5/races", item);
  let router = renderAt("/content/edit/race/Reef/shellkin");
  await screen.findByRole("button", { name: "Add a spell" });
  expect(groups()).toEqual([
    "Armor Class",
    "Ability Score Increases",
    "Languages",
    "Weapon Proficiencies",
    "Armor Proficiency",
    "Tool Proficiency",
    "Damage Resistances",
    "Skill Proficiencies",
    "Skill Proficiency Choice",
    "Language Proficiency Choice",
    "Weapon Proficiency Choice",
    "Spells",
    "Features",
  ]);
  // :tortle-ac sets the AC to 17 whatever the armor, so the select shows it.
  expect(shown("Armor Class")).toBe("Always 17");
  // Aquan is not an SRD language; it shows no token, and stays in the set.
  expect(tokens("Languages")).toEqual(["Common"]);
  expect(tokens("Weapon Proficiencies")).toEqual(["Trident"]);
  expect(tokens("Tool Proficiency")).toEqual(["Navigator's Tools"]);
  expect([tokens("Skill Proficiency Choice"), tokens("Weapon Proficiency Choice"), tokens("Language Proficiency Choice")]).toEqual([["Survival"], ["Net"], []]);
  expect([shown("Skill Proficiency Choice: choose"), checked("Armor Proficiency", "Shields"), checked("Armor Proficiency", "Light armor")]).toEqual(["2", true, false]);
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("Reef", "shellkin")).toEqual(item);

  cleanup();
  router = renderAt("/content/edit/race/Reef/shellkin");
  await screen.findByRole("button", { name: "Add a spell" });
  await choose("Armor Class", "13 + DEX");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  // As the old second click on the 17 box: the picked key stays true, and the other becomes false.
  expect(stored("Reef", "shellkin")).toEqual({ ...item, "~:props": { ...item["~:props"], "~:tortle-ac": false } });
});

test("in each race group a pick then a remove stores what the old double click stored", async () => {
  const router = renderAt("/content/new/race");
  await screen.findByRole("button", { name: "Add a spell" });
  type("Name", "Glassback");
  for (const name of ADDED.filter((name) => name !== "Flying speed" && name !== "Swimming speed")) await addModifier(name);
  // 13 + DEX, then Always 17, then Normal: as the clicks on, off, on, off of the two old boxes.
  await choose("Armor Class", "13 + DEX");
  await choose("Armor Class", "Always 17");
  await choose("Armor Class", "Normal");
  await pick("Languages", "Add a language", ["Elvish", "Common"]);
  await unpick("Languages", "Elvish");
  await unpick("Languages", "Common");
  check("Armor Proficiency", "Heavy armor");
  check("Armor Proficiency", "Heavy armor");
  for (const [group, add, name] of [
    ["Weapon Proficiencies", "Add a weapon", "All martial weapons"],
    ["Tool Proficiency", "Add a tool", "Smith's Tools"],
    ["Damage Resistances", "Add a damage resistance", "Damage from traps"],
    ["Damage Immunities", "Add a damage immunity", "Necrotic"],
    ["Skill Proficiencies", "Add a skill", "Arcana"],
    ["Skill Proficiency Choice", "Add a skill option", "Nature"],
    ["Language Proficiency Choice", "Add a language option", "Giant"],
    ["Weapon Proficiency Choice", "Add a weapon option", "Whip"],
  ]) {
    await pick(group, add, name);
    expect(tokens(group)).toEqual([name]);
    await unpick(group, name);
  }
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("Default Option Source", "glassback")).toEqual({
    "~:name": "Glassback",
    "~:key": "~:glassback",
    "~:option-pack": "Default Option Source",
    "~:size": "~:medium",
    "~:speed": 30,
    "~:languages": { "~#set": [] },
    "~:props": {
      "~:lizardfolk-ac": false,
      "~:tortle-ac": false,
      "~:weapon-prof": { "~:martial": false },
      "~:armor-prof": { "~:heavy": false },
      "~:damage-resistance": { "~:traps": false },
      "~:damage-immunity": { "~:necrotic": false },
      "~:skill-prof": { "~:arcana": false },
    },
    "~:profs": {
      "~:tool": { "~:smiths-tools": false },
      "~:skill-options": { "~:options": { "~:nature": false } },
      "~:language-options": { "~:options": { "~:giant": false } },
      "~:weapon-proficiency-options": { "~:options": { "~:whip": false } },
    },
    "~:traits": [],
  });
});
