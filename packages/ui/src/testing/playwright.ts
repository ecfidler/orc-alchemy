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
  // A handle, not the locator: an open Select makes the rest of the page inert, so a role query no longer finds the control.
  const element = await control.elementHandle();
  if (await element!.evaluate((el) => el instanceof HTMLInputElement)) await control.fill(typeof name === "string" ? name : "");
  else await control.click();
  await page.waitForFunction((el) => el.getAttribute("aria-expanded") === "true", element);
  // The list is the element that the control controls.
  const list = page.locator(`[id="${await element!.getAttribute("aria-controls")}"]`);
  await list.getByRole("option", { name, exact: true }).or(list.getByRole("menuitem", { name, exact: true })).click();
  await list.waitFor({ state: "hidden" });
}
