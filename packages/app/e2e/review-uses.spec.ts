import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { REVIEW_PACK, REVIEW_PACK_FILE, REVIEW_ROWS, reviewOrcbrew } from "../src/components/builders/test-review-pack.ts";

// ORC-207: the Review uses page. The import log and My Content link to it; Save writes the checked rows, and
// the unchecked rows with a suggestion are skipped in this browser.

const HINTS = REVIEW_ROWS.filter(([, kind]) => kind === "hint").map(([name]) => name);
const box = (page: Page, name: string) => page.getByRole("checkbox", { name, exact: true });

async function importPack(page: Page) {
  await page.goto("/import");
  await page.getByLabel("Load homebrew file").setInputFiles({ name: REVIEW_PACK_FILE, mimeType: "application/edn", buffer: Buffer.from(reviewOrcbrew()) });
  await expect(page.getByRole("region", { name: "Import log" })).toBeVisible();
}

test("the import log links to the page; Save writes the checked rows; a skipped row stays skipped after a reload", async ({ page }) => {
  await importPack(page);
  const uses = page.getByRole("list", { name: "Suggested uses" });
  await expect(uses).toHaveText(`${REVIEW_ROWS.length} features may have uses. Review uses`);
  await uses.getByRole("link", { name: "Review uses" }).click();
  await expect(page.getByRole("heading", { name: `Review uses: ${REVIEW_PACK}` })).toBeVisible();
  await expect(box(page, "Sea Hag Tidal Surge")).toBeChecked();
  await expect(box(page, "Pearl Diver Old Charm")).not.toBeChecked();

  // A hint row is checked once its control is filled.
  await page.getByRole("group", { name: "Pearl Diver Old Charm Uses" }).getByRole("button", { name: "Fixed" }).click();
  await expect(box(page, "Pearl Diver Old Charm")).toBeChecked();
  await box(page, "Sea Hag Song of Courage").click();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(`Saved ${REVIEW_ROWS.length - HINTS.length} features. Skipped 1.`);
  await expect(box(page, "Sea Hag Song of Courage")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: `Review uses: ${REVIEW_PACK}` })).toBeVisible();
  await expect(box(page, "Tidecaller Old Charm")).toBeVisible();
  await expect(box(page, "Sea Hag Song of Courage")).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Show skipped" }).click();
  await expect(box(page, "Sea Hag Song of Courage")).not.toBeChecked();

  // My Content counts the hint rows that stay, and links to the page.
  await page.goto("/content");
  const pack = page.getByRole("region", { name: REVIEW_PACK });
  await expect(pack.getByText(`${HINTS.length - 1} features may have uses.`)).toBeVisible();
  await pack.getByRole("link", { name: `Review uses in ${REVIEW_PACK}` }).click();
  await expect(page.getByRole("heading", { name: `Review uses: ${REVIEW_PACK}` })).toBeVisible();
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- review-uses.spec.ts -g orc-207
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-207 review uses, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (locator: Locator, what: string) => locator.screenshot({ path: join(dir, `orc-207-${what}-${theme}.png`) });
      const view = (what: string) => page.screenshot({ path: join(dir, `orc-207-${what}-${theme}.png`) });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 1100, height: 1000 });

      await importPack(page);
      await page.evaluate(() => document.fonts.ready);
      await shot(page.getByRole("region", { name: "Import log" }), "import-log");

      await page.goto("/content");
      await shot(page.getByRole("region", { name: REVIEW_PACK }), "my-content");

      await page.goto(`/content/review-uses/${encodeURIComponent(REVIEW_PACK)}`);
      await expect(box(page, "Pearl Diver Old Charm")).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await view("page");

      await box(page, "Sea Hag Song of Courage").click();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByRole("status")).toContainText("Skipped 1.");
      await page.getByRole("checkbox", { name: "Show skipped" }).click();
      await expect(box(page, "Sea Hag Song of Courage")).toBeVisible();
      await view("after-save");
    });
  }
});
