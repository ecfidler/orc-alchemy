// The Cast control of the spell view in the Spells panel (ORC-320,
// docs/design/sheet-interactivity.md "Casting a spell"): Cast at the spell
// level, the menu "Cast at a higher level" with the calculated amounts, the
// hint and the status lines, the concentration mark with its question, the
// Concentrate button, and the pact slots of a warlock.
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

/** Life cleric 9: 4 1st-, 3 2nd-, 3 3rd-, 3 4th- and 1 5th-level slots; Bless, Shield of Faith and Guidance need concentration. */
const CLERIC = join(import.meta.dirname, "life-cleric-9.strict.json");
/** Wizard 3 / warlock 2: 4 1st- and 2 2nd-level slots, and 2 pact slots of the 1st level. */
const WIZARD_WARLOCK = join(import.meta.dirname, "wizard-3-warlock-2.strict.json");
/** Warlock 20: only pact slots, 4 of the 5th level. */
const WARLOCK = join(import.meta.dirname, "warlock-20.strict.json");

const VALUES = "~:orcpub.entity.strict/values";
const SLOTS_USED = "~:orcpub.dnd.e5.spells/slots-used";
const CONCENTRATION = "~:orc-alchemy.play/concentration";

/** Imports a character file with more values in its record, and opens its sheet. */
async function open(page: Page, file: string, values: Record<string, unknown> = {}) {
  const entity = JSON.parse(readFileSync(file, "utf8"));
  entity[VALUES] = { ...entity[VALUES], ...values };
  await page.goto("/import");
  await page
    .getByLabel("Import character file")
    .setInputFiles({ name: "cast.strict.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(entity)) });
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await page.evaluate(() => document.fonts.ready);
}

/** The values of the one stored character, read from IndexedDB. */
const storedValues = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Record<string, unknown>>((resolve, reject) => {
        const open = indexedDB.open("alchemy-5e");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction("characters").objectStore("characters").getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            open.result.close();
            resolve(all.result[0]?.entity?.["~:orcpub.entity.strict/values"] ?? {});
          };
        };
      }),
  );

const panel = (page: Page) => page.getByRole("dialog", { name: "Spells" });
const spellPane = (page: Page) => panel(page).locator("[data-pane=spell]");
const view = (page: Page) => spellPane(page).getByRole("region");
const nameBlock = (page: Page) => view(page).locator("[data-name-block]");
const control = (page: Page) => view(page).locator("[data-cast-control]");
const castGroup = (page: Page, name: string) => view(page).getByRole("group", { name: `Cast ${name}` });
const castButton = (page: Page, name: string) => castGroup(page, name).getByRole("button").first();
const arrow = (page: Page) => view(page).getByRole("button", { name: "Cast at a higher level" });
const menu = (page: Page) => page.getByRole("menu", { name: "Cast at a higher level" });
const status = (page: Page) => control(page).getByRole("status");
/** The cells of each entry of the open menu. */
const entries = (page: Page) =>
  menu(page)
    .getByRole("menuitem")
    .evaluateAll((items) => items.map((item) => [...item.children].map((cell) => cell.textContent ?? "")));

/** Opens the Spells panel, if it is not open, and shows a spell from its row in the list. */
async function openSpell(page: Page, name: string) {
  const phone = (page.viewportSize()?.width ?? 1280) <= 600;
  if (!(await panel(page).isVisible())) {
    // On a phone the sheet has tabs, and the spells are on the Spells tab.
    if (phone) await page.getByRole("tab", { name: "Spells" }).click();
    await page.getByRole("button", { name: "All spells" }).click();
    await expect(panel(page)).toBeVisible();
  }
  const back = panel(page).getByRole("button", { name: "Back to the list" });
  if (phone && (await back.isVisible())) await back.click();
  await panel(page)
    .locator("[data-spell-row]")
    .filter({ hasText: new RegExp(`^${name}`) })
    .first()
    .click();
  await expect(view(page).getByRole("heading", { level: 3 })).toHaveText(name);
}

/** The place and size of the name block and of each part in it, and of the facts under it. */
const layout = (page: Page) =>
  view(page).evaluate((element) => {
    const origin = element.getBoundingClientRect();
    const block = element.querySelector("[data-name-block]");
    if (!block) return [];
    return [block, ...block.querySelectorAll("h3, p, button, [role=group]"), block.nextElementSibling].map((part) => {
      const { x, y, width, height } = (part as Element).getBoundingClientRect();
      return [x - origin.x, y - origin.y, width, height].map((n) => Math.round(n * 10) / 10).join(" ");
    });
  });

/** Takes the focus off the focused element, so that a screenshot shows no focus ring. */
const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

test("Cast beside the name spends a slot of the spell level; the hint and the status lines say it, and nothing moves", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, CLERIC);
  await openSpell(page, "Cure Wounds");
  // The control is in the name block, on the right of the name.
  const heading = (await view(page).getByRole("heading", { level: 3 }).boundingBox())!;
  const group = (await castGroup(page, "Cure Wounds").boundingBox())!;
  expect(group.x).toBeGreaterThan(heading.x + 100);
  expect(Math.abs(group.y - heading.y)).toBeLessThan(12);
  await expect(castButton(page, "Cure Wounds")).toHaveText("Cast");
  await expect(castButton(page, "Cure Wounds").locator("svg[data-icon=sparkles]")).toHaveCount(1);
  await expect(castButton(page, "Cure Wounds")).toHaveAccessibleDescription("1st-level slot · 4 left");
  await expect(status(page)).toHaveText("");
  const before = await layout(page);
  await castButton(page, "Cure Wounds").click();
  await expect(status(page)).toHaveText("Cast Cure Wounds. 1st-level slots −1 (3 left).");
  await expect(castButton(page, "Cure Wounds")).toHaveAccessibleDescription("1st-level slot · 3 left");
  // The slot block of the panel shows the spent slot.
  await expect(panel(page).getByRole("slider", { name: "1st-level slots" })).toHaveAttribute("aria-valuetext", "1 of 4 spent");
  expect(await layout(page)).toEqual(before);
  // The record has the spent slot, and keeps it after a reload.
  await expect.poll(async () => (await storedValues(page))[SLOTS_USED]).toEqual({ "~:orcpub.dnd.e5.spells/slots-1": { "~#set": [0] } });
  await page.reload();
  await openSpell(page, "Cure Wounds");
  await expect(castButton(page, "Cure Wounds")).toHaveAccessibleDescription("1st-level slot · 3 left");
  // The status line starts empty.
  await expect(status(page)).toHaveText("");
});

test("the menu lists each higher level with its calculated amount and the slots left, and a pick spends that level", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // No 2nd-level slot left.
  await open(page, CLERIC, { [SLOTS_USED]: { "~:orcpub.dnd.e5.spells/slots-2": { "~#set": [0, 1, 2] } } });
  await openSpell(page, "Cure Wounds");
  const before = await layout(page);
  await arrow(page).click();
  await expect(menu(page)).toBeVisible();
  await expect(menu(page)).toContainText("Cast at a higher level");
  expect(await entries(page)).toEqual([
    ["2nd level", "+1d8", "none left"],
    ["3rd level", "+2d8", "3 left"],
    ["4th level", "+3d8", "3 left"],
    ["5th level", "+4d8", "1 left"],
  ]);
  await expect(menu(page).getByRole("menuitem", { name: /^2nd level/ })).toHaveAttribute("aria-disabled", "true");
  // The menu opens under the control, at its end.
  const controlBox = (await castGroup(page, "Cure Wounds").boundingBox())!;
  const menuBox = (await menu(page).boundingBox())!;
  expect(menuBox.y).toBeGreaterThanOrEqual(controlBox.y + controlBox.height);
  expect(Math.abs(menuBox.x + menuBox.width - (controlBox.x + controlBox.width))).toBeLessThan(2);
  await menu(page)
    .getByRole("menuitem", { name: /^3rd level/ })
    .click();
  await expect(menu(page)).toBeHidden();
  await expect(status(page)).toHaveText("Cast Cure Wounds at 3rd level. 3rd-level slots −1 (2 left).");
  // Cast still spends the spell level: the 1st-level slots are as they were.
  await expect(castButton(page, "Cure Wounds")).toHaveAccessibleDescription("1st-level slot · 4 left");
  expect(await layout(page)).toEqual(before);
  await expect
    .poll(async () => (await storedValues(page))[SLOTS_USED])
    .toEqual({ "~:orcpub.dnd.e5.spells/slots-2": { "~#set": [0, 1, 2] }, "~:orcpub.dnd.e5.spells/slots-3": { "~#set": [0] } });
});

test("the keyboard opens the menu from the arrow part and casts at a higher level; the focus goes back to the arrow part", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, CLERIC);
  await openSpell(page, "Cure Wounds");
  await arrow(page).focus();
  await expect(arrow(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu(page)).toBeVisible();
  const first = menu(page).getByRole("menuitem", { name: /^2nd level/ });
  await expect(first).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu(page).getByRole("menuitem", { name: /^3rd level/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu(page)).toBeHidden();
  await expect(status(page)).toHaveText("Cast Cure Wounds at 3rd level. 3rd-level slots −1 (2 left).");
  await expect(arrow(page)).toBeFocused();
});

test("with no slot of the spell level left, Cast is disabled with its hint, and the menu still works; with none at all, the button says so", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, CLERIC, { [SLOTS_USED]: { "~:orcpub.dnd.e5.spells/slots-1": { "~#set": [0, 1, 2, 3] } } });
  await openSpell(page, "Cure Wounds");
  await expect(castButton(page, "Cure Wounds")).toBeDisabled();
  await expect(castButton(page, "Cure Wounds")).toHaveAccessibleDescription("No 1st-level slot left. Pick a higher level.");
  await expect(arrow(page)).toBeEnabled();
  // Raise Dead, the one 5th-level spell: the last 5th-level slot.
  await openSpell(page, "Raise Dead");
  await castButton(page, "Raise Dead").click();
  await expect(status(page)).toHaveText("Cast Raise Dead. 5th-level slots −1 (0 left).");
  await expect(castButton(page, "Raise Dead")).toHaveText("No slots left");
  await expect(castButton(page, "Raise Dead")).toBeDisabled();
  // The focus goes to the next control that is not disabled, not to the page.
  await expect.poll(() => page.evaluate(() => document.activeElement?.tagName)).not.toBe("BODY");
});

test("a spell with other words shows its text at the bottom of the menu, with no amount column", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, CLERIC);
  await openSpell(page, "Spiritual Weapon");
  await arrow(page).click();
  expect(await entries(page)).toEqual([
    ["3rd level", "3 left"],
    ["4th level", "3 left"],
    ["5th level", "1 left"],
  ]);
  await expect(menu(page)).toContainText(
    "At Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, the damage increases by 1d8 for every two slot levels above 2nd.",
  );
  await page.keyboard.press("Escape");
  await expect(menu(page)).toBeHidden();
});

test("a cast that needs concentration sets the mark; a second one asks first, and Cancel casts nothing", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, CLERIC);
  await openSpell(page, "Bless");
  await castButton(page, "Bless").click();
  await expect(status(page)).toHaveText("Cast Bless. 1st-level slots −1 (3 left).");
  await expect.poll(async () => (await storedValues(page))[CONCENTRATION]).toBe("~:bless");
  // Bless again: the same spell does not ask.
  await castButton(page, "Bless").click();
  await expect(status(page)).toHaveText("Cast Bless. 1st-level slots −1 (2 left).");
  await openSpell(page, "Shield of Faith");
  const before = await layout(page);
  await castButton(page, "Shield of Faith").click();
  const ask = page.getByRole("dialog", { name: "Cast Shield of Faith?" });
  await expect(ask).toBeVisible();
  await expect(ask).toContainText("You concentrate on Bless. Shield of Faith also needs concentration, so Bless ends.");
  await expect(ask.getByRole("button", { name: "Cast and end Bless" })).toBeFocused();
  await ask.getByRole("button", { name: "Cancel" }).click();
  await expect(ask).toBeHidden();
  await expect(status(page)).toHaveText("");
  await expect(castButton(page, "Shield of Faith")).toBeFocused();
  await castButton(page, "Shield of Faith").click();
  await ask.getByRole("button", { name: "Cast and end Bless" }).click();
  await expect(ask).toBeHidden();
  await expect(status(page)).toHaveText("Cast Shield of Faith. 1st-level slots −1 (1 left).");
  expect(await layout(page)).toEqual(before);
  await expect.poll(async () => (await storedValues(page))[CONCENTRATION]).toBe("~:shield-of-faith");
  await expect.poll(async () => (await storedValues(page))[SLOTS_USED]).toEqual({ "~:orcpub.dnd.e5.spells/slots-1": { "~#set": [0, 1, 2] } });
});

test("a cantrip that needs concentration has the Concentrate button; a cantrip without it has no control", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, CLERIC, { [CONCENTRATION]: "~:bless" });
  await openSpell(page, "Guidance");
  const concentrate = view(page).getByRole("button", { name: "Concentrate" });
  await expect(concentrate).toHaveAccessibleDescription("This sets the concentration mark and spends nothing.");
  await concentrate.click();
  const ask = page.getByRole("dialog", { name: "Concentrate on Guidance?" });
  await ask.getByRole("button", { name: "Concentrate and end Bless" }).click();
  await expect(status(page)).toHaveText("Concentrating on Guidance.");
  await expect(concentrate).toBeDisabled();
  await expect(concentrate).toHaveAccessibleDescription("You concentrate on this spell.");
  await expect.poll(async () => (await storedValues(page))[CONCENTRATION]).toBe("~:guidance");
  await expect.poll(async () => (await storedValues(page))[SLOTS_USED]).toBeUndefined();
  await openSpell(page, "Sacred Flame");
  await expect(view(page).getByRole("button", { name: /^(Cast|Concentrate)/ })).toHaveCount(0);
  await expect(nameBlock(page)).toHaveCount(0);
});

test("pact slots and other slots: Cast spends an other slot, and the menu has the pact entry", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, WIZARD_WARLOCK);
  await openSpell(page, "Hellish Rebuke");
  await expect(castButton(page, "Hellish Rebuke")).toHaveAccessibleDescription("1st-level slot · 4 left");
  await arrow(page).click();
  expect(await entries(page)).toEqual([
    ["2nd level", "+1d10", "2 left"],
    ["Pact (1st)", "", "2 left"],
  ]);
  await menu(page).getByRole("menuitem", { name: /^Pact/ }).click();
  await expect(status(page)).toHaveText("Cast Hellish Rebuke. Pact slots −1 (1 left).");
  await expect(castButton(page, "Hellish Rebuke")).toHaveAccessibleDescription("1st-level slot · 4 left");
});

test("a warlock with only pact slots has a plain Cast button with the amount at the pact level in its hint", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, WARLOCK);
  await openSpell(page, "Vampiric Touch");
  await expect(arrow(page)).toHaveCount(0);
  await expect(castButton(page, "Vampiric Touch")).toHaveAccessibleDescription("Pact slot (5th) · 4 left · +2d6 at 5th level");
  await castButton(page, "Vampiric Touch").click();
  await expect(status(page)).toHaveText("Cast Vampiric Touch at 5th level. Pact slots −1 (3 left).");
  await expect(castButton(page, "Vampiric Touch")).toHaveAccessibleDescription("Pact slot (5th) · 3 left · +2d6 at 5th level");
});

test("on a phone the control is under the name, the menu has the full width of the panel, and nothing moves at a cast", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, CLERIC);
  await openSpell(page, "Cure Wounds");
  const heading = (await view(page).getByRole("heading", { level: 3 }).boundingBox())!;
  const group = (await castGroup(page, "Cure Wounds").boundingBox())!;
  expect(group.y).toBeGreaterThan(heading.y + heading.height - 1);
  const before = await layout(page);
  await arrow(page).click();
  await expect(menu(page)).toBeVisible();
  const menuBox = (await menu(page).boundingBox())!;
  const viewBox = (await view(page).boundingBox())!;
  expect(Math.abs(menuBox.x - viewBox.x)).toBeLessThan(1.5);
  expect(Math.abs(menuBox.width - viewBox.width)).toBeLessThan(1.5);
  // The menu opens just under the button, over the hint and the status lines.
  expect(menuBox.y).toBeGreaterThanOrEqual(group.y + group.height);
  expect(menuBox.y).toBeLessThan(group.y + group.height + 8);
  await menu(page)
    .getByRole("menuitem", { name: /^2nd level/ })
    .click();
  await expect(status(page)).toHaveText("Cast Cure Wounds at 2nd level. 2nd-level slots −1 (2 left).");
  expect(await layout(page)).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/cast.spec.ts -g orc-320
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-320 Cast, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-320-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      for (const [size, width, height] of [
        ["desktop", 1280, 900],
        ["phone", 390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        await open(page, CLERIC, { [CONCENTRATION]: "~:bless" });
        await openSpell(page, "Cure Wounds");
        await blur(page);
        await page.screenshot({ path: shot(`${size}-cast-control`) });
        await arrow(page).click();
        await expect(menu(page)).toBeVisible();
        await page.screenshot({ path: shot(`${size}-menu-amounts`) });
        await menu(page)
          .getByRole("menuitem", { name: /^3rd level/ })
          .click();
        await expect(status(page)).not.toHaveText("");
        await blur(page);
        await page.screenshot({ path: shot(`${size}-status`) });
        await openSpell(page, "Spiritual Weapon");
        await arrow(page).click();
        await expect(menu(page)).toBeVisible();
        await page.screenshot({ path: shot(`${size}-menu-text`) });
        await page.keyboard.press("Escape");
        await openSpell(page, "Shield of Faith");
        await castButton(page, "Shield of Faith").click();
        const ask = page.getByRole("dialog", { name: "Cast Shield of Faith?" });
        await expect(ask).toBeVisible();
        await blur(page);
        await page.screenshot({ path: shot(`${size}-concentration-dialog`) });
        await ask.getByRole("button", { name: "Cancel" }).click();
        await expect(ask).toBeHidden();
        await open(page, WARLOCK);
        await openSpell(page, "Vampiric Touch");
        await blur(page);
        await page.screenshot({ path: shot(`${size}-warlock`) });
      }
    });
  }
});
