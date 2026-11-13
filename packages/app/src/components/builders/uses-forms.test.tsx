// Each form with the shared feature list opens an imported item whose
// features have uses of every stored shape, and saves it equal (ORC-204):
// opening the uses control and not touching it writes nothing. A feature
// whose text gives suggested uses shows its line, and stores nothing until
// the user presses "Use this" (ORC-206).
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
  { "~:name": "Suggested", "~:description": "As an action, you call the tide. Once you use this trait, you can't use it again until you finish a short or long rest." },
];

const base = (key: string, name: string) => ({ "~:key": `~:${key}`, "~:name": name, "~:option-pack": PACK, "~:traits": TRAITS });
const FORMS: [type: string, contentType: string, item: Record<string, unknown>][] = [
  ["race", "orcpub.dnd.e5/races", { ...base("reefborn", "Reefborn"), "~:size": "~:medium", "~:speed": 30 }],
  ["subrace", "orcpub.dnd.e5/subraces", { ...base("sea-elf", "Sea Elf"), "~:race": "~:elf" }],
  ["background", "orcpub.dnd.e5/backgrounds", base("tidewatch", "Tidewatch")],
  ["feat", "orcpub.dnd.e5/feats", { ...base("keen", "Keen"), "~:ability-increases": { "~#set": [] }, "~:type": "~:action", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": 3 } }],
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
  expect(screen.getByRole("button", { name: `Feature ${TRAITS.length} uses: Use this` })).toBeTruthy();
  expect(screen.getByRole("group", { name: "Feature 4 Recharges" }).textContent).toContain("Minute (from the pack)");
  const save = screen.getByRole<HTMLButtonElement>("button", { name: "Save" });
  await waitFor(() => expect(save.disabled).toBe(false));
  fireEvent.click(save);
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  const pack = useHomebrew.getState().packs.find((p) => p.id === PACK)!;
  expect(itemAt(pack.plugin, `~:${contentType}`, item["~:key"] as string)).toEqual(item);
});

test("the feat form: the feat's own section shows the line of its description, and an open and save stores the feat equal", async () => {
  const feat = {
    "~:key": "~:tide-touched",
    "~:name": "Tide-Touched",
    "~:option-pack": PACK,
    "~:description": "You can use a bonus action to breathe water. You can use this feat a number of times equal to your Wisdom modifier, and you regain all uses when you finish a long rest.",
    "~:ability-increases": { "~#set": [] },
    "~:traits": [{ "~:name": "Salt Sense", "~:description": "You can use it twice per day." }],
  };
  await useHomebrew.getState().saveItem(PACK, "~:orcpub.dnd.e5/feats", feat);
  const router = createMemoryRouter(
    [
      { path: "/content", element: <h1>My Content</h1> },
      { path: "/content/edit/:type/:pack/:key", element: <HomebrewBuilder /> },
    ],
    { initialEntries: [`/content/edit/feat/${PACK}/tide-touched`] },
  );
  render(<RouterProvider router={router} />);
  const featUses = await screen.findByRole("button", { name: "Feat uses: Use this" });
  expect(featUses.closest("p")!.textContent).toContain("Suggested: Wisdom modifier uses (minimum 1), long rest.");
  expect(screen.getByRole("button", { name: "Feat type: Use this" }).closest("p")!.textContent).toContain("Suggested type: Bonus Action.");
  expect(screen.getByRole("button", { name: "Feature 1 uses: Use this" }).closest("p")!.textContent).toContain("Suggested: 2 uses, each day.");
  const save = screen.getByRole<HTMLButtonElement>("button", { name: "Save" });
  await waitFor(() => expect(save.disabled).toBe(false));
  fireEvent.click(save);
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  const pack = useHomebrew.getState().packs.find((p) => p.id === PACK)!;
  expect(itemAt(pack.plugin, "~:orcpub.dnd.e5/feats", "~:tide-touched")).toEqual(feat);
});

test("the feat form: Use this on the feat's own section writes :frequency and :type on the feat", async () => {
  const router = createMemoryRouter(
    [
      { path: "/content", element: <h1>My Content</h1> },
      { path: "/content/new/:type", element: <HomebrewBuilder /> },
    ],
    { initialEntries: ["/content/new/feat"] },
  );
  render(<RouterProvider router={router} />);
  await screen.findByRole("button", { name: "Add a prerequisite" });
  fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Tide-Touched" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "As a bonus action, you breathe water. You can't use it again until you finish a long rest." } });
  fireEvent.click(screen.getByRole("button", { name: "Feat uses: Use this" }));
  fireEvent.click(screen.getByRole("button", { name: "Feat type: Use this" }));
  expect(screen.queryByRole("button", { name: /^Feat .*Use this$/ })).toBeNull();
  const save = screen.getByRole<HTMLButtonElement>("button", { name: "Save" });
  await waitFor(() => expect(save.disabled).toBe(false));
  fireEvent.click(save);
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  const pack = useHomebrew.getState().packs[0];
  expect(itemAt(pack.plugin, "~:orcpub.dnd.e5/feats", "~:tide-touched")).toMatchObject({
    "~:type": "~:b-action",
    "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/long-rest", "~:amount": 1 },
  });
});
