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
  return plugin && itemAt(plugin, "~:orcpub.dnd.e5/backgrounds", `~:${key}`);
};
async function saved(router: ReturnType<typeof renderAt>) {
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
}

test("the name problem shows under its field, and Save is off until the background has a name", async () => {
  renderAt("/content/new/background");
  await screen.findByLabelText("Name");
  expect(problems("Name")).toBe("Name is required.");
  expect(save().disabled).toBe(true);
  type("Name", "1 Spy");
  expect(problems("Name")).toBe("Name must start with a letter.");
  type("Name", "Spy");
  expect(problems("Name")).toBeNull();
  expect(save().disabled).toBe(false);
});

test("each field is stored as the old events store it, and Edit loads it back", async () => {
  const router = renderAt("/content/new/background");
  await screen.findByLabelText("Name");
  type("Name", "Sailor's Life");
  type("Description", "At sea.");
  check("Skill Proficiencies", "Athletics");
  check("Skill Proficiencies", "Perception");
  check("Skill Proficiencies", "Perception");
  check("Languages", "Any 2");
  check("Artisan's Tools: proficiency choice", "Any 1");
  check("Artisan's Tools: proficiencies", "Carpenter's Tools");
  check("Musical Instruments: proficiency choice", "Any 1");
  check("Musical Instruments: proficiency choice", "Any 1");
  check("Gaming Set: proficiency choice", "Any 3");
  check("Vehicle proficiencies", "Water Vehicles");
  check("Other tool proficiencies", "Navigator's Tools");
  type("Gold", "10");
  check("Clothing", "Clothes, traveler’s");
  check("Equipment choices", "Any 1 of the musical instruments");
  check("Artisan's Tools", "Smith's Tools");
  check("Other Tools", "Disguise Kit");
  check("Holy Symbols", "Amulet");
  check("Other Equipment", "Rope, silk");
  check("Other Equipment", "Rations (1 day)");
  fireEvent.click(screen.getByRole("button", { name: "Add feature / trait" }));
  type("Feature 1 name", "Ship's Passage");
  type("Feature 1 description", "Free passage.");
  await saved(router);

  expect(stored("sailors-life")).toEqual({
    "~:name": "Sailor's Life",
    "~:key": "~:sailors-life",
    "~:option-pack": DEFAULT,
    "~:help": "At sea.",
    "~:profs": {
      "~:skill": { "~:athletics": true },
      "~:language-options": { "~:choose": 2, "~:options": { "~:any": true } },
      "~:tool-options": { "~:artisans-tool": 1, "~:gaming-set": 3 },
      "~:tool": { "~:carpenters-tools": true, "~:water-vehicles": true, "~:navigators-tools": true },
    },
    "~:treasure": { "~:gp": 10 },
    "~:equipment": { "~:clothes-traveler-s": 1, "~:smiths-tools": 1, "~:disguise-kit": 1, "~:amulet": 1, "~:rope-silk": 1, "~:rations-1-day-": 1 },
    "~:equipment-choices": [
      {
        "~:name": "Musical Instruments",
        "~:options": Object.fromEntries(["bagpipes", "drum", "dulcimer", "flute", "lute", "lyre", "horn", "pan-flute", "shawm", "viol"].map((k) => [`~:${k}`, 1])),
      },
    ],
    "~:traits": [{ "~:name": "Ship's Passage", "~:description": "Free passage." }],
  });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);

  cleanup();
  renderAt(`/content/edit/background/${encodeURIComponent(DEFAULT)}/sailors-life`);
  await screen.findByRole("form", { name: "Edit background" });
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Sailor's Life");
  expect(screen.getByLabelText<HTMLTextAreaElement>("Description").value).toBe("At sea.");
  expect(screen.getByLabelText<HTMLInputElement>("Gold").value).toBe("10");
  expect([checked("Skill Proficiencies", "Athletics"), checked("Skill Proficiencies", "Perception"), checked("Languages", "Any 2")]).toEqual([true, false, true]);
  expect([checked("Gaming Set: proficiency choice", "Any 3"), checked("Equipment choices", "Any 1 of the musical instruments"), checked("Other Equipment", "Rope, silk")]).toEqual([
    true,
    true,
    true,
  ]);
  expect(screen.getByLabelText<HTMLInputElement>("Feature 1 name").value).toBe("Ship's Passage");
  expect(screen.queryByRole("note")).toBeNull();
  expect(save().disabled).toBe(false);
});

test("a stored key that is not the key of the name is kept, with a warning that does not stop the save", async () => {
  await useHomebrew.getState().saveItem(DEFAULT, "~:orcpub.dnd.e5/backgrounds", { "~:key": "~:old-spy", "~:name": "Spy", "~:option-pack": DEFAULT });
  const router = renderAt("/content/edit/background/Default%20Option%20Source/old-spy");
  await screen.findByRole("form", { name: "Edit background" });
  expect(screen.getByRole("note").textContent).toMatch(/The key of this background is old-spy, not spy/);
  expect(save().disabled).toBe(false);
  type("Name", "Old Spy");
  expect(screen.queryByRole("note")).toBeNull();
  type("Name", "Master Spy");
  await saved(router);
  expect(stored("old-spy")).toEqual({ "~:key": "~:old-spy", "~:name": "Master Spy", "~:option-pack": DEFAULT });
});
