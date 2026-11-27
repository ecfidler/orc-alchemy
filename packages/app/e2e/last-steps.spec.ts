// The Feats, Spells, Equipment and Description steps in the new frame, in a browser (ORC-352,
// docs/design/character-builder.md "The Feats step", "The Spells and Equipment steps", "The Description step" and "No
// layout shift"): a pick does not move a spell selection (in the "Add spells" popup, ORC-357) or a starting equipment
// selection, the feat section names its source, the inventory tables fit a 390px page (ORC-374), and Alignment is the
// first field of the Description step.
import { join } from "node:path";
import { pickFromPicker, pickOption } from "@orc-alchemy/ui/testing/playwright";
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

test("at 390px the inventory tables fit with no page scroll, and an item from Add items shows in its table (ORC-373, ORC-374)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFixture(page, "fighter-20", "Equipment");
  await pickFromPicker(builder(page).getByRole("button", { name: /^Add items/ }), ["Ring of Protection"]);
  const magic = section(page, "Other Magic Items").getByRole("table");
  // The name is the row header (a th), the other parts are cells.
  const row = magic.getByRole("row").last();
  await expect(row.getByRole("rowheader")).toHaveText("Ring of Protection");
  await expect(row.locator("th, td")).toHaveText(["", "Ring of Protection", "", "—", "", ""]);
  // Each column is in the table's box, and the page does not scroll to the side.
  const table = (await magic.boundingBox())!;
  const remove = (await magic.getByRole("button", { name: "Remove Ring of Protection" }).boundingBox())!;
  expect(remove.x + remove.width).toBeLessThanOrEqual(table.x + table.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
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
