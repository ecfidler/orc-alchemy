// The Death saves box: circles that change, the Stable tag and the Dead label
// (ORC-315, docs/design/sheet-interactivity.md "Death saves").
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { statusLine, vitals } from "./play-helpers.ts";

/** fighter-5: 54 hit points, 40 of them stored as current. */
const FIGHTER = join(import.meta.dirname, "../../../fixtures/characters/fighter-5.strict.json");

async function openFighter(page: Page) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(FIGHTER);
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await page.evaluate(() => document.fonts.ready);
}

const hitPoints = (page: Page) => page.getByRole("button", { name: /^Hit points, / });
const box = (page: Page) => page.getByRole("group", { name: /^Death saves/ });
const successes = (page: Page) => page.getByRole("slider", { name: "Death save successes" });
const failures = (page: Page) => page.getByRole("slider", { name: "Death save failures" });
const dead = (page: Page) => page.getByRole("button", { name: "Dead", exact: true });

/** Types an amount in the Hit points popup and clicks one of its buttons; the popup closes. */
async function act(page: Page, amount: string, button: "Damage" | "Heal" | "Set HP") {
  await hitPoints(page).click();
  const popup = page.getByRole("dialog", { name: "Hit points" });
  await popup.getByRole("textbox", { name: "Amount" }).fill(amount);
  await popup.getByRole("button", { name: button, exact: true }).click();
  await expect(popup).toHaveCount(0);
  await page.mouse.move(0, 0);
}

/** Sets a group with the keyboard, from the count it has now. */
async function setGroup(page: Page, group: "successes" | "failures", to: number) {
  const slider = group === "successes" ? successes(page) : failures(page);
  const now = Number(await slider.getAttribute("aria-valuenow"));
  await slider.focus();
  for (let i = now; i !== to; i += to > now ? 1 : -1) await page.keyboard.press(to > now ? "ArrowRight" : "ArrowLeft");
}

/** The place and size of the vitals panel and of each part in it, also the parts that are hidden. */
const layout = (page: Page) =>
  vitals(page).evaluate((panel) =>
    [panel, ...panel.querySelectorAll(".ui-framed-box, .ui-label, .ui-slot-circles, button")].map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return [x, y, width, height].map((n) => Math.round(n * 10) / 10).join(" ");
    }),
  );

for (const [width, height] of [
  [1280, 900],
  [390, 844],
] as const) {
  test(`at ${width}px no state of the death saves moves or resizes a part of the vitals panel`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openFighter(page);
    await expect(box(page)).toHaveAccessibleName("Death saves");
    const before = await layout(page);
    const check = async (name: string) => {
      await expect(box(page)).toHaveAccessibleName(name);
      expect(await layout(page), name).toEqual(before);
    };
    await setGroup(page, "successes", 1);
    await setGroup(page, "failures", 2);
    await expect(failures(page)).toHaveAttribute("aria-valuetext", "2 of 3");
    await check("Death saves");
    await setGroup(page, "successes", 3);
    await check("Death saves Stable");
    await setGroup(page, "failures", 3);
    await expect(dead(page)).toBeVisible();
    await check("Death saves Dead");
    await setGroup(page, "successes", 0);
    await check("Death saves Dead");
    await dead(page).click();
    await setGroup(page, "failures", 0);
    await expect(failures(page)).toHaveAttribute("aria-valuetext", "0 of 3");
    await check("Death saves");
  });
}

test("the circles change at any hit points; three successes do not change the hit points; the counts save", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFighter(page);
  await expect(hitPoints(page)).toHaveAccessibleName("Hit points, 40 of 54");
  await successes(page).locator(".ui-slot-circle").nth(0).click();
  await successes(page).locator(".ui-slot-circle").nth(1).click();
  await successes(page).locator(".ui-slot-circle").nth(2).click();
  await expect(box(page)).toHaveAccessibleName("Death saves Stable");
  await expect(page.getByText("Stable", { exact: true })).toBeVisible();
  await expect(hitPoints(page)).toHaveAccessibleName("Hit points, 40 of 54");
  // A click on an empty circle marks one more, and a click on a marked circle marks one less.
  await failures(page).locator(".ui-slot-circle").nth(0).click();
  await failures(page).locator(".ui-slot-circle").nth(2).click();
  await expect(failures(page)).toHaveAttribute("aria-valuetext", "2 of 3");
  await failures(page).locator(".ui-slot-circle").nth(1).click();
  await expect(failures(page)).toHaveAttribute("aria-valuetext", "1 of 3");
  // A circle click leaves the status line as it was.
  await expect(statusLine(page)).toHaveText("");
  await page.reload();
  await expect(successes(page)).toHaveAttribute("aria-valuetext", "3 of 3");
  await expect(failures(page)).toHaveAttribute("aria-valuetext", "1 of 3");
  await expect(box(page)).toHaveAccessibleName("Death saves Stable");
});

test("a hover on a group gives a light fill to the circle that a click changes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFighter(page);
  await setGroup(page, "failures", 1);
  const fill = (n: number) =>
    failures(page)
      .locator(".ui-slot-circle")
      .nth(n)
      .evaluate((circle) => getComputedStyle(circle, "::before").backgroundColor);
  const empty = await fill(2);
  const full = await fill(0);
  // Over an empty circle: the next empty one gets a light fill.
  await failures(page).locator(".ui-slot-circle").nth(2).hover();
  const light = await fill(1);
  expect(light).not.toBe(empty);
  expect(light).not.toBe(full);
  expect(await fill(2)).toBe(empty);
  // Over the marked circle: it goes light.
  await failures(page).locator(".ui-slot-circle").nth(0).hover();
  expect(await fill(0)).not.toBe(full);
});

test("instant death shows Dead; each click on Dead clears one failure; Heal clears the two groups", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFighter(page);
  await setGroup(page, "successes", 2);
  await act(page, "200", "Damage");
  await expect(statusLine(page)).toHaveText("200 damage: instant death.");
  await expect(dead(page)).toBeVisible();
  await expect(failures(page)).toHaveCount(0);
  await expect(successes(page)).toHaveAttribute("aria-valuetext", "0 of 3");
  await expect(box(page)).toHaveAccessibleName("Death saves Dead");
  // Only one Dead label: none beside the label "Death saves".
  await expect(box(page).getByText("Dead", { exact: true })).toHaveCount(1);

  await dead(page).click();
  await expect(dead(page)).toHaveCount(0);
  await expect(failures(page)).toHaveAttribute("aria-valuetext", "2 of 3");
  await expect(failures(page)).toBeFocused();
  // A change of the circles is the next action: the text of the last one goes.
  await expect(statusLine(page)).toHaveText("");
  await failures(page).locator(".ui-slot-circle").nth(1).click();
  await expect(failures(page)).toHaveAttribute("aria-valuetext", "1 of 3");
  await failures(page).locator(".ui-slot-circle").nth(0).click();
  await expect(failures(page)).toHaveAttribute("aria-valuetext", "0 of 3");

  await act(page, "200", "Damage");
  await expect(dead(page)).toBeVisible();
  await setGroup(page, "successes", 1);
  await act(page, "10", "Heal");
  await expect(hitPoints(page)).toHaveAccessibleName("Hit points, 10 of 54");
  await expect(failures(page)).toHaveAttribute("aria-valuetext", "0 of 3");
  await expect(successes(page)).toHaveAttribute("aria-valuetext", "0 of 3");
  await expect(box(page)).toHaveAccessibleName("Death saves");
});

test("from Dead, three presses of Left reverse an instant death one failure at a time; Set HP above 0 clears the counts", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFighter(page);
  await act(page, "200", "Damage");
  await dead(page).focus();
  for (const left of [2, 1, 0]) {
    await page.keyboard.press("ArrowLeft");
    await expect(failures(page)).toHaveAttribute("aria-valuetext", `${left} of 3`);
    await expect(failures(page)).toBeFocused();
  }
  await expect(dead(page)).toHaveCount(0);
  await setGroup(page, "successes", 2);
  await setGroup(page, "failures", 2);
  await act(page, "5", "Set HP");
  await expect(successes(page)).toHaveAttribute("aria-valuetext", "0 of 3");
  await expect(failures(page)).toHaveAttribute("aria-valuetext", "0 of 3");
});

test("each group is one Tab stop; the arrow keys change it; the focus goes with the failures to Dead and back", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFighter(page);
  await successes(page).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  await expect(successes(page)).toHaveAttribute("aria-valuetext", "1 of 3");
  await page.keyboard.press("Tab");
  await expect(failures(page)).toBeFocused();
  for (const key of ["ArrowUp", "ArrowRight", "ArrowRight"]) await page.keyboard.press(key);
  // The failures turn into the Dead button, and the focus goes to it.
  await expect(dead(page)).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(successes(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dead(page)).toBeFocused();
  // Enter on Dead clears one failure; the focus goes back to the circles.
  await page.keyboard.press("Enter");
  await expect(failures(page)).toBeFocused();
  await expect(failures(page)).toHaveAttribute("aria-valuetext", "2 of 3");
  await page.keyboard.press("ArrowRight");
  await expect(dead(page)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(failures(page)).toBeFocused();
  // A change that comes from the Hit points popup does not take the focus.
  await act(page, "200", "Damage");
  await expect(dead(page)).toBeVisible();
  await expect(dead(page)).not.toBeFocused();
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- death-saves.spec.ts -g orc-315
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-315 Death saves, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-315-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      for (const [size, width, height] of [
        ["desktop", 1280, 900],
        ["phone", 390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        await openFighter(page);
        const panel = vitals(page);
        await act(page, "40", "Damage");
        await setGroup(page, "successes", 1);
        await setGroup(page, "failures", 2);
        await page.locator(":focus").blur();
        await panel.screenshot({ path: shot(`${size}-some`) });
        await setGroup(page, "failures", 0);
        await setGroup(page, "successes", 3);
        await page.locator(":focus").blur();
        await panel.screenshot({ path: shot(`${size}-stable`) });
        await act(page, "200", "Damage");
        await panel.screenshot({ path: shot(`${size}-dead`) });
      }
    });
  }
});
