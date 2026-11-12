import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { pickFromPicker } from "@orc-alchemy/ui/testing";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt } from "../../engine/content.ts";
import { engine, loadEngine } from "../../engine/engine.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";
import { addModifier } from "./test-picks.ts";

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
const check = (group: string, label: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("checkbox", { name: label }));
/** Whether the checkbox is checked, for a check of several boxes at once. */
const checked = (group: string, label: string) => within(screen.getByRole("group", { name: group })).getByRole("checkbox", { name: label }).getAttribute("aria-checked") === "true";
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
/** The names of the form's sections, in their order: the groups at the top level of the form. */
const groups = () => screen.getAllByRole("group").filter((g) => g.parentElement?.closest("fieldset, [role=group]") === null).map((g) => g.getAttribute("aria-label") ?? g.querySelector(".ui-fieldset-legend")?.textContent);
const COMMON = ["Prerequisites", "Race prerequisites", "Ability Increase Options"];
/** The modifiers of the add list, in form order. */
const ADDED = [
  "Skill or Tool Proficiency",
  "Languages",
  "Weapon Proficiency",
  "Weapon Proficiency Choice",
  "Armor Proficiency",
  "Medium Armor",
  "Hit Points",
  "Damage Resistances",
  "Speed Bonuses",
  "Initiative Bonuses",
  "Misc. Modifiers",
  "Spellcasting",
  "Skill Proficiency or Expertise",
  "Tool Proficiency or Expertise",
];
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
  for (const name of ADDED) await addModifier(name);
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
  const edit = renderAt(`/content/edit/feat/${encodeURIComponent(DEFAULT)}/sea-legs`);
  await screen.findByRole("form", { name: "Edit feat" });
  await screen.findByRole("group", { name: "Race prerequisites" });
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe("Sea Legs");
  expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Description" }).value).toBe("Steady on deck.");
  expect([
    checked("Prerequisites", "Dexterity 13 or higher"),
    checked("Prerequisites", "The ability to cast at least one spell"),
    checked("Race prerequisites", "Elf race"),
    checked("Ability Increase Options", "Constitution"),
    checked("Initiative Bonuses", "You gain a +5 bonus to initiative"),
    checked("Tool Proficiency or Expertise", "Navigator's Tools"),
  ]).toEqual([true, false, true, true, true, true]);
  // Medium Armor holds only false, and Languages nothing, so they are not on the form.
  expect(groups()).toEqual([...COMMON, ...ADDED.filter((name) => name !== "Languages" && name !== "Medium Armor")]);
  // A save keeps the values of a modifier that is not on the form.
  const before = stored("sea-legs");
  fireEvent.click(save());
  await waitFor(() => expect(edit.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("sea-legs")).toEqual(before);
});

test("a new feat shows only the common modifiers; the add list has the others in form order, each with a short example", async () => {
  renderAt("/content/new/feat");
  await screen.findByRole("group", { name: "Race prerequisites" });
  expect(groups()).toEqual(COMMON);
  expect(screen.queryByRole("heading", { name: "Modifiers" })).toBeNull();
  // A common modifier has no Remove link.
  expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
  const add = screen.getByRole("button", { name: "Add a modifier" });
  expect(add.getAttribute("aria-haspopup")).toBe("dialog");
  expect(add.textContent).toMatch(/14 more$/);
  fireEvent.click(add);
  const dialog = await screen.findByRole("dialog", { name: "Add a modifier" });
  const rows = within(dialog).getAllByRole("button").filter((b) => b.classList.contains("ui-list-row"));
  expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual(ADDED);
  expect(rows.every((row) => (document.getElementById(row.getAttribute("aria-describedby") ?? "")?.textContent ?? "") !== "")).toBe(true);
  expect(within(dialog).queryByRole("searchbox")).toBeNull();
  expect(within(dialog).queryByRole("button", { name: "Done" })).toBeNull();
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(groups()).toEqual(COMMON);
});

test("an added modifier goes to its place in form order, flashes once and takes the focus; it leaves the add list", async () => {
  renderAt("/content/new/feat");
  await screen.findByRole("group", { name: "Race prerequisites" });
  await addModifier("Speed Bonuses");
  await addModifier("Hit Points");
  expect(groups()).toEqual([...COMMON, "Hit Points", "Speed Bonuses"]);
  const hp = screen.getByRole("group", { name: "Hit Points" });
  expect(hp.closest("[data-modifier]")?.classList.contains("ui-flash")).toBe(true);
  expect(screen.getByRole("group", { name: "Speed Bonuses" }).closest("[data-modifier]")?.classList.contains("ui-flash")).toBe(false);
  await waitFor(() => expect(document.activeElement).toBe(within(hp).getByRole("checkbox", { name: "Your hit point maximum increases by 1 for each of your levels" })));
  expect(within(hp).getByRole("button", { name: "Remove Hit Points" }).textContent).toBe("Remove");
  fireEvent.click(screen.getByRole("button", { name: "Add a modifier" }));
  const dialog = await screen.findByRole("dialog", { name: "Add a modifier" });
  const rows = within(dialog).getAllByRole("button").filter((b) => b.classList.contains("ui-list-row"));
  expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual(ADDED.filter((name) => name !== "Hit Points" && name !== "Speed Bonuses"));
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("the stored feat after Add and a pick is as the old layout stored it; Remove clears the values, and Undo puts them back", async () => {
  const router = renderAt("/content/new/feat");
  await screen.findByRole("group", { name: "Race prerequisites" });
  type("Name", "Tough Hide");
  await addModifier("Hit Points");
  check("Hit Points", "Your hit point maximum increases by 2 for each of your levels");
  await addModifier("Damage Resistances");
  check("Damage Resistances", "Resistance to fire damage");
  check("Damage Resistances", "Resistance to fire damage");

  // Remove: the section goes, an info note with Undo shows, and the focus goes to Undo.
  fireEvent.click(screen.getByRole("button", { name: "Remove Hit Points" }));
  expect(screen.queryByRole("group", { name: "Hit Points" })).toBeNull();
  const note = screen.getByRole("status");
  expect(note.textContent).toMatch(/Removed Hit Points\. ?Undo/);
  const undo = within(note).getByRole("button", { name: "Undo" });
  await waitFor(() => expect(document.activeElement).toBe(undo));

  // Undo: the section and its value come back, with the focus on its first control.
  fireEvent.click(undo);
  const hp = screen.getByRole("group", { name: "Hit Points" });
  expect(within(hp).getByRole("checkbox", { name: "Your hit point maximum increases by 2 for each of your levels" })).toBeChecked();
  await waitFor(() => expect(document.activeElement).toBe(within(hp).getByRole("checkbox", { name: "Your hit point maximum increases by 1 for each of your levels" })));
  expect(screen.queryByRole("status")).toBeNull();
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  // As the old layout stored the same clicks.
  expect(stored("tough-hide")).toEqual({
    "~:name": "Tough Hide",
    "~:key": "~:tough-hide",
    "~:option-pack": DEFAULT,
    "~:ability-increases": { "~#set": [] },
    "~:props": { "~:max-hp-bonus": 2, "~:damage-resistance": { "~:fire": false } },
  });

  // Remove both, and the item is as if they were never set.
  cleanup();
  const edit = renderAt(`/content/edit/feat/${encodeURIComponent(DEFAULT)}/tough-hide`);
  await screen.findByRole("group", { name: "Race prerequisites" });
  // The resistances hold only false, so the feat opens without them.
  expect(groups()).toEqual([...COMMON, "Hit Points"]);
  fireEvent.click(screen.getByRole("button", { name: "Remove Hit Points" }));
  fireEvent.click(within(screen.getByRole("status")).getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByRole("status")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add a modifier" })));
  await pickFromPicker(screen.getByRole("button", { name: "Add a modifier" }), "Damage Resistances");
  fireEvent.click(screen.getByRole("button", { name: "Remove Damage Resistances" }));
  fireEvent.click(save());
  await waitFor(() => expect(edit.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("tough-hide")).toEqual({
    "~:name": "Tough Hide",
    "~:key": "~:tough-hide",
    "~:option-pack": DEFAULT,
    "~:ability-increases": { "~#set": [] },
  });
});

test("an added modifier stays on the form while it is empty, and a saved item opens without it", async () => {
  const router = renderAt("/content/new/feat");
  await screen.findByRole("group", { name: "Race prerequisites" });
  type("Name", "Quiet Step");
  await addModifier("Initiative Bonuses");
  check("Initiative Bonuses", "You gain a +2 bonus to initiative");
  check("Initiative Bonuses", "You gain a +2 bonus to initiative");
  expect(screen.getByRole("group", { name: "Initiative Bonuses" })).toBeTruthy();
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  cleanup();
  renderAt(`/content/edit/feat/${encodeURIComponent(DEFAULT)}/quiet-step`);
  await screen.findByRole("group", { name: "Race prerequisites" });
  expect(groups()).toEqual(COMMON);
});
