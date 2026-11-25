import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { expect, type Page } from "@playwright/test";

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
