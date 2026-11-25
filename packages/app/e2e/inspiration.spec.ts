// The Inspiration box and the ability highlight of the left column (ORC-324,
// docs/design/sheet-interactivity.md "Inspiration" and "Ability highlight"):
// set and remove inspiration, its stored record, and no rest changes it; the
// skills of an ability on hover, focus and a kept click; and neither moves any
// part of the left column.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { openWithValues, storedValues } from "./play-helpers.ts";

/** wizard-5: 5 d6, 32 hit points; Arcane Recovery (Dawn), so the Rest menu has Dawn. */
const WIZARD = join(import.meta.dirname, "../../../fixtures/characters/wizard-5.strict.json");

const INSPIRATION = "~:orc-alchemy.play/inspiration";

const inspiration = (page: Page) => page.getByRole("button", { name: "Inspiration", exact: true });
const ability = (page: Page, name: string) => page.getByRole("button", { name: `${name}: highlight the skills` });
/** The names of the skill lines with the highlight, as "Insight". */
const highlighted = (page: Page) =>
  page.locator("li[data-highlight]").evaluateAll((lines) => lines.map((line) => line.textContent!.replace(/^\S+ (.*) \S+$/, "$1")));
/** The abilities part of the left column: the ability boxes, Inspiration, Proficiency Bonus, the saving throws and the skills. */
const leftColumn = (page: Page) =>
  page
    .locator(".ui-panel")
    .filter({ has: ability(page, "Strength") })
    .locator("..");
/**
 * The size of the left column, and the place and size of each element in it, from the top left corner of the column
 * (a click can scroll the page), to the tenth of a pixel. The mark in the Inspiration box is not a part: it comes and goes.
 */
const layout = (page: Page) =>
  leftColumn(page).evaluate((column) => {
    const origin = column.getBoundingClientRect();
    return [column, ...column.querySelectorAll("*")]
      .filter((element) => !element.matches(".ui-small-box-value > *"))
      .map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return `${element.tagName} ${[x - origin.x, y - origin.y, width, height].map((n) => Math.round(n * 10) / 10).join(" ")}`;
      });
  });

/** Opens the sheet; on a phone, the Stats tab shows the left column. */
async function openSheet(page: Page, values: Record<string, unknown> = {}) {
  await openWithValues(page, WIZARD, values);
  if ((page.viewportSize()?.width ?? 1280) < 720) await expect(page.getByRole("tab", { name: "Stats" })).toHaveAttribute("aria-selected", "true");
  await expect(inspiration(page)).toBeVisible();
}

/** Moves the mouse off the sheet and takes the focus off the focused element. */
async function away(page: Page) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
}

test("a click on the Inspiration box sets inspiration and shows the mark; a second click removes it; the record keeps it after a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page);
  await expect(inspiration(page)).toHaveAttribute("aria-pressed", "false");
  await expect(inspiration(page)).toHaveText("Inspiration");
  const before = await storedValues(page);
  expect(before[INSPIRATION]).toBeUndefined();
  await inspiration(page).click();
  await expect(inspiration(page)).toHaveAttribute("aria-pressed", "true");
  await expect(inspiration(page)).toHaveText("✦Inspiration");
  // The whole record: the click adds only inspiration.
  await expect.poll(() => storedValues(page)).toEqual({ ...before, [INSPIRATION]: true });
  await page.reload();
  await expect(inspiration(page)).toHaveAttribute("aria-pressed", "true");
  await inspiration(page).click();
  await expect(inspiration(page)).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => storedValues(page)).toEqual(before);
  await page.reload();
  await expect(inspiration(page)).toHaveAttribute("aria-pressed", "false");
  // Space on the focused box sets it too.
  await inspiration(page).focus();
  await expect(inspiration(page)).toBeFocused();
  await page.keyboard.press("Space");
  await expect(inspiration(page)).toHaveAttribute("aria-pressed", "true");
});

test("no rest changes inspiration: Short rest, Long rest and Dawn", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page, { [INSPIRATION]: true, "~:orcpub.dnd.e5.character/current-hit-points": 9 });
  for (const rest of ["Short rest", "Long rest", "Dawn"]) {
    await page.getByRole("button", { name: "Rest", exact: true }).click();
    await page.getByRole("menuitem", { name: rest }).click();
    const dialog = page.getByRole("dialog", { name: rest });
    await dialog.getByRole("button", { name: "Finish" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(inspiration(page), `after ${rest}`).toHaveAttribute("aria-pressed", "true");
    await expect.poll(async () => (await storedValues(page))[INSPIRATION], `after ${rest}`).toBe(true);
  }
});

test("a hover or the focus on an ability box highlights only the skills of its ability, in the note color", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page);
  expect(await highlighted(page)).toEqual([]);
  await ability(page, "Wisdom").hover();
  await expect.poll(() => highlighted(page)).toEqual(["Animal Handling", "Insight", "Medicine", "Perception", "Survival"]);
  // Only skills: the saving throws and the rest of the sheet have no highlight.
  await expect(page.getByRole("group", { name: "Saving Throws" }).locator("li[data-highlight]")).toHaveCount(0);
  await expect(page.locator("[data-highlight]")).toHaveCount(5);
  const colors = await page
    .locator("li[data-highlight]")
    .first()
    .evaluate((line) => {
      const note = getComputedStyle(document.documentElement).getPropertyValue("--note").trim();
      const probe = document.createElement("span");
      probe.style.color = note;
      document.body.append(probe);
      const want = getComputedStyle(probe).color;
      probe.remove();
      return [getComputedStyle(line).backgroundColor, want];
    });
  expect(colors[0]).toBe(colors[1]);
  await page.mouse.move(0, 0);
  await expect.poll(() => highlighted(page)).toEqual([]);
  // The keyboard focus shows the skills; the focus that moves on takes them.
  await ability(page, "Strength").focus();
  await expect(ability(page, "Strength")).toBeFocused();
  await expect.poll(() => highlighted(page)).toEqual(["Athletics"]);
  await page.keyboard.press("Tab");
  await expect(ability(page, "Dexterity")).toBeFocused();
  await expect.poll(() => highlighted(page)).toEqual(["Acrobatics", "Sleight of Hand", "Stealth"]);
  await away(page);
  await expect.poll(() => highlighted(page)).toEqual([]);
  // Constitution has no skill, so it shows nothing.
  await ability(page, "Constitution").hover();
  await page.waitForTimeout(100);
  expect(await highlighted(page)).toEqual([]);
});

test("a click keeps the highlight; a second click on the same ability removes it; a click on another ability moves it; nothing saves it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openSheet(page);
  const before = await storedValues(page);
  await ability(page, "Wisdom").click();
  await expect(ability(page, "Wisdom")).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(0, 0);
  await expect.poll(() => highlighted(page)).toEqual(["Animal Handling", "Insight", "Medicine", "Perception", "Survival"]);
  await ability(page, "Intelligence").click();
  await page.mouse.move(0, 0);
  await expect(ability(page, "Wisdom")).toHaveAttribute("aria-pressed", "false");
  await expect(ability(page, "Intelligence")).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => highlighted(page)).toEqual(["Arcana", "History", "Investigation", "Nature", "Religion"]);
  // The second click removes it at once, under the mouse and with the focus on the box.
  await ability(page, "Intelligence").click();
  await expect(ability(page, "Intelligence")).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => highlighted(page)).toEqual([]);
  await expect(ability(page, "Intelligence")).toBeFocused();
  await page.mouse.move(0, 0);
  expect(await highlighted(page)).toEqual([]);
  // Space keeps it too, and a second Space removes it.
  await ability(page, "Charisma").focus();
  await expect(ability(page, "Charisma")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(ability(page, "Charisma")).toHaveAttribute("aria-pressed", "true");
  await away(page);
  await expect.poll(() => highlighted(page)).toEqual(["Deception", "Intimidation", "Performance", "Persuasion"]);
  // The highlight is not play state: the record does not change, and a reload shows none.
  expect(await storedValues(page)).toEqual(before);
  await page.reload();
  await expect(inspiration(page)).toBeVisible();
  await expect(ability(page, "Charisma")).toHaveAttribute("aria-pressed", "false");
  expect(await highlighted(page)).toEqual([]);
});

for (const width of [1280, 390]) {
  test(`at ${width}px the mark and the highlight move no part of the left column`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openSheet(page);
    await away(page);
    const before = await layout(page);
    await inspiration(page).click();
    await expect(inspiration(page)).toHaveAttribute("aria-pressed", "true");
    await away(page);
    expect(await layout(page), "with the mark").toEqual(before);
    await ability(page, "Dexterity").click();
    await away(page);
    await expect.poll(() => highlighted(page)).toEqual(["Acrobatics", "Sleight of Hand", "Stealth"]);
    expect(await layout(page), "with the highlight").toEqual(before);
    await ability(page, "Wisdom").hover();
    await expect(ability(page, "Wisdom")).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => highlighted(page)).toContain("Insight");
    expect(await layout(page), "with the hover").toEqual(before);
  });
}

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- inspiration.spec.ts -g orc-324
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-324 Inspiration and the ability highlight, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-324-${what}-${theme}.png`);
      // A clip of the whole page at the top: a screenshot of the element scrolls, and the sticky tabs of a phone cover it.
      const columnShot = async (what: string) => {
        await page.evaluate(() => window.scrollTo(0, 0));
        const clip = (await leftColumn(page).boundingBox())!;
        await page.screenshot({ path: shot(what), fullPage: true, clip });
      };
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      for (const [size, width, height] of [
        ["desktop", 1280, 900],
        ["phone", 390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        await openSheet(page);
        await away(page);
        await columnShot(`${size}-inspiration-off`);
        await inspiration(page).click();
        await away(page);
        await columnShot(`${size}-inspiration-on`);
        await ability(page, "Wisdom").click();
        await away(page);
        await expect.poll(() => highlighted(page)).toContain("Insight");
        await columnShot(`${size}-wisdom-kept`);
      }
    });
  }
});
