import { expect, test } from "@playwright/test";

const pageColor = (page: import("@playwright/test").Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);

test("with no stored theme, the app follows the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  expect(await pageColor(page)).toBe("rgb(255, 252, 245)");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");

  await page.emulateMedia({ colorScheme: "dark" });
  expect(await pageColor(page)).toBe("rgb(0, 0, 0)");
});

test("a stored dark theme is dark on first paint", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  // Stop the app's module script, so that only the inline head script can set the theme.
  await page.route(/\/assets\/.*\.js$/, (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await pageColor(page)).toBe("rgb(0, 0, 0)");
});

test("a stored light theme wins over a dark system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.goto("/");
  expect(await pageColor(page)).toBe("rgb(255, 252, 245)");
});

test("the body font is Newsreader, served by the app", async ({ page }) => {
  const origins = new Set<string>();
  page.on("request", (request) => origins.add(new URL(request.url()).origin));
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Alchemy 5e" })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toMatch(/^"Newsreader Variable"/);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('450 17px "Newsreader Variable"'))).toBe(true);
  expect([...origins]).toEqual([new URL(page.url()).origin]);
});
