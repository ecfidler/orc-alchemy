import { expect, test } from "@playwright/test";

// ORC-197: the "+ Add a modifier" list of the feat form, with the keyboard only (docs/design/homebrew-forms.md, "Modifiers").
test("Add, Remove and Undo a feat modifier with the keyboard", async ({ page }) => {
  await page.goto("/content/new/feat");
  const add = page.getByRole("button", { name: "Add a modifier" });
  await expect(add).toHaveAccessibleDescription("14 more");
  await expect(page.getByRole("group", { name: "Hit Points" })).toHaveCount(0);

  // Enter opens the list, with the focus on its first row. The arrow keys move to Hit Points, and Enter adds it.
  await add.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Add a modifier" });
  await expect(dialog.getByRole("button", { name: "Skill or Tool Proficiency" })).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Hit Points" })).toHaveAccessibleDescription("+1 or +2 hit point maximum for each level");
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("button", { name: "Hit Points" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();

  // The section is in its place in form order, after the common modifiers, it flashes, and its first control has the focus.
  const hp = page.getByRole("group", { name: "Hit Points" });
  await expect(hp).toBeVisible();
  await expect(page.locator("[data-modifier]").nth(3)).toHaveAttribute("data-modifier", "max-hp-bonus");
  await expect(page.locator("[data-modifier='max-hp-bonus']")).toHaveClass(/ui-flash/);
  const one = hp.getByRole("checkbox", { name: "Your hit point maximum increases by 1 for each of your levels" });
  await expect(one).toBeFocused();
  await page.keyboard.press("Space");
  await expect(one).toBeChecked();
  await expect(add).toHaveAccessibleDescription("13 more");

  // The Remove link on the section rule is the control before it. Enter removes the section and puts the focus on Undo.
  await page.keyboard.press("Shift+Tab");
  await expect(hp.getByRole("button", { name: "Remove Hit Points" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(hp).toHaveCount(0);
  const note = page.getByRole("status").filter({ hasText: "Removed Hit Points." });
  const undo = note.getByRole("button", { name: "Undo" });
  await expect(undo).toBeFocused();

  // Undo puts the section and its value back, with the focus on its first control.
  await page.keyboard.press("Enter");
  await expect(note).toHaveCount(0);
  await expect(hp.getByRole("checkbox", { name: "Your hit point maximum increases by 1 for each of your levels" })).toBeChecked();
  await expect(hp.getByRole("checkbox", { name: "Your hit point maximum increases by 1 for each of your levels" })).toBeFocused();

  // Space on the Remove link removes the section too.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Space");
  await expect(hp).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Undo" })).toBeFocused();
});

test("a new section flashes once, with rounded corners, and with reduced motion it does not flash", async ({ page }) => {
  await page.goto("/content/new/feat");
  await page.getByRole("button", { name: "Add a modifier" }).click();
  await page.getByRole("dialog", { name: "Add a modifier" }).getByRole("button", { name: "Speed Bonuses" }).click();
  const section = page.locator("[data-modifier='speed']");
  await expect(section).toHaveClass(/ui-flash/);
  const style = await section.evaluate((el) => {
    const s = getComputedStyle(el);
    return { animation: s.animationName, radius: s.borderRadius };
  });
  expect(style).toEqual({ animation: "ui-flash", radius: "4px" });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByRole("button", { name: "Add a modifier" }).click();
  await page.getByRole("dialog", { name: "Add a modifier" }).getByRole("button", { name: "Hit Points" }).click();
  await expect(page.locator("[data-modifier='max-hp-bonus']")).toHaveClass(/ui-flash/);
  expect(await page.locator("[data-modifier='max-hp-bonus']").evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
});
