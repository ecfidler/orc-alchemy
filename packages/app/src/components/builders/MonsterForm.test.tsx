import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
const problems = (label: string) => screen.queryByRole("list", { name: `Problems: ${label}` })?.textContent ?? null;
const stored = () => {
  const pack = useHomebrew.getState().packs.find((p) => p.id === DEFAULT);
  return pack && (itemAt(pack.plugin, "~:orcpub.dnd.e5/monsters", "~:mud-imp") as Record<string, unknown> | undefined);
};

test("each problem shows under its field, and Save is off until the monster is valid", async () => {
  renderAt("/content/new/monster");
  await screen.findByRole("form", { name: "New monster" });
  expect(problems("Name")).toBe("Name is required.");
  expect(problems("Hit points")).toBe("Hit points is required.");
  expect(save().disabled).toBe(true);

  type("Name", "Mud Imp");
  expect(problems("Name")).toBeNull();
  type("Hit die", "6");
  expect(problems("Hit points")).toBe("Hit points is required.");
  type("Hit die count", "3");
  expect(problems("Hit points")).toBeNull();
  expect(save().disabled).toBe(false);
  // "-" removes the die count again.
  type("Hit die count", "");
  expect(save().disabled).toBe(true);
});

test("Save stores the monster in the default pack as the old app stores it, and Edit loads it back", async () => {
  const router = renderAt("/content/new/monster");
  await screen.findByRole("form", { name: "New monster" });
  type("Name", "Mud Imp");
  type("Size", "~:small");
  type("Type", "~:fiend");
  type("Alignment", "chaotic evil");
  type("Armor class", "13");
  type("Armor notes", "natural armor");
  type("Hit die count", "3");
  type("Hit die", "6");
  type("Hit point modifier", "3");
  type("Speed", "20 ft., fly 40 ft.");
  type("Dexterity", "17");
  type("Dexterity saving throw", "5");
  type("Stealth", "5");
  fireEvent.click(screen.getByLabelText("Resistance to fire damage"));
  fireEvent.click(screen.getByLabelText("Immunity to poison damage"));
  fireEvent.click(screen.getByLabelText("Vulnerability to cold damage"));
  fireEvent.click(screen.getByLabelText("Immunity to being Poisoned"));
  fireEvent.click(screen.getByLabelText("Abyssal"));
  fireEvent.click(screen.getByLabelText("Deep Speech"));
  fireEvent.click(screen.getByLabelText("Deep Speech"));
  type("Senses", "darkvision 60 ft.");
  type("Challenge rating", "0.5");
  type("Special traits", "It smells of mud.");
  fireEvent.click(screen.getByRole("button", { name: "Add action / feature" }));
  fireEvent.click(screen.getByRole("button", { name: "Add action / feature" }));
  fireEvent.click(screen.getByRole("button", { name: "Add action / feature" }));
  type("Feature 1 name", "Gone");
  fireEvent.click(screen.getByRole("button", { name: "Delete feature 1" }));
  type("Feature 1 name", "Claw");
  type("Feature 1 type", "~:action");
  type("Feature 1 description", "Melee Weapon Attack: +5 to hit.");
  type("Feature 2 name", "Muck");
  type("Feature 2 type", "~:legendary-action");
  type("Legendary actions", "The imp can take 1 legendary action.");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });

  expect(stored()).toEqual({
    "~:name": "Mud Imp",
    "~:key": "~:mud-imp",
    "~:option-pack": DEFAULT,
    "~:size": "~:small",
    "~:type": "~:fiend",
    "~:alignment": "chaotic evil",
    "~:armor-class": 13,
    "~:armor-notes": "natural armor",
    "~:hit-points": { "~:die-count": 3, "~:die": 6, "~:modifier": 3 },
    "~:speed": "20 ft., fly 40 ft.",
    "~:str": 10,
    "~:dex": 17,
    "~:con": 10,
    "~:int": 10,
    "~:wis": 10,
    "~:cha": 10,
    "~:saving-throws": { "~:dex": 5 },
    "~:skills": { "~:stealth": 5 },
    "~:props": {
      "~:damage-resistance": { "~:fire": true },
      "~:damage-immunity": { "~:poison": true },
      "~:damage-vulnerability": { "~:cold": true },
      "~:condition-immunity": { "~:poisoned": true },
      "~:language": { "~:abyssal": true, "~:deep-speech": false },
    },
    "~:senses": "darkvision 60 ft.",
    "~:challenge": 0.5,
    "~:description": "It smells of mud.",
    "~:traits": [
      { "~:name": "Claw", "~:type": "~:action", "~:description": "Melee Weapon Attack: +5 to hit." },
      { "~:name": "Muck", "~:type": "~:legendary-action" },
    ],
    "~:legendary-actions": { "~:description": "The imp can take 1 legendary action." },
  });
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);

  cleanup();
  renderAt(`/content/edit/monster/${encodeURIComponent(DEFAULT)}/mud-imp`);
  await screen.findByRole("form", { name: "Edit monster" });
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Mud Imp");
  expect(screen.getByLabelText<HTMLSelectElement>("Size").value).toBe("~:small");
  expect(screen.getByLabelText<HTMLSelectElement>("Hit die").value).toBe("6");
  expect(screen.getByLabelText<HTMLSelectElement>("Challenge rating").value).toBe("0.5");
  expect(screen.getByLabelText<HTMLSelectElement>("Dexterity saving throw").value).toBe("5");
  expect(screen.getByLabelText<HTMLInputElement>("Resistance to fire damage").checked).toBe(true);
  expect(screen.getByLabelText<HTMLInputElement>("Deep Speech").checked).toBe(false);
  expect(screen.getByLabelText<HTMLSelectElement>("Feature 2 type").value).toBe("~:legendary-action");
  expect(save().disabled).toBe(false);
});
