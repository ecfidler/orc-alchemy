import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";

// ORC-134: Customize a feat for one character. The feat form opens in a
// dialog over the builder, and its own modals (the "+ Add a modifier" list
// and a picker) open over the dialog, with the keyboard only. ORC-135 does
// the same for a background, with the equipment picker.

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

/** Opens fighter-20, who takes the SRD feat Grappler and the SRD background Acolyte, on the builder's step. */
async function openStep(page: Page, step: RegExp) {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-20.strict.json"));
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  await page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: step }).click();
  return page.getByRole("region", { name: "Builder" });
}
const openFeats = (page: Page) => openStep(page, /^Feats/);

/** True when the focused element is inside the element. */
const holdsFocus = (page: Page, name: string) =>
  page.getByRole("dialog", { name }).evaluate((dialog) => dialog.contains(document.activeElement) && document.activeElement !== dialog);

test("Customize a feat, then add a modifier and a prerequisite in the dialog with the keyboard", async ({ page }) => {
  const builder = await openFeats(page);
  const customize = builder.getByRole("button", { name: "Customize Grappler" });
  await customize.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Customize Grappler" });
  const name = dialog.getByRole("textbox", { name: "Name" });
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("Grappler (Custom)");
  await expect(dialog.getByRole("textbox", { name: "Description" })).toHaveValue("Restrain a creature you are grappling");

  // "+ Add a modifier" opens its list over the dialog. Enter adds the first modifier, and its first control gets the focus, in the dialog.
  const add = dialog.getByRole("button", { name: "Add a modifier" });
  await add.focus();
  await page.keyboard.press("Enter");
  const modifiers = page.getByRole("dialog", { name: "Add a modifier" });
  await expect(modifiers.getByRole("button", { name: "Skill or Tool Proficiency" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(modifiers).toBeHidden();
  const section = dialog.getByRole("group", { name: "Skill or Tool Proficiency", exact: true });
  await expect(section).toBeVisible();
  await expect(section.getByRole("button", { name: "None" })).toBeFocused();

  // A picker's list opens over the dialog too. Enter picks the first row, and Escape closes only the list.
  const prerequisite = dialog.getByRole("button", { name: "Add a prerequisite" });
  await prerequisite.focus();
  await page.keyboard.press("Enter");
  const list = page.getByRole("dialog", { name: "Add a prerequisite" });
  const first = list.getByRole("button", { name: "The ability to cast at least one spell" });
  await expect(first).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("The ability to cast at least one spell", { exact: true })).toBeVisible();
  // The focus comes back into the Customize dialog.
  await expect.poll(() => holdsFocus(page, "Customize Grappler")).toBe(true);

  // Escape with changes asks first. Stay has the focus; Escape answers Stay, and the focus comes back into the dialog.
  await page.keyboard.press("Escape");
  const ask = page.getByRole("alertdialog", { name: "This feat has changes that are not saved. Close anyway?" });
  await expect(ask.getByRole("button", { name: "Stay" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(ask).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect.poll(() => holdsFocus(page, "Customize Grappler")).toBe(true);

  // Save writes the copy and selects it. The focus goes to the line's new button.
  await dialog.getByRole("button", { name: "Save" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  const edit = builder.getByRole("button", { name: "Edit custom Grappler (Custom)" });
  await expect(edit).toBeFocused();
  const cards = builder.getByRole("group", { name: "Feats" });
  await expect(cards.getByRole("button", { name: "Grappler (Custom)", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(cards.getByRole("button", { name: "Grappler", exact: true })).toHaveAttribute("aria-pressed", "false");

  // Edit custom opens the copy, with its prerequisite. The modifier added with no value does not show.
  await page.keyboard.press("Enter");
  const again = page.getByRole("dialog", { name: "Edit custom feat" });
  await expect(again.getByRole("textbox", { name: "Name" })).toHaveValue("Grappler (Custom)");
  await expect(again.getByText("The ability to cast at least one spell", { exact: true })).toBeVisible();
  await expect(again.getByRole("group", { name: "Skill or Tool Proficiency", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(again).toBeHidden();
  await expect(edit).toBeFocused();
});

test("Customize the SRD background, then add equipment with the picker in the dialog with the keyboard", async ({ page }) => {
  const builder = await openStep(page, /^Background/);
  const customize = builder.getByRole("button", { name: "Customize Acolyte" });
  await customize.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Customize Acolyte" });
  const name = dialog.getByRole("textbox", { name: "Name", exact: true });
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("Acolyte (Custom)");
  await expect(dialog.getByRole("textbox", { name: "Description", exact: true })).toHaveValue("Your life has been devoted to serving a god or gods.");
  await expect(dialog.getByRole("button", { name: "Add a modifier" })).toHaveCount(0);

  // The equipment picker opens over the dialog with the focus in its search. A search and Enter on the first row pick it; Escape closes only the list.
  const add = dialog.getByRole("button", { name: /^Add equipment/ });
  await add.focus();
  await page.keyboard.press("Enter");
  const list = page.getByRole("dialog", { name: "Add equipment" });
  const search = list.getByRole("searchbox", { name: "Search" });
  await expect(search).toBeFocused();
  await page.keyboard.type("crowbar");
  await page.keyboard.press("ArrowDown");
  await expect(list.getByRole("button", { name: "Crowbar" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(add).toBeFocused();
  await expect(dialog.getByText("Crowbar", { exact: true })).toBeVisible();

  // A rename back to the original's name is refused.
  await name.fill("Acolyte");
  await expect(dialog.getByRole("list", { name: "Problems: Name" })).toContainText("Another background in the list has this name");
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await name.fill("Acolyte (Custom)");

  // Save selects the copy, and the focus goes to the line's new button.
  await dialog.getByRole("button", { name: "Save" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  const edit = builder.getByRole("button", { name: "Edit custom Acolyte (Custom)" });
  await expect(edit).toBeFocused();
  const cards = builder.getByRole("group", { name: "Background", exact: true });
  await expect(cards.getByRole("button", { name: "Acolyte (Custom)", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(cards.getByRole("button", { name: "Acolyte", exact: true })).toHaveAttribute("aria-pressed", "false");

  await page.keyboard.press("Enter");
  const again = page.getByRole("dialog", { name: "Edit custom background" });
  await expect(again.getByText("Crowbar", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(again).toBeHidden();
  await expect(edit).toBeFocused();
});
