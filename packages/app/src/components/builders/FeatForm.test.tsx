import "fake-indexeddb/auto";
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
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const check = (group: string, label: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByLabelText(label));
const checked = (group: string, label: string) => within(screen.getByRole("group", { name: group })).getByLabelText<HTMLInputElement>(label).checked;
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
const stored = (key: string) => {
  const plugin = useHomebrew.getState().packs.find((p) => p.id === DEFAULT)?.plugin;
  return plugin && itemAt(plugin, "~:orcpub.dnd.e5/feats", `~:${key}`);
};

test("the name problem shows under its field, and Save is off until the feat has a name", async () => {
  renderAt("/content/new/feat");
  await screen.findByRole("group", { name: "Race prerequisites" });
  expect(problems("Name")).toBe("Name is required.");
  expect(save().disabled).toBe(true);
  type("Name", "1 Mind");
  expect(problems("Name")).toBe("Name must start with a letter.");
  type("Name", "Keen Mind");
  expect(problems("Name")).toBeNull();
  expect(save().disabled).toBe(false);
});

test("each field is stored as the old events store it, and Edit loads it back", async () => {
  const router = renderAt("/content/new/feat");
  await screen.findByRole("group", { name: "Race prerequisites" });
  type("Name", "Sea Legs");
  type("Description", "Steady on deck.");
  check("Prerequisites", "The ability to cast at least one spell");
  check("Prerequisites", "Dexterity 13 or higher");
  check("Prerequisites", "Proficiency with medium armor");
  check("Prerequisites", "The ability to cast at least one spell");
  check("Race prerequisites", "Elf race");
  check("Race prerequisites", "Dwarf race");
  check("Race prerequisites", "Dwarf race");
  check("Ability Increase Options", "Strength");
  check("Ability Increase Options", "Constitution");
  check("Ability Increase Options", "You also gain proficiency in saving throws with the above chosen abilities");
  check("Skill or Tool Proficiency", "You gain proficiency in 2 skills or tools of your choice");
  check("Languages", "You learn 1 languages of your choice.");
  check("Languages", "You learn 1 languages of your choice.");
  check("Weapon Proficiency", "You gain proficiency with improvised weapons");
  check("Weapon Proficiency Choice", "You gain proficiency with 4 weapons of your choice");
  check("Armor Proficiency", "You gain proficiency with light armor");
  check("Medium Armor", "Wearing medium armor doesn't give disadvantage on Stealth checks");
  check("Medium Armor", "Wearing medium armor doesn't give disadvantage on Stealth checks");
  check("Hit Points", "Your hit point maximum increases by 2 for each of your levels");
  check("Damage Resistances", "Resistance to cold damage");
  check("Speed Bonuses", "Your speed is increased by 10 ft.");
  check("Initiative Bonuses", "You gain a +5 bonus to initiative");
  check("Misc. Modifiers", "You gain a +5 to your passive Perception");
  check("Spellcasting", "Choose a class, gain (2) 1st-level ritual spells from that class's spell list");
  check("Skill Proficiency or Expertise", "Athletics");
  check("Tool Proficiency or Expertise", "Navigator's Tools");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });

  expect(stored("sea-legs")).toEqual({
    "~:name": "Sea Legs",
    "~:key": "~:sea-legs",
    "~:option-pack": DEFAULT,
    "~:description": "Steady on deck.",
    "~:prereqs": { "~#set": ["~:orcpub.dnd.e5.character/dex", "~:medium"] },
    "~:path-prereqs": { "~:race": { "~:elf": true, "~:dwarf": false } },
    "~:ability-increases": { "~#set": ["~:orcpub.dnd.e5.character/str", "~:orcpub.dnd.e5.character/con", "~:saves?"] },
    "~:props": {
      "~:skill-tool-choice": 2,
      "~:improvised-weapons-prof": true,
      "~:weapon-prof-choice": 4,
      "~:armor-prof": { "~:light": true },
      "~:medium-armor-stealth": false,
      "~:max-hp-bonus": 2,
      "~:damage-resistance": { "~:cold": true },
      "~:speed": 10,
      "~:initiative": 5,
      "~:passive-perception-5": true,
      "~:ritual-casting": true,
      "~:skill-prof-or-expertise": { "~:athletics": true },
      "~:tool-prof-or-expertise": { "~:navigators-tools": true },
    },
  });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);

  cleanup();
  renderAt(`/content/edit/feat/${encodeURIComponent(DEFAULT)}/sea-legs`);
  await screen.findByRole("form", { name: "Edit feat" });
  await screen.findByRole("group", { name: "Race prerequisites" });
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Sea Legs");
  expect(screen.getByLabelText<HTMLTextAreaElement>("Description").value).toBe("Steady on deck.");
  expect([
    checked("Prerequisites", "Dexterity 13 or higher"),
    checked("Prerequisites", "The ability to cast at least one spell"),
    checked("Race prerequisites", "Elf race"),
    checked("Ability Increase Options", "Constitution"),
    checked("Initiative Bonuses", "You gain a +5 bonus to initiative"),
    checked("Medium Armor", "Wearing medium armor doesn't give disadvantage on Stealth checks"),
    checked("Tool Proficiency or Expertise", "Navigator's Tools"),
  ]).toEqual([true, false, true, true, true, false, true]);
  expect(save().disabled).toBe(false);
});
