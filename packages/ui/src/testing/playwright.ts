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

/**
 * Picks the rows named `names` in the ListModal that `button` opens: the
 * add button of a Picker, or a button that opens a list that closes on a
 * click (then give one name). In a list with a search field, it types
 * each string name first, so the list filters to it; for a RegExp it
 * clears the field. Then it clicks Done, if the modal has it, and resolves
 * once the modal has closed.
 */
export async function pickFromPicker(button: Locator, names: string | RegExp | readonly (string | RegExp)[]): Promise<void> {
  const list = typeof names === "string" || names instanceof RegExp ? [names] : names;
  await button.click();
  // The page, not the button: an open modal makes the rest of the page inert.
  const dialog = button.page().getByRole("dialog");
  await dialog.waitFor();
  const done = dialog.getByRole("button", { name: "Done", exact: true });
  const stays = (await done.count()) > 0;
  if (!stays && list.length !== 1) throw new Error("This list closes on a click, so give one name.");
  for (const name of list) {
    const search = dialog.getByRole("searchbox");
    if ((await search.count()) > 0) await search.fill(typeof name === "string" ? name : "");
    await dialog.locator(".ui-list-body").getByRole("button", { name, exact: true }).click();
  }
  if (stays) await done.click();
  await dialog.waitFor({ state: "hidden" });
}

/** Clicks the X of the token named `name` in `scope` (its button "Remove {name}"), and waits for the token to go. */
export async function removeToken(scope: Locator, name: string): Promise<void> {
  const x = scope.getByRole("button", { name: `Remove ${name}`, exact: true });
  await x.click();
  await x.waitFor({ state: "hidden" });
}
