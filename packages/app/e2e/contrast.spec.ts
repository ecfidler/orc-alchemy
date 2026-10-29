import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const orcbrewDir = join(import.meta.dirname, "../../../fixtures/orcbrew");
const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

/**
 * The visible text that is below WCAG AA (4.5 : 1, or 3 : 1 for large text) against its
 * nearest opaque background. A gradient fill has no single color, so its text is skipped;
 * the package token test checks those pairs (the flag tabs). Out of scope: field values and
 * placeholders (they are not text nodes) and text that an ancestor's opacity fades.
 */
const lowContrastText = (page: Page) =>
  page.evaluate(() => {
    // A canvas turns any CSS color (rgb, color-mix, color(srgb ...)) into RGB and alpha.
    const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true })!;
    const rgb = (color: string) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return { r, g, b, a: a / 255 };
    };
    type Rgb = ReturnType<typeof rgb>;
    const over = (top: Rgb, below: Rgb) => ({
      r: top.r * top.a + below.r * (1 - top.a),
      g: top.g * top.a + below.g * (1 - top.a),
      b: top.b * top.a + below.b * (1 - top.a),
      a: 1,
    });
    const luminance = ({ r, g, b }: Rgb) =>
      [r, g, b]
        .map((value) => value / 255)
        .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
        .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    // The element's background: every layer from the page down, blended in order.
    const background = (element: Element) => {
      const layers: Element[] = [];
      for (let e: Element | null = element; e && e !== document.documentElement; e = e.parentElement) layers.unshift(e);
      let color = rgb(getComputedStyle(document.documentElement).backgroundColor);
      for (const layer of layers) {
        const style = getComputedStyle(layer);
        if (style.backgroundImage.includes("gradient")) return null;
        color = over(rgb(style.backgroundColor), color);
      }
      return color;
    };
    const low: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement!;
      if (!node.textContent!.trim() || !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const style = getComputedStyle(element);
      const back = background(element);
      if (!back) continue;
      const fore = over(rgb(style.color), back);
      const [light, dark] = [luminance(fore), luminance(back)].sort((a, b) => b - a);
      const ratio = (light + 0.05) / (dark + 0.05);
      const size = parseFloat(style.fontSize);
      const large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) low.push(`${ratio.toFixed(2)} : 1 "${node.textContent!.trim().slice(0, 40)}"`);
    }
    return low;
  });

const pages: [string, (page: Page) => Promise<void>][] = [
  ["Home", async (page) => void (await page.goto("/"))],
  [
    "Builder",
    async (page) => {
      await page.goto("/");
      await page.getByRole("button", { name: "New character" }).click();
      await expect(page.getByRole("region", { name: "Builder" })).toBeVisible();
    },
  ],
  [
    "Import, with an import log",
    async (page) => {
      await page.goto("/import");
      await page.getByLabel("Load homebrew file").setInputFiles(join(orcbrewDir, "warlock-test-content.orcbrew"));
      await expect(page.getByRole("region", { name: "Import log" })).toBeVisible();
    },
  ],
  [
    "Character sheet, with spells",
    async (page) => {
      await page.goto("/import");
      await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "wizard-5.strict.json"));
      await expect(page).toHaveURL(/\/sheet\//);
    },
  ],
  ["My Content", async (page) => void (await page.goto("/content"))],
  ["Homebrew monster form", async (page) => void (await page.goto("/content/new/monster"))],
  ["Homebrew spell form", async (page) => void (await page.goto("/content/new/spell"))],
  ["DM's Vault exporter", async (page) => void (await page.goto("/import/dmv"))],
  ["Preferences", async (page) => void (await page.goto("/preferences"))],
];

for (const colorScheme of ["light", "dark"] as const) {
  for (const [name, open] of pages) {
    test(`${name}: all text passes AA in ${colorScheme} mode`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await open(page);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await lowContrastText(page)).toEqual([]);
    });
  }
}
