import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { optionNames, pickOption } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test } from "vitest";
import { itemAt, withoutDisabledFlag } from "../../engine/content.ts";
import { engine, loadEngine } from "../../engine/engine.ts";
import { exportOrcbrew } from "../../engine/orcbrew-export.ts";
import { orcbrewHomebrew, useHomebrew } from "../../state/homebrew.ts";
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
const check = (group: string, label: string) => fireEvent.click(within(screen.getByRole("group", { name: group })).getByRole("checkbox", { name: label }));
const choose = (label: string, option: string | RegExp) => pickOption(screen.getByRole("combobox", { name: label }), option);
const shown = (label: string) => screen.getByRole("combobox", { name: label }).textContent;

test("the race list has the SRD races and the enabled packs' races, and the race's values show until the subrace has its own", async () => {
  await useHomebrew.getState().saveItem("Lizards", "~:orcpub.dnd.e5/races", { "~:key": "~:lizard", "~:name": "Lizard", "~:option-pack": "Lizards", "~:speed": 40, "~:size": "~:small" });
  renderAt("/content/new/subrace");
  await screen.findByLabelText("Spell 1");
  const races = await optionNames(screen.getByRole("combobox", { name: "Race" }));
  expect(races).toEqual(expect.arrayContaining(["Dwarf", "Elf", "Tiefling", "Lizard"]));
  expect(races).not.toContain("Custom");

  // The new subrace is a dwarf's: speed 25, darkvision 60, Con +2.
  expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  expect(screen.queryByRole("list", { name: "Problems: Name" })?.textContent).toBe("Name is required.");
  expect([shown("Race"), shown("Size"), shown("Speed"), shown("Darkvision")]).toEqual(["Dwarf", "medium", "25", "60"]);
  expect(screen.getByText("Race bonus 2, total 2")).toBeTruthy();
  await choose("Race", "Lizard");
  expect([shown("Size"), shown("Speed")]).toEqual(["small", "40"]);
  await choose("Speed", "35");
  await choose("Race", "Elf");
  expect(shown("Speed")).toBe("35");
});

test("the form recreates the Star Elf subrace of the community fixture, and Edit loads it back", async () => {
  const router = renderAt("/content/new/subrace");
  await screen.findByLabelText("Spell 1");
  type("Option source (pack)", "dand wiki");
  type("Name", "Star Elf");
  await choose("Race", "Elf");
  await choose("Wisdom", "+1");
  for (const weapon of ["Dart", "Morningstar", "Rapier", "Shortbow"]) check("Weapon Proficiencies", weapon);
  check("Skill Proficiencies", "Insight");
  await choose("Spell 1 spellcasting ability", "Wisdom");
  await choose("Spell 1", "Guidance");
  await choose("Spell 2 unlock at level", "3");
  await choose("Spell 2 level", "1");
  await choose("Spell 2 spellcasting ability", "Wisdom");
  await choose("Spell 2", "Detect Magic");
  await choose("Spell 3 unlock at level", "5");
  await choose("Spell 3 level", "2");
  await choose("Spell 3 spellcasting ability", "Wisdom");
  await choose("Spell 3", "Detect Thoughts");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });

  const parsed = engine().parseOrcbrew(readFileSync(join(orcbrewDir, "community-dandwiki-star-elf.orcbrew"), "utf8")).data as Record<string, object>;
  const fixture = itemAt(parsed["Imported Content"], "~:orcpub.dnd.e5/subraces", "~:star-elf");
  expect(fixture).toHaveProperty("~:name", "Star Elf");
  const plugin = useHomebrew.getState().packs.find((p) => p.id === "dand wiki")!.plugin;
  // The old save changes nothing that the fixture does not have, so nothing is normalized.
  expect(itemAt(plugin, "~:orcpub.dnd.e5/subraces", "~:star-elf")).toEqual(fixture);
  expect(engine().validateForExport(useHomebrew.getState().homebrew!).valid).toBe(true);
  // My Content's .orcbrew export of the pack reads back as the fixture's pack, without the old pack flag the fixture carries.
  const exported = exportOrcbrew(orcbrewHomebrew(), { pack: "dand wiki" });
  if (!("text" in exported)) throw new Error("The pack did not export");
  expect(engine().parseOrcbrew(exported.text, { name: "dand wiki" }).data!["dand wiki"]).toEqual(withoutDisabledFlag(parsed["Imported Content"]));

  cleanup();
  renderAt(`/content/edit/subrace/${encodeURIComponent("dand wiki")}/star-elf`);
  await screen.findByRole("form", { name: "Edit subrace" });
  await screen.findByLabelText("Spell 1");
  expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Star Elf");
  expect([shown("Race"), shown("Wisdom"), shown("Spell 2 unlock at level"), shown("Spell 3")]).toEqual(["Elf", "+1", "3", "Detect Thoughts"]);
  expect(within(screen.getByRole("group", { name: "Weapon Proficiencies" })).getByRole("checkbox", { name: "Rapier" })).toBeChecked();
  expect(save().disabled).toBe(false);
});

test("the subrace modifiers are stored as the old events store them", async () => {
  const router = renderAt("/content/new/subrace");
  await screen.findByLabelText("Spell 1");
  type("Name", "Deep Dwarf");
  await choose("Darkvision", "120");
  check("Hit Points", "Your hit point maximum increases by 1 for each of your levels");
  check("Hit Points", "Your hit point maximum increases by 2 for each of your levels");
  check("Saving Throw Advantage", "You have advantage on saving throws against being Poisoned");
  check("Languages", "Undercommon");
  fireEvent.click(save());
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });

  const plugin = useHomebrew.getState().packs.find((p) => p.id === "Default Option Source")!.plugin;
  expect(itemAt(plugin, "~:orcpub.dnd.e5/subraces", "~:deep-dwarf")).toEqual({
    "~:name": "Deep Dwarf",
    "~:key": "~:deep-dwarf",
    "~:option-pack": "Default Option Source",
    "~:race": "~:dwarf",
    "~:darkvision": 120,
    "~:traits": [],
    "~:props": { "~:max-hp-bonus": 2, "~:saving-throw-advantage": { "~:poisoned": true }, "~:language": { "~:undercommon": true } },
  });
});
