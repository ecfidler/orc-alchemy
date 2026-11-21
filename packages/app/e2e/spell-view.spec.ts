import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

// The spell view (docs/design/spells-panel.md, "The spell view") in a wide Dialog of @orc-alchemy/ui, in a real browser, with the app's CSS.
// No page shows them yet (ORC-285 puts them in the Spells panel), so this page renders them alone, as e2e/picker.spec.ts does.
// Bun bundles the page's script, e2e/spell-view-demo.ts, once for all tests. See e2e/picker.spec.ts for the reasons.
const script: string = execFileSync(
  "bun",
  [
    "--eval",
    `
    const result = await Bun.build({ entrypoints: ["./spell-view-demo.ts"], define: { "process.env.NODE_ENV": '"development"' } });
    if (!result.success) throw new AggregateError(result.logs);
    process.stdout.write(await result.outputs[0].text());`,
  ],
  { cwd: import.meta.dirname, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);

/** Shows the page with the spell of `key`, and opens the dialog from its button. */
async function show(page: Page, key: string, name: string, theme: "light" | "dark" = "light") {
  await page.goto("/");
  const styles = await page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((link) => link.href));
  const links = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("");
  await page.setContent(`<!doctype html><html data-theme="${theme}"><head>${links}</head><body><div id="root"></div></body></html>`);
  await page.addScriptTag({ content: script });
  await page.evaluate(async ([key, name]) => await window.mountSpell(key!, name!), [key, name]);
  await page.evaluate(() => document.fonts.ready);
  const open = page.getByRole("button", { name: "Open the spell" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Spells" });
  await expect(dialog).toBeVisible();
  return { open, dialog };
}

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

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- spell-view.spec.ts
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-284 the spell view in a wide dialog, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = async (key: string, name: string, what: string) => {
        await show(page, key, name, theme);
        await page.screenshot({ path: join(dir, `orc-284-${what}-${theme}.png`) });
      };
      await page.setViewportSize({ width: 1280, height: 900 });
      await shot("bless", "Bless", "bless");
      await shot("hunters-mark", "Hunter's Mark", "concentration-higher-levels");
      await shot("tsunami", "Tsunami", "no-record");
      await page.setViewportSize({ width: 390, height: 844 });
      await shot("bless", "Bless", "bless-phone");
    });
  }
});
