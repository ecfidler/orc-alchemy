import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";

// The Spells panel (ORC-285, docs/design/spells-panel.md "The panel" and "Keyboard and screen reader").
// e2e/life-cleric-9.strict.json is a Life cleric 9 by the builder's calls (src/engine/spell-list.test.ts).

/** Imports a character file of this folder and waits for its sheet. */
async function importFile(page: Page, file: string) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(import.meta.dirname, file));
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
}

const panel = (page: Page) => page.getByRole("dialog", { name: "Spells" });
/** The row buttons of the list, in order. */
const rows = (page: Page) => panel(page).locator("[data-spell-row]");
/** The row of a spell, by its name, which starts the row's accessible name. */
const row = (page: Page, name: string) => panel(page).getByRole("button", { name: new RegExp(`^${name} ?(Ritual|Concentration)*$`) });
/** The heading of the spell view. */
/** The pane of the list, and the pane of the spell view. */
const listPane = (page: Page) => panel(page).locator("[data-pane=list]");
const spellPane = (page: Page) => panel(page).locator("[data-pane=spell]");
/** The heading of the spell view. */
const viewHeading = (page: Page) => spellPane(page).getByRole("region").getByRole("heading", { level: 3 });

test("All spells opens the panel at the top of the list, with the first spell selected and focused; the X gives the focus back", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "life-cleric-9.strict.json");
  const button = page.getByRole("button", { name: "All spells" });
  await button.click();
  await expect(panel(page)).toBeVisible();
  // The height of the window, less a margin of 16px at the top and the bottom.
  expect((await panel(page).boundingBox())!.height).toBe(900 - 32);
  await expect(panel(page).getByRole("heading", { level: 2, name: "Spells" })).toBeVisible();
  await expect(panel(page).getByText("Cleric 9", { exact: true })).toBeVisible();
  await expect(panel(page).getByRole("group", { name: "Spell save DC" })).toHaveText("15");
  await expect(panel(page).getByRole("group", { name: "Spell attack" })).toHaveText("+7");
  await expect(panel(page).getByRole("group", { name: "Spellcasting ability" })).toHaveText("WIS");
  await expect(row(page, "Guidance")).toBeFocused();
  await expect(row(page, "Guidance")).toHaveAttribute("aria-current", "true");
  await expect(viewHeading(page)).toHaveText("Guidance");
  // The prepared and the domain spells of the cleric show, and no other spell of the cleric list.
  await expect(rows(page)).toHaveText([
    "GuidanceC",
    "Light",
    "Sacred Flame",
    "Spare the Dying",
    "BlessC",
    "Cure Wounds",
    "Healing Word",
    "Shield of FaithC",
    "Aid",
    "Lesser Restoration",
    "Prayer of Healing",
    "Spiritual Weapon",
    "Beacon of HopeC",
    "Dispel Magic",
    "Revivify",
    "Spirit GuardiansC",
    "BanishmentC",
    "Death Ward",
    "Guardian of Faith",
    "Flame Strike",
    "Mass Cure Wounds",
    "Raise Dead",
  ]);
  await expect(row(page, "Bless").getByRole("img", { name: "Concentration" })).toBeVisible();
  await panel(page).getByRole("button", { name: "Close" }).click();
  await expect(panel(page)).toBeHidden();
  await expect(button).toBeFocused();
  // The panel is not in the URL.
  expect(page.url()).toMatch(/\/sheet\/[0-9a-f-]+$/);
});

test("a spell name on the sheet opens the panel at that spell, and Escape gives the focus back to the name", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await importFile(page, "life-cleric-9.strict.json");
  const name = page.getByRole("group", { name: "Spellcasting", exact: true }).getByRole("button", { name: "Raise Dead" });
  await name.click();
  await expect(row(page, "Raise Dead")).toBeFocused();
  await expect(row(page, "Raise Dead")).toHaveAttribute("aria-current", "true");
  await expect(row(page, "Raise Dead")).toBeInViewport();
  await expect(viewHeading(page)).toHaveText("Raise Dead");
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(name).toBeFocused();

  // A cantrip opens the panel too.
  await page.getByRole("group", { name: "Spellcasting", exact: true }).getByRole("button", { name: "Light" }).click();
  await expect(row(page, "Light")).toBeFocused();
});

test("the list is one Tab stop: the arrow keys, Home and End move the selection, and Tab does not leave the panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(row(page, "Guidance")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(row(page, "Light")).toBeFocused();
  await expect(row(page, "Light")).toHaveAttribute("aria-current", "true");
  await expect(viewHeading(page)).toHaveText("Light");
  // A polite live region says the name of the new spell.
  await expect(panel(page).locator("[aria-live=polite]")).toHaveText("Light");
  // The headings are not stops: Down from the last cantrip goes to the first 1st-level spell.
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(row(page, "Bless")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(row(page, "Spare the Dying")).toBeFocused();
  await page.keyboard.press("End");
  await expect(row(page, "Raise Dead")).toBeFocused();
  await expect(viewHeading(page)).toHaveText("Raise Dead");
  await page.keyboard.press("Home");
  await expect(row(page, "Guidance")).toBeFocused();
  // The focus ring of the selected row is a paper outline on the ink fill.
  const ring = await row(page, "Guidance").evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineColor, style: style.outlineStyle, text: style.color, fill: style.backgroundColor };
  });
  // The text of the selected row is paper, on the ink fill.
  expect(ring).toEqual({ outline: ring.text, style: "solid", text: ring.text, fill: expect.not.stringMatching(ring.text) });
  // The rows are one stop: Tab goes on to the other controls of the panel, and never to the sheet or another row.
  const focusedRows = new Set<string>();
  // Enough Tabs to go round the panel: the Spell slots block has 11 stops.
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    // Base UI's focus guard at the end of the dialog has the focus for a moment, then sends it back in.
    await expect.poll(() => panel(page).evaluate((dialog) => dialog.contains(document.activeElement))).toBe(true);
    const at = await page.evaluate(() => document.activeElement?.getAttribute("data-spell-row") ?? null);
    if (at !== null) focusedRows.add(at);
  }
  expect([...focusedRows]).toEqual(["Cleric/guidance"]);
});

test("the search filters the list by name as the user types, and says when no spell matches", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("group", { name: "Spellcasting", exact: true }).getByRole("button", { name: "Prayer of Healing" }).click();
  const search = panel(page).getByRole("textbox", { name: "Search spells" });
  await search.fill("HEAL");
  await expect(rows(page)).toHaveText(["Healing Word", "Prayer of Healing"]);
  // A group with no match does not show.
  await expect(listPane(page).getByRole("heading", { level: 3 })).toHaveText(["1st level", "2nd level"]);
  await expect(row(page, "Prayer of Healing")).toHaveAttribute("aria-current", "true");
  await expect(row(page, "Prayer of Healing")).toBeInViewport();
  await search.fill("zzz");
  await expect(rows(page)).toHaveCount(0);
  await expect(panel(page).getByText("No spells match.")).toBeVisible();
  // The spell view keeps the selected spell.
  await expect(viewHeading(page)).toHaveText("Prayer of Healing");
  await search.fill("");
  await expect(rows(page)).toHaveCount(22);
  await expect(row(page, "Prayer of Healing")).toBeInViewport();
});

test("the level headings stick at the top of the list, and the two panes scroll apart", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(row(page, "Guidance")).toBeFocused();
  const list = listPane(page);
  const listTop = (await list.boundingBox())!.y;
  // Scroll into the 2nd-level group: its heading is at the top of the list, and the 1st-level heading is gone.
  await row(page, "Lesser Restoration").evaluate((element) => {
    const pane = element.closest<HTMLElement>("[data-pane]")!;
    pane.scrollTop += element.getBoundingClientRect().top - pane.getBoundingClientRect().top;
  });
  const heading = panel(page).getByRole("heading", { level: 3, name: "2nd level" });
  expect(Math.abs((await heading.boundingBox())!.y - listTop - 14)).toBeLessThanOrEqual(1);
  // The spell view did not scroll with the list.
  await row(page, "Spirit Guardians").click();
  const view = viewHeading(page);
  const viewTop = (await view.boundingBox())!.y;
  const before = await list.evaluate((element) => element.scrollTop);
  await spellPane(page).evaluate((element) => {
    element.scrollTop = 200;
  });
  expect((await view.boundingBox())!.y).toBeLessThan(viewTop);
  expect(await list.evaluate((element) => element.scrollTop)).toBe(before);
});

test("on a phone, a row opens the spell view, and Back to the list goes back to the same place with the focus on the row", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("tab", { name: "Spells" }).click();
  await page.getByRole("button", { name: "All spells" }).click();
  // The panel fills the screen, and the X is 44px.
  expect(await panel(page).boundingBox()).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  const close = (await panel(page).getByRole("button", { name: "Close" }).boundingBox())!;
  expect(close.width).toBeGreaterThanOrEqual(44);
  expect(close.height).toBeGreaterThanOrEqual(44);
  // One view: the list. The class line shows on a phone too.
  await expect(panel(page).getByText("Cleric 9", { exact: true })).toBeVisible();
  await expect(spellPane(page)).toBeHidden();
  const list = listPane(page);
  await list.evaluate((element) => {
    element.scrollTop = 500;
  });
  const top = await list.evaluate((element) => element.scrollTop);
  await row(page, "Spirit Guardians").click();
  await expect(list).toBeHidden();
  await expect(viewHeading(page)).toHaveText("Spirit Guardians");
  const back = panel(page).getByRole("button", { name: "Back to the list" });
  await expect(back).toBeFocused();
  await back.click();
  await expect(list).toBeVisible();
  await expect(row(page, "Spirit Guardians")).toBeFocused();
  expect(await list.evaluate((element) => element.scrollTop)).toBe(top);
  await expect(spellPane(page)).toBeHidden();
  // On a phone the arrow keys move the focus, not the spell view.
  await page.keyboard.press("ArrowDown");
  await expect(row(page, "Banishment")).toBeFocused();
  await expect(row(page, "Spirit Guardians")).toHaveAttribute("aria-current", "true");
});

test("on a phone, a spell name opens the spell view of that spell, says its name, and Back shows its row", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("tab", { name: "Spells" }).click();
  // The last spell: its row is far down the list.
  await page.getByRole("group", { name: "Spellcasting", exact: true }).getByRole("button", { name: "Raise Dead" }).click();
  await expect(viewHeading(page)).toHaveText("Raise Dead");
  await expect(panel(page).getByRole("button", { name: "Back to the list" })).toBeFocused();
  // The focus on the button does not read the spell, so the live region says it.
  await expect(panel(page).locator("[aria-live=polite]")).toHaveText("Raise Dead");
  await panel(page).getByRole("button", { name: "Back to the list" }).click();
  await expect(row(page, "Raise Dead")).toBeFocused();
  // The list had no position yet, so the row scrolls into view.
  await expect(row(page, "Raise Dead")).toBeInViewport();
});

test("at 320px the panel does not scroll sideways, in the list and in the spell view", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await importFile(page, "warlock-10-sorcerer-9.strict.json");
  await page.getByRole("tab", { name: "Spells" }).click();
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(rows(page).first()).toBeFocused();
  /** The elements in the panel that scroll sideways: none. */
  const noSideways = (locator: Locator) =>
    locator.evaluate((root) =>
      [root, ...root.querySelectorAll("*")]
        // An sr-only element is 1px wide and clips its text on purpose.
        .filter((element) => element.clientWidth > 1 && element.scrollWidth > element.clientWidth && getComputedStyle(element).overflowX !== "visible")
        .map((element) => element.outerHTML.slice(0, 120)),
    );
  const width = () => page.evaluate(() => document.documentElement.scrollWidth);
  expect(await noSideways(panel(page))).toEqual([]);
  expect(await width()).toBeLessThanOrEqual(320);
  for (const box of await panel(page).locator(".ui-modal-head *").all()) {
    const bounds = await box.boundingBox();
    if (bounds) expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  }
  await row(page, "Hellish Rebuke").click();
  await expect(viewHeading(page)).toHaveText("Hellish Rebuke");
  expect(await noSideways(panel(page))).toEqual([]);
  expect(await width()).toBeLessThanOrEqual(320);
});

test("two sources: the header has the class line of each class, and no boxes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "warlock-10-sorcerer-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(panel(page).getByText("Warlock 10 / Sorcerer 9", { exact: true })).toBeVisible();
  await expect(panel(page).getByRole("group", { name: "Spell save DC" })).toHaveCount(0);
});

test("the builder link goes to the Spells step of the builder", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await panel(page).getByRole("link", { name: "Change known spells in the builder" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+\?step=Spells$/);
  await expect(page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: /^Spells/ })).toHaveAttribute("aria-current", "step");
  await expect(panel(page)).toBeHidden();
  // The builder preview has no panel: no All spells button, and the names are plain text.
  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByText("Raise Dead")).toBeVisible();
  await expect(preview.getByRole("button", { name: "All spells" })).toHaveCount(0);
  await expect(preview.getByRole("button", { name: "Raise Dead" })).toHaveCount(0);
});

// Spell slots in the panel (ORC-286, docs/design/spells-panel.md "Spent spell slots").

/** The fixtures of the fork, from this folder. */
const fixture = (name: string) => `../../../fixtures/characters/${name}.strict.json`;
const block = (page: Page) => panel(page).locator("[data-slots-block]");
const foldButton = (page: Page) => block(page).getByRole("button", { name: "Spell slots" });
const blockSlider = (page: Page, name: string) => block(page).getByRole("slider", { name });
/** The heading row of a level in the list. */
const headingRow = (page: Page, name: string) => listPane(page).getByRole("heading", { level: 3, name }).locator("..");
const sheetSlider = (page: Page, name: string) => page.getByRole("group", { name: "Spellcasting", exact: true }).getByRole("slider", { name });

test("a slot spent in the block shows on the level heading and on the sheet, and a slot spent on the sheet shows in the panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "life-cleric-9.strict.json");
  await sheetSlider(page, "3rd-level slots").locator(".ui-slot-circle").first().click();
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(rows(page).first()).toBeFocused();
  await expect(blockSlider(page, "3rd-level slots")).toHaveAttribute("aria-valuetext", "1 of 3 spent");
  await expect(headingRow(page, "3rd level").locator("[data-marked]")).toHaveCount(1);
  // A click on a circle in the block: the focus stays on its group.
  const first = blockSlider(page, "1st-level slots");
  await first.locator(".ui-slot-circle").nth(3).click();
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-valuetext", "1 of 4 spent");
  await expect(headingRow(page, "1st level").locator("[data-marked]")).toHaveCount(1);
  // A click on the copy on the heading changes the same slots, and the focus stays on the group in the block.
  await headingRow(page, "1st level").locator(".ui-slot-circle").nth(2).click();
  await expect(first).toHaveAttribute("aria-valuetext", "2 of 4 spent");
  await expect(first).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(sheetSlider(page, "1st-level slots")).toHaveAttribute("aria-valuetext", "2 of 4 spent");
  await expect(sheetSlider(page, "3rd-level slots")).toHaveAttribute("aria-valuetext", "1 of 3 spent");
});

test("a wizard 20 shows nine columns, and a wizard 5 shows rows; a warlock has the Pact entry, a multiclass warlock its circles, then the Pact entry", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, fixture("wizard-20"));
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(block(page).locator("[data-layout=columns]")).toBeVisible();
  await expect(block(page).getByRole("slider")).toHaveCount(9);
  await importFile(page, fixture("wizard-5"));
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(block(page).locator("[data-layout=rows]")).toBeVisible();
  await expect(block(page).getByRole("slider")).toHaveCount(3);
  await importFile(page, "warlock-20.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(block(page).getByRole("slider")).toHaveCount(1);
  // One entry: a row, though its slots are of the 5th level.
  await expect(block(page).locator("[data-layout=rows]")).toBeVisible();
  await expect(blockSlider(page, "Pact slots, 5th level")).toHaveAttribute("data-shape", "diamond");
  await expect(block(page).getByRole("button", { name: "Pact 5th, go to 5th level" })).toBeVisible();
  await expect(headingRow(page, "5th level")).toContainText("Pact");
  await importFile(page, "warlock-10-sorcerer-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(block(page).getByRole("slider")).toHaveCount(6);
  const names = await block(page)
    .getByRole("slider")
    .evaluateAll((sliders) => sliders.map((slider) => slider.getAttribute("aria-label")));
  expect(names.slice(-2)).toEqual(["5th-level slots", "Pact slots, 5th level"]);
});

test("the fold button folds the block, and the block is folded after a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(foldButton(page)).toHaveAttribute("aria-expanded", "true");
  await foldButton(page).click();
  await expect(foldButton(page)).toHaveAttribute("aria-expanded", "false");
  await expect(block(page).getByRole("slider")).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(foldButton(page)).toHaveAttribute("aria-expanded", "false");
  // Folded: the groups on the headings are the sliders.
  await expect(headingRow(page, "1st level").getByRole("slider", { name: "1st-level slots" })).toBeVisible();
});

test("a level link scrolls the list to its level, and not smoothly under reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(rows(page).first()).toBeFocused();
  const headingOffset = async (name: string) => {
    const list = (await listPane(page).boundingBox())!;
    return (await listPane(page).getByRole("heading", { level: 3, name }).boundingBox())!.y - list.y;
  };
  const link = block(page).getByRole("button", { name: "Go to 4th level" });
  await link.click();
  await expect.poll(() => headingOffset("4th level")).toBeLessThan(16);
  await expect(link).toBeFocused();
  // Under reduced motion the jump is at once: the list is at its place in the same frame.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await block(page).getByRole("button", { name: "Go to 1st level" }).click();
  expect(await headingOffset("1st level")).toBeLessThan(16);
  // A search that hides a level disables its link.
  await panel(page).getByRole("textbox", { name: "Search spells" }).fill("heal");
  await expect(block(page).getByRole("button", { name: "Go to 3rd level" })).toBeDisabled();
  await expect(block(page).getByRole("button", { name: "Go to 1st level" })).toBeEnabled();
});

test("each level is one Tab stop for its slots, two with circles and diamonds: in the block while it is open, on the headings while it is folded", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "warlock-10-sorcerer-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(rows(page).first()).toBeFocused();
  /**
   * The names of the sliders that Tab stops at, once round the panel: from the fold button, Tab until the fold
   * button has the focus again. Base UI's focus guard at the end of the dialog has the focus for a moment and sends it
   * back in one animation frame later, so each step waits until the focus is off the guard. Thus no queued focus of
   * the guard can move the focus after the loop.
   */
  const sliderStops = async () => {
    await foldButton(page).focus();
    const names: string[] = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      await expect.poll(() => page.evaluate(() => document.activeElement?.hasAttribute("data-base-ui-focus-guard") ?? false)).toBe(false);
      if (await foldButton(page).evaluate((button) => button === document.activeElement)) return names;
      const name = await page.evaluate(() =>
        document.activeElement?.getAttribute("role") === "slider" ? document.activeElement.getAttribute("aria-label") : null,
      );
      if (name !== null) names.push(name);
    }
    throw new Error("Tab did not come back to the fold button");
  };
  const levels = ["1st-level slots", "2nd-level slots", "3rd-level slots", "4th-level slots", "5th-level slots"];
  expect(await sliderStops()).toEqual([...levels, "Pact slots, 5th level"]);
  // The copies on the headings are hidden from a screen reader.
  await expect(listPane(page).getByRole("slider")).toHaveCount(0);
  await foldButton(page).click();
  expect(await sliderStops()).toEqual([...levels, "Pact slots, 5th level"]);
  await expect(listPane(page).getByRole("slider")).toHaveCount(6);
  // The arrow keys on a heading's group change it, and the list's roving focus does not take them.
  const pact = headingRow(page, "5th level").getByRole("slider", { name: "Pact slots, 5th level" });
  await pact.focus();
  await expect(pact).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(pact).toBeFocused();
  await expect(pact).toHaveAttribute("aria-valuetext", "1 of 2 spent");
});

test("on a phone the block is at the top of the list view and of the spell view; at 320px nine columns fit", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("tab", { name: "Spells" }).click();
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(block(page)).toBeVisible();
  expect((await block(page).boundingBox())!.y).toBeLessThan((await listPane(page).boundingBox())!.y);
  await row(page, "Aid").click();
  await expect(viewHeading(page)).toHaveText("Aid");
  await expect(block(page)).toBeVisible();
  expect((await block(page).boundingBox())!.y).toBeLessThan((await spellPane(page).boundingBox())!.y);
  // In the spell view the level names are plain text, and the slots still change.
  await expect(block(page).getByRole("button", { name: "Go to 1st level" })).toHaveCount(0);
  await blockSlider(page, "2nd-level slots").locator(".ui-slot-circle").first().click();
  await expect(blockSlider(page, "2nd-level slots")).toHaveAttribute("aria-valuetext", "1 of 3 spent");

  await page.setViewportSize({ width: 320, height: 640 });
  await importFile(page, fixture("wizard-20"));
  await page.getByRole("tab", { name: "Spells" }).click();
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(block(page).getByRole("slider")).toHaveCount(9);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  // The nine columns fit in the block: it does not scroll sideways either.
  const columns = block(page).locator("[data-layout=columns]");
  expect(await columns.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
  const right = (await block(page).boundingBox())!;
  expect(right.x + right.width).toBeLessThanOrEqual(320);
});

test("at 320px the widest level heading is one line, and a row that gets the focus is never under the heading that sticks", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  // e2e/wizard-3-warlock-2.strict.json: the 1st-level heading has four circles and the two pact diamonds, by the
  // builder's calls (src/components/SpellSlots.test.tsx).
  await importFile(page, "wizard-3-warlock-2.strict.json");
  await page.getByRole("tab", { name: "Spells" }).click();
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(rows(page).first()).toBeFocused();
  // Fold the block, so the list has the height to scroll, and the heading slots are the controls.
  await foldButton(page).click();
  await rows(page).first().focus();
  const first = headingRow(page, "1st level");
  await expect(first.getByRole("slider", { name: "Pact slots, 1st level" })).toBeVisible();
  // The widest heading stays on one line at 320px, and the pact part is in that line.
  expect((await first.boundingBox())!.height).toBeLessThan(50);
  const pactPart = first.getByText("Pact", { exact: true }).locator("..");
  const diamonds = (await first.getByRole("slider", { name: "Pact slots, 1st level" }).boundingBox())!;
  expect(Math.abs((await pactPart.boundingBox())!.y + (await pactPart.boundingBox())!.height / 2 - (diamonds.y + diamonds.height / 2))).toBeLessThan(2);
  const count = await rows(page).count();
  for (let i = 1; i < count; i++) {
    await page.keyboard.press("ArrowDown");
    const focused = rows(page).nth(i);
    await expect(focused).toBeFocused();
    // The heading of the row's group, which sticks at the top of the list while the group scrolls.
    const heading = focused.locator("xpath=ancestor::*[@data-spell-level][1]/*[@data-level-heading]");
    const headingBox = (await heading.boundingBox())!;
    const rowBox = (await focused.boundingBox())!;
    expect(rowBox.y).toBeGreaterThanOrEqual(headingBox.y + headingBox.height - 1);
  }
  // A narrower list (a larger text size gives the same) wraps the heading to two lines: the scroll padding of the list
  // follows the height of the heading, so a row at the top of the group still shows under it.
  await listPane(page).evaluate((pane) => {
    pane.style.paddingRight = "80px";
  });
  await expect.poll(async () => (await first.boundingBox())!.height).toBeGreaterThan(60);
  const height = (await first.boundingBox())!.height;
  await expect.poll(() => listPane(page).evaluate((pane) => Number.parseFloat(pane.style.scrollPaddingTop))).toBe(Math.ceil(height));
  for (let i = count - 2; i >= 0; i--) {
    await page.keyboard.press("ArrowUp");
    const focused = rows(page).nth(i);
    await expect(focused).toBeFocused();
    const heading = focused.locator("xpath=ancestor::*[@data-spell-level][1]/*[@data-level-heading]");
    const headingBox = (await heading.boundingBox())!;
    expect((await focused.boundingBox())!.y).toBeGreaterThanOrEqual(headingBox.y + headingBox.height - 1);
  }
});

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

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- spells-panel.spec.ts -g orc-285
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-285 Spells panel, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-285-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);

      await page.setViewportSize({ width: 1280, height: 900 });
      await importFile(page, "life-cleric-9.strict.json");
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole("group", { name: "Spellcasting", exact: true }).screenshot({ path: shot("sheet") });
      await page.getByRole("group", { name: "Spellcasting", exact: true }).getByRole("button", { name: "Spirit Guardians" }).click();
      await expect(viewHeading(page)).toHaveText("Spirit Guardians");
      await page.screenshot({ path: shot("cleric") });
      await panel(page).getByRole("textbox", { name: "Search spells" }).fill("heal");
      await expect(rows(page)).toHaveCount(2);
      await row(page, "Healing Word").click();
      await page.screenshot({ path: shot("search") });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.keyboard.press("Escape");
      await page.getByRole("tab", { name: "Spells" }).click();
      await page.getByRole("button", { name: "All spells" }).click();
      await expect(rows(page).first()).toBeFocused();
      await page.screenshot({ path: shot("phone-list") });
      await row(page, "Spirit Guardians").click();
      await expect(viewHeading(page)).toHaveText("Spirit Guardians");
      await page.screenshot({ path: shot("phone-spell") });

      await page.setViewportSize({ width: 1280, height: 900 });
      await importFile(page, "warlock-10-sorcerer-9.strict.json");
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole("button", { name: "All spells" }).click();
      await expect(rows(page).first()).toBeFocused();
      await page.screenshot({ path: shot("multiclass") });
    });

    // PR_SCREENSHOTS=1 bun run e2e -- spells-panel.spec.ts -g orc-286
    test(`orc-286 Spell slots in the panel, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-286-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      /** Spends `n` slots of a group in the block. */
      const spend = async (name: string, n: number) => {
        // A click on an empty circle spends one; the mouse then goes away, so no circle has the light fill of the mouse.
        for (let i = 0; i < n; i++) await blockSlider(page, name).locator(".ui-slot-circle:not([data-marked])").first().click();
        await page.mouse.move(0, 0);
      };
      const open = async (file: string, phone = false) => {
        await importFile(page, file);
        await page.evaluate(() => document.fonts.ready);
        if (phone) await page.getByRole("tab", { name: "Spells" }).click();
        await page.getByRole("button", { name: "All spells" }).click();
        await expect(rows(page).first()).toBeFocused();
      };

      await page.setViewportSize({ width: 1280, height: 900 });
      await open("life-cleric-9.strict.json");
      await spend("1st-level slots", 2);
      await spend("3rd-level slots", 1);
      await rows(page).first().focus();
      await page.screenshot({ path: shot("columns") });
      await open("cleric-5-warlock-3.strict.json");
      await spend("1st-level slots", 1);
      await spend("Pact slots, 2nd level", 1);
      await rows(page).first().focus();
      await page.screenshot({ path: shot("rows") });
      await open("warlock-10-sorcerer-9.strict.json");
      await spend("2nd-level slots", 1);
      await spend("Pact slots, 5th level", 1);
      await rows(page).first().focus();
      await page.screenshot({ path: shot("multiclass-warlock") });
      await open("warlock-20.strict.json");
      await spend("Pact slots, 5th level", 2);
      await rows(page).first().focus();
      await page.screenshot({ path: shot("warlock") });
      // Folded: the groups on the level headings are the controls.
      await open("life-cleric-9.strict.json");
      await foldButton(page).click();
      await page.mouse.move(0, 0);
      await rows(page).first().focus();
      await page.screenshot({ path: shot("folded") });
      await foldButton(page).click();

      await page.setViewportSize({ width: 390, height: 844 });
      await open("life-cleric-9.strict.json", true);
      await page.screenshot({ path: shot("phone-list") });
      await row(page, "Spirit Guardians").click();
      await expect(viewHeading(page)).toHaveText("Spirit Guardians");
      await page.screenshot({ path: shot("phone-spell") });

      await page.setViewportSize({ width: 320, height: 640 });
      await open(fixture("wizard-20"), true);
      await page.screenshot({ path: shot("phone-320-nine-columns") });
    });

    // PR_SCREENSHOTS=1 bun run e2e -- spells-panel.spec.ts -g orc-287
    test(`orc-287 Prepared spells in the panel, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-287-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      const open = async (phone = false) => {
        await importFile(page, "life-cleric-9.strict.json");
        await page.evaluate(() => document.fonts.ready);
        if (phone) await page.getByRole("tab", { name: "Spells" }).click();
        await page.getByRole("button", { name: "All spells" }).click();
        await expect(rows(page).first()).toBeFocused();
      };

      await page.setViewportSize({ width: 1280, height: 900 });
      await open();
      await row(page, "Healing Word").click();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: shot("under") });
      await prepareButton(page).click();
      for (const name of ["Command", "Bane", "Sanctuary", "Guiding Bolt"]) await box(page, name).click();
      await stateRow(page, "Bless", "always prepared").click();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: shot("at-limit-always-prepared") });
      await box(page, "Detect Magic").click();
      await stateRow(page, "Detect Magic", "prepared").click();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: shot("over") });
      await prepareButton(page).click();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: shot("over-done") });

      await page.setViewportSize({ width: 390, height: 844 });
      await open(true);
      await prepareButton(page).click();
      await page.mouse.move(0, 0);
      await page.screenshot({ path: shot("phone-list") });
      await stateRow(page, "Detect Magic", "not prepared").click();
      await expect(viewHeading(page)).toHaveText("Detect Magic");
      await page.screenshot({ path: shot("phone-spell") });
    });
  }
});
