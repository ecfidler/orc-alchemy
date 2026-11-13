// The feat form's "Uses of the feat" and Features sections (ORC-205,
// docs/design/homebrew-forms.md, "Uses on a feat"). The form writes :type and
// :frequency on the feat for its own entry on the sheet, and :traits for its
// features. The engine evaluates a character with the saved feat, and the
// sheet shows the feat's bubble and its features. An .orcbrew export reads
// back equal, and an imported feat opens and saves equal.
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { optionNames } from "@orc-alchemy/ui/testing";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt } from "../../engine/content.ts";
import { engine, loadEngine } from "../../engine/engine.ts";
import { exportOrcbrew } from "../../engine/orcbrew-export.ts";
import { toSheet } from "../../engine/sheet.ts";
import { exampleNumbers, previewFeature } from "../../engine/uses-preview.ts";
import { orcbrewHomebrew, useHomebrew } from "../../state/homebrew.ts";
import { CharacterSheet } from "../CharacterSheet.tsx";
import { HomebrewBuilder } from "../HomebrewBuilder.tsx";
import { choose, groups, shown } from "./test-picks.ts";

beforeAll(() => loadEngine());
afterEach(async () => {
  cleanup();
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
});

const DEFAULT = "Default Option Source";
const FEATS = "~:orcpub.dnd.e5/feats";
const LONG = "~:orcpub.dnd.e5.units/long-rest";

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
async function saveAndLeave(router: ReturnType<typeof renderAt>) {
  await waitFor(() => expect(save().disabled).toBe(false));
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
}
const type = (label: string, value: string) => fireEvent.change(screen.getByRole("textbox", { name: label }), { target: { value } });
const press = (group: string, name: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("button", { name }));
const plugin = (pack = DEFAULT) => useHomebrew.getState().packs.find((p) => p.id === pack)!.plugin;
const stored = (key: string, pack = DEFAULT) => itemAt(plugin(pack), FEATS, `~:${key}`) as Record<string, unknown>;

/** Opens a new feat, and fills its name, its own uses (an action, 3 on a long rest) and two features. */
async function makeStormcaller() {
  const router = renderAt("/content/new/feat");
  await screen.findByRole("button", { name: "Add a prerequisite" });
  type("Name", "Stormcaller");
  type("Description", "You call a gust of wind.");
  await choose("Feat type", "Action");
  press("Feat Uses", "Fixed");
  await choose("Feat amount", "3");
  fireEvent.click(screen.getByRole("button", { name: "Add a feature" }));
  type("Feature 1 name", "Steady Footing");
  type("Feature 1 description", "You have advantage on saving throws against being knocked prone.");
  fireEvent.click(screen.getByRole("button", { name: "Add a feature" }));
  type("Feature 2 name", "Rolling Gait");
  type("Feature 2 description", "You take the Dash action.");
  await choose("Feature 2 type", "Bonus Action");
  press("Feature 2 Uses", "Scaled");
  await choose("Feature 2 equal to", "Character level × n");
  press("Feature 2 Recharges", "Short rest");
  return router;
}

const STORMCALLER = {
  "~:name": "Stormcaller",
  "~:key": "~:stormcaller",
  "~:option-pack": DEFAULT,
  "~:description": "You call a gust of wind.",
  "~:ability-increases": { "~#set": [] },
  "~:type": "~:action",
  "~:frequency": { "~:units": LONG, "~:amount": 3 },
  "~:traits": [
    { "~:name": "Steady Footing", "~:description": "You have advantage on saving throws against being knocked prone." },
    {
      "~:name": "Rolling Gait",
      "~:description": "You take the Dash action.",
      "~:type": "~:b-action",
      "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/short-rest", "~:amount": { "~:level": true } },
    },
  ],
};

const SELECTIONS = "~:orcpub.entity.strict/selections";

/**
 * A human barbarian (the new character's class) of `levels` levels who takes
 * the pack feat `key`, as the engine evaluates it, and its sheet. A human
 * has no feat to pick, so the feat goes in the top-level :feats selection,
 * as in the fork's golden scaled-uses character.
 */
function sheetWithFeat(homebrew: Record<string, object>, key: string, levels: number) {
  const e = engine();
  const options = { homebrew };
  let character: object = e.select(e.emptyCharacter(), ["race"], "human", options);
  for (let level = 1; level < levels; level++) character = e.addLevel(character, "barbarian", options);
  const entity = character as Record<string, object[]>;
  character = { ...entity, [SELECTIONS]: [...entity[SELECTIONS], { "~:orcpub.entity.strict/key": "~:feats", "~:orcpub.entity.strict/options": [{ "~:orcpub.entity.strict/key": `~:${key}` }] }] };
  const { built } = e.evaluate(character, options);
  expect(built["total-levels"]).toBe(levels);
  return toSheet(built, character);
}

test("the form shows Uses of the feat and Features last, and stores :type, :frequency and :traits on the feat", async () => {
  const router = await makeStormcaller();
  expect(groups().slice(-2)).toEqual(["Uses of the feat", "Features"]);
  await saveAndLeave(router);
  expect(stored("stormcaller")).toEqual(STORMCALLER);
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
});

test("a feat with 3 uses for each long rest shows one bubble, on the feat's own entry; its two features show with it", async () => {
  await saveAndLeave(await makeStormcaller());
  const sheet = sheetWithFeat({ [DEFAULT]: plugin() }, "stormcaller", 3);
  const all = Object.values(sheet.features).flat();
  // The feat is an action with its uses; the features are where their types put them.
  expect(sheet.features.actions.filter((f) => f.name === "Stormcaller")).toEqual([{ name: "Stormcaller", text: "You call a gust of wind.", uses: { amount: 3, recharge: "Long rest" } }]);
  expect(sheet.features.traits.filter((f) => f.name === "Steady Footing")).toEqual([{ name: "Steady Footing", text: "You have advantage on saving throws against being knocked prone." }]);
  // A level amount on a feat counts the character level: 3.
  expect(sheet.features.bonusActions.filter((f) => f.name === "Rolling Gait")).toEqual([{ name: "Rolling Gait", text: "You take the Dash action.", uses: { amount: 3, recharge: "Short rest" } }]);
  expect(all.filter((f) => ["Stormcaller", "Steady Footing", "Rolling Gait"].includes(f.name))).toHaveLength(3);
  // The preview of Uses of the feat gives the same section and entry as the sheet.
  expect(previewFeature(stored("stormcaller"), exampleNumbers(3, 10))).toEqual({ section: "actions", feature: sheet.features.actions.find((f) => f.name === "Stormcaller") });
  // Drawn: one bubble for the feat, with 3 circles, and none for its plain feature.
  render(<CharacterSheet sheet={sheet} />);
  const features = within(screen.getByRole("group", { name: "Features & traits" }));
  const bubbles = features.getAllByRole("group", { name: "Stormcaller" });
  expect(bubbles).toHaveLength(1);
  expect(within(bubbles[0]).getAllByRole("button", { name: /^Use / })).toHaveLength(3);
  expect(within(bubbles[0]).getByText("Long rest")).toBeTruthy();
  expect(features.queryByRole("group", { name: "Steady Footing" })).toBeNull();
  expect(features.getByText("Steady Footing")).toBeTruthy();
  expect(features.getByRole("group", { name: "Rolling Gait" })).toBeTruthy();
});

test("a feat with no uses and two features shows the feat and its two features on the sheet", async () => {
  const homebrew = {
    Reef: {
      [FEATS]: {
        "~:sea-legs": {
          "~:key": "~:sea-legs",
          "~:name": "Sea Legs",
          "~:option-pack": "Reef",
          "~:description": "You are at home on a ship.",
          "~:traits": STORMCALLER["~:traits"],
        },
      },
    },
  };
  const sheet = sheetWithFeat(homebrew, "sea-legs", 5);
  const names = (list: { name: string }[]) => list.map((f) => f.name);
  expect(names(sheet.features.traits)).toEqual(expect.arrayContaining(["Sea Legs", "Steady Footing"]));
  expect(sheet.features.traits.find((f) => f.name === "Sea Legs")).toEqual({ name: "Sea Legs", text: "You are at home on a ship." });
  expect(sheet.features.bonusActions.find((f) => f.name === "Rolling Gait")!.uses).toEqual({ amount: 5, recharge: "Short rest" });
});

test("the saved feat exports to .orcbrew and imports again with no change", async () => {
  await saveAndLeave(await makeStormcaller());
  const exported = exportOrcbrew(orcbrewHomebrew(), { pack: DEFAULT });
  if (!("text" in exported)) throw new Error("The pack did not export");
  const read = engine().parseOrcbrew(exported.text, { name: DEFAULT }).data![DEFAULT] as Record<string, unknown>;
  expect(itemAt(read, FEATS, "~:stormcaller")).toEqual(STORMCALLER);
  expect(read).toEqual(plugin());
});

test("a level amount counts the character level: no level select, and the sentence says character level", async () => {
  renderAt("/content/new/feat");
  await screen.findByRole("button", { name: "Add a prerequisite" });
  press("Feat Uses", "Scaled");
  expect(await optionNames(screen.getByRole("combobox", { name: "Feat equal to" }))).toContain("Character level × n");
  await choose("Feat equal to", "Character level × n");
  await choose("Feat n", "2");
  expect(screen.getByText(/^Uses equal/).textContent).toBe("Uses equal 2 × your character level. A level 5 character gets 10.");
  fireEvent.click(screen.getByRole("button", { name: "Add a feature" }));
  press("Feature 1 Uses", "Scaled");
  await choose("Feature 1 equal to", "Character level × n");
  expect(screen.getAllByText(/^Uses equal/).map((p) => p.textContent)).toEqual([
    "Uses equal 2 × your character level. A level 5 character gets 10.",
    "Uses equal your character level. A level 5 character gets 5.",
  ]);
  expect(screen.queryByRole("combobox", { name: "Feat level" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: "Feature 1 level" })).toBeNull();
});

test("None removes :frequency; a feat with no type shows Other and stores no type until the user picks one", async () => {
  const item = { "~:key": "~:keen", "~:name": "Keen", "~:option-pack": "Reef", "~:frequency": { "~:units": LONG, "~:amount": 2 } };
  await useHomebrew.getState().saveItem("Reef", FEATS, item);
  const router = renderAt("/content/edit/feat/Reef/keen");
  await screen.findByRole("group", { name: "Feat Uses" });
  expect(shown("Feat type")).toBe("Other");
  expect(shown("Feat amount")).toBe("2");
  // The preview draws the feat as a trait with its bubble.
  const preview = within(screen.getByRole("group", { name: "Feat preview" }));
  expect(preview.getByRole("heading", { level: 3 }).textContent).toBe("Features, Traits, and Feats");
  expect(preview.getAllByRole("button", { name: /^Use / })).toHaveLength(2);
  press("Feat Uses", "None");
  await saveAndLeave(router);
  const { "~:frequency": _, ...rest } = item;
  expect(stored("keen", "Reef")).toEqual(rest);
});

test("adding a feature and deleting it stores an empty feature list, as the race form does", async () => {
  const item = { "~:key": "~:keen", "~:name": "Keen", "~:option-pack": "Reef" };
  await useHomebrew.getState().saveItem("Reef", FEATS, item);
  const router = renderAt("/content/edit/feat/Reef/keen");
  await screen.findByRole("group", { name: "Feat Uses" });
  fireEvent.click(screen.getByRole("button", { name: "Add a feature" }));
  fireEvent.click(screen.getByRole("button", { name: "Delete feature 1" }));
  await saveAndLeave(router);
  expect(stored("keen", "Reef")).toEqual({ ...item, "~:traits": [] });
});

const fixturePack = () => {
  const text = readFileSync(join(import.meta.dirname, "../../../../../fixtures/orcbrew/scaled-uses.orcbrew"), "utf8");
  const pack = engine().parseOrcbrew(text, { name: "Scaled Uses" }).data!["Scaled Uses"] as Record<string, Record<string, unknown>>;
  return Object.values(pack[FEATS]) as Record<string, unknown>[];
};

/** Feats of every shape the two sections read: with and without :type, :frequency and :traits, and with unknown keys. */
const SHAPES: [string, Record<string, unknown>][] = [
  ["no uses, no type, no features", { "~:key": "~:plain", "~:name": "Plain", "~:option-pack": "Reef", "~:description": "Nothing more." }],
  ["a type only", { "~:key": "~:typed", "~:name": "Typed", "~:option-pack": "Reef", "~:type": "~:reaction" }],
  ["the type Other", { "~:key": "~:other", "~:name": "Other", "~:option-pack": "Reef", "~:type": "~:other" }],
  ["uses only", { "~:key": "~:fixed", "~:name": "Fixed", "~:option-pack": "Reef", "~:frequency": { "~:units": "~:short-rest", "~:amount": 2 } }],
  ["a unit from an old pack", { "~:key": "~:minute", "~:name": "Minute", "~:option-pack": "Reef", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/minute", "~:amount": 1 } }],
  [
    "scaled uses with unknown keys",
    { "~:key": "~:odd", "~:name": "Odd", "~:option-pack": "Reef", "~:frequency": { "~:units": LONG, "~:amount": { "~:level": true, "~:times": 7, "~:per": 3 }, "~:note": "x" } },
  ],
  ["an empty feature list", { "~:key": "~:empty", "~:name": "Empty", "~:option-pack": "Reef", "~:traits": [] }],
  [
    "everything and unknown keys",
    {
      "~:key": "~:all",
      "~:name": "All",
      "~:option-pack": "Reef",
      "~:type": "~:b-action",
      "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/day", "~:amount": { "~:ability": "~:wis", "~:min": 1 } },
      "~:traits": [{ "~:name": "Odd Trait", "~:level": 3, "~:extra": [1, 2], "~:frequency": { "~:amount": 4 } }, {}],
      "~:homebrew-note": "kept",
      "~:props": { "~:unknown-prop": true },
    },
  ],
];

test.each(SHAPES)("an imported feat with %s opens and saves equal", async (_, item) => {
  await useHomebrew.getState().saveItem("Reef", FEATS, item);
  const router = renderAt(`/content/edit/feat/Reef/${String(item["~:key"]).slice(2)}`);
  await screen.findByRole("group", { name: "Feat Uses" });
  await saveAndLeave(router);
  expect(stored(String(item["~:key"]).slice(2), "Reef")).toEqual(item);
});

test("the fixture pack's feats open and save equal", async () => {
  const feats = fixturePack();
  expect(feats.map((f) => f["~:name"])).toEqual(["Stormcaller", "Sea Legs"]);
  for (const feat of feats) {
    await useHomebrew.getState().saveItem("Scaled Uses", FEATS, feat);
    const router = renderAt(`/content/edit/feat/${encodeURIComponent("Scaled Uses")}/${String(feat["~:key"]).slice(2)}`);
    await screen.findByRole("group", { name: "Feat Uses" });
    await saveAndLeave(router);
    expect(stored(String(feat["~:key"]).slice(2), "Scaled Uses")).toEqual(feat);
    cleanup();
  }
});
