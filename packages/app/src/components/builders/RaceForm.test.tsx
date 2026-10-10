import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt } from "../../engine/content.ts";
import { engine, loadEngine } from "../../engine/engine.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";

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
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const check = (group: string, label: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByLabelText(label));
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
const stored = (pack: string, key: string) => {
  const plugin = useHomebrew.getState().packs.find((p) => p.id === pack)?.plugin;
  return plugin && itemAt(plugin, "~:orcpub.dnd.e5/races", `~:${key}`);
};

test("the name problem shows under its field, and Save is off until the race has a name", async () => {
  renderAt("/content/new/race");
  await screen.findByLabelText("Spell 1");
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
  await screen.findByLabelText("Spell 1");
  type("Option source (pack)", "me");
  type("Name", "Mezzoloth");
  type("Darkvision", "60");
  type("Constitution", "2");
  check("Languages", "Common");
  check("Languages", "Infernal");
  type("Spell 1 spellcasting ability", "~:orcpub.dnd.e5.character/cha");
  type("Spell 1", "~:message");
  type("Spell 2 level", "2");
  type("Spell 2 spellcasting ability", "~:orcpub.dnd.e5.character/cha");
  type("Spell 2", "~:darkness");
  // A third spell, deleted again.
  type("Spell 3", "~:light");
  fireEvent.click(screen.getByRole("button", { name: "Delete spell 3" }));
  fireEvent.click(screen.getByRole("button", { name: "Add feature / trait" }));
  fireEvent.click(screen.getByRole("button", { name: "Add feature / trait" }));
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

  cleanup();
  renderAt("/content/edit/race/me/mezzoloth");
  await screen.findByRole("form", { name: "Edit race" });
  await screen.findByLabelText("Spell 1");
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Mezzoloth");
  expect(screen.getByLabelText<HTMLSelectElement>("Darkvision").value).toBe("60");
  expect(screen.getByLabelText<HTMLSelectElement>("Constitution").value).toBe("2");
  expect(within(screen.getByRole("group", { name: "Languages" })).getByLabelText<HTMLInputElement>("Infernal").checked).toBe(true);
  expect(screen.getByLabelText<HTMLSelectElement>("Spell 2").value).toBe("~:darkness");
  expect(screen.getByLabelText<HTMLTextAreaElement>("Feature 2 description").value).toMatch(/^You have four arms/);
  expect(save().disabled).toBe(false);
});

test("the modifiers are stored as the old events store them", async () => {
  const router = renderAt("/content/new/race");
  await screen.findByLabelText("Spell 1");
  type("Name", "Lizard");
  type("Description", "Scaly.");
  type("Size", "~:small");
  type("Speed", "25");
  type("Swimming speed", "30");
  check("Armor Class", "Without armor your AC becomes 13 + your DEX modifier.");
  check("Weapon Proficiencies", "All Simple Weapons");
  check("Weapon Proficiencies", "Dart");
  check("Weapon Proficiencies", "Dart");
  check("Armor Proficiency", "You gain proficiency with shields");
  check("Tool Proficiency", "Thieves' Tools");
  check("Damage Resistances", "Resistance to poison damage");
  check("Damage Immunities", "Immunity to fire damage");
  check("Skill Proficiencies", "Stealth");
  type("Skill Proficiency Choice: choose", "2");
  check("Skill Proficiency Choice: options", "Survival");
  check("Language Proficiency Choice: options", "Draconic");
  check("Weapon Proficiency Choice: options", "Rapier");
  type("Spell 1 unlock at level", "3");
  type("Spell 1 level", "1");
  type("Spell 1", "~:shield");
  fireEvent.click(screen.getByRole("button", { name: "Add feature / trait" }));
  type("Feature 1 name", "Bite");
  type("Feature 1 type", "~:b-action");
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
