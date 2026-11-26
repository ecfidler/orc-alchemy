// The helpers of the Spells panel specs (ORC-285, docs/design/spells-panel.md "The panel"): spells-panel.spec.ts,
// spells-panel-slots.spec.ts and spells-panel-prepare.spec.ts.
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

/** Imports a character file of this folder and waits for its sheet. */
export async function importFile(page: Page, file: string) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(import.meta.dirname, file));
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
}

export const panel = (page: Page) => page.getByRole("dialog", { name: "Spells" });
/** The row buttons of the list, in order. */
export const rows = (page: Page) => panel(page).locator("[data-spell-row]");
/** The row of a spell, by its name, which starts the row's accessible name. With two or more sources the source follows it. */
export const row = (page: Page, name: string) =>
  panel(page).getByRole("button", { name: new RegExp(`^${name}(, [A-Z][a-z]+( [A-Z][a-z]+)?)? ?(Ritual|Concentration)*$`) });
/** The pane of the list, and the pane of the spell view. */
export const listPane = (page: Page) => panel(page).locator("[data-pane=list]");
export const spellPane = (page: Page) => panel(page).locator("[data-pane=spell]");
/** The heading of the spell view. */
export const viewHeading = (page: Page) => spellPane(page).getByRole("region").getByRole("heading", { level: 3 });
