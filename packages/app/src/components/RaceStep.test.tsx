// The Race step (ORC-348, docs/design/character-builder.md "The Background and Race steps", "Custom Origin"): the list
// with a detail panel and the block of the race, Draconic Ancestry in Choices, a Dwarf with one subrace and with two,
// the lines of a Half-Elf to other steps, and the Custom Origin row.
import "fake-indexeddb/auto";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine } from "../engine/engine.ts";
import { ASH_DWARF, RACE_PACK, TAGGED_SUBRACES } from "../engine/test-races.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { openFighter, resetBuilder } from "./test-builder.tsx";
import { pickIn, picksIn, section } from "./test-pick.ts";

beforeAll(() => loadEngine());
afterEach(resetBuilder);

/** A new fighter, open in the builder on the Race step. */
const open = () => openFighter("Race");

const race = () => section("Race");
const header = () => within(race()).getAllByRole("heading", { level: 3 })[0].textContent;
const subracePicks = () =>
  engine()
    .evaluate(useCharacter.getState().entity!, useHomebrew.getState().content)
    .selections.filter((s) => s.key === "subrace")
    .map((s) => s.selected);

/** Shows the race in the panel, and gives its facts, once they load, as [term, value]. */
async function facts(name: string) {
  fireEvent.click(within(race()).getByRole("button", { name }));
  const panel = within(race()).getByRole("region", { name });
  await waitFor(() => expect(panel.querySelector("dt")).not.toBeNull());
  return [...panel.querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
}

test("Dragonborn: the block has Draconic Ancestry in Choices with a Choose button, and a pick there makes the step done", async () => {
  open();
  expect(header()).toBe("Race,1 left");
  await pickIn(race(), "Dragonborn");
  expect(header()).toBe("Dragonborn,1 left");
  const choices = within(race()).getByRole("region", { name: "Choices" });
  const ancestry = section("Draconic Ancestry");
  expect(choices.contains(ancestry)).toBe(true);
  await pickIn(ancestry, "Red");
  expect(header()).toBe("Dragonborn,Done");
  expect(picksIn(race())).toEqual(["Dragonborn", "Red"]);
});

test("Dwarf with one subrace: the panel shows Hill Dwarf as a fact, the pick picks it too, and the block has no Choices", async () => {
  open();
  expect(await facts("Dwarf")).toContainEqual(["Subrace", "Hill Dwarf: Wisdom +1"]);
  fireEvent.click(within(race()).getByRole("button", { name: "Choose Dwarf" }));
  await waitFor(() => expect(header()).toBe("Dwarf,Done"));
  expect(subracePicks()).toEqual([["hill-dwarf"]]);
  expect(within(race()).queryByRole("region", { name: "Choices" })).toBeNull();
  expect(within(race()).getByRole("button", { name: "Tools, 1 left, Proficiencies" })).toBeTruthy();
});

test("Dwarf with two subraces (a pack subrace): no Subrace fact, and the Subrace row in Choices", async () => {
  await useHomebrew.getState().saveItem(RACE_PACK, TAGGED_SUBRACES, ASH_DWARF);
  open();
  expect((await facts("Dwarf")).map(([term]) => term)).toEqual(["Ability scores", "Size, speed", "Languages"]);
  fireEvent.click(within(race()).getByRole("button", { name: "Choose Dwarf" }));
  await waitFor(() => expect(header()).toBe("Dwarf,1 left"));
  expect(subracePicks()).toEqual([[]]);
  await pickIn(section("Subrace"), "Ash Dwarf");
  expect(header()).toBe("Dwarf,Done");
  expect(subracePicks()).toEqual([["ash-dwarf"]]);
});

test("Half-Elf: no Choices, three lines to other steps, and a line opens its step", async () => {
  open();
  await pickIn(race(), "Half-Elf");
  expect(within(race()).queryByRole("region", { name: "Choices" })).toBeNull();
  const lines = within(within(race()).getByRole("list", { name: "Picked on other steps" })).getAllByRole("button");
  expect(lines.map((b) => b.getAttribute("aria-label"))).toEqual([
    "Ability scores, 2 left, Abilities",
    "Skills, 2 left, Proficiencies",
    "Languages, 1 left, Proficiencies",
  ]);
  fireEvent.click(lines[1]);
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Proficiencies");
});

test("Custom Origin is the fixed last row: its panel says what it is, and its button opens the dialog and picks nothing", async () => {
  open();
  const names = [...race().querySelectorAll(".ui-list-panel-name")].map((name) => name.textContent);
  expect(names.at(-1)).toBe("Custom Origin");
  expect(race().querySelector(".ui-list-panel-fixed")?.textContent).toBe("Custom Origin");
  fireEvent.click(within(race()).getByRole("button", { name: "Custom Origin" }));
  const panel = within(race()).getByRole("region", { name: "Custom Origin" });
  expect(panel).toHaveTextContent("A custom origin is not saved to your homebrew content.");
  expect(within(panel).queryByRole("button", { name: /^Choose/ })).toBeNull();
  fireEvent.click(within(panel).getByRole("button", { name: "Start a custom origin" }));
  expect(await screen.findByRole("dialog", { name: "Custom Origin" })).toBeTruthy();
  const picked = engine()
    .evaluate(useCharacter.getState().entity!, useHomebrew.getState().content)
    .selections.find((s) => s.key === "race")!.selected;
  expect(picked).toEqual([]);
});
