// Helpers for the e2e specs that make a new character in the builder (ORC-342): a new character has no class, and
// it opens on the Name step.
import { join } from "node:path";
import { pickFromPicker } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Locator, type Page } from "@playwright/test";

/** The ten steps of the builder, in the order of the rail. */
export const STEPS = ["Name", "Class", "Background", "Race", "Abilities", "Proficiencies", "Feats", "Spells", "Equipment", "Description"];

/** The part of the page that holds the open step: the step title, its sections, Back and Next. */
export const builder = (page: Page) => page.getByRole("region", { name: "Builder" });

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

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

/** Imports the fixture character of fixtures/characters and opens it in the builder on the step. */
export async function openFixture(page: Page, fixture: string, step: string) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, `${fixture}.strict.json`));
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await openStep(page, step);
}

/** The class card `name` in `scope` (ORC-349). */
export const classCard = (scope: Locator, name: string) => scope.locator("[data-class-card]").and(scope.getByRole("button", { name, exact: true }));

/**
 * Picks the first class of a character with no class on the open Class step (ORC-349): a click on its card opens its
 * modal, and "Choose {name}" picks it. Its Vitest twin is chooseFirstClass in src/components/test-pick.ts.
 */
export async function chooseClass(page: Page, name: string) {
  await classCard(builder(page), name).click();
  await page
    .getByRole("dialog", { name, exact: true })
    .getByRole("button", { name: `Choose ${name}`, exact: true })
    .click();
  await expect(builder(page).getByRole("button", { name: `Change ${name}`, exact: true })).toBeVisible();
}

/** Opens the Class step of a character with no class, and adds its first class (chooseClass). */
export async function addFirstClass(page: Page, name: string) {
  await openStep(page, "Class");
  await chooseClass(page, name);
}

/**
 * Starts the change of the class `from` to `to` on the Class step (ORC-349): Change of its block opens the class cards
 * in a dialog, a click on a card opens its modal, and "Change to {to}" makes the change, or asks first. Its Vitest twin
 * is changeClass in src/components/test-pick.ts.
 */
export async function changeClass(page: Page, from: string, to: string) {
  await page
    .getByRole("region", { name: "Builder" })
    .getByRole("button", { name: `Change ${from}`, exact: true })
    .click();
  await classCard(page.getByRole("dialog", { name: `Change ${from}` }), to).click();
  await page.getByRole("button", { name: `Change to ${to}`, exact: true }).click();
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

/** The head of a choice row of the Class step (ORC-350): the button that opens and closes it. */
export const rowHead = (row: Locator) => row.locator("h5 > [aria-expanded]");

/**
 * Picks the subclass `name` in the subclass row `scope` (ORC-350): Choose or Change opens the subclass dialog, a click
 * on the name shows the subclass in the panel, or in a modal on a narrow page, and "Choose {name}" picks it. Its
 * Vitest twin is pickSubclass in src/components/test-pick.ts.
 */
export async function pickSubclass(scope: Locator, name: string) {
  await listOpener(scope).click();
  const page = scope.page();
  await page.locator(".ui-list-panel").getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: `Choose ${name}`, exact: true }).click();
}

/**
 * Picks the option `name` in the selection of `scope` (its section), by its control (ORC-343): a click on its option
 * card, a pick in the list with a detail panel of a main pick (ORC-347), a pick in the subclass dialog (ORC-350), or a
 * pick in the list that its Choose, Change or add button opens. A closed choice row of the Class step opens first. Its
 * Vitest twin is pickIn in src/components/test-pick.ts.
 */
export async function pickIn(scope: Locator, name: string) {
  await expect(scope.getByRole("heading").first()).toBeVisible();
  if ((await scope.getAttribute("data-main-pick")) !== null) {
    await pickInList(scope, name);
    return;
  }
  const row = await scope.getAttribute("data-choice-row");
  if (row !== null && (await rowHead(scope).getAttribute("aria-expanded")) === "false") await rowHead(scope).click();
  if (row === "subclass") {
    await pickSubclass(scope, name);
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

/**
 * Adds the class `name` as a second class on the Class step (ORC-351): "Add a class" opens the class cards in a dialog,
 * a click on a card opens its modal, and "Add {name}" adds it. Its Vitest twin is addClass in
 * src/components/test-pick.ts.
 */
export async function addClass(page: Page, name: string) {
  const builder = page.getByRole("region", { name: "Builder" });
  await builder.getByRole("button", { name: "Add a class", exact: true }).click();
  await classCard(page.getByRole("dialog", { name: "Add a class" }), name).click();
  await page
    .getByRole("dialog", { name, exact: true })
    .getByRole("button", { name: `Add ${name}`, exact: true })
    .click();
  await expect(builder.getByRole("button", { name: `Change ${name}`, exact: true })).toBeVisible();
}

/**
 * Starts Remove of the class `name` on the Class step (ORC-351): the Remove button of its block, which removes the class
 * or asks first. Its Vitest twin is removeClass in src/components/test-pick.ts.
 */
export async function removeClass(page: Page, name: string) {
  await page
    .getByRole("region", { name: "Builder" })
    .getByRole("button", { name: `Remove ${name}`, exact: true })
    .click();
}

/** The section Hit points of the block of the class `name` (ORC-351). */
export const hitPointsOf = (page: Page, name: string) =>
  page
    .getByRole("region", { name: "Builder" })
    .getByRole("region", { name, exact: true })
    .getByRole("region", { name: /^Hit points/ });

/** The total of the section Hit points of the class `name` (ORC-351), as a locator for toHaveText. */
export const hitPointsTotal = (page: Page, name: string) => hitPointsOf(page, name).locator("[data-hit-points-total]");

/** Sets the method of the hit points of the class `name`: "Average" or "By level" (ORC-351). Its Vitest twin is in test-pick.ts. */
export async function setHitPointsMethod(page: Page, name: string, method: "Average" | "By level") {
  await page
    .getByRole("group", { name: `${name} hit point method` })
    .getByRole("button", { name: method, exact: true })
    .click();
}

/** The number field of the hit points of a level of the class `name`, By level (ORC-351). */
export const levelHitPoints = (page: Page, name: string, level: number) =>
  page.getByRole("textbox", { name: `${name} level ${level} hit points`, exact: true });

/**
 * Adds the spells `names` to the spell selection `name` of the Spells step (ORC-357): "Add spells" opens the popup of
 * the selection, a click on the box of each spell adds it, and Done closes the popup. Its Vitest twin is the openPopup
 * and box pair of src/components/Spells.test.tsx.
 */
export async function addSpells(page: Page, name: string, names: string[]) {
  await section(page, name)
    .getByRole("button", { name: `Add spells: ${name}`, exact: true })
    .click();
  const popup = page.getByRole("dialog", { name, exact: true });
  for (const spell of names) await popup.getByRole("checkbox", { name: `Chosen: ${spell}`, exact: true }).click();
  await popup.getByRole("button", { name: "Done", exact: true }).click();
  await expect(popup).toHaveCount(0);
}
