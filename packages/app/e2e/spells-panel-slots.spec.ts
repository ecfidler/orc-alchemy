import { expect, type Page, test } from "@playwright/test";
import { importFile, listPane, panel, row, rows, spellPane, viewHeading } from "./spells-panel-helpers.ts";

// The Spells panel: spell slots and a failed save (docs/design/spells-panel.md). The other topics of the panel are in
// spells-panel.spec.ts and spells-panel-prepare.spec.ts.
// e2e/life-cleric-9.strict.json is a Life cleric 9 by the builder's calls (src/engine/spell-list.test.ts).

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

// A failed save in the panel (ORC-290, docs/design/spells-panel.md "A failed save").

/** While `on`, each read of the characters store fails, as a broken IndexedDB does. Autosave reads the record first. */
async function failSaves(page: Page, on: boolean) {
  await page.evaluate((on) => {
    const flags = window as unknown as { failSaves?: boolean };
    if (flags.failSaves === undefined) {
      const get = IDBObjectStore.prototype.get;
      IDBObjectStore.prototype.get = function (this: IDBObjectStore, query: IDBValidKey | IDBKeyRange) {
        if (flags.failSaves && this.name === "characters") throw new DOMException("Read failed", "UnknownError");
        return get.call(this, query);
      };
    }
    flags.failSaves = on;
  }, on);
}

const FAILED = "Saving to this browser failed. Recent changes may not be kept.";
/** The note of a failed save in the panel, and the one on the sheet behind it (outside the dialog). */
const panelNote = (page: Page) => panel(page).getByRole("alert");
const sheetNote = (page: Page) => page.locator(".ui-alert-notes").getByRole("alert", { includeHidden: true });

test("a slot change that fails to save shows the note with Try again under the header, and on the sheet; Try again saves and removes the two", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(rows(page).first()).toBeFocused();
  await failSaves(page, true);
  const first = blockSlider(page, "1st-level slots");
  await first.locator(".ui-slot-circle").first().click();
  await expect(panelNote(page)).toHaveText(`Failed${FAILED} Try again`);
  // Under the header, above the prepare bar.
  const head = await panel(page).locator(".ui-modal-own-head").boundingBox();
  const note = await panelNote(page).boundingBox();
  const bar = await panel(page).getByRole("button", { name: "Prepare spells" }).boundingBox();
  expect(note!.y).toBeGreaterThanOrEqual(head!.y + head!.height);
  expect(note!.y + note!.height).toBeLessThanOrEqual(bar!.y);
  // The change stays on the screen and in the draft.
  await expect(first).toHaveAttribute("aria-valuetext", "1 of 4 spent");
  await expect(first.locator("[data-marked]")).toHaveCount(1);
  await expect(first).toBeFocused();
  // The sheet behind the panel: the same note, Unsaved changes and Save.
  await expect(sheetNote(page)).toHaveText(`Failed${FAILED}`);
  await expect(page.getByRole("status", { name: "Save status", includeHidden: true })).toHaveText("Unsaved changes");
  await expect(page.getByRole("button", { name: "Save", exact: true, includeHidden: true })).toHaveCount(1);

  // A Try again that fails keeps the note; one that works removes it, and the focus goes back to the slots.
  const tryAgain = panelNote(page).getByRole("button", { name: "Try again" });
  await tryAgain.click();
  await expect(panelNote(page)).toBeVisible();
  await failSaves(page, false);
  await tryAgain.click();
  await expect(panelNote(page)).toHaveCount(0);
  await expect(sheetNote(page)).toHaveCount(0);
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-valuetext", "1 of 4 spent");
  await expect(page.getByRole("status", { name: "Save status", includeHidden: true })).toHaveText("Saved");
  await page.keyboard.press("Escape");
  await expect(panel(page)).toBeHidden();
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(sheetSlider(page, "1st-level slots")).toHaveAttribute("aria-valuetext", "1 of 4 spent");
});

/** The stored character records, as JSON text. */
const storedRecords = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open("alchemy-5e");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction("characters").objectStore("characters").getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            open.result.close();
            resolve(JSON.stringify(all.result));
          };
        };
      }),
  );

test("a slot change that saves shows no note in the panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(rows(page).first()).toBeFocused();
  expect(await storedRecords(page)).not.toContain("slots-1");
  await blockSlider(page, "1st-level slots").locator(".ui-slot-circle").first().click();
  await expect.poll(() => storedRecords(page)).toContain("slots-1");
  await expect(panel(page).getByRole("alert")).toHaveCount(0);
  await expect(page.getByRole("alert", { includeHidden: true })).toHaveCount(0);
  await expect(page.getByRole("status", { name: "Save status", includeHidden: true })).toHaveText("Saved");
});

test("on a phone at 320px the note with Try again fits: no sideways scroll", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await importFile(page, "life-cleric-9.strict.json");
  await page.getByRole("tab", { name: "Spells" }).click();
  await page.getByRole("button", { name: "All spells" }).click();
  await expect(rows(page).first()).toBeFocused();
  await failSaves(page, true);
  await blockSlider(page, "1st-level slots").locator(".ui-slot-circle").first().click();
  await expect(panelNote(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  const bounds = await panelNote(page).boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  await failSaves(page, false);
  await panelNote(page).getByRole("button", { name: "Try again" }).click();
  await expect(panelNote(page)).toHaveCount(0);
  await expect(blockSlider(page, "1st-level slots")).toBeFocused();
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
