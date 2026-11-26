// The ability score control in a browser (ORC-345, docs/design/character-builder.md "The Abilities step", "No layout
// shift", "Keyboard and screen reader"): six boxes that do not move or change their size, a swap of two scores by a
// drag (mouse and touch), by two clicks and by the keyboard, and the increases of a half-elf in a section below.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { newCharacter, openStep, pickIn, section } from "./builder-helpers.ts";

const ABILITIES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

/** A new character on the Abilities step; with `halfElf`, a half-elf. */
async function abilitiesStep(page: Page, { halfElf = false } = {}) {
  await newCharacter(page);
  if (halfElf) {
    await openStep(page, "Race");
    await pickIn(section(page, "Race"), "Half-Elf");
  }
  await openStep(page, "Abilities");
}

const control = (page: Page) => section(page, "Base Ability Scores");
const box = (page: Page, ability: string) => control(page).getByRole("group", { name: ability, exact: true });
const chip = (page: Page, ability: string) => box(page, ability).getByRole("button", { name: new RegExp(`^${ability} base score`) });
const method = (page: Page, name: string) => control(page).getByRole("button", { name, exact: true });
/** The base score of each box, from the names of the chips. */
const chipScores = async (page: Page) => Promise.all(ABILITIES.map(async (a) => Number((await chip(page, a).getAttribute("aria-label"))!.replace(/\D+/g, ""))));
const totals = (page: Page) => control(page).locator("[data-total]");

/** The box of each ability box, of the strip, of the sections of the step and of the row of Back and Next, as [x, y, width, height] in the page. */
const boxes = (page: Page) =>
  page.getByRole("region", { name: "Builder" }).evaluate((builder) =>
    [
      ...builder.querySelectorAll("[data-box]"),
      builder.querySelector("[data-strip]")!,
      ...builder.querySelectorAll(":scope > section"),
      builder.querySelector(":scope > div:last-child")!,
    ].map((e) => {
      const r = e.getBoundingClientRect();
      return [r.x + window.scrollX, r.y + window.scrollY, r.width, r.height];
    }),
  );

/** The minus and the plus of each point-buy box are inside their box, so that no part of them is cut. */
async function expectButtonsInBoxes(page: Page) {
  for (const ability of ABILITIES) {
    const outer = (await box(page, ability).boundingBox())!;
    for (const name of [`Decrease ${ability}`, `Increase ${ability}`]) {
      const inner = (await box(page, ability).getByRole("button", { name }).boundingBox())!;
      expect(inner.x).toBeGreaterThanOrEqual(outer.x);
      expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width);
    }
  }
}

// 1280px: six in a row. 860px, the narrowest page with the rail and the summary card (a control of 338px), 760px,
// with the rail and no summary card (ORC-353), 660px, a little narrower than the breakpoint with no rail, and 390px:
// three in a row. 320px: a control of 288px, two in a row.
for (const width of [1280, 860, 760, 660, 390, 320]) {
  test(`the boxes do not move or change their size at a change of method or of a score, ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await abilitiesStep(page, { halfElf: true });
    await expect(method(page, "Standard Scores")).toHaveAttribute("aria-pressed", "true");
    const before = await boxes(page);
    // Six boxes, the strip, the control and the half-elf's section, and the row of Back and Next.
    expect(before.length).toBe(10);
    // Six in a row on a wide page, three in a row on the narrower ones, and two in a row in a control of 288px.
    const rows = new Set(before.slice(0, 6).map(([, y]) => y));
    expect(rows.size).toBe(width === 1280 ? 1 : width === 320 ? 3 : 2);

    const same = async () => expect(await boxes(page)).toEqual(before);
    // A chip held, so the strip shows the longer hint, and a swap by two clicks.
    await chip(page, "Strength").click();
    await expect(control(page).locator("[data-strip]")).toHaveText(/Now pick the score to swap with/);
    await same();
    await chip(page, "Wisdom").click();
    await expect(totals(page).first()).toHaveText(/10$/);
    await same();
    for (const name of ["Point Buy", "Manual Entry", "Standard Roll", "Standard Scores", "Point Buy"]) {
      await method(page, name).click();
      await expect(method(page, name)).toHaveAttribute("aria-pressed", "true");
      await same();
      if (name === "Point Buy") await expectButtonsInBoxes(page);
      if (name === "Standard Roll") {
        await control(page).getByRole("button", { name: "Re-roll" }).click();
        await same();
      }
    }
    // A score in point buy, then a point of the half-elf: a token shows in the box, and nothing moves.
    await box(page, "Strength").getByRole("button", { name: "Increase Strength" }).click();
    await expect(box(page, "Strength").getByText("next: 1 pt")).toBeVisible();
    await same();
    const increases = section(page, "Ability Score Increase: Half-Elf");
    await increases.getByRole("button", { name: "Increase Strength" }).click();
    await increases.getByRole("button", { name: "Increase Dexterity" }).click();
    await expect(box(page, "Strength").locator("[data-token]")).toHaveText(["+1 Race"]);
    await same();
    await method(page, "Manual Entry").click();
    await box(page, "Strength").getByRole("textbox").fill("17");
    await expect(totals(page).first()).toHaveText(/18$/);
    await same();
  });
}

test("a swap with the keyboard: Enter picks a chip up, Escape puts it down, and Space on a second chip swaps; a live region says it", async ({ page }) => {
  await abilitiesStep(page);
  const status = control(page).getByRole("status");
  await chip(page, "Strength").focus();
  await expect(chip(page, "Strength")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(chip(page, "Strength")).toHaveAttribute("aria-pressed", "true");
  await expect(status).toHaveText("Strength 15 picked up.");
  await page.keyboard.press("Escape");
  await expect(chip(page, "Strength")).toHaveAttribute("aria-pressed", "false");
  await expect(status).toHaveText("Strength 15 put down.");

  await page.keyboard.press("Space");
  await expect(chip(page, "Strength")).toHaveAttribute("aria-pressed", "true");
  // Tab to the Dexterity chip, the next one.
  await page.keyboard.press("Tab");
  await expect(chip(page, "Dexterity")).toBeFocused();
  await page.keyboard.press("Space");
  await expect(status).toHaveText("Strength 14, Dexterity 15");
  expect(await chipScores(page)).toEqual([14, 15, 13, 12, 10, 8]);
  // The focus stays on the chip in the second box, which now has the 15; no chip is held.
  await expect(chip(page, "Dexterity")).toBeFocused();
  await expect(chip(page, "Dexterity")).toHaveAccessibleName("Dexterity base score 15");
  await expect(control(page).locator('[data-chip][aria-pressed="true"]')).toHaveCount(0);
});

/** The center of a locator's box. */
async function center(locator: Locator) {
  const b = (await locator.boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test("a drag of a chip with the mouse to a different box swaps the two scores; a drop outside a box does nothing", async ({ page }) => {
  await abilitiesStep(page);
  const from = await center(chip(page, "Strength"));
  const to = await center(box(page, "Charisma").locator("[data-total]"));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 10, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await expect(box(page, "Charisma")).toHaveAttribute("data-over", "");
  await page.mouse.up();
  await expect(control(page).getByRole("status")).toHaveText("Strength 8, Charisma 15");
  expect(await chipScores(page)).toEqual([8, 14, 13, 12, 10, 15]);
  // The drag is no click: no chip is held.
  await expect(control(page).locator('[data-chip][aria-pressed="true"]')).toHaveCount(0);

  // A drop on the step title, outside the boxes.
  const dex = await center(chip(page, "Dexterity"));
  const title = await center(page.getByRole("region", { name: "Builder" }).getByRole("heading", { level: 2 }));
  await page.mouse.move(dex.x, dex.y);
  await page.mouse.down();
  await page.mouse.move(title.x, title.y, { steps: 8 });
  await page.mouse.up();
  expect(await chipScores(page)).toEqual([8, 14, 13, 12, 10, 15]);
  await expect(control(page).locator('[data-chip][aria-pressed="true"]')).toHaveCount(0);
});

test("a drag of a chip with a touch swaps the two scores", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await abilitiesStep(page);
  const source = chip(page, "Constitution");
  const from = await center(source);
  const to = await center(box(page, "Intelligence").locator("[data-total]"));
  const touch = { pointerType: "touch", pointerId: 7, isPrimary: true, button: 0, buttons: 1 };
  await source.dispatchEvent("pointerdown", { ...touch, clientX: from.x, clientY: from.y });
  await source.dispatchEvent("pointermove", { ...touch, clientX: from.x + 12, clientY: from.y + 12 });
  await source.dispatchEvent("pointermove", { ...touch, clientX: to.x, clientY: to.y });
  await source.dispatchEvent("pointerup", { ...touch, buttons: 0, clientX: to.x, clientY: to.y });
  await expect(control(page).getByRole("status")).toHaveText("Constitution 12, Intelligence 13");
  expect(await chipScores(page)).toEqual([15, 14, 12, 13, 10, 8]);
});

test("the half-elf's increases: a token in the box, the left mark, and a plus that would pass 20 is disabled", async ({ page }) => {
  await abilitiesStep(page, { halfElf: true });
  const increases = section(page, "Ability Score Increase: Half-Elf");
  await expect(increases.getByRole("heading")).toHaveText(/2 left$/);
  // The half-elf's Cha +2 is fixed, so Cha is not offered.
  await expect(increases.getByRole("button", { name: "Increase Charisma" })).toBeDisabled();
  await expect(box(page, "Charisma").locator("[data-token]")).toHaveText(["+2 Race"]);
  // Manual Entry: Strength 20 cannot take a point.
  await method(page, "Manual Entry").click();
  await box(page, "Strength").getByRole("textbox").fill("20");
  await expect(totals(page).first()).toHaveText(/20$/);
  await expect(increases.getByRole("button", { name: "Increase Strength" })).toBeDisabled();
  await increases.getByRole("button", { name: "Increase Wisdom" }).click();
  await expect(box(page, "Wisdom").locator("[data-token]")).toHaveText(["+1 Race"]);
  await expect(increases.getByRole("heading")).toHaveText(/1 left$/);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/ability-scores.spec.ts -g orc-345 --trace off
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  const ready = async (page: Page) => {
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
  };
  const shoot = (page: Page, name: string) =>
    page.getByRole("region", { name: "Builder" }).screenshot({ path: join(dir, `orc-345-${name}.png`), animations: "disabled" });

  // 1280px: six in a row. 660px, a little narrower than the breakpoint with no rail, and 390px: three in a row.
  for (const theme of ["light", "dark"])
    for (const width of [1280, 390]) {
      const size = width === 390 ? "390" : "desktop";
      test(`orc-345 each method, ${size}, ${theme}`, async ({ page }) => {
        mkdirSync(dir, { recursive: true });
        await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
        await page.setViewportSize({ width, height: 1000 });
        await abilitiesStep(page, { halfElf: true });
        const increases = section(page, "Ability Score Increase: Half-Elf");
        await increases.getByRole("button", { name: "Increase Strength" }).click();
        for (const [key, name] of [
          ["standard-scores", "Standard Scores"],
          ["standard-roll", "Standard Roll"],
          ["point-buy", "Point Buy"],
          ["manual-entry", "Manual Entry"],
        ]) {
          await method(page, name).click();
          await expect(method(page, name)).toHaveAttribute("aria-pressed", "true");
          if (key === "point-buy")
            for (const ability of ["Strength", "Strength", "Strength", "Dexterity", "Constitution", "Constitution"])
              await box(page, ability)
                .getByRole("button", { name: `Increase ${ability}` })
                .click();
          await ready(page);
          await shoot(page, `${key}-${size}-${theme}`);
        }
      });
    }

  for (const theme of ["light", "dark"])
    test(`orc-345 a chip picked up, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      await page.setViewportSize({ width: 1280, height: 1000 });
      await abilitiesStep(page, { halfElf: true });
      await chip(page, "Dexterity").click();
      await ready(page);
      await shoot(page, `chip-picked-up-${theme}`);
    });
});
