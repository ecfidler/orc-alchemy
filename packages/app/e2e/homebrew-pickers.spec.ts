import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { pickFromPicker, pickOption, removeToken } from "@orc-alchemy/ui/testing/playwright";
import { expect, test, type Page } from "@playwright/test";

// ORC-199: the pickers, number toggles and the Armor Class select of the feat, race and subrace forms (docs/design/homebrew-forms.md, "Controls").
// ORC-200: the tool sub-selections and the equipment picker of the background form.
// ORC-201: the class form's chips and spell list pickers, and the subclass spells table.
// ORC-202: the pickers of the magic item, monster and spell forms, and the base weapon select.

/** Adds the modifier named `name` from the "+ Add a modifier" list. */
const addModifier = (page: Page, name: string) => pickFromPicker(page.getByRole("button", { name: "Add a modifier" }), name);
/** The section named `name`. */
const section = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
/** Picks `names` with the picker of the section `group`, whose add button reads `add`. */
const pick = (page: Page, group: string, add: string, names: string | string[]) => pickFromPicker(section(page, group).getByRole("button", { name: add, exact: true }), names);
const tokens = (page: Page, group: string) => section(page, group).locator(".ui-token-label");
const segment = (page: Page, group: string, value: string) => section(page, group).getByRole("button", { name: value, exact: true });
/** The "+ Add a spell" button of a slot of the subclass spells table. */
const slot = (page: Page, level: string, which: "first" | "second") => page.getByRole("button", { name: `Add a spell: ${level} level, ${which} spell`, exact: true });
/** The cells of a row of the spells table, by its spell level, such as "2nd". */
const spellRow = (page: Page, level: string) => page.getByRole("row").filter({ has: page.getByRole("rowheader", { name: level, exact: true }) });

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

test("the background form: tool sub-selections and an equipment picker with search", async ({ page }) => {
  await page.goto("/content/new/background");
  await page.getByRole("textbox", { name: "Name" }).fill("Tidewatch");
  const tools = section(page, "Tool proficiencies");
  const addTool = tools.getByRole("button", { name: "Add a tool proficiency", exact: true });
  await expect(addTool).toHaveAccessibleDescription("6 more");
  await pickFromPicker(addTool, "Vehicles");
  await pickFromPicker(addTool, "Artisan's tools");
  await expect(addTool).toHaveAccessibleDescription("4 more");
  // The blocks are in the fixed order, not in the order of the clicks.
  await expect(tools.locator("[data-sub]")).toHaveText([/^Artisan's tools/, /^Vehicles/]);
  await pick(page, "Artisan's tools", "Add an artisan's tool", ["Smith's Tools", "Brewer's Supplies"]);
  await expect(tokens(page, "Artisan's tools")).toHaveText(["Brewer's Supplies", "Smith's Tools"]);
  await section(page, "Vehicles").getByRole("checkbox", { name: "Water Vehicles" }).check();
  // The X removes the block and its picks, with no confirmation, and the focus goes to the add button.
  await tools.getByRole("button", { name: "Remove Vehicles", exact: true }).click();
  await expect(section(page, "Vehicles")).toHaveCount(0);
  await expect(addTool).toBeFocused();
  await pick(page, "Starting equipment", "Add equipment", ["Rope, silk", "Amulet"]);
  await expect(tokens(page, "Starting equipment")).toHaveText(["Amulet", "Rope, silk"]);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await page.goto(`/content/edit/background/${encodeURIComponent("Default Option Source")}/tidewatch`);
  await expect(tokens(page, "Artisan's tools")).toHaveText(["Brewer's Supplies", "Smith's Tools"]);
  await expect(section(page, "Vehicles")).toHaveCount(0);
  await expect(tokens(page, "Starting equipment")).toHaveText(["Amulet", "Rope, silk"]);
});

test("the class form: a spell list picker with search, and ability increase chips", async ({ page }) => {
  await page.goto("/content/new/class");
  await page.getByRole("textbox", { name: "Name" }).fill("Tide Caller");
  const levels = section(page, "Ability increase levels");
  await expect(tokens(page, "Ability increase levels")).toHaveText(["4", "8", "12", "16", "19"]);
  await pickOption(levels.getByRole("button", { name: "Add a level", exact: true }), "Level 6");
  await expect(tokens(page, "Ability increase levels")).toHaveText(["4", "6", "8", "12", "16", "19"]);
  await removeToken(levels, "Level 19");
  await expect(tokens(page, "Ability increase levels")).toHaveText(["4", "6", "8", "12", "16"]);

  await pickOption(page.getByRole("combobox", { name: "Spell slots" }), "Yes");
  await section(page, "Level 1 spells").getByRole("button", { name: "Add a 1st-level spell", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a 1st-level spell" });
  await expect(dialog.getByRole("searchbox", { name: "Search" })).toBeFocused();
  await page.keyboard.type("cure");
  await expect(dialog.locator(".ui-list-row")).toHaveText(["Cure WoundsAdd"]);
  await dialog.getByRole("button", { name: "Cure Wounds" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await pick(page, "Level 1 spells", "Add a 1st-level spell", "Bless");
  await expect(tokens(page, "Level 1 spells")).toHaveText(["Bless", "Cure Wounds"]);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await page.goto(`/content/edit/class/${encodeURIComponent("Default Option Source")}/tide-caller`);
  await expect(tokens(page, "Ability increase levels")).toHaveText(["4", "6", "8", "12", "16"]);
  await expect(tokens(page, "Level 1 spells")).toHaveText(["Bless", "Cure Wounds"]);
});

test("the subclass form: two slots of a spells row filled, one removed, and the rest kept on save", async ({ page }) => {
  await page.goto("/content/new/subclass");
  await page.getByRole("textbox", { name: "Name" }).fill("Oath of the Lantern");
  await pickOption(page.getByRole("combobox", { name: "Class" }), "Paladin");
  await slot(page, "2nd", "first").click();
  const dialog = page.getByRole("dialog", { name: "Add a 2nd-level spell" });
  await expect(dialog.getByRole("searchbox", { name: "Search" })).toBeFocused();
  await page.keyboard.type("zone");
  await dialog.getByRole("button", { name: "Zone of Truth" }).click();
  await expect(dialog.getByRole("status")).toHaveText("1 of 2 in this row");
  await dialog.getByRole("searchbox").fill("lesser");
  await dialog.getByRole("button", { name: "Lesser Restoration" }).click();
  // The row has two spells, so the picker closes.
  await expect(dialog).toHaveCount(0);
  await expect(spellRow(page, "2nd").locator(".ui-token-label")).toHaveText(["Zone of Truth", "Lesser Restoration"]);
  await removeToken(spellRow(page, "2nd"), "Zone of Truth");
  await expect(spellRow(page, "2nd").locator(".ui-token-label")).toHaveText(["Lesser Restoration"]);
  await expect(slot(page, "2nd", "first")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await page.goto(`/content/edit/subclass/${encodeURIComponent("Default Option Source")}/oath-of-the-lantern`);
  await expect(spellRow(page, "2nd").locator(".ui-token-label")).toHaveText(["Lesser Restoration"]);
  await expect(slot(page, "2nd", "first")).toBeVisible();
});

test("the magic item form: a base weapon select and picker, an attunement picker with search, and a damage picker", async ({ page }) => {
  await page.goto("/content/new/magicItem");
  await page.getByRole("textbox", { name: "Name" }).fill("Tide Blade");
  await pickOption(page.getByRole("combobox", { name: "Type" }), "Weapon");
  const base = page.getByRole("combobox", { name: "Base weapon" });
  await expect(base).toHaveText("Specific");
  await section(page, "Base weapon").getByRole("button", { name: "Add a base weapon", exact: true }).click();
  const weapons = page.getByRole("dialog", { name: "Add a base weapon" });
  await expect(weapons.getByRole("searchbox", { name: "Search" })).toBeFocused();
  await page.keyboard.type("trid");
  await expect(weapons.locator(".ui-list-row")).toHaveText(["TridentAdd"]);
  await page.keyboard.press("Escape");
  await pick(page, "Base weapon", "Add a base weapon", ["Trident", "Scimitar"]);
  await expect(tokens(page, "Base weapon")).toHaveText(["Scimitar", "Trident"]);
  await removeToken(section(page, "Base weapon"), "Scimitar");
  await pickOption(base, "New weapon");
  await expect(section(page, "Base weapon details")).toBeVisible();
  await expect(section(page, "Base weapon")).not.toContainText("Add a base weapon");
  await pickOption(base, "Specific");
  await expect(section(page, "Base weapon details")).toHaveCount(0);
  await pick(page, "Base weapon", "Add a base weapon", "Trident");

  await page.getByRole("checkbox", { name: "Requires attunement" }).check();
  await expect(section(page, "Attunement")).toContainText("No limits: any creature can attune to it.");
  await section(page, "Attunement").getByRole("button", { name: "Add an attunement limit", exact: true }).click();
  const limits = page.getByRole("dialog", { name: "Add an attunement limit" });
  await expect(limits.getByRole("searchbox", { name: "Search" })).toBeFocused();
  await page.keyboard.type("good");
  await expect(limits.locator(".ui-list-row")).toHaveText(["GoodAdd", "Lawful GoodAdd", "Neutral GoodAdd", "Chaotic GoodAdd"]);
  await page.keyboard.press("Escape");
  await pick(page, "Attunement", "Add an attunement limit", ["Neutral Good", "Druid"]);
  await expect(tokens(page, "Attunement")).toHaveText(["Druid", "Neutral Good"]);

  await addModifier(page, "Damage resistances");
  await pick(page, "Damage resistances", "Add a damage resistance", ["Lightning", "Cold"]);
  await expect(tokens(page, "Damage resistances")).toHaveText(["Cold", "Lightning"]);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await page.goto("/content/edit/magicItem/tide-blade");
  await expect(base).toHaveText("Specific");
  await expect(tokens(page, "Base weapon")).toHaveText(["Trident"]);
  await expect(tokens(page, "Attunement")).toHaveText(["Druid", "Neutral Good"]);
  await expect(tokens(page, "Damage resistances")).toHaveText(["Cold", "Lightning"]);
});

test("the monster form: damage and condition pickers, and a language picker with search", async ({ page }) => {
  await page.goto("/content/new/monster");
  await page.getByRole("textbox", { name: "Name" }).fill("Reef Hag");
  await pickOption(page.getByRole("combobox", { name: "Hit die count", exact: true }), "4");
  await pickOption(page.getByRole("combobox", { name: "Hit die", exact: true }), "8");
  await addModifier(page, "Damage vulnerabilities");
  await pick(page, "Damage vulnerabilities", "Add a damage vulnerability", "Fire");
  await pick(page, "Damage resistances", "Add a damage resistance", ["Damage from traps", "Cold"]);
  await expect(tokens(page, "Damage resistances")).toHaveText(["Damage from traps", "Cold"]);
  await pick(page, "Damage immunities", "Add a damage immunity", "Poison");
  const conditions = section(page, "Condition immunities").getByRole("button", { name: "Add a condition", exact: true });
  await expect(conditions).toHaveAccessibleDescription("15 more");
  await pick(page, "Condition immunities", "Add a condition", ["Poisoned", "Charmed"]);
  await expect(conditions).toHaveAccessibleDescription("13 more");
  await section(page, "Languages").getByRole("button", { name: "Add a language", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Add a language" });
  await expect(dialog.getByRole("searchbox", { name: "Search" })).toBeFocused();
  await page.keyboard.type("sylv");
  await expect(dialog.locator(".ui-list-row")).toHaveText(["SylvanAdd"]);
  await page.keyboard.press("Escape");
  await pick(page, "Languages", "Add a language", ["Sylvan", "Common"]);
  await removeToken(section(page, "Languages"), "Common");
  await expect(tokens(page, "Languages")).toHaveText(["Sylvan"]);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await page.goto(`/content/edit/monster/${encodeURIComponent("Default Option Source")}/reef-hag`);
  await expect(tokens(page, "Damage vulnerabilities")).toHaveText(["Fire"]);
  await expect(tokens(page, "Damage resistances")).toHaveText(["Damage from traps", "Cold"]);
  await expect(tokens(page, "Damage immunities")).toHaveText(["Poison"]);
  await expect(tokens(page, "Condition immunities")).toHaveText(["Charmed", "Poisoned"]);
  await expect(tokens(page, "Languages")).toHaveText(["Sylvan"]);
});

test("the spell form: a new spell is on no class list, and a class picker", async ({ page }) => {
  await page.goto("/content/new/spell");
  await page.getByRole("textbox", { name: "Name" }).fill("Brine Bolt");
  await expect(tokens(page, "Class spell lists")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  const add = section(page, "Class spell lists").getByRole("button", { name: "Add a class", exact: true });
  await expect(add).toHaveAccessibleDescription("8 more");
  await pick(page, "Class spell lists", "Add a class", ["Wizard", "Druid", "Sorcerer"]);
  await expect(tokens(page, "Class spell lists")).toHaveText(["Druid", "Sorcerer", "Wizard"]);
  await removeToken(section(page, "Class spell lists"), "Sorcerer");
  await expect(add).toHaveAccessibleDescription("6 more");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/content$/);

  await page.goto(`/content/edit/spell/${encodeURIComponent("Default Option Source")}/brine-bolt`);
  await expect(tokens(page, "Class spell lists")).toHaveText(["Druid", "Wizard"]);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the subclass spells table stacks the second slot of a row under the first", async ({ page }) => {
    await page.goto("/content/new/subclass");
    await pickOption(page.getByRole("combobox", { name: "Class" }), "Cleric");
    // Two picks from the first slot fill the row, and the picker closes itself.
    await pickFromPicker(slot(page, "1st", "first"), ["Bless", "Cure Wounds"]);
    const tokens = spellRow(page, "1st").locator(".ui-token");
    await expect(tokens).toHaveCount(2);
    const first = (await tokens.nth(0).boundingBox())!;
    const second = (await tokens.nth(1).boundingBox())!;
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    expect(Math.abs(second.x - first.x)).toBeLessThan(2);
  });
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

    test(`the background form, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-200-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      const main = page.locator("main");
      const open = async () => {
        await page.goto("/content/new/background");
        await page.getByRole("button", { name: "Add a tool proficiency" }).waitFor();
        await page.evaluate(() => document.fonts.ready);
      };
      const noFlash = () => page.locator(".ui-flash").evaluateAll((all) => all.forEach((el) => el.classList.remove("ui-flash")));
      const addTool = () => section(page, "Tool proficiencies").getByRole("button", { name: "Add a tool proficiency", exact: true });
      const fill = async () => {
        await page.getByRole("textbox", { name: "Name" }).fill("Tidewatch Sailor");
        await page.getByRole("textbox", { name: "Description" }).fill("You stood watch on a coast ship through storms and long nights. You know ropes, tides and the talk of the docks.");
        await pick(page, "Skill proficiencies", "Add a skill", ["Athletics", "Perception"]);
        await segment(page, "Languages", "1").click();
        for (const name of ["Any artisan's tool", "Artisan's tools", "Any musical instrument", "Any gaming set", "Vehicles", "Other tools"]) await pickFromPicker(addTool(), name);
        await page.getByRole("group", { name: "Any musical instrument: number" }).getByRole("button", { name: "2" }).click();
        await pick(page, "Artisan's tools", "Add an artisan's tool", ["Carpenter's Tools", "Cartographer's Tools"]);
        await section(page, "Vehicles").getByRole("checkbox", { name: "Water Vehicles" }).check();
        await section(page, "Other tools").getByRole("checkbox", { name: "Navigator's Tools" }).check();
        await page.getByLabel("Gold").fill("10");
        await pick(page, "Starting equipment", "Add equipment", ["Any 1 musical instrument", "Clothes, common", "Pouch", "Rope, silk", "Signal whistle"]);
        await page.getByRole("button", { name: "Add feature / trait" }).click();
        await page.getByRole("textbox", { name: "Feature 1 name" }).fill("Ship's Passage");
        await page.getByRole("textbox", { name: "Feature 1 description" }).fill("You can get free passage on a sailing ship for yourself and your companions.");
        await noFlash();
      };

      await open();
      await main.screenshot({ path: shot("background-empty") });
      await fill();
      await main.screenshot({ path: shot("background-filled") });

      await open();
      await pickFromPicker(addTool(), "Vehicles");
      await noFlash();
      await addTool().click();
      await page.getByRole("dialog", { name: "Add a tool proficiency" }).waitFor();
      await page.screenshot({ path: shot("tool-list") });

      await page.keyboard.press("Escape");
      await section(page, "Starting equipment").getByRole("button", { name: "Add equipment", exact: true }).click();
      await page.getByRole("dialog", { name: "Add equipment" }).getByRole("searchbox").fill("tools");
      await page.screenshot({ path: shot("equipment-search") });

      await page.setViewportSize({ width: 390, height: 844 });
      await open();
      await fill();
      await main.screenshot({ path: shot("background-phone") });
    });

    test(`orc-202 the magic item, monster and spell forms, ${theme}`, async ({ page }) => {
      test.setTimeout(90_000);
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-202-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      const main = page.locator("main");
      const open = async (type: string) => {
        await page.goto(`/content/new/${type}`);
        await page.getByRole("textbox", { name: "Name" }).waitFor();
        await page.evaluate(() => document.fonts.ready);
      };
      const noFlash = () => page.locator(".ui-flash").evaluateAll((all) => all.forEach((el) => el.classList.remove("ui-flash")));
      const choose = (label: string, option: string) => pickOption(page.getByRole("combobox", { name: label, exact: true }), option);

      await open("magicItem");
      await page.getByRole("textbox", { name: "Name" }).fill("Tide Blade");
      await page.getByRole("textbox", { name: "Description" }).fill("A blade of sea-green steel that drips with brine.");
      await choose("Type", "Weapon");
      await choose("Rarity", "Rare");
      await pick(page, "Base weapon", "Add a base weapon", ["Scimitar", "Trident"]);
      await page.getByRole("checkbox", { name: "Requires attunement" }).check();
      await pick(page, "Attunement", "Add an attunement limit", ["Druid", "Ranger", "Neutral Good"]);
      await page.getByLabel("Magical attack bonus").fill("1");
      await page.getByLabel("Magical damage bonus").fill("1");
      await addModifier(page, "Damage resistances");
      await pick(page, "Damage resistances", "Add a damage resistance", ["Cold", "Lightning"]);
      await noFlash();
      await main.screenshot({ path: shot("magic-item-filled") });
      await section(page, "Attunement").getByRole("button", { name: "Add an attunement limit", exact: true }).click();
      await page.getByRole("dialog", { name: "Add an attunement limit" }).getByRole("searchbox").fill("good");
      await page.screenshot({ path: shot("attunement-search") });

      await open("monster");
      await page.getByRole("textbox", { name: "Name" }).fill("Reef Hag");
      await choose("Hit die count", "4");
      await choose("Hit die", "8");
      await addModifier(page, "Damage vulnerabilities");
      await pick(page, "Damage vulnerabilities", "Add a damage vulnerability", "Fire");
      await pick(page, "Damage resistances", "Add a damage resistance", ["Cold", "Damage from traps"]);
      await pick(page, "Damage immunities", "Add a damage immunity", "Poison");
      await pick(page, "Condition immunities", "Add a condition", ["Charmed", "Poisoned"]);
      await pick(page, "Languages", "Add a language", ["Common", "Primordial", "Sylvan"]);
      await noFlash();
      await main.screenshot({ path: shot("monster-filled") });
      await section(page, "Languages").getByRole("button", { name: "Add a language", exact: true }).click();
      await page.getByRole("dialog", { name: "Add a language" }).waitFor();
      await page.screenshot({ path: shot("monster-languages") });

      await open("spell");
      await page.getByRole("textbox", { name: "Name" }).fill("Brine Bolt");
      await choose("Level", "1st-level");
      await choose("School", "evocation");
      await page.getByRole("textbox", { name: "Casting time" }).fill("1 action");
      await page.getByRole("textbox", { name: "Range" }).fill("60 feet");
      await page.getByRole("textbox", { name: "Duration" }).fill("Instantaneous");
      await page.getByRole("textbox", { name: "Description" }).fill("A bolt of sea water strikes a creature you can see.");
      await page.getByRole("checkbox", { name: "Verbal" }).check();
      await page.getByRole("checkbox", { name: "Somatic" }).check();
      await page.getByRole("checkbox", { name: "Requires an attack roll" }).check();
      await pick(page, "Class spell lists", "Add a class", ["Druid", "Sorcerer", "Wizard"]);
      await main.screenshot({ path: shot("spell-filled") });
      await section(page, "Class spell lists").getByRole("button", { name: "Add a class", exact: true }).click();
      await page.getByRole("dialog", { name: "Add a class" }).waitFor();
      await page.screenshot({ path: shot("spell-classes") });
    });

    test(`orc-201 the class and subclass forms, ${theme}`, async ({ page }) => {
      test.setTimeout(90_000);
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-201-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);
      const main = page.locator("main");
      const open = async (type: string) => {
        await page.goto(`/content/new/${type}`);
        await page.getByRole("textbox", { name: "Name" }).waitFor();
        await page.evaluate(() => document.fonts.ready);
      };
      const noFlash = () => page.locator(".ui-flash").evaluateAll((all) => all.forEach((el) => el.classList.remove("ui-flash")));
      const choose = (label: string, option: string) => pickOption(page.getByRole("combobox", { name: label }), option);

      await open("class");
      await page.getByRole("textbox", { name: "Name" }).fill("Tide Caller");
      await page.getByRole("textbox", { name: "Description", exact: true }).fill("A caster who bends the sea to their will.");
      await choose("Hit die", "8");
      await choose("Subclass chosen at level", "2");
      await page.getByRole("textbox", { name: "Subclass title, such as Path or Circle" }).fill("Current");
      await page.getByRole("textbox", { name: "Subclass description" }).fill("The current that guides you.");
      for (const name of ["Wisdom", "Charisma"]) await section(page, "Saving throws").getByRole("checkbox", { name }).check();
      await pickOption(section(page, "Ability increase levels").getByRole("button", { name: "Add a level", exact: true }), "Level 10");
      await choose("Spell slots", "Yes");
      await choose("First spell slots at level", "1");
      await choose("Cantrips", "Yes");
      await choose("Cantrips known at level 1", "2");
      await pickOption(section(page, "Extra cantrips at level").getByRole("button", { name: "Add a level", exact: true }), "Level 4");
      await pickOption(section(page, "Extra cantrips at level").getByRole("button", { name: "Add a level", exact: true }), "Level 10");
      await pick(page, "Cantrips", "Add a cantrip", ["Ray of Frost", "Shocking Grasp", "Thaumaturgy"]);
      await pick(page, "Level 1 spells", "Add a 1st-level spell", ["Fog Cloud", "Create or Destroy Water", "Thunderwave"]);
      await pick(page, "Level 2 spells", "Add a 2nd-level spell", ["Misty Step", "Gust of Wind"]);
      await choose("Skill Proficiency Choice: choose", "2");
      await pick(page, "Skill Proficiency Choice", "Add a skill option", ["Athletics", "Nature", "Survival", "Insight"]);
      await noFlash();
      await main.screenshot({ path: shot("class-filled") });
      await section(page, "Level 3 spells").getByRole("button", { name: "Add a 3rd-level spell", exact: true }).click();
      await page.getByRole("dialog", { name: "Add a 3rd-level spell" }).getByRole("searchbox").fill("water");
      await page.screenshot({ path: shot("class-spell-search") });

      const subclass = async (cls: string, name: string, spells: [string, "first" | "second", string[]][]) => {
        await open("subclass");
        await page.getByRole("textbox", { name: "Name" }).fill(name);
        await choose("Class", cls);
        for (const [level, which, names] of spells) await pickFromPicker(slot(page, level, which), names);
        await noFlash();
      };
      const paladin = () =>
        subclass("Paladin", "Oath of the Lantern", [
          ["1st", "first", ["Protection from Evil and Good", "Sanctuary"]],
          ["2nd", "first", ["Lesser Restoration"]],
          ["3rd", "second", ["Dispel Magic"]],
        ]);
      await paladin();
      await main.screenshot({ path: shot("paladin-table") });
      await slot(page, "2nd", "second").click();
      await page.getByRole("dialog", { name: "Add a 2nd-level spell" }).waitFor();
      await page.screenshot({ path: shot("subclass-spell-picker") });

      await subclass("Cleric", "Harvest Domain", [
        ["1st", "first", ["Bless", "Cure Wounds"]],
        ["2nd", "first", ["Lesser Restoration", "Spiritual Weapon"]],
        ["3rd", "first", ["Beacon of Hope", "Revivify"]],
        ["4th", "first", ["Death Ward", "Guardian of Faith"]],
        ["5th", "first", ["Mass Cure Wounds", "Raise Dead"]],
      ]);
      await main.screenshot({ path: shot("cleric-table") });
      await subclass("Warlock", "The Ember Court", [
        ["1st", "first", ["Burning Hands", "Command"]],
        ["2nd", "first", ["Blindness/Deafness", "Scorching Ray"]],
        ["3rd", "first", ["Fireball"]],
        ["5th", "second", ["Flame Strike"]],
      ]);
      await main.screenshot({ path: shot("warlock-table") });

      await page.setViewportSize({ width: 390, height: 844 });
      await paladin();
      await main.screenshot({ path: shot("paladin-phone") });
    });
  }
});
