// Test helpers for apps that use this package, for Playwright.
import type { Locator } from "@playwright/test";

/**
 * Picks the option named `name` in a Select, Combobox, Autocomplete or
 * Menu: `control` is its combobox or its menu button. In a text field it
 * types the name first, when it is a string, so the list filters to it; for
 * a RegExp it clears the field. Resolves once the list has closed.
 */
export async function pickOption(control: Locator, name: string | RegExp): Promise<void> {
  const page = control.page();
  if (await control.evaluate((element) => element instanceof HTMLInputElement)) await control.fill(typeof name === "string" ? name : "");
  else await control.click();
  await page.getByRole("option", { name, exact: true }).or(page.getByRole("menuitem", { name, exact: true })).click();
  await page.getByRole("listbox").or(page.getByRole("menu")).waitFor({ state: "hidden" });
}
