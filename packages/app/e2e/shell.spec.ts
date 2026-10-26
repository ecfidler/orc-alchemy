import { expect, test, type Page } from "@playwright/test";

const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Main" }).getByRole("link", { name });

test("the rail is on the left, and at 680px and below it is a strip along the top", async ({ page }) => {
  await page.goto("/");
  const rail = page.getByRole("complementary");
  const main = page.getByRole("main");
  expect((await rail.boundingBox())!.width).toBe(200);
  expect((await main.boundingBox())!.x).toBeGreaterThanOrEqual(200);

  await page.setViewportSize({ width: 390, height: 800 });
  const strip = (await rail.boundingBox())!;
  expect(strip.width).toBe(390);
  expect((await main.boundingBox())!.y).toBeGreaterThanOrEqual(strip.y + strip.height);
  // The current tab is taller than the others.
  expect((await tab(page, "Characters").boundingBox())!.height).toBeGreaterThan((await tab(page, "Import").boundingBox())!.height);
});

test("a tab moves out on hover, except under reduced motion", async ({ page }) => {
  await page.goto("/");
  const width = async () => (await tab(page, "Import").boundingBox())!.width;
  const rest = await width();
  await tab(page, "Import").hover();
  await expect.poll(width).toBeGreaterThan(rest);

  await page.mouse.move(600, 600);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(width).toBe(rest);
  await tab(page, "Import").hover();
  expect(await width()).toBe(rest);
});

test("the potion is the favicon and the rail mark", async ({ page, request }) => {
  await page.goto("/");
  await expect(page.locator('link[rel="icon"][sizes="16x16"]')).toHaveAttribute("href", "/potion-16.png");
  for (const size of [16, 32, 256, 512]) {
    const response = await request.get(`/potion-${size}.png`);
    expect(response.headers()["content-type"]).toBe("image/png");
  }
  const mark = page.getByRole("link", { name: "Alchemy 5e" }).locator("img");
  await expect(mark).toHaveCSS("image-rendering", "pixelated");
  expect(await mark.evaluate((img: HTMLImageElement) => [img.naturalWidth, img.width])).toEqual([32, 32]);
});
