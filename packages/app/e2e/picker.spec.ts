import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { pickFromPicker, removeToken } from "@orc-alchemy/ui/testing/playwright";

// The picker controls of @orc-alchemy/ui (docs/design/homebrew-forms.md, "Controls") in a real browser, with the app's CSS.
// No form uses them yet (ORC-197 to ORC-202), so this page renders them alone.
// Playwright compiles JSX in the files it loads as component-test JSX, so Bun bundles the page's script, e2e/picker-demo.ts, once for all tests.
// For Bun 1.0, which CI runs: the entry point is a real file, because Bun 1.0 does not resolve an entry point through a
// plugin; and React is the development build, because Bun 1.0 compiles the package's JSX to jsxDEV, which only that build has.
const script: string = execFileSync(
  "bun",
  [
    "--eval",
    `
    const result = await Bun.build({ entrypoints: ["./picker-demo.ts"], define: { "process.env.NODE_ENV": '"development"' } });
    if (!result.success) throw new AggregateError(result.logs);
    process.stdout.write(await result.outputs[0].text());`,
  ],
  { cwd: import.meta.dirname, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
);

async function show(page: Page, name: string, theme: "light" | "dark" = "light") {
  await page.goto("/");
  const styles = await page.evaluate(() => [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')].map((link) => link.href));
  const links = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("");
  await page.setContent(`<!doctype html><html data-theme="${theme}"><head>${links}</head><body><div id="root"></div></body></html>`);
  await page.addScriptTag({ content: script });
  await page.evaluate((name) => window.mount(name), name);
  await page.evaluate(() => document.fonts.ready);
}

test("the picker with the keyboard: Enter opens it, the focus is in the search field, and Escape gives it back", async ({ page }) => {
  await show(page, "picker");
  const add = page.getByRole("button", { name: "Add a fruit" });
  await expect(add).toHaveAccessibleDescription("17 more");
  await add.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Add fruit" });
  await expect(dialog.getByRole("searchbox", { name: "Search" })).toBeFocused();
  await page.keyboard.type("an");
  await expect(dialog.locator(".ui-list-row")).toHaveText(["OrangeAdd", "TangerineAdd", "BananaAdd", "MangoAdd"]);
  await page.keyboard.press("ArrowDown");
  const orange = await dialog.getByRole("button", { name: "Orange", exact: true }).elementHandle();
  await expect(dialog.getByRole("button", { name: "Orange", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  // The picked row's button leaves, and the focus goes to the next row: another button.
  await expect(dialog.getByRole("button", { name: "Tangerine" })).toBeFocused();
  expect(await orange!.evaluate((row) => row.isConnected)).toBe(false);
  await expect(dialog.getByRole("status")).toHaveText("5 on the form");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(add).toBeFocused();
  await expect(page.locator(".ui-token-label")).toHaveText(["Apple", "Pear", "Lime", "Orange", "Fig"]);
});

test("the Playwright helpers pick from a picker and remove a token", async ({ page }) => {
  await show(page, "picker");
  await pickFromPicker(page.getByRole("button", { name: "Add a fruit" }), ["Plum", /^Kiwi$/]);
  await expect(page.locator(".ui-token-label")).toHaveText(["Apple", "Pear", "Plum", "Lime", "Fig", "Kiwi"]);
  const pearX = await page.getByRole("button", { name: "Remove Pear" }).elementHandle();
  await removeToken(page.locator(".ui-picker"), "Pear");
  await expect(page.locator(".ui-token-label")).toHaveText(["Apple", "Plum", "Lime", "Fig", "Kiwi"]);
  // The removed token's X leaves, and the focus goes to the next token's X.
  expect(await pearX!.evaluate((x) => x.isConnected)).toBe(false);
  await expect(page.getByRole("button", { name: "Remove Plum" })).toBeFocused();
});

test("a list that closes on a click: a click outside closes it, and a pick closes it", async ({ page }) => {
  await show(page, "list");
  const add = page.getByRole("button", { name: "Add a basket" });
  await add.click();
  const dialog = page.getByRole("dialog", { name: "Add a basket" });
  await expect(dialog.getByRole("button", { name: "Any melon" })).toBeFocused();
  await page.mouse.click(5, 5);
  await expect(dialog).toBeHidden();
  await pickFromPicker(add, "Berries");
  await expect(page.getByTestId("baskets")).toHaveText("berries");
  await expect(add).toBeFocused();
});

test("the chips with the keyboard: Enter opens the add menu, the arrow keys move, and Enter adds a row", async ({ page }) => {
  await show(page, "chips");
  const add = page.getByRole("button", { name: "Add a row" });
  await add.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "Row 1", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem", { name: "Row 3", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(page.getByTestId("rows")).toHaveText("4,8,12,16,19,3");
  await expect(page.locator(".ui-token-label")).toHaveText(["3", "4", "8", "12", "16", "19"]);
  await expect(add).toBeFocused();
});

test("on a phone the modal fills the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 760 });
  await show(page, "picker");
  await page.getByRole("button", { name: "Add a fruit" }).click();
  const box = await page.getByRole("dialog").boundingBox();
  expect(box).toEqual({ x: 0, y: 0, width: 390, height: 760 });
});

test("tokens wrap on one line, and a long name wraps inside its token", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 600 });
  await show(page, "tokens");
  const line = (await page.locator(".ui-tokens").boundingBox())!;
  const tokens = await page.locator(".ui-token").evaluateAll((all) => all.map((t) => t.getBoundingClientRect().toJSON() as DOMRect));
  expect(new Set(tokens.map((t) => Math.round(t.top))).size).toBeGreaterThan(1);
  for (const t of tokens) expect(t.right).toBeLessThanOrEqual(line.x + line.width + 0.5);
  expect(tokens[2]!.height).toBeGreaterThan(40);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- picker.spec.ts
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2, viewport: { width: 760, height: 820 } });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  const shot = (what: string, theme: string) => join(dir, `orc-196-${what}-${theme}.png`);
  for (const theme of ["light", "dark"] as const) {
    test(`the picker controls, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const main = page.locator("main");
      await show(page, "picker", theme);
      await main.screenshot({ path: shot("picker-closed", theme) });
      await page.getByRole("button", { name: "Add a fruit" }).click();
      await page.getByRole("button", { name: "Banana" }).click();
      await page.getByRole("button", { name: "Banana" }).waitFor({ state: "detached" });
      await page.screenshot({ path: shot("picker-modal", theme) });

      await show(page, "list", theme);
      await page.getByRole("button", { name: "Add a basket" }).click();
      await page.getByRole("dialog").waitFor();
      await page.screenshot({ path: shot("list-modal", theme) });

      await page.setViewportSize({ width: 480, height: 400 });
      await show(page, "tokens", theme);
      await main.screenshot({ path: shot("tokens", theme) });

      await show(page, "toggle", theme);
      await main.screenshot({ path: shot("number-toggle", theme) });

      await page.setViewportSize({ width: 760, height: 520 });
      await show(page, "chips", theme);
      await page.getByRole("button", { name: "Add a row" }).click();
      await page.getByRole("menu").waitFor();
      await page.screenshot({ path: shot("chips-menu", theme) });

      await page.setViewportSize({ width: 390, height: 760 });
      await show(page, "picker", theme);
      await page.getByRole("button", { name: "Add a fruit" }).click();
      await page.getByRole("dialog").waitFor();
      await page.screenshot({ path: shot("picker-phone", theme) });
    });
  }
});
