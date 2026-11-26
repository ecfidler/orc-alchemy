// The question before a change that removes picks (ORC-344, docs/design/character-builder.md "A change that removes
// picks"), on the Background and Race steps: the title names the change, the body lists the picks with their step,
// Cancel changes nothing, and the action removes the picks and then makes the change.
import "fake-indexeddb/auto";
import { answerConfirmDialog } from "@orc-alchemy/ui/testing";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { addFirstClass, newCharacter } from "../engine/new-character.ts";
import { RACE_PACK, TAGGED_SUBRACES, WOOD_KIN } from "../engine/test-races.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { Builder } from "./Builder.tsx";
import { pickIn, section } from "./test-pick.ts";

beforeAll(() => loadEngine());
afterEach(async () => {
  cleanup();
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
});

/** A new character with the class and these picks, open in the builder at the step. */
function open(step: string, classKey: string, picks: [path: string[], key: string][]) {
  const e = engine();
  const content = useHomebrew.getState().content;
  const start = addFirstClass(e, newCharacter(e), classKey, content);
  const entity = picks.reduce((entity, [path, key]) => e.select(entity, path, key, content) as StrictEntity, start);
  useCharacter.getState().load("change-question", entity);
  render(<Builder step={step} />);
  return entity;
}

const current = () => useCharacter.getState().entity!;
const selectionAt = (path: string) =>
  engine()
    .evaluate(current(), useHomebrew.getState().content)
    .selections.find((s) => s.path.join("/") === path);

/** The rows of the open question: each place, and its lines. */
function questionRows(dialog: HTMLElement) {
  return [...dialog.querySelectorAll("dl > div")].map((group) => [
    group.querySelector("dt")?.textContent,
    ...[...group.querySelectorAll("dd")].map((line) => line.textContent),
  ]);
}

const clericSkills: [string[], string][] = [
  [["class", "cleric", "skill-proficiency"], "insight"],
  [["class", "cleric", "skill-proficiency"], "religion"],
];

test("a Cleric with Insight and Religion that takes Acolyte is asked, and Cancel changes nothing", async () => {
  const entity = open("Background", "cleric", clericSkills);
  // The list with a detail panel (ORC-347): a click on the name shows Acolyte, and its Choose button picks it.
  fireEvent.click(within(section("Background")).getByRole("button", { name: "Acolyte" }));
  const choose = within(section("Background")).getByRole("button", { name: "Choose Acolyte" });
  choose.focus();
  fireEvent.click(choose);
  const dialog = await screen.findByRole("alertdialog", { name: "Change to Acolyte?" });
  expect(within(dialog).getByText("These picks go:")).toBeTruthy();
  expect(questionRows(dialog)).toEqual([["Proficiencies", "Skills: Insight, Religion"]]);
  expect(
    within(dialog)
      .getAllByRole("button")
      .map((button) => button.textContent),
  ).toEqual(["Cancel", "Change"]);
  // Cancel has the focus, as in each confirm dialog of the app.
  await waitFor(() => expect(document.activeElement?.textContent).toBe("Cancel"));

  await answerConfirmDialog("Cancel");
  expect(current()).toBe(entity);
  // The focus goes back to the control that opened the question.
  await waitFor(() => expect(document.activeElement).toBe(within(section("Background")).getByRole("button", { name: "Choose Acolyte" })));
});

test("after Change, the Cleric skills go before Acolyte comes, and the Cleric picks 2 again", async () => {
  open("Background", "cleric", clericSkills);
  await pickIn(section("Background"), "Acolyte");
  expect(await answerConfirmDialog("Change")).toBe("Change to Acolyte?");
  expect(selectionAt("background")?.selected).toEqual(["acolyte"]);
  expect(selectionAt("class/cleric/skill-proficiency")).toMatchObject({ selected: [], remaining: 2 });
  // The step that had the picks shows its new count: the 2 Cleric skills, and the 2 languages of Acolyte.
  expect(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: "Proficiencies, 4 picks left" })).toBeTruthy();
  // The block of Acolyte takes the place of the list, and the focus goes to its Change button.
  await waitFor(() => expect(document.activeElement).toBe(within(section("Background")).getByRole("button", { name: "Change Background" })));
});

test("a different race for a Half-Elf with its picks made: Replace Half-Elf with Dwarf?, with the picks of each step", async () => {
  open("Race", "fighter", [
    [["race"], "half-elf"],
    [["race", "half-elf", "skill-proficiency"], "perception"],
    [["race", "half-elf", "skill-proficiency"], "stealth"],
  ]);
  await pickIn(section("Race"), "Dwarf");
  const dialog = await screen.findByRole("alertdialog", { name: "Replace Half-Elf with Dwarf?" });
  expect(questionRows(dialog)).toEqual([["Proficiencies", "Skills: Perception, Stealth"]]);
  expect(await answerConfirmDialog("Replace")).toBe("Replace Half-Elf with Dwarf?");
  expect(selectionAt("race")?.selected).toEqual(["dwarf"]);
  expect(engine().evaluate(current()).built["skill-profs"] ?? {}).toEqual({});
});

test("a change that removes no pick asks nothing", async () => {
  open("Race", "fighter", [[["race"], "half-elf"]]);
  await pickIn(section("Race"), "Dwarf");
  expect(selectionAt("race")?.selected).toEqual(["dwarf"]);
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("after a pick in the list of the race, Cancel of the question keeps the list, with the focus on the Choose button", async () => {
  const entity = open("Race", "fighter", [
    [["race"], "half-elf"],
    [["race", "half-elf", "skill-proficiency"], "perception"],
  ]);
  await pickIn(section("Race"), "Dwarf");
  await answerConfirmDialog("Cancel");
  expect(current()).toBe(entity);
  // The list with a detail panel stays open (ORC-348): the Choose button of the panel has the focus.
  await waitFor(() => expect(document.activeElement).toBe(within(section("Race")).getByRole("button", { name: "Choose Dwarf" })));
});

const halfElfSkill: [string[], string] = [["race", "half-elf", "skill-proficiency"], "perception"];

test("when the character changes while the question is open, the change is planned again, and made when it removes only the listed picks", async () => {
  open("Race", "fighter", [[["race"], "half-elf"], halfElfSkill]);
  await pickIn(section("Race"), "Dwarf");
  await screen.findByRole("alertdialog", { name: "Replace Half-Elf with Dwarf?" });
  // Another change, which removes no pick: the name.
  act(() => useCharacter.getState().update((entity) => engine().setValue(entity, "character-name", "Ash")));
  await answerConfirmDialog("Replace");
  expect(selectionAt("race")?.selected).toEqual(["dwarf"]);
  expect(engine().evaluate(current()).built["character-name"]).toBe("Ash");
});

test("when the character changes while the question is open and the change then removes a pick that it did not list, nothing changes", async () => {
  open("Race", "fighter", [[["race"], "half-elf"], halfElfSkill]);
  await pickIn(section("Race"), "Dwarf");
  await screen.findByRole("alertdialog", { name: "Replace Half-Elf with Dwarf?" });
  // A second Half-Elf skill, which the question does not list.
  act(() => useCharacter.getState().update((entity) => engine().select(entity, halfElfSkill[0], "stealth")));
  const changed = current();
  await answerConfirmDialog("Replace");
  expect(current()).toBe(changed);
  expect(selectionAt("race")?.selected).toEqual(["half-elf"]);
});

test("a different subrace asks: Replace High Elf with Wood Kin?, with the cantrip of High Elf", async () => {
  await useHomebrew.getState().saveItem(RACE_PACK, TAGGED_SUBRACES, WOOD_KIN);
  open("Race", "wizard", [
    [["race"], "elf"],
    [["race", "elf", "subrace"], "high-elf"],
    [["race", "elf", "subrace", "high-elf", "high-elf-cantrips-known"], "fire-bolt"],
  ]);
  await pickIn(section("Subrace"), "Wood Kin");
  const dialog = await screen.findByRole("alertdialog", { name: "Replace High Elf with Wood Kin?" });
  expect(questionRows(dialog)).toEqual([["Spells", "High Elf Cantrips Known: Fire Bolt"]]);
  await answerConfirmDialog("Replace");
  expect(selectionAt("race/elf/subrace")?.selected).toEqual(["wood-kin"]);
});
