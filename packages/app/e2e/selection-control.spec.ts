// The control of a builder selection in a browser (ORC-343, docs/design/character-builder.md "The control for each
// kind of selection", "No layout shift"): a pick in a picker or in a list moves nothing above or below the selection.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pickFromPicker } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Page, test } from "@playwright/test";
import { addFirstClass, listOpener, newCharacter, openStep, pickIn, picksIn, section } from "./builder-helpers.ts";

/** A new human fighter on the Proficiencies step: 2 skills of 8 in a picker, and 1 language of 16 in a list. */
async function humanFighter(page: Page) {
  await newCharacter(page);
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Human");
  await addFirstClass(page, "Fighter");
  await openStep(page, "Proficiencies");
}

/** The box of each section of the step, of the step title and of the row of Back and Next, as [x, y, width, height]. */
const boxes = (page: Page) =>
  page.getByRole("region", { name: "Builder" }).evaluate((builder) =>
    [builder.querySelector("h2")!, ...builder.querySelectorAll(":scope > section"), builder.querySelector(":scope > div:last-child")!].map((e) => {
      const r = e.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    }),
  );

test("a pick in a picker or in a list moves nothing above or below the selection", async ({ page }) => {
  await humanFighter(page);
  const skills = section(page, "Skill Proficiency");
  const languages = section(page, "Languages");
  await expect(skills.getByRole("button", { name: "Add a skill" })).toBeVisible();
  await expect(languages.getByRole("button", { name: "Choose Languages" })).toBeVisible();
  const before = await boxes(page);
  expect(before.length).toBeGreaterThan(3);

  // The first token, then the second: the token line keeps its place, so the add button and the page below stay.
  const add = skills.getByRole("button", { name: "Add a skill" });
  const addBox = await add.boundingBox();
  await pickFromPicker(add, "Athletics");
  await expect(picksIn(skills)).toHaveText(["Athletics"]);
  expect(await boxes(page)).toEqual(before);
  expect(await add.boundingBox()).toEqual(addBox);
  await pickFromPicker(add, "Perception");
  await expect(picksIn(skills)).toHaveText(["Athletics", "Perception"]);
  expect(await boxes(page)).toEqual(before);
  expect(await add.boundingBox()).toEqual(addBox);

  // Choose, then the pick and Change in its place: the row keeps its height.
  await pickIn(languages, "Dwarvish");
  await expect(picksIn(languages)).toHaveText(["Dwarvish"]);
  await expect(languages.getByRole("button", { name: "Change Languages" })).toBeFocused();
  expect(await boxes(page)).toEqual(before);

  // An X takes a token out: nothing moves either.
  await skills.getByRole("button", { name: "Remove Athletics" }).click();
  await expect(picksIn(skills)).toHaveText(["Perception"]);
  expect(await boxes(page)).toEqual(before);
});

test("the list of one pick works with the keyboard, and a locked row cannot be picked", async ({ page }) => {
  await humanFighter(page);
  const languages = section(page, "Languages");
  const choose = languages.getByRole("button", { name: "Choose Languages" });
  await choose.focus();
  await expect(choose).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Languages" });
  // The focus is on the first row at the open.
  await expect(dialog.locator(".ui-list-row").first()).toBeFocused();
  // The human speaks Common: its row is locked, with the source as the reason. Enter on it picks nothing.
  const common = dialog.getByRole("button", { name: "Common", exact: true });
  await expect(common).toHaveAttribute("aria-disabled", "true");
  await expect(common).toContainText("From Human");
  await common.focus();
  await expect(common).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  // The arrow keys move on from the locked row, and Enter picks.
  await page.keyboard.press("ArrowDown");
  const next = dialog.locator(".ui-list-row:focus");
  await expect(next).not.toHaveAttribute("aria-disabled", "true");
  const name = await next.getAttribute("aria-label");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(picksIn(languages)).toHaveText([name!]);
  await expect(languages.getByRole("button", { name: "Change Languages" })).toBeFocused();
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/selection-control.spec.ts -g orc-343 --trace off
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  const ready = async (page: Page) => {
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
  };

  /** A half-elf acolyte barbarian on the Proficiencies step, with Perception picked for the half-elf. */
  async function halfElfBarbarian(page: Page, theme: string) {
    await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await newCharacter(page);
    await addFirstClass(page, "Barbarian");
    await openStep(page, "Race");
    await pickIn(section(page, "Race"), "Half-Elf");
    await openStep(page, "Background");
    await pickIn(section(page, "Background"), "Acolyte");
    await openStep(page, "Proficiencies");
    await pickIn(section(page, "Skill Proficiency: Half-Elf"), "Perception");
  }

  for (const theme of ["light", "dark"] as const) {
    test(`orc-343 option cards with an option that is not available, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await halfElfBarbarian(page, theme);
      const cards = section(page, "Skill Proficiency: Barbarian");
      await expect(cards.getByRole("button", { name: "Perception" })).toBeDisabled();
      await ready(page);
      await cards.screenshot({ path: join(dir, `orc-343-cards-not-available-${theme}.png`) });
    });

    test(`orc-343 a picker with tokens and its list with a locked row, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await halfElfBarbarian(page, theme);
      const picker = section(page, "Skill Proficiency: Half-Elf");
      await expect(picksIn(picker)).toHaveText(["Perception"]);
      await ready(page);
      await picker.screenshot({ path: join(dir, `orc-343-picker-tokens-${theme}.png`) });
      await listOpener(picker).click();
      await expect(page.getByRole("dialog").getByRole("button", { name: "Insight", exact: true })).toContainText("From Acolyte");
      await ready(page);
      await page.screenshot({ path: join(dir, `orc-343-picker-list-locked-${theme}.png`) });
    });

    test(`orc-343 a Choose row, its list, and the row after the pick with Change, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 1280, height: 900 });
      await humanFighter(page);
      const languages = section(page, "Languages");
      await ready(page);
      await languages.screenshot({ path: join(dir, `orc-343-choose-before-${theme}.png`) });
      await languages.getByRole("button", { name: "Choose Languages" }).click();
      await expect(page.getByRole("dialog").getByRole("button", { name: "Common", exact: true })).toContainText("From Human");
      await ready(page);
      await page.screenshot({ path: join(dir, `orc-343-choose-list-${theme}.png`) });
      await page.getByRole("dialog").getByRole("button", { name: "Dwarvish", exact: true }).click();
      await expect(languages.getByRole("button", { name: "Change Languages" })).toBeVisible();
      await ready(page);
      await languages.screenshot({ path: join(dir, `orc-343-choose-after-${theme}.png`) });
    });

    test(`orc-343 flat sections after a pick, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 1280, height: 900 });
      await newCharacter(page);
      await addFirstClass(page, "Fighter");
      await openStep(page, "Race");
      await pickIn(section(page, "Race"), "Human");
      await expect(section(page, "Subrace")).toBeVisible();
      await ready(page);
      await page.getByRole("region", { name: "Builder" }).screenshot({ path: join(dir, `orc-343-flat-sections-${theme}.png`) });
    });
  }
});
