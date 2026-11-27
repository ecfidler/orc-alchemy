// Recorded feature uses: circles, pools, turn uses and the name "Dawn" (ORC-316,
// docs/design/sheet-interactivity.md "Feature uses").
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

/**
 * A cleric 6 / paladin 3 / rogue 1 / wizard 1: two Channel Divinity features (2 uses and 1 use, both "rest"),
 * Divine Sense (3), Lay on Hands (a pool of 15), Sneak Attack (each turn) and Arcane Recovery (day).
 */
const MULTICLASS = join(import.meta.dirname, "cleric-6-paladin-3-rogue-1-wizard-1.strict.json");

async function openMulticlass(page: Page) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(MULTICLASS);
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await page.evaluate(() => document.fonts.ready);
  // A narrow sheet has the features in a tab.
  const tab = page.getByRole("tab", { name: "Features" });
  if (await tab.isVisible()) await tab.click();
}

const features = (page: Page) => page.getByRole("group", { name: "Features & traits" });
const bubble = (page: Page, name: string) => features(page).getByRole("group", { name, exact: true });
const circles = (page: Page, name: string) => bubble(page, name).getByRole("slider", { name });
const circle = (page: Page, name: string, i: number) => circles(page, name).locator(".ui-slot-circle").nth(i);
/** The two Channel Divinity bubbles: the cleric's with 2 circles, then the paladin's with 1. */
const channel = (page: Page, circleCount: 1 | 2) =>
  features(page)
    .getByRole("group", { name: "Channel Divinity", exact: true })
    .filter({ has: page.locator(`.ui-slot-circles:has(> .ui-slot-circle:nth-child(${circleCount}):last-child)`) })
    .getByRole("slider");
const poolCount = (page: Page) => bubble(page, "Lay on Hands").getByRole("button", { name: /^Lay on Hands, / });

/** Opens the pool popup, types an amount and clicks one of its buttons; the popup closes. */
async function poolAct(page: Page, amount: string, button: "Spend" | "Regain" | "Set") {
  await poolCount(page).click();
  const popup = page.getByRole("dialog", { name: "Lay on Hands" });
  await popup.getByRole("textbox", { name: "Amount" }).fill(amount);
  await popup.getByRole("button", { name: button, exact: true }).click();
  await expect(popup).toHaveCount(0);
}

/**
 * The size of the features section, and the place in it and size of each bubble and each part of a bubble. The
 * places are from the top left of the section, so a scroll of the page does not change them.
 */
const layout = (page: Page) =>
  features(page).evaluate((section) => {
    const origin = section.getBoundingClientRect();
    return [section, ...section.querySelectorAll(".ui-use-bubble, .ui-slot-circles, .ui-slot-circle, .ui-use-pool, button, .ui-use-bubble-tag")].map(
      (element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return [x - origin.x, y - origin.y, width, height].map((n) => Math.round(n * 10) / 10).join(" ");
      },
    );
  });

test("a click on a free circle spends the first free one, a click on a spent circle gives the last one back, and the count saves", async ({ page }) => {
  await openMulticlass(page);
  const sense = circles(page, "Divine Sense");
  await expect(sense).toHaveAttribute("aria-valuetext", "0 of 3 spent");
  await circle(page, "Divine Sense", 2).click();
  await expect(sense).toHaveAttribute("aria-valuetext", "1 of 3 spent");
  await expect(circle(page, "Divine Sense", 0)).toHaveAttribute("data-marked", "");
  await circle(page, "Divine Sense", 1).click();
  await expect(sense).toHaveAttribute("aria-valuetext", "2 of 3 spent");
  await expect(sense).toBeFocused();
  await circle(page, "Divine Sense", 0).click();
  await expect(sense).toHaveAttribute("aria-valuetext", "1 of 3 spent");
  await page.reload();
  await expect(circles(page, "Divine Sense")).toHaveAttribute("aria-valuetext", "1 of 3 spent");
});

test("a group of circles is one Tab stop: Right and Up spend one, Left and Down give one back; all spent dashes the bubble", async ({ page }) => {
  await openMulticlass(page);
  const sense = circles(page, "Divine Sense");
  await sense.focus();
  for (const key of ["ArrowRight", "ArrowUp", "ArrowRight", "ArrowRight"]) await page.keyboard.press(key);
  await expect(sense).toHaveAttribute("aria-valuetext", "3 of 3 spent");
  await expect(bubble(page, "Divine Sense")).toHaveAttribute("data-spent", "");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  await expect(sense).toHaveAttribute("aria-valuetext", "1 of 3 spent");
  await expect(bubble(page, "Divine Sense")).not.toHaveAttribute("data-spent", "");
  // The next Tab stop is not a circle of the same group.
  await page.keyboard.press("Tab");
  await expect(sense).not.toBeFocused();
  await expect(page.locator(":focus")).not.toHaveClass(/ui-slot-circle\b/);
});

test("Channel Divinity of the cleric and of the paladin share one count, each against its own amount", async ({ page }) => {
  await openMulticlass(page);
  await expect(channel(page, 2)).toHaveAttribute("aria-valuetext", "0 of 2 spent");
  await expect(channel(page, 1)).toHaveAttribute("aria-valuetext", "0 of 1 spent");
  await channel(page, 2).locator(".ui-slot-circle").first().click();
  await expect(channel(page, 2)).toHaveAttribute("aria-valuetext", "1 of 2 spent");
  await expect(channel(page, 1)).toHaveAttribute("aria-valuetext", "1 of 1 spent");
  await channel(page, 2).locator(".ui-slot-circle").nth(1).click();
  // A count above the amount reads as all spent.
  await expect(channel(page, 2)).toHaveAttribute("aria-valuetext", "2 of 2 spent");
  await expect(channel(page, 1)).toHaveAttribute("aria-valuetext", "1 of 1 spent");
  // One less on the paladin's bubble gives back from what it shows: 0.
  await channel(page, 1).locator(".ui-slot-circle").first().click();
  await expect(channel(page, 2)).toHaveAttribute("aria-valuetext", "0 of 2 spent");
});

test("a pool: minus and plus change the uses left by one; the popup spends, regains and sets, and stops at 0 and the maximum", async ({ page }) => {
  await openMulticlass(page);
  const minus = bubble(page, "Lay on Hands").getByRole("button", { name: "Spend 1 Lay on Hands" });
  const plus = bubble(page, "Lay on Hands").getByRole("button", { name: "Regain 1 Lay on Hands" });
  await expect(poolCount(page)).toHaveAccessibleName("Lay on Hands, 15 of 15 left");
  await expect(plus).toBeDisabled();
  await minus.click();
  await minus.click();
  await expect(poolCount(page)).toHaveAccessibleName("Lay on Hands, 13 of 15 left");
  await plus.click();
  await expect(poolCount(page)).toHaveAccessibleName("Lay on Hands, 14 of 15 left");
  await poolAct(page, "5", "Spend");
  await expect(poolCount(page)).toHaveAccessibleName("Lay on Hands, 9 of 15 left");
  await expect(poolCount(page)).toBeFocused();
  await poolAct(page, "50", "Spend");
  await expect(poolCount(page)).toHaveAccessibleName("Lay on Hands, 0 of 15 left");
  await expect(minus).toBeDisabled();
  await expect(bubble(page, "Lay on Hands")).toHaveAttribute("data-spent", "");
  await poolAct(page, "4", "Regain");
  await expect(poolCount(page)).toHaveAccessibleName("Lay on Hands, 4 of 15 left");
  await poolAct(page, "40", "Regain");
  await expect(poolCount(page)).toHaveAccessibleName("Lay on Hands, 15 of 15 left");
  await poolAct(page, "7", "Set");
  await expect(poolCount(page)).toHaveAccessibleName("Lay on Hands, 7 of 15 left");
  // With no number, the popup stays open and says so.
  await poolCount(page).click();
  const popup = page.getByRole("dialog", { name: "Lay on Hands" });
  await expect(popup.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await popup.getByRole("button", { name: "Spend", exact: true }).click();
  await expect(popup.getByText("Type a number of 0 or more.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await page.reload();
  await expect(poolCount(page)).toHaveAccessibleName("Lay on Hands, 7 of 15 left");
});

test("a turn feature has no circles and says Once per turn; the unit day says Dawn", async ({ page }) => {
  await openMulticlass(page);
  await expect(bubble(page, "Sneak Attack").getByText("Once per turn")).toBeVisible();
  await expect(bubble(page, "Sneak Attack").locator(".ui-slot-circles")).toHaveCount(0);
  await expect(bubble(page, "Arcane Recovery").getByText("Dawn")).toBeVisible();
  await expect(circles(page, "Arcane Recovery")).toHaveAttribute("aria-valuetext", "0 of 1 spent");
});

for (const [width, height] of [
  [1280, 900],
  [390, 844],
] as const) {
  test(`at ${width}px no change of the uses moves or resizes a bubble, a circle or the pool`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openMulticlass(page);
    const before = await layout(page);
    const check = async (what: string) => {
      await page.mouse.move(0, 0);
      expect(await layout(page), what).toEqual(before);
    };
    await circle(page, "Divine Sense", 0).click();
    await check("one circle spent");
    for (let i = 0; i < 2; i++) await circle(page, "Divine Sense", 0).click();
    await check("all circles spent");
    await bubble(page, "Lay on Hands").getByRole("button", { name: "Spend 1 Lay on Hands" }).click();
    await check("pool 14");
    await poolAct(page, "5", "Set");
    await check("pool 5, one digit");
    await poolAct(page, "0", "Set");
    await check("pool 0, all spent");
    await poolAct(page, "10", "Set");
    await check("pool 10");
  });
}
