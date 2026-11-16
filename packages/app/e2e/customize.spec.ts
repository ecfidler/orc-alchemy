import { join } from "node:path";
import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Page, test } from "@playwright/test";

// ORC-134: Customize a feat for one character. The feat form opens in a
// dialog over the builder, and its own modals (the "+ Add a modifier" list
// and a picker) open over the dialog, with the keyboard only. ORC-135 does
// the same for a background, with the equipment and tool pickers, and
// ORC-136 for a race, with its note and a feature with uses.

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

test("Customize the SRD background, then add equipment and a tool with the pickers in the dialog with the keyboard", async ({ page }) => {
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

  // "+ Add a tool proficiency" opens its list over the dialog. The second row adds the Artisan's tools block, whose picker opens over the dialog too.
  const addTool = dialog.getByRole("button", { name: /^Add a tool proficiency/ });
  await addTool.focus();
  await page.keyboard.press("Enter");
  const subs = page.getByRole("dialog", { name: "Add a tool proficiency" });
  await expect(subs.getByRole("button", { name: /^Any artisan's tool/ })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(subs.getByRole("button", { name: /^Artisan's tools/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(subs).toBeHidden();
  const block = dialog.getByRole("group", { name: "Artisan's tools" });
  await expect(block).toBeVisible();
  const addArtisan = block.getByRole("button", { name: /^Add an artisan's tool/ });
  await addArtisan.focus();
  await page.keyboard.press("Enter");
  const tools = page.getByRole("dialog", { name: "Add an artisan's tool" });
  await expect(tools.getByRole("button", { name: "Alchemist's Supplies" })).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await expect(tools).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(addArtisan).toBeFocused();
  await expect(block.getByText("Alchemist's Supplies", { exact: true })).toBeVisible();

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
  await expect(again.getByRole("group", { name: "Artisan's tools" }).getByText("Alchemist's Supplies", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(again).toBeHidden();
  await expect(edit).toBeFocused();
});

test("Customize the SRD race: the note and the removed picks show, and a new feature with uses shows on the sheet", async ({ page }) => {
  const builder = await openStep(page, /^Race/);
  await builder.getByRole("button", { name: "Customize Human" }).click();

  const dialog = page.getByRole("dialog", { name: "Customize Human" });
  await expect(dialog.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Human (Custom)");
  await expect(dialog.getByRole("note").first()).toContainText("Tasha's Cauldron of Everything (page 8)");
  await expect(dialog.getByRole("note").nth(1)).toHaveText("Save removes these picks of the character: Subrace (Illuskan).");

  // The proficiencies that the note names are in the "+ Add a modifier" list, which opens over the dialog.
  await dialog.getByRole("button", { name: "Add a modifier" }).click();
  const modifiers = page.getByRole("dialog", { name: "Add a modifier" });
  for (const name of ["Skill Proficiencies", "Weapon Proficiencies", "Tool Proficiency"]) await expect(modifiers.getByRole("button", { name })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(modifiers).toBeHidden();
  await expect(dialog).toBeVisible();

  // A feature of the copy with two uses, back on a long rest.
  await dialog.getByRole("button", { name: "Add a feature" }).click();
  await dialog.getByRole("textbox", { name: "Feature 1 name" }).fill("Second Wind of the Plains");
  await dialog.getByRole("group", { name: "Feature 1 Uses" }).getByRole("button", { name: "Fixed" }).click();
  await pickOption(dialog.getByRole("combobox", { name: "Feature 1 amount", exact: true }), "2");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(builder.getByRole("button", { name: "Edit custom Human (Custom)" })).toBeFocused();
  const sheet = page.getByRole("region", { name: "Preview" });
  await expect(sheet.getByLabel("Race", { exact: true })).toHaveText("Human (Custom)");
  const bubble = sheet.getByRole("group", { name: "Second Wind of the Plains" });
  await expect(bubble.getByRole("button", { name: /^Use / })).toHaveCount(2);
  await expect(bubble.getByText("Long rest")).toBeVisible();
});

// ORC-138: the guided Custom Origin dialog, with the keyboard only.
test("Custom Origin with the keyboard: move a bonus, swap a language and a skill, save, see the sheet, and Edit shows the picks", async ({ page }) => {
  const builder = await openStep(page, /^Race/);
  const entry = builder.getByRole("button", { name: "Custom Origin", exact: true });
  await entry.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Custom Origin" });
  const base = dialog.getByRole("combobox", { name: "Base race" });
  await expect(base).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();
  await page.keyboard.press("Enter");
  await page.getByRole("option", { name: "Half-Orc" }).focus();
  await page.keyboard.press("Enter");
  await expect(base).toHaveText("Half-Orc");

  // +2 Strength goes to Dexterity.
  const plus2 = dialog.getByRole("combobox", { name: "+2 bonus, Half-Orc gives Strength" });
  await plus2.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("option", { name: "Dexterity" }).focus();
  await page.keyboard.press("Enter");
  await expect(plus2).toHaveText("Dexterity");
  await expect(dialog.getByRole("button", { name: "Put back +2 on Strength" })).toBeVisible();

  // Orc becomes Elvish, and Intimidation becomes Stealth. Each list opens over the dialog and closes on a pick; the focus comes back to the token.
  for (const [token, row, now] of [
    ["Change language Orc", "Elvish", "Change language Elvish, in place of Orc"],
    ["Change proficiency Intimidation", "Stealth", "Change proficiency Stealth, in place of Intimidation"],
  ]) {
    await dialog.getByRole("button", { name: token }).focus();
    await page.keyboard.press("Enter");
    const list = page.getByRole("dialog", { name: /^Replace / });
    await expect(list.getByRole("button").nth(1)).toBeVisible();
    await list.getByRole("button", { name: row, exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(list).toBeHidden();
    await expect(dialog.getByRole("button", { name: now })).toBeFocused();
  }
  await expect(dialog.getByRole("note").nth(1)).toHaveText("Save removes these picks of the character: Subrace (Illuskan), Variant (Standard Human).");

  await dialog.getByRole("button", { name: "Save" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  const edit = builder.getByRole("button", { name: "Edit custom origin Half-Orc (Custom Origin)" });
  await expect(edit).toBeFocused();

  const sheet = page.getByRole("region", { name: "Preview" });
  await expect(sheet.getByLabel("Race", { exact: true })).toHaveText("Half-Orc (Custom Origin)");
  await expect(sheet.getByRole("group", { name: "Other proficiencies & languages" })).toContainText("Elvish");
  const skill = (name: string) => sheet.getByRole("group", { name: "Skills" }).getByRole("listitem").filter({ hasText: name });
  await expect(skill("Stealth").getByRole("img", { name: "Proficient" })).toBeVisible();
  await expect(skill("Intimidation").getByRole("img", { name: "Proficient" })).toHaveCount(0);

  // Edit custom origin opens the dialog with the picks.
  await page.keyboard.press("Enter");
  await expect(dialog.getByRole("combobox", { name: "Base race" })).toHaveText("Half-Orc");
  await expect(dialog.getByRole("combobox", { name: "+2 bonus, Half-Orc gives Strength" })).toHaveText("Dexterity");
  await expect(dialog.getByRole("button", { name: "Change language Elvish, in place of Orc" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Change proficiency Stealth, in place of Intimidation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(edit).toBeFocused();
});
