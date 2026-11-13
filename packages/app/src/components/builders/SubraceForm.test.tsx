import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { optionNames } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt, withoutDisabledFlag } from "../../engine/content.ts";
import { engine, loadEngine } from "../../engine/engine.ts";
import { exportOrcbrew } from "../../engine/orcbrew-export.ts";
import { orcbrewHomebrew, useHomebrew } from "../../state/homebrew.ts";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";
import { addList, addModifier, choose, groups, pick, press, pressed, shown, tokens, unpick } from "./test-picks.ts";

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
/** The modifiers of the add list, in form order. */
const ADDED = [
  "Hit Points",
  "Damage Resistances",
  "Damage Immunities",
  "Saving Throw Advantage",
  "Weapon Proficiencies",
  "Armor Proficiency",
  "Tool Proficiency",
  "Skill Proficiencies",
  "Skill Proficiency Choice",
  "Languages",
];
const stored = (pack: string, key: string) => {
  const plugin = useHomebrew.getState().packs.find((p) => p.id === pack)?.plugin;
  return plugin && itemAt(plugin, "~:orcpub.dnd.e5/subraces", `~:${key}`);
};

test("the race list has the SRD races and the enabled packs' races, and the race's values show until the subrace has its own", async () => {
  await useHomebrew.getState().saveItem("Lizards", "~:orcpub.dnd.e5/races", { "~:key": "~:lizard", "~:name": "Lizard", "~:option-pack": "Lizards", "~:speed": 40, "~:size": "~:small" });
  renderAt("/content/new/subrace");
  await screen.findByRole("button", { name: "Add a spell" });
  const races = await optionNames(screen.getByRole("combobox", { name: "Race" }));
  expect(races).toEqual(expect.arrayContaining(["Dwarf", "Elf", "Tiefling", "Lizard"]));
  expect(races).not.toContain("Custom");

  // The new subrace is a dwarf's: speed 25, darkvision 60, Con +2.
  expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  expect(screen.queryByRole("list", { name: "Problems: Name" })?.textContent).toBe("Name is required.");
  expect([shown("Race"), shown("Size"), shown("Speed"), shown("Darkvision")]).toEqual(["Dwarf", "medium", "25", "60"]);
  expect(screen.getByText("Race bonus 2, total 2")).toBeTruthy();
  await choose("Race", "Lizard");
  expect([shown("Size"), shown("Speed")]).toEqual(["small", "40"]);
  await choose("Speed", "35");
  await choose("Race", "Elf");
  expect(shown("Speed")).toBe("35");
});

test("the form recreates the Star Elf subrace of the community fixture, and Edit loads it back", async () => {
  const router = renderAt("/content/new/subrace");
  await screen.findByRole("button", { name: "Add a spell" });
  type("Option source (pack)", "dand wiki");
  type("Name", "Star Elf");
  await choose("Race", "Elf");
  await choose("Wisdom", "+1");
  await addModifier("Weapon Proficiencies");
  await addModifier("Skill Proficiencies");
  await pick("Weapon Proficiencies", "Add a weapon", ["Dart", "Morningstar", "Rapier", "Shortbow"]);
  await pick("Skill Proficiencies", "Add a skill", "Insight");
  fireEvent.click(screen.getByRole("button", { name: "Add a spell" }));
  await choose("Spell 1 spellcasting ability", "Wisdom");
  await choose("Spell 1", "Guidance");
  fireEvent.click(screen.getByRole("button", { name: "Add a spell" }));
  await choose("Spell 2 unlocks at", "Level 3");
  await choose("Spell 2 spell level", "1st");
  await choose("Spell 2 spellcasting ability", "Wisdom");
  await choose("Spell 2", "Detect Magic");
  fireEvent.click(screen.getByRole("button", { name: "Add a spell" }));
  await choose("Spell 3 unlocks at", "Level 5");
  await choose("Spell 3 spell level", "2nd");
  await choose("Spell 3 spellcasting ability", "Wisdom");
  await choose("Spell 3", "Detect Thoughts");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });

  const parsed = engine().parseOrcbrew(readFileSync(join(orcbrewDir, "community-dandwiki-star-elf.orcbrew"), "utf8")).data as Record<string, object>;
  const fixture = itemAt(parsed["Imported Content"], "~:orcpub.dnd.e5/subraces", "~:star-elf");
  expect(fixture).toHaveProperty("~:name", "Star Elf");
  const plugin = useHomebrew.getState().packs.find((p) => p.id === "dand wiki")!.plugin;
  // The old save changes nothing that the fixture does not have, so nothing is normalized.
  expect(itemAt(plugin, "~:orcpub.dnd.e5/subraces", "~:star-elf")).toEqual(fixture);
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
  // My Content's .orcbrew export of the pack reads back as the fixture's pack, without the old pack flag the fixture carries.
  const exported = exportOrcbrew(orcbrewHomebrew(), { pack: "dand wiki" });
  if (!("text" in exported)) throw new Error("The pack did not export");
  expect(engine().parseOrcbrew(exported.text, { name: "dand wiki" }).data!["dand wiki"]).toEqual(withoutDisabledFlag(parsed["Imported Content"]));

  cleanup();
  renderAt(`/content/edit/subrace/${encodeURIComponent("dand wiki")}/star-elf`);
  await screen.findByRole("form", { name: "Edit subrace" });
  await screen.findByRole("button", { name: "Add a spell" });
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe("Star Elf");
  expect([shown("Race"), shown("Wisdom"), shown("Spell 2 unlocks at"), shown("Spell 3")]).toEqual(["Elf", "+1", "Level 3", "Detect Thoughts"]);
  // In the order of the weapon list, not of the picks.
  expect(tokens("Weapon Proficiencies")).toEqual(["Dart", "Shortbow", "Morningstar", "Rapier"]);
  expect(save().disabled).toBe(false);
});

test("the subrace modifiers are stored as the old events store them", async () => {
  const router = renderAt("/content/new/subrace");
  await screen.findByRole("button", { name: "Add a spell" });
  type("Name", "Deep Dwarf");
  await choose("Darkvision", "120");
  for (const name of ADDED) await addModifier(name);
  press("Hit Points", "1");
  press("Hit Points", "2");
  await pick("Saving Throw Advantage", "Add a condition", "Poisoned");
  await pick("Languages", "Add a language", "Undercommon");
  await pick("Damage Resistances", "Add a damage resistance", "Damage from traps");
  await pick("Damage Immunities", "Add a damage immunity", "Poison");
  await pick("Weapon Proficiencies", "Add a weapon", "All martial weapons");
  await unpick("Weapon Proficiencies", "All martial weapons");
  check("Armor Proficiency", "Medium armor");
  await pick("Tool Proficiency", "Add a tool", "Smith's Tools");
  await pick("Skill Proficiencies", "Add a skill", "Perception");
  await choose("Skill Proficiency Choice: choose", "2");
  await pick("Skill Proficiency Choice", "Add a skill option", "History");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });

  const plugin = useHomebrew.getState().packs.find((p) => p.id === "Default Option Source")!.plugin;
  expect(itemAt(plugin, "~:orcpub.dnd.e5/subraces", "~:deep-dwarf")).toEqual({
    "~:name": "Deep Dwarf",
    "~:key": "~:deep-dwarf",
    "~:option-pack": "Default Option Source",
    "~:race": "~:dwarf",
    "~:darkvision": 120,
    "~:traits": [],
    "~:props": {
      "~:max-hp-bonus": 2,
      "~:damage-resistance": { "~:traps": true },
      "~:damage-immunity": { "~:poison": true },
      "~:saving-throw-advantage": { "~:poisoned": true },
      "~:weapon-prof": { "~:martial": false },
      "~:armor-prof": { "~:medium": true },
      "~:skill-prof": { "~:perception": true },
      "~:language": { "~:undercommon": true },
    },
    "~:profs": { "~:tool": { "~:smiths-tools": true }, "~:skill-options": { "~:choose": 2, "~:options": { "~:history": true } } },
  });
});

test("a new subrace shows only the common modifiers, and the add list has the others in form order", async () => {
  renderAt("/content/new/subrace");
  await screen.findByRole("button", { name: "Add a spell" });
  expect(groups()).toEqual(["Ability Score Increases", "Spells", "Features"]);
  expect(await addList()).toEqual(ADDED);
  await addModifier("Damage Immunities");
  await addModifier("Hit Points");
  expect(groups()).toEqual(["Ability Score Increases", "Hit Points", "Damage Immunities", "Spells", "Features"]);
});

test("an imported subrace opens with each modifier that holds a value, and a save keeps the values of the others", async () => {
  const item = {
    "~:name": "Sea Elf",
    "~:key": "~:sea-elf",
    "~:option-pack": "Reef",
    "~:race": "~:elf",
    "~:props": {
      "~:max-hp-bonus": 1,
      "~:weapon-prof": { "~:trident": false, "~:net": false },
      "~:damage-resistance": { "~:cold": true, "~:fire": false },
      "~:saving-throw-advantage": { "~:charmed": false },
      "~:language": { "~:aquan": false },
      "~:armor-prof": { "~:light": false },
    },
    "~:profs": { "~:skill-options": { "~:options": { "~:stealth": false } }, "~:tool": { "~:navigators-tools": true } },
    "~:traits": [],
  };
  await useHomebrew.getState().saveItem("Reef", "~:orcpub.dnd.e5/subraces", item);
  const router = renderAt("/content/edit/subrace/Reef/sea-elf");
  await screen.findByRole("button", { name: "Add a spell" });
  expect(groups()).toEqual(["Ability Score Increases", "Hit Points", "Damage Resistances", "Tool Proficiency", "Spells", "Features"]);
  expect(pressed("Hit Points")).toBe("1");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("Reef", "sea-elf")).toEqual(item);
});

test("in each subrace group a pick then a remove stores what the old double click stored", async () => {
  const router = renderAt("/content/new/subrace");
  await screen.findByRole("button", { name: "Add a spell" });
  type("Name", "Glass Dwarf");
  for (const name of ADDED) await addModifier(name);
  press("Hit Points", "2");
  press("Hit Points", "None");
  check("Armor Proficiency", "Light armor");
  check("Armor Proficiency", "Light armor");
  for (const [group, add, name] of [
    ["Damage Resistances", "Add a damage resistance", "Acid"],
    ["Damage Immunities", "Add a damage immunity", "Cold"],
    ["Saving Throw Advantage", "Add a condition", "Frightened"],
    ["Weapon Proficiencies", "Add a weapon", "Warhammer"],
    ["Tool Proficiency", "Add a tool", "Mason's Tools"],
    ["Skill Proficiencies", "Add a skill", "History"],
    ["Skill Proficiency Choice", "Add a skill option", "Insight"],
    ["Languages", "Add a language", "Dwarvish"],
  ]) {
    await pick(group, add, name);
    expect(tokens(group)).toEqual([name]);
    await unpick(group, name);
  }
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("Default Option Source", "glass-dwarf")).toEqual({
    "~:name": "Glass Dwarf",
    "~:key": "~:glass-dwarf",
    "~:option-pack": "Default Option Source",
    "~:race": "~:dwarf",
    "~:traits": [],
    "~:props": {
      "~:armor-prof": { "~:light": false },
      "~:damage-resistance": { "~:acid": false },
      "~:damage-immunity": { "~:cold": false },
      "~:saving-throw-advantage": { "~:frightened": false },
      "~:weapon-prof": { "~:warhammer": false },
      "~:skill-prof": { "~:history": false },
      "~:language": { "~:dwarvish": false },
    },
    "~:profs": { "~:tool": { "~:masons-tools": false }, "~:skill-options": { "~:options": { "~:insight": false } } },
  });
});
