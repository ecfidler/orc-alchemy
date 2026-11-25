// The Hit dice box and its popup (ORC-317, docs/design/sheet-interactivity.md
// "Hit dice").
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { statusLine, vitals } from "./play-helpers.ts";

/** fighter-5: 5 d10, Constitution +3, 54 hit points, 40 of them stored as current. */
const FIGHTER = join(import.meta.dirname, "../../../fixtures/characters/fighter-5.strict.json");
/** Cleric 6 / paladin 3 / rogue 1 / wizard 1: 3 d10, 7 d8 (cleric and rogue) and 1 d6, Constitution +1, 91 hit points. */
const MULTICLASS = join(import.meta.dirname, "cleric-6-paladin-3-rogue-1-wizard-1.strict.json");
/** Wizard 3 / warlock 2: 2 d8 and 3 d6. */
const TWO_DICE = join(import.meta.dirname, "wizard-3-warlock-2.strict.json");

async function open(page: Page, file: string) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(file);
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await page.evaluate(() => document.fonts.ready);
}

const hitDice = (page: Page) => page.getByRole("button", { name: /^Hit dice, / });
const hitPoints = (page: Page) => page.getByRole("button", { name: /^Hit points, / });
const popup = (page: Page) => page.getByRole("dialog", { name: "Hit dice" });
const row = (page: Page, die: string) => popup(page).getByRole("group", { name: die, exact: true });

/** Opens the popup, and in the row of the die types a roll and clicks Spend, or clicks Roll for me or Regain. */
async function act(page: Page, die: string, action: { roll: string } | "Roll for me" | "Regain") {
  await hitDice(page).click();
  const target = row(page, die);
  if (typeof action === "string") await target.getByRole("button", { name: action, exact: true }).click();
  else {
    await target.getByRole("textbox", { name: "Roll" }).fill(action.roll);
    await target.getByRole("button", { name: "Spend", exact: true }).click();
  }
  await expect(popup(page)).toHaveCount(0);
  await page.mouse.move(0, 0);
}

/** The place and size of the vitals panel and of each box and part in it. */
const layout = (page: Page) =>
  vitals(page).evaluate((panel) =>
    [panel, ...panel.querySelectorAll(".ui-framed-box, .ui-label, .ui-current-max, button")].map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return [x, y, width, height].map((n) => Math.round(n * 10) / 10).join(" ");
    }),
  );

/** The heights of the three boxes of the row: Hit points, Hit dice and Death saves. */
const boxHeights = (page: Page) =>
  vitals(page).evaluate((panel) => [...panel.querySelectorAll(".ui-framed-box")].map((box) => Math.round(box.getBoundingClientRect().height * 10) / 10));

for (const [width, height] of [
  [1280, 900],
  [390, 844],
] as const) {
  test(`at ${width}px spend, regain and all dice spent move and resize no part of the vitals panel`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page, MULTICLASS);
    await expect(hitDice(page)).toHaveAccessibleName("Hit dice, 3 of 3 d10, 7 of 7 d8, 1 of 1 d6");
    const before = await layout(page);
    const check = async (name: string) => {
      await expect(hitDice(page)).toHaveAccessibleName(name);
      expect(await layout(page), name).toEqual(before);
    };
    await act(page, "d8", { roll: "4" });
    await check("Hit dice, 3 of 3 d10, 6 of 7 d8, 1 of 1 d6");
    await act(page, "d6", "Roll for me");
    await check("Hit dice, 3 of 3 d10, 6 of 7 d8, 0 of 1 d6");
    for (let i = 0; i < 3; i++) await act(page, "d10", "Roll for me");
    for (let i = 0; i < 6; i++) await act(page, "d8", "Roll for me");
    await check("Hit dice, 0 of 3 d10, 0 of 7 d8, 0 of 1 d6");
    await act(page, "d8", "Regain");
    await check("Hit dice, 0 of 3 d10, 1 of 7 d8, 0 of 1 d6");
  });

  test(`at ${width}px the box fits its column with one, two or three die sizes; the row of boxes keeps its height`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const heights: number[][] = [];
    for (const file of [FIGHTER, TWO_DICE, MULTICLASS]) {
      await open(page, file);
      // The content of the button is not wider than the button.
      const fits = await hitDice(page).evaluate((button) => button.scrollWidth <= button.clientWidth && button.scrollHeight <= button.clientHeight);
      expect(fits, file).toBe(true);
      heights.push(await boxHeights(page));
    }
    // The three boxes of the row have the same height for each character.
    expect(heights[1]).toEqual(heights[0]);
    expect(heights[2]).toEqual(heights[0]);
  });
}

test("the box shows the dice left of each die size, the largest first; two classes with one die size share a pair", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, MULTICLASS);
  await expect(hitDice(page)).toHaveText("3 / 3d107 / 7d81 / 1d6");
  await hitDice(page).click();
  await expect(popup(page).getByRole("group")).toHaveText([/^d10/, /^d8/, /^d6/]);
});

test("Spend heals the roll and the Constitution modifier, spends one die, and the status line says so; the changes save", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, FIGHTER);
  await expect(hitDice(page)).toHaveAccessibleName("Hit dice, 5 of 5 d10");
  await expect(hitDice(page)).toHaveText("5 / 5d10");
  await act(page, "d10", { roll: "7" });
  await expect(statusLine(page)).toHaveText("Hit die d10: 7 + 3 = 10 healed.");
  await expect(hitPoints(page)).toHaveAccessibleName("Hit points, 50 of 54");
  await expect(hitDice(page)).toHaveAccessibleName("Hit dice, 4 of 5 d10");
  // The heal stops at the maximum. The user can spend a die at full hit points.
  await act(page, "d10", { roll: "10" });
  await expect(hitPoints(page)).toHaveAccessibleName("Hit points, 54 of 54");
  await act(page, "d10", { roll: "1" });
  await expect(statusLine(page)).toHaveText("Hit die d10: 1 + 3 = 4 healed.");
  await expect(hitDice(page)).toHaveAccessibleName("Hit dice, 2 of 5 d10");
  // Regain gives one die back and does not change the hit points.
  await act(page, "d10", "Regain");
  await expect(statusLine(page)).toHaveText("Hit die d10 regained.");
  await expect(hitDice(page)).toHaveAccessibleName("Hit dice, 3 of 5 d10");
  await expect(hitPoints(page)).toHaveAccessibleName("Hit points, 54 of 54");
  await page.reload();
  await expect(hitDice(page)).toHaveAccessibleName("Hit dice, 3 of 5 d10");
});

test("Roll for me rolls the die and spends it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Math.random gives 0.25: a d10 rolls 3.
  await page.addInitScript(() => {
    Math.random = () => 0.25;
  });
  await open(page, FIGHTER);
  await act(page, "d10", "Roll for me");
  await expect(statusLine(page)).toHaveText("Hit die d10: 3 + 3 = 6 healed.");
  await expect(hitPoints(page)).toHaveAccessibleName("Hit points, 46 of 54");
  await expect(hitDice(page)).toHaveAccessibleName("Hit dice, 4 of 5 d10");
});

test("a roll that is not valid keeps the popup open with a note; Spend and Roll for me are disabled with no die left, Regain with none spent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, MULTICLASS);
  await hitDice(page).click();
  const d6 = row(page, "d6");
  const note = popup(page).getByRole("status");
  const size = await popup(page).boundingBox();
  await d6.getByRole("button", { name: "Spend", exact: true }).click();
  await expect(note).toHaveText("Type a roll from 1 to 6 for the d6.");
  await d6.getByRole("textbox", { name: "Roll" }).fill("7");
  await expect(note).toHaveText("");
  await d6.getByRole("button", { name: "Spend", exact: true }).click();
  await expect(note).toHaveText("Type a roll from 1 to 6 for the d6.");
  // The note keeps the size of the popup.
  expect(await popup(page).boundingBox()).toEqual(size);
  await expect(d6.getByRole("button", { name: "Regain" })).toBeDisabled();
  await d6.getByRole("textbox", { name: "Roll" }).fill("6");
  await d6.getByRole("button", { name: "Spend", exact: true }).click();
  await expect(popup(page)).toHaveCount(0);
  await hitDice(page).click();
  await expect(row(page, "d6").getByRole("button", { name: "Spend", exact: true })).toBeDisabled();
  await expect(row(page, "d6").getByRole("button", { name: "Roll for me" })).toBeDisabled();
  await expect(row(page, "d6").getByRole("button", { name: "Regain" })).toBeEnabled();
  await expect(row(page, "d8").getByRole("button", { name: "Spend", exact: true })).toBeEnabled();
  expect(await popup(page).boundingBox()).toEqual(size);
});

test("keyboard: the box opens the popup with the focus in the first field; Enter in a field spends that row; Escape gives the focus back", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, MULTICLASS);
  await hitDice(page).focus();
  await page.keyboard.press("Enter");
  await expect(row(page, "d10").getByRole("textbox", { name: "Roll" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(popup(page)).toHaveCount(0);
  await expect(hitDice(page)).toBeFocused();
  await page.keyboard.press("Space");
  await row(page, "d8").getByRole("textbox", { name: "Roll" }).focus();
  await page.keyboard.type("5");
  await page.keyboard.press("Enter");
  await expect(popup(page)).toHaveCount(0);
  await expect(statusLine(page)).toHaveText("Hit die d8: 5 + 1 = 6 healed.");
  await expect(hitDice(page)).toBeFocused();
  // Enter with an empty field shows the note and keeps the popup open. The popup moves the
  // focus to the first field after it opens; until then a second Enter goes to the box and closes it.
  await page.keyboard.press("Enter");
  await expect(row(page, "d10").getByRole("textbox", { name: "Roll" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(popup(page).getByRole("status")).toHaveText("Type a roll from 1 to 10 for the d10.");
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- hit-dice.spec.ts -g orc-317
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-317 Hit dice, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-317-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      for (const [size, width, height] of [
        ["desktop", 1280, 900],
        ["phone", 390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        /** The vitals panel, and the panel with the popup open under the box. */
        const shots = async (what: string) => {
          await page.locator(":focus").blur();
          await vitals(page).screenshot({ path: shot(`${size}-${what}`) });
          await hitDice(page).click();
          await row(page, "d10").getByRole("textbox", { name: "Roll" }).fill("7");
          const panel = await vitals(page).boundingBox();
          const pop = await popup(page).boundingBox();
          if (panel && pop) {
            const top = Math.max(0, Math.min(panel.y, pop.y) - 8);
            const left = Math.max(0, Math.min(panel.x, pop.x) - 8);
            const right = Math.min(width, Math.max(panel.x + panel.width, pop.x + pop.width) + 8);
            const bottom = Math.max(panel.y + panel.height, pop.y + pop.height) + 8;
            await page.screenshot({ path: shot(`${size}-${what}-popup`), clip: { x: left, y: top, width: right - left, height: bottom - top } });
          }
          await page.keyboard.press("Escape");
        };
        await open(page, FIGHTER);
        await act(page, "d10", { roll: "7" });
        await act(page, "d10", { roll: "4" });
        await shots("single-class");
        await open(page, MULTICLASS);
        await act(page, "d8", { roll: "5" });
        await act(page, "d6", { roll: "3" });
        await shots("multiclass");
      }
    });
  }
});
