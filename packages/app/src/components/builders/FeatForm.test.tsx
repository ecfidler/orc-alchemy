import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { pickFromPicker } from "@orc-alchemy/ui/testing";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt } from "../../engine/content.ts";
import { engine, loadEngine } from "../../engine/engine.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";
import { addList, addModifier, groups, pick, press, pressed, tokens, unpick } from "./test-picks.ts";

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
const COMMON = ["Prerequisites", "Ability Increase Options"];
/** The sections after the modifiers: the always shown last modifier, then the feature list. */
const TAIL = ["Uses of the feat", "Features"];
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
const stored = (key: string, pack = DEFAULT) => {
  const plugin = useHomebrew.getState().packs.find((p) => p.id === pack)?.plugin;
  return plugin && itemAt(plugin, "~:orcpub.dnd.e5/feats", `~:${key}`);
};

test("the name problem shows under its field, and Save is off until the feat has a name", async () => {
  renderAt("/content/new/feat");
  await screen.findByRole("button", { name: "Add a prerequisite" });
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
  await screen.findByRole("button", { name: "Add a prerequisite" });
  type("Name", "Sea Legs");
  type("Description", "Steady on deck.");
  await pick("Prerequisites", "Add a prerequisite", ["The ability to cast at least one spell", "Dexterity 13 or higher", "Proficiency with medium armor", "Elf race", "Dwarf race"]);
  await unpick("Prerequisites", "The ability to cast at least one spell");
  await unpick("Prerequisites", "Dwarf race");
  check("Ability Increase Options", "Strength");
  check("Ability Increase Options", "Constitution");
  check("Ability Increase Options", "You also gain proficiency in saving throws with the above chosen abilities");
  for (const name of ADDED) await addModifier(name);
  press("Skill or Tool Proficiency", "2");
  press("Languages", "1");
  press("Languages", "None");
  await pick("Weapon Proficiency", "Add a weapon proficiency", "You gain proficiency with improvised weapons");
  press("Weapon Proficiency Choice", "4");
  check("Armor Proficiency", "Light armor");
  await pick("Medium Armor", "Add a medium armor benefit", "Wearing medium armor doesn't give disadvantage on Stealth checks");
  await unpick("Medium Armor", "Wearing medium armor doesn't give disadvantage on Stealth checks");
  press("Hit Points", "2");
  await pick("Damage Resistances", "Add a damage resistance", "Cold");
  press("Speed Bonuses", "10");
  press("Initiative Bonuses", "5");
  await pick("Misc. Modifiers", "Add a misc. modifier", "You gain a +5 to your passive Perception");
  await pick("Spellcasting", "Add a spellcasting benefit", "Choose a class, gain (2) 1st-level ritual spells from that class's spell list");
  await pick("Skill Proficiency or Expertise", "Add a skill", "Athletics");
  await pick("Tool Proficiency or Expertise", "Add a tool", "Navigator's Tools");
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
  await screen.findByRole("button", { name: "Add a prerequisite" });
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Name" }).value).toBe("Sea Legs");
  expect(screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Description" }).value).toBe("Steady on deck.");
  // The tokens are in the order of the picker list: the races at the end.
  expect(tokens("Prerequisites")).toEqual(["Dexterity 13 or higher", "Proficiency with medium armor", "Elf race"]);
  expect([checked("Ability Increase Options", "Constitution"), checked("Ability Increase Options", "Dexterity")]).toEqual([true, false]);
  expect([pressed("Initiative Bonuses"), pressed("Skill or Tool Proficiency")]).toEqual(["5", "2"]);
  expect(tokens("Tool Proficiency or Expertise")).toEqual(["Navigator's Tools"]);
  // Medium Armor holds only false, and Languages nothing, so they are not on the form.
  expect(groups()).toEqual([...COMMON, ...ADDED.filter((name) => name !== "Languages" && name !== "Medium Armor"), ...TAIL]);
  // A save keeps the values of a modifier that is not on the form.
  const before = stored("sea-legs");
  fireEvent.click(save());
  await waitFor(() => expect(edit.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("sea-legs")).toEqual(before);
});

test("a new feat shows only the common modifiers; the add list has the others in form order, each with a short example", async () => {
  renderAt("/content/new/feat");
  await screen.findByRole("button", { name: "Add a prerequisite" });
  expect(groups()).toEqual([...COMMON, ...TAIL]);
  expect(screen.queryByRole("heading", { name: "Modifiers" })).toBeNull();
  // A common modifier has no Remove link.
  expect(screen.queryByRole("button", { name: /^Remove / })).toBeNull();
  const add = screen.getByRole("button", { name: "Add a modifier" });
  expect(add.getAttribute("aria-haspopup")).toBe("dialog");
  expect(add.textContent).toMatch(/14 more$/);
  expect(await addList()).toEqual(ADDED);
  // A real click puts the focus on the button.
  add.focus();
  fireEvent.click(add);
  const dialog = await screen.findByRole("dialog", { name: "Add a modifier" });
  const rows = [...dialog.querySelectorAll(".ui-list-row")];
  expect(rows).toHaveLength(ADDED.length);
  expect(rows.every((row) => (document.getElementById(row.getAttribute("aria-describedby") ?? "")?.textContent ?? "") !== "")).toBe(true);
  expect(within(dialog).queryByRole("searchbox")).toBeNull();
  expect(within(dialog).queryByRole("button", { name: "Done" })).toBeNull();
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(groups()).toEqual([...COMMON, ...TAIL]);
  await waitFor(() => expect(document.activeElement).toBe(add));
});

test("an added modifier goes to its place in form order, flashes once and takes the focus; it leaves the add list", async () => {
  renderAt("/content/new/feat");
  await screen.findByRole("button", { name: "Add a prerequisite" });
  await addModifier("Speed Bonuses");
  await addModifier("Hit Points");
  expect(groups()).toEqual([...COMMON, "Hit Points", "Speed Bonuses", ...TAIL]);
  const hp = screen.getByRole("group", { name: "Hit Points" });
  expect(hp.closest("[data-modifier]")?.classList.contains("ui-flash")).toBe(true);
  expect(screen.getByRole("group", { name: "Speed Bonuses" }).closest("[data-modifier]")?.classList.contains("ui-flash")).toBe(false);
  // The first control is the None segment of the number toggle.
  await waitFor(() => expect(document.activeElement).toBe(within(hp).getByRole("button", { name: "None" })));
  expect(within(hp).getByRole("button", { name: "Remove Hit Points" }).textContent).toBe("Remove");
  expect(await addList()).toEqual(ADDED.filter((name) => name !== "Hit Points" && name !== "Speed Bonuses"));
});

test("the stored feat after Add and a pick is as the old layout stored it; Remove clears the values, and Undo puts them back", async () => {
  const router = renderAt("/content/new/feat");
  await screen.findByRole("button", { name: "Add a prerequisite" });
  type("Name", "Tough Hide");
  await addModifier("Hit Points");
  press("Hit Points", "2");
  await addModifier("Damage Resistances");
  await pick("Damage Resistances", "Add a damage resistance", "Fire");
  await unpick("Damage Resistances", "Fire");

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
  expect(pressed("Hit Points")).toBe("2");
  await waitFor(() => expect(document.activeElement).toBe(within(hp).getByRole("button", { name: "None" })));
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
  await screen.findByRole("button", { name: "Add a prerequisite" });
  // The resistances hold only false, so the feat opens without them.
  expect(groups()).toEqual([...COMMON, "Hit Points", ...TAIL]);
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
  await screen.findByRole("button", { name: "Add a prerequisite" });
  type("Name", "Quiet Step");
  await addModifier("Initiative Bonuses");
  press("Initiative Bonuses", "2");
  press("Initiative Bonuses", "None");
  expect(screen.getByRole("group", { name: "Initiative Bonuses" })).toBeTruthy();
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  cleanup();
  renderAt(`/content/edit/feat/${encodeURIComponent(DEFAULT)}/quiet-step`);
  await screen.findByRole("button", { name: "Add a prerequisite" });
  expect(groups()).toEqual([...COMMON, ...TAIL]);
});

test("an imported feat with false values, unknown keys and a number that is no segment opens, saves and stays equal", async () => {
  const item = {
    "~:name": "Old Salt",
    "~:key": "~:old-salt",
    "~:option-pack": "Reef",
    "~:prereqs": { "~#set": ["~:orcpub.dnd.e5.character/wis", "~:from-an-old-pack"] },
    "~:path-prereqs": { "~:race": { "~:elf": false, "~:dwarf": true } },
    "~:ability-increases": { "~#set": ["~:saves?", "~:orcpub.dnd.e5.character/wis"] },
    "~:props": {
      "~:skill-tool-choice": 2,
      "~:language-choice": 0,
      "~:initiative": 7,
      "~:improvised-weapons-prof": false,
      "~:armor-prof": { "~:light": false, "~:heavy": true },
      "~:medium-armor-stealth": false,
      "~:medium-armor-max-dex-3": true,
      "~:damage-resistance": { "~:fire": false, "~:cold": true },
      "~:two-weapon-ac-1": true,
      "~:passive-perception-5": false,
      "~:skill-prof-or-expertise": { "~:arcana": false },
      "~:tool-prof-or-expertise": { "~:thieves-tools": false, "~:an-old-kit": true },
    },
  };
  await useHomebrew.getState().saveItem("Reef", "~:orcpub.dnd.e5/feats", item);
  const router = renderAt("/content/edit/feat/Reef/old-salt");
  await screen.findByRole("button", { name: "Add a prerequisite" });
  expect(groups()).toEqual([...COMMON, "Skill or Tool Proficiency", "Armor Proficiency", "Medium Armor", "Damage Resistances", "Initiative Bonuses", "Misc. Modifiers", "Tool Proficiency or Expertise", ...TAIL]);
  expect(tokens("Prerequisites")).toEqual(["Wisdom 13 or higher", "Dwarf race"]);
  expect(tokens("Medium Armor")).toEqual(["When wearing medium armor, you can add 3 to your AC if your Dexterity is 16+"]);
  expect(tokens("Damage Resistances")).toEqual(["Cold"]);
  // 7 is no segment, so none is pressed; the key that is no tool shows no token.
  expect(pressed("Initiative Bonuses")).toBeUndefined();
  expect(tokens("Tool Proficiency or Expertise")).toEqual([]);
  expect([checked("Armor Proficiency", "Heavy armor"), checked("Ability Increase Options", "Wisdom")]).toEqual([true, true]);
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("old-salt", "Reef")).toEqual(item);
});

test("in each group a pick then a remove stores what the old double click stored", async () => {
  await useHomebrew.getState().saveItem("Reef", "~:orcpub.dnd.e5/feats", {
    "~:name": "Old Salt",
    "~:key": "~:old-salt",
    "~:option-pack": "Reef",
    "~:prereqs": { "~#set": ["~:from-an-old-pack"] },
    "~:ability-increases": { "~#set": [] },
    "~:props": { "~:initiative": 7, "~:tool-prof-or-expertise": { "~:an-old-kit": true } },
  });
  const router = renderAt("/content/edit/feat/Reef/old-salt");
  await screen.findByRole("button", { name: "Add a prerequisite" });
  for (const name of ADDED.filter((name) => !groups().includes(name))) await addModifier(name);
  await pick("Prerequisites", "Add a prerequisite", ["Strength 13 or higher", "Elf race"]);
  await unpick("Prerequisites", "Strength 13 or higher");
  await unpick("Prerequisites", "Elf race");
  check("Ability Increase Options", "Charisma");
  check("Ability Increase Options", "Charisma");
  check("Ability Increase Options", "You also gain proficiency in saving throws with the above chosen abilities");
  check("Ability Increase Options", "You also gain proficiency in saving throws with the above chosen abilities");
  for (const [group, n] of [
    ["Skill or Tool Proficiency", "3"],
    ["Languages", "2"],
    ["Weapon Proficiency Choice", "3"],
    ["Hit Points", "1"],
    ["Speed Bonuses", "15"],
    ["Initiative Bonuses", "1"],
  ]) {
    press(group, n);
    expect(pressed(group)).toBe(n);
    press(group, "None");
  }
  check("Armor Proficiency", "Shields");
  check("Armor Proficiency", "Shields");
  for (const [group, add, name] of [
    ["Weapon Proficiency", "Add a weapon proficiency", "You gain proficiency with improvised weapons"],
    ["Medium Armor", "Add a medium armor benefit", "When wearing medium armor, you can add 3 to your AC if your Dexterity is 16+"],
    ["Damage Resistances", "Add a damage resistance", "Damage from traps"],
    ["Misc. Modifiers", "Add a misc. modifier", "+1 AC Bonus while wielding two melee weapons"],
    ["Spellcasting", "Add a spellcasting benefit", "Choose a class, gain a cantrip requiring an attack roll from that class's spell list"],
    ["Skill Proficiency or Expertise", "Add a skill", "Stealth"],
    ["Tool Proficiency or Expertise", "Add a tool", "Lute"],
  ]) {
    await pick(group, add, name);
    expect(tokens(group)).toEqual([name]);
    await unpick(group, name);
  }
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("old-salt", "Reef")).toEqual({
    "~:name": "Old Salt",
    "~:key": "~:old-salt",
    "~:option-pack": "Reef",
    // The pick went at the end of the set, and the remove took it out; the old value stays.
    "~:prereqs": { "~#set": ["~:from-an-old-pack"] },
    "~:path-prereqs": { "~:race": { "~:elf": false } },
    "~:ability-increases": { "~#set": [] },
    // None removes a number, also one that is no segment, as the old second click did.
    "~:props": {
      "~:armor-prof": { "~:shields": false },
      "~:improvised-weapons-prof": false,
      "~:medium-armor-max-dex-3": false,
      "~:damage-resistance": { "~:traps": false },
      "~:two-weapon-ac-1": false,
      "~:attack-spell": false,
      "~:skill-prof-or-expertise": { "~:stealth": false },
      "~:tool-prof-or-expertise": { "~:an-old-kit": true, "~:lute": false },
    },
  });
});

test("the prerequisite picker lists the prerequisites, then the races under a heading, with search only past 20 options", async () => {
  renderAt("/content/new/feat");
  const add = await screen.findByRole("button", { name: "Add a prerequisite" });
  // 10 prerequisites and the 9 SRD races.
  expect(add.textContent).toMatch(/19 more$/);
  fireEvent.click(add);
  const dialog = await screen.findByRole("dialog", { name: "Add a prerequisite" });
  expect(within(dialog).queryByRole("searchbox")).toBeNull();
  const rows = [...dialog.querySelectorAll(".ui-list-row")].map((row) => row.getAttribute("aria-label"));
  expect(rows.slice(0, 2)).toEqual(["The ability to cast at least one spell", "Strength 13 or higher"]);
  expect(rows.slice(10)).toEqual(expect.arrayContaining(["Elf race", "Dwarf race"]));
  expect(rows.slice(0, 10).every((row) => !row?.endsWith(" race"))).toBe(true);
  expect(within(dialog).getByRole("list", { name: "Races" })).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  cleanup();
  await useHomebrew.getState().saveItem("Lizards", "~:orcpub.dnd.e5/races", { "~:key": "~:lizard", "~:name": "Lizard", "~:option-pack": "Lizards" });
  await useHomebrew.getState().saveItem("Lizards", "~:orcpub.dnd.e5/races", { "~:key": "~:newt", "~:name": "Newt", "~:option-pack": "Lizards" });
  renderAt("/content/new/feat");
  fireEvent.click(await screen.findByRole("button", { name: "Add a prerequisite" }));
  expect(within(await screen.findByRole("dialog", { name: "Add a prerequisite" })).getByRole("searchbox")).toBeTruthy();
});
