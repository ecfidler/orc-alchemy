// The Proficiencies step in the builder (ORC-346, docs/design/character-builder.md "The Proficiencies step"): the
// group headings, the "Already has" tokens, a section for each source, and the rail that counts these picks there.
// e2e/proficiencies.spec.ts measures in a browser that a pick does not move what is above it.
import "fake-indexeddb/auto";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";
import { pickIn, picksIn, section } from "./test-pick.ts";

beforeAll(() => loadEngine());
afterEach(cleanup);

/** The entity, from the engine's level 1 barbarian with these changes, open in the builder at the step. */
function open(step: string, ...changes: ((entity: StrictEntity) => StrictEntity)[]) {
  const entity = changes.reduce((entity, change) => change(entity), engine().emptyCharacter() as StrictEntity);
  useCharacter.getState().load("proficiencies-step", entity);
  render(<Builder step={step} />);
}

const select = (path: string[], key: string) => (entity: StrictEntity) => engine().select(entity, path, key) as StrictEntity;
const rogue = (entity: StrictEntity) => engine().setClass(entity, 0, "rogue") as StrictEntity;

const builder = () => within(screen.getByRole("region", { name: "Builder" }));
const rail = () => within(screen.getByRole("navigation", { name: "Steps" }));
/** The level and the name of each group heading and section heading of the step, in page order, with no mark. */
const outline = () =>
  [...screen.getByRole("region", { name: "Builder" }).querySelectorAll("h3, h4")].map(
    (h) => `${h.tagName} ${h.textContent?.replace(/,(\d+ left|Done|Remove \d+)$/, "")}`,
  );
/** The "Already has" tokens of a group. */
const alreadyHas = (group: string) => {
  const line = within(builder().getByRole("group", { name: group })).queryByRole("group", { name: "Already has" });
  return line ? [...line.querySelectorAll(".ui-token-label")].map((label) => label.textContent) : [];
};

test("a half-elf acolyte: the Skills and Languages groups, what it already has, and one merged Languages section", () => {
  open("Proficiencies", select(["race"], "half-elf"), select(["background"], "acolyte"));
  expect(outline()).toEqual(["H3 Skills", "H4 Skills: Barbarian", "H4 Skills: Half-Elf", "H3 Languages", "H4 Languages: Acolyte, Half-Elf"]);
  // A group with no selection does not show.
  expect(builder().queryByRole("group", { name: "Tools" })).toBeNull();
  expect(alreadyHas("Skills")).toEqual(["Insight (Acolyte)", "Religion (Acolyte)"]);
  expect(alreadyHas("Languages")).toEqual(["Common (Half-Elf)", "Elvish (Half-Elf)"]);
  // The tokens have no X.
  for (const line of builder().getAllByRole("group", { name: "Already has" })) expect(within(line).queryByRole("button")).toBeNull();
  // The heading has the left mark in its text.
  expect(within(section("Languages: Acolyte, Half-Elf")).getByRole("heading").textContent).toBe("Languages: Acolyte, Half-Elf,3 left");
});

test("an item that the character has from another source is not available, with that source as the reason", async () => {
  open("Proficiencies", select(["race"], "half-elf"), select(["background"], "acolyte"));
  await pickIn(section("Skills: Half-Elf"), "Perception");
  expect(picksIn(section("Skills: Half-Elf"))).toEqual(["Perception"]);
  const perception = within(section("Skills: Barbarian")).getByRole("button", { name: "Perception" });
  expect([perception.hasAttribute("disabled"), perception.querySelector("[data-reason]")?.textContent]).toEqual([true, "From Half-Elf"]);
  // A pick is not a token of "Already has".
  expect(alreadyHas("Skills")).toEqual(["Insight (Acolyte)", "Religion (Acolyte)"]);
});

test("a rogue: the skill section, then the Expertise section, in the Skills group", async () => {
  open("Proficiencies", rogue);
  expect(outline()).toEqual(["H3 Skills", "H4 Skills: Rogue", "H4 Expertise: Rogue"]);
  await pickIn(section("Expertise: Rogue"), "Two Skills");
  // The pick opens the choice of skills after the Expertise section.
  expect(outline()).toEqual(["H3 Skills", "H4 Skills: Rogue", "H4 Expertise: Rogue", "H4 Skill Expertise: Rogue"]);
});

test("a dwarf rogue has a Tools group with the rogue's thieves' tools", () => {
  open("Proficiencies", rogue, select(["race"], "dwarf"));
  expect(outline()).toEqual(["H3 Skills", "H4 Skills: Rogue", "H4 Expertise: Rogue", "H3 Tools", "H4 Tools: Dwarf"]);
  expect(alreadyHas("Tools")).toEqual(["Thieves' Tools (Rogue)"]);
});

test("the rail counts these picks on the Proficiencies step only, and the Race and Background steps do not show them", () => {
  open("Race", select(["race"], "half-elf"), select(["background"], "acolyte"));
  expect(rail().getByRole("button", { name: "Proficiencies, 7 picks left" })).toBeTruthy();
  expect(rail().getByRole("button", { name: "Race" })).toBeTruthy();
  expect(rail().getByRole("button", { name: "Background" })).toBeTruthy();
  // The block of the race (ORC-348) has a line to Proficiencies in place of these sections.
  expect(outline()).toEqual(["H3 Half-Elf", "H4 Picked on other steps"]);
  cleanup();
  open("Background", select(["race"], "half-elf"), select(["background"], "acolyte"));
  // The block of the background (ORC-347) has a line to Proficiencies in place of these sections.
  expect(outline()).toEqual(["H3 Acolyte", "H4 Picked on other steps"]);
});
