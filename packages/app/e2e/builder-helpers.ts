// Helpers for the e2e specs that make a new character in the builder (ORC-342): a new character has no class, and
// it opens on the Name step.
import { pickFromPicker, pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

/** A step button of the rail. Its name ends with its count of picks left, when it has some: "Class, 2 picks left". */
export const stepButton = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: new RegExp(`^${name}(, .*)?$`) });

/** Opens a step of the builder with the rail, and waits for its title. */
export async function openStep(page: Page, name: string) {
  await stepButton(page, name).click();
  await expect(page.getByRole("region", { name: "Builder" }).getByRole("heading", { level: 2 })).toHaveText(name);
}

/** Makes a new character from the home page, and waits for the builder on its Name step. */
export async function newCharacter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+\?step=Name$/);
  await expect(page.getByRole("region", { name: "Builder" }).getByRole("heading", { level: 2 })).toHaveText("Name");
}

/** Opens the Class step of a character with no class, and adds its first class. */
export async function addFirstClass(page: Page, name: string) {
  await openStep(page, "Class");
  const builder = page.getByRole("region", { name: "Builder" });
  await pickOption(builder.getByLabel("Add a class", { exact: true }), name);
  await builder.getByRole("button", { name: "Add class" }).click();
  await expect(builder.getByLabel("Class 1", { exact: true })).toHaveText(name);
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The section of the builder whose heading starts with `name`, such as "Race" or "Skill Proficiency: Fighter". */
export const section = (page: Page, name: string) =>
  page
    .getByRole("region", { name: "Builder" })
    .getByRole("region", { name: new RegExp(`^${escape(name)}`) })
    .first();

/** The button that opens the list of a selection (ORC-343): Choose or Change of a list, or the add button of a picker. */
export const listOpener = (scope: Locator) =>
  scope
    .getByRole("button", { name: /^(Choose|Change) / })
    .or(scope.locator(".ui-add-button"))
    .first();

/** The Change button of the block of a main pick, "Change Race": a Change button in its Choices has another name. */
export const changeOf = async (scope: Locator) => scope.getByRole("button", { name: `Change ${await scope.getAttribute("aria-label")}`, exact: true });

/**
 * Picks the option `name` in the list with a detail panel of a main pick (ORC-347), such as the background: Change
 * opens the list again after a pick, then a click on the row shows the option in the panel, or in a modal on a narrow
 * page, and "Choose {name}" picks it. Its Vitest twin is pickInList in src/components/test-pick.ts.
 */
export async function pickInList(scope: Locator, name: string) {
  const list = scope.locator(".ui-list-panel");
  if ((await list.count()) === 0) await (await changeOf(scope)).click();
  await list.getByRole("button", { name, exact: true }).click();
  // The panel, or the modal of a narrow page: the hidden panel is not in the page's roles.
  await scope
    .page()
    .getByRole("button", { name: `Choose ${name}`, exact: true })
    .click();
}

/**
 * Picks the option `name` in the selection of `scope` (its section), by its control (ORC-343): a click on its option
 * card, a pick in the list with a detail panel of a main pick (ORC-347), or a pick in the list that its Choose, Change
 * or add button opens. Its Vitest twin is pickIn in src/components/test-pick.ts.
 */
export async function pickIn(scope: Locator, name: string) {
  await expect(scope.getByRole("heading").first()).toBeVisible();
  if ((await scope.getAttribute("data-main-pick")) !== null) {
    await pickInList(scope, name);
    return;
  }
  const card = scope.locator("[aria-pressed]").and(scope.getByRole("button", { name, exact: true }));
  if ((await card.count()) > 0) {
    await card.click();
    return;
  }
  await pickFromPicker(listOpener(scope), name);
}

/**
 * The picks that a selection's control shows: its pressed option cards, its tokens, and the name in the block of a
 * main pick (ORC-348), as a locator for toHaveText.
 */
export const picksIn = (scope: Locator) => scope.locator('[aria-pressed="true"], .ui-token-label, [data-pick-name]');

/**
 * Opens the Custom Origin dialog from the fixed last row of the race list (ORC-348): Change opens the list after a
 * pick, a click on the row shows its panel, or its modal on a narrow page, and "Start a custom origin" opens the
 * dialog. Its Vitest twin is startCustomOrigin in src/components/test-pick.ts.
 */
export async function startCustomOrigin(race: Locator) {
  if ((await race.locator(".ui-list-panel").count()) === 0) await (await changeOf(race)).click();
  await race.getByRole("button", { name: "Custom Origin", exact: true }).click();
  await race.page().getByRole("button", { name: "Start a custom origin", exact: true }).click();
}
