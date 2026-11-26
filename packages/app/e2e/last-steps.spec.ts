// The Feats, Spells, Equipment and Description steps in the new frame, in a browser (ORC-352,
// docs/design/character-builder.md "The Feats step", "The Spells and Equipment steps", "The Description step" and "No
// layout shift"): a pick does not move a spell selection or a starting equipment selection, the feat section names its
// source, and Alignment is the first field of the Description step.
import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { addFirstClass, builder, newCharacter, openFixture, openStep, section, stepButton } from "./builder-helpers.ts";

/** The boxes of the locators, for a test that compares them before and after a change. */
const boxes = (locators: Locator[]) => Promise.all(locators.map(async (locator) => (await locator.boundingBox())!));

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

test("on a 390px page, a pick in a spell selection does not move the filter or the cards either", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await newCharacter(page);
  await addFirstClass(page, "Wizard");
  await openStep(page, "Spells");
  const cantrips = section(page, "Wizard Cantrips Known");
  const card = (name: string) => cantrips.getByRole("button", { name, exact: true });
  const parts = [cantrips.getByLabel("Search: Wizard Cantrips Known"), card("Acid Splash"), section(page, "Wizard Spells Known")];
  const before = await boxes(parts);
  for (const name of ["Prestidigitation", "Acid Splash", "Fire Bolt"]) await card(name).click();
  await expect(cantrips.getByRole("heading").first()).toHaveAccessibleName("Wizard Cantrips Known, Done");
  expect(await boxes(parts)).toEqual(before);
});

/** The one-line text fields of the Description step, in their order. */
const ONE_LINE = ["Player Name", "Age", "Sex", "Height", "Weight", "Hair Color", "Eye Color", "Skin Color"];

/** The count of the columns of the one-line fields of the Description step, and true when a field goes past the step. */
async function descriptionColumns(page: Page) {
  const step = (await builder(page).boundingBox())!;
  const fields = await boxes(ONE_LINE.map((label) => builder(page).getByLabel(label, { exact: true })));
  return { columns: new Set(fields.map((b) => Math.round(b.x))).size, overflow: fields.some((b) => b.x + b.width > step.x + step.width + 0.5) };
}

test("the one-line fields of the Description step are three in a row on a wide step and one on a narrow step, with no overflow", async ({ page }) => {
  for (const [width, columns] of [
    [1280, 3],
    [1800, 3],
    [730, 1],
    [390, 1],
  ]) {
    await page.setViewportSize({ width, height: 900 });
    if (width === 1280) {
      await newCharacter(page);
      await openStep(page, "Description");
    }
    await expect(builder(page).getByLabel("Player Name")).toBeVisible();
    expect(await descriptionColumns(page), `${width}px`).toEqual({ columns, overflow: false });
  }
});
