import "fake-indexeddb/auto";
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
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
const stored = (key: string) => {
  const pack = useHomebrew.getState().packs.find((p) => p.id === DEFAULT);
  return pack && (itemAt(pack.plugin, "~:orcpub.dnd.e5/subclasses", `~:${key}`) as Record<string, unknown> | undefined);
};
async function saved(router: ReturnType<typeof renderAt>) {
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
}

test("each problem shows under its field, and Save is off until the subclass is valid", async () => {
  renderAt("/content/new/subclass");
  await screen.findByLabelText("Name");
  expect(problems("Name")).toBe("Name is required.");
  expect(screen.getByLabelText<HTMLSelectElement>("Class").value).toBe("~:barbarian");
  type("Name", "Path of Frost");
  expect(save().disabled).toBe(false);
  type("Class", "");
  expect(problems("Class")).toBe("Class is required.");
  expect(save().disabled).toBe(true);
  type("Class", "~:fighter");
  expect(save().disabled).toBe(false);
});

test("a cleric subclass stores its domain spells as the old app stores them, and Edit loads them back", async () => {
  const router = renderAt("/content/new/subclass");
  await screen.findByLabelText("Name");
  type("Name", "Waves Domain");
  expect(screen.queryByRole("group", { name: "Domain Spells" })).toBeNull();
  type("Class", "~:cleric");
  type("Level 1 spell 1", "~:fog-cloud");
  type("Level 1 spell 2", "~:bless");
  type("Level 5 spell 1", "~:cone-of-cold");
  fireEvent.click(within(screen.getByRole("group", { name: "Skill Proficiency Choice: options" })).getByLabelText("Religion"));
  fireEvent.click(screen.getByRole("button", { name: "Add modifier" }));
  type("Modifier 1 type", "~:swimming-speed");
  type("Modifier 1 value", "30");
  // A new type keeps the value, as the old event does.
  type("Modifier 1 type", "~:flying-speed");
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
  await screen.findByLabelText("Name");
  expect(screen.getByLabelText<HTMLSelectElement>("Class").value).toBe("~:cleric");
  expect(screen.getByLabelText<HTMLSelectElement>("Level 1 spell 2").value).toBe("~:bless");
  expect(screen.getByLabelText<HTMLSelectElement>("Modifier 1 value").value).toBe("30");
});

test("a fighter subclass can cast wizard spells", async () => {
  const router = renderAt("/content/new/subclass");
  await screen.findByLabelText("Name");
  type("Name", "Spell Blade");
  type("Class", "~:fighter");
  type("Casts wizard spells", "true");
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
  await screen.findByLabelText("Name");
  type("Name", "Rune Knight");
  type("Hit die", "10");
  type("Subclass chosen at level", "3");
  type("Subclass title, such as Path or Circle", "Rune Path");
  fireEvent.click(screen.getByRole("button", { name: "Add selection" }));
  type("Selection 1 type", "~:rune-carvings");
  type("Selection 1 level", "2");
  type("Selection 1 amount", "2");
  await saved(router);

  cleanup();
  router = renderAt("/content/new/subclass");
  await screen.findByLabelText("Name");
  // The new class is a parent the subclass can have.
  type("Class", "~:rune-knight");
  type("Name", "Frost Path");
  fireEvent.click(screen.getByRole("button", { name: "Add feature / trait" }));
  type("Feature 1 name", "Frost Rune");
  type("Feature 1 level", "3");
  type("Feature 1 description", "Your weapon is cold.");
  fireEvent.click(screen.getByRole("button", { name: "Add selection" }));
  type("Selection 1 type", "~:frost-gifts");
  type("Selection 1 level", "3");
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
  expect(within(carvings).getByRole("heading").textContent).toBe("Rune Carvings(2 to choose)");
  expect(within(carvings).getByRole("button", { name: "Fire Rune" })).toBeTruthy();
  // Picking the subclass opens its level-3 selection.
  expect(screen.queryByRole("region", { name: /^Frost Gifts/ })).toBeNull();
  fireEvent.click(within(screen.getByRole("region", { name: /^Rune Path/ })).getByRole("button", { name: "Frost Path" }));
  expect(within(screen.getByRole("region", { name: /^Frost Gifts/ })).getByRole("button", { name: "Cold Breath" })).toBeTruthy();

  expect(e.validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
});
