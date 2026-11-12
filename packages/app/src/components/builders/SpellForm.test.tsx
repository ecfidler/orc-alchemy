import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt } from "../../engine/content.ts";
import { loadEngine } from "../../engine/engine.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";
import { addList, pick, tokens, unpick } from "./test-picks.ts";

beforeAll(() => loadEngine());
afterEach(async () => {
  cleanup();
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
});

const DEFAULT = "Default Option Source";
const LISTS = "Class spell lists";
const ADD = "Add a class";

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
const add = () => within(screen.getByRole("group", { name: LISTS })).getByRole("button", { name: ADD });
const stored = (key: string, pack = DEFAULT) => {
  const record = useHomebrew.getState().packs.find((p) => p.id === pack);
  return record && (itemAt(record.plugin, "~:orcpub.dnd.e5/spells", `~:${key}`) as Record<string, unknown> | undefined);
};
async function saved(router: ReturnType<typeof renderAt>) {
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
}

test("a new spell is on no class list; the picker has the eight classes with no search, and the tokens are in list order", async () => {
  const router = renderAt("/content/new/spell");
  await screen.findByRole("form", { name: "New spell" });
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Fire Pop" } });
  expect(tokens(LISTS)).toEqual([]);
  expect(await addList(add(), ADD)).toEqual(["Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"]);
  fireEvent.click(add());
  const dialog = await screen.findByRole("dialog", { name: ADD });
  expect(within(dialog).queryByRole("searchbox")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  await pick(LISTS, ADD, ["Wizard", "Bard"]);
  expect(tokens(LISTS)).toEqual(["Bard", "Wizard"]);
  await saved(router);
  expect(stored("fire-pop")!["~:spell-lists"]).toEqual({ "~:wizard": true, "~:bard": true });
});

test("a pick then a remove stores false, as the old checkbox's double click", async () => {
  const router = renderAt("/content/new/spell");
  await screen.findByRole("form", { name: "New spell" });
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Fire Pop" } });
  await pick(LISTS, ADD, ["Cleric", "Wizard"]);
  await unpick(LISTS, "Cleric");
  expect(tokens(LISTS)).toEqual(["Wizard"]);
  await saved(router);
  expect(stored("fire-pop")).toEqual({
    "~:name": "Fire Pop",
    "~:key": "~:fire-pop",
    "~:option-pack": DEFAULT,
    "~:level": 0,
    "~:school": "abjuration",
    "~:spell-lists": { "~:cleric": false, "~:wizard": true },
  });
});

test("an imported spell with false values, unknown keys and an empty map opens, saves and stays equal; an unknown class shows as a token", async () => {
  const item = {
    "~:name": "Old Spark",
    "~:key": "~:old-spark",
    "~:option-pack": "Reef",
    "~:level": 2,
    "~:school": "evocation",
    "~:ritual": false,
    "~:attack-roll?": true,
    "~:components": { "~:verbal": false, "~:somatic": true },
    "~:spell-lists": { "~:wizard": true, "~:bard": false, "~:artificer": true, "~:monk": false },
    "~:an-old-field": { "~:x": true },
    "~:tags": {},
  };
  await useHomebrew.getState().saveItem("Reef", "~:orcpub.dnd.e5/spells", item);
  const router = renderAt("/content/edit/spell/Reef/old-spark");
  await screen.findByRole("form", { name: "Edit spell" });
  expect(tokens(LISTS)).toEqual(["Wizard", "artificer"]);
  expect(screen.getByRole("checkbox", { name: "Requires an attack roll" })).toBeChecked();
  await saved(router);
  expect(stored("old-spark", "Reef")).toEqual(item);
});

test("a removed unknown class stores false and leaves the list; a pick of a class that holds false stores true", async () => {
  const item = {
    "~:name": "Old Spark",
    "~:key": "~:old-spark",
    "~:option-pack": "Reef",
    "~:level": 2,
    "~:school": "evocation",
    "~:spell-lists": { "~:bard": false, "~:artificer": true },
  };
  await useHomebrew.getState().saveItem("Reef", "~:orcpub.dnd.e5/spells", item);
  const router = renderAt("/content/edit/spell/Reef/old-spark");
  await screen.findByRole("form", { name: "Edit spell" });
  await pick(LISTS, ADD, "Bard");
  await unpick(LISTS, "artificer");
  expect(await addList(add(), ADD)).not.toContain("artificer");
  await saved(router);
  expect(stored("old-spark", "Reef")!["~:spell-lists"]).toEqual({ "~:bard": true, "~:artificer": false });
});
