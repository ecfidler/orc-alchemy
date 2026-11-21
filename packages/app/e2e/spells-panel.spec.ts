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
  for (let i = 0; i < 6; i++) {
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

test("on a phone, a spell name opens the spell view of that spell", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("tab", { name: "Spells" }).click();
  await page.getByRole("group", { name: "Spellcasting", exact: true }).getByRole("button", { name: "Aid" }).click();
  await expect(viewHeading(page)).toHaveText("Aid");
  await expect(panel(page).getByRole("button", { name: "Back to the list" })).toBeFocused();
  await panel(page).getByRole("button", { name: "Back to the list" }).click();
  await expect(row(page, "Aid")).toBeFocused();
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
  }
});
