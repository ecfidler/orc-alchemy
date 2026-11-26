import { expect, test } from "@playwright/test";
import { showSpellView as show } from "./spell-view-page.ts";

// The spell view (docs/design/spells-panel.md, "The spell view") in a wide Dialog of @orc-alchemy/ui, in a real browser, with the app's CSS.
// The Spells panel (ORC-285, e2e/spells-panel.spec.ts) shows them on the sheet; this page tests the view alone, as e2e/picker.spec.ts does.
// e2e/spell-view-page.ts shows the page.

test("a wide dialog holds the focus, closes with the X and with Escape, and gives the focus back", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { open, dialog } = await show(page, "bless", "Bless");
  expect((await dialog.boundingBox())!.width).toBe(1100);
  const close = dialog.getByRole("button", { name: "Close" });
  // The spell view has no control, so the X has the focus, and Tab keeps it in the dialog.
  await expect(close).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();

  await open.press("Enter");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
});

test("at 390px the wide dialog fills the screen, its X is 44px, and the page does not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { dialog } = await show(page, "banishment", "Banishment");
  expect(await dialog.boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  const x = (await dialog.getByRole("button", { name: "Close" }).boundingBox())!;
  expect([x.width, x.height]).toEqual([44, 44]);
  const body = dialog.locator(".ui-modal-body");
  expect(await body.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test("a line of the description holds about 70 characters", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { dialog } = await show(page, "banishment", "Banishment");
  const view = dialog.getByRole("region", { name: "Banishment" });
  const first = view.locator("dl ~ div p").first();
  // The width of the paragraph over the mean width of a character of its text, in its font.
  const perLine = await first.evaluate((p) => {
    const context = document.createElement("canvas").getContext("2d")!;
    const style = getComputedStyle(p);
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const text = p.textContent!;
    return p.getBoundingClientRect().width / (context.measureText(text).width / text.length);
  });
  expect(perLine).toBeGreaterThan(62);
  expect(perLine).toBeLessThan(78);
});
