import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";

// The helpers that the e2e specs of the play state on the sheet share: import a character with play values, and
// read the values of the stored record.

const VALUES = "~:orcpub.entity.strict/values";

/** Imports a character file with more values in its record, and opens its sheet. */
export async function openWithValues(page: Page, file: string, values: Record<string, unknown> = {}) {
  const entity = JSON.parse(readFileSync(file, "utf8"));
  entity[VALUES] = { ...entity[VALUES], ...values };
  await page.goto("/import");
  await page
    .getByLabel("Import character file")
    .setInputFiles({ name: basename(file), mimeType: "application/json", buffer: Buffer.from(JSON.stringify(entity)) });
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await page.evaluate(() => document.fonts.ready);
}

/** The values of the one stored character, read from IndexedDB. */
export const storedValues = (page: Page) =>
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

/** The vitals panel of the sheet: the shaded panel with the Hit points box. */
export const vitals = (page: Page) => page.locator(".ui-panel").filter({ has: page.getByRole("button", { name: /^Hit points, / }) });

/** The status line of the vitals panel. The concentration note under it is a status too, so this takes the line by its element. */
export const statusLine = (page: Page) => vitals(page).getByRole("status").and(page.locator("p"));

/** The space of the concentration note under the status line (ORC-322). */
export const concentrationNote = (page: Page) => vitals(page).getByRole("status", { name: "Concentration note" });

/**
 * The place and size of the vitals panel and of each part in it, but for the parts in the box and in the note, which can
 * move (ORC-322). The captions under the speed and the hit points, and the circles are parts too (ORC-323).
 */
export const layout = (page: Page) =>
  vitals(page).evaluate((panel) =>
    [
      panel,
      ...panel.querySelectorAll(
        "[data-conditions-box], .ui-framed-box, [role=group], [role=status], [role=slider], button, .ui-label, [data-speed-caption], [data-hp-caption]",
      ),
    ]
      .filter(
        (element) => element === panel || element.matches("[data-conditions-box]") || !element.closest("[data-conditions-box], [data-concentration-note] *"),
      )
      .map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return `${element.matches("[data-conditions-box]") ? "BOX" : element.tagName} ${[x, y, width, height].map((n) => Math.round(n * 10) / 10).join(" ")}`;
      }),
  );

/**
 * The size of the element of `locator`, and the place and size of each element in it, from its top left corner (a click
 * can scroll the page), to the tenth of a pixel. `skip` is a selector of the elements to leave out, for example a mark
 * that comes and goes.
 */
export const layoutOf = (locator: Locator, skip?: string) =>
  locator.evaluate((root, skip) => {
    const origin = root.getBoundingClientRect();
    return [root, ...root.querySelectorAll("*")]
      .filter((element) => !skip || !element.matches(skip))
      .map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return `${element.tagName} ${[x - origin.x, y - origin.y, width, height].map((n) => Math.round(n * 10) / 10).join(" ")}`;
      });
  }, skip);

/** The parts of a layout that are above the box, and the left edge, top and width of the box: they never move. */
export const aboveBox = (lines: string[]) => {
  const at = lines.findIndex((line) => line.startsWith("BOX"));
  return [...lines.slice(1, at), lines[at]?.split(" ").slice(0, 4).join(" ")];
};
