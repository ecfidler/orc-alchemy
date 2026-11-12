import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pickFromPicker, pickOption, removeToken } from "@orc-alchemy/ui/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

// ORC-199: the pickers, number toggles and the Armor Class select of the feat, race and subrace forms (docs/design/homebrew-forms.md, "Controls").

/** Adds the modifier named `name` from the "+ Add a modifier" list. */
const addModifier = (page: Page, name: string) => pickFromPicker(page.getByRole("button", { name: "Add a modifier" }), name);
/** The section named `name`. */
const section = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
/** Picks `names` with the picker of the section `group`, whose add button reads `add`. */
const pick = (page: Page, group: string, add: string, names: string | string[]) => pickFromPicker(section(page, group).getByRole("button", { name: add, exact: true }), names);
const tokens = (page: Page, group: string) => section(page, group).locator(".ui-token-label");
const segment = (page: Page, group: string, value: string) => section(page, group).getByRole("button", { name: value, exact: true });

test("the feat form: a prerequisite picker with the races at the end, a damage resistance picker, and a number toggle", async ({ page }) => {
  await page.goto("/content/new/feat");
  await page.getByRole("textbox", { name: "Name" }).fill("Ship's Cook");
  // The tokens are in the order of the list, not of the picks.
  await pick(page, "Prerequisites", "Add a prerequisite", ["Elf race", "Wisdom 13 or higher"]);
  await expect(tokens(page, "Prerequisites")).toHaveText(["Wisdom 13 or higher", "Elf race"]);
  await addModifier(page, "Damage Resistances");
  await pick(page, "Damage Resistances", "Add a damage resistance", ["Fire", "Cold"]);
  await expect(tokens(page, "Damage Resistances")).toHaveText(["Cold", "Fire"]);
  await removeToken(section(page, "Damage Resistances"), "Cold");
  await expect(tokens(page, "Damage Resistances")).toHaveText(["Fire"]);
  await addModifier(page, "Speed Bonuses");
  await segment(page, "Speed Bonuses", "10").click();
  await expect(segment(page, "Speed Bonuses", "10")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  // Edit loads the picks back. Cold holds false, so it shows no token.
  await page.goto(`/content/edit/feat/${encodeURIComponent("Default Option Source")}/ships-cook`);
  await expect(tokens(page, "Damage Resistances")).toHaveText(["Fire"]);
  await expect(tokens(page, "Prerequisites")).toHaveText(["Wisdom 13 or higher", "Elf race"]);
  await expect(segment(page, "Speed Bonuses", "10")).toHaveAttribute("aria-pressed", "true");
  await segment(page, "Speed Bonuses", "None").click();
  await expect(segment(page, "Speed Bonuses", "None")).toHaveAttribute("aria-pressed", "true");
});

test("the race form: a language picker with search, and the Armor Class select", async ({ page }) => {
  await page.goto("/content/new/race");
  const languages = section(page, "Languages");
  await languages.getByRole("button", { name: "Add a language", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a language" });
  await expect(dialog.getByRole("searchbox", { name: "Search" })).toBeFocused();
  await page.keyboard.type("elv");
  await expect(dialog.locator(".ui-list-row")).toHaveText(["ElvishAdd"]);
  await page.keyboard.press("Escape");
  await pick(page, "Languages", "Add a language", ["Infernal", "Common"]);
  await expect(tokens(page, "Languages")).toHaveText(["Common", "Infernal"]);
  await removeToken(languages, "Common");
  await expect(tokens(page, "Languages")).toHaveText(["Infernal"]);
  await expect(languages.getByRole("button", { name: "Remove Infernal" })).toBeFocused();

  await addModifier(page, "Armor Class");
  const ac = page.getByRole("combobox", { name: "Armor Class" });
  await expect(ac).toHaveText("Normal");
  await pickOption(ac, "13 + DEX");
  await expect(ac).toHaveText("13 + DEX");
  await pickOption(ac, "Always 17");
  await expect(ac).toHaveText("Always 17");
});

test("the subrace form: a saving throw picker and the Hit Points toggle", async ({ page }) => {
  await page.goto("/content/new/subrace");
  await addModifier(page, "Saving Throw Advantage");
  const add = section(page, "Saving Throw Advantage").getByRole("button", { name: "Add a condition", exact: true });
  await expect(add).toHaveAccessibleDescription("15 more");
  await pick(page, "Saving Throw Advantage", "Add a condition", ["Poisoned", "Charmed"]);
  await expect(tokens(page, "Saving Throw Advantage")).toHaveText(["Charmed", "Poisoned"]);
  await expect(add).toHaveAccessibleDescription("13 more");
  await removeToken(section(page, "Saving Throw Advantage"), "Poisoned");
  await expect(tokens(page, "Saving Throw Advantage")).toHaveText(["Charmed"]);
  await addModifier(page, "Hit Points");
  await expect(section(page, "Hit Points").getByRole("group", { name: "More hit points for each of your levels" })).toBeVisible();
  await expect(segment(page, "Hit Points", "None")).toHaveAttribute("aria-pressed", "true");
  await segment(page, "Hit Points", "2").click();
  await expect(segment(page, "Hit Points", "2")).toHaveAttribute("aria-pressed", "true");
  await expect(segment(page, "Hit Points", "None")).toHaveAttribute("aria-pressed", "false");
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- homebrew-pickers.spec.ts
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2, viewport: { width: 760, height: 820 } });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`the feat, race and subrace forms, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-199-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      const open = async (type: string) => {
        await page.goto(`/content/new/${type}`);
        await page.getByRole("button", { name: "Add a modifier" }).waitFor();
        await page.evaluate(() => document.fonts.ready);
      };
      // The flash of the last added section is not a part of the look.
      const noFlash = () => page.locator(".ui-flash").evaluateAll((all) => all.forEach((el) => el.classList.remove("ui-flash")));
      const main = page.locator("main");

      await open("feat");
      await page.getByRole("textbox", { name: "Name" }).fill("Ship's Cook");
      await pick(page, "Prerequisites", "Add a prerequisite", ["Wisdom 13 or higher", "Halfling race"]);
      await page.getByRole("group", { name: "Ability Increase Options" }).getByRole("checkbox", { name: "Wisdom" }).check();
      for (const name of ["Languages", "Hit Points", "Damage Resistances", "Misc. Modifiers", "Tool Proficiency or Expertise"]) await addModifier(page, name);
      await segment(page, "Languages", "2").click();
      await segment(page, "Hit Points", "1").click();
      await pick(page, "Damage Resistances", "Add a damage resistance", ["Fire", "Poison"]);
      await pick(page, "Misc. Modifiers", "Add a misc. modifier", ["You can use two-weapon fighting with any one-handed melee weapon", "Advantage on saving throws against traps"]);
      await pick(page, "Tool Proficiency or Expertise", "Add a tool", ["Cook's Utensils", "Brewer's Supplies"]);
      await noFlash();
      await main.screenshot({ path: shot("feat-filled") });
      await section(page, "Prerequisites").getByRole("button", { name: "Add a prerequisite", exact: true }).click();
      await page.getByRole("dialog", { name: "Add a prerequisite" }).waitFor();
      await page.screenshot({ path: shot("feat-prerequisites") });

      await open("race");
      const fillRace = async () => {
        await page.getByRole("textbox", { name: "Name" }).fill("Tidekin");
        await pick(page, "Languages", "Add a language", ["Common", "Primordial"]);
        for (const name of ["Armor Class", "Weapon Proficiencies", "Skill Proficiency Choice"]) await addModifier(page, name);
        await pickOption(page.getByRole("combobox", { name: "Armor Class" }), "13 + DEX");
        await pick(page, "Weapon Proficiencies", "Add a weapon", ["Spear", "Trident", "Net"]);
        await pickOption(page.getByRole("combobox", { name: "Skill Proficiency Choice: choose" }), "2");
        await pick(page, "Skill Proficiency Choice", "Add a skill option", ["Athletics", "Nature", "Survival"]);
        await noFlash();
      };
      await fillRace();
      await main.screenshot({ path: shot("race-filled") });
      await section(page, "Weapon Proficiencies").getByRole("button", { name: "Add a weapon", exact: true }).click();
      await page.getByRole("dialog", { name: "Add a weapon" }).getByRole("searchbox").fill("cross");
      await page.screenshot({ path: shot("race-weapon-search") });

      await open("subrace");
      await page.getByRole("textbox", { name: "Name" }).fill("Deep Dwarf");
      for (const name of ["Hit Points", "Saving Throw Advantage", "Tool Proficiency", "Languages"]) await addModifier(page, name);
      await segment(page, "Hit Points", "1").click();
      await pick(page, "Saving Throw Advantage", "Add a condition", ["Poisoned", "Frightened"]);
      await pick(page, "Tool Proficiency", "Add a tool", ["Smith's Tools", "Mason's Tools"]);
      await pick(page, "Languages", "Add a language", ["Undercommon", "Dwarvish"]);
      await noFlash();
      await main.screenshot({ path: shot("subrace-filled") });

      await page.setViewportSize({ width: 390, height: 844 });
      await open("race");
      await fillRace();
      await main.screenshot({ path: shot("race-phone") });
    });
  }
});
