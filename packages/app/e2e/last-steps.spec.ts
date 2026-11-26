// The Feats, Spells, Equipment and Description steps in the new frame, in a browser (ORC-352,
// docs/design/character-builder.md "The Feats step", "The Spells and Equipment steps", "The Description step" and "No
// layout shift"): a pick does not move a spell selection (in the "Add spells" popup, ORC-357) or a starting equipment
// selection, the feat section names its
// source, Alignment is the first field of the Description step, and the screenshots of the PR.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { addFirstClass, addSpells, builder, newCharacter, openFixture, openStep, section, stepButton } from "./builder-helpers.ts";

/** The boxes of the locators, for a test that compares them before and after a change. */
const boxes = (locators: Locator[]) => Promise.all(locators.map(async (locator) => (await locator.boundingBox())!));

/** The parts of the Spells step of a new wizard 1 that a pick must not move (ORC-357). */
const spellParts = (page: Page) => {
  const cantrips = section(page, "Wizard Cantrips Known");
  const spells = section(page, "Wizard Spells Known");
  return [
    cantrips,
    cantrips.getByRole("heading").first(),
    cantrips.getByRole("button", { name: "Add spells: Wizard Cantrips Known" }),
    spells,
    spells.getByRole("heading").first(),
    spells.getByRole("button", { name: "Add spells: Wizard Spells Known" }),
  ];
};

test("orc-357 a new wizard adds a cantrip and a 1st-level spell in the popups, and nothing on the step moves", async ({ page }) => {
  await newCharacter(page);
  await addFirstClass(page, "Wizard");
  await openStep(page, "Spells");
  const cantrips = section(page, "Wizard Cantrips Known");
  const heading = cantrips.getByRole("heading").first();
  await expect(heading).toHaveAccessibleName("Wizard Cantrips Known, 3 left");
  const before = await boxes(spellParts(page));

  // The popup: the heading and the count, the list, the box of a row and the spell view.
  const add = cantrips.getByRole("button", { name: "Add spells: Wizard Cantrips Known" });
  await add.click();
  const popup = page.getByRole("dialog", { name: "Wizard Cantrips Known" });
  const title = popup.getByRole("heading", { level: 2 });
  await expect(title).toHaveAccessibleName("Wizard Cantrips Known, 3 left");
  // The first row has the focus, and the spell view shows its spell.
  await expect(popup.getByRole("button", { name: "Acid Splash, not chosen" })).toBeFocused();
  await expect(popup.getByRole("region", { name: "Acid Splash" })).toBeVisible();
  const rows = [popup.getByRole("button", { name: /^Fire Bolt/ }), popup.getByRole("button", { name: /^Light/ }), title];
  const rowsBefore = await boxes(rows);
  await popup.getByRole("checkbox", { name: "Chosen: Fire Bolt" }).click();
  await expect(title).toHaveAccessibleName("Wizard Cantrips Known, 2 left");
  // A pick moves nothing in the popup either.
  expect(await boxes(rows)).toEqual(rowsBefore);
  // Escape closes the popup, and the focus goes back to the button.
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(add).toBeFocused();
  await expect(heading).toHaveAccessibleName("Wizard Cantrips Known, 2 left");
  await expect(cantrips.getByRole("list", { name: "Chosen: Wizard Cantrips Known" })).toHaveText("Fire Bolt");
  expect(await boxes(spellParts(page))).toEqual(before);

  await addSpells(page, "Wizard Spells Known", ["Magic Missile"]);
  await expect(section(page, "Wizard Spells Known").getByRole("list", { name: "Chosen: Wizard Spells Known" })).toHaveText("Magic Missile");
  await expect(stepButton(page, "Spells")).toHaveAccessibleName("Spells, 7 picks left");
  expect(await boxes(spellParts(page))).toEqual(before);
  // At the maximum, the other boxes are disabled, with the reason.
  await addSpells(page, "Wizard Cantrips Known", ["Acid Splash", "Light"]);
  await expect(heading).toHaveAccessibleName("Wizard Cantrips Known, Done");
  expect(await boxes(spellParts(page))).toEqual(before);
  // A name opens the popup at its spell.
  await cantrips.getByRole("button", { name: "Light", exact: true }).click();
  await expect(popup.getByRole("button", { name: /^Light, chosen/ })).toBeFocused();
  await expect(popup.getByRole("checkbox", { name: "Chosen: Mending" })).toBeDisabled();
  await expect(popup.getByRole("checkbox", { name: "Chosen: Mending" })).toHaveAccessibleDescription("Remove a spell first.");
  await popup.getByRole("button", { name: "Done" }).click();
  await expect(cantrips.getByRole("button", { name: "Light", exact: true })).toBeFocused();
});

/** Opens the warlock 20 of the e2e tests, which has SRD content only, on the Spells step. */
async function openWarlock(page: Page) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(import.meta.dirname, "warlock-20.strict.json"));
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await openStep(page, "Spells");
}

test("orc-357 Eldritch Invocations of a warlock 20 has the control of its kind, and its spell selections have the popup", async ({ page }) => {
  await openWarlock(page);
  const invocations = section(page, "Eldritch Invocations");
  await expect(invocations.getByRole("heading").first()).toHaveAccessibleName("Eldritch Invocations, Done");
  // 8 picks from more than 6 options: the ui Picker, with the picks as tokens.
  await expect(invocations.getByRole("button", { name: /^Add spells/ })).toHaveCount(0);
  await expect(invocations.locator(".ui-add-button")).toBeVisible();
  await expect(invocations.locator(".ui-token-label")).toHaveCount(8);
  await expect(section(page, "Warlock Cantrips Known").getByRole("button", { name: "Add spells: Warlock Cantrips Known" })).toBeVisible();
});

for (const width of [1280, 390])
  test(`orc-357 the picks of a selection with levels show as a comma separated list for each level, and a pick moves nothing, ${width}px`, async ({ page }) => {
    // Twelve picks in the warlock 20 take about 30 s.
    test.slow();
    await page.setViewportSize({ width, height: 900 });
    await openWarlock(page);
    const known = section(page, "Warlock Spells Known");
    const list = known.getByRole("list", { name: "Chosen: Warlock Spells Known" });
    const level = (heading: string) => list.getByRole("listitem").filter({ hasText: new RegExp(`^${heading}`) });
    // A line group for each level, with its label in front of its names. The commas are not in the accessibility tree.
    await expect(level("3rd level")).toHaveText("3rd levelCounterspell, Fear, Gaseous Form, Hypnotic Pattern, Remove Curse, Vampiric Touch");
    expect(await level("3rd level").ariaSnapshot()).not.toContain(",");
    const parts = [known, known.getByRole("heading").first(), known.getByRole("button", { name: "Add spells: Warlock Spells Known" })];
    const before = await boxes(parts);
    // Remove all the picks of the 3rd level, then add them again: nothing moves.
    const third = ["Counterspell", "Fear", "Gaseous Form", "Hypnotic Pattern", "Remove Curse", "Vampiric Touch"];
    await addSpells(page, "Warlock Spells Known", third);
    await expect(level("3rd level")).toHaveCount(0);
    expect(await boxes(parts)).toEqual(before);
    await addSpells(page, "Warlock Spells Known", third);
    await expect(known.getByRole("heading").first()).toHaveAccessibleName("Warlock Spells Known, Done");
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

test("orc-357 on a 390px page, the popup fills the screen with two views, and a pick moves nothing on the step", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await newCharacter(page);
  await addFirstClass(page, "Wizard");
  await openStep(page, "Spells");
  const before = await boxes(spellParts(page));
  await section(page, "Wizard Cantrips Known").getByRole("button", { name: "Add spells: Wizard Cantrips Known" }).click();
  const popup = page.getByRole("dialog", { name: "Wizard Cantrips Known" });
  // The list and the spell view are two views: a tap on a row shows the spell view, with "Back to the list".
  await expect(popup.locator('[data-pane="spell"]')).toBeHidden();
  await popup.getByRole("button", { name: /^Fire Bolt/ }).click();
  await expect(popup.getByRole("button", { name: "Back to the list" })).toBeFocused();
  await popup.getByRole("region", { name: "Fire Bolt" }).getByRole("checkbox", { name: "Chosen" }).click();
  await expect(popup.getByRole("heading", { level: 2 })).toHaveAccessibleName("Wizard Cantrips Known, 2 left");
  await popup.getByRole("button", { name: "Back to the list" }).click();
  await expect(popup.getByRole("button", { name: /^Fire Bolt, chosen/ })).toBeFocused();
  for (const name of ["Prestidigitation", "Acid Splash"]) await popup.getByRole("checkbox", { name: `Chosen: ${name}` }).click();
  // The popup fits in the page.
  expect((await popup.boundingBox())!.width).toBeLessThanOrEqual(390);
  await popup.getByRole("button", { name: "Done" }).click();
  await expect(section(page, "Wizard Cantrips Known").getByRole("heading").first()).toHaveAccessibleName("Wizard Cantrips Known, Done");
  expect(await boxes(spellParts(page))).toEqual(before);
  await addSpells(page, "Wizard Spells Known", ["Magic Missile", "Shield"]);
  expect(await boxes(spellParts(page))).toEqual(before);
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
        await addSpells(page, "Wizard Cantrips Known", ["Fire Bolt"]);
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

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/last-steps.spec.ts -g orc-357 --trace off
test.describe("screenshots of the Add spells popup", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");

  // The project rule: desktop and light mode only.
  const theme = "light";
  const width = 1280;
  const size = "desktop";

  test(`orc-357 the Spells step and the Add spells popup, ${size}, ${theme}`, async ({ page }) => {
    mkdirSync(dir, { recursive: true });
    const path = (what: string) => join(dir, `orc-357-${what}-${size}-${theme}.png`);
    await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
    await page.setViewportSize({ width, height: 900 });
    const ready = async () => {
      await page.evaluate(() => document.fonts.ready);
      await page.mouse.move(0, 0);
    };
    // A new wizard 1 with two cantrips and three 1st-level spells.
    await newCharacter(page);
    await addFirstClass(page, "Wizard");
    await openStep(page, "Spells");
    await addSpells(page, "Wizard Cantrips Known", ["Fire Bolt", "Mage Hand"]);
    await addSpells(page, "Wizard Spells Known", ["Magic Missile", "Shield", "Mage Armor"]);
    await ready();
    // The step: the two spell selections, above the prepared spells.
    const first = (await section(page, "Wizard Cantrips Known").boundingBox())!;
    const second = (await section(page, "Wizard Spells Known").boundingBox())!;
    await page.screenshot({
      path: path("step"),
      animations: "disabled",
      fullPage: true,
      clip: { x: 0, y: Math.max(0, first.y - 140), width, height: second.y + second.height - first.y + 170 },
    });
    // The popup of the spellbook, at Shield: its row has the box, and the spell view has the Chosen box.
    await section(page, "Wizard Spells Known").getByRole("button", { name: "Shield", exact: true }).click();
    const popup = page.getByRole("dialog", { name: "Wizard Spells Known" });
    await expect(popup.getByRole("region", { name: "Shield" })).toBeVisible();
    await ready();
    await page.screenshot({ path: path("popup"), animations: "disabled" });
  });

  test(`orc-357 the picks of a selection with levels, a warlock 20, ${size}, ${theme}`, async ({ page }) => {
    mkdirSync(dir, { recursive: true });
    await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
    await page.setViewportSize({ width, height: 900 });
    await openWarlock(page);
    const known = section(page, "Warlock Spells Known");
    await known.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    const box = (await known.boundingBox())!;
    const top = box.y + (await page.evaluate(() => window.scrollY));
    await page.screenshot({
      path: join(dir, `orc-357-step-levels-${size}-${theme}.png`),
      animations: "disabled",
      fullPage: true,
      clip: { x: 0, y: Math.max(0, top - 120), width, height: box.height + 200 },
    });
  });

  test(`orc-357 the Eldritch Invocations control of a warlock 20, ${size}, ${theme}`, async ({ page }) => {
    mkdirSync(dir, { recursive: true });
    await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
    await page.setViewportSize({ width, height: 900 });
    await openWarlock(page);
    const invocations = section(page, "Eldritch Invocations");
    await invocations.scrollIntoViewIfNeeded();
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    // The clip of a full page screenshot is in page coordinates.
    const box = (await invocations.boundingBox())!;
    const top = box.y + (await page.evaluate(() => window.scrollY));
    await page.screenshot({
      path: join(dir, `orc-357-invocations-${size}-${theme}.png`),
      animations: "disabled",
      fullPage: true,
      clip: { x: 0, y: Math.max(0, top - 120), width, height: box.height + 240 },
    });
  });
});
