import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const orcbrewDir = join(import.meta.dirname, "../../../../../fixtures/orcbrew");

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
const stored = (pack: string, key: string) => {
  const plugin = useHomebrew.getState().packs.find((p) => p.id === pack)?.plugin;
  return plugin && itemAt(plugin, "~:orcpub.dnd.e5/languages", `~:${key}`);
};
async function saved(router: ReturnType<typeof renderAt>) {
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
}

/** The selection keyed key anywhere in the steps, under the selected options. */
function find(selections: BuilderSelection[], key: string): BuilderSelection | undefined {
  for (const s of selections) {
    if (s.key === key) return s;
    const found = find(s.options.flatMap((o) => o.selections), key);
    if (found) return found;
  }
}

test("the name problem shows under its field, and Save is off until the language has a name", async () => {
  renderAt("/content/new/language");
  await screen.findByLabelText("Name");
  expect(problems("Name")).toBe("Name is required.");
  expect(save().disabled).toBe(true);
  type("Name", "1 Stone");
  expect(problems("Name")).toBe("Name must start with a letter.");
  type("Name", "Deep Stone");
  expect(problems("Name")).toBeNull();
  expect(save().disabled).toBe(false);
});

test("the form recreates the Deep Stone language of the drift-04 fixture, Edit loads it back, and a human can learn it", async () => {
  const router = renderAt("/content/new/language");
  await screen.findByLabelText("Name");
  type("Option source (pack)", "Drift 04");
  type("Name", "Deep Stone");
  await saved(router);

  const parsed = engine().parseOrcbrew(readFileSync(join(orcbrewDir, "drift-04-trailing-commas.orcbrew"), "utf8")).data as Record<string, object>;
  const fixture = itemAt(Object.values(parsed)[0], "~:orcpub.dnd.e5/languages", "~:deep-stone");
  expect(fixture).toHaveProperty("~:name", "Deep Stone");
  expect(stored("Drift 04", "deep-stone")).toEqual(fixture);
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);

  // The language is one of a human's language choices.
  const { homebrew } = useHomebrew.getState().content;
  const human = engine().select(engine().emptyCharacter(), ["race"], "human");
  const steps = builderSteps(engine().evaluate(human, { homebrew }).selections, engine().buildTemplate(homebrew).shape);
  const languages = find(steps.flatMap((s) => s.selections), "languages")!;
  expect(languages.options.find((o) => o.key === "deep-stone")?.name).toBe("Deep Stone");

  cleanup();
  renderAt("/content/edit/language/Drift%2004/deep-stone");
  await screen.findByRole("form", { name: "Edit language" });
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Deep Stone");
  type("Description", "The tongue of the deep earth.");
  expect(save().disabled).toBe(false);
});

test("the description is stored as :description", async () => {
  const router = renderAt("/content/new/language");
  await screen.findByLabelText("Name");
  type("Name", "Thieves Hand");
  type("Description", "Signs made with the hands.");
  await saved(router);
  expect(stored("Default Option Source", "thieves-hand")).toEqual({
    "~:name": "Thieves Hand",
    "~:key": "~:thieves-hand",
    "~:option-pack": "Default Option Source",
    "~:description": "Signs made with the hands.",
  });

  cleanup();
  renderAt("/content/edit/language/Default%20Option%20Source/thieves-hand");
  await screen.findByRole("form", { name: "Edit language" });
  expect(screen.getByLabelText<HTMLTextAreaElement>("Description").value).toBe("Signs made with the hands.");
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
});
