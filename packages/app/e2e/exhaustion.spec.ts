// Exhaustion in the Conditions and statuses box (ORC-323,
// docs/design/sheet-interactivity.md "Exhaustion" and "Marks on the sheet"):
// the menu entry, the token with six circles and an X, the popup of the
// effects, the speed and the hit point maximum with their captions, Dead at
// level 6, and no layout shift outside the box.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { aboveBox, layout, openWithValues, statusLine, storedValues } from "./play-helpers.ts";

/** fighter-5: 54 hit points, 40 of them stored as current; a speed of 25 feet. */
const FIGHTER = join(import.meta.dirname, "../../../fixtures/characters/fighter-5.strict.json");

const EXHAUSTION = "~:orc-alchemy.play/exhaustion";
const TEMP = "~:orc-alchemy.play/temp-hit-points";
/** warlock-20: a hit point maximum of 123. */
const WARLOCK = join(import.meta.dirname, "warlock-20.strict.json");
const CURRENT = "~:orcpub.dnd.e5.character/current-hit-points";

const box = (page: Page) => page.getByRole("group", { name: "Conditions and statuses" });
const addButton = (page: Page) => box(page).getByRole("button", { name: "Add condition" });
const token = (page: Page) => box(page).getByRole("group", { name: "Exhaustion" });
const circles = (page: Page) => token(page).getByRole("slider", { name: "Exhaustion" });
const speed = (page: Page) => page.getByRole("group", { name: "Speed", exact: true });
const hitPoints = (page: Page) => page.getByRole("button", { name: /^Hit points, / });
const deathSaves = (page: Page) => page.getByRole("group", { name: /^Death saves/ });
const effects = (page: Page) => page.getByRole("dialog", { name: "Exhaustion" });

/**
 * Where the text of the caption under current / max is: its number of lines, its space to the text of the Temporary
 * part on the left and to the right edge of the box, and how far it runs past the part on each side.
 */
const hpCaptionPlace = (page: Page) =>
  hitPoints(page).evaluate((part) => {
    const text = document.createRange();
    text.selectNodeContents(part.querySelector("[data-hp-caption]")!);
    const box = part.closest(".ui-framed-box")!.getBoundingClientRect();
    const label = document.createRange();
    label.selectNodeContents(part.closest(".ui-framed-box")!.querySelector("[data-hp-part]:not([aria-label^='Hit points']) .ui-label")!);
    const t = text.getBoundingClientRect();
    const p = part.getBoundingClientRect();
    return {
      lines: new Set([...text.getClientRects()].map((r) => Math.round(r.top))).size,
      fromTemporary: t.left - label.getBoundingClientRect().right,
      fromBoxEdge: box.right - t.right,
      past: [p.left - t.left, t.right - p.right].map((n) => Math.round(n)),
    };
  });

/** The caption is one line, centred on the part, in the box and clear of the text of the Temporary part. */
async function expectCaptionInBox(page: Page) {
  const place = await hpCaptionPlace(page);
  expect(place.lines).toBe(1);
  expect(Math.abs(place.past[0]! - place.past[1]!)).toBeLessThanOrEqual(1);
  expect(place.fromTemporary).toBeGreaterThan(2);
  expect(place.fromBoxEdge).toBeGreaterThan(1);
}

/** Opens the sheet of the fighter, which is on the Stats tab of a phone. */
async function openSheet(page: Page, values: Record<string, unknown> = {}, file = FIGHTER) {
  await openWithValues(page, file, values);
  if ((page.viewportSize()?.width ?? 1280) < 720) await expect(page.getByRole("tab", { name: "Stats" })).toHaveAttribute("aria-selected", "true");
  await expect(box(page)).toBeVisible();
}

/** Adds Exhaustion from the Add condition menu; the menu closes. */
async function addExhaustion(page: Page) {
  await addButton(page).click();
  await page.getByRole("menu").getByRole("menuitem", { name: "Exhaustion" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.mouse.move(0, 0);
}

/** Clicks the circles to one more level, and waits for it; the mouse leaves the token. */
async function oneMore(page: Page, to: number) {
  await circles(page)
    .locator(".ui-slot-circle")
    .nth(to - 1)
    .click();
  await expect(circles(page)).toHaveAttribute("aria-valuetext", `level ${to} of 6`);
  await page.mouse.move(0, 0);
  await expect(effects(page)).toHaveCount(0);
}

test("the menu adds Exhaustion at level 1 at the end of the tokens; the circles go up and down; the record keeps the level", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page, { "~:orc-alchemy.play/conditions": { "~#set": ["~:prone"] } });
  await addButton(page).click();
  await expect(page.getByRole("menu").getByRole("menuitem").last()).toHaveText("Exhaustion");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await addExhaustion(page);
  await expect(statusLine(page)).toHaveText("Exhaustion added.");
  await expect(box(page).locator(".ui-token")).toHaveText([/^Prone/, /^Exhaustion/]);
  await expect(circles(page)).toHaveAttribute("aria-valuetext", "level 1 of 6");
  // No "Level n" label, and no Exhaustion entry in the menu while the token shows.
  await expect(token(page)).not.toContainText(/level/i);
  await addButton(page).click();
  await expect(page.getByRole("menu").getByRole("menuitem").last()).toHaveText(/^Unconscious/);
  await expect(page.getByRole("menu").getByRole("menuitem", { name: "Exhaustion" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await oneMore(page, 2);
  await expect(statusLine(page)).toHaveText("Exhaustion 1 → 2.");
  await oneMore(page, 3);
  // A click on a marked circle gives one less.
  await circles(page).locator(".ui-slot-circle").first().click();
  await expect(circles(page)).toHaveAttribute("aria-valuetext", "level 2 of 6");
  await expect.poll(async () => (await storedValues(page))[EXHAUSTION]).toBe(2);
  await page.reload();
  await expect(circles(page)).toHaveAttribute("aria-valuetext", "level 2 of 6");
  await expect(statusLine(page)).toHaveText("");
  // The X removes the token and the key.
  await token(page).getByRole("button", { name: "Remove Exhaustion" }).click();
  await expect(statusLine(page)).toHaveText("Exhaustion removed.");
  await expect(token(page)).toHaveCount(0);
  await expect.poll(async () => EXHAUSTION in (await storedValues(page))).toBe(false);
  // A click that takes the level to 0 also removes it; the focus goes to "+ Add condition".
  await addExhaustion(page);
  await circles(page).locator(".ui-slot-circle").first().click();
  await expect(token(page)).toHaveCount(0);
  await expect(addButton(page)).toBeFocused();
  await expect.poll(async () => EXHAUSTION in (await storedValues(page))).toBe(false);
});

test("the keyboard: the circles are one Tab stop; the arrow keys change the level; the name opens the effects", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page, { [EXHAUSTION]: 2 });
  const name = token(page).getByRole("button", { name: "Exhaustion", exact: true });
  await name.focus();
  await page.keyboard.press("Tab");
  await expect(circles(page)).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(token(page).getByRole("button", { name: "Remove Exhaustion" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(circles(page)).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(circles(page)).toHaveAttribute("aria-valuetext", "level 3 of 6");
  await page.keyboard.press("ArrowLeft");
  await expect(circles(page)).toHaveAttribute("aria-valuetext", "level 2 of 6");
  await page.keyboard.press("ArrowLeft");
  await expect(circles(page)).toHaveAttribute("aria-valuetext", "level 1 of 6");
  await page.keyboard.press("ArrowLeft");
  await expect(token(page)).toHaveCount(0);
  await expect(addButton(page)).toBeFocused();
  await addExhaustion(page);
  await token(page).getByRole("button", { name: "Exhaustion", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(effects(page)).toBeVisible();
  await expect(effects(page).getByRole("listitem")).toHaveCount(6);
  await page.keyboard.press("Escape");
  await expect(effects(page)).toHaveCount(0);
  await expect(token(page).getByRole("button", { name: "Exhaustion", exact: true })).toBeFocused();
});

test("a hover on the token shows the effects of the six levels, the levels that apply in bold; leaving closes them", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page, { [EXHAUSTION]: 2 });
  await token(page).locator(".ui-slot-circles").hover();
  await expect(effects(page)).toBeVisible();
  const items = effects(page).getByRole("listitem");
  await expect(items).toHaveText([/^1Disadvantage on ability checks/, /^2Speed halved/, /^3/, /^4Hit point maximum halved/, /^5Speed reduced to 0/, /^6Death/]);
  expect(await items.evaluateAll((li) => li.map((item) => getComputedStyle(item).fontWeight === "600"))).toEqual([true, true, false, false, false, false]);
  // The hover takes no focus.
  await expect(page.locator("body")).toBeFocused();
  // A click on the circles keeps the popup, and the bold levels follow the level.
  await circles(page).locator(".ui-slot-circle").nth(2).click();
  await expect(circles(page)).toHaveAttribute("aria-valuetext", "level 3 of 6");
  await expect(effects(page)).toBeVisible();
  await expect(effects(page).locator("[data-applies]")).toHaveCount(3);
  await page.mouse.move(0, 0);
  await expect(effects(page)).toHaveCount(0);
  // A click on the name, for touch, opens the same popup, and it stays when the mouse leaves.
  await token(page).getByRole("button", { name: "Exhaustion", exact: true }).click();
  await page.mouse.move(0, 0);
  await expect(effects(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(effects(page)).toHaveCount(0);
});

for (const [width, height] of [
  [1280, 900],
  [390, 844],
] as const) {
  test(`at ${width}px each level from 0 to 6 moves nothing outside the box; the captions and Dead show in the space they keep`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openSheet(page);
    const caption = speed(page).locator("[data-speed-caption]");
    const hpCaption = hitPoints(page).locator("[data-hp-caption]");
    await expect(speed(page)).toContainText(/^25 ft\./);
    await expect(hitPoints(page)).toHaveAttribute("aria-label", "Hit points, 40 of 54");
    const none = await layout(page);
    await addExhaustion(page);
    // The token can give the box one more line, which only moves what is under the box.
    expect(aboveBox(await layout(page)), "level 1").toEqual(aboveBox(none));
    const one = await layout(page);
    await expect(caption).toHaveText("");
    await oneMore(page, 2);
    await expect(speed(page)).toContainText(/^12 ft\./);
    await expect(caption).toHaveText("Exhaustion");
    await expect(caption).toHaveCSS("text-transform", "uppercase");
    expect(await layout(page), "level 2").toEqual(one);
    await oneMore(page, 3);
    await expect(hpCaption).toHaveText("");
    expect(await layout(page), "level 3").toEqual(one);
    await oneMore(page, 4);
    // Level 4 halves the maximum and writes the current hit points down to it.
    await expect(hitPoints(page)).toHaveAttribute("aria-label", "Hit points, 27 of 27. Maximum halved\u00a0· Exhaustion");
    await expect(hpCaption).toHaveText("Maximum halved\u00a0· Exhaustion");
    await expect(hpCaption).toHaveCSS("text-transform", "uppercase");
    // The caption is one line in the box, clear of the Temporary part.
    await expectCaptionInBox(page);
    await expect(statusLine(page)).toHaveText("Exhaustion 3 → 4, hit points 40 → 27.");
    await expect.poll(async () => (await storedValues(page))[CURRENT]).toBe(27);
    expect(await layout(page), "level 4").toEqual(one);
    await oneMore(page, 5);
    await expect(speed(page)).toContainText(/^0 ft\./);
    expect(await layout(page), "level 5").toEqual(one);
    await oneMore(page, 6);
    // Level 6: Dead in the place of the failure circles, not a button; the hit points and the death saves stay.
    await expect(deathSaves(page)).toHaveAccessibleName("Death saves Dead");
    await expect(page.locator("[data-dead-text]")).toBeVisible();
    await expect(page.getByRole("button", { name: "Dead", exact: true })).toHaveCount(0);
    await expect(hitPoints(page)).toHaveAttribute("aria-label", "Hit points, 27 of 27. Maximum halved\u00a0· Exhaustion");
    expect(await layout(page), "level 6").toEqual(one);
    await expect
      .poll(async () => {
        const values = await storedValues(page);
        return [values[EXHAUSTION], values[CURRENT], "~:orc-alchemy.play/death-saves" in values];
      })
      .toEqual([6, 27, false]);
    // A lower level removes Dead. The hit points do not come back below level 4.
    await circles(page).locator(".ui-slot-circle").first().click();
    await expect(page.locator("[data-dead-text]")).toBeHidden();
    for (const level of [4, 3]) {
      await circles(page).locator(".ui-slot-circle").first().click();
      await expect(circles(page)).toHaveAttribute("aria-valuetext", `level ${level} of 6`);
    }
    await expect(hitPoints(page)).toHaveAttribute("aria-label", "Hit points, 27 of 54");
    await expect(hpCaption).toHaveText("");
    await page.mouse.move(0, 0);
    expect(await layout(page), "back at level 3").toEqual(one);
  });
}

for (const [width, height] of [
  [1280, 900],
  [390, 844],
  [320, 700],
] as const) {
  test(`at ${width}px the caption under current / max is one line, with and without temporary hit points and with a 3-digit maximum`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    // The place and size of the Hit points box and of its parts.
    const hpBox = () =>
      hitPoints(page).evaluate((part) =>
        [part.closest(".ui-framed-box")!, ...part.closest(".ui-framed-box")!.querySelectorAll("[data-hp-part], [data-hp-caption]")].map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return [x, y, width, height].map((n) => Math.round(n * 10) / 10).join(" ");
        }),
      );
    for (const [file, temp] of [
      [FIGHTER, 0],
      [FIGHTER, 15],
      [WARLOCK, 155],
    ] as const) {
      // The box keeps its size and its parts their places: the box with the caption is the box without it.
      await openSheet(page, { [TEMP]: temp }, file);
      const before = await hpBox();
      await openSheet(page, { [TEMP]: temp, [EXHAUSTION]: 4 }, file);
      await expect(hitPoints(page).locator("[data-hp-caption]")).toHaveText("Maximum halved\u00a0· Exhaustion");
      await expectCaptionInBox(page);
      expect(await hpBox()).toEqual(before);
    }
  });
}

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/exhaustion.spec.ts -g orc-323
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-323 Exhaustion, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-323-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      for (const [size, width, height] of [
        ["desktop", 1280, 900],
        ["phone", 390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        await openSheet(page);
        const panel = page.locator(".ui-panel").filter({ has: hitPoints(page) });
        const still = async () => {
          await page.mouse.move(0, 0);
          await expect(effects(page)).toHaveCount(0);
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        };
        await addExhaustion(page);
        await still();
        await panel.screenshot({ path: shot(`${size}-level-1`) });
        for (const level of [2, 3, 4, 5, 6]) {
          await oneMore(page, level);
          await still();
          if (level !== 3) await panel.screenshot({ path: shot(`${size}-level-${level}`) });
        }
        await circles(page).locator(".ui-slot-circle").first().click();
        await expect(circles(page)).toHaveAttribute("aria-valuetext", "level 5 of 6");
        for (const level of [4, 3]) {
          await circles(page).locator(".ui-slot-circle").first().click();
          await expect(circles(page)).toHaveAttribute("aria-valuetext", `level ${level} of 6`);
        }
        await token(page).locator(".ui-slot-circles").hover();
        await expect(effects(page)).toBeVisible();
        await page.screenshot({ path: shot(`${size}-effects`) });
        await openWithValues(page, FIGHTER, {
          [EXHAUSTION]: 2,
          "~:orc-alchemy.play/concentration": "~:bless",
          "~:orc-alchemy.play/conditions": { "~#set": ["~:poisoned", "~:prone"] },
        });
        await expect(box(page)).toBeVisible();
        await still();
        await panel.screenshot({ path: shot(`${size}-with-tokens`) });
      }
    });
  }
});
