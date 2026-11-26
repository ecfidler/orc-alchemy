// The control of a builder selection in a browser (ORC-343, docs/design/character-builder.md "The control for each
// kind of selection", "No layout shift"): a pick in a picker or in a list moves nothing above or below the selection.
import { pickFromPicker } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Page, test } from "@playwright/test";
import { addFirstClass, newCharacter, openStep, pickIn, picksIn, section } from "./builder-helpers.ts";

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
    [builder.querySelector("h2")!, ...builder.querySelectorAll("section"), builder.querySelector(":scope > div:last-child")!].map((e) => {
      const r = e.getBoundingClientRect();
      return [r.x, r.y, r.width, r.height];
    }),
  );

test("a pick in a picker or in a list moves nothing above or below the selection", async ({ page }) => {
  await humanFighter(page);
  const skills = section(page, "Skills: Fighter");
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
