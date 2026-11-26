// The question before a change that removes picks, in a browser (ORC-344, docs/design/character-builder.md "A change
// that removes picks", "No layout shift"): a Cleric with Insight and Religion that takes Acolyte gets out of the dead
// end of the ORC-329 research. The question is over the page and moves nothing in it.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { addFirstClass, newCharacter, openStep, pickIn, picksIn, section, stepButton } from "./builder-helpers.ts";

/** A new Cleric with Insight and Religion, on the Background step. */
async function clericWithInsightAndReligion(page: Page) {
  await newCharacter(page);
  await addFirstClass(page, "Cleric");
  await openStep(page, "Proficiencies");
  const skills = section(page, "Skills: Cleric");
  await pickIn(skills, "Insight");
  await pickIn(skills, "Religion");
  await expect(picksIn(skills)).toHaveText(["Insight", "Religion"]);
  await openStep(page, "Background");
}

// By CSS: while the question is open, the page is hidden from the accessibility tree.
const builderBox = (page: Page) => page.locator('section[aria-label="Builder"]').boundingBox();

test("a Cleric with Insight and Religion takes Acolyte: the question lists the two skills, and after Change the Cleric picks 2 again", async ({ page }) => {
  await clericWithInsightAndReligion(page);
  const before = await builderBox(page);
  // The list with a detail panel (ORC-347): a click on the name shows Acolyte, and Choose picks it.
  await section(page, "Background").getByRole("button", { name: "Acolyte", exact: true }).click();
  const acolyte = section(page, "Background").getByRole("button", { name: "Choose Acolyte", exact: true });
  await acolyte.click();
  const question = page.getByRole("alertdialog", { name: "Change to Acolyte?" });
  await expect(question).toBeVisible();
  await expect(question.getByText("These picks go:")).toBeVisible();
  await expect(question.getByRole("term")).toHaveText(["Proficiencies"]);
  await expect(question.getByRole("definition")).toHaveText(["Skills: Insight, Religion"]);
  // The question is over the page and takes no space in it.
  expect(await builderBox(page)).toEqual(before);

  // Cancel changes nothing, and the focus goes back to the Choose button.
  await question.getByRole("button", { name: "Cancel" }).click();
  await expect(question).toBeHidden();
  await expect(acolyte).toBeFocused();
  await expect(stepButton(page, "Proficiencies")).toHaveAccessibleName("Proficiencies");

  await acolyte.click();
  await page.getByRole("alertdialog", { name: "Change to Acolyte?" }).getByRole("button", { name: "Change" }).click();
  // The block of Acolyte takes the place of the list, and the focus goes to its Change button.
  await expect(section(page, "Background").getByRole("heading", { level: 3 })).toHaveText(/^Acolyte/);
  await expect(section(page, "Background").getByRole("button", { name: "Change Background" })).toBeFocused();
  // The Cleric picks its 2 skills again, and Acolyte its 2 languages, with no second skill selection.
  await expect(stepButton(page, "Proficiencies")).toHaveAccessibleName("Proficiencies, 4 picks left");
  await openStep(page, "Proficiencies");
  const skills = section(page, "Skills: Cleric");
  await expect(picksIn(skills)).toHaveCount(0);
  await expect(skills.getByRole("button", { name: "Insight", exact: true })).toBeDisabled();
  await pickIn(skills, "Medicine");
  await expect(picksIn(skills)).toHaveText(["Medicine"]);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/change-question.spec.ts -g orc-344 --trace off
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  const ready = async (page: Page) => {
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
  };

  for (const theme of ["light", "dark"] as const) {
    test(`orc-344 the question before Acolyte, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 1280, height: 900 });
      await clericWithInsightAndReligion(page);
      await pickIn(section(page, "Background"), "Acolyte");
      await expect(page.getByRole("alertdialog", { name: "Change to Acolyte?" })).toBeVisible();
      await ready(page);
      await page.screenshot({ path: join(dir, `orc-344-change-to-acolyte-${theme}.png`) });
    });

    test(`orc-344 the question before a different race, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 1280, height: 900 });
      await newCharacter(page);
      await addFirstClass(page, "Fighter");
      await openStep(page, "Race");
      await pickIn(section(page, "Race"), "Half-Elf");
      await openStep(page, "Proficiencies");
      await pickIn(section(page, "Skills: Half-Elf"), "Perception");
      await pickIn(section(page, "Skills: Half-Elf"), "Stealth");
      await openStep(page, "Abilities");
      const increases = section(page, "Ability Score Increase: Half-Elf");
      await increases.getByRole("button", { name: "Increase Strength" }).click();
      await increases.getByRole("button", { name: "Increase Constitution" }).click();
      await openStep(page, "Race");
      await pickIn(section(page, "Race"), "Dwarf");
      await expect(page.getByRole("alertdialog", { name: "Replace Half-Elf with Dwarf?" })).toBeVisible();
      await ready(page);
      await page.screenshot({ path: join(dir, `orc-344-replace-half-elf-${theme}.png`) });
    });
  }
});
