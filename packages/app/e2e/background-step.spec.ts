// The list with a detail panel and the Background step, in a browser (ORC-347, docs/design/character-builder.md "The
// Background and Race steps", "No layout shift", "Keyboard and screen reader"): the list and the panel keep their size
// while the shown option changes, the search of a pack of more than 20 backgrounds, the focus after a pick, the
// Customize dialog from the block, and the narrow page with the detail in a modal.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { VALE_PACK, valeOrcbrew } from "../src/engine/test-backgrounds.ts";
import { addFirstClass, newCharacter, openStep, pickIn, section } from "./builder-helpers.ts";

/** Loads the pack, then makes a new Fighter and opens the Background step. */
async function fighterWithPack(page: Page) {
  await page.goto("/import");
  await page
    .getByLabel("Load homebrew file")
    .setInputFiles({ name: `${VALE_PACK}.orcbrew`, mimeType: "application/octet-stream", buffer: Buffer.from(valeOrcbrew()) });
  await expect(page.getByRole("region", { name: "Import log" })).toBeVisible();
  await newCharacter(page);
  await addFirstClass(page, "Fighter");
  await openStep(page, "Background");
}

const background = (page: Page) => section(page, "Background");
const list = (page: Page) => background(page).locator(".ui-list-panel-list");
const panel = (page: Page) => background(page).locator(".ui-list-panel-detail");
const row = (page: Page, name: string) => list(page).getByRole("button", { name, exact: true });
const box = async (locator: Locator) => {
  const b = (await locator.boundingBox())!;
  return [b.x, b.y, b.width, b.height];
};

test("the list and the panel keep their size and place while the shown background changes, and nothing above them moves", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await fighterWithPack(page);
  const title = page.getByRole("region", { name: "Builder" }).getByRole("heading", { level: 2 });
  const heading = background(page).getByRole("heading", { level: 3 });
  const before = [await box(list(page)), await box(panel(page)), await box(title), await box(heading)];
  // The sizes of the spec: the list is 250px wide, and the two are 440px high.
  expect(before[0].slice(2)).toEqual([250, 440]);
  expect(before[1][3]).toBe(440);
  for (const name of ["Acolyte", "Weaver", "Night Watch", "Acolyte"]) {
    await row(page, name).click();
    await expect(panel(page).getByRole("heading", { level: 4 })).toHaveText(name);
    // The facts load after the name: measure once they show.
    await expect(panel(page).getByRole("term").first()).toHaveText("Skills");
    expect([await box(list(page)), await box(panel(page)), await box(title), await box(heading)]).toEqual(before);
  }
  // The Choose row stays at the bottom of the panel, inside its 1px border.
  const [, y, , h] = await box(panel(page).locator(".ui-list-panel-act"));
  expect(before[1][1] + before[1][3] - (y + h)).toBe(1);
});

test("a pack of more than 20 backgrounds: the search field has the count, filters, has one line for no result, and a pick works from it", async ({ page }) => {
  await fighterWithPack(page);
  const search = background(page).getByRole("searchbox", { name: "Search" });
  await expect(search).toHaveAttribute("placeholder", "Search 25 backgrounds");
  await expect(list(page).locator(".ui-list-panel-name")).toHaveCount(25);
  await expect(row(page, "Weaver").locator(".ui-list-panel-aside")).toHaveText(VALE_PACK);
  await search.fill("salt");
  await expect(list(page).locator(".ui-list-panel-name")).toHaveText(["Salt Trader"]);
  await search.fill("dragon");
  await expect(list(page).getByText("Nothing matches. Try another word.")).toBeVisible();
  // Down from the search goes to the first row; Enter shows it in the panel.
  await search.fill("pil");
  await search.press("ArrowDown");
  await expect(row(page, "Pilgrim")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(row(page, "Pilgrim")).toHaveAttribute("aria-current", "true");
  await expect(panel(page)).toContainText(`From ${VALE_PACK}`);
  await panel(page).getByRole("button", { name: "Choose Pilgrim" }).click();
  await expect(background(page).getByRole("heading", { level: 3 })).toHaveText(new RegExp(`^Pilgrim${VALE_PACK}`));
});

test("after a pick the focus goes to Change; Change opens the list on the pick, and Cancel puts the block back with the focus on Change", async ({ page }) => {
  await fighterWithPack(page);
  await row(page, "Acolyte").click();
  await panel(page).getByRole("button", { name: "Choose Acolyte" }).click();
  const change = background(page).getByRole("button", { name: "Change Background" });
  await expect(change).toBeFocused();
  await expect(background(page).locator(".ui-list-panel")).toHaveCount(0);
  // The left mark of the step, and the lines to the other steps.
  await expect(background(page).getByRole("heading", { level: 3 })).toHaveText("Acolyte,Done");
  const lines = background(page).getByRole("list", { name: "Picked on other steps" }).getByRole("button");
  expect(await lines.evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label")))).toEqual([
    "Languages, 2 left, Proficiencies",
    "Starting equipment, 2 left, Equipment",
  ]);

  await page.keyboard.press("Enter");
  await expect(background(page).getByRole("heading", { level: 3 })).toHaveText("Background: Acolyte,Done");
  await expect(row(page, "Acolyte")).toBeFocused();
  await expect(row(page, "Acolyte")).toHaveAttribute("data-picked", "");
  await expect(panel(page)).toContainText("The background of this character");
  await background(page).getByRole("button", { name: "Cancel" }).click();
  await expect(change).toBeFocused();

  // A pick from the list of Change replaces the background, with the focus on Change again.
  await pickIn(background(page), "Weaver");
  await expect(background(page).getByRole("heading", { level: 3 })).toHaveText(new RegExp(`^Weaver${VALE_PACK}`));
  await expect(change).toBeFocused();
  // A line of "Picked on other steps" opens its step.
  await background(page).getByRole("button", { name: "Languages, 1 left, Proficiencies" }).click();
  await expect(page.getByRole("region", { name: "Builder" }).getByRole("heading", { level: 2 })).toHaveText("Proficiencies");
});

test("the Customize dialog of a background opens from the block, and its save keeps the focus on the block's button", async ({ page }) => {
  await newCharacter(page);
  await addFirstClass(page, "Fighter");
  await openStep(page, "Background");
  await pickIn(background(page), "Acolyte");
  await expect(page.getByRole("list", { name: "Customize Background" })).toHaveCount(0);
  await background(page).getByRole("button", { name: "Customize Acolyte" }).click();
  const dialog = page.getByRole("dialog", { name: "Customize Acolyte" });
  await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Acolyte (Custom)");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  const edit = background(page).getByRole("button", { name: "Edit custom Acolyte (Custom)" });
  await expect(edit).toBeFocused();
  await expect(background(page).getByRole("heading", { level: 3 })).toHaveText(/^Acolyte \(Custom\)/);
});

test("on a 390px page the list has the full width and 400px, and a tap opens the detail in a modal with Choose", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fighterWithPack(page);
  const [, , width, height] = await box(list(page));
  const [, , sectionWidth] = await box(background(page));
  expect([width, height]).toEqual([sectionWidth, 400]);
  await expect(panel(page)).toBeHidden();
  // No sideways scroll of the page.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await row(page, "Acolyte").click();
  const modal = page.getByRole("dialog", { name: "Acolyte" });
  await expect(modal).toContainText("Your life has been devoted to serving a god or gods.");
  await modal.getByRole("button", { name: "Choose Acolyte" }).click();
  await expect(modal).toBeHidden();
  await expect(background(page).getByRole("button", { name: "Change Background" })).toBeFocused();
});
