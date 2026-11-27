// The Hit points box, its two popups and the status toast (ORC-314,
// docs/design/sheet-interactivity.md "Hit points").
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
const temporary = (page: Page) => page.getByRole("button", { name: /^Temporary hit points, / });

/** Types an amount in the open popup and clicks one of its buttons; the popup closes. */
async function act(page: Page, opener: "hit-points" | "temporary", amount: string | null, button: string) {
  const title = opener === "hit-points" ? "Hit points" : "Temporary hit points";
  await (opener === "hit-points" ? hitPoints(page) : temporary(page)).click();
  const popup = page.getByRole("dialog", { name: title });
  await expect(popup.getByRole("textbox", { name: "Amount" })).toBeFocused();
  if (amount !== null) await popup.getByRole("textbox", { name: "Amount" }).fill(amount);
  await popup.getByRole("button", { name: button, exact: true }).click();
  await expect(popup).toHaveCount(0);
  // The mouse goes away, so that no part has the ring of the mouse.
  await page.mouse.move(0, 0);
}

/** The place and size of the vitals panel and of each box, line and space in it. */
const layout = (page: Page) =>
  vitals(page).evaluate((panel) =>
    // The tokens in the Conditions and statuses box can change: at 0 hit points the app adds Unconscious (ORC-322).
    [panel, ...panel.querySelectorAll(".ui-framed-box, button, .ui-label")]
      .filter((element) => !element.closest("[data-conditions-box] .ui-tokens"))
      .map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return [x, y, width, height].map((n) => Math.round(n * 10) / 10).join(" ");
      }),
  );

for (const [width, height] of [
  [1280, 900],
  [390, 844],
] as const) {
  test(`at ${width}px no action moves or resizes a part of the vitals panel`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openFighter(page);
    const before = await layout(page);
    const steps: [opener: "hit-points" | "temporary", amount: string | null, button: string, hp: string, temp: string, status: string][] = [
      ["temporary", "5", "Set temp HP", "Hit points, 40 of 54", "Temporary hit points, 5", "Temporary hit points set to 5."],
      ["hit-points", "12", "Damage", "Hit points, 33 of 54", "Temporary hit points, 0", "12 damage (5 from the temporary hit points)."],
      ["hit-points", "8", "Heal", "Hit points, 41 of 54", "Temporary hit points, 0", "8 healed."],
      ["hit-points", "20", "Set HP", "Hit points, 20 of 54", "Temporary hit points, 0", "Hit points set to 20."],
      ["hit-points", "30", "Damage", "Hit points, 0 of 54", "Temporary hit points, 0", "30 damage."],
      ["hit-points", "3", "Damage", "Hit points, 0 of 54", "Temporary hit points, 0", "3 damage at 0 hit points: one failure."],
      ["hit-points", "100", "Damage", "Hit points, 0 of 54", "Temporary hit points, 0", "100 damage: instant death."],
      ["temporary", "12", "Set temp HP", "Hit points, 0 of 54", "Temporary hit points, 12", "Temporary hit points set to 12."],
      ["temporary", null, "Remove", "Hit points, 0 of 54", "Temporary hit points, 0", "Temporary hit points removed."],
      ["hit-points", "100", "Heal", "Hit points, 54 of 54", "Temporary hit points, 0", "100 healed."],
    ];
    for (const [opener, amount, button, hp, temp, status] of steps) {
      await act(page, opener, amount, button);
      await expect(statusLine(page)).toHaveText(status);
      await expect(hitPoints(page)).toHaveAccessibleName(hp);
      await expect(temporary(page)).toHaveAccessibleName(temp);
      expect(await layout(page), `after "${status}"`).toEqual(before);
    }
  });
}

test("damage at 0 and instant death write the death saves; Heal clears them; the record keeps the values after a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFighter(page);
  await act(page, "hit-points", "0", "Set HP");
  await act(page, "hit-points", "2", "Damage");
  await expect(page.getByRole("slider", { name: "Death save failures" })).toHaveAttribute("aria-valuetext", "1 of 3");
  await act(page, "hit-points", "54", "Damage");
  await expect(page.getByRole("button", { name: "Dead", exact: true })).toBeVisible();
  await expect(within0(page)).toHaveClass("text-caution");
  await act(page, "temporary", "6", "Set temp HP");
  await page.reload();
  await expect(hitPoints(page)).toHaveAccessibleName("Hit points, 0 of 54");
  await expect(temporary(page)).toHaveAccessibleName("Temporary hit points, 6");
  await expect(page.getByRole("button", { name: "Dead", exact: true })).toBeVisible();
  // The status toast starts empty when the sheet opens.
  await expect(statusLine(page)).toHaveText("");
  await act(page, "hit-points", "5", "Heal");
  await expect(page.getByRole("slider", { name: "Death save failures" })).toHaveAttribute("aria-valuetext", "0 of 3");
  await expect(hitPoints(page)).toHaveAccessibleName("Hit points, 5 of 54");
});

/** The current number of the Hit points button at 0. */
const within0 = (page: Page) => hitPoints(page).getByText("0", { exact: true });

test("the keyboard: Enter opens a popup with the focus in its field, Enter in the Amount field does nothing, Escape gives the focus back", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFighter(page);
  await hitPoints(page).focus();
  await page.keyboard.press("Enter");
  const popup = page.getByRole("dialog", { name: "Hit points" });
  await expect(popup.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await page.keyboard.type("9");
  await page.keyboard.press("Enter");
  await expect(popup).toBeVisible();
  await expect(statusLine(page)).toHaveText("");
  // With no number, the note shows in space that the popup keeps.
  const size = await popup.boundingBox();
  await popup.getByRole("textbox", { name: "Amount" }).fill("");
  await popup.getByRole("button", { name: "Damage" }).click();
  await expect(popup.getByText("Type a number of 0 or more.")).toBeVisible();
  expect(await popup.boundingBox()).toEqual(size);
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(hitPoints(page)).toBeFocused();

  await temporary(page).focus();
  await page.keyboard.press("Enter");
  const temp = page.getByRole("dialog", { name: "Temporary hit points" });
  await expect(temp.getByRole("textbox", { name: "Amount" })).toBeFocused();
  await page.keyboard.type("7");
  await page.keyboard.press("Enter");
  await expect(temp).toHaveCount(0);
  await expect(temporary(page)).toBeFocused();
  await expect(statusLine(page)).toHaveText("Temporary hit points set to 7.");
});

test("a hover or the keyboard focus on a part gives the box an inset ring and the number of that part a line under it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFighter(page);
  await act(page, "temporary", "5", "Set temp HP");
  const frame = vitals(page)
    .locator(".ui-framed-box")
    .filter({ has: hitPoints(page) });
  /** The box shadow of the box, and the text decoration of the number of each part: Temporary, then current / max. */
  const looks = () =>
    frame.evaluate((box) => [
      getComputedStyle(box).boxShadow,
      ...[...box.querySelectorAll("[data-hp-part] > span:first-child")].map((number) => getComputedStyle(number).textDecorationLine),
    ]);
  // Tailwind puts empty shadows before the ring, so the ring is the last shadow.
  const ring = expect.stringMatching(/rgb\(.+\) 0px 0px 0px 2px inset$/);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await looks()).toEqual(["none", "none", "none"]);
  await hitPoints(page).hover();
  await expect.poll(looks).toEqual([ring, "none", "underline"]);
  await temporary(page).hover();
  await expect.poll(looks).toEqual([ring, "underline", "none"]);
  await page.mouse.move(0, 0);
  await expect.poll(looks).toEqual(["none", "none", "none"]);
  // The keyboard focus: Tab from Temporary to the hit points.
  await temporary(page).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(temporary(page)).toBeFocused();
  await expect.poll(looks).toEqual([ring, "underline", "none"]);
  await page.keyboard.press("Tab");
  await expect(hitPoints(page)).toBeFocused();
  await expect.poll(looks).toEqual([ring, "none", "underline"]);
  // The ring is in the ink color.
  const ink = await frame.evaluate((box) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--ink)";
    box.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  });
  expect((await looks())[0]?.endsWith(`, ${ink} 0px 0px 0px 2px inset`)).toBe(true);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect.poll(looks).toEqual(["none", "none", "none"]);
});

test("a popup opens under the box; on a phone it has the width of the vitals panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openFighter(page);
  const box = hitPoints(page).locator("xpath=ancestor::div[contains(@class,'ui-framed-box')]");
  await hitPoints(page).click();
  let popup = await page.getByRole("dialog", { name: "Hit points" }).boundingBox();
  let under = (await box.boundingBox())!;
  expect(popup!.y).toBeGreaterThan(under.y + under.height);
  expect(popup!.width).toBe(320);
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await temporary(page).click();
  popup = await page.getByRole("dialog", { name: "Temporary hit points" }).boundingBox();
  under = (await box.boundingBox())!;
  const panel = (await vitals(page).boundingBox())!;
  expect(popup!.y).toBeGreaterThan(under.y + under.height);
  expect([popup!.x, popup!.width]).toEqual([panel.x, panel.width]);
});
