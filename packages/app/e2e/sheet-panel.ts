// The summary card and the full sheet panel of the builder (ORC-341, docs/design/character-builder.md "The summary
// card"): a spec reads a value beside the builder on the card, and the rest of the sheet in the panel.
import { expect, type Page } from "@playwright/test";

/** The summary card of the builder. Read a line by its label: `summaryCard(page).getByLabel("Race", { exact: true })`. */
export const summaryCard = (page: Page) => page.getByRole("region", { name: "Summary" });

/** Opens the full sheet panel with the button below the summary card, and gives the panel. */
export async function openSheetPanel(page: Page) {
  await page.getByRole("button", { name: "Open the full sheet" }).click();
  const panel = page.getByRole("dialog", { name: "Sheet" });
  await expect(panel).toBeVisible();
  return panel;
}

/** Closes the full sheet panel with its Close button, and waits until it is gone. */
export async function closeSheetPanel(page: Page) {
  const panel = page.getByRole("dialog", { name: "Sheet" });
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(panel).toHaveCount(0);
}
