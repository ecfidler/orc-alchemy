// The status toast of the sheet page (ORC-326, docs/design/sheet-interactivity.md
// "The status toast"): the text of the last action and the concentration note
// show at the bottom of the screen, and take no space in the sheet. A text that
// comes and goes moves nothing, and the vitals panel keeps no empty space for it.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { concentrationNote, layoutOf, openWithValues, statusLine, toast, vitals } from "./play-helpers.ts";

/** fighter-5: 54 hit points, 40 of them stored as current. */
const FIGHTER = join(import.meta.dirname, "../../../fixtures/characters/fighter-5.strict.json");
/** Life cleric 9: Bless needs concentration; 4 1st-level slots. */
const CLERIC = join(import.meta.dirname, "life-cleric-9.strict.json");
const CONCENTRATION = "~:orc-alchemy.play/concentration";

const SIZES = [
  ["desktop", 1280, 900],
  ["phone", 390, 844],
] as const;

const hitPoints = (page: Page) => page.getByRole("button", { name: /^Hit points, / });
const conditionsBox = (page: Page) => page.getByRole("group", { name: "Conditions and statuses" });
const spellsPanel = (page: Page) => page.getByRole("dialog", { name: "Spells" });
const spellView = (page: Page) => spellsPanel(page).locator("[data-pane=spell]").getByRole("region");

/** Types an amount in the Hit points popup and clicks one of its buttons; the popup closes, and the mouse goes away. */
async function hitPointsAct(page: Page, amount: string, button: "Damage" | "Heal") {
  await hitPoints(page).click();
  const popup = page.getByRole("dialog", { name: "Hit points" });
  await popup.getByRole("textbox", { name: "Amount" }).fill(amount);
  await popup.getByRole("button", { name: button, exact: true }).click();
  await expect(popup).toHaveCount(0);
  await page.mouse.move(0, 0);
}

/** Opens the sheet; on a phone it is on the Stats tab. */
async function openSheet(page: Page, file = FIGHTER, values: Record<string, unknown> = {}) {
  await openWithValues(page, file, values);
  await expect(conditionsBox(page)).toBeVisible();
}

/** Opens the Spells panel at a spell from its row in the list. */
async function openSpell(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 1280) < 720) await page.getByRole("tab", { name: "Spells" }).click();
  await page.getByRole("button", { name: "All spells" }).click();
  await spellsPanel(page)
    .locator("[data-spell-row]")
    .filter({ hasText: new RegExp(`^${name}`) })
    .first()
    .click();
  await expect(spellView(page).getByRole("heading", { level: 3 })).toHaveText(name);
}

/** The box of an element of the toast after its fade in, which must be in the viewport. */
async function inViewport(page: Page, locator: ReturnType<typeof toast>) {
  await expect.poll(() => locator.evaluate((element) => element.getAnimations().length)).toBe(0);
  const box = (await locator.boundingBox())!;
  const { width, height } = page.viewportSize()!;
  // The toast keeps a 16px gutter on each side; the 0.5px is for rounding.
  expect(box.x).toBeGreaterThanOrEqual(16 - 0.5);
  expect(box.x + box.width).toBeLessThanOrEqual(width - 16 + 0.5);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(height - 16 + 0.5);
  return box;
}

/** Pauses the clock of the page just after now, so that the test moves the time from here. */
async function pauseNow(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 50);
}

for (const [size, width, height] of SIZES) {
  test(`at ${width}px a status text and the concentration note move nothing in the vitals panel, and the toast is in the screen`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openSheet(page, FIGHTER, { [CONCENTRATION]: "~:bless" });
    // A click can scroll the page on a phone, so the layout is from the top left corner of the panel.
    const before = await layoutOf(vitals(page), "[hidden]");
    await hitPointsAct(page, "24", "Damage");
    await expect(statusLine(page)).toHaveText("24 damage.");
    await expect(concentrationNote(page)).toHaveText("Concentration on Bless: Constitution save, DC 12. Dismiss");
    expect(await layoutOf(vitals(page), "[hidden]")).toEqual(before);
    // The note is above the status, and the two are at the bottom centre of the screen.
    const status = await inViewport(page, statusLine(page).locator("> *"));
    const note = await inViewport(page, concentrationNote(page).locator("> *"));
    expect(note.y + note.height).toBeLessThanOrEqual(status.y);
    expect(Math.abs(status.x + status.width / 2 - width / 2)).toBeLessThan(3);
    // A long text wraps, and is never cut.
    if (size === "phone") expect(note.height).toBeGreaterThan(40);
    await concentrationNote(page).getByRole("button", { name: "Dismiss the concentration note" }).click();
    await expect(concentrationNote(page)).toHaveText("");
    expect(await layoutOf(vitals(page), "[hidden]")).toEqual(before);
  });

  test(`at ${width}px a cast moves nothing in the name block of the spell, and its text shows in the toast over the panel`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openWithValues(page, CLERIC);
    await openSpell(page, "Cure Wounds");
    const block = spellView(page).locator("[data-name-block]");
    const before = await layoutOf(block);
    await spellView(page).getByRole("group", { name: "Cast Cure Wounds" }).getByRole("button").first().click();
    await expect(statusLine(page)).toHaveText("Cast Cure Wounds. 1st-level slots −1 (3 left).");
    expect(await layoutOf(block)).toEqual(before);
    await inViewport(page, statusLine(page).locator("> *"));
    // The toast is over the panel: the text is the element at its centre.
    const status = (await statusLine(page).locator("> *").boundingBox())!;
    const top = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest("[data-toast-status]") !== null,
      [status.x + status.width / 2, status.y + status.height / 2],
    );
    expect(top).toBe(true);
  });

  test(`at ${width}px the vitals panel keeps no empty space under the Conditions and statuses box`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openSheet(page);
    const panel = (await vitals(page).boundingBox())!;
    const box = (await conditionsBox(page).boundingBox())!;
    const padding = await vitals(page).evaluate((element) => Number.parseFloat(getComputedStyle(element).paddingBottom));
    expect(panel.y + panel.height - (box.y + box.height)).toBeLessThanOrEqual(padding + 3);
  });
}

test("the status hides after about 6 seconds, a new text starts the time again, and the same text twice shows again", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.install();
  await openSheet(page);
  await hitPointsAct(page, "2", "Damage");
  await expect(statusLine(page)).toHaveText("2 damage.");
  await pauseNow(page);
  await page.clock.runFor(4500);
  await expect(statusLine(page)).toHaveText("2 damage.");
  // The same text again: it shows again, with a new time.
  await page.clock.resume();
  await hitPointsAct(page, "2", "Damage");
  await pauseNow(page);
  await page.clock.runFor(4500);
  await expect(statusLine(page)).toHaveText("2 damage.");
  await page.clock.runFor(2500);
  await expect(statusLine(page)).toHaveText("");
  await expect(statusLine(page).locator("> *")).toHaveCount(0);
});

test("the status does not hide while the pointer is on the toast; it hides after the time when the pointer leaves", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.install();
  await openSheet(page);
  await hitPointsAct(page, "3", "Damage");
  await expect(statusLine(page)).toHaveText("3 damage.");
  await statusLine(page).locator("> *").hover();
  await pauseNow(page);
  await page.clock.runFor(20_000);
  await expect(statusLine(page)).toHaveText("3 damage.");
  await page.mouse.move(0, 0);
  await page.clock.runFor(5000);
  await expect(statusLine(page)).toHaveText("3 damage.");
  await page.clock.runFor(2000);
  await expect(statusLine(page)).toHaveText("");
});

test("Dismiss is reachable with Tab after the sheet, and Enter takes the note away; the focus goes back", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page, FIGHTER, { [CONCENTRATION]: "~:bless" });
  await hitPointsAct(page, "24", "Damage");
  const dismiss = concentrationNote(page).getByRole("button", { name: "Dismiss the concentration note" });
  await expect(dismiss).toBeVisible();
  // The toast is at the end of the page: Tab from the last control of the page goes to Dismiss.
  await page.evaluate(() => {
    const tabbable = [...document.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, [tabindex]:not([tabindex='-1'])")].filter(
      (element) => !element.closest(".ui-toast") && element.tabIndex >= 0 && element.getClientRects().length > 0,
    );
    const last = tabbable.at(-1)!;
    last.dataset.lastControl = "";
    last.focus();
  });
  const last = page.locator("[data-last-control]");
  await expect(last).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dismiss).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(concentrationNote(page)).toHaveText("");
  await expect(last).toBeFocused();
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/status-toast.spec.ts -g orc-326 --trace off
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-326 status toast, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-326-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      // Takes the focus away, and waits for the fade in of the toast to end.
      const blur = async () => {
        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.waitForFunction(() => (document.querySelector(".ui-toast")?.getAnimations({ subtree: true }).length ?? 0) === 0);
      };
      for (const [size, width, height] of SIZES) {
        await page.setViewportSize({ width, height });
        await openSheet(page);
        await blur();
        await vitals(page).screenshot({ path: shot(`${size}-vitals-panel`) });
        await hitPointsAct(page, "12", "Damage");
        await expect(statusLine(page)).toHaveText("12 damage.");
        await blur();
        await page.screenshot({ path: shot(`${size}-status-toast`) });
        await openSheet(page, FIGHTER, { [CONCENTRATION]: "~:bless" });
        await hitPointsAct(page, "24", "Damage");
        await expect(concentrationNote(page)).not.toHaveText("");
        await blur();
        await page.screenshot({ path: shot(`${size}-concentration-note`) });
        await openWithValues(page, CLERIC);
        await openSpell(page, "Cure Wounds");
        await spellView(page).getByRole("group", { name: "Cast Cure Wounds" }).getByRole("button").first().click();
        await expect(statusLine(page)).not.toHaveText("");
        await page.mouse.move(0, 0);
        await blur();
        await page.screenshot({ path: shot(`${size}-cast`) });
      }
    });
  }
});
