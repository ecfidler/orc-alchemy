import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const orcbrewDir = join(import.meta.dirname, "../../../fixtures/orcbrew");
const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

/**
 * The visible text that is below WCAG AA (4.5 : 1, or 3 : 1 for large text) against its
 * nearest opaque background. A gradient fill has no single color, so its text is skipped;
 * the package token test checks those pairs (the flag tabs).
 */
const lowContrastText = (page: Page) =>
  page.evaluate(() => {
    const rgb = (color: string) => {
      const parts = color.match(/rgba?\(([^)]+)\)/)?.[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      return parts ? { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 } : null;
    };
    const luminance = ({ r, g, b }: { r: number; g: number; b: number }) =>
      [r, g, b]
        .map((value) => value / 255)
        .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
        .reduce((sum, value, i) => sum + value * [0.2126, 0.7152, 0.0722][i], 0);
    const background = (element: Element | null) => {
      for (; element; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (style.backgroundImage.includes("gradient")) return null;
        const color = rgb(style.backgroundColor);
        if (color && color.a > 0.5) return color;
      }
      return rgb(getComputedStyle(document.documentElement).backgroundColor);
    };
    const low: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement!;
      if (!node.textContent!.trim() || !element.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const style = getComputedStyle(element);
      const back = background(element);
      const fore = rgb(style.color);
      if (!back || !fore) continue;
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
