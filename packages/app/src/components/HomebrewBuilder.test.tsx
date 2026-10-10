import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt } from "../engine/content.ts";
import { engine, loadEngine } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { listPacks, type PackRecord } from "../storage/packs.ts";
import { Builder } from "./Builder.tsx";
import { spellBuilder } from "./builders/SpellForm.tsx";
import { BUILDERS, HomebrewBuilder } from "./HomebrewBuilder.tsx";

beforeAll(() => loadEngine());

afterEach(async () => {
  cleanup();
  delete BUILDERS.test;
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
});

const SPELLS = "~:orcpub.dnd.e5/spells";
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
const storedItem = (pack: string, key: string) => {
  const record = useHomebrew.getState().packs.find((p) => p.id === pack);
  return record && (itemAt(record.plugin, SPELLS, `~:${key}`) as Record<string, unknown> | undefined);
};

/** Fills the new spell form with Fire Pop, a 1st-level wizard evocation, and saves it. */
async function authorFirePop(optionSource?: string) {
  const router = renderAt("/content/new/spell");
  await screen.findByRole("form", { name: "New spell" });
  type("Name", "Fire Pop");
  type("Level", "1");
  type("School", "evocation");
  type("Casting time", "1 action");
  type("Range", "60 feet");
  type("Duration", "Instantaneous");
  type("Description", "A small burst of fire.");
  fireEvent.click(screen.getByLabelText("Verbal"));
  fireEvent.click(screen.getByLabelText("Material"));
  type("Material component", "a match");
  for (const klass of ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock"]) fireEvent.click(screen.getByLabelText(klass));
  if (optionSource !== undefined) type("Option source", optionSource);
  fireEvent.click(save());
  // Save builds the packs with the spell, which is slow under load.
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
}

test("each problem shows under its field, and Save is off until the spell is valid", async () => {
  renderAt("/content/new/spell");
  await screen.findByRole("form", { name: "New spell" });
  expect(problems("Name")).toBe("Name is required.");
  expect(save().disabled).toBe(true);

  type("Name", "1 Fire");
  expect(problems("Name")).toBe("Name must start with a letter.");
  type("Name", "Fire Pop");
  expect(problems("Name")).toBeNull();
  expect(save().disabled).toBe(false);

  // A spell must be on at least one class list.
  for (const klass of ["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"]) fireEvent.click(screen.getByLabelText(klass));
  expect(problems("Class spell lists")).toBe("Class spell lists is not valid.");
  expect(save().disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("Wizard"));
  expect(save().disabled).toBe(false);
  expect(screen.queryByRole("list", { name: "Problems" })).toBeNull();
});

test("a problem of a field the form does not show is listed at the top", async () => {
  BUILDERS.test = { ...spellBuilder, fields: ["school"] };
  renderAt("/content/new/test");
  await screen.findByRole("form", { name: "New spell" });
  expect(screen.getByRole("list", { name: "Problems" }).textContent).toBe("name is required.");
});

test("Save stores the spell in the default pack, enabled, as the old app stores it", async () => {
  await authorFirePop();
  const pack = useHomebrew.getState().packs.find((p) => p.id === DEFAULT)!;
  expect(pack.enabled).toBe(true);
  expect(storedItem(DEFAULT, "fire-pop")).toEqual({
    "~:name": "Fire Pop",
    "~:key": "~:fire-pop",
    "~:option-pack": DEFAULT,
    "~:level": 1,
    "~:school": "evocation",
    "~:casting-time": "1 action",
    "~:range": "60 feet",
    "~:duration": "Instantaneous",
    "~:description": "A small burst of fire.",
    "~:components": { "~:verbal": true, "~:material": true, "~:material-component": "a match" },
    "~:spell-lists": {
      "~:bard": false,
      "~:cleric": false,
      "~:druid": false,
      "~:paladin": false,
      "~:ranger": false,
      "~:sorcerer": false,
      "~:warlock": false,
      "~:wizard": true,
    },
  });
  // It is stored, and the characters' content has it.
  expect(((await listPacks()) as PackRecord[]).map((p) => p.id)).toEqual([DEFAULT]);
  expect(itemAt((useHomebrew.getState().content.homebrew as Record<string, object>)[DEFAULT], SPELLS, "~:fire-pop")).toBeDefined();
});

test("the option source names the pack; Edit loads the stored spell, and a rename keeps its key", async () => {
  await authorFirePop("My Spells");
  cleanup();
  renderAt("/content/edit/spell/My%20Spells/fire-pop");
  await screen.findByRole("form", { name: "Edit spell" });
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Fire Pop");
  expect(screen.getByLabelText<HTMLInputElement>("Option source").value).toBe("My Spells");
  expect(screen.getByLabelText<HTMLSelectElement>("Level").value).toBe("1");
  expect(screen.getByLabelText<HTMLInputElement>("Verbal").checked).toBe(true);
  expect(screen.getByLabelText<HTMLInputElement>("Somatic").checked).toBe(false);

  type("Name", "Fire Burst");
  fireEvent.click(save());
  await screen.findByRole("heading", { name: "My Content" }, { timeout: 10_000 });
  const pack = useHomebrew.getState().packs.find((p) => p.id === "My Spells")!;
  expect(Object.keys(pack.plugin)).toEqual([SPELLS]);
  expect(Object.keys((pack.plugin as Record<string, object>)[SPELLS])).toEqual(["~:fire-pop"]);
  expect(storedItem("My Spells", "fire-pop")!["~:name"]).toBe("Fire Burst");
});

test("an edit of an item that is not stored says so", async () => {
  renderAt("/content/edit/spell/Nothing/fire-pop");
  expect(await screen.findByRole("heading", { name: "There is no spell fire-pop in the pack Nothing" })).toBeTruthy();
});

// The done-when of ORC-74: a spell made in the form is a wizard's option, and its pack passes the old export check.
test("a spell authored in the form is in a wizard's spell selection, and its pack passes validateForExport", async () => {
  await authorFirePop();
  cleanup();
  const e = engine();
  useCharacter.getState().load("homebrew-spell-wizard", e.setClass(e.emptyCharacter(), 0, "wizard"));
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Spells/ }));
  expect(within(screen.getByRole("region", { name: /^Wizard Spells Known/ })).getByRole("button", { name: "1 - Fire Pop" })).toBeTruthy();

  expect(e.validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
});
