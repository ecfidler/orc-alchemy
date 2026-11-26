// The end-to-end pass of the builder (ORC-353, docs/design/character-builder.md): a new character goes through the ten
// steps in order with Next and reaches the sheet with "Go to the sheet"; the path of the ORC-329 research, a Cleric
// that takes Acolyte, asks the question and has no dead end; the keyboard and screen reader rules of "Keyboard and
// screen reader"; and the screenshots of each step for the PR.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Page, test } from "@playwright/test";
import { classCard, newCharacter, openStep, pickIn, picksIn, rowHead, section, stepButton } from "./builder-helpers.ts";

const STEPS = ["Name", "Class", "Background", "Race", "Abilities", "Proficiencies", "Feats", "Spells", "Equipment", "Description"];
const builder = (page: Page) => page.getByRole("region", { name: "Builder" });
const title = (page: Page) => builder(page).getByRole("heading", { level: 2 });

/** Next, from the open step to the step `to`: the focus goes to the title of `to` (spec, "Keyboard and screen reader"). */
async function next(page: Page, to: string) {
  await builder(page)
    .getByRole("button", { name: `Next: ${to}`, exact: true })
    .click();
  await expect(title(page)).toHaveText(to);
  await expect(title(page)).toBeFocused();
  await expect(builder(page).getByText(`Step ${STEPS.indexOf(to) + 1} of 10`, { exact: true })).toBeVisible();
}

/** Picks the class `name` from its card and its modal on the open Class step. */
async function chooseClass(page: Page, name: string) {
  await classCard(builder(page), name).click();
  await page
    .getByRole("dialog", { name, exact: true })
    .getByRole("button", { name: `Choose ${name}`, exact: true })
    .click();
  await expect(builder(page).getByRole("button", { name: `Change ${name}`, exact: true })).toBeFocused();
}

/** Each step button of the rail has the name of its step only: no step has a pick left. */
async function expectNoPickLeft(page: Page) {
  const buttons = page.getByRole("navigation", { name: "Steps" }).getByRole("button");
  await expect(buttons).toHaveCount(10);
  for (const [i, name] of STEPS.entries()) await expect(buttons.nth(i)).toHaveAccessibleName(name);
}

test("a new character goes through the ten steps in order with Next, makes each pick, and reaches the sheet", async ({ page }) => {
  await newCharacter(page);
  await expect(builder(page).getByRole("textbox", { name: "Character name" })).toBeFocused();
  await page.keyboard.type("Brannor Ironfist");

  await next(page, "Class");
  await chooseClass(page, "Fighter");
  await pickIn(section(page, "Fighting Style"), "Defense");

  await next(page, "Background");
  await pickIn(section(page, "Background"), "Acolyte");
  await expect(section(page, "Background").getByRole("button", { name: "Change Background" })).toBeFocused();

  await next(page, "Race");
  await pickIn(section(page, "Race"), "Dwarf");
  await expect(section(page, "Race").getByRole("button", { name: "Change Race" })).toBeFocused();

  // The standard scores are the default: the Abilities step has no pick left.
  await next(page, "Abilities");
  await expect(stepButton(page, "Abilities")).toHaveAccessibleName("Abilities");

  await next(page, "Proficiencies");
  for (const skill of ["Athletics", "Perception"]) await pickIn(section(page, "Skills: Fighter"), skill);
  for (const language of ["Elvish", "Giant"]) await pickIn(section(page, "Languages"), language);
  await pickIn(section(page, "Tools: Dwarf"), "Smith's Tools");
  await expect(stepButton(page, "Proficiencies")).toHaveAccessibleName("Proficiencies");

  // A fighter 1 dwarf acolyte has no feat and no spell: the two steps are dimmed, and Next goes through them.
  await next(page, "Feats");
  await expect(builder(page).getByText("This character has no feat to pick.")).toBeVisible();
  await next(page, "Spells");
  await expect(builder(page).getByText("This character has no spell to pick.")).toBeVisible();

  await next(page, "Equipment");
  for (const name of ["Chain Mail", "Martial Weapon and Shield", "Two Handaxes", "Dungeoneer's Pack", "Amulet", "Prayer Book"])
    await builder(page).getByRole("button", { name, exact: true }).click();
  await pickIn(section(page, "Starting Equipment: Martial Weapon"), "Longsword");
  await expect(stepButton(page, "Equipment")).toHaveAccessibleName("Equipment");

  await next(page, "Description");
  await pickOption(builder(page).getByRole("combobox", { name: /^Alignment/ }), "Lawful Good");
  await expectNoPickLeft(page);
  await expect(builder(page).getByRole("button", { name: /^Next/ })).toHaveCount(0);

  await builder(page).getByRole("link", { name: "Go to the sheet" }).click();
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await expect(page.getByRole("region", { name: "Builder" })).toHaveCount(0);
  await expect(page.getByLabel("Class", { exact: true })).toHaveText("Fighter 1");
  await expect(page.getByLabel("Background", { exact: true })).toHaveText("Acolyte");
  await expect(page.getByLabel("Race", { exact: true })).toHaveText("Dwarf (Hill Dwarf)");
  // Edit opens Class when no step has a mark (spec, "The step that opens").
  await page.getByRole("link", { name: "Edit" }).click();
  await expect(title(page)).toHaveText("Class");
});

test("the path of the research: a Cleric with Insight and Religion takes Acolyte, the question asks, and the character has no dead end", async ({ page }) => {
  await newCharacter(page);
  await next(page, "Class");
  await chooseClass(page, "Cleric");
  await pickIn(section(page, "Divine Domain"), "Life Domain");
  for (const step of ["Background", "Race", "Abilities", "Proficiencies"]) await next(page, step);
  const skills = section(page, "Skills: Cleric");
  await pickIn(skills, "Insight");
  await pickIn(skills, "Religion");
  await expect(picksIn(skills)).toHaveText(["Insight", "Religion"]);

  // Back to the Background step: Acolyte gives Insight and Religion. The question lists the two picks first.
  for (const step of ["Abilities", "Race", "Background"]) {
    await builder(page).getByRole("button", { name: "Back", exact: true }).click();
    await expect(title(page)).toHaveText(step);
    await expect(title(page)).toBeFocused();
  }
  await pickIn(section(page, "Background"), "Acolyte");
  const question = page.getByRole("alertdialog", { name: "Change to Acolyte?" });
  await expect(question.getByRole("term")).toHaveText(["Proficiencies"]);
  await expect(question.getByRole("definition")).toHaveText(["Skills: Insight, Religion"]);
  await question.getByRole("button", { name: "Change", exact: true }).click();
  await expect(question).toHaveCount(0);
  await expect(section(page, "Background").getByRole("button", { name: "Change Background" })).toBeFocused();

  // No dead end: the Cleric picks 2 other skills, and Acolyte its 2 languages.
  await expect(stepButton(page, "Proficiencies")).toHaveAccessibleName("Proficiencies, 4 picks left");
  await next(page, "Race");
  await pickIn(section(page, "Race"), "Dwarf");
  await next(page, "Abilities");
  await next(page, "Proficiencies");
  await expect(picksIn(skills)).toHaveCount(0);
  await expect(skills.getByRole("button", { name: "Insight", exact: true })).toBeDisabled();
  for (const skill of ["Medicine", "Persuasion"]) await pickIn(skills, skill);
  for (const language of ["Elvish", "Giant"]) await pickIn(section(page, "Languages"), language);
  await pickIn(section(page, "Tools: Dwarf"), "Smith's Tools");
  await expect(stepButton(page, "Proficiencies")).toHaveAccessibleName("Proficiencies");
  await openStep(page, "Description");
  await builder(page).getByRole("link", { name: "Go to the sheet" }).click();
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  // The URL changes before the page does, and the rail has a Class button too.
  await expect(page.getByRole("region", { name: "Builder" })).toHaveCount(0);
  await expect(page.getByLabel("Class", { exact: true })).toHaveText("Cleric 1 (Life Domain)");
  await expect(page.getByLabel("Background", { exact: true })).toHaveText("Acolyte");
});

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

/** Imports the fixture character and opens it in the builder on the step. */
async function openFixture(page: Page, fixture: string, step: string) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, `${fixture}.strict.json`));
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await openStep(page, step);
}

/**
 * Opens a dialog or a modal with Enter on `opener`, and closes it with Escape (spec, "Keyboard and screen reader"): at the
 * open the focus is in the dialog, and at the close it goes back to the opener.
 */
async function openAndClose(page: Page, opener: ReturnType<Page["getByRole"]>, dialog: string | RegExp) {
  await opener.focus();
  await page.keyboard.press("Enter");
  const box = page.getByRole("dialog", { name: dialog });
  await expect(box).toBeVisible();
  await expect.poll(() => box.evaluate((d) => d.contains(document.activeElement)), `the focus is in the dialog ${dialog}`).toBe(true);
  await page.keyboard.press("Escape");
  await expect(box).toHaveCount(0);
  await expect(opener).toBeFocused();
}

test("each dialog and modal of the builder gets the focus at the open, and gives it back to its opener at the close", async ({ page }) => {
  // fighter-3-wizard-2: Corvin Half-Elven, a half-elf acolyte, with a Champion and a School of Evocation.
  await openFixture(page, "fighter-3-wizard-2", "Class");
  const b = builder(page);
  await openAndClose(
    page,
    classCard(b, "Fighter")
      .or(b.getByRole("button", { name: "About Fighter", exact: true }))
      .first(),
    "Fighter",
  );
  await openAndClose(page, b.getByRole("button", { name: "Change Fighter", exact: true }), "Change Fighter");
  await openAndClose(page, b.getByRole("button", { name: "Add a class", exact: true }), "Add a class");
  // The subclass row has its pick made, so it is closed: Enter on its head opens it, and the focus stays on the head.
  const archetype = section(page, "Martial Archetype");
  await rowHead(archetype).focus();
  await page.keyboard.press("Enter");
  await expect(rowHead(archetype)).toHaveAttribute("aria-expanded", "true");
  await expect(rowHead(archetype)).toBeFocused();
  await openAndClose(page, archetype.getByRole("button", { name: /^(Choose|Change) / }), /Martial Archetype/);

  await openStep(page, "Background");
  await openAndClose(page, b.getByRole("button", { name: "About Acolyte", exact: true }), "Acolyte");
  await openAndClose(page, b.getByRole("button", { name: /^(Customize|Edit custom)/ }).first(), /Acolyte/);

  await openStep(page, "Race");
  await openAndClose(page, b.getByRole("button", { name: "About Half-Elf", exact: true }), "Half-Elf");

  await openStep(page, "Proficiencies");
  await openAndClose(page, section(page, "Skills: Half-Elf").locator(".ui-add-button"), /skill/i);

  await openAndClose(page, page.getByRole("button", { name: "Open the full sheet" }), "Sheet");
});

test("the rail is a list of buttons in a nav named Steps; a mark is part of the name of its step and of its heading", async ({ page }) => {
  await newCharacter(page);
  const nav = page.getByRole("navigation", { name: "Steps" });
  await expect(nav.getByRole("list").getByRole("listitem")).toHaveCount(10);
  await expect(nav.getByRole("listitem").getByRole("button")).toHaveCount(10);
  await expect(stepButton(page, "Name")).toHaveAttribute("aria-current", "step");
  await expect(stepButton(page, "Class")).toHaveAccessibleName("Class, 1 pick left");
  await next(page, "Class");
  await expect(stepButton(page, "Class")).toHaveAttribute("aria-current", "step");
  await expect(stepButton(page, "Name")).not.toHaveAttribute("aria-current");
  await expect(builder(page).getByRole("heading", { name: "Class, 1 left", exact: true })).toBeVisible();
  // A refusal of the engine shows in the status toast, a live region.
  await expect(page.locator("[data-toast-status]")).toHaveAttribute("role", "status");
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/end-to-end.spec.ts -g orc-353 --trace off
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");

  for (const theme of ["light", "dark"])
    for (const width of [1280, 390]) {
      const size = width === 390 ? "390" : "desktop";
      test(`orc-353 each step, ${size}, ${theme}`, async ({ page }) => {
        test.setTimeout(120_000);
        mkdirSync(dir, { recursive: true });
        await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
        await page.setViewportSize({ width, height: 900 });
        const shot = async (step: string) => {
          await page.evaluate(() => document.fonts.ready);
          await page.mouse.move(0, 0);
          await page.evaluate(() => window.scrollTo(0, 0));
          // The top of a long step, such as the spell lists: at most 2400px of the page.
          const height = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), 2400);
          await page.screenshot({
            path: join(dir, `orc-353-${step.toLowerCase()}-${size}-${theme}.png`),
            fullPage: true,
            clip: { x: 0, y: 0, width, height },
            animations: "disabled",
          });
        };
        // Feats: fighter-20 takes Grappler.
        await openFixture(page, "fighter-20", "Feats");
        await shot("Feats");
        // The other steps: fighter-3-wizard-2, Corvin Half-Elven, a half-elf acolyte.
        await openFixture(page, "fighter-3-wizard-2", "Name");
        for (const step of STEPS.filter((s) => s !== "Feats")) {
          await openStep(page, step);
          await shot(step);
        }
      });
    }
});
