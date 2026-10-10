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
const PACK = "GM Binder Homebrew";
const QUIRKS = [
  "You age at an accelerated rate",
  "You age at a slowed rate",
  "One day you awoke and the world was slightly different from what you remember",
  "Sometimes you have visions of a terrible fate",
  "Clocks around you always show the wrong time",
  "Sometimes you find yourself reliving memories",
];

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
const add = () => fireEvent.click(screen.getByRole("button", { name: "Add option" }));
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
const stored = (pack: string, key: string) => {
  const plugin = useHomebrew.getState().packs.find((p) => p.id === pack)?.plugin;
  return plugin && itemAt(plugin, "~:orcpub.dnd.e5/selections", `~:${key}`);
};
async function saved(router: ReturnType<typeof renderAt>) {
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
}

test("each problem shows under its field or option, and Save is off until the selection is valid", async () => {
  renderAt("/content/new/selection");
  await screen.findByLabelText("Name");
  expect(problems("Name")).toBe("Name is required.");
  expect(save().disabled).toBe(true);
  type("Name", "Quirks");
  // A selection with no options is valid, as the old spec has it.
  expect(save().disabled).toBe(false);
  add();
  add();
  // As the old add-option event: "Option N", with the first N not in use.
  expect(screen.getByLabelText<HTMLInputElement>("Option 2 name").value).toBe("Option 2");
  fireEvent.click(screen.getByRole("button", { name: "Delete option 1" }));
  add();
  expect(screen.getByLabelText<HTMLInputElement>("Option 2 name").value).toBe("Option 3");
  type("Option 1 name", "Fey Step");
  type("Option 2 name", "fey step");
  expect(problems("Option 1")).toBe("Option 1 has the same name as another option.");
  expect(problems("Option 2")).toBe("Option 2 has the same name as another option.");
  expect(save().disabled).toBe(true);
  type("Option 2 name", "");
  expect(problems("Option 1")).toBeNull();
  expect(problems("Option 2")).toBe("Option 2 name is required.");
  type("Option 2 name", "Iron Skin");
  expect(problems("Option 2")).toBeNull();
  expect(save().disabled).toBe(false);
});

test("the form recreates Divergent Soul Quirks of the GM Binder fixture, Edit loads it back, and the class form offers it", async () => {
  const router = renderAt("/content/new/selection");
  await screen.findByLabelText("Name");
  type("Option source (pack)", PACK);
  type("Name", "Divergent Soul Quirks");
  QUIRKS.forEach((quirk, i) => {
    add();
    type(`Option ${i + 1} name`, quirk);
  });
  await saved(router);

  const parsed = engine().parseOrcbrew(readFileSync(join(orcbrewDir, "community-gmbinder-homebrew.orcbrew"), "utf8")).data as Record<string, object>;
  const fixture = itemAt(parsed["Imported Content"], "~:orcpub.dnd.e5/selections", "~:divergent-soul-quirks");
  expect(fixture).toHaveProperty("~:name", "Divergent Soul Quirks");
  expect(stored(PACK, "divergent-soul-quirks")).toEqual(fixture);
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);

  cleanup();
  renderAt(`/content/edit/selection/${encodeURIComponent(PACK)}/divergent-soul-quirks`);
  await screen.findByRole("form", { name: "Edit selection" });
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Divergent Soul Quirks");
  expect(screen.getByLabelText<HTMLInputElement>("Option 6 name").value).toBe(QUIRKS[5]);
  expect(save().disabled).toBe(false);

  // As the old class builder's level selections: a selection of the packs is a type a class level can give.
  cleanup();
  renderAt("/content/new/class");
  await screen.findByLabelText("Name");
  fireEvent.click(screen.getByRole("button", { name: "Add selection" }));
  const types = within(screen.getByLabelText("Selection 1 type")).getAllByRole("option").map((o) => o.textContent);
  expect(types).toContain("Divergent Soul Quirks");
});

test("an option description is stored as :description, and a deleted option is removed", async () => {
  const router = renderAt("/content/new/selection");
  await screen.findByLabelText("Name");
  type("Name", "Fighting Tricks");
  add();
  add();
  add();
  type("Option 1 name", "Feint");
  type("Option 1 description", "You trick your foe.");
  type("Option 3 name", "Trip");
  fireEvent.click(screen.getByRole("button", { name: "Delete option 2" }));
  await saved(router);
  expect(stored("Default Option Source", "fighting-tricks")).toEqual({
    "~:name": "Fighting Tricks",
    "~:key": "~:fighting-tricks",
    "~:option-pack": "Default Option Source",
    "~:options": [{ "~:name": "Feint", "~:description": "You trick your foe." }, { "~:name": "Trip" }],
  });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
});
