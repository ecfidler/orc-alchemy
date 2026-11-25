// The Rest button, the Short rest dialog with Arcane Recovery (ORC-318), and
// the Long rest and Dawn dialogs (ORC-319, docs/design/sheet-interactivity.md
// "Rests").
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { openWithValues, statusLine, storedValues } from "./play-helpers.ts";

/** Cleric 6 / paladin 3 / rogue 1 / wizard 1: 3 d10, 7 d8 and 1 d6, Constitution +1, 91 hit points; Channel Divinity (rest); wizard 1, so Arcane Recovery gives back 1 slot level. */
const MULTICLASS = join(import.meta.dirname, "cleric-6-paladin-3-rogue-1-wizard-1.strict.json");
/** Wizard 3 / warlock 2: 2 d8 and 3 d6, 11 hit points; 4 1st-level and 2 2nd-level slots, and 2 pact slots; Arcane Recovery gives back 2 slot levels. */
const WIZARD_WARLOCK = join(import.meta.dirname, "wizard-3-warlock-2.strict.json");

/** fighter-5: 5 d10; Second Wind and Action Surge (rest). */
const FIGHTER = join(import.meta.dirname, "../../../fixtures/characters/fighter-5.strict.json");

/** wizard-5: 5 d6, 32 hit points; 4 1st-level, 3 2nd-level and 2 3rd-level slots; Arcane Recovery (Dawn). */
const WIZARD = join(import.meta.dirname, "../../../fixtures/characters/wizard-5.strict.json");

/** The play state of a wizard after a hard day: each value that a long rest changes, and inspiration and a condition, which it keeps. */
const TIRED = {
  "~:orcpub.dnd.e5.character/current-hit-points": 9,
  "~:orc-alchemy.play/temp-hit-points": 4,
  "~:orc-alchemy.play/death-saves": { "~:successes": 1, "~:failures": 2 },
  "~:orc-alchemy.play/concentration": "~:bless",
  "~:orc-alchemy.play/exhaustion": 2,
  "~:orc-alchemy.play/inspiration": true,
  "~:orc-alchemy.play/conditions": { "~#set": ["~:prone"] },
  "~:orc-alchemy.play/hit-dice-spent": { "~i6": 4 },
  "~:orc-alchemy.play/uses-spent": { "~:orcpub.dnd.e5.units/day": { "Arcane Recovery": 1 } },
  "~:orcpub.dnd.e5.spells/slots-used": { "~:orcpub.dnd.e5.spells/slots-1": { "~#set": [0, 1] }, "~:orcpub.dnd.e5.spells/slots-2": { "~#set": [0] } },
};

/** The play state of a test: hit points, spent hit dice, spent uses and spent slots, in the keys of the record. */
const PLAY = {
  "~:orcpub.dnd.e5.character/current-hit-points": 50,
  "~:orc-alchemy.play/hit-dice-spent": { "~i8": 1 },
  "~:orc-alchemy.play/uses-spent": { "~:orcpub.dnd.e5.units/rest": { "Channel Divinity": 1 } },
  "~:orcpub.dnd.e5.spells/slots-used": { "~:orcpub.dnd.e5.spells/slots-1": { "~#set": [0, 1] } },
};

const restButton = (page: Page) => page.getByRole("button", { name: "Rest", exact: true });
const dialog = (page: Page, name = "Short rest") => page.getByRole("dialog", { name });
const row = (page: Page, die: string) => dialog(page).getByRole("group", { name: die, exact: true });
const changes = (page: Page) => dialog(page).getByRole("region", { name: "This rest will change" }).getByRole("listitem");

async function openShortRest(page: Page) {
  await restButton(page).click();
  await page.getByRole("menuitem", { name: "Short rest" }).click();
  await expect(dialog(page)).toBeVisible();
}

/** Types a roll in the row of a die and clicks Spend. */
async function spend(page: Page, die: string, roll: string) {
  await row(page, die).getByRole("textbox", { name: "Roll" }).fill(roll);
  await row(page, die).getByRole("button", { name: "Spend", exact: true }).click();
}

/** Takes the focus off the focused element, if one has it, so that a screenshot shows no focus ring. */
const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());

/** Opens a rest dialog from the menu. */
async function openRest(page: Page, name: string) {
  await restButton(page).click();
  await page.getByRole("menuitem", { name }).click();
  await expect(dialog(page, name)).toBeVisible();
}

/** The place and size of the dialog and of each part in it, from the top left of the dialog. A note shows over other parts, so it is not a part. */
const layout = (page: Page, name?: string) =>
  dialog(page, name).evaluate((element) => {
    const origin = element.getBoundingClientRect();
    return [element, ...element.querySelectorAll("section, li, [role=group], .ui-tokens, h3, p:not(.ui-note-line), button, input, output")].map((part) => {
      const { x, y, width, height } = part.getBoundingClientRect();
      return [x - origin.x, y - origin.y, width, height].map((n) => Math.round(n * 10) / 10).join(" ");
    });
  });

for (const [width, height] of [
  [1280, 900],
  [390, 844],
] as const) {
  test(`at ${width}px the dialog keeps its size and its parts keep their places while the user spends dice and picks slots`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openWithValues(page, MULTICLASS, PLAY);
    await openShortRest(page);
    const before = await layout(page);
    const labels = () => changes(page).evaluateAll((items) => items.map((item) => item.firstElementChild?.textContent));
    const rows = await labels();
    await spend(page, "d10", "7");
    await spend(page, "d10", "2");
    await row(page, "d8").getByRole("button", { name: "Roll for me" }).click();
    await spend(page, "d6", "1");
    await dialog(page).getByRole("button", { name: "One more 1st-level slot" }).click();
    await expect(
      dialog(page)
        .getByRole("group", { name: "Spent d10" })
        .getByRole("button", { name: /^Take back/ }),
    ).toHaveCount(2);
    expect(await layout(page)).toEqual(before);
    // The list has the same rows, with other changes.
    expect(await labels()).toEqual(rows);
    await dialog(page).getByRole("button", { name: "Take back the d10, +8" }).click();
    expect(await layout(page)).toEqual(before);
    // The note of a roll that is not valid takes no space.
    await spend(page, "d8", "9");
    await expect(dialog(page).getByText("Type a roll from 1 to 8 for the d8.")).toBeVisible();
    expect(await layout(page)).toEqual(before);
  });
}

test("the list says what the rest will change, with signed counts and an arrow for the hit points; spent dice are tokens with their result", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openWithValues(page, MULTICLASS, PLAY);
  await openShortRest(page);
  await expect(changes(page)).toHaveText([
    "Hit pointsNo change",
    "Hit dice (d10)No change",
    "Hit dice (d8)No change",
    "Hit dice (d6)No change",
    "Channel Divinity+1",
    "1st-level slotsNo change",
    "Arcane RecoveryNo change",
  ]);
  await expect(dialog(page).getByRole("group", { name: "Spent d10" })).toHaveText("No dice spent", { useInnerText: true });
  await spend(page, "d10", "7");
  await spend(page, "d8", "3");
  await expect(dialog(page).getByRole("group", { name: "Spent d10" }).locator(".ui-token:visible")).toHaveText(["+8"]);
  await expect(dialog(page).getByRole("group", { name: "Spent d8" }).locator(".ui-token:visible")).toHaveText(["+4"]);
  await dialog(page).getByRole("button", { name: "One more 1st-level slot" }).click();
  // Wizard 1: one slot level, so no second slot.
  await expect(dialog(page).getByRole("button", { name: "One more 1st-level slot" })).toBeDisabled();
  await expect(changes(page)).toHaveText([
    "Hit points50 → 62 / 91",
    "Hit dice (d10)−1",
    "Hit dice (d8)−1",
    "Hit dice (d6)No change",
    "Channel Divinity+1",
    "1st-level slots+1",
    "Arcane Recovery−1",
  ]);
  // Section titles are large and bold, not small caps.
  const title = dialog(page).getByRole("heading", { name: "Spend hit dice" });
  expect(await title.evaluate((h) => [getComputedStyle(h).fontSize, getComputedStyle(h).fontWeight, getComputedStyle(h).fontVariantCaps])).toEqual([
    "16px",
    "600",
    "normal",
  ]);
});

test("Finish writes all the changes at once and the status toast says so; Cancel changes nothing", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openWithValues(page, MULTICLASS, PLAY);
  const before = await storedValues(page);
  await openShortRest(page);
  await spend(page, "d10", "7");
  await dialog(page).getByRole("button", { name: "One more 1st-level slot" }).click();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(restButton(page)).toBeFocused();
  // Escape is a Cancel too.
  await openShortRest(page);
  await spend(page, "d8", "5");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await page.waitForTimeout(800);
  expect(await storedValues(page)).toEqual(before);
  await expect(page.getByRole("button", { name: "Hit points, 50 of 91" })).toBeVisible();

  await openShortRest(page);
  await spend(page, "d10", "7");
  await spend(page, "d8", "3");
  await dialog(page).getByRole("button", { name: "One more 1st-level slot" }).click();
  await dialog(page).getByRole("button", { name: "Finish" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(statusLine(page)).toHaveText("Short rest finished.");
  await expect(page.getByRole("button", { name: "Hit points, 62 of 91" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Hit dice, / })).toHaveAccessibleName("Hit dice, 2 of 3 d10, 5 of 7 d8, 1 of 1 d6");
  // The whole stored record of the play state, after the save.
  await expect
    .poll(() => storedValues(page))
    .toEqual({
      ...before,
      "~:orcpub.dnd.e5.character/current-hit-points": 62,
      "~:orc-alchemy.play/hit-dice-spent": { "~i10": 1, "~i8": 2 },
      "~:orc-alchemy.play/uses-spent": { "~:orcpub.dnd.e5.units/day": { "Arcane Recovery": 1 } },
      "~:orcpub.dnd.e5.spells/slots-used": { "~:orcpub.dnd.e5.spells/slots-1": { "~#set": [0] } },
    });
  // Arcane Recovery is spent: the next Short rest has no section for it.
  await openShortRest(page);
  await expect(dialog(page).getByRole("region", { name: "Arcane Recovery" })).toHaveCount(0);
});

test("the pact slots come back; with full hit points the dice controls stay in place, disabled; a rest that changes nothing says so", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openWithValues(page, WIZARD_WARLOCK, { "~:orcpub.dnd.e5.spells/slots-used": { "~:orcpub.dnd.e5.spells/slots-1": { "~#set": [4, 5] } } });
  await openShortRest(page);
  await expect(row(page, "d8").getByRole("button", { name: "Spend", exact: true })).toBeDisabled();
  await expect(row(page, "d8").getByRole("textbox", { name: "Roll" })).toBeDisabled();
  await expect(changes(page)).toHaveText(["Pact Magic slots+2", "Arcane RecoveryNo change"]);
  await expect(dialog(page).getByRole("region", { name: "Arcane Recovery" })).toContainText("No slot that it can give back is spent.");
  await dialog(page).getByRole("button", { name: "Finish" }).click();
  await expect(statusLine(page)).toHaveText("Short rest finished.");
  await expect.poll(async () => (await storedValues(page))["~:orcpub.dnd.e5.spells/slots-used"]).toBeUndefined();
  await openShortRest(page);
  await expect(changes(page)).toHaveText(["Arcane RecoveryNo change"]);
  // A fighter with no die left and no spent use: the list says that nothing will change, and Finish works.
  await openWithValues(page, FIGHTER, { "~:orc-alchemy.play/hit-dice-spent": { "~i10": 5 } });
  await openShortRest(page);
  await expect(dialog(page).getByRole("region", { name: "This rest will change" })).toHaveText("This rest will changeNothing will change.");
  await expect(row(page, "d10").getByRole("button", { name: "Roll for me" })).toBeDisabled();
  await dialog(page).getByRole("button", { name: "Finish" }).click();
  await expect(statusLine(page)).toHaveText("Short rest finished.");
});

test("keyboard: the menu opens the dialog with the focus on the first field; the dialog holds the focus; the focus goes back to Rest at the close", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openWithValues(page, MULTICLASS, PLAY);
  await restButton(page).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Short rest" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(row(page, "d10").getByRole("textbox", { name: "Roll" })).toBeFocused();
  // Shift+Tab from the first control stays in the dialog.
  await page.keyboard.press("Shift+Tab");
  await expect(dialog(page).locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  await expect(restButton(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menuitem", { name: "Short rest" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(row(page, "d10").getByRole("textbox", { name: "Roll" })).toBeFocused();
  await page.keyboard.type("4");
  await page.keyboard.press("Enter");
  // The X of the token takes the die back; the focus goes back to the Roll field.
  const x = dialog(page).getByRole("button", { name: "Take back the d10, +5" });
  await x.focus();
  await expect(x).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(row(page, "d10").getByRole("textbox", { name: "Roll" })).toBeFocused();
  await dialog(page).getByRole("button", { name: "Finish" }).focus();
  await expect(dialog(page).getByRole("button", { name: "Finish" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toHaveCount(0);
  await expect(restButton(page)).toBeFocused();
});

test("keyboard: Long rest and Dawn open with the focus on their first control, and give the focus back to Rest at the close", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openWithValues(page, WIZARD, TIRED);
  for (const [name, first] of [
    ["Long rest", dialog(page, "Long rest").getByRole("checkbox", { name: "Ate and drank" })],
    ["Dawn", dialog(page, "Dawn").getByRole("textbox", { name: "Arcane Recovery" })],
  ] as const) {
    await restButton(page).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog(page, name)).toBeVisible();
    await expect(first, name).toBeFocused();
    // The first control in the order of the dialog: no control comes before it.
    const index = await dialog(page, name).evaluate((element) =>
      [...element.querySelectorAll<HTMLElement>("button, input, [tabindex]")]
        .filter((control) => control.tabIndex >= 0 && !control.matches(":disabled") && control.offsetParent !== null)
        .indexOf(document.activeElement as HTMLElement),
    );
    expect(index, name).toBe(0);
    await page.keyboard.press("Escape");
    await expect(dialog(page, name)).toHaveCount(0);
    await expect(restButton(page)).toBeFocused();
  }
});

for (const name of ["Short rest", "Long rest", "Dawn"]) {
  test(`at 390px the ${name} dialog fills the screen`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openWithValues(page, WIZARD, TIRED);
    await openRest(page, name);
    const box = (await dialog(page, name).boundingBox())!;
    expect([box.x, box.y, box.width, box.height].map(Math.round)).toEqual([0, 0, 390, 844]);
  });
}

test("at 390px the action row stays on one line, and the buttons show their labels without the icons", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWithValues(page, MULTICLASS, PLAY);
  const row = page.getByRole("link", { name: "Back to List" }).locator("..");
  // The middle of each part, so the save status, which is text, counts as on the line of the buttons.
  const middles = await row.evaluate((element) =>
    [...element.querySelectorAll("a, button, [role=status]")].map((part) => {
      const { top, height } = part.getBoundingClientRect();
      return Math.round(top + height / 2);
    }),
  );
  const button = await restButton(page).boundingBox();
  const edit = await page.getByRole("link", { name: "Edit", exact: true }).boundingBox();
  expect(middles).toHaveLength(5);
  expect(new Set(middles).size, `middles ${middles}`).toBe(1);
  expect(button && edit && button.y === edit.y && button.x < edit.x).toBe(true);
  await expect(restButton(page).locator("svg")).toBeHidden();
  await expect(page.getByRole("link", { name: "Edit", exact: true }).locator("svg")).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(restButton(page).locator("svg")).toBeVisible();
});

test("the builder has no Rest button", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openWithValues(page, MULTICLASS);
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("link", { name: "Done" })).toBeVisible();
  await expect(restButton(page)).toHaveCount(0);
});

test("the menu has Dawn only when the character has a feature with Dawn uses", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openWithValues(page, FIGHTER);
  await restButton(page).click();
  await expect(page.getByRole("menuitem")).toHaveText(["Short rest", "Long rest"]);
  await page.keyboard.press("Escape");
  await openWithValues(page, WIZARD);
  await restButton(page).click();
  await expect(page.getByRole("menuitem")).toHaveText(["Short rest", "Long rest", "Dawn"]);
});

const longChanges = (page: Page) => dialog(page, "Long rest").getByRole("region", { name: "This rest will change" }).getByRole("listitem");

test("Long rest lists its changes, writes them at once, and keeps inspiration and the conditions after a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openWithValues(page, WIZARD, TIRED);
  const before = await storedValues(page);
  await openRest(page, "Long rest");
  await expect(longChanges(page)).toHaveText([
    "Hit points9 → 32 / 32",
    "Temporary hit points4 → 0",
    "1st-level slots+2",
    "2nd-level slots+1",
    "Hit dice (d6)+2",
    "Death savescleared",
    "Concentrationcleared",
    "Exhaustion2 → 1",
  ]);
  await expect(dialog(page, "Long rest").getByRole("checkbox", { name: "Ate and drank" })).toBeChecked();
  await expect(dialog(page, "Long rest").getByRole("checkbox", { name: "Dawn came during the rest" })).toBeChecked();
  await expect(dialog(page, "Long rest").getByRole("textbox", { name: "Arcane Recovery" })).toHaveValue("1");
  await dialog(page, "Long rest").getByRole("button", { name: "Finish" }).click();
  await expect(dialog(page, "Long rest")).toHaveCount(0);
  await expect(statusLine(page)).toHaveText("Long rest finished.");
  await expect(restButton(page)).toBeFocused();
  const expected: Record<string, unknown> = { ...before, "~:orc-alchemy.play/exhaustion": 1, "~:orc-alchemy.play/hit-dice-spent": { "~i6": 2 } };
  for (const key of [
    "~:orcpub.dnd.e5.character/current-hit-points",
    "~:orc-alchemy.play/temp-hit-points",
    "~:orc-alchemy.play/death-saves",
    "~:orc-alchemy.play/concentration",
    "~:orc-alchemy.play/uses-spent",
    "~:orcpub.dnd.e5.spells/slots-used",
  ])
    delete expected[key];
  // The whole stored record of the play state, after the save and after a reload.
  await expect.poll(() => storedValues(page)).toEqual(expected);
  await page.reload();
  await expect(page.getByRole("button", { name: "Hit points, 32 of 32" })).toBeVisible();
  expect(await storedValues(page)).toEqual(expected);
});

test("Long rest with both checkboxes off keeps the exhaustion level and the Dawn uses; the Dawn list stays in its place, disabled", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openWithValues(page, WIZARD, TIRED);
  const before = await storedValues(page);
  await openRest(page, "Long rest");
  await dialog(page, "Long rest").getByRole("checkbox", { name: "Ate and drank" }).click();
  await expect(longChanges(page).last()).toHaveText("ExhaustionNo change");
  await dialog(page, "Long rest").getByRole("checkbox", { name: "Dawn came during the rest" }).click();
  await expect(dialog(page, "Long rest").getByRole("textbox", { name: "Arcane Recovery" })).toBeDisabled();
  await dialog(page, "Long rest").getByRole("button", { name: "Finish" }).click();
  await expect(statusLine(page)).toHaveText("Long rest finished.");
  await expect
    .poll(() => storedValues(page))
    .toEqual({
      ...Object.fromEntries(
        Object.entries(before).filter(
          ([key]) =>
            ![
              "~:orcpub.dnd.e5.character/current-hit-points",
              "~:orc-alchemy.play/temp-hit-points",
              "~:orc-alchemy.play/death-saves",
              "~:orc-alchemy.play/concentration",
              "~:orcpub.dnd.e5.spells/slots-used",
            ].includes(key),
        ),
      ),
      "~:orc-alchemy.play/hit-dice-spent": { "~i6": 2 },
    });
});

for (const [width, height] of [
  [1280, 900],
  [390, 844],
] as const) {
  test(`at ${width}px the Long rest dialog keeps its size and its parts keep their places when the checkboxes go off and on`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await openWithValues(page, WIZARD, TIRED);
    await openRest(page, "Long rest");
    const before = await layout(page, "Long rest");
    const dawn = dialog(page, "Long rest").getByRole("checkbox", { name: "Dawn came during the rest" });
    await dawn.click();
    await expect(dawn).not.toBeChecked();
    expect(await layout(page, "Long rest")).toEqual(before);
    await dialog(page, "Long rest").getByRole("checkbox", { name: "Ate and drank" }).click();
    // Both off: the rest still changes the hit points, so the list has no line "Nothing will change.".
    expect(await layout(page, "Long rest")).toEqual(before);
    await dawn.click();
    await expect(dawn).toBeChecked();
    expect(await layout(page, "Long rest")).toEqual(before);
    if (width === 1280) {
      // The rest dialogs are narrow: about 520px wide.
      expect((await dialog(page, "Long rest").boundingBox())?.width).toBeLessThanOrEqual(520);
    }
  });
}

test("Dawn gives back the number in each field, and a field at 0 says that nothing will change; the record keeps it after a reload", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openWithValues(page, WIZARD, TIRED);
  const before = await storedValues(page);
  await openRest(page, "Dawn");
  const field = dialog(page, "Dawn").getByRole("textbox", { name: "Arcane Recovery" });
  await expect(field).toHaveValue("1");
  await expect(dialog(page, "Dawn").getByText("Nothing will change.")).toHaveCount(0);
  const size = await layout(page, "Dawn");
  await field.fill("0");
  await expect(dialog(page, "Dawn").getByText("Nothing will change.")).toBeVisible();
  expect(await layout(page, "Dawn")).toEqual(size);
  // Finish with nothing to change works, and changes nothing.
  await dialog(page, "Dawn").getByRole("button", { name: "Finish" }).click();
  await expect(statusLine(page)).toHaveText("Dawn finished.");
  await page.waitForTimeout(800);
  expect(await storedValues(page)).toEqual(before);
  await openRest(page, "Dawn");
  await dialog(page, "Dawn").getByRole("button", { name: "Finish" }).click();
  const { "~:orc-alchemy.play/uses-spent": _, ...rest } = before;
  await expect.poll(() => storedValues(page)).toEqual(rest);
  await page.reload();
  await expect(restButton(page)).toBeVisible();
  expect(await storedValues(page)).toEqual(rest);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- rest.spec.ts -g orc-318
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-318 Rest, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-318-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      for (const [size, width, height] of [
        ["desktop", 1280, 900],
        ["phone", 390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        await openWithValues(page, MULTICLASS, PLAY);
        // The action row with the menu open.
        await restButton(page).click();
        const menu = page.getByRole("menu");
        await expect(menu).toBeVisible();
        const row = await page.getByRole("link", { name: "Back to List" }).locator("..").boundingBox();
        const list = await menu.boundingBox();
        if (row && list) {
          const bottom = Math.max(row.y + row.height, list.y + list.height) + 8;
          await page.screenshot({ path: shot(`${size}-menu`), clip: { x: 0, y: Math.max(0, row.y - 8), width, height: bottom - Math.max(0, row.y - 8) } });
        }
        await page.getByRole("menuitem", { name: "Short rest" }).click();
        await expect(dialog(page)).toBeVisible();
        await blur(page);
        await page.screenshot({ path: shot(`${size}-dialog-empty`) });
        await spend(page, "d10", "7");
        await spend(page, "d8", "3");
        await spend(page, "d8", "6");
        await dialog(page).getByRole("button", { name: "One more 1st-level slot" }).click();
        await blur(page);
        await page.screenshot({ path: shot(`${size}-dialog-picked`) });
        if (size === "phone") {
          await dialog(page)
            .locator(".ui-modal-body")
            .evaluate((body) => body.scrollTo(0, body.scrollHeight));
          await page.screenshot({ path: shot(`${size}-dialog-picked-end`) });
        }
        await page.keyboard.press("Escape");
      }
    });
  }
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bunx playwright test e2e/rest.spec.ts -g orc-319
test.describe("screenshots of ORC-319", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-319 Long rest and Dawn, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-319-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      for (const [size, width, height] of [
        ["desktop", 1280, 900],
        ["phone", 390, 844],
      ] as const) {
        await page.setViewportSize({ width, height });
        await openWithValues(page, WIZARD, TIRED);
        // The action row with the menu of three entries.
        await restButton(page).click();
        const menu = page.getByRole("menu");
        await expect(menu).toBeVisible();
        const row = await page.getByRole("link", { name: "Back to List" }).locator("..").boundingBox();
        const list = await menu.boundingBox();
        if (row && list) {
          const top = Math.max(0, row.y - 8);
          await page.screenshot({
            path: shot(`${size}-menu`),
            clip: { x: 0, y: top, width, height: Math.max(row.y + row.height, list.y + list.height) + 8 - top },
          });
        }
        await page.getByRole("menuitem", { name: "Long rest" }).click();
        await expect(dialog(page, "Long rest")).toBeVisible();
        await blur(page);
        await page.screenshot({ path: shot(`${size}-long-rest`) });
        if (size === "phone") {
          await dialog(page, "Long rest")
            .locator(".ui-modal-body")
            .evaluate((body) => body.scrollTo(0, body.scrollHeight));
          await page.screenshot({ path: shot(`${size}-long-rest-end`) });
        }
        await dialog(page, "Long rest").getByRole("checkbox", { name: "Dawn came during the rest" }).click();
        await blur(page);
        await page.screenshot({ path: shot(`${size}-long-rest-dawn-off`) });
        await page.keyboard.press("Escape");
        await openRest(page, "Dawn");
        await blur(page);
        await page.screenshot({ path: shot(`${size}-dawn`) });
        await page.keyboard.press("Escape");
        // A rested fighter: the Long rest changes nothing.
        await openWithValues(page, FIGHTER, { "~:orcpub.dnd.e5.character/current-hit-points": null });
        await openRest(page, "Long rest");
        await blur(page);
        await page.screenshot({ path: shot(`${size}-nothing`) });
        await page.keyboard.press("Escape");
      }
    });
  }
});
