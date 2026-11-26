// The Class step, in a browser (ORC-349, docs/design/character-builder.md "The class cards", "The class block", "No
// layout shift"): the pick of a first class from the cards and the modal, a change of class and a lower level that ask
// first (ORC-344), the level field and its buttons, the header of a block that does not move, a character with two
// classes. ORC-350 ("Choices"): the choice rows open and closed, a pick that keeps its
// row open and moves no row below, the subclass dialog, the row "Ability Score Improvement or Feat", and a class with
// no choice. ORC-351 ("Hit points", "Picked on other steps", "A second class"): Average and By level, the lines to
// other steps, Add a class, Remove, and a block that closes.
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  addClass,
  addFirstClass,
  builder,
  changeClass,
  classCard,
  hitPointsOf,
  hitPointsTotal,
  levelHitPoints,
  newCharacter,
  openStep,
  pickIn,
  picksIn,
  removeClass,
  rowHead,
  section,
  setHitPointsMethod,
  stepButton,
} from "./builder-helpers.ts";
import { summaryCard } from "./sheet-panel.ts";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

const block = (page: Page, name: string) => builder(page).getByRole("region", { name, exact: true });
const levelField = (page: Page, name: string) => builder(page).getByRole("textbox", { name: `${name} level`, exact: true });
const classLine = (page: Page) => summaryCard(page).getByLabel("Class", { exact: true });
const box = async (locator: Locator) => {
  const b = (await locator.boundingBox())!;
  return [b.x, b.y, b.width, b.height];
};

/** Imports a character file and opens it in the builder on the Class step. */
async function importOnClass(page: Page, file: string) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, file));
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await openStep(page, "Class");
}

/** A new Fighter 3 with Defense and Champion, on the Class step. */
async function fighter3(page: Page) {
  await newCharacter(page);
  await addFirstClass(page, "Fighter");
  await pickIn(section(page, "Fighting Style"), "Defense");
  await builder(page).getByRole("button", { name: "Add a Fighter level" }).click();
  await builder(page).getByRole("button", { name: "Add a Fighter level" }).click();
  await pickIn(section(page, "Martial Archetype"), "Champion");
  await expect(classLine(page)).toHaveText("Fighter 3");
}

test("a new character picks its first class from the cards and the modal", async ({ page }) => {
  await newCharacter(page);
  await openStep(page, "Class");
  const cards = builder(page).locator("[data-class-card]");
  await expect(cards).toHaveCount(12);
  // 6 in a row: the first row has 6 cards with the same top, and the cards have one size.
  const tops = await cards.evaluateAll((all) => all.map((card) => Math.round(card.getBoundingClientRect().top)));
  expect(tops.filter((top) => top === tops[0])).toHaveLength(6);
  const sizes = await cards.evaluateAll((all) =>
    all.map((card) => `${Math.round(card.getBoundingClientRect().width)}x${Math.round(card.getBoundingClientRect().height)}`),
  );
  expect(new Set(sizes).size).toBe(1);

  // A click opens the modal: the facts, the features table, and Choose. Escape gives the focus back to the card.
  await classCard(builder(page), "Fighter").click();
  const modal = page.getByRole("dialog", { name: "Fighter", exact: true });
  await expect(modal.getByRole("columnheader")).toHaveText(["Level", "Features"]);
  await expect(modal.getByRole("row").nth(1)).toHaveText("1Fighting Style, Second Wind");
  await expect(modal.getByRole("button", { name: "Choose Fighter" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(classCard(builder(page), "Fighter")).toBeFocused();
  await expect(classLine(page)).toHaveText("");

  // Choose picks the class, and the focus goes to Change of its block.
  await classCard(builder(page), "Fighter").click();
  await modal.getByRole("button", { name: "Choose Fighter" }).click();
  await expect(classLine(page)).toHaveText("Fighter 1");
  await expect(builder(page).getByRole("button", { name: "Change Fighter" })).toBeFocused();
  await expect(block(page, "Fighter").getByRole("heading", { level: 3 })).toHaveText("Fighter");
});

test("Change to a class with picks asks first, then makes the change", async ({ page }) => {
  await fighter3(page);
  await changeClass(page, "Fighter", "Rogue");
  const question = page.getByRole("alertdialog", { name: "Replace Fighter with Rogue?" });
  await expect(question).toContainText("Fighting Style: Defense");
  await expect(question).toContainText("Martial Archetype: Champion");
  await question.getByRole("button", { name: "Cancel" }).click();
  await expect(classLine(page)).toHaveText("Fighter 3");
  await expect(builder(page).getByRole("button", { name: "Change Fighter" })).toBeFocused();

  await changeClass(page, "Fighter", "Rogue");
  await question.getByRole("button", { name: "Replace" }).click();
  await expect(classLine(page)).toHaveText("Rogue 1");
  await expect(builder(page).getByRole("button", { name: "Change Rogue" })).toBeFocused();
});

test("a lower level with picks asks first; Cancel gives the focus back to the field", async ({ page }) => {
  await fighter3(page);
  const field = levelField(page, "Fighter");
  await field.fill("2");
  await field.press("Enter");
  const question = page.getByRole("alertdialog", { name: "Lower Fighter to level 2?" });
  await expect(question).toContainText("Martial Archetype: Champion");
  await question.getByRole("button", { name: "Cancel" }).click();
  await expect(classLine(page)).toHaveText("Fighter 3");
  await expect(field).toHaveValue("3");
  await expect(field).toBeFocused();

  await builder(page).getByRole("button", { name: "Remove a Fighter level" }).click();
  await question.getByRole("button", { name: "Remove" }).click();
  await expect(classLine(page)).toHaveText("Fighter 2");
  await expect(field).toHaveValue("2");
});

test("the level field takes 1 to 20, and the buttons have their names", async ({ page }) => {
  await newCharacter(page);
  await addFirstClass(page, "Wizard");
  const minus = builder(page).getByRole("button", { name: "Remove a Wizard level", exact: true });
  const plus = builder(page).getByRole("button", { name: "Add a Wizard level", exact: true });
  await expect(minus).toBeDisabled();
  await expect(plus).toBeEnabled();
  const field = levelField(page, "Wizard");
  for (const typed of ["0", "21"]) {
    await field.fill(typed);
    await field.press("Enter");
    await expect(page.locator("[data-toast-status]")).toHaveText("A class level is from 1 to 20.");
    await expect(field).toHaveValue("1");
    await expect(classLine(page)).toHaveText("Wizard 1");
  }
  await field.fill("20");
  await field.press("Tab");
  await expect(classLine(page)).toHaveText("Wizard 20");
  await expect(plus).toBeDisabled();
  await expect(minus).toBeEnabled();
});

test("a level change cannot make the character level more than 20: the plus buttons are disabled, and a typed level is refused", async ({ page }) => {
  await importOnClass(page, "fighter-3-wizard-2.strict.json");
  const fighter = levelField(page, "Fighter");
  await fighter.fill("18");
  await fighter.press("Enter");
  await expect(classLine(page)).toHaveText("Fighter 18, Wizard 2");
  for (const name of ["Fighter", "Wizard"]) await expect(builder(page).getByRole("button", { name: `Add a ${name} level`, exact: true })).toBeDisabled();
  await expect(builder(page).getByRole("button", { name: "Add a class" })).toBeDisabled();
  const wizard = levelField(page, "Wizard");
  await wizard.fill("3");
  await wizard.press("Enter");
  await expect(page.locator("[data-toast-status]")).toHaveText("A character has 20 levels at most.");
  await expect(wizard).toHaveValue("2");
  await expect(wizard).toBeFocused();
  await expect(classLine(page)).toHaveText("Fighter 18, Wizard 2");
});

test("a change of level does not move the header of the block", async ({ page }) => {
  await newCharacter(page);
  await addFirstClass(page, "Fighter");
  const header = block(page, "Fighter").locator("h3").locator("..");
  const parts = [header, levelField(page, "Fighter"), builder(page).getByRole("button", { name: "Change Fighter" })];
  const before = await Promise.all(parts.map(box));
  for (let n = 0; n < 9; n++) await builder(page).getByRole("button", { name: "Add a Fighter level" }).click();
  await expect(classLine(page)).toHaveText("Fighter 10");
  expect(await Promise.all(parts.map(box))).toEqual(before);
  // A change of class does not move it either. The fighter has no pick, so the change asks nothing.
  await changeClass(page, "Fighter", "Barbarian");
  await expect(classLine(page)).toHaveText("Barbarian 1");
  const after = [
    block(page, "Barbarian").locator("h3").locator(".."),
    levelField(page, "Barbarian"),
    builder(page).getByRole("button", { name: "Change Barbarian" }),
  ];
  expect(await Promise.all(after.map(box))).toEqual(before);
});

test("a character with two classes shows a block for each", async ({ page }) => {
  await importOnClass(page, "fighter-3-wizard-2.strict.json");
  for (const [name, level] of [
    ["Fighter", "3"],
    ["Wizard", "2"],
  ]) {
    const each = block(page, name);
    await expect(each.getByRole("heading", { level: 3 })).toHaveText(name);
    await expect(levelField(page, name)).toHaveValue(level);
    for (const button of [`Remove a ${name} level`, `Add a ${name} level`, `About ${name}`, `Change ${name}`])
      await expect(each.getByRole("button", { name: button, exact: true })).toBeVisible();
  }
  // About opens the modal with no Choose button.
  await block(page, "Wizard").getByRole("button", { name: "About Wizard" }).click();
  const modal = page.getByRole("dialog", { name: "Wizard", exact: true });
  await expect(modal.getByRole("row").nth(1)).toHaveText("1Arcane Recovery, Spellcasting");
  await expect(modal.getByRole("button", { name: /^Choose/ })).toHaveCount(0);
});

/** A new character with the class at the level, on the Class step. */
async function classAt(page: Page, name: string, level: number) {
  await newCharacter(page);
  await addFirstClass(page, name);
  for (let n = 1; n < level; n++)
    await builder(page)
      .getByRole("button", { name: `Add a ${name} level` })
      .click();
  // Under 720px the summary card does not show, so the level field tells.
  await expect(levelField(page, name)).toHaveValue(String(level));
}

const IMPROVEMENT = "Ability Score Improvement or Feat";
const expanded = (page: Page, name: string) => rowHead(section(page, name));

test("the choice rows of a Fighter 4: in groups by level, open with picks left, closed with the picks made", async ({ page }) => {
  await classAt(page, "Fighter", 4);
  const choices = builder(page).getByRole("region", { name: "Choices" });
  await expect(choices.getByRole("group", { name: /^Level \d+$/ })).toHaveCount(3);
  for (const name of ["Fighting Style", "Martial Archetype", IMPROVEMENT]) await expect(expanded(page, name)).toHaveAttribute("aria-expanded", "true");
  await expect(choices.getByRole("heading", { level: 5 })).toHaveText([
    /^Fighting Style,\s?1 left/,
    /^Martial Archetype,\s?1 left/,
    /^Ability Score Improvement or Feat,\s?1 left/,
  ]);

  // A pick keeps its row open, and the head shows it. A click on the head closes the row, and the focus stays on it.
  await pickIn(section(page, "Fighting Style"), "Defense");
  await expect(expanded(page, "Fighting Style")).toHaveAttribute("aria-expanded", "true");
  await expect(expanded(page, "Fighting Style")).toContainText("Defense");
  await expanded(page, "Fighting Style").click();
  await expect(expanded(page, "Fighting Style")).toHaveAttribute("aria-expanded", "false");
  await expect(expanded(page, "Fighting Style")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(expanded(page, "Fighting Style")).toHaveAttribute("aria-expanded", "true");

  // When the step opens again, a row with its picks made is closed, and a row with picks left is open.
  await openStep(page, "Name");
  await openStep(page, "Class");
  await expect(expanded(page, "Fighting Style")).toHaveAttribute("aria-expanded", "false");
  await expect(expanded(page, "Martial Archetype")).toHaveAttribute("aria-expanded", "true");
});

test("a pick in an open row does not move the rows below it", async ({ page }) => {
  await classAt(page, "Fighter", 4);
  const below = [
    expanded(page, "Martial Archetype"),
    expanded(page, IMPROVEMENT),
    hitPointsOf(page, "Fighter"),
    builder(page).getByRole("button", { name: "Next: Background" }),
  ];
  const before = await Promise.all(below.map(box));
  await pickIn(section(page, "Fighting Style"), "Defense");
  await expect(picksIn(section(page, "Fighting Style"))).toHaveText(["Defense"]);
  expect(await Promise.all(below.map(box))).toEqual(before);

  // The subclass and the improvement do not move the rows below them either. The line of the improvement has its place.
  await pickIn(section(page, "Martial Archetype"), "Champion");
  await expect(picksIn(section(page, "Martial Archetype"))).toHaveText(["Champion"]);
  expect(await Promise.all(below.map(box))).toEqual(before);
  await pickIn(section(page, IMPROVEMENT), "Ability Score Improvement");
  await expect(section(page, IMPROVEMENT).getByRole("button", { name: /^Place 2 points/ })).toBeVisible();
  expect(await Promise.all(below.map(box))).toEqual(before);
  await pickIn(section(page, IMPROVEMENT), "Feat");
  await expect(section(page, IMPROVEMENT).getByRole("button", { name: /^Pick the feat/ })).toBeVisible();
  expect(await Promise.all(below.map(box))).toEqual(before);
});

test("the subclass dialog has the names, the detail of the selected subclass, and Choose", async ({ page }) => {
  await classAt(page, "Fighter", 3);
  const row = section(page, "Martial Archetype");
  await row.getByRole("button", { name: "Choose Martial Archetype" }).click();
  const dialog = page.getByRole("dialog", { name: "Martial Archetype" });
  await expect(dialog.locator(".ui-list-panel").getByRole("button", { name: "Champion", exact: true })).toBeVisible();
  await expect(dialog.getByText("Raw physical power, made deadly by training.")).toBeVisible();
  await expect(dialog.getByRole("columnheader")).toHaveText(["Level", "Features"], { timeout: 15_000 });
  await expect(dialog.getByRole("row").nth(1)).toHaveText("7Remarkable Athlete");
  await dialog.getByRole("button", { name: "Choose Champion" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(picksIn(row)).toHaveText(["Champion"]);
  await expect(rowHead(row)).toContainText("Champion");
  await expect(row.getByRole("button", { name: "Change Martial Archetype" })).toBeFocused();
});

test("the improvement or feat: two cards, then a line to the Abilities step or the Feats step with the mark or the pick", async ({ page }) => {
  await classAt(page, "Fighter", 4);
  const row = section(page, IMPROVEMENT);
  await expect(row.locator("[aria-pressed]")).toHaveText(["Ability Score Improvement", "Feat"]);
  await pickIn(row, "Ability Score Improvement");
  const points = row.getByRole("button", { name: /^Place 2 points on the Abilities step/ });
  await expect(points).toContainText("2 left");
  // The rail counts the points on Abilities.
  await expect(stepButton(page, "Abilities")).toHaveAccessibleName("Abilities, 2 picks left");
  await points.click();
  await expect(builder(page).getByRole("heading", { level: 2 })).toHaveText("Abilities");
  const asi = section(page, "Ability Score Improvement: Fighter 4");
  await asi.getByRole("button", { name: "Increase Strength" }).click();
  await asi.getByRole("button", { name: "Increase Dexterity" }).click();
  // Back on the Class step, the row has its pick, so it is closed: its head opens it.
  await openStep(page, "Class");
  await expect(rowHead(section(page, IMPROVEMENT))).toHaveAttribute("aria-expanded", "false");
  await rowHead(section(page, IMPROVEMENT)).click();
  await expect(section(page, IMPROVEMENT).getByRole("button", { name: /^Place 2 points/ })).toContainText("+1 Strength, +1 Dexterity");

  // The feat asks first, because the points go; then the line goes to the Feats step.
  await section(page, IMPROVEMENT).getByRole("button", { name: "Feat", exact: true }).click();
  await page.getByRole("alertdialog", { name: "Replace Ability Score Improvement with Feat?" }).getByRole("button", { name: "Replace" }).click();
  const feat = section(page, IMPROVEMENT).getByRole("button", { name: /^Pick the feat on the Feats step/ });
  await expect(feat).toContainText("1 left");
  await feat.click();
  await expect(builder(page).getByRole("heading", { level: 2 })).toHaveText("Feats");
});

test("a class with no choice at its levels shows: No choice at this level.", async ({ page }) => {
  await classAt(page, "Druid", 1);
  await expect(builder(page).getByRole("region", { name: "Choices" })).toContainText("No choice at this level.");
});

test("at 390px, Choose in the modal of the subclass dialog gives the focus to the Change button of the row", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await classAt(page, "Fighter", 3);
  const row = section(page, "Martial Archetype");
  await row.getByRole("button", { name: "Choose Martial Archetype" }).click();
  const dialog = page.getByRole("dialog", { name: "Martial Archetype" });
  // Under 560px the list fills the dialog, and a name opens the detail in a modal over it.
  await dialog.locator(".ui-list-panel").getByRole("button", { name: "Champion", exact: true }).click();
  await page.getByRole("button", { name: "Choose Champion" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(picksIn(row)).toHaveText(["Champion"]);
  await expect(row.getByRole("button", { name: "Change Martial Archetype" })).toBeFocused();
});

/** The hit points on the summary card, or on the full sheet panel under 720px. */
const sheetHitPoints = (page: Page) => summaryCard(page).getByLabel("Hit points", { exact: true });

test("Hit points: Average, then By level with a roll, Roll all and a typed number; the totals are the sheet's", async ({ page }) => {
  await importOnClass(page, "fighter-3-wizard-2.strict.json");
  await expect(hitPointsTotal(page, "Fighter")).toHaveText("28");
  await expect(hitPointsTotal(page, "Wizard")).toHaveText("12");
  await expect(sheetHitPoints(page)).toHaveText("40");
  await expect(hitPointsOf(page, "Wizard")).toContainText("Hit die d6, and +2 from Constitution at each level");

  // By level of the fighter: level 1 of the first class is the maximum of the die, and it cannot change.
  const next = builder(page).getByRole("button", { name: "Next: Background" });
  await setHitPointsMethod(page, "Fighter", "By level");
  await expect(levelHitPoints(page, "Fighter", 1)).toHaveValue("10");
  await expect(levelHitPoints(page, "Fighter", 1)).toBeDisabled();
  await expect(builder(page).getByRole("button", { name: "Roll Fighter level 1" })).toHaveCount(0);
  await expect(levelHitPoints(page, "Fighter", 2)).toHaveValue("6");

  // A typed number and a roll change the total and the sheet, and move nothing.
  const parts = [hitPointsOf(page, "Wizard"), next, hitPointsTotal(page, "Fighter")];
  const before = await Promise.all(parts.map(box));
  await levelHitPoints(page, "Fighter", 2).fill("10");
  await levelHitPoints(page, "Fighter", 2).press("Tab");
  await expect(hitPointsTotal(page, "Fighter")).toHaveText("32");
  await expect(sheetHitPoints(page)).toHaveText("44");
  await builder(page).getByRole("button", { name: "Roll Fighter level 3" }).click();
  await hitPointsOf(page, "Fighter").getByRole("button", { name: "Roll all" }).click();
  const rolled = async () => {
    const values = await Promise.all([2, 3].map((level) => levelHitPoints(page, "Fighter", level).inputValue()));
    return 10 + values.reduce((sum, v) => sum + Number(v), 0) + 3 * 2;
  };
  await expect(async () => expect(await hitPointsTotal(page, "Fighter").textContent()).toBe(String(await rolled()))).toPass();
  await expect(async () => expect(Number(await sheetHitPoints(page).textContent())).toBe((await rolled()) + 12)).toPass();
  expect(await Promise.all(parts.map(box))).toEqual(before);

  // Average writes the averages again.
  await setHitPointsMethod(page, "Fighter", "Average");
  await expect(levelHitPoints(page, "Fighter", 2)).toHaveCount(0);
  await expect(hitPointsTotal(page, "Fighter")).toHaveText("28");
  await expect(sheetHitPoints(page)).toHaveText("40");
});

test("Picked on other steps: the lines of each class, with the picks or the mark, open their step", async ({ page }) => {
  await newCharacter(page);
  await addFirstClass(page, "Rogue");
  const lines = block(page, "Rogue").getByRole("list", { name: "Picked on other steps" }).getByRole("button");
  await expect(lines).toHaveText([/^Skills\s*4 left\s*Proficiencies$/, /^Expertise\s*\d left\s*Proficiencies$/, /^Starting equipment\s*\d left\s*Equipment$/]);
  await lines.filter({ hasText: "Expertise" }).click();
  await expect(builder(page).getByRole("heading", { level: 2 })).toHaveText("Proficiencies");
});

test("Add a class: the cards in a dialog, a class that the character cannot take dimmed with its need, and Add", async ({ page }) => {
  await importOnClass(page, "fighter-3-wizard-2.strict.json");
  await builder(page).getByRole("button", { name: "Add a class", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a class" });
  await expect(dialog.locator("[data-class-card]")).toHaveCount(10);
  const monk = classCard(dialog, "Monk");
  await expect(monk).toHaveAttribute("data-unavailable", "");
  await expect(monk).toContainText("Needs Wis 13 and Dex 13");
  await monk.click();
  const modal = page.getByRole("dialog", { name: "Monk", exact: true });
  await expect(modal.getByText("Not available. It needs Wis 13 and Dex 13.")).toBeVisible();
  await expect(modal.getByRole("button", { name: "Add Monk" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await addClass(page, "Rogue");
  await expect(classLine(page)).toHaveText("Fighter 3, Wizard 2, Rogue 1");
  await expect(builder(page).getByRole("button", { name: "Change Rogue" })).toBeFocused();
  // The rogue's hit points are the average: 5 and +2 from Constitution.
  await expect(hitPointsTotal(page, "Rogue")).toHaveText("7");
  await expect(sheetHitPoints(page)).toHaveText("47");
});

test("Remove asks first; a closed block shows its left mark, and the fixture has two blocks", async ({ page }) => {
  await importOnClass(page, "fighter-3-wizard-2.strict.json");
  await expect(builder(page).locator("[data-class-block]")).toHaveCount(2);
  await addClass(page, "Rogue");
  // A Rogue 3 has its Roguish Archetype to pick; its new levels get the average hit points.
  await builder(page).getByRole("button", { name: "Add a Rogue level" }).click();
  await builder(page).getByRole("button", { name: "Add a Rogue level" }).click();
  await expect(levelField(page, "Rogue")).toHaveValue("3");
  // Close and open: a real button with aria-expanded; the closed block shows the picks left of its Choices and hit points.
  const close = builder(page).getByRole("button", { name: "Close Rogue" });
  await expect(close).toHaveAttribute("aria-expanded", "true");
  await close.click();
  const open = builder(page).getByRole("button", { name: "Open Rogue" });
  await expect(open).toHaveAttribute("aria-expanded", "false");
  await expect(block(page, "Rogue").getByRole("region", { name: "Choices" })).toBeHidden();
  const header = block(page, "Rogue").locator("h3").locator("..");
  await expect(header.locator(".ui-left-mark")).toHaveText("1 left");
  await open.click();
  await expect(header.locator(".ui-left-mark")).toHaveCount(0);
  await expect(block(page, "Rogue").getByRole("region", { name: "Choices" })).toBeVisible();

  // Remove of a class with picks asks first; Cancel keeps it, and the focus goes back to Remove.
  await removeClass(page, "Wizard");
  const question = page.getByRole("alertdialog", { name: "Remove Wizard?" });
  await expect(question).toContainText("Arcane Tradition: School of Evocation");
  await question.getByRole("button", { name: "Cancel" }).click();
  await expect(builder(page).getByRole("button", { name: "Remove Wizard" })).toBeFocused();
  await removeClass(page, "Wizard");
  await question.getByRole("button", { name: "Remove" }).click();
  await expect(classLine(page)).toHaveText("Fighter 3, Rogue 3");
  await expect(builder(page).getByRole("button", { name: "Change Rogue" })).toBeFocused();
  // 28 for the fighter, and 3 × (5 + 2) for the rogue.
  await expect(sheetHitPoints(page)).toHaveText("49");
});
