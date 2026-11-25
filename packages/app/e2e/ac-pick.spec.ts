// The AC pick (ORC-325, docs/design/sheet-interactivity.md "AC pick"): the
// Armor Class box opens the menu "Armor class shows", a pick changes only the
// number in the box, the table "AC by armor" marks the row that shows, the
// stored record changes only at the key of the pick, and a pick moves no part
// of the vitals panel or of the table.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { layoutOf, openWithValues, statusLine, storedValues, layout as vitalsLayout } from "./play-helpers.ts";

/** fighter-20: plate and a shield worn (AC 20), and six rows in the table "AC by armor". */
const FIGHTER = join(import.meta.dirname, "../../../fixtures/characters/fighter-20.strict.json");

const AC_PICK = "~:orc-alchemy.play/ac-pick";

const acBox = (page: Page, ac: number) => page.getByRole("button", { name: `Armor class, ${ac}`, exact: true });
const anyAcBox = (page: Page) => page.getByRole("button", { name: /^Armor class, \d+$/ });
const menu = (page: Page) => page.getByRole("menu", { name: "Armor class shows" });
/** A menu entry by its text and AC. The AC is a part of its name, after a space. */
const entry = (page: Page, text: string, ac: number) => menu(page).getByRole("menuitemradio", { name: `${text} ${ac}`, exact: true });
const table = (page: Page) => page.getByRole("table", { name: "Armor class options" });
/** The rows of the table as "● Plate + Shield WORN 20 bold", from the text that shows. */
const tableRows = (page: Page) =>
  table(page)
    .locator("tbody tr")
    .evaluateAll((rows) =>
      rows.map((row) => {
        const cells = [...row.querySelectorAll("td")];
        const shown = (cell: Element | undefined) => cell?.querySelector("span > span:not([aria-hidden])")?.textContent ?? "";
        const tag = cells[1]?.querySelector(".uppercase")?.textContent ?? "";
        const bold = Number(getComputedStyle(cells[1]!).fontWeight) >= 600;
        return [cells[0]?.textContent ?? "", shown(cells[1]), tag, shown(cells[2]), bold ? "bold" : ""].filter(Boolean).join(" ");
      }),
    );
/** The layout of the table. The dot is not a part: it comes and goes. */
const tableLayout = (page: Page) => layoutOf(table(page), "[role=img]");

const phone = (page: Page) => (page.viewportSize()?.width ?? 1280) < 720;
/** On a phone, opens the tab of the vitals panel (Stats) or of the table (More). */
async function tab(page: Page, name: "Stats" | "More") {
  if (!phone(page)) return;
  await page.getByRole("tab", { name }).click();
  await expect(page.getByRole("tab", { name })).toHaveAttribute("aria-selected", "true");
}

async function openSheet(page: Page, values: Record<string, unknown> = {}) {
  await openWithValues(page, FIGHTER, values);
  await expect(anyAcBox(page)).toBeVisible();
}

/** Picks an entry of the menu with the mouse; the menu closes. */
async function pick(page: Page, from: number, text: string, ac: number) {
  await acBox(page, from).click();
  await entry(page, text, ac).click();
  await expect(menu(page)).toHaveCount(0);
}

const WORN = ["Chain Mail + Shield 18", "Chain Mail 16", "● Plate + Shield worn 20 bold", "Plate 18", "Unarmored + Shield 15", "Unarmored 13"];

test("the box opens the menu Armor class shows: Worn armor, then each row of the table with its AC", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page);
  await acBox(page, 20).click();
  await expect(menu(page)).toBeVisible();
  await expect(menu(page).getByRole("menuitemradio")).toHaveText([
    "Worn armor 20",
    "Chain Mail + Shield 18",
    "Chain Mail 16",
    "Plate + Shield 20",
    "Plate 18",
    "Unarmored + Shield 15",
    "Unarmored 13",
  ]);
  // Without a pick, Worn armor is checked, and it is bold.
  await expect(entry(page, "Worn armor", 20)).toHaveAttribute("aria-checked", "true");
  await expect(menu(page).getByRole("menuitemradio", { checked: true })).toHaveCount(1);
  expect(await entry(page, "Worn armor", 20).evaluate((item) => Number(getComputedStyle(item).fontWeight))).toBeGreaterThanOrEqual(600);
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(acBox(page, 20)).toBeFocused();
});

test("a pick changes only the number and the marks of the table; the record changes only at the pick; Worn armor removes it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page);
  expect(await tableRows(page)).toEqual(WORN);
  const before = await storedValues(page);
  expect(before[AC_PICK]).toBeUndefined();

  await pick(page, 20, "Chain Mail", 16);
  await expect(acBox(page, 16)).toBeVisible();
  await expect(acBox(page, 16)).toHaveText("16Armor Class");
  await expect(statusLine(page)).toHaveText("");
  await expect
    .poll(() => tableRows(page))
    .toEqual(["Chain Mail + Shield 18", "● Chain Mail 16 bold", "Plate + Shield worn 20", "Plate 18", "Unarmored + Shield 15", "Unarmored 13"]);
  // The whole record: only the pick is new. The worn armor and the shield stay.
  await expect.poll(() => storedValues(page)).toEqual({ ...before, [AC_PICK]: { "~:armor": "~:chain-mail", "~:shield": null } });

  await page.reload();
  await expect(acBox(page, 16)).toBeVisible();
  await acBox(page, 16).click();
  await expect(entry(page, "Chain Mail", 16)).toHaveAttribute("aria-checked", "true");
  await expect(menu(page).getByRole("menuitemradio", { checked: true })).toHaveCount(1);
  await entry(page, "Unarmored + Shield", 15).click();
  await expect(acBox(page, 15)).toBeVisible();
  await expect.poll(() => storedValues(page)).toEqual({ ...before, [AC_PICK]: { "~:armor": null, "~:shield": "~:shield" } });

  await pick(page, 15, "Worn armor", 20);
  await expect(acBox(page, 20)).toBeVisible();
  await expect.poll(() => storedValues(page)).toEqual(before);
  expect(await tableRows(page)).toEqual(WORN);
});

test("a pick takes the text of the status line away: after Damage, the line says the damage, and after the pick it is empty", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page);
  await page.getByRole("button", { name: /^Hit points, / }).click();
  const popup = page.getByRole("dialog", { name: "Hit points" });
  await popup.getByRole("textbox", { name: "Amount" }).fill("5");
  await popup.getByRole("button", { name: "Damage", exact: true }).click();
  await expect(popup).toHaveCount(0);
  await expect(statusLine(page)).toHaveText("5 damage.");
  await pick(page, 20, "Chain Mail", 16);
  await expect(acBox(page, 16)).toBeVisible();
  await expect(statusLine(page)).toHaveText("");
  // Worn armor is a pick too.
  await page.getByRole("button", { name: /^Hit points, / }).click();
  await popup.getByRole("textbox", { name: "Amount" }).fill("2");
  await popup.getByRole("button", { name: "Heal", exact: true }).click();
  await expect(statusLine(page)).toHaveText("2 healed.");
  await pick(page, 16, "Worn armor", 20);
  await expect(acBox(page, 20)).toBeVisible();
  await expect(statusLine(page)).toHaveText("");
});

test("a pick of a pair that is not in the table is ignored with no message: the worn AC shows", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page, { [AC_PICK]: { "~:armor": "~:leather", "~:shield": null } });
  await expect(acBox(page, 20)).toBeVisible();
  expect(await tableRows(page)).toEqual(WORN);
  await expect(statusLine(page)).toHaveText("");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await acBox(page, 20).click();
  await expect(entry(page, "Worn armor", 20)).toHaveAttribute("aria-checked", "true");
});

test("a pick of the worn row is stored as a pick, and the menu checks that row, not Worn armor", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page);
  const before = await storedValues(page);
  await pick(page, 20, "Plate + Shield", 20);
  await expect.poll(() => storedValues(page)).toEqual({ ...before, [AC_PICK]: { "~:armor": "~:plate", "~:shield": "~:shield" } });
  expect(await tableRows(page)).toEqual(WORN);
  await acBox(page, 20).click();
  await expect(entry(page, "Plate + Shield", 20)).toHaveAttribute("aria-checked", "true");
  await expect(entry(page, "Worn armor", 20)).toHaveAttribute("aria-checked", "false");
});

test("the table marks: the dot is an image with a name, the worn tag, and the bold row", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page, { [AC_PICK]: { "~:armor": "~:plate", "~:shield": null } });
  await expect(acBox(page, 18)).toBeVisible();
  await expect(table(page).getByRole("img", { name: "Shows in the Armor Class box" })).toHaveCount(1);
  await expect(table(page).getByRole("row", { name: "Shows in the Armor Class box Plate 18" })).toBeVisible();
  await expect(table(page).getByRole("row", { name: "Plate + Shield worn 20", exact: true })).toBeVisible();
  expect(await tableRows(page)).toEqual([
    "Chain Mail + Shield 18",
    "Chain Mail 16",
    "Plate + Shield worn 20",
    "● Plate 18 bold",
    "Unarmored + Shield 15",
    "Unarmored 13",
  ]);
});

test("the pick stays in an export and shows after an import", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page);
  await pick(page, 20, "Plate", 18);
  await expect(acBox(page, 18)).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const file = JSON.parse(readFileSync(await (await downloading).path(), "utf8"));
  expect(JSON.stringify(file)).toContain('"~:orc-alchemy.play/ac-pick":{"~:armor":"~:plate","~:shield":null}');
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(await (await downloading).path());
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await expect(acBox(page, 18)).toBeVisible();
  expect(await tableRows(page)).toContain("● Plate 18 bold");
});

test("the keyboard: Enter opens the menu, the arrow keys move, Enter picks, and the focus goes back to the box", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page);
  await acBox(page, 20).focus();
  await expect(acBox(page, 20)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(entry(page, "Worn armor", 20)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(entry(page, "Chain Mail + Shield", 18)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(entry(page, "Chain Mail", 16)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu(page)).toHaveCount(0);
  await expect(acBox(page, 16)).toBeFocused();
  await expect.poll(async () => (await storedValues(page))[AC_PICK]).toEqual({ "~:armor": "~:chain-mail", "~:shield": null });
  // The keyboard focus shows the inset ring of the box, as on the Hit dice box, in place of the focus outline.
  await page.mouse.move(0, 0);
  expect(
    await acBox(page, 16).evaluate((box) => [
      box.matches(":focus-visible"),
      getComputedStyle(box).boxShadow.includes("inset"),
      getComputedStyle(box).outlineStyle,
    ]),
  ).toEqual([true, true, "none"]);
});

for (const width of [1280, 390]) {
  test(`at ${width}px a pick moves no part of the vitals panel or of the table, and the menu fits the page`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openSheet(page);
    await page.mouse.move(0, 0);
    const vitals = await vitalsLayout(page);
    await tab(page, "More");
    const rows = await tableLayout(page);
    await tab(page, "Stats");

    await acBox(page, 20).click();
    await expect(menu(page)).toBeVisible();
    const box = (await menu(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await entry(page, "Unarmored", 13).click();
    await expect(acBox(page, 13)).toBeVisible();
    await page.mouse.move(0, 0);
    expect(await vitalsLayout(page), "the vitals panel").toEqual(vitals);
    await tab(page, "More");
    await expect.poll(() => tableRows(page)).toContain("● Unarmored 13 bold");
    expect(await tableLayout(page), "the table").toEqual(rows);
  });
}

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- ac-pick.spec.ts -g orc-325
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-325 the AC pick, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-325-${what}-${theme}.png`);
      /** A clip of the whole page around `parts`, with a margin: a screenshot of an element scrolls, and the sticky tabs of a phone cover it. */
      const clipShot = async (what: string, parts: Array<{ x: number; y: number; width: number; height: number }>) => {
        const scroll = await page.evaluate(() => window.scrollY);
        const x = Math.max(0, Math.min(...parts.map((p) => p.x)) - 8);
        const y = Math.max(0, Math.min(...parts.map((p) => p.y)) - 8) + scroll;
        const right = Math.min(page.viewportSize()!.width, Math.max(...parts.map((p) => p.x + p.width)) + 8);
        const bottom = Math.max(...parts.map((p) => p.y + p.height)) + 8 + scroll;
        await page.screenshot({ path: shot(what), fullPage: true, clip: { x, y, width: right - x, height: bottom - y } });
      };
      const vitalsPanel = () => page.locator(".ui-panel").filter({ has: anyAcBox(page) });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      for (const [size, width, height] of [
        ["desktop", 1280, 900],
        ["phone", 390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        await openSheet(page);
        await page.evaluate(() => window.scrollTo(0, 0));
        await acBox(page, 20).click();
        await expect(menu(page)).toBeVisible();
        await page.waitForTimeout(200);
        await clipShot(`${size}-menu-open`, [(await vitalsPanel().boundingBox())!, (await menu(page).boundingBox())!]);
        await entry(page, "Chain Mail", 16).click();
        await expect(acBox(page, 16)).toBeVisible();
        await page.mouse.move(0, 0);
        await clipShot(`${size}-picked-box`, [(await vitalsPanel().boundingBox())!]);
        await tab(page, "More");
        await table(page).scrollIntoViewIfNeeded();
        await clipShot(`${size}-picked-table`, [(await page.getByRole("group", { name: "AC by armor" }).boundingBox())!]);
      }
    });
  }
});
