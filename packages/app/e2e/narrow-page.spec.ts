// The builder on a narrow page (ORC-353, docs/design/character-builder.md "A narrow page" and "The summary card"): at
// 390px each step fits in the page, with the rail, the Sheet button and the modals; from 720px to 860px the summary
// card does not show, so that the step keeps the width that its controls need.
import { expect, type Locator, type Page, test } from "@playwright/test";
import { addFirstClass, builder, classCard, newCharacter, openFixture, openStep, pickIn, rowHead, STEPS, section } from "./builder-helpers.ts";
import { summaryCard } from "./sheet-panel.ts";

/**
 * The parts of the builder that go past the right side of the step, as short names: an element whose box ends after
 * the step, and that no box between it and the step cuts or scrolls. Empty when the step fits.
 */
const pastTheStep = (page: Page) =>
  builder(page).evaluate((step) => {
    const right = step.getBoundingClientRect().right + 0.5;
    const cut = (el: Element) => {
      for (let at = el.parentElement; at && at !== step; at = at.parentElement)
        if (getComputedStyle(at).overflowX !== "visible" && at.getBoundingClientRect().right <= right) return true;
      return false;
    };
    return [...step.querySelectorAll("*")]
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.width > 1 && box.right > right && !cut(el);
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`);
  });

/** True when the page scrolls sideways. */
const pageScrollsSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

/** The count of the elements of `items` in the first row, by the top of their boxes. */
async function firstRow(items: Locator) {
  const tops = await items.evaluateAll((list) => list.map((el) => Math.round(el.getBoundingClientRect().top)));
  return tops.filter((top) => top === tops[0]).length;
}

/** The box of the dialog `name`, or of the alert dialog with `role`, is inside the window. */
async function expectInWindow(page: Page, name: string | RegExp, role: "dialog" | "alertdialog" = "dialog") {
  await expectBoxInWindow(page, page.getByRole(role, { name }));
}

/** The box of the dialog is inside the window. */
async function expectBoxInWindow(page: Page, dialog: Locator) {
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  const { width, height } = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(box.y + box.height).toBeLessThanOrEqual(height);
}

test("at 390px each step fits in the page, with the rail and the Sheet button between Back and Next", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // fighter-3-wizard-2: a step with content on each step but Feats.
  await openFixture(page, "fighter-3-wizard-2", "Name");
  const nav = page.getByRole("navigation", { name: "Steps" });
  for (const [i, step] of STEPS.entries()) {
    await openStep(page, step);
    expect(await pastTheStep(page), step).toEqual([]);
    expect(await pageScrollsSideways(page), step).toBe(false);
    expect((await nav.boundingBox())!.x + (await nav.boundingBox())!.width, step).toBeLessThanOrEqual(390);
    await expect(summaryCard(page)).toBeHidden();
    const sheet = builder(page).getByRole("button", { name: "Sheet", exact: true });
    const next = builder(page)
      .getByRole("button", { name: /^Next: / })
      .or(builder(page).getByRole("link", { name: "Go to the sheet" }));
    const [s, n] = [(await sheet.boundingBox())!, (await next.boundingBox())!];
    expect(s.x + s.width, step).toBeLessThanOrEqual(n.x);
    expect(n.x + n.width, step).toBeLessThanOrEqual(390);
    if (i > 0) expect((await builder(page).getByRole("button", { name: "Back", exact: true }).boundingBox())!.x, step).toBeLessThan(s.x);
  }
  // The six ability boxes are three in a row.
  await openStep(page, "Abilities");
  expect(await firstRow(section(page, "Base Ability Scores").locator("[data-total]"))).toBe(3);
});

test("at 390px the class cards are three in a row, and the modals and dialogs fit in the window", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newCharacter(page);
  await openStep(page, "Class");
  expect(await firstRow(builder(page).locator("[data-class-card]"))).toBe(3);
  expect(await pastTheStep(page)).toEqual([]);
  await classCard(builder(page), "Fighter").click();
  await expectInWindow(page, "Fighter");
  await page.getByRole("button", { name: "Choose Fighter", exact: true }).click();
  // The class block: the header, the choice rows, the hit points and "Also choose".
  expect(await pastTheStep(page)).toEqual([]);
  await builder(page).getByRole("button", { name: "Add a Fighter level" }).click();
  await builder(page).getByRole("button", { name: "Add a Fighter level" }).click();
  const archetype = section(page, "Martial Archetype");
  if ((await rowHead(archetype).getAttribute("aria-expanded")) === "false") await rowHead(archetype).click();
  await archetype.getByRole("button", { name: /^Choose / }).click();
  await expectInWindow(page, /Martial Archetype/);
  await page.keyboard.press("Escape");
  await builder(page).getByRole("button", { name: "Add a class", exact: true }).click();
  await expectInWindow(page, "Add a class");
  expect(await firstRow(page.getByRole("dialog", { name: "Add a class" }).locator("[data-class-card]"))).toBe(3);
  await page.keyboard.press("Escape");

  // The list of the Background step fills the step, and a name opens its modal.
  await openStep(page, "Background");
  expect(await pastTheStep(page)).toEqual([]);
  await section(page, "Background").getByRole("button", { name: "Acolyte", exact: true }).click();
  await expectInWindow(page, "Acolyte");
  await page.getByRole("button", { name: "Choose Acolyte", exact: true }).click();
  expect(await pastTheStep(page)).toEqual([]);

  // The full sheet panel has the full width.
  await builder(page).getByRole("button", { name: "Sheet", exact: true }).click();
  expect((await page.getByRole("dialog", { name: "Sheet" }).boundingBox())!.width).toBe(390);
});

test("at 390px the picker list, the change question, Customize, the Race modal and Custom Origin fit in the window", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await newCharacter(page);
  await addFirstClass(page, "Cleric");
  await openStep(page, "Proficiencies");
  for (const skill of ["Insight", "Religion"]) await pickIn(section(page, "Skills: Cleric"), skill);

  // The change question: Acolyte gives Insight and Religion, which the Cleric picked.
  await openStep(page, "Background");
  await section(page, "Background").getByRole("button", { name: "Acolyte", exact: true }).click();
  await page.getByRole("button", { name: "Choose Acolyte", exact: true }).click();
  await expectInWindow(page, "Change to Acolyte?", "alertdialog");
  await page.getByRole("alertdialog", { name: "Change to Acolyte?" }).getByRole("button", { name: "Change" }).click();
  await expect(page.getByRole("alertdialog")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Customize of the background.
  await builder(page).getByRole("button", { name: "Customize Acolyte" }).click();
  await expectInWindow(page, "Customize Acolyte");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The Race modal, and the modal and the dialog of Custom Origin.
  await openStep(page, "Race");
  const race = section(page, "Race");
  await race.getByRole("button", { name: "Dwarf", exact: true }).click();
  await expectInWindow(page, "Dwarf");
  await page.getByRole("dialog", { name: "Dwarf" }).getByRole("button", { name: "Cancel" }).click();
  await race.getByRole("button", { name: "Custom Origin", exact: true }).click();
  await expectInWindow(page, "Custom Origin");
  await page.getByRole("button", { name: "Start a custom origin", exact: true }).click();
  const origin = page.getByRole("dialog", { name: "Custom Origin" });
  await expect(origin.getByRole("combobox", { name: "Base race" })).toBeVisible();
  await expectBoxInWindow(page, origin);
  // Cancel of the dialog, and then Cancel of the modal under it.
  await origin.getByRole("button", { name: "Cancel" }).click();
  await expect(origin.getByRole("combobox", { name: "Base race" })).toHaveCount(0);
  await origin.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The list of a picker: "Add a skill" of the Half-Elf on the Proficiencies step.
  await pickIn(race, "Half-Elf");
  await openStep(page, "Proficiencies");
  await section(page, "Skills: Half-Elf").getByRole("button", { name: "Add a skill" }).click();
  await expectBoxInWindow(page, page.getByRole("dialog"));
});

/**
 * On a page from 720px to 860px, the app rail and the summary card left the step 198px to 338px (ORC-345), and the
 * controls of a step need 323px or more (three ability boxes in a row). So under 860px the card does not show, and
 * the Sheet button gives the sheet, as it does under 720px.
 */
test("the summary card shows from 860px: at 720px and 800px the step has the Sheet button and the width of its controls", async ({ page }) => {
  await openFixture(page, "fighter-3-wizard-2", "Abilities");
  for (const [width, card] of [
    [720, false],
    [800, false],
    [859, false],
    [860, true],
    [900, true],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    const sheet = builder(page).getByRole("button", { name: "Sheet", exact: true });
    if (card) {
      await expect(summaryCard(page), `${width}px`).toBeVisible();
      await expect(sheet, `${width}px`).toBeHidden();
    } else {
      await expect(summaryCard(page), `${width}px`).toBeHidden();
      await expect(sheet, `${width}px`).toBeVisible();
    }
    // The step keeps the width of three ability boxes in a row, 323px, and no part of it goes past it.
    const step = (await builder(page).boundingBox())!.width;
    expect(step, `${width}px`).toBeGreaterThanOrEqual(323);
    expect(await firstRow(section(page, "Base Ability Scores").locator("[data-total]")), `${width}px`).toBeGreaterThanOrEqual(3);
    expect(await pastTheStep(page), `${width}px`).toEqual([]);
  }
  // The other steps fit too, at the two widths with the narrowest step: 860px with the card, and 720px without it.
  for (const width of [720, 860]) {
    await page.setViewportSize({ width, height: 900 });
    for (const step of STEPS) {
      await openStep(page, step);
      expect(await pastTheStep(page), `${step}, ${width}px`).toEqual([]);
    }
  }
});
