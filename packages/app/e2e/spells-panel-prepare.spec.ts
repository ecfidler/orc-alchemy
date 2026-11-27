import { expect, type Locator, type Page, test } from "@playwright/test";
import { importFile, listPane, panel, row, rows, spellPane, viewHeading } from "./spells-panel-helpers.ts";

// The Spells panel: prepared spells, and more than one source (docs/design/spells-panel.md). The other topics of the
// panel are in spells-panel.spec.ts and spells-panel-slots.spec.ts.
// e2e/life-cleric-9.strict.json is a Life cleric 9 by the builder's calls (src/engine/spell-list.test.ts).

// Prepared spells in the panel (ORC-287, docs/design/spells-panel.md "The prepare bar" and "Preparing spells").

const prepareButton = (page: Page) => panel(page).getByRole("button", { name: /^(Prepare spells|Done)$/ });
/** The box of a row, by the spell name. */
const box = (page: Page, name: string) => listPane(page).getByRole("checkbox", { name: `Prepared: ${name}` });
/** A row in prepare mode, by the spell name and its state. */
const stateRow = (page: Page, name: string, state: string) =>
  panel(page).getByRole("button", { name: new RegExp(`^${name}, ${state}( (Ritual|Concentration))*$`) });
/** The counts of the bar. */
const barCounts = (page: Page) => panel(page).locator("[data-prepare-count]:not([data-pane=spell] *)");
const sheetSpells = (page: Page) => page.getByRole("group", { name: "Spellcasting", exact: true });
/** A token of the theme as the browser resolves it, for example "rgb(255, 228, 92)". */
const tokenColor = (page: Page, token: string) =>
  page.evaluate((token) => {
    const probe = document.createElement("span");
    probe.style.color = `var(${token})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, token);

test("a cleric prepares a spell and stops preparing it, and the sheet shows the change after a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "life-cleric-9.strict.json");
  await expect(sheetSpells(page).getByRole("button", { name: "Command" })).toHaveCount(0);
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(row(page, "Guidance")).toBeFocused();
  await prepareButton(page).click();
  await expect(prepareButton(page)).toHaveText("Done");
  // A click on the box changes only the box: the selected spell and the focus stay.
  await box(page, "Command").click();
  await expect(box(page, "Command")).toBeChecked();
  await expect(barCounts(page)).toHaveText(["9 of 12 prepared"]);
  await expect(prepareButton(page)).toBeFocused();
  await expect(viewHeading(page)).toHaveText("Guidance");
  await expect(panel(page).locator("[aria-live=polite]")).toHaveText("Cleric: 9 of 12 prepared");
  await page.keyboard.press("Escape");
  await expect(sheetSpells(page).getByRole("button", { name: "Command" })).toBeVisible();
  await page.reload();
  await expect(sheetSpells(page).getByRole("button", { name: "Command" })).toBeVisible();

  // Stop preparing it with Space on its row.
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(barCounts(page)).toHaveText(["9 of 12 prepared"]);
  await prepareButton(page).click();
  await stateRow(page, "Command", "prepared").focus();
  await page.keyboard.press("Space");
  await expect(stateRow(page, "Command", "not prepared")).toBeFocused();
  await expect(box(page, "Command")).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(sheetSpells(page).getByRole("button", { name: "Command" })).toHaveCount(0);
  await page.reload();
  await expect(sheetSpells(page).getByRole("button", { name: "Healing Word" })).toBeVisible();
  await expect(sheetSpells(page).getByRole("button", { name: "Command" })).toHaveCount(0);
});

test("the count in each state: yellow under the limit, green at the limit only in prepare mode, red over the limit with the spells to remove", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  const count = barCounts(page);
  await expect(count).toHaveText(["8 of 12 prepared"]);
  const look = () => count.evaluate((element) => ({ fill: getComputedStyle(element).backgroundColor, text: getComputedStyle(element).color }));
  expect(await look()).toEqual({ fill: await tokenColor(page, "--note"), text: await tokenColor(page, "--note-ink") });
  const listTop = (await listPane(page).boundingBox())!.y;
  await prepareButton(page).click();
  for (const name of ["Command", "Bane", "Sanctuary", "Guiding Bolt"]) await box(page, name).click();
  await expect(count).toHaveText(["12 of 12 prepared"]);
  expect((await look()).text).toBe(await tokenColor(page, "--success"));
  // The bar keeps its height in each state.
  expect((await listPane(page).boundingBox())!.y).toBe(listTop);
  // At the limit, the count does not show outside prepare mode.
  await prepareButton(page).click();
  await expect(count).toHaveCount(0);
  expect((await listPane(page).boundingBox())!.y).toBe(listTop);
  await prepareButton(page).click();
  // Nothing stops a 13th spell, and nothing is removed.
  await box(page, "Detect Magic").click();
  await expect(count).toHaveText(["13 of 12 prepared. Remove 1 spell."]);
  expect(await look()).toEqual({ fill: await tokenColor(page, "--note-red"), text: await tokenColor(page, "--note-ink") });
  await expect(panel(page).locator("[aria-live=polite]")).toHaveText("Cleric: 13 of 12 prepared. Remove 1 spell.");
  await prepareButton(page).click();
  await expect(count).toHaveText(["13 of 12 prepared. Remove 1 spell."]);
  await expect(listPane(page).getByRole("checkbox")).toHaveCount(0);
});

test("a domain spell has a filled box that cannot change, with the lock and Always prepared, and it is not in the count", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await prepareButton(page).click();
  await expect(box(page, "Bless")).toBeChecked();
  await expect(box(page, "Bless")).toBeDisabled();
  await box(page, "Bless").click({ force: true });
  await expect(box(page, "Bless")).toBeChecked();
  await expect(barCounts(page)).toHaveText(["8 of 12 prepared"]);
  await expect(stateRow(page, "Bless", "always prepared")).toContainText("Always prepared");
  await expect(stateRow(page, "Bless", "always prepared").locator("svg")).toBeVisible();
  // The prepare line of the spell view.
  await stateRow(page, "Bless", "always prepared").click();
  await expect(spellPane(page).getByText("Always prepared. It does not count.")).toBeVisible();
  await expect(spellPane(page).getByRole("checkbox")).toHaveCount(0);
});

test("a sorcerer and a warlock: no count, no Prepare spells button and no boxes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "warlock-10-sorcerer-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(rows(page).first()).toBeFocused();
  await expect(barCounts(page)).toHaveCount(0);
  await expect(panel(page).getByRole("button", { name: "Prepare spells" })).toHaveCount(0);
  await expect(panel(page).getByRole("checkbox")).toHaveCount(0);
});

test("the box of a row: a 28px tap area, in line with the name, and paper on the selected row; after Prepare spells and Done the selected row is in view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await importFile(page, "life-cleric-9.strict.json");
  await sheetSpells(page).getByRole("button", { name: "Flame Strike" }).click();
  await expect(row(page, "Flame Strike")).toBeInViewport();
  await prepareButton(page).click();
  // Prepare mode adds rows above the selected row, and the row scrolls into view.
  await expect(stateRow(page, "Flame Strike", "prepared")).toBeInViewport();
  await expect(stateRow(page, "Flame Strike", "prepared")).toHaveAttribute("aria-current", "true");
  const flame = box(page, "Flame Strike");
  const bounds = (await flame.boundingBox())!;
  // The tap area: points 13px from the center of the box are still on the box.
  const hits = await flame.evaluate((element) => {
    const { x, y, width, height } = element.getBoundingClientRect();
    const [cx, cy] = [x + width / 2, y + height / 2];
    return [
      [cx - 13, cy],
      [cx + 13, cy],
      [cx, cy - 13],
      [cx, cy + 13],
    ].map(([px, py]) => document.elementFromPoint(px!, py!) === element);
  });
  expect(hits).toEqual([true, true, true, true]);
  // The box is in line with the first line of the name.
  const name = (await stateRow(page, "Flame Strike", "prepared").locator("span").first().boundingBox())!;
  expect(Math.abs(bounds.y + bounds.height / 2 - (name.y + Math.min(name.height, 26) / 2))).toBeLessThanOrEqual(2);
  // On the ink fill of the selected row the box is paper.
  const paper = await tokenColor(page, "--paper");
  expect(await flame.evaluate((element) => getComputedStyle(element).borderTopColor)).toBe(paper);
  // Done: the list loses the rows that are not prepared, and the selected row is in view again.
  await listPane(page).evaluate((pane) => {
    pane.scrollTop = 0;
  });
  await prepareButton(page).click();
  await expect(row(page, "Flame Strike")).toBeInViewport();
});

test("on a phone, a tap on a box changes it and does not open the spell view; the prepare line works in the spell view", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("tab", { name: "Spells" }).click();
  await page.getByRole("button", { name: "All spells" }).click();
  await prepareButton(page).click();
  await box(page, "Command").click();
  await expect(box(page, "Command")).toBeChecked();
  await expect(spellPane(page)).toBeHidden();
  await stateRow(page, "Command", "prepared").click();
  await expect(viewHeading(page)).toHaveText("Command");
  const prepared = spellPane(page).getByRole("checkbox", { name: "Prepared" });
  await expect(prepared).toBeChecked();
  await prepared.click();
  await expect(prepared).not.toBeChecked();
  await expect(spellPane(page).getByText("Not prepared")).toBeVisible();
  await expect(barCounts(page)).toHaveText(["8 of 12 prepared"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// More than one source, and the cast note, in the panel (ORC-289, docs/design/spells-panel.md "The header", "The list",
// "The spell view" and "The cast note"). e2e/high-elf-cleric-3-druid-1.strict.json is a High Elf cleric 3 / druid 1 by
// the builder's calls (src/components/SpellsPanelSources.test.tsx).

/** The numbers of the header line of a source, each by its full name: [save DC, attack, ability]. */
const sourceLine = (page: Page, source: string) =>
  panel(page)
    .getByRole("group", { name: source, exact: true })
    .getByRole("group", { name: /^Spell(casting)? (save DC|attack|ability)$/ });
/** The source tag of a row: the last span of the name part, after a no-break space. */
const sourceTag = (rowButton: Locator) => rowButton.locator("> span:first-child > span:last-child");

test("a cleric 5 / warlock 3: a source tag in Inter caps on each row, and a line of numbers for each source in the header", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "cleric-5-warlock-3.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(rows(page).first()).toBeFocused();
  await expect(sourceLine(page, "Cleric")).toHaveText(["12", "+4", "WIS"]);
  await expect(sourceLine(page, "Warlock")).toHaveText(["13", "+5", "CHA"]);
  await expect(panel(page).locator(".ui-framed-box")).toHaveCount(0);
  // Each row has its tag, and the row name has the source.
  const all = await rows(page).all();
  expect(all.length).toBeGreaterThan(10);
  for (const rowButton of all) await expect(sourceTag(rowButton)).toHaveText(/^(Cleric|Warlock)$/);
  await expect(panel(page).getByRole("button", { name: "Hellish Rebuke, Warlock", exact: true })).toBeVisible();
  const tag = await sourceTag(row(page, "Hellish Rebuke")).evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.textTransform, style.fontFamily.split(",")[0]];
  });
  expect(tag).toEqual(["uppercase", '"Inter Variable"']);
  await expect(sourceTag(row(page, "Hellish Rebuke"))).toBeVisible();
});

test("a single-class character shows no source tags and the three boxes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(rows(page).first()).toBeFocused();
  await expect(panel(page).locator(".ui-modal-head .ui-framed-box")).toHaveCount(3);
  await expect(panel(page).getByRole("group", { name: "Cleric", exact: true })).toHaveCount(0);
  await expect(listPane(page)).not.toContainText("Cleric");
  await expect(row(page, "Guidance")).toHaveAccessibleName("Guidance Concentration");
});

test("a cleric / druid: a spell of the two lists is two rows, and each row prepares apart, for its class, after a reload too", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "high-elf-cleric-3-druid-1.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(rows(page).first()).toBeFocused();
  // The High Elf has only a cantrip, and has a line too.
  await expect(sourceLine(page, "High Elf")).toHaveText(["10", "+2", "INT"]);
  await expect(sourceLine(page, "Druid")).toHaveText(["12", "+4", "WIS"]);
  await expect(panel(page).getByRole("button", { name: "Fire Bolt, High Elf", exact: true })).toBeVisible();
  await prepareButton(page).click();
  await expect(stateRow(page, "Healing Word, Cleric", "prepared")).toBeVisible();
  await expect(stateRow(page, "Healing Word, Druid", "not prepared")).toBeVisible();
  await box(page, "Healing Word, Druid").click();
  await expect(box(page, "Healing Word, Druid")).toBeChecked();
  await expect(box(page, "Healing Word, Cleric")).toBeChecked();
  await expect(barCounts(page)).toHaveText(["Cleric: 3 of 5 prepared", "Druid: 2 of 3 prepared"]);
  // Space on the cleric row changes the cleric box only.
  await stateRow(page, "Healing Word, Cleric", "prepared").focus();
  await page.keyboard.press("Space");
  await expect(box(page, "Healing Word, Cleric")).not.toBeChecked();
  await expect(box(page, "Healing Word, Druid")).toBeChecked();
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(panel(page).getByRole("button", { name: "Healing Word, Druid", exact: true })).toBeVisible();
  await expect(panel(page).getByRole("button", { name: "Healing Word, Cleric", exact: true })).toHaveCount(0);
});

test("a spell with at will shows the note in muted text on its row, and as a line in its spell view", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "warlock-20.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  const disguise = panel(page).getByRole("button", { name: "Disguise Self, at will, Warlock", exact: true });
  await expect(disguise).toContainText("Disguise Self at will");
  const note = disguise.getByText("at will", { exact: true });
  expect(await note.evaluate((element) => getComputedStyle(element).color)).toBe(await tokenColor(page, "--ink-muted"));
  await disguise.click();
  await expect(viewHeading(page)).toHaveText("Disguise Self");
  await expect(spellPane(page).getByText("At will", { exact: true })).toBeVisible();
});

test("on a phone the source lines and the tags fit: no sideways scroll at 390px and at 320px", async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await importFile(page, "high-elf-cleric-3-druid-1.strict.json");
    await page.getByRole("tab", { name: "Spells" }).click();
    await page.getByRole("button", { name: "All spells" }).click();
    await expect(rows(page).first()).toBeFocused();
    await expect(sourceLine(page, "High Elf")).toHaveText(["10", "+2", "INT"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for (const part of await panel(page).locator(".ui-modal-head *").all()) {
      const bounds = await part.boundingBox();
      if (bounds) expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    }
  }
});
