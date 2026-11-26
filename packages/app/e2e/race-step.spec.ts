// The Race step, in a browser (ORC-348, docs/design/character-builder.md "The Background and Race steps", "Custom
// Origin", "No layout shift"): a pick from the list with a detail panel, Draconic Ancestry in Choices, a race with one
// subrace (a fact of the panel) and with two (a Subrace row), the lines of a Half-Elf to other steps, the Custom Origin
// row, the Customize buttons of the block, and the screenshots of the PR.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { addFirstClass, newCharacter, openStep, pickIn, section, startCustomOrigin } from "./builder-helpers.ts";
import { summaryCard } from "./sheet-panel.ts";

const PACK = "Vale of Ash";

/** A pack with a subrace of the SRD Dwarf: with it, the Dwarf has two subraces, Hill Dwarf and Ash Dwarf. */
const ORCBREW = `{:orcpub.dnd.e5/subraces {:ash-dwarf {:key :ash-dwarf :name "Ash Dwarf" :option-pack "${PACK}" :race :dwarf
  :abilities {:orcpub.dnd.e5.character/str 1}}}}`;

/** Makes a new Fighter and opens the Race step; with `pack`, after the load of the pack with Ash Dwarf. */
async function fighterOnRace(page: Page, pack = false) {
  if (pack) {
    await page.goto("/import");
    await page.getByLabel("Load homebrew file").setInputFiles({ name: `${PACK}.orcbrew`, mimeType: "application/octet-stream", buffer: Buffer.from(ORCBREW) });
    await expect(page.getByRole("region", { name: "Import log" })).toBeVisible();
  }
  await newCharacter(page);
  await addFirstClass(page, "Fighter");
  await openStep(page, "Race");
}

const race = (page: Page) => section(page, "Race");
const list = (page: Page) => race(page).locator(".ui-list-panel-list");
const panel = (page: Page) => race(page).locator(".ui-list-panel-detail");
const row = (page: Page, name: string) => list(page).getByRole("button", { name, exact: true });
const heading = (page: Page) => race(page).getByRole("heading", { level: 3 });
const fact = (page: Page, term: string) => panel(page).locator("dt", { hasText: term }).locator("xpath=following-sibling::dd[1]");
const box = async (locator: Locator) => {
  const b = (await locator.boundingBox())!;
  return [b.x, b.y, b.width, b.height];
};

/** Shows the race in the panel, and waits for its facts, which load after the name. */
async function show(page: Page, name: string) {
  await row(page, name).click();
  await expect(panel(page).getByRole("heading", { level: 4 })).toHaveText(name);
  if (name !== "Custom Origin") await expect(panel(page).getByRole("term").first()).toBeVisible();
}

test("a race from the list: the panel shows its facts and traits, and Choose makes the pick, with the focus on Change", async ({ page }) => {
  await fighterOnRace(page);
  await expect(heading(page)).toHaveText("Race,1 left");
  await expect(panel(page)).toHaveText("Select a race to read about it.");
  await show(page, "Tiefling");
  await expect(row(page, "Tiefling")).toHaveAttribute("aria-current", "true");
  await expect(fact(page, "Ability scores")).toHaveText("Charisma +2, Intelligence +1");
  await expect(fact(page, "Size, speed")).toHaveText("Medium, 30 ft.");
  await expect(panel(page)).toContainText("Darkvision.");
  await panel(page).getByRole("button", { name: "Choose Tiefling" }).click();
  await expect(heading(page)).toHaveText("Tiefling,Done");
  await expect(race(page).getByRole("button", { name: "Change Race" })).toBeFocused();
  await expect(race(page).locator(".ui-list-panel")).toHaveCount(0);
  await expect(summaryCard(page).getByLabel("Race", { exact: true })).toHaveText("Tiefling");
  // The Tiefling has no choice: the block has no Choices, and one line says it gives no pick on another step.
  await expect(race(page).getByRole("heading", { name: "Choices" })).toHaveCount(0);
  await expect(race(page)).toContainText("This race gives no pick on another step.");
});

test("Dragonborn: Draconic Ancestry is in Choices with the control of its rule, and a pick there moves nothing above it", async ({ page }) => {
  await fighterOnRace(page);
  await pickIn(race(page), "Dragonborn");
  await expect(heading(page)).toHaveText("Dragonborn,1 left");
  const ancestry = section(page, "Draconic Ancestry");
  await expect(race(page).getByRole("region", { name: "Choices" })).toContainText("Draconic Ancestry");
  // Ten options and one pick: a Choose button that opens a list.
  await expect(ancestry.getByRole("button", { name: "Choose Draconic Ancestry" })).toBeVisible();
  const header = race(page).locator("h3");
  const title = race(page).getByRole("heading", { name: "Choices" });
  const before = [await box(header), await box(title), await box(ancestry.getByRole("heading").first())];
  await pickIn(ancestry, "Red");
  await expect(heading(page)).toHaveText("Dragonborn,Done");
  await expect(ancestry.getByRole("heading").first()).toHaveText("Draconic Ancestry,Done");
  expect([await box(header), await box(title), await box(ancestry.getByRole("heading").first())]).toEqual(before);
});

test("Dwarf with one subrace: the panel shows Hill Dwarf as a fact, and the pick picks it too, with no Subrace row", async ({ page }) => {
  await fighterOnRace(page);
  await show(page, "Dwarf");
  await expect(fact(page, "Subrace")).toHaveText("Hill Dwarf: Wisdom +1");
  await panel(page).getByRole("button", { name: "Choose Dwarf" }).click();
  await expect(heading(page)).toHaveText("Dwarf,Done");
  await expect(page.getByRole("region", { name: /^Subrace/ })).toHaveCount(0);
  await expect(summaryCard(page).getByLabel("Race", { exact: true })).toHaveText("Dwarf (Hill Dwarf)");
  // The tool of the Dwarf is a line to Proficiencies.
  await expect(race(page).getByRole("button", { name: "Tools, 1 left, Proficiencies" })).toBeVisible();
});

test("Dwarf with two subraces (a pack subrace): no Subrace fact, and a Subrace row in Choices after the pick", async ({ page }) => {
  await fighterOnRace(page, true);
  await show(page, "Dwarf");
  await expect(panel(page).getByRole("term")).toHaveText(["Ability scores", "Size, speed", "Languages"]);
  await panel(page).getByRole("button", { name: "Choose Dwarf" }).click();
  await expect(heading(page)).toHaveText("Dwarf,1 left");
  const subrace = section(page, "Subrace");
  await expect(subrace.getByRole("button")).toHaveText(["Ash Dwarf", "Hill Dwarf"]);
  await pickIn(subrace, "Ash Dwarf");
  await expect(heading(page)).toHaveText("Dwarf,Done");
  await expect(summaryCard(page).getByLabel("Race", { exact: true })).toHaveText("Dwarf (Ash Dwarf)");
});

test("Half-Elf: three lines to other steps, and a line opens its step", async ({ page }) => {
  await fighterOnRace(page);
  await show(page, "Half-Elf");
  await expect(fact(page, "Ability scores")).toHaveText("Charisma +2; +1 to two of your choice");
  await expect(fact(page, "Languages")).toHaveText("Common, Elvish; One of your choice");
  await panel(page).getByRole("button", { name: "Choose Half-Elf" }).click();
  const lines = race(page).getByRole("list", { name: "Picked on other steps" }).getByRole("button");
  expect(await lines.evaluateAll((buttons) => buttons.map((b) => b.getAttribute("aria-label")))).toEqual([
    "Ability scores, 2 left, Abilities",
    "Skills, 2 left, Proficiencies",
    "Languages, 1 left, Proficiencies",
  ]);
  await race(page).getByRole("button", { name: "Ability scores, 2 left, Abilities" }).click();
  await expect(page.getByRole("region", { name: "Builder" }).getByRole("heading", { level: 2 })).toHaveText("Abilities");
  await openStep(page, "Race");
  await race(page).getByRole("button", { name: "Skills, 2 left, Proficiencies" }).click();
  await expect(page.getByRole("region", { name: "Builder" }).getByRole("heading", { level: 2 })).toHaveText("Proficiencies");
});

test("the list and the panel keep their size while the shown race changes, also for the Custom Origin row, and nothing above them moves", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await fighterOnRace(page);
  const title = page.getByRole("region", { name: "Builder" }).getByRole("heading", { level: 2 });
  const before = [await box(list(page)), await box(panel(page)), await box(title), await box(heading(page))];
  expect(before[0].slice(2)).toEqual([250, 440]);
  expect(before[1][3]).toBe(440);
  for (const name of ["Dwarf", "Half-Elf", "Custom Origin", "Human", "Dragonborn"]) {
    await show(page, name);
    expect([await box(list(page)), await box(panel(page)), await box(title), await box(heading(page))]).toEqual(before);
  }
  // The Custom Origin row is the last, below the rows that scroll.
  const rows = await box(race(page).locator(".ui-list-panel-rows"));
  const fixed = await box(row(page, "Custom Origin"));
  expect(fixed[1]).toBeGreaterThanOrEqual(rows[1] + rows[3]);
});

test("Custom Origin: the fixed row says what it is, its button opens the dialog, and the block of the copy shows Edit custom origin", async ({ page }) => {
  await fighterOnRace(page);
  await show(page, "Custom Origin");
  await expect(panel(page)).toContainText("A custom origin is not saved to your homebrew content.");
  await expect(row(page, "Custom Origin").locator("svg")).toHaveCount(1);
  await startCustomOrigin(race(page));
  const dialog = page.getByRole("dialog", { name: "Custom Origin" });
  await pickOptionIn(page, dialog.getByRole("combobox", { name: "Base race" }), "Half-Orc");
  await pickOptionIn(page, dialog.getByRole("combobox", { name: "+2 bonus, Half-Orc gives Strength" }), "Dexterity");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  const edit = race(page).getByRole("button", { name: "Edit custom origin Half-Orc (Custom Origin)" });
  await expect(edit).toBeFocused();
  await expect(edit).toHaveText("Edit custom origin");
  await expect(heading(page)).toHaveText(/^Half-Orc \(Custom Origin\)/);
});

test("Customize of a race opens from the block, and the block of the copy shows Edit custom", async ({ page }) => {
  await fighterOnRace(page);
  await pickIn(race(page), "Dwarf");
  await race(page).getByRole("button", { name: "Customize Dwarf" }).click();
  const dialog = page.getByRole("dialog", { name: "Customize Dwarf" });
  await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Dwarf (Custom)");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  const edit = race(page).getByRole("button", { name: "Edit custom Dwarf (Custom)" });
  await expect(edit).toBeFocused();
  await expect(edit).toHaveText("Edit custom");
});

/** Picks the option of a select (a combobox) with the mouse. */
async function pickOptionIn(page: Page, select: Locator, name: string) {
  await select.click();
  await page.getByRole("option", { name, exact: true }).click();
  await expect(select).toHaveText(name);
}

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/race-step.spec.ts -g orc-348 --trace off
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  const ready = async (page: Page) => {
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
  };
  const step = (page: Page) => page.getByRole("region", { name: "Builder" });

  for (const theme of ["light", "dark"])
    for (const width of [1280, 390]) {
      const size = width === 390 ? "390" : "desktop";
      test(`orc-348 the Race step, ${size}, ${theme}`, async ({ page }) => {
        mkdirSync(dir, { recursive: true });
        const shot = (locator: Locator, what: string) =>
          locator.screenshot({ path: join(dir, `orc-348-${what}-${size}-${theme}.png`), animations: "disabled" });
        const full = (what: string) => page.screenshot({ path: join(dir, `orc-348-${what}-${size}-${theme}.png`), animations: "disabled" });
        await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
        await page.setViewportSize({ width, height: 900 });
        await fighterOnRace(page);
        await ready(page);
        if (width === 390) {
          await shot(step(page), "list");
          await row(page, "Dwarf").click();
          const modal = page.getByRole("dialog", { name: "Dwarf" });
          await expect(modal.getByRole("term").first()).toHaveText("Ability scores");
          await ready(page);
          await full("race-modal");
          await modal.getByRole("button", { name: "Cancel" }).click();
          await row(page, "Custom Origin").click();
          const origin = page.getByRole("dialog", { name: "Custom Origin" });
          await expect(origin).toContainText("A custom origin is not saved to your homebrew content.");
          await ready(page);
          await full("custom-origin");
          await origin.getByRole("button", { name: "Cancel" }).click();
        } else {
          await show(page, "Dwarf");
          await ready(page);
          await shot(step(page), "list-panel");
          await show(page, "Custom Origin");
          await ready(page);
          await shot(step(page), "custom-origin");
        }
        // The Half-Elf first: it has no pick on this step, so the change to Dragonborn asks nothing.
        await pickIn(race(page), "Half-Elf");
        await expect(heading(page)).toHaveText(/^Half-Elf/);
        await ready(page);
        await shot(step(page), "block-half-elf");
        await pickIn(race(page), "Dragonborn");
        await expect(section(page, "Draconic Ancestry")).toBeVisible();
        await ready(page);
        await shot(step(page), "block-dragonborn");
      });
    }
});
