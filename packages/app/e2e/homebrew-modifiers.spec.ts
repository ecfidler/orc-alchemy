import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pickFromPicker, pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Page, test } from "@playwright/test";

/** Adds the modifier named `name` from the "+ Add a modifier" list. */
const addModifier = (page: Page, name: string) => pickFromPicker(page.getByRole("button", { name: "Add a modifier" }), name);

// ORC-197: the "+ Add a modifier" list of the feat form, with the keyboard only (docs/design/homebrew-forms.md, "Modifiers").
test("Add, Remove and Undo a feat modifier with the keyboard", async ({ page }) => {
  await page.goto("/content/new/feat");
  const add = page.getByRole("button", { name: "Add a modifier" });
  await expect(add).toHaveAccessibleDescription("Skill or Tool Proficiency, Languages, Weapon Proficiency and 11 more");
  await expect(page.getByRole("group", { name: "Hit Points", exact: true })).toHaveCount(0);

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
  const hp = page.getByRole("group", { name: "Hit Points", exact: true });
  await expect(hp).toBeVisible();
  await expect(page.locator("[data-modifier]").nth(2)).toHaveAttribute("data-modifier", "max-hp-bonus");
  await expect(page.locator("[data-modifier='max-hp-bonus']")).toHaveClass(/ui-flash/);
  const none = hp.getByRole("button", { name: "None" });
  const one = hp.getByRole("button", { name: "1", exact: true });
  await expect(none).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(one).toBeFocused();
  await page.keyboard.press("Space");
  await expect(one).toHaveAttribute("aria-pressed", "true");
  await expect(add).toHaveAccessibleDescription("Skill or Tool Proficiency, Languages, Weapon Proficiency and 10 more");

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
  await expect(one).toHaveAttribute("aria-pressed", "true");
  await expect(none).toBeFocused();

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

// ORC-198: the subrace, subclass, magic item and monster forms use the same list.
test("the subrace form adds Hit Points from the list, and Remove and Undo keep its value", async ({ page }) => {
  await page.goto("/content/new/subrace");
  await expect(page.getByRole("button", { name: "Add a modifier" })).toHaveAccessibleDescription(
    "Hit Points, Damage Resistances, Damage Immunities and 7 more",
  );
  await expect(page.getByRole("group", { name: "Hit Points", exact: true })).toHaveCount(0);
  await addModifier(page, "Hit Points");
  // The section is after Ability Score Increases, in form order.
  await expect(page.locator("[data-modifier]").nth(1)).toHaveAttribute("data-modifier", "max-hp-bonus");
  const one = page.getByRole("group", { name: "Hit Points", exact: true }).getByRole("button", { name: "1", exact: true });
  await one.click();
  await expect(one).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Remove Hit Points" }).click();
  await expect(one).toHaveCount(0);
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(one).toHaveAttribute("aria-pressed", "true");
});

test("the subclass form shows the level modifiers always, and adds Selections from the list", async ({ page }) => {
  await page.goto("/content/new/subclass");
  const modifiers = page.getByRole("group", { name: "Modifiers" });
  await expect(modifiers.getByRole("button", { name: "Add a level modifier" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add a modifier" })).toHaveAccessibleDescription(
    "Skill Proficiency Choice, Skill Expertise Choice, Selections",
  );
  await addModifier(page, "Selections");
  const selections = page.getByRole("group", { name: "Selections" });
  await selections.getByRole("button", { name: "Add selection" }).click();
  await pickOption(selections.getByRole("combobox", { name: "Selection 1 level" }), "3");
  await expect(page.locator("[data-modifier]").last()).toHaveAttribute("data-modifier", "level-selections");
  await selections.getByRole("button", { name: "Remove Selections" }).click();
  await expect(selections).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add a modifier" })).toHaveAccessibleDescription(
    "Skill Proficiency Choice, Skill Expertise Choice, Selections",
  );
});

test("the magic item form puts a removed modifier's entries back with Undo", async ({ page }) => {
  await page.goto("/content/new/magicItem");
  await expect(page.getByRole("button", { name: "Add a modifier" })).toHaveAccessibleDescription("Ability scores, Saving throw bonus, Speed bonus and 4 more");
  await addModifier(page, "Damage resistances");
  const resistances = page.getByRole("group", { name: "Damage resistances" });
  await pickFromPicker(resistances.getByRole("button", { name: "Add a damage resistance", exact: true }), "Fire");
  await addModifier(page, "Ability scores");
  await resistances.getByRole("button", { name: "Remove Damage resistances" }).click();
  await expect(resistances).toHaveCount(0);
  // A change to another modifier does not take Undo away.
  await pickOption(page.getByRole("combobox", { name: "STR change" }), "Increases by");
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(resistances.locator(".ui-token-label")).toHaveText(["Fire"]);
  await expect(page.getByRole("combobox", { name: "STR change" })).toHaveText("Increases by");
});

test("the monster form adds Armor notes as a section with a Remove link", async ({ page }) => {
  await page.goto("/content/new/monster");
  await expect(page.getByRole("textbox", { name: "Armor notes" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Add a modifier" })).toHaveAccessibleDescription("Armor notes, Damage vulnerabilities, Senses and 2 more");
  await addModifier(page, "Armor notes");
  const notes = page.getByRole("textbox", { name: "Armor notes" });
  await expect(notes).toBeFocused();
  await notes.fill("natural armor");
  await page.getByRole("group", { name: "Armor notes" }).getByRole("button", { name: "Remove Armor notes" }).click();
  await expect(notes).toHaveCount(0);
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(notes).toHaveValue("natural armor");
});

// ORC-212: the "Other modifiers" heading, and the examples in the button.
test("the add button is under the Other modifiers heading; its examples are on one line that is cut, and on a phone on a second line", async ({ page }) => {
  await page.goto("/content/new/feat");
  const add = page.getByRole("group", { name: "Other modifiers" }).getByRole("button", { name: "Add a modifier" });
  const label = add.locator(".ui-add-label");
  const examples = add.locator(".ui-add-detail");
  const box = async (part: typeof add) => (await part.boundingBox())!;
  // The button is as high as the other add buttons, and the examples are on the line of the label.
  expect(Math.abs((await box(add)).height - (await box(page.getByRole("button", { name: "Add a prerequisite" }))).height)).toBeLessThan(0.5);
  expect((await box(examples)).x).toBeGreaterThan((await box(label)).x + (await box(label)).width);
  expect(await examples.evaluate((el) => getComputedStyle(el).textOverflow)).toBe("ellipsis");

  // In a narrow column, the examples are below the label and they wrap.
  await page.setViewportSize({ width: 390, height: 800 });
  await expect.poll(async () => (await box(examples)).y).toBeGreaterThan((await box(label)).y + 5);
  expect((await box(examples)).x).toBe((await box(label)).x);
  expect(await examples.evaluate((el) => getComputedStyle(el).whiteSpace)).toBe("normal");
  expect(await examples.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- homebrew-modifiers.spec.ts
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2, viewport: { width: 760, height: 820 } });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`the four forms, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-198-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      const open = async (type: string) => {
        await page.goto(`/content/new/${type}`);
        await page.getByRole("button", { name: "Add a modifier" }).waitFor();
        await page.evaluate(() => document.fonts.ready);
      };
      const main = page.locator("main");

      await open("subrace");
      await main.screenshot({ path: shot("subrace-new") });
      await open("subclass");
      await main.screenshot({ path: shot("subclass-new") });
      await open("magicItem");
      await main.screenshot({ path: shot("magic-item-new") });
      await page.getByRole("button", { name: "Add a modifier" }).click();
      await page.getByRole("dialog", { name: "Add a modifier" }).waitFor();
      await page.screenshot({ path: shot("magic-item-list") });
      await open("monster");
      await main.screenshot({ path: shot("monster-new") });
      await addModifier(page, "Senses");
      await page.getByRole("textbox", { name: "Senses" }).fill("darkvision 60 ft.");
      await page.locator("[data-modifier='senses']").evaluate((el) => el.classList.remove("ui-flash"));
      await main.screenshot({ path: shot("monster-added") });

      // ORC-212: the heading and the examples, at the width of a desktop and of a phone.
      const other = page.getByRole("group", { name: "Other modifiers" });
      for (const [type, name] of [
        ["feat", "feat"],
        ["race", "race"],
        ["subrace", "subrace"],
        ["subclass", "subclass"],
        ["magicItem", "magic-item"],
        ["monster", "monster"],
      ]) {
        await page.setViewportSize({ width: 1100, height: 820 });
        await open(type);
        await other.scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(dir, `orc-212-${name}-${theme}.png`) });
        if (type !== "feat" && type !== "monster") continue;
        await page.setViewportSize({ width: 390, height: 800 });
        await other.scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(dir, `orc-212-${name}-phone-${theme}.png`) });
      }
    });
  }
});
