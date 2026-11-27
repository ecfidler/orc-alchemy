// The builder, in a browser (docs/design/character-builder.md): picks through the steps with the summary card, a refused
// pick, a change of class, a second class, the Spells step, Random character, the marks of picks left, a pick that does
// not move its heading, and the Name and Description steps.
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import {
  addClass,
  addFirstClass,
  addSpells,
  changeClass,
  hitPointsTotal,
  newCharacter,
  openStep,
  pickIn,
  picksIn,
  removeClass,
  section,
  stepButton,
} from "./builder-helpers.ts";
import { closeSheetPanel, openSheetPanel, summaryCard } from "./sheet-panel.ts";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

test("a new character becomes a dwarf acolyte fighter 1, and the summary card follows each pick", async ({ page }) => {
  await newCharacter(page);

  const builder = page.getByRole("region", { name: "Builder" });
  const preview = summaryCard(page);
  const hp = preview.getByLabel("Hit points", { exact: true });
  // A new character has no class, so no hit points, and the standard scores: Con 13.
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("");
  await expect(hp).toHaveText("");
  await expect(preview.getByLabel("CON", { exact: true })).toHaveText("13 +1");

  // Race: a dwarf has Con +2 and a speed of 25 ft. The pick of the Dwarf picks its one subrace, Hill Dwarf, too (ORC-348).
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Dwarf");
  await expect(picksIn(section(page, "Race"))).toHaveText(["Dwarf"]);
  await expect(preview.getByLabel("Race", { exact: true })).toHaveText("Dwarf (Hill Dwarf)");
  await expect(preview.getByLabel("Speed", { exact: true })).toHaveText("25 ft.");
  await expect(preview.getByLabel("CON", { exact: true })).toHaveText("15 +2");
  // Picking another race replaces it, with its one subrace, and asks nothing. No Subrace row opens.
  await pickIn(section(page, "Race"), "Elf");
  await expect(preview.getByLabel("Race", { exact: true })).toHaveText("Elf (High Elf)");
  await pickIn(section(page, "Race"), "Dwarf");
  await expect(builder.getByRole("region", { name: /^Subrace/ })).toHaveCount(0);
  await expect(preview.getByLabel("Race", { exact: true })).toHaveText("Dwarf (Hill Dwarf)");

  await stepButton(page, "Background").click();
  await pickIn(section(page, "Background"), "Acolyte");
  await expect(preview.getByLabel("Background", { exact: true })).toHaveText("Acolyte");
  await expect(await openSheetPanel(page)).toContainText("Shelter the Faithful");
  await closeSheetPanel(page);

  // Class: a fighter's hit die is d10, so 10 + Con +2, and +1 of the Hill Dwarf.
  await addFirstClass(page, "Fighter");
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Fighter 1");
  await expect(hp).toHaveText("13");
  await expect(builder.getByRole("region", { name: /^Fighting Style/ })).toBeVisible();

  // The builder links to the sheet, which shows the same character.
  await page.getByRole("link", { name: "Done" }).click();
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  // The URL changes before the page does, and the builder has a Class region too.
  await expect(page.getByRole("region", { name: "Builder" })).toHaveCount(0);
  await expect(page.getByLabel("Class", { exact: true })).toHaveText("Fighter 1");
  await expect(page.getByLabel("Race", { exact: true })).toHaveText("Dwarf (Hill Dwarf)");
  // Edit opens the first step with a mark: the fighting style is still to pick.
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);
  await expect(page.getByRole("region", { name: "Builder" }).getByRole("heading", { level: 2 })).toHaveText("Class");
});

test("a pick the engine refuses shows its reason in the status toast", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  // A barbarian picks 2 skills: a third is refused.
  await addFirstClass(page, "Barbarian");
  await openStep(page, "Proficiencies");
  for (const skill of ["Athletics", "Intimidation", "Survival"]) await builder.getByRole("button", { name: skill, exact: true }).click();
  await expect(page.getByRole("status").and(page.locator("[data-toast-status]"))).toHaveText(/no selections remain/);
  await expect(builder.getByRole("alert")).toHaveCount(0);
  await expect(summaryCard(page).getByLabel("Class", { exact: true })).toHaveText("Barbarian 1");
});

test("replacing a class with more than level 1 asks first", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-5.strict.json"));
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  const klass = summaryCard(page).getByLabel("Class", { exact: true });
  await expect(klass).toHaveText("Fighter 5");
  await stepButton(page, "Class").click();

  // The question of a change that removes picks (ORC-344), from Change of the class block (ORC-349).
  const dialog = page.getByRole("alertdialog", { name: "Replace Fighter with Wizard?" });
  await changeClass(page, "Fighter", "Wizard");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(klass).toHaveText("Fighter 5");
  await expect(builder.getByRole("heading", { level: 3, name: "Fighter", exact: true })).toBeVisible();

  await changeClass(page, "Fighter", "Wizard");
  await dialog.getByRole("button", { name: "Replace" }).click();
  await expect(klass).toHaveText("Wizard 1");
  await expect(builder.getByRole("heading", { level: 3, name: "Wizard", exact: true })).toBeVisible();
});

test("a half-elf fighter 3 adds wizard levels, then removes them", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = summaryCard(page);
  const klass = preview.getByLabel("Class", { exact: true });
  const hp = preview.getByLabel("Hit points", { exact: true });
  const region = (name: string) => builder.getByRole("region", { name: new RegExp(`^${name}`) });

  // The half-elf's improvement, on the Abilities step: INT 12 + 1 is 13, as a wizard needs.
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Half-Elf");
  await stepButton(page, "Abilities").click();
  const asi = region("Ability Score Increase: Half-Elf");
  await asi.getByRole("button", { name: "Increase Strength" }).click();
  await asi.getByRole("button", { name: "Increase Intelligence" }).click();
  await expect(asi.getByRole("button", { name: "Increase Dexterity" })).toBeDisabled();
  await expect(preview.getByLabel("INT", { exact: true })).toHaveText("13 +1");

  // Con 13 is +1: 10 + 1 at level 1, then the average 6 + 1 for each level after.
  await addFirstClass(page, "Fighter");
  await expect(klass).toHaveText("Fighter 1");
  await expect(builder.getByRole("button", { name: "Remove a Fighter level" })).toBeDisabled();
  // With one class, there is no Remove button.
  await expect(builder.getByRole("button", { name: "Remove Fighter", exact: true })).toHaveCount(0);
  // The new levels get the average, 6: the method of the hit points is Average.
  await builder.getByRole("button", { name: "Add a Fighter level" }).click();
  await builder.getByRole("button", { name: "Add a Fighter level" }).click();
  await expect(klass).toHaveText("Fighter 3");
  await expect(hitPointsTotal(page, "Fighter")).toHaveText("25");
  await pickIn(section(page, "Martial Archetype"), "Champion");
  await expect(picksIn(section(page, "Martial Archetype"))).toHaveText(["Champion"]);
  await expect(hp).toHaveText("25");

  // A wizard's hit die is d6: the average is 4.
  await addClass(page, "Wizard");
  await expect(klass).toHaveText("Fighter 3, Wizard 1");
  await expect(builder.getByRole("heading", { level: 3, name: "Wizard", exact: true })).toBeVisible();
  await builder.getByRole("button", { name: "Add a Wizard level" }).click();
  await pickIn(section(page, "Arcane Tradition"), "School of Evocation");
  await expect(picksIn(section(page, "Arcane Tradition"))).toHaveText(["School of Evocation"]);
  await expect(klass).toHaveText("Fighter 3, Wizard 2");
  await expect(preview.getByLabel("Level", { exact: true })).toHaveText("5");
  await expect(hp).toHaveText("35");

  // A lower level that removes the School of Evocation asks first (ORC-349); removing a class with no pick does not ask.
  await builder.getByRole("button", { name: "Remove a Wizard level" }).click();
  await page.getByRole("alertdialog", { name: "Lower Wizard to level 1?" }).getByRole("button", { name: "Remove" }).click();
  await expect(klass).toHaveText("Fighter 3, Wizard 1");
  await removeClass(page, "Wizard");
  await expect(klass).toHaveText("Fighter 3");
  await expect(hp).toHaveText("25");
  await expect(builder.getByRole("heading", { level: 3, name: "Wizard", exact: true })).toHaveCount(0);
});

test("a new wizard 1 picks a cantrip and a spell on the Spells step, and prepares the spell", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = summaryCard(page);
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("");

  // A character with no class has no spells, so the step has no count; the wizard has 3 cantrips and 6 spells to pick.
  await expect(stepButton(page, "Spells")).toHaveAccessibleName("Spells");
  await addFirstClass(page, "Wizard");
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Wizard 1");
  await expect(stepButton(page, "Spells")).toHaveAccessibleName("Spells, 9 picks left");
  await stepButton(page, "Spells").click();

  // A box in the "Add spells" popup of each selection adds the spell (ORC-357).
  await addSpells(page, "Wizard Cantrips Known", ["Fire Bolt"]);
  await addSpells(page, "Wizard Spells Known", ["Magic Missile"]);
  const spells = builder.getByRole("region", { name: /^Wizard Spells Known/ });
  await expect(spells.getByRole("list", { name: "Chosen: Wizard Spells Known" })).toHaveText("Magic Missile");
  await expect(stepButton(page, "Spells")).toHaveAccessibleName("Spells, 7 picks left");

  // The standard scores have Int 12: a wizard 1 prepares 2 spells.
  const prepared = builder.getByRole("region", { name: "Prepared spells: Wizard" });
  await expect(prepared).toContainText("0 of 2 prepared");
  // The sheet lists only prepared spells: none yet, then Magic Missile.
  const spellTable = page.getByRole("dialog", { name: "Sheet" }).getByRole("table", { name: "Spells by level" });
  const firstLevel = spellTable.getByRole("row", { name: /^1st / });
  await openSheetPanel(page);
  await expect(firstLevel.getByRole("listitem")).toHaveCount(0);
  await closeSheetPanel(page);
  await prepared.getByRole("checkbox", { name: "Prepared: Magic Missile" }).check();
  await expect(prepared).toContainText("1 of 2 prepared");
  await openSheetPanel(page);
  await expect(firstLevel.getByRole("listitem")).toHaveText(["Magic Missile"]);
  await expect(spellTable.getByRole("row", { name: /^Cantrips / })).toContainText("Fire Bolt");
});

/** Imports the Life cleric 9 of e2e/life-cleric-9.strict.json (8 of 12 prepared) and opens the prepare section of its Spells step. */
async function openClericSpells(page: Page) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(import.meta.dirname, "life-cleric-9.strict.json"));
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);
  await stepButton(page, "Spells").click();
  return page.getByRole("region", { name: "Builder" }).getByRole("region", { name: "Prepared spells: Cleric" });
}

test("the Spells step has the prepare rules of the panel: no limit on the boxes, and a red count over the limit (ORC-288)", async ({ page }) => {
  const prepared = await openClericSpells(page);
  const count = prepared.locator("[data-prepare-count]");
  const box = (name: string) => prepared.getByRole("checkbox", { name: `Prepared: ${name}` });
  await expect(count).toHaveText("8 of 12 prepared");
  await expect(count).toHaveAttribute("data-prepare-count", "under");
  // A domain spell is checked and cannot change.
  await expect(box("Bless")).toBeChecked();
  await expect(box("Bless")).toHaveAttribute("aria-disabled", "true");
  for (const name of ["Command", "Bane", "Sanctuary", "Guiding Bolt"]) await box(name).click();
  await expect(count).toHaveText("12 of 12 prepared");
  await expect(count).toHaveAttribute("data-prepare-count", "at");
  // At the limit the other boxes stay on, and a 13th spell makes the count red.
  await expect(box("Detect Magic")).not.toHaveAttribute("aria-disabled", "true");
  await box("Detect Magic").click();
  await expect(count).toHaveText("13 of 12 prepared. Remove 1 spell.");
  await expect(count).toHaveAttribute("data-prepare-count", "over");
  await expect(box("Detect Magic")).toBeChecked();
});

test("Random character opens a complete character in the builder", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Random character" }).click();
  // A random character is a new character too: it opens on Name.
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+\?step=Name$/);
  // No step has a pick left: each step button is named by its step only.
  const buttons = page.getByRole("navigation", { name: "Steps" }).getByRole("button");
  await expect(buttons).toHaveCount(10);
  for (const button of await buttons.all()) await expect(button).toHaveAccessibleName(/^[A-Z][a-z]+$/);
  await expect(summaryCard(page).getByLabel("Class", { exact: true })).toHaveText(/^\w.* \d+/);
});

test("the rail and the headings show the picks left as marks, and a pick changes them", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  await expect(page.getByText("Every choice is made.")).toHaveCount(0);
  await expect(page.getByText(/more '.*' selection/)).toHaveCount(0);
  // A new character has a class to pick, and the alignment on the Description step. The name has no mark.
  await expect(stepButton(page, "Name")).toHaveAccessibleName("Name");
  await expect(stepButton(page, "Class")).toHaveAccessibleName("Class, 1 pick left");
  await expect(stepButton(page, "Proficiencies")).toHaveAccessibleName("Proficiencies");
  await expect(stepButton(page, "Description")).toHaveAccessibleName("Description, 1 pick left");
  await expect(stepButton(page, "Equipment")).toHaveAccessibleName("Equipment");
  await expect(stepButton(page, "Race")).toHaveAccessibleName("Race, 1 pick left");
  // The mark on a step is the number only; the mark at a heading is "1 left", in the heading text.
  await expect(stepButton(page, "Race").locator(".ui-inline-note")).toHaveText("1");
  await openStep(page, "Race");
  await expect(builder.getByRole("heading", { name: "Race, 1 left", exact: true })).toBeVisible();

  await pickIn(section(page, "Race"), "Human");
  await expect(summaryCard(page).getByLabel("Race", { exact: true })).toHaveText("Human");
  // The block of the Human (ORC-348) has the left mark of the step.
  await expect(builder.getByRole("heading", { name: "Human, 2 left", exact: true })).toBeVisible();
  // The human's subrace and its choices are new picks on the same step.
  await expect(stepButton(page, "Race")).toHaveAccessibleName("Race, 2 picks left");

  // A fighter has a fighting style to pick on the Class step, and 2 skills on the Proficiencies step, with the
  // language of the human.
  await expect(stepButton(page, "Proficiencies")).toHaveAccessibleName("Proficiencies, 1 pick left");
  await addFirstClass(page, "Fighter");
  await expect(stepButton(page, "Class")).toHaveAccessibleName("Class, 1 pick left");
  await expect(stepButton(page, "Proficiencies")).toHaveAccessibleName("Proficiencies, 3 picks left");
});

test("a pick does not move the heading of its selection, or change its size", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  await addFirstClass(page, "Barbarian");
  await openStep(page, "Proficiencies");
  const skills = builder.getByRole("region", { name: /^Skills: Barbarian/ }).first();
  const heading = skills.getByRole("heading").first();
  await expect(heading).toHaveAccessibleName("Skills: Barbarian, 2 left");
  const before = await heading.boundingBox();
  // 2 left, then 1 left, then Done: the same box each time.
  await skills.getByRole("button", { name: "Athletics", exact: true }).click();
  await expect(heading).toHaveAccessibleName("Skills: Barbarian, 1 left");
  expect(await heading.boundingBox()).toEqual(before);
  await skills.getByRole("button", { name: "Survival", exact: true }).click();
  await expect(heading).toHaveAccessibleName("Skills: Barbarian, Done");
  expect(await heading.boundingBox()).toEqual(before);
  // The rail and the step title do not move either.
  const title = builder.getByRole("heading", { level: 2 });
  const titleBox = await title.boundingBox();
  await skills.getByRole("button", { name: "Survival", exact: true }).click();
  await expect(heading).toHaveAccessibleName("Skills: Barbarian, 1 left");
  expect(await heading.boundingBox()).toEqual(before);
  expect(await title.boundingBox()).toEqual(titleBox);
});

test("a new character opens on Name with the focus in the field; Enter writes the name and goes to Class (ORC-342)", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = summaryCard(page);
  await expect(preview.getByLabel("Name", { exact: true })).toHaveText("Unnamed character");
  const name = builder.getByRole("textbox", { name: "Character name" });
  await expect(name).toBeFocused();
  await page.keyboard.type("Brannor Ironfist");
  await expect(name).toHaveValue("Brannor Ironfist");
  await page.keyboard.press("Enter");
  await expect(builder.getByRole("heading", { level: 2 })).toHaveText("Class");
  await expect(builder.getByRole("heading", { level: 2 })).toBeFocused();
  await expect(preview.getByLabel("Name", { exact: true })).toHaveText("Brannor Ironfist");
  await expect(stepButton(page, "Name")).toHaveAccessibleName("Name");
  // The Class step shows its left mark, and the heading of the class selection too.
  await expect(stepButton(page, "Class")).toHaveAccessibleName("Class, 1 pick left");
  await expect(builder.getByRole("heading", { name: "Class, 1 left", exact: true })).toBeVisible();
});

test("the Description step has no name field, and writes XP on blur as an int", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });

  // Description is the last step of ten, and it has the alignment to pick.
  const buttons = page.getByRole("navigation", { name: "Steps" }).getByRole("button");
  const order = ["Name", "Class", "Background", "Race", "Abilities", "Proficiencies", "Feats", "Spells", "Equipment", "Description"];
  // Each button shows the number of its step, then its name.
  await expect(buttons).toHaveText(order.map((name, i) => new RegExp(`^${i + 1}${name}`)));
  const description = buttons.last();
  await expect(description).toHaveAccessibleName("Description, 1 pick left");
  await description.click();
  await expect(builder.getByLabel(/Character name/i)).toHaveCount(0);

  await builder.getByLabel("Experience Points").fill("900.9");
  await builder.getByRole("heading", { name: "Description" }).click();
  // The sheet does not show XP (theme spec, "Not on the sheet in M8"), so the field shows what is stored.
  await expect(builder.getByLabel("Experience Points")).toHaveValue("900");
});
