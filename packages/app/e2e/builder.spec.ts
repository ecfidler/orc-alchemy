import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Page, test } from "@playwright/test";
import {
  addClass,
  addFirstClass,
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

  const cantrips = builder.getByRole("region", { name: /^Wizard Cantrips Known/ });
  await cantrips.getByRole("button", { name: "Fire Bolt", exact: true }).click();
  await expect(cantrips.getByRole("button", { name: "Fire Bolt", exact: true })).toHaveAttribute("aria-pressed", "true");
  const spells = builder.getByRole("region", { name: /^Wizard Spells Known/ });
  await spells.getByLabel("Search: Wizard Spells Known").fill("magic missile");
  await spells.getByRole("button", { name: "1 - Magic Missile", exact: true }).click();
  await expect(spells.getByRole("list", { name: "Chosen: Wizard Spells Known" })).toHaveText("1 - Magic Missile");
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

test("Next and Back go through the steps with the keyboard, and the focus goes to the step title", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const title = builder.getByRole("heading", { level: 2 });
  await stepButton(page, "Name").click();
  await expect(title).toHaveText("Name");
  await expect(builder.getByText("Step 1 of 10")).toBeVisible();
  // The Name step has no Back.
  await expect(builder.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
  const next = builder.getByRole("button", { name: "Next: Class" });
  await next.focus();
  await expect(next).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(title).toHaveText("Class");
  await expect(title).toBeFocused();
  await expect(stepButton(page, "Class")).toHaveAttribute("aria-current", "step");
  await expect(builder.getByText("Step 2 of 10")).toBeVisible();
  const back = builder.getByRole("button", { name: "Back", exact: true });
  await back.focus();
  await expect(back).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(title).toHaveText("Name");
  await expect(title).toBeFocused();

  // The last step goes to the sheet.
  await stepButton(page, "Description").click();
  await expect(builder.getByRole("button", { name: /^Next/ })).toHaveCount(0);
  await builder.getByRole("link", { name: "Go to the sheet" }).click();
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
});

test("a step with nothing to pick is dimmed in the rail, and shows one line", async ({ page }) => {
  await newCharacter(page);
  await expect(stepButton(page, "Feats")).toHaveAttribute("data-dimmed", "");
  await stepButton(page, "Feats").click();
  await expect(page.getByRole("region", { name: "Builder" }).getByText("This character has no feat to pick.")).toBeVisible();
});

test("the rail scrolls sideways on a narrow page, and the open step scrolls into view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newCharacter(page);
  const list = page.getByRole("navigation", { name: "Steps" }).getByRole("list");
  // The rail fits in the page; its list scrolls inside it.
  expect(await page.getByRole("navigation", { name: "Steps" }).evaluate((nav) => nav.getBoundingClientRect().right <= window.innerWidth)).toBe(true);
  expect(await list.evaluate((l) => l.scrollWidth > l.clientWidth)).toBe(true);
  await stepButton(page, "Description").click();
  const inView = () =>
    list.evaluate((l) => {
      const current = l.querySelector('[aria-current="step"]')!.getBoundingClientRect();
      const box = l.getBoundingClientRect();
      return current.left >= box.left - 1 && current.right <= box.right + 1;
    });
  await expect.poll(inView).toBe(true);
  // Back to the first step: it scrolls back.
  await page.getByRole("region", { name: "Builder" }).getByRole("button", { name: "Back", exact: true }).click();
  await stepButton(page, "Name").click();
  await expect.poll(inView).toBe(true);
});

test("a pick does not move the lines of the summary card, and a long name does not grow it", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const card = summaryCard(page);
  // The box of the card, then of each line and each term in it, as [x, y, width, height]. A value can grow in its line.
  const boxes = () =>
    card.evaluate((c) =>
      [c, ...c.querySelectorAll("dl > div, dt")].map((e) => {
        const r = e.getBoundingClientRect();
        return [r.x, r.y, r.width, r.height];
      }),
    );
  // The same boxes, from the top left corner of the card.
  const inCard = (list: number[][]) => list.map(([x, y, w, h]) => [x - list[0][0], y - list[0][1], w, h]);
  await expect(card.getByLabel("Race", { exact: true })).toHaveText("");
  const before = await boxes();
  // The race and the speed get a value; nothing in the card moves.
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Dwarf");
  await expect(card.getByLabel("Race", { exact: true })).toHaveText("Dwarf (Hill Dwarf)");
  await expect(card.getByLabel("Speed", { exact: true })).toHaveText("25 ft.");
  expect(await boxes()).toEqual(before);
  await stepButton(page, "Background").click();
  await pickIn(section(page, "Background"), "Acolyte");
  await expect(card.getByLabel("Background", { exact: true })).toHaveText("Acolyte");
  expect(await boxes()).toEqual(before);

  // A class gives the class, the level and the hit points; nothing in the card moves.
  await addFirstClass(page, "Fighter");
  await expect(card.getByLabel("Hit points", { exact: true })).toHaveText("13");
  expect(await boxes()).toEqual(before);

  // A long name is cut on its one line: the card keeps its size, and its lines their places in it.
  await openStep(page, "Name");
  const name = builder.getByRole("textbox", { name: "Character name" });
  await name.fill("Brannor Ironfist of the Deep Halls, Keeper of the Seventh Forge");
  await name.press("Enter");
  await expect(card.getByLabel("Name", { exact: true })).toHaveText("Brannor Ironfist of the Deep Halls, Keeper of the Seventh Forge");
  expect(inCard(await boxes())).toEqual(inCard(before));
});

test("the summary card stays in view when the step scrolls", async ({ page }) => {
  await newCharacter(page);
  // The Equipment step of a barbarian is longer than the window.
  await addFirstClass(page, "Barbarian");
  await openStep(page, "Equipment");
  const card = summaryCard(page);
  await expect(card).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, 800));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400);
  await expect(card).toBeInViewport({ ratio: 1 });
});

test("Open the full sheet opens the panel with the keyboard; Escape closes it and the focus goes back to the button", async ({ page }) => {
  await newCharacter(page);
  await addFirstClass(page, "Barbarian");
  const opener = page.getByRole("button", { name: "Open the full sheet" });
  await opener.focus();
  await expect(opener).toBeFocused();
  await page.keyboard.press("Enter");
  const panel = page.getByRole("dialog", { name: "Sheet" });
  await expect(panel.getByRole("button", { name: "Close" })).toBeFocused();
  // The panel is at the right side of the window, its full height.
  const box = (await panel.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x + box.width).toBe(viewport.width);
  expect(box.height).toBe(viewport.height);
  await expect(panel.getByLabel("Class", { exact: true })).toHaveText("Barbarian 1");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(opener).toBeFocused();
  // A click outside closes it too.
  await opener.click();
  await expect(panel).toBeVisible();
  await page.mouse.click(20, 400);
  await expect(panel).toHaveCount(0);
});

test("under 860px there is no card, and the Sheet button between Back and Next opens the panel, at the full width under 720px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newCharacter(page);
  await openStep(page, "Class");
  const builder = page.getByRole("region", { name: "Builder" });
  await expect(summaryCard(page)).toBeHidden();
  const back = builder.getByRole("button", { name: "Back", exact: true });
  const sheet = builder.getByRole("button", { name: "Sheet", exact: true });
  const next = builder.getByRole("button", { name: "Next: Background" });
  const [b, s, n] = [(await back.boundingBox())!, (await sheet.boundingBox())!, (await next.boundingBox())!];
  expect(b.x < s.x && s.x < n.x).toBe(true);
  await sheet.click();
  const panel = page.getByRole("dialog", { name: "Sheet" });
  await expect(panel.getByRole("button", { name: "Close" })).toBeFocused();
  expect((await panel.boundingBox())!.width).toBe(390);
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toHaveCount(0);
  await expect(sheet).toBeFocused();
  // At 860px the card shows and the Sheet button does not (ORC-353).
  await page.setViewportSize({ width: 860, height: 844 });
  await expect(summaryCard(page)).toBeVisible();
  await expect(sheet).toBeHidden();
});

/** The count of drafts stored, read from IndexedDB: a change is kept as a draft at once. */
const draftCount = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("alchemy-5e");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const count = open.result.transaction("drafts").objectStore("drafts").count();
          count.onerror = () => reject(count.error);
          count.onsuccess = () => {
            open.result.close();
            resolve(count.result);
          };
        };
      }),
  );

test("a reload mid-edit asks first, then recovers the draft", async ({ page }) => {
  await newCharacter(page);
  const race = summaryCard(page).getByLabel("Race", { exact: true });
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Saved");
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Dwarf");
  await expect(race).toHaveText("Dwarf (Hill Dwarf)");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Unsaved changes");
  await expect.poll(() => draftCount(page)).toBe(1);

  // Autosave has not run yet, so leaving asks first.
  let dialogType = "";
  page.once("dialog", (dialog) => {
    dialogType = dialog.type();
    return dialog.accept();
  });
  await page.reload();
  expect(dialogType).toBe("beforeunload");
  await expect(page.getByText("Unsaved changes from your last visit were recovered.")).toBeVisible();
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Unsaved changes");
  await expect(race).toHaveText("Dwarf (Hill Dwarf)");
});

test("Save stores the changes now, and leaving the builder saves them too", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const race = summaryCard(page).getByLabel("Race", { exact: true });
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Dwarf");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Unsaved changes");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Saved");
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);

  // Nothing is pending, so a reload does not ask (Playwright would dismiss the prompt and stay). The reload opens
  // the step of the URL, Name, and the field has the focus again.
  await page.reload();
  await expect(race).toHaveText("Dwarf (Hill Dwarf)");
  await expect(builder.getByRole("textbox", { name: "Character name" })).toBeFocused();
  await openStep(page, "Race");
  await expect(page.getByRole("status", { name: "Save status" })).toHaveText("Saved");
  await expect(page.getByText(/were recovered/)).toHaveCount(0);

  // A move to the list saves at once: the list shows the change before autosave would have run.
  await pickIn(section(page, "Race"), "Elf");
  await expect(race).toHaveText("Elf (High Elf)");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Characters" }).click();
  // A character with no class shows its race only.
  await expect(page.getByRole("listitem", { name: "Unnamed character" }).locator("p")).toHaveText("Elf", { timeout: 3000 });
  await expect.poll(() => draftCount(page)).toBe(0);
});

test("fighter-1's scores by hand: a standard human with the standard scores, then a swap and point buy", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const str = summaryCard(page).getByLabel("STR", { exact: true });
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Human");
  await pickIn(section(page, "Subrace"), "Damaran");
  await builder.getByRole("button", { name: "Standard Human", exact: true }).click();
  await expect(builder.getByRole("button", { name: "Standard Human", exact: true })).toHaveAttribute("aria-pressed", "true");

  await stepButton(page, "Abilities").click();
  await expect(builder.getByRole("button", { name: "Standard Scores" })).toHaveAttribute("aria-pressed", "true");
  const scores = section(page, "Base Ability Scores");
  const total = scores.locator("[data-total]");
  await expect(total).toHaveText(["Total 16", "Total 15", "Total 14", "Total 13", "Total 11", "Total 9"]);
  await expect(scores.locator("[data-token]")).toHaveText(Array(6).fill("+1 Race"));
  await expect(str).toHaveText("16 +3");

  // STR and DEX change places: two clicks on their chips (ORC-345).
  await scores.getByRole("button", { name: /^Strength base score/ }).click();
  await scores.getByRole("button", { name: /^Dexterity base score/ }).click();
  await expect(total).toHaveText(["Total 15", "Total 16", "Total 14", "Total 13", "Total 11", "Total 9"]);
  await expect(str).toHaveText("15 +2");

  // Point buy starts every score at 8, and an increase spends points.
  await builder.getByRole("button", { name: "Point Buy" }).click();
  await expect(total).toHaveText(Array(6).fill("Total 9"));
  await expect(scores.locator("[data-strip]")).toHaveText("27 of 27 points left");
  await scores.getByRole("button", { name: "Increase Constitution" }).click();
  await expect(total).toHaveText(["Total 9", "Total 9", "Total 10", "Total 9", "Total 9", "Total 9"]);
  await expect(scores.locator("[data-strip]")).toHaveText("26 of 27 points left");
});

test("fighter-20 without armor or magic items is equipped on the Equipment step", async ({ page }, testInfo) => {
  // fighter-20 ("Ser Aldric") without its armor, magic items, hands and attunement.
  const strict = JSON.parse(readFileSync(join(charactersDir, "fighter-20.strict.json"), "utf8"));
  const lists = ["~:armor", "~:magic-weapons", "~:other-magic-items"];
  strict["~:orcpub.entity.strict/selections"] = strict["~:orcpub.entity.strict/selections"].filter(
    (s: Record<string, string>) => !lists.includes(s["~:orcpub.entity.strict/key"]),
  );
  for (const key of ["worn-armor", "wielded-shield", "main-hand-weapon", "attuned-magic-items"]) {
    delete strict["~:orcpub.entity.strict/values"][`~:orcpub.dnd.e5.character/${key}`];
  }
  const file = testInfo.outputPath("fighter-20-unequipped.json");
  writeFileSync(file, JSON.stringify(strict));

  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(file);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = summaryCard(page);
  const ac = preview.getByLabel("Armor Class", { exact: true });
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Fighter 20");
  await expect(ac).toHaveText("18");
  await stepButton(page, "Equipment").click();

  await pickOption(builder.getByLabel("Add an item to Armor"), "Plate");
  await expect(builder.getByRole("checkbox", { name: "Carried: Plate" })).toBeChecked();
  await pickOption(builder.getByLabel("Add an item to Magic Weapons"), "Longsword +1");
  await pickOption(builder.getByLabel("Add an item to Other Magic Items"), "Amulet of Health");
  await pickOption(builder.getByLabel("Worn armor"), "Plate");
  await pickOption(builder.getByLabel("Wielded shield"), "Shield");
  await pickOption(builder.getByLabel("Main hand"), "Longsword +1");
  await builder.getByRole("checkbox", { name: "Attuned: Amulet of Health" }).check();

  await expect(ac).toHaveText("20");
  await expect(preview.getByLabel("Hit points", { exact: true })).toHaveText("204");
  const panel = await openSheetPanel(page);
  const longsword = panel.getByRole("table", { name: "Weapon attacks" }).getByRole("row", { name: /^Longsword 1 / });
  // The panel is narrower than 720px, so it has no Proficient? column (ORC-176).
  await expect(longsword.getByRole("cell")).toHaveText(["Longsword 1", "+12 to hit", "+6"]);
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

test("fighter-1 built from New character through the steps matches its expected values", async ({ page }) => {
  // The picks of fighter-1.strict.json. The golden test (parity.test.ts) checks the whole entity.
  const expected = JSON.parse(readFileSync(join(charactersDir, "fighter-1.expected.json"), "utf8"));
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = summaryCard(page);
  const card = (name: string) => builder.getByRole("button", { name, exact: true });
  const pick = async (...names: string[]) => {
    for (const name of names) {
      await card(name).click();
      await expect(card(name)).toHaveAttribute("aria-pressed", "true");
    }
  };

  // The name first, on the step that a new character opens on.
  const name = builder.getByRole("textbox", { name: "Character name" });
  await expect(name).toBeFocused();
  await name.fill(expected["character-name"]);
  await name.press("Enter");
  await expect(builder.getByRole("heading", { level: 2 })).toHaveText("Class");
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Human");
  await pickIn(section(page, "Subrace"), "Damaran");
  await pick("Standard Human");
  await openStep(page, "Background");
  await pickIn(section(page, "Background"), "Acolyte");
  await addFirstClass(page, "Fighter");
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Fighter 1");
  await pick("Defense");
  // The human knows one language more and the acolyte two more: one selection, with the fighter's skills.
  await stepButton(page, "Proficiencies").click();
  for (const language of ["Dwarvish", "Elvish", "Giant"]) await pickIn(section(page, "Languages"), language);
  for (const skill of ["Athletics", "Perception"]) await pickIn(section(page, "Skills: Fighter"), skill);
  await expect(picksIn(section(page, "Languages"))).toHaveText(["Dwarvish", "Elvish", "Giant"]);
  await expect(picksIn(section(page, "Skills: Fighter"))).toHaveText(["Athletics", "Perception"]);
  // The standard scores are the default.
  await stepButton(page, "Abilities").click();
  await expect(builder.getByRole("button", { name: "Standard Scores" })).toHaveAttribute("aria-pressed", "true");
  await stepButton(page, "Equipment").click();
  // The starting equipment of the class and the background is on this step.
  await pick("Amulet", "Prayer Book", "Chain Mail", "Martial Weapon and Shield");
  // The martial weapon is one pick of 27: a list behind a Choose button, with a search field.
  await pickIn(section(page, "Starting Equipment: Martial Weapon"), "Longsword");
  await pick("Two Handaxes", "Dungeoneer's Pack");
  await pickOption(builder.getByLabel("Worn armor"), "Chain mail");
  await pickOption(builder.getByLabel("Wielded shield"), "Shield");
  // The main hand sets the off hand to none. The golden has the shield there, but the
  // off-hand list offers only dual-wield weapons. The values below do not change.
  await pickOption(builder.getByLabel("Main hand"), "Longsword");
  await stepButton(page, "Description").click();
  // Alignment is the first field, a select (ORC-352).
  const alignment = builder.getByRole("combobox", { name: /^Alignment/ });
  await pickOption(alignment, "Lawful Good");
  await expect(alignment).toHaveText("Lawful Good");

  await expect(preview.getByLabel("Name", { exact: true })).toHaveText(expected["character-name"]);
  // The worn chain mail and the wielded shield: 19.
  const worn = expected["armor-class-with-armor"].find((o: { armor: string; shield: string }) => o.armor === "chain-mail" && o.shield === "shield");
  await expect(preview.getByLabel("Armor Class", { exact: true })).toHaveText(String(worn.ac));
  const hp = expected["max-hit-points"];
  await expect(preview.getByLabel("Hit points", { exact: true })).toHaveText(String(hp));
  const longsword = expected["weapon-modifiers"].longsword;
  const panel = await openSheetPanel(page);
  const row = panel.getByRole("table", { name: "Weapon attacks" }).getByRole("row", { name: /^Longsword / });
  // The panel is narrower than 720px, so it has no Proficient? column (ORC-176).
  await expect(row.getByRole("cell")).toHaveText(["Longsword", `+${longsword["best-attack"]} to hit`, `+${longsword["best-damage"]}`]);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- builder.spec.ts -g orc-288
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-288 Prepare section of the Spells step, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-288-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      // The section is about 1000px high: a window that holds all of it, so the screenshot is not stitched from scrolled parts.
      await page.setViewportSize({ width: 1280, height: 1400 });
      const prepared = await openClericSpells(page);
      await page.evaluate(() => document.fonts.ready);
      await prepared.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await prepared.screenshot({ path: shot("under") });
      for (const name of ["Command", "Bane", "Sanctuary", "Guiding Bolt"]) await prepared.getByRole("checkbox", { name: `Prepared: ${name}` }).click();
      await expect(prepared.locator("[data-prepare-count]")).toHaveText("12 of 12 prepared");
      await page.mouse.move(0, 0);
      await prepared.screenshot({ path: shot("at") });
      await prepared.getByRole("checkbox", { name: "Prepared: Detect Magic" }).click();
      await expect(prepared.locator("[data-prepare-count]")).toHaveText("13 of 12 prepared. Remove 1 spell.");
      await page.mouse.move(0, 0);
      await prepared.screenshot({ path: shot("over") });
    });
  }

  // PR_SCREENSHOTS=1 bun run e2e -- builder.spec.ts -g orc-340
  for (const theme of ["light", "dark"] as const) {
    for (const [width, height, size] of [
      [1280, 1000, "desktop"],
      [390, 1400, "390"],
    ] as const) {
      test(`orc-340 step rail and left marks, ${size}, ${theme}`, async ({ page }) => {
        mkdirSync(dir, { recursive: true });
        await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
        await page.setViewportSize({ width, height });
        await newCharacter(page);
        const builder = page.getByRole("region", { name: "Builder" });
        // A fighter on the Class step: the class is done, and the fighting style has 1 left.
        await addFirstClass(page, "Fighter");
        await expect(builder.getByRole("heading", { name: "Fighting Style, 1 left" })).toBeVisible();
        await expect(builder.getByRole("heading", { name: "Class, Done" })).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page.mouse.move(0, 0);
        await page.screenshot({ path: join(dir, `orc-340-marks-${size}-${theme}.png`), fullPage: size === "390" });
      });
    }
  }

  // PR_SCREENSHOTS=1 bunx playwright test e2e/builder.spec.ts -g orc-341 --trace off
  /** Imports fighter-3-wizard-2 (Corvin Half-Elven, a Half-Elf acolyte) and opens it in the builder on the Class step. */
  async function openCorvin(page: Page) {
    await page.goto("/import");
    await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-3-wizard-2.strict.json"));
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await stepButton(page, "Class").click();
    await expect(
      summaryCard(page)
        .getByLabel("Class", { exact: true })
        .or(page.getByRole("button", { name: "Sheet", exact: true })),
    ).toBeVisible();
  }
  const ready = async (page: Page) => {
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
  };
  for (const theme of ["light", "dark"] as const) {
    test(`orc-341 summary card and full sheet panel, desktop, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 1280, height: 900 });
      await openCorvin(page);
      await expect(summaryCard(page).getByLabel("Class", { exact: true })).toHaveText("Fighter 3, Wizard 2");
      await ready(page);
      await page.screenshot({ path: join(dir, `orc-341-card-desktop-${theme}.png`) });
      await openSheetPanel(page);
      await ready(page);
      await page.screenshot({ path: join(dir, `orc-341-panel-desktop-${theme}.png`) });
    });
    test(`orc-341 Sheet button, 390, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 390, height: 844 });
      await openCorvin(page);
      const sheet = page.getByRole("button", { name: "Sheet", exact: true });
      await sheet.scrollIntoViewIfNeeded();
      await ready(page);
      await page.screenshot({ path: join(dir, `orc-341-sheet-button-390-${theme}.png`) });
      if (theme === "dark") return;
      await sheet.click();
      await expect(page.getByRole("dialog", { name: "Sheet" })).toBeVisible();
      await ready(page);
      await page.screenshot({ path: join(dir, "orc-341-panel-390-light.png") });
    });
  }

  test("orc-341 a character with no class and no race, desktop, light", async ({ page }, testInfo) => {
    mkdirSync(dir, { recursive: true });
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.setViewportSize({ width: 1280, height: 900 });
    // fighter-1 less its class and its race.
    const strict = JSON.parse(readFileSync(join(charactersDir, "fighter-1.strict.json"), "utf8"));
    strict["~:orcpub.entity.strict/selections"] = strict["~:orcpub.entity.strict/selections"].filter(
      (s: Record<string, string>) => !["~:class", "~:race"].includes(s["~:orcpub.entity.strict/key"]),
    );
    const file = testInfo.outputPath("no-class-no-race.json");
    writeFileSync(file, JSON.stringify(strict));
    await page.goto("/import");
    await page.getByLabel("Import character file").setInputFiles(file);
    await page.getByRole("link", { name: "Edit", exact: true }).click();
    await stepButton(page, "Class").click();
    const card = summaryCard(page);
    await expect(card.getByLabel("Class", { exact: true })).toHaveText("");
    await expect(card.getByLabel("Level", { exact: true })).toHaveText("");
    await expect(card.getByLabel("Hit points", { exact: true })).toHaveText("");
    await expect(card.getByLabel("Race", { exact: true })).toHaveText("");
    await ready(page);
    await page.screenshot({ path: join(dir, "orc-341-no-class-desktop-light.png") });
    // The panel shows the same character with no error.
    await openSheetPanel(page);
    await ready(page);
    await page.screenshot({ path: join(dir, "orc-341-no-class-panel-desktop-light.png") });
  });

  // PR_SCREENSHOTS=1 bunx playwright test e2e/builder.spec.ts -g orc-342 --trace off
  for (const [theme, width, height, size] of [
    ["light", 1280, 800, "desktop"],
    ["dark", 1280, 800, "desktop"],
    ["light", 390, 844, "390"],
  ] as const) {
    test(`orc-342 the Name step of a new character, ${size}, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width, height });
      await newCharacter(page);
      await expect(page.getByRole("textbox", { name: "Character name" })).toBeFocused();
      await ready(page);
      await page.screenshot({ path: join(dir, `orc-342-name-step-${size}-${theme}.png`) });
    });
  }
  for (const theme of ["light", "dark"] as const) {
    test(`orc-342 the sheet of a character with no class, desktop, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 1280, height: 900 });
      await newCharacter(page);
      await page.getByRole("link", { name: "Done" }).click();
      await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
      await expect(page.getByRole("group", { name: "Hit Points" })).toHaveText("");
      await ready(page);
      await page.screenshot({ path: join(dir, `orc-342-sheet-no-class-desktop-${theme}.png`) });
    });
  }
  test("orc-342 the Class step of a new character, desktop, light", async ({ page }) => {
    mkdirSync(dir, { recursive: true });
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.setViewportSize({ width: 1280, height: 800 });
    await newCharacter(page);
    await openStep(page, "Class");
    await expect(page.getByRole("region", { name: "Builder" }).getByRole("heading", { name: "Class, 1 left", exact: true })).toBeVisible();
    await ready(page);
    await page.screenshot({ path: join(dir, "orc-342-class-step-desktop-light.png") });
  });

  test("orc-340 an empty step, desktop, light", async ({ page }) => {
    mkdirSync(dir, { recursive: true });
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.setViewportSize({ width: 1280, height: 800 });
    await newCharacter(page);
    await stepButton(page, "Feats").click();
    await expect(page.getByText("This character has no feat to pick.")).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: join(dir, "orc-340-empty-step-desktop-light.png") });
  });
});
