// The section Choices of a class block (ORC-350, docs/design/character-builder.md "Choices"): the choice rows in
// groups by level, a head that opens and closes its row, the rows that are open when the step opens, the subclass
// dialog, the row "Ability Score Improvement or Feat" and its line to another step, and a class with no choice.
import "fake-indexeddb/auto";
import { answerConfirmDialog } from "@orc-alchemy/ui/testing";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { IMPROVEMENT_OPTION } from "../engine/class-choices.ts";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { addFirstClass, newCharacter } from "../engine/new-character.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";
import { resetBuilder } from "./test-builder.tsx";
import { pickIn, picksIn, rowHead, section } from "./test-pick.ts";

beforeAll(() => loadEngine());
afterEach(resetBuilder);

/** A new character with the class at the level and these picks, open in the builder on the Class step. */
function open(classKey: string, level: number, picks: [path: string[], key: string][] = []) {
  const e = engine();
  let entity = addFirstClass(e, newCharacter(e), classKey);
  for (let n = 1; n < level; n++) entity = e.addLevel(entity, classKey) as StrictEntity;
  entity = picks.reduce((next, [path, key]) => e.select(next, path, key) as StrictEntity, entity);
  act(() => useCharacter.getState().load("class-choices", entity));
  render(<Builder step="Class" />);
}

const FIGHTING_STYLE = ["class", "fighter", "fighting-style"];
const ARCHETYPE = ["class", "fighter", "levels", "level-3", "martial-archetype"];
const IMPROVEMENT = ["class", "fighter", "levels", "level-4", "asi-or-feat"];

const choices = () => screen.getByRole("region", { name: "Choices" });
const row = (name: string) => section(name);
const expanded = (name: string) => rowHead(row(name)).getAttribute("aria-expanded");
const stepTitle = () => within(screen.getByRole("region", { name: "Builder" })).getByRole("heading", { level: 2 }).textContent;

test("a Fighter 4 has a row for each choice, in groups by level; the rows with picks left are open", () => {
  open("fighter", 4);
  const groups = within(choices()).getAllByRole("group", { name: /^Level \d+$/ });
  expect(groups.map((group) => group.getAttribute("aria-labelledby") && document.getElementById(group.getAttribute("aria-labelledby")!)?.textContent)).toEqual([
    "Level 1",
    "Level 3",
    "Level 4",
  ]);
  // A head is an h5 with the name and the left mark; it is a button with aria-expanded.
  const heads = within(choices()).getAllByRole("heading", { level: 5 });
  expect(heads.map((head) => head.textContent)).toEqual(["Fighting Style,1 left▴", "Martial Archetype,1 left▴", "Ability Score Improvement or Feat,1 left▴"]);
  expect(["Fighting Style", "Martial Archetype", "Ability Score Improvement or Feat"].map(expanded)).toEqual(["true", "true", "true"]);
  // The control rule: Fighting Style has 6 options, so cards; the subclass has a Choose button; the improvement two cards.
  expect(within(row("Fighting Style")).getAllByRole("button", { pressed: false })).toHaveLength(6);
  expect(within(row("Martial Archetype")).getByRole("button", { name: "Choose Martial Archetype" })).toBeTruthy();
  expect(
    within(row("Ability Score Improvement or Feat"))
      .getAllByRole("button", { pressed: false })
      .map((b) => b.textContent),
  ).toEqual(["Ability Score Improvement", "Feat"]);
  // The hit points of each level stay in the block, after Choices, until ORC-351.
  expect(screen.getByRole("region", { name: /^Hit Points: Fighter 4/ })).toBeTruthy();
  expect(within(choices()).queryByRole("region", { name: /^Hit Points/ })).toBeNull();
});

test("a row stays open after a pick and shows the pick; a click on the head closes and opens it, and keeps the focus", async () => {
  open("fighter", 1);
  await pickIn(row("Fighting Style"), "Defense");
  await waitFor(() => expect(rowHead(row("Fighting Style")).textContent).toBe("Fighting Style,Defense▴"));
  expect(expanded("Fighting Style")).toBe("true");
  expect(picksIn(row("Fighting Style"))).toEqual(["Defense"]);
  const head = rowHead(row("Fighting Style"));
  head.focus();
  fireEvent.click(head);
  expect(expanded("Fighting Style")).toBe("false");
  expect(within(row("Fighting Style")).queryByRole("button", { name: "Archery" })).toBeNull();
  expect(document.activeElement).toBe(rowHead(row("Fighting Style")));
  fireEvent.click(rowHead(row("Fighting Style")));
  expect(expanded("Fighting Style")).toBe("true");
  expect(document.activeElement).toBe(rowHead(row("Fighting Style")));
});

test("a row with its picks made is closed when the step opens", () => {
  open("fighter", 3, [
    [FIGHTING_STYLE, "defense"],
    [ARCHETYPE, "champion"],
  ]);
  expect(expanded("Fighting Style")).toBe("false");
  expect(expanded("Martial Archetype")).toBe("false");
  expect(rowHead(row("Martial Archetype")).textContent).toBe("Martial Archetype,Champion▾");
});

test("the subclass dialog: the names, the detail of the selected subclass, and Choose; the focus goes back to the row", async () => {
  open("fighter", 3, [[FIGHTING_STYLE, "defense"]]);
  const choose = within(row("Martial Archetype")).getByRole("button", { name: "Choose Martial Archetype" });
  fireEvent.click(choose);
  const dialog = await screen.findByRole("dialog", { name: "Martial Archetype" });
  // The list shows the subclasses with no "Custom"; the first one shows in the panel at the open.
  const list = dialog.querySelector<HTMLElement>(".ui-list-panel")!;
  expect(within(list).getAllByRole("button", { name: "Champion" })).toHaveLength(1);
  expect(within(list).queryByRole("button", { name: "Custom" })).toBeNull();
  expect(within(dialog).getByText("A fighter who trains the body to deadly perfection.")).toBeTruthy();
  // The features table of the subclass builds trial characters: under load it takes some seconds.
  const table = await within(dialog).findByRole("table", undefined, { timeout: 20_000 });
  expect(within(table).getAllByRole("row")[1].textContent).toBe("7Remarkable Athlete");
  fireEvent.click(within(dialog).getByRole("button", { name: "Choose Champion" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(picksIn(row("Martial Archetype"))).toEqual(["Champion"]));
  // The row stays open, its button is Change now, and it has the focus.
  expect(expanded("Martial Archetype")).toBe("true");
  await waitFor(() => expect(document.activeElement).toBe(within(row("Martial Archetype")).getByRole("button", { name: "Change Martial Archetype" })));
}, 30_000);

test("the rows that a subclass pick opens are after it, at its level", () => {
  open("sorcerer", 1, [
    [["class", "sorcerer", "levels", "level-1", "sorcerous-origin"], "draconic-bloodline"],
    [["class", "sorcerer", "levels", "level-1", "sorcerous-origin", "draconic-bloodline", "draconic-ancestry-type"], "red"],
  ]);
  const level1 = within(choices()).getByRole("group", { name: "Level 1" });
  expect(
    within(level1)
      .getAllByRole("heading", { level: 5 })
      .map((head) => head.textContent),
  ).toEqual(["Sorcerous Origin,Draconic Bloodline▾", "Draconic Ancestry Type,Red▾"]);
});

test("the improvement or feat: the two cards, then a line to the Abilities step or the Feats step with the mark", async () => {
  open("fighter", 4);
  const improvement = () => row("Ability Score Improvement or Feat");
  // Before the pick, the place of the line is there, empty.
  expect(improvement().querySelector("[data-improvement-line]")?.textContent).toBe("");
  await pickIn(improvement(), "Ability Score Improvement");
  const line = await within(improvement()).findByRole("button", { name: /^Place 2 points on the Abilities step/ });
  expect(line.textContent).toBe("Place 2 points on the Abilities step,2 left");
  expect(expanded("Ability Score Improvement or Feat")).toBe("true");
  fireEvent.click(line);
  await waitFor(() => expect(stepTitle()).toBe("Abilities"));
});

test("a pick of the feat shows the line to the Feats step; a change back asks nothing while no point or feat is picked", async () => {
  open("fighter", 4, [[IMPROVEMENT, IMPROVEMENT_OPTION]]);
  // The row has its pick: it is closed at the start. Its head opens it.
  expect(expanded("Ability Score Improvement or Feat")).toBe("false");
  await pickIn(row("Ability Score Improvement or Feat"), "Feat");
  const line = await within(row("Ability Score Improvement or Feat")).findByRole("button", { name: /^Pick the feat on the Feats step/ });
  expect(line.textContent).toBe("Pick the feat on the Feats step,1 left");
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("a change from the improvement with points placed to a feat asks first", async () => {
  const e = engine();
  let entity = addFirstClass(e, newCharacter(e), "fighter");
  for (let n = 1; n < 4; n++) entity = e.addLevel(entity, "fighter") as StrictEntity;
  entity = e.select(entity, IMPROVEMENT, IMPROVEMENT_OPTION) as StrictEntity;
  entity = e.increaseAbility(entity, [...IMPROVEMENT, IMPROVEMENT_OPTION, "asi"], "orcpub.dnd.e5.character/str") as StrictEntity;
  act(() => useCharacter.getState().load("class-choices", entity));
  render(<Builder step="Class" />);
  const improvement = row("Ability Score Improvement or Feat");
  await pickIn(improvement, "Feat");
  expect(await answerConfirmDialog("Cancel")).toBe("Replace Ability Score Improvement with Feat?");
  expect(picksIn(row("Ability Score Improvement or Feat"))).toEqual(["Ability Score Improvement"]);
});

test("a class with no choice shows one row: No choice at this level.", () => {
  open("druid", 1);
  expect(within(choices()).getByText("No choice at this level.")).toBeTruthy();
  expect(within(choices()).queryAllByRole("heading", { level: 5 })).toEqual([]);
});

test("a choice of 7 options or more and two picks has the picker: a Sorcerer's Metamagic", async () => {
  open("sorcerer", 3);
  const metamagic = row("Metamagic");
  expect(expanded("Metamagic")).toBe("true");
  expect(within(metamagic).getByRole("button", { name: "Add a choice" })).toBeTruthy();
  await pickIn(metamagic, "Careful Spell");
  await waitFor(() => expect(picksIn(row("Metamagic"))).toEqual(["Careful Spell"]));
  expect(rowHead(row("Metamagic")).textContent).toBe("Metamagic,1 left▴");
});

test("the rail counts the improvement on the Class step, and its points on the Abilities step", async () => {
  open("fighter", 4, [
    [FIGHTING_STYLE, "defense"],
    [ARCHETYPE, "champion"],
    [IMPROVEMENT, IMPROVEMENT_OPTION],
  ]);
  const rail = screen.getByRole("navigation", { name: "Steps" });
  // The hit points of levels 2 to 4 are left on the Class step; the 2 points of the improvement are on Abilities.
  expect(within(rail).getByRole("button", { name: "Class, 3 picks left" })).toBeTruthy();
  expect(within(rail).getByRole("button", { name: "Abilities, 2 picks left" })).toBeTruthy();
});
