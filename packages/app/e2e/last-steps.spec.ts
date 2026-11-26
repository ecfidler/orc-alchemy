// The Feats, Spells, Equipment and Description steps in the new frame, in a browser (ORC-352,
// docs/design/character-builder.md "The Feats step", "The Spells and Equipment steps", "The Description step" and "No
// layout shift"): a pick does not move a spell selection or a starting equipment selection, the feat section names its
// source, Alignment is the first field of the Description step, and the screenshots of the PR.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { addFirstClass, newCharacter, openStep, section, stepButton } from "./builder-helpers.ts";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");
const builder = (page: Page) => page.getByRole("region", { name: "Builder" });

/** The boxes of the locators, for a test that compares them before and after a change. */
const boxes = (locators: Locator[]) => Promise.all(locators.map(async (locator) => (await locator.boundingBox())!));

/** Imports the fixture character and opens it in the builder on the step. */
async function openFixture(page: Page, fixture: string, step: string) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, `${fixture}.strict.json`));
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await openStep(page, step);
}

test("a pick in a spell selection does not move its heading, the chosen line, the filter or the cards", async ({ page }) => {
  await newCharacter(page);
  await addFirstClass(page, "Wizard");
  await openStep(page, "Spells");
  const cantrips = section(page, "Wizard Cantrips Known");
  const heading = cantrips.getByRole("heading").first();
  const chosen = cantrips.getByRole("list", { name: "Chosen: Wizard Cantrips Known" });
  const card = (name: string) => cantrips.getByRole("button", { name, exact: true });
  const parts = [heading, cantrips.getByLabel("Search: Wizard Cantrips Known"), card("Acid Splash"), card("Fire Bolt"), section(page, "Wizard Spells Known")];
  await expect(heading).toHaveAccessibleName("Wizard Cantrips Known, 3 left");
  const before = await boxes(parts);
  await card("Fire Bolt").click();
  await expect(heading).toHaveAccessibleName("Wizard Cantrips Known, 2 left");
  await expect(chosen).toHaveText("Fire Bolt");
  expect(await boxes(parts)).toEqual(before);
  await card("Acid Splash").click();
  await card("Light").click();
  await expect(heading).toHaveAccessibleName("Wizard Cantrips Known, Done");
  expect(await boxes(parts)).toEqual(before);
});

test("a pick in a starting equipment selection does not move it, its cards or the selection below it", async ({ page }) => {
  await newCharacter(page);
  await addFirstClass(page, "Fighter");
  await openStep(page, "Equipment");
  const armor = section(page, "Starting Equipment: Armor");
  const heading = armor.getByRole("heading").first();
  const card = (name: string) => armor.getByRole("button", { name, exact: true });
  await expect(heading).toHaveAccessibleName("Starting Equipment: Armor, 1 left");
  const parts = [armor, heading, card("Chain Mail"), card("Leather Armor, Longbow, 20 Arrows"), section(page, "Starting Equipment: Equipment Pack")];
  const before = await boxes(parts);
  await card("Chain Mail").click();
  await expect(heading).toHaveAccessibleName("Starting Equipment: Armor, Done");
  await expect(card("Chain Mail")).toHaveAttribute("aria-pressed", "true");
  expect(await boxes(parts)).toEqual(before);
  // A pick in the place of the first one moves nothing either.
  await card("Leather Armor, Longbow, 20 Arrows").click();
  await expect(card("Chain Mail")).toHaveAttribute("aria-pressed", "false");
  expect(await boxes(parts)).toEqual(before);
});

test("the feat section names its source, with its mark, and the Customize line is below its control", async ({ page }) => {
  await openFixture(page, "fighter-20", "Feats");
  const feats = section(page, "Feats: Fighter");
  await expect(feats.getByRole("heading").first()).toHaveAccessibleName("Feats: Fighter, Done");
  const control = (await feats.getByRole("group", { name: "Feats" }).boundingBox())!;
  const line = (await feats.getByRole("list", { name: "Customize Feats" }).boundingBox())!;
  expect(line.y).toBeGreaterThanOrEqual(control.y + control.height);
});

test("Alignment is the first field of the Description step, a select; a pick writes it, and the mark keeps its place", async ({ page }) => {
  await newCharacter(page);
  await openStep(page, "Description");
  const alignment = builder(page).getByRole("combobox", { name: /^Alignment/ });
  await expect(alignment).toHaveAccessibleName("Alignment, 1 left");
  const before = await boxes([alignment, builder(page).getByLabel("Player Name")]);
  await pickOption(alignment, "Neutral Good");
  await expect(alignment).toHaveText("Neutral Good");
  await expect(alignment).toHaveAccessibleName(/^Alignment, Done/);
  await expect(stepButton(page, "Description")).toHaveAccessibleName("Description");
  expect(await boxes([alignment, builder(page).getByLabel("Player Name")])).toEqual(before);
  // The Background step no longer shows Alignment.
  await openStep(page, "Background");
  await expect(builder(page).getByText("Alignment")).toHaveCount(0);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/last-steps.spec.ts -g orc-352 --trace off
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  const ready = async (page: Page) => {
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
  };

  for (const theme of ["light", "dark"])
    for (const width of [1280, 390]) {
      const size = width === 390 ? "390" : "desktop";
      test(`orc-352 the Feats, Spells, Equipment and Description steps, ${size}, ${theme}`, async ({ page }) => {
        mkdirSync(dir, { recursive: true });
        const shot = (locator: Locator, what: string) =>
          locator.screenshot({ path: join(dir, `orc-352-${what}-${size}-${theme}.png`), animations: "disabled" });
        await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
        await page.setViewportSize({ width, height: 900 });

        // Feats: fighter-20 takes Grappler.
        await openFixture(page, "fighter-20", "Feats");
        await expect(section(page, "Feats: Fighter").getByRole("list", { name: "Customize Feats" })).toBeVisible();
        await ready(page);
        await shot(builder(page), "feats");
        // Description: the alignment and the fields of fighter-20.
        await openStep(page, "Description");
        await expect(builder(page).getByRole("combobox", { name: /^Alignment/ })).toBeVisible();
        await ready(page);
        await shot(builder(page), "description");

        // Spells and Equipment: a new wizard 1 with one cantrip, and its starting equipment with picks left.
        await newCharacter(page);
        await addFirstClass(page, "Wizard");
        await openStep(page, "Spells");
        await section(page, "Wizard Cantrips Known").getByRole("button", { name: "Fire Bolt", exact: true }).click();
        await expect(section(page, "Wizard Cantrips Known").getByRole("list", { name: /^Chosen/ })).toHaveText("Fire Bolt");
        await ready(page);
        await shot(section(page, "Wizard Cantrips Known"), "spells");
        await openStep(page, "Equipment");
        await section(page, "Starting Equipment: Melee Weapon").getByRole("button", { name: "Quarterstaff", exact: true }).click();
        await ready(page);
        // The starting equipment selections, above the inventory lists.
        const first = (await section(page, "Starting Equipment").boundingBox())!;
        const armor = (await section(page, "Armor").boundingBox())!;
        await page.screenshot({
          path: join(dir, `orc-352-equipment-${size}-${theme}.png`),
          animations: "disabled",
          fullPage: true,
          clip: { x: 0, y: Math.max(0, first.y - 120), width, height: armor.y + armor.height - first.y + 140 },
        });
      });
    }
});
