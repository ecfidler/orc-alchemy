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
const click = (label: string) => fireEvent.click(screen.getByLabelText(label));
const clickIn = (group: string, label: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByLabelText(label));
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
const stored = (key: string) => {
  const pack = useHomebrew.getState().packs.find((p) => p.id === DEFAULT);
  return pack && (itemAt(pack.plugin, "~:orcpub.dnd.e5/classes", `~:${key}`) as Record<string, unknown> | undefined);
};
async function saved(router: ReturnType<typeof renderAt>) {
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
}

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
  await screen.findByLabelText("Name");
  expect(problems("Name")).toBe("Name is required.");
  expect(save().disabled).toBe(true);
  type("Name", "1 Rune");
  expect(problems("Name")).toBe("Name must start with a letter.");
  type("Name", "Rune Knight");
  expect(problems("Name")).toBeNull();
  expect(save().disabled).toBe(false);
  expect(screen.queryByRole("list", { name: "Problems" })).toBeNull();
});

test("Save stores the class as the old app stores it, and Edit loads it back", async () => {
  await addRuneCarvings();
  const router = renderAt("/content/new/class");
  await screen.findByLabelText("Name");
  type("Name", "Rune Knight");
  type("Description", "A warrior of runes.");
  type("Hit die", "10");
  type("Subclass chosen at level", "3");
  type("Subclass title, such as Path or Circle", "Rune Path");
  type("Subclass description", "The runes you follow.");
  click("Strength saving throw");
  click("Constitution saving throw");
  click("Constitution saving throw");
  click("Ability increase at level 4");
  click("Ability increase at level 6");
  type("Spell slots", "true");
  type("Spell list", "~:wizard");
  type("Spellcasting ability", "~:orcpub.dnd.e5.character/int");
  type("First spell slots at level", "2");
  type("Skill Proficiency Choice: choose", "2");
  for (const skill of ["Athletics", "History", "Arcana", "Arcana"]) clickIn("Skill Proficiency Choice: options", skill);
  clickIn("Skill Expertise Choice: options", "Stealth");
  for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole("button", { name: "Add modifier" }));
  type("Modifier 1 type", "~:armor-prof");
  fireEvent.click(screen.getByRole("button", { name: "Delete modifier 1" }));
  type("Modifier 1 type", "~:weapon-prof");
  type("Modifier 1 value", "~:martial");
  type("Modifier 2 type", "~:spell");
  type("Modifier 2 level", "3");
  type("Modifier 2 spell level", "0");
  type("Modifier 2 spellcasting ability", "~:orcpub.dnd.e5.character/int");
  type("Modifier 2 spell", "~:fire-bolt");
  fireEvent.click(screen.getByRole("button", { name: "Add selection" }));
  type("Selection 1 type", "~:rune-carvings");
  type("Selection 1 level", "2");
  type("Selection 1 amount", "2");
  fireEvent.click(screen.getByRole("button", { name: "Add feature / trait" }));
  type("Feature 1 name", "Rune Carver");
  type("Feature 1 type", "~:b-action");
  type("Feature 1 level", "2");
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
      { "~:type": "~:weapon-prof", "~:value": "~:martial" },
      { "~:type": "~:spell", "~:level": 3, "~:value": { "~:level": 0, "~:ability": "~:orcpub.dnd.e5.character/int", "~:key": "~:fire-bolt" } },
    ],
    "~:level-selections": [{ "~:type": "~:rune-carvings", "~:level": 2, "~:num": 2 }],
    "~:traits": [{ "~:name": "Rune Carver", "~:type": "~:b-action", "~:level": 2, "~:description": "You carve a rune." }],
  });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);

  cleanup();
  renderAt(`/content/edit/class/${encodeURIComponent(DEFAULT)}/rune-knight`);
  await screen.findByLabelText("Name");
  expect(screen.getByRole("form", { name: "Edit class" })).toBeTruthy();
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Rune Knight");
  expect(screen.getByLabelText<HTMLSelectElement>("Hit die").value).toBe("10");
  expect(screen.getByLabelText<HTMLInputElement>("Strength saving throw").checked).toBe(true);
  expect(screen.getByLabelText<HTMLInputElement>("Ability increase at level 4").checked).toBe(false);
  expect(screen.getByLabelText<HTMLSelectElement>("Spell list").value).toBe("~:wizard");
  expect(screen.getByLabelText<HTMLSelectElement>("First spell slots at level").value).toBe("2");
  expect(within(screen.getByRole("group", { name: "Skill Proficiency Choice: options" })).getByLabelText<HTMLInputElement>("History").checked).toBe(true);
  expect(screen.getByLabelText<HTMLSelectElement>("Modifier 2 spell").value).toBe("~:fire-bolt");
  expect(screen.getByLabelText<HTMLSelectElement>("Selection 1 type").value).toBe("~:rune-carvings");
  expect(screen.getByLabelText<HTMLSelectElement>("Feature 1 type").value).toBe("~:b-action");
  expect(save().disabled).toBe(false);
});

test("a class with a custom spell list stores its cantrips and spells by level", async () => {
  const router = renderAt("/content/new/class");
  await screen.findByLabelText("Name");
  type("Name", "Hedge Mage");
  type("Spell slots", "true");
  type("First spell slots at level", "1");
  type("Cantrips", "true");
  type("Cantrips known at level 1", "2");
  type("Add an extra cantrip at level", "4");
  type("Add an extra cantrip at level", "12");
  type("Extra cantrip 1 level", "10");
  fireEvent.click(screen.getByRole("button", { name: "Remove extra cantrip 2" }));
  clickIn("Cantrips", "Fire Bolt");
  clickIn("Level 1 spells", "Magic Missile");
  clickIn("Level 1 spells", "Shield");
  clickIn("Level 1 spells", "Shield");
  clickIn("Level 9 spells", "Wish");
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
