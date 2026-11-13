import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

// ORC-205: a feat's own uses and its features, made in the feat form, show on a character's sheet.

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");
const combobox = (page: Page, name: string) => page.getByRole("combobox", { name, exact: true });
const group = (page: Page, name: string) => page.getByRole("group", { name, exact: true });

/** Fills a new feat: an action with 3 uses for each long rest, then two features. */
async function makeStormcaller(page: Page) {
  await page.goto("/content/new/feat");
  await page.getByRole("textbox", { name: "Name", exact: true }).fill("Stormcaller");
  await page.getByRole("textbox", { name: "Description", exact: true }).fill("You call a gust of wind that pushes one creature 10 feet.");
  await pickOption(combobox(page, "Feat type"), "Action");
  await group(page, "Feat Uses").getByRole("button", { name: "Fixed" }).click();
  await pickOption(combobox(page, "Feat amount"), "3");
  await addFeature(page, 1, "Steady Footing", "Other", "You have advantage on saving throws against being knocked prone.");
  await addFeature(page, 2, "Rolling Gait", "Bonus Action", "You take the Dash action.");
  await group(page, "Feature 2 Uses").getByRole("button", { name: "Scaled" }).click();
  await pickOption(combobox(page, "Feature 2 equal to"), "Character level × n");
  await group(page, "Feature 2 Recharges").getByRole("button", { name: "Short rest" }).click();
}

async function addFeature(page: Page, n: number, name: string, type: string, text: string) {
  await page.getByRole("button", { name: "Add a feature" }).click();
  await page.getByRole("textbox", { name: `Feature ${n} name` }).fill(name);
  await pickOption(combobox(page, `Feature ${n} type`), type);
  await page.getByRole("textbox", { name: `Feature ${n} description` }).fill(text);
}

/** Imports fighter-1 with the feat in its top-level :feats selection, as the fork's scaled-uses golden has it, and opens the sheet. */
async function importWithFeat(page: Page, key: string) {
  const entity = JSON.parse(readFileSync(join(charactersDir, "fighter-1.strict.json"), "utf8"));
  entity["~:orcpub.entity.strict/selections"].push({ "~:orcpub.entity.strict/key": "~:feats", "~:orcpub.entity.strict/options": [{ "~:orcpub.entity.strict/key": `~:${key}` }] });
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles({ name: "with-feat.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(entity)) });
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
}

const section = (page: Page, title: string) => page.getByRole("heading", { level: 3, name: title, exact: true }).locator("..");

test("a feat with 3 uses for each long rest and two features shows its bubble and its features on the sheet", async ({ page }) => {
  await makeStormcaller(page);
  // The preview of the feat's own entry, for the example character.
  await expect(group(page, "Feat preview").getByRole("button", { name: /^Use / })).toHaveCount(3);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await importWithFeat(page, "stormcaller");
  const feat = section(page, "Actions").getByRole("group", { name: "Stormcaller" });
  await expect(feat.getByRole("button", { name: /^Use / })).toHaveCount(3);
  await expect(feat.getByText("Long rest")).toBeVisible();
  await expect(page.getByRole("group", { name: "Stormcaller" })).toHaveCount(1);
  await expect(section(page, "Features, Traits, and Feats").getByText("Steady Footing")).toBeVisible();
  // A level amount counts the character level: 1.
  const gait = section(page, "Bonus Actions").getByRole("group", { name: "Rolling Gait" });
  await expect(gait.getByRole("button", { name: /^Use / })).toHaveCount(1);
  await expect(gait.getByText("Short rest")).toBeVisible();
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- homebrew-feat-uses.spec.ts -g orc-205
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-205 uses of the feat and its features, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (locator: Locator, what: string) => locator.screenshot({ path: join(dir, `orc-205-${what}-${theme}.png`) });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 1100, height: 900 });

      await makeStormcaller(page);
      await page.evaluate(() => document.fonts.ready);
      const uses = group(page, "Uses of the feat");
      await shot(uses, "fixed-uses");
      await shot(group(page, "Features"), "features");

      // Scaled by the character level, with the sentence.
      await group(page, "Feat Uses").getByRole("button", { name: "Scaled" }).click();
      await pickOption(combobox(page, "Feat equal to"), "Character level × n");
      await pickOption(combobox(page, "Feat n"), "2");
      await expect(uses.getByText("Uses equal 2 × your character level. A level 5 character gets 10.")).toBeVisible();
      await shot(uses, "scaled-uses");

      // Back to 3 uses for each long rest, saved, on a character's sheet.
      await group(page, "Feat Uses").getByRole("button", { name: "Fixed" }).click();
      await pickOption(combobox(page, "Feat amount"), "3");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page).toHaveURL(/\/content$/);
      await importWithFeat(page, "stormcaller");
      const features = page.getByRole("group", { name: "Features & traits" });
      await expect(features.getByRole("group", { name: "Stormcaller" })).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await shot(features, "sheet");
    });
  }
});
