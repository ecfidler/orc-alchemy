// Each form with the shared feature list opens an imported item whose
// features have uses of every stored shape, and saves it equal (ORC-204):
// opening the uses control and not touching it writes nothing.
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt } from "../../engine/content.ts";
import { loadEngine } from "../../engine/engine.ts";
import { useHomebrew } from "../../state/homebrew.ts";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";

beforeAll(() => loadEngine());
afterEach(async () => {
  cleanup();
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
});

const PACK = "Reef";

/** Features with uses of every stored shape, and with none. */
const TRAITS = [
  { "~:name": "No Uses", "~:description": "Plain." },
  { "~:name": "Fixed", "~:type": "~:action", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": 3 } },
  { "~:name": "Short Unit", "~:frequency": { "~:units": "~:short-rest", "~:amount": 2 } },
  { "~:name": "Old Minute", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/minute", "~:amount": 1 } },
  { "~:name": "Old Round", "~:frequency": { "~:units": "~:round", "~:amount": 1 } },
  { "~:name": "No Amount", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/day" } },
  { "~:name": "Ability", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": { "~:ability": "~:cha", "~:min": 1 } } },
  { "~:name": "Qualified Ability", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": { "~:ability": "~:orcpub.dnd.e5.character/int" } } },
  { "~:name": "Level", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/day", "~:amount": { "~:level": true, "~:times": 2, "~:plus": 1 } } },
  { "~:name": "Proficiency", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": { "~:prof-bonus": true, "~:times": 1, "~:plus": 0 } } },
  { "~:name": "Two Bases", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": { "~:prof-bonus": true, "~:level": true } } },
  { "~:name": "Unknown Keys", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/turn", "~:amount": { "~:level": true, "~:per": 3 }, "~:note": "x" } },
  { "~:name": "Odd Values", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": { "~:level": true, "~:times": 7, "~:plus": 9, "~:min": 8 } } },
  { "~:name": "Big", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": 35 } },
  { "~:name": "Number Ability", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": { "~:ability": 3, "~:prof-bonus": true, "~:min": null } } },
  { "~:name": "No Unit", "~:frequency": { "~:amount": 2 } },
];

const base = (key: string, name: string) => ({ "~:key": `~:${key}`, "~:name": name, "~:option-pack": PACK, "~:traits": TRAITS });
const FORMS: [type: string, contentType: string, item: Record<string, unknown>][] = [
  ["race", "orcpub.dnd.e5/races", { ...base("reefborn", "Reefborn"), "~:size": "~:medium", "~:speed": 30 }],
  ["subrace", "orcpub.dnd.e5/subraces", { ...base("sea-elf", "Sea Elf"), "~:race": "~:elf" }],
  ["background", "orcpub.dnd.e5/backgrounds", base("tidewatch", "Tidewatch")],
  ["class", "orcpub.dnd.e5/classes", { ...base("tide-sage", "Tide Sage"), "~:hit-die": 8, "~:ability-increase-levels": [4, 8, 12, 16, 19], "~:level-modifiers": [] }],
  ["subclass", "orcpub.dnd.e5/subclasses", { ...base("oath-of-tides", "Oath of Tides"), "~:class": "~:paladin", "~:level-modifiers": [] }],
  [
    "monster",
    "orcpub.dnd.e5/monsters",
    {
      ...base("mud-imp", "Mud Imp"),
      "~:size": "~:small",
      "~:type": "~:fiend",
      "~:alignment": "neutral",
      "~:armor-class": 12,
      "~:hit-points": { "~:die-count": 3, "~:die": 6 },
      "~:traits": TRAITS.map((trait) => ({ ...trait, "~:type": trait["~:type"] ?? "~:legendary-action" })),
    },
  ],
];

test.each(FORMS)("the %s form opens features with every shape of uses and saves them equal", async (type, contentType, item) => {
  await useHomebrew.getState().saveItem(PACK, `~:${contentType}`, item);
  const router = createMemoryRouter(
    [
      { path: "/content", element: <h1>My Content</h1> },
      { path: "/content/edit/:type/:pack/:key", element: <HomebrewBuilder /> },
    ],
    { initialEntries: [`/content/edit/${type}/${PACK}/${String(item["~:key"]).slice(2)}`] },
  );
  render(<RouterProvider router={router} />);
  await screen.findByRole("group", { name: `Feature ${TRAITS.length} Uses` });
  expect(screen.getByRole("group", { name: "Feature 4 Recharges" }).textContent).toContain("Minute (from the pack)");
  const save = screen.getByRole<HTMLButtonElement>("button", { name: "Save" });
  await waitFor(() => expect(save.disabled).toBe(false));
  fireEvent.click(save);
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  const pack = useHomebrew.getState().packs.find((p) => p.id === PACK)!;
  expect(itemAt(pack.plugin, `~:${contentType}`, item["~:key"] as string)).toEqual(item);
});
