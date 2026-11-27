// The Class step (ORC-349, docs/design/character-builder.md "The class cards" and "The class block"): the cards and the
// modal of a class, the pick of the first class, the class block with its level control, About and Change, and the
// question of ORC-344 before a change of class or a lower level removes picks.
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { answerConfirmDialog } from "@orc-alchemy/ui/testing";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { storedHitPoints } from "../engine/classes.ts";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { addFirstClass, newCharacter } from "../engine/new-character.ts";
import { CLASS_PACK, runeKnightOrcbrew } from "../engine/test-classes.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { Builder } from "./Builder.tsx";
import { resetBuilder } from "./test-builder.tsx";
import {
  addClass,
  changeClass,
  chooseFirstClass,
  classCard,
  hitPointsOf,
  hitPointsTotal,
  levelHitPoints,
  removeClass,
  section,
  setHitPointsMethod,
} from "./test-pick.ts";

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const fixture = (name: string): StrictEntity => JSON.parse(readFileSync(join(charactersDir, `${name}.strict.json`), "utf8"));

beforeAll(() => loadEngine());
afterEach(async () => {
  vi.restoreAllMocks();
  await resetBuilder();
});

/** Opens the entity in the builder, on the Class step. */
function open(entity: StrictEntity) {
  act(() => useCharacter.getState().load("class-step", entity));
  render(<Builder step="Class" />);
}

/** A fighter 3 with the fighting style Defense and the subclass Champion. */
function fighter3(): StrictEntity {
  const e = engine();
  let entity = addFirstClass(e, newCharacter(e), "fighter");
  entity = e.select(entity, ["class", "fighter", "fighting-style"], "defense");
  entity = e.addLevel(e.addLevel(entity, "fighter"), "fighter");
  return e.select(entity, ["class", "fighter", "levels", "level-3", "martial-archetype"], "champion");
}

const built = () => engine().evaluate(useCharacter.getState().entity!, useHomebrew.getState().content).built;
const levels = () => Object.fromEntries(built().classes.map((key) => [key, built().levels[key]["class-level"]]));
const block = (name: string) => screen.getByRole("region", { name });
const levelField = (name: string) => screen.getByRole<HTMLInputElement>("textbox", { name: `${name} level` });
const status = () => document.querySelector("[data-toast-status]")?.textContent ?? "";

/** The rows of the open question: each place, and its lines. */
const questionRows = (dialog: HTMLElement) =>
  [...dialog.querySelectorAll("dl > div")].map((group) => [
    group.querySelector("dt")?.textContent,
    ...[...group.querySelectorAll("dd")].map((line) => line.textContent),
  ]);

/** Types a level in the field of the class, and presses Enter. */
function typeLevel(name: string, level: string) {
  const field = levelField(name);
  field.focus();
  fireEvent.change(field, { target: { value: level } });
  fireEvent.keyDown(field, { key: "Enter" });
}

test("a new character picks its first class: a card opens the modal, and Choose picks the class", async () => {
  open(newCharacter(engine()));
  const classes = section("Class");
  expect(within(classes).getAllByRole("heading")[0].textContent).toBe("Class,1 left");
  const cards = [...classes.querySelectorAll("[data-class-card]")];
  expect(cards.map((card) => card.textContent)).toEqual([
    "Barbarian",
    "Bard",
    "Cleric",
    "Druid",
    "Fighter",
    "Monk",
    "Paladin",
    "Ranger",
    "Rogue",
    "Sorcerer",
    "Warlock",
    "Wizard",
  ]);
  // Each SRD class has its icon (theme.md, "Class icons").
  expect(cards.map((card) => card.querySelector("svg")?.dataset.icon)).toEqual([
    "anger",
    "note",
    "sun",
    "leaf",
    "helmet",
    "figure",
    "shield",
    "arrow",
    "dagger",
    "spiral",
    "chain",
    "book",
  ]);

  // A click opens the modal and does not pick the class. The modal has the facts and the features table.
  const card = classCard(classes, "Fighter");
  card.focus();
  fireEvent.click(card);
  const modal = await screen.findByRole("dialog", { name: "Fighter" });
  expect(within(modal).getByText("A master of weapons and armor.")).toBeTruthy();
  const facts = [...modal.querySelectorAll("dt")].map((dt) => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`);
  expect(facts).toEqual([
    "Hit die: d10",
    "Saving throws: Strength, Constitution",
    "Armor, weapons: All armor, shields; simple and martial weapons",
    "Skills: Two of Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Perception, Survival",
    "Subclass: Martial Archetype, at level 3",
  ]);
  // The table builds a trial character at each level, in parts between the frames: under load it takes some seconds.
  const features = await within(modal).findByRole("table", undefined, { timeout: 15_000 });
  expect(
    within(features)
      .getAllByRole("columnheader")
      .map((th) => th.textContent),
  ).toEqual(["Level", "Features"]);
  expect(within(features).getAllByRole("row")[1].textContent).toBe("1Fighting Style, Second Wind");
  expect(built().classes).toEqual([]);
  // The detail scrolls, and "Choose Fighter" is in the footer row below it, so it stays in view (ORC-367).
  const choose = within(modal).getByRole("button", { name: "Choose Fighter" });
  expect(modal.querySelector(".ui-modal-body")!.contains(choose)).toBe(false);
  expect(modal.querySelector(".ui-modal-foot")!.contains(choose)).toBe(true);

  // Escape closes the modal, and the focus goes back to its card.
  fireEvent.keyDown(modal, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(classCard(section("Class"), "Fighter")));

  // "Choose Fighter" picks the class: its block takes the place of the cards, and its Change button has the focus.
  await chooseFirstClass("Fighter");
  await waitFor(() => expect(levels()).toEqual({ fighter: 1 }));
  expect(within(block("Fighter")).getByRole("heading", { level: 3 }).textContent).toBe("Fighter");
  expect(section("Class").querySelector("[data-class-card]")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Change Fighter" })));
  // The class equipment comes with the first class, and the body has the choices of today.
  expect(within(block("Fighter")).getByRole("region", { name: /^Fighting Style/ })).toBeTruthy();
});

test("About opens the modal of the class with no Choose button; a pack class card has no icon", async () => {
  await useHomebrew.getState().load(`${CLASS_PACK}.orcbrew`, runeKnightOrcbrew());
  open(addFirstClass(engine(), newCharacter(engine()), "fighter", useHomebrew.getState().content));
  fireEvent.click(screen.getByRole("button", { name: "About Fighter" }));
  const modal = await screen.findByRole("dialog", { name: "Fighter" });
  expect(within(modal).queryByRole("button", { name: /^Choose/ })).toBeNull();
  fireEvent.keyDown(modal, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  fireEvent.click(screen.getByRole("button", { name: "Change Fighter" }));
  const dialog = await screen.findByRole("dialog", { name: "Change Fighter" });
  // The cards of Change do not show the class of the block.
  expect(within(dialog).queryAllByRole("button", { name: "Fighter" })).toEqual([]);
  const pack = classCard(dialog, "Rune Knight (Class Pack)");
  expect(pack.querySelector("svg")).toBeNull();
  fireEvent.click(pack);
  const packModal = await screen.findByRole("dialog", { name: "Rune Knight (Class Pack)" });
  expect(within(packModal).getByText("A warrior of runes.")).toBeTruthy();
  expect(within(packModal).getByText(`From ${CLASS_PACK}`)).toBeTruthy();
  expect(within(packModal).getByRole("button", { name: "Change to Rune Knight (Class Pack)" })).toBeTruthy();
});

test("a change of class with picks asks first: Cancel keeps the class, and Replace makes the change", async () => {
  open(fighter3());
  await changeClass("Fighter", "Wizard");
  const question = await screen.findByRole("alertdialog", { name: "Replace Fighter with Wizard?" });
  expect(questionRows(question)).toEqual([
    ["Class", "Fighting Style: Defense"],
    ["Level 3", "Martial Archetype: Champion"],
  ]);
  await answerConfirmDialog("Cancel");
  expect(levels()).toEqual({ fighter: 3 });
  // After Cancel, the focus goes to the Change button of the block.
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Change Fighter" })));

  await changeClass("Fighter", "Wizard");
  expect(await answerConfirmDialog("Replace")).toBe("Replace Fighter with Wizard?");
  await waitFor(() => expect(levels()).toEqual({ wizard: 1 }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Change Wizard" })));
});

test("a change of class with no pick asks nothing", async () => {
  open(addFirstClass(engine(), newCharacter(engine()), "fighter"));
  await changeClass("Fighter", "Rogue");
  await waitFor(() => expect(levels()).toEqual({ rogue: 1 }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
});

test("a lower level with picks asks first; the field and the buttons set the level", async () => {
  open(fighter3());
  expect(levelField("Fighter").value).toBe("3");
  // A lower level that removes the Champion asks: Cancel keeps the level and the field shows it again.
  typeLevel("Fighter", "2");
  const question = await screen.findByRole("alertdialog", { name: "Lower Fighter to level 2?" });
  expect(questionRows(question)).toEqual([["Level 3", "Martial Archetype: Champion"]]);
  await answerConfirmDialog("Cancel");
  expect(levels()).toEqual({ fighter: 3 });
  expect(levelField("Fighter").value).toBe("3");
  // The focus goes back to the field that asked.
  await waitFor(() => expect(document.activeElement).toBe(levelField("Fighter")));

  // The minus button asks the same question; Remove lowers the level.
  fireEvent.click(screen.getByRole("button", { name: "Remove a Fighter level" }));
  expect(await answerConfirmDialog("Remove")).toBe("Lower Fighter to level 2?");
  await waitFor(() => expect(levels()).toEqual({ fighter: 2 }));
  // A lower level with no pick to remove asks nothing.
  fireEvent.click(screen.getByRole("button", { name: "Remove a Fighter level" }));
  await waitFor(() => expect(levels()).toEqual({ fighter: 1 }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  expect(screen.getByRole("button", { name: "Remove a Fighter level" }).hasAttribute("disabled")).toBe(true);

  // The plus button and a typed level raise it.
  fireEvent.click(screen.getByRole("button", { name: "Add a Fighter level" }));
  await waitFor(() => expect(levels()).toEqual({ fighter: 2 }));
  typeLevel("Fighter", "5");
  await waitFor(() => expect(levels()).toEqual({ fighter: 5 }));
});

test("the level field takes 1 to 20: another number shows in the status toast and changes nothing", async () => {
  open(addFirstClass(engine(), newCharacter(engine()), "fighter"));
  for (const typed of ["0", "21"]) {
    typeLevel("Fighter", typed);
    await waitFor(() => expect(status()).toBe("A class level is from 1 to 20."));
    // A refusal is an error: the toast shows it on the danger red (ORC-372).
    expect(document.querySelector<HTMLElement>("[data-toast-status]")?.dataset.tone).toBe("error");
    expect(levels()).toEqual({ fighter: 1 });
    expect(levelField("Fighter").value).toBe("1");
  }
  typeLevel("Fighter", "20");
  await waitFor(() => expect(levels()).toEqual({ fighter: 20 }));
  expect(screen.getByRole("button", { name: "Add a Fighter level" }).hasAttribute("disabled")).toBe(true);
});

test("a character with two classes has a block for each, and Remove of the first class asks first", async () => {
  open(fixture("fighter-3-wizard-2"));
  for (const name of ["Fighter", "Wizard"]) {
    const each = within(block(name));
    expect(each.getByRole("textbox", { name: `${name} level` })).toBeTruthy();
    for (const button of [`Remove a ${name} level`, `Add a ${name} level`, `About ${name}`, `Change ${name}`])
      expect(each.getByRole("button", { name: button })).toBeTruthy();
  }
  expect(levelField("Fighter").value).toBe("3");
  expect(levelField("Wizard").value).toBe("2");
  // The body of each block has Choices, Hit points and Also choose.
  for (const name of ["Choices", "Hit points", "Also choose"])
    expect(within(block("Wizard")).getByRole("region", { name: new RegExp(`^${name}`) })).toBeTruthy();

  // Removing the first class removes the picks of the fighter, and the engine returns the wizard to level 1.
  removeClass("Fighter");
  expect(await answerConfirmDialog("Cancel")).toBe("Remove Fighter?");
  expect(levels()).toEqual({ fighter: 3, wizard: 2 });
  removeClass("Fighter");
  await answerConfirmDialog("Remove");
  await waitFor(() => expect(levels()).toEqual({ wizard: 1 }));
  // With one class, there is no Remove button.
  expect(screen.queryByRole("button", { name: "Remove Wizard" })).toBeNull();
});

test("Up and Down in the level field set the level from the level of the class, also after a typed level", async () => {
  open(addFirstClass(engine(), newCharacter(engine()), "fighter"));
  const field = levelField("Fighter");
  field.focus();
  fireEvent.keyDown(field, { key: "ArrowUp" });
  await waitFor(() => expect(levels()).toEqual({ fighter: 2 }));
  // A typed level that did not count yet does not count after an arrow: the level is 3, and the loss of the focus keeps it.
  fireEvent.change(levelField("Fighter"), { target: { value: "5" } });
  fireEvent.keyDown(levelField("Fighter"), { key: "ArrowUp" });
  await waitFor(() => expect(levels()).toEqual({ fighter: 3 }));
  await waitFor(() => expect(levelField("Fighter").value).toBe("3"));
  expect(document.activeElement).toBe(levelField("Fighter"));
  fireEvent.blur(levelField("Fighter"));
  await waitFor(() => expect(levelField("Fighter").value).toBe("3"));
  expect(levels()).toEqual({ fighter: 3 });
  fireEvent.keyDown(levelField("Fighter"), { key: "ArrowDown" });
  await waitFor(() => expect(levels()).toEqual({ fighter: 2 }));
});

test("after the minus button lowers a class to level 1, the focus goes to the level field", async () => {
  const e = engine();
  open(e.addLevel(addFirstClass(e, newCharacter(e), "fighter"), "fighter") as StrictEntity);
  const minus = screen.getByRole("button", { name: "Remove a Fighter level" });
  minus.focus();
  fireEvent.click(minus);
  await waitFor(() => expect(levels()).toEqual({ fighter: 1 }));
  await waitFor(() => expect(document.activeElement).toBe(levelField("Fighter")));
});

test("after Remove of a class, the focus goes to the Change button of the block that stays; after Cancel, back to Remove", async () => {
  open(fixture("fighter-3-wizard-2"));
  const remove = screen.getByRole("button", { name: "Remove Fighter" });
  remove.focus();
  fireEvent.click(remove);
  await answerConfirmDialog("Cancel");
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remove Fighter" })));
  removeClass("Fighter");
  await answerConfirmDialog("Remove");
  await waitFor(() => expect(levels()).toEqual({ wizard: 1 }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Change Wizard" })));
  // The wizard is now the first class: its level 1 has the maximum of the die, as on the sheet.
  await waitFor(() => expect(hitPointsTotal("Wizard")).toBe(built()["max-hit-points"]));
});

// ORC-351: the section Hit points, "Also choose", "Add a class", Remove and the button that closes a block.

const WIZARD_2 = ["class", "wizard", "levels", "level-2", "hit-points"];
const stored = (path: string[]) => storedHitPoints(useCharacter.getState().entity!, path);

test("Hit points, Average: the toggle, the hit die and the total of each class, which add up to the sheet", () => {
  open(fixture("fighter-3-wizard-2"));
  const wizard = within(hitPointsOf("Wizard"));
  expect(wizard.getByRole("button", { name: "Average" }).getAttribute("aria-pressed")).toBe("true");
  expect(wizard.getByText("Hit die d6, and +2 from Constitution at each level")).toBeTruthy();
  expect([hitPointsTotal("Fighter"), hitPointsTotal("Wizard")]).toEqual([28, 12]);
  expect(hitPointsTotal("Fighter") + hitPointsTotal("Wizard")).toBe(built()["max-hit-points"]);
  // Average has no number fields.
  expect(screen.queryByRole("textbox", { name: /hit points$/ })).toBeNull();
});

test("Hit points, By level: a field for each level, a roll, Roll all and a typed number; level 1 of the first class is fixed", async () => {
  open(fixture("fighter-3-wizard-2"));
  setHitPointsMethod("Fighter", "By level");
  await waitFor(() => expect(levelHitPoints("Fighter", 1).value).toBe("10"));
  // Level 1 of the first class is the maximum of the die, and it cannot change. It has no roll button.
  expect(levelHitPoints("Fighter", 1).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: "Roll Fighter level 1" })).toBeNull();
  expect(levelHitPoints("Fighter", 2).value).toBe("6");

  setHitPointsMethod("Wizard", "By level");
  await waitFor(() => expect(stored(WIZARD_2)).toEqual({ method: "manual-entry", value: 4 }));
  expect(levelHitPoints("Wizard", 1).disabled).toBe(false);
  // A roll of a d6 with 0.5 is 4, and with 0.99 it is 6.
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  fireEvent.click(screen.getByRole("button", { name: "Roll Wizard level 2" }));
  await waitFor(() => expect(stored(WIZARD_2)).toEqual({ method: "roll", value: 6 }));
  expect(levelHitPoints("Wizard", 2).value).toBe("6");
  // A typed number from 1 to the die counts; another number does not.
  fireEvent.change(levelHitPoints("Wizard", 2), { target: { value: "9" } });
  expect(stored(WIZARD_2)).toEqual({ method: "roll", value: 6 });
  fireEvent.change(levelHitPoints("Wizard", 2), { target: { value: "3" } });
  await waitFor(() => expect(stored(WIZARD_2)).toEqual({ method: "manual-entry", value: 3 }));
  fireEvent.blur(levelHitPoints("Wizard", 2));
  vi.spyOn(Math, "random").mockReturnValue(0);
  fireEvent.click(within(hitPointsOf("Wizard")).getByRole("button", { name: "Roll all" }));
  await waitFor(() => expect([levelHitPoints("Wizard", 1).value, levelHitPoints("Wizard", 2).value]).toEqual(["1", "1"]));
  // 1 + 1 + 2 × 2 from Constitution; the totals still add up to the sheet.
  expect(hitPointsTotal("Wizard")).toBe(6);
  expect(hitPointsTotal("Fighter") + hitPointsTotal("Wizard")).toBe(built()["max-hit-points"]);

  // Average writes the averages again, and the fields go.
  setHitPointsMethod("Wizard", "Average");
  await waitFor(() => expect(stored(WIZARD_2)).toEqual({ method: "average", value: 4 }));
  expect(screen.queryByRole("textbox", { name: "Wizard level 2 hit points" })).toBeNull();
});

test("a change to Average and back to By level puts back the rolled and typed numbers; a new level since then has the average", async () => {
  const e = engine();
  open(e.addLevel(e.addLevel(addFirstClass(e, newCharacter(e), "fighter"), "fighter"), "fighter") as StrictEntity);
  const level = (n: number) => ["class", "fighter", "levels", `level-${n}`, "hit-points"];
  // A roll at level 2 and a typed number at level 3.
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  fireEvent.click(screen.getByRole("button", { name: "Roll Fighter level 2" }));
  await waitFor(() => expect(stored(level(2))).toEqual({ method: "roll", value: 10 }));
  fireEvent.change(levelHitPoints("Fighter", 3), { target: { value: "3" } });
  await waitFor(() => expect(stored(level(3))).toEqual({ method: "manual-entry", value: 3 }));
  fireEvent.blur(levelHitPoints("Fighter", 3));

  setHitPointsMethod("Fighter", "Average");
  await waitFor(() => expect(stored(level(2))).toEqual({ method: "average", value: 6 }));
  // A new level with the method Average gets the average.
  fireEvent.click(screen.getByRole("button", { name: "Add a Fighter level" }));
  await waitFor(() => expect(stored(level(4))).toEqual({ method: "average", value: 6 }));

  setHitPointsMethod("Fighter", "By level");
  await waitFor(() => expect([2, 3, 4].map((n) => levelHitPoints("Fighter", n).value)).toEqual(["10", "3", "6"]));
  expect([2, 3, 4].map((n) => stored(level(n)))).toEqual([
    { method: "roll", value: 10 },
    { method: "manual-entry", value: 3 },
    { method: "manual-entry", value: 6 },
  ]);
});

test("a level change that makes the character level more than 20 is refused; the plus button is disabled at character level 20", async () => {
  const e = engine();
  let entity = fixture("fighter-3-wizard-2");
  for (let n = 3; n < 18; n++) entity = e.addLevel(entity, "fighter") as StrictEntity;
  open(entity);
  expect(levels()).toEqual({ fighter: 18, wizard: 2 });
  // Fighter 18 and Wizard 2 are character level 20: no plus button adds a level.
  for (const name of ["Fighter", "Wizard"]) expect(screen.getByRole("button", { name: `Add a ${name} level` }).hasAttribute("disabled")).toBe(true);
  // The Up key and a typed level show the reason in the status toast and change nothing. The engine takes Fighter 19.
  expect(status()).toBe("");
  levelField("Fighter").focus();
  fireEvent.keyDown(levelField("Fighter"), { key: "ArrowUp" });
  await waitFor(() => expect(status()).toBe("A character has 20 levels at most."));
  expect(levels()).toEqual({ fighter: 18, wizard: 2 });
  typeLevel("Wizard", "3");
  expect(levels()).toEqual({ fighter: 18, wizard: 2 });
  await waitFor(() => expect(levelField("Wizard").value).toBe("2"));
  // A lower level gives the plus buttons back.
  fireEvent.click(screen.getByRole("button", { name: "Remove a Wizard level" }));
  await answerConfirmDialog("Remove");
  await waitFor(() => expect(levels()).toEqual({ fighter: 18, wizard: 1 }));
  for (const name of ["Fighter", "Wizard"]) expect(screen.getByRole("button", { name: `Add a ${name} level` }).hasAttribute("disabled")).toBe(false);
});

test("a new level gets the average with the method Average, and an empty field, left, with By level", async () => {
  const e = engine();
  open(e.addLevel(addFirstClass(e, newCharacter(e), "fighter"), "fighter") as StrictEntity);
  const FIGHTER_2 = ["class", "fighter", "levels", "level-2", "hit-points"];
  // A level that the engine gave no hit points: the class is By level, and its field is empty, with the mark.
  expect(levelHitPoints("Fighter", 2).value).toBe("");
  expect(within(hitPointsOf("Fighter")).getByText("1 left")).toBeTruthy();
  setHitPointsMethod("Fighter", "Average");
  await waitFor(() => expect(stored(FIGHTER_2)).toEqual({ method: "average", value: 6 }));
  fireEvent.click(screen.getByRole("button", { name: "Add a Fighter level" }));
  await waitFor(() => expect(stored(["class", "fighter", "levels", "level-3", "hit-points"])).toEqual({ method: "average", value: 6 }));
  setHitPointsMethod("Fighter", "By level");
  await waitFor(() => expect(levelHitPoints("Fighter", 3).value).toBe("6"));
  fireEvent.click(screen.getByRole("button", { name: "Add a Fighter level" }));
  await waitFor(() => expect(levelHitPoints("Fighter", 4).value).toBe(""));
  expect(stored(["class", "fighter", "levels", "level-4", "hit-points"])).toBeNull();
});

test("Also choose: a line for each kind that the class gives, with the picks or the mark, opens its step", async () => {
  open(fixture("fighter-3-wizard-2"));
  const lines = (name: string) =>
    within(within(block(name)).getByRole("list", { name: "Also choose" }))
      .getAllByRole("button")
      .map((line) => line.getAttribute("aria-label"));
  expect(lines("Fighter")).toEqual([
    "Skills, Athletics, Perception, Proficiencies",
    "Starting equipment, Chain Mail, Martial Weapon and Shield, Longsword, Two Handaxes, Dungeoneer's Pack, Equipment",
  ]);
  expect(lines("Wizard")[0]).toBe("Cantrip, Acid Splash, Chill Touch, Dancing Lights, Spells");
  fireEvent.click(within(block("Wizard")).getByRole("button", { name: /^Spells, / }));
  await waitFor(() => expect(within(screen.getByRole("region", { name: "Builder" })).getByRole("heading", { level: 2 }).textContent).toBe("Spells"));
});

test("Add a class: the cards of the other classes, a class that the character cannot take dimmed with its need, and Add", async () => {
  open(fixture("fighter-3-wizard-2"));
  fireEvent.click(screen.getByRole("button", { name: "Add a class" }));
  const dialog = await screen.findByRole("dialog", { name: "Add a class" });
  // The cards do not show a class of the character.
  expect(within(dialog).queryAllByRole("button", { name: "Fighter" })).toEqual([]);
  const monk = classCard(dialog, "Monk");
  expect(monk.hasAttribute("data-unavailable")).toBe(true);
  expect(monk.textContent).toContain("Needs Wis 13 and Dex 13");
  expect(classCard(dialog, "Rogue").hasAttribute("data-unavailable")).toBe(false);
  // The modal of a class that the character cannot take has the reason beside a disabled Add.
  fireEvent.click(monk);
  const modal = await screen.findByRole("dialog", { name: "Monk" });
  expect(within(modal).getByText("Not available. It needs Wis 13 and Dex 13.")).toBeTruthy();
  expect(within(modal).getByRole("button", { name: "Add Monk" }).hasAttribute("disabled")).toBe(true);
  fireEvent.keyDown(modal, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Monk" })).toBeNull());
  fireEvent.keyDown(dialog, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  // Add Rogue adds the class at level 1 with the average hit points, and the focus goes to its Change button.
  await addClass("Rogue");
  await waitFor(() => expect(levels()).toEqual({ fighter: 3, wizard: 2, rogue: 1 }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Change Rogue" })));
  expect(stored(["class", "rogue", "levels", "level-1", "hit-points"])).toEqual({ method: "average", value: 5 });
});

test("Add a class is disabled at character level 20", async () => {
  const e = engine();
  let entity = addFirstClass(e, newCharacter(e), "fighter");
  for (let n = 1; n < 20; n++) entity = e.addLevel(entity, "fighter") as StrictEntity;
  open(entity);
  expect(screen.getByRole("button", { name: "Add a class" }).hasAttribute("disabled")).toBe(true);
});

test("with two classes, a block closes and opens; a closed block shows its left mark", async () => {
  const e = engine();
  open(e.addClass(addFirstClass(e, newCharacter(e), "fighter"), "rogue") as StrictEntity);
  const close = screen.getByRole("button", { name: "Close Rogue" });
  expect(close.getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(close);
  const open_ = screen.getByRole("button", { name: "Open Rogue" });
  expect(open_.getAttribute("aria-expanded")).toBe("false");
  expect(document.getElementById(open_.getAttribute("aria-controls")!)?.hidden).toBe(true);
  // The rogue has its hit points of level 1, its Expertise rows... left: the header shows the sum of its marks.
  const header = block("Rogue").querySelector("h3")!.parentElement!;
  expect(within(header).getByText(/^\d+ left$/)).toBeTruthy();
  fireEvent.click(open_);
  expect(screen.getByRole("button", { name: "Close Rogue" }).getAttribute("aria-expanded")).toBe("true");
  expect(within(block("Rogue").querySelector("h3")!.parentElement!).queryByText(/left$/)).toBeNull();
});
