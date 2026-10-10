import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { builderSteps, type BuilderSelection } from "../../engine/builder.ts";
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
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
const stored = (key: string) => {
  const plugin = useHomebrew.getState().packs.find((p) => p.id === DEFAULT)?.plugin;
  return plugin && itemAt(plugin, "~:orcpub.dnd.e5/boons", `~:${key}`);
};

/** The selection keyed key anywhere in the steps, under the selected options. */
function find(selections: BuilderSelection[], key: string): BuilderSelection | undefined {
  for (const s of selections) {
    if (s.key === key) return s;
    const found = find(s.options.flatMap((o) => o.selections), key);
    if (found) return found;
  }
}

test("the name problem shows under its field, and Save is off until the pact boon has a name", async () => {
  renderAt("/content/new/boon");
  await screen.findByLabelText("Name");
  expect(problems("Name")).toBe("Name is required.");
  expect(save().disabled).toBe(true);
  type("Name", "2 Bad");
  expect(problems("Name")).toBe("Name must start with a letter.");
  type("Name", "Pact of the Lantern");
  expect(problems("Name")).toBeNull();
  expect(save().disabled).toBe(false);
});

test("the pact boon is stored as the old save stores it, Edit loads it back, and it is one of a warlock 3's pact boon choices", async () => {
  const router = renderAt("/content/new/boon");
  await screen.findByLabelText("Name");
  type("Name", "Pact of the Lantern");
  type("Description", "Your patron gives you a lantern that never goes out.");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  expect(stored("pact-of-the-lantern")).toEqual({
    "~:name": "Pact of the Lantern",
    "~:key": "~:pact-of-the-lantern",
    "~:option-pack": DEFAULT,
    "~:description": "Your patron gives you a lantern that never goes out.",
  });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);

  const { homebrew } = useHomebrew.getState().content;
  let character = engine().setClass(engine().emptyCharacter(), 0, "warlock", { homebrew });
  character = engine().addLevel(character, "warlock", { homebrew });
  character = engine().addLevel(character, "warlock", { homebrew });
  const steps = builderSteps(engine().evaluate(character, { homebrew }).selections, engine().buildTemplate(homebrew).shape);
  const choices = find(steps.flatMap((s) => s.selections), "pact-boon")!;
  expect(choices.options.find((o) => o.key === "pact-of-the-lantern")?.name).toBe("Pact of the Lantern");

  cleanup();
  renderAt(`/content/edit/boon/${encodeURIComponent(DEFAULT)}/pact-of-the-lantern`);
  await screen.findByRole("form", { name: "Edit pact boon" });
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Pact of the Lantern");
  expect(screen.getByLabelText<HTMLTextAreaElement>("Description").value).toBe("Your patron gives you a lantern that never goes out.");
  expect(save().disabled).toBe(false);
});
