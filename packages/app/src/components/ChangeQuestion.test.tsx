// The question before a change that removes picks (ORC-344, docs/design/character-builder.md "A change that removes
// picks"), on the Background and Race steps: the title names the change, the body lists the picks with their step,
// Cancel changes nothing, and the action removes the picks and then makes the change.
import "fake-indexeddb/auto";
import { answerConfirmDialog } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { addFirstClass, newCharacter } from "../engine/new-character.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";
import { pickIn, section } from "./test-pick.ts";

beforeAll(() => loadEngine());
afterEach(cleanup);

/** A new character with the class and these picks, open in the builder at the step. */
function open(step: string, classKey: string, picks: [path: string[], key: string][]) {
  const e = engine();
  const start = addFirstClass(e, newCharacter(e), classKey);
  const entity = picks.reduce((entity, [path, key]) => e.select(entity, path, key) as StrictEntity, start);
  useCharacter.getState().load("change-question", entity);
  render(<Builder step={step} />);
  return entity;
}

const current = () => useCharacter.getState().entity!;
const selectionAt = (path: string) =>
  engine()
    .evaluate(current())
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
  const acolyte = within(section("Background")).getByRole("button", { name: "Acolyte" });
  acolyte.focus();
  fireEvent.click(acolyte);
  const dialog = await screen.findByRole("alertdialog", { name: "Change to Acolyte?" });
  expect(within(dialog).getByText("These picks go:")).toBeTruthy();
  expect(questionRows(dialog)).toEqual([["Proficiencies", "Skill Proficiency: Insight, Religion"]]);
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
  await waitFor(() => expect(document.activeElement).toBe(within(section("Background")).getByRole("button", { name: "Acolyte" })));
});

test("after Change, the Cleric skills go before Acolyte comes, and the Cleric picks 2 again", async () => {
  open("Background", "cleric", clericSkills);
  await pickIn(section("Background"), "Acolyte");
  expect(await answerConfirmDialog("Change")).toBe("Change to Acolyte?");
  expect(selectionAt("background")?.selected).toEqual(["acolyte"]);
  expect(selectionAt("class/cleric/skill-proficiency")).toMatchObject({ selected: [], remaining: 2 });
  // The step that had the picks shows its new count: the 2 Cleric skills, and the 2 languages of Acolyte.
  expect(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: "Proficiencies, 4 picks left" })).toBeTruthy();
});

test("a different race for a Half-Elf with its picks made: Replace Half-Elf with Dwarf?, with the picks of each step", async () => {
  open("Race", "fighter", [
    [["race"], "half-elf"],
    [["race", "half-elf", "skill-proficiency"], "perception"],
    [["race", "half-elf", "skill-proficiency"], "stealth"],
  ]);
  await pickIn(section("Race"), "Dwarf");
  const dialog = await screen.findByRole("alertdialog", { name: "Replace Half-Elf with Dwarf?" });
  expect(questionRows(dialog)).toEqual([["Proficiencies", "Skill Proficiency: Perception, Stealth"]]);
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

test("after the list of the race closes on a pick, Cancel of the question gives the focus back to the Change button", async () => {
  const entity = open("Race", "fighter", [
    [["race"], "half-elf"],
    [["race", "half-elf", "skill-proficiency"], "perception"],
  ]);
  await pickIn(section("Race"), "Dwarf");
  await answerConfirmDialog("Cancel");
  expect(current()).toBe(entity);
  await waitFor(() => expect(document.activeElement).toBe(within(section("Race")).getByRole("button", { name: "Change Race" })));
});
