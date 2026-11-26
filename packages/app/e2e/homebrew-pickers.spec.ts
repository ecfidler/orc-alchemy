import { pickFromPicker, pickOption, removeToken } from "@orc-alchemy/ui/testing/playwright";
import { expect, type Page, test } from "@playwright/test";

// ORC-199: the pickers, number toggles and the Armor Class select of the feat, race and subrace forms (docs/design/homebrew-forms.md, "Controls").
// ORC-200: the tool sub-selections and the equipment picker of the background form.
// ORC-201: the class form's chips and spell list pickers, and the subclass spells table.
// ORC-202: the pickers of the magic item, monster and spell forms, and the base weapon select.

/** Adds the modifier named `name` from the "+ Add a modifier" list. */
const addModifier = (page: Page, name: string) => pickFromPicker(page.getByRole("button", { name: "Add a modifier" }), name);
/** The section named `name`. */
const section = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
/** Picks `names` with the picker of the section `group`, whose add button reads `add`. */
const pick = (page: Page, group: string, add: string, names: string | string[]) =>
  pickFromPicker(section(page, group).getByRole("button", { name: add, exact: true }), names);
const tokens = (page: Page, group: string) => section(page, group).locator(".ui-token-label");
const segment = (page: Page, group: string, value: string) => section(page, group).getByRole("button", { name: value, exact: true });
/** The "+ Add a spell" button of a slot of the subclass spells table. */
const slot = (page: Page, level: string, which: "first" | "second") =>
  page.getByRole("button", { name: `Add a spell: ${level} level, ${which} spell`, exact: true });
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
