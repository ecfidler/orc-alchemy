import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");
// A step button's name ends with its count of picks to do, when it has some.
const stepButton = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Steps" }).getByRole("button", { name: new RegExp(`^${name}( \\(\\d+ to do\\))?$`) });

test("a new character becomes a dwarf acolyte fighter 1, and the preview follows each pick", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);

  const builder = page.getByRole("region", { name: "Builder" });
  const preview = page.getByRole("region", { name: "Preview" });
  const hp = preview.getByLabel("Hit Points", { exact: true });
  // emptyCharacter is a level 1 barbarian with Con 13.
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Barbarian 1");
  await expect(hp).toHaveText("13 / 13");

  // Race: a dwarf has Con +2 and a speed of 25 ft.
  await builder.getByRole("button", { name: "Dwarf", exact: true }).click();
  await expect(builder.getByRole("button", { name: "Dwarf", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(preview.getByLabel("Race", { exact: true })).toHaveText("Dwarf");
  await expect(preview.getByLabel("Speed", { exact: true })).toHaveText("25 ft.");
  await expect(hp).toHaveText("14 / 14");
  // Picking another race replaces it, and the dwarf's subrace opens under it.
  await builder.getByRole("button", { name: "Elf", exact: true }).click();
  await expect(preview.getByLabel("Race", { exact: true })).toHaveText("Elf");
  await builder.getByRole("button", { name: "Dwarf", exact: true }).click();
  await expect(builder.getByRole("region", { name: /^Subrace/ })).toBeVisible();
  await expect(preview.getByLabel("Race", { exact: true })).toHaveText("Dwarf");

  await stepButton(page, "Background").click();
  await builder.getByRole("button", { name: "Acolyte", exact: true }).click();
  await expect(preview.getByLabel("Background", { exact: true })).toHaveText("Acolyte");
  await expect(preview).toContainText("Shelter the Faithful");

  // Class: a fighter's hit die is d10, so 10 + Con +2.
  await stepButton(page, "Class").click();
  // At level 1 there is nothing to lose, so the change does not ask first.
  await builder.getByLabel("Class 1", { exact: true }).selectOption("Fighter");
  await expect(builder.getByLabel("Class 1", { exact: true })).toHaveValue("fighter");
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Fighter 1");
  await expect(hp).toHaveText("12 / 12");
  await expect(builder.getByRole("region", { name: /^Fighting Style/ })).toBeVisible();

  // The builder links to the sheet, which shows the same character.
  await page.getByRole("link", { name: "Sheet" }).click();
  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  // The URL changes before the page does, and the builder has a Class region too.
  await expect(page.getByRole("region", { name: "Builder" })).toHaveCount(0);
  await expect(page.getByLabel("Class", { exact: true })).toHaveText("Fighter 1");
  await expect(page.getByLabel("Race", { exact: true })).toHaveText("Dwarf");
  await page.getByRole("link", { name: "Build" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);
});

test("a pick the engine refuses shows its reason at the selection", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  // A level 1 character has no feat to pick.
  await stepButton(page, "Feats").click();
  await builder.getByRole("button", { name: "Grappler" }).click();
  await expect(builder.getByRole("alert")).toHaveText(/no selections remain/);
  await expect(page.getByRole("region", { name: "Preview" }).getByLabel("Class", { exact: true })).toHaveText("Barbarian 1");
});

test("replacing a class with more than level 1 asks first", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-5.strict.json"));
  await page.getByRole("link", { name: "Build", exact: true }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  const klass = page.getByRole("region", { name: "Preview" }).getByLabel("Class", { exact: true });
  await expect(klass).toHaveText("Fighter 5 (Champion)");
  await stepButton(page, "Class").click();

  let message = "";
  page.once("dialog", (dialog) => {
    message = dialog.message();
    return dialog.dismiss();
  });
  const class1 = builder.getByLabel("Class 1", { exact: true });
  await class1.selectOption("Wizard");
  await expect.poll(() => message).toBe(
    "Replace Fighter with Wizard? Fighter's 5 levels and their choices are removed, and Wizard starts at level 1. This cannot be undone.",
  );
  await expect(klass).toHaveText("Fighter 5 (Champion)");
  await expect(class1).toHaveValue("fighter");

  page.once("dialog", (dialog) => dialog.accept());
  await class1.selectOption("Wizard");
  await expect(klass).toHaveText("Wizard 1");
  await expect(class1).toHaveValue("wizard");
});

test("a half-elf fighter 3 adds wizard levels, then removes them", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = page.getByRole("region", { name: "Preview" });
  const klass = preview.getByLabel("Class", { exact: true });
  const hp = preview.getByLabel("Hit Points", { exact: true });
  const region = (name: string) => builder.getByRole("region", { name: new RegExp(`^${name}`) });

  // The half-elf's improvement: INT 12 + 1 is 13, as a wizard needs.
  await builder.getByRole("button", { name: "Half-Elf", exact: true }).click();
  const asi = region("Ability Score Improvement");
  await asi.getByRole("button", { name: "Increase STR" }).click();
  await asi.getByRole("button", { name: "Increase INT" }).click();
  await expect(asi.getByRole("button", { name: "Increase DEX" })).toBeDisabled();
  await expect(preview.getByLabel("INT", { exact: true })).toHaveText("13+1");

  // Con 13 is +1: 10 + 1 at level 1, then the average 6 + 1 for each level after.
  await stepButton(page, "Class").click();
  await builder.getByLabel("Class 1", { exact: true }).selectOption("Fighter");
  await expect(klass).toHaveText("Fighter 1");
  await expect(builder.getByRole("button", { name: "Remove a Fighter level" })).toBeDisabled();
  await expect(builder.getByRole("button", { name: "Remove Fighter", exact: true })).toBeDisabled();
  await builder.getByRole("button", { name: "Add a Fighter level" }).click();
  await builder.getByRole("button", { name: "Add a Fighter level" }).click();
  await expect(klass).toHaveText("Fighter 3");
  for (const level of [2, 3]) {
    const average = region(`Hit Points: Fighter ${level}`).getByRole("button", { name: "Average (6)" });
    await average.click();
    await expect(average).toHaveAttribute("aria-pressed", "true");
  }
  await builder.getByRole("button", { name: "Champion", exact: true }).click();
  await expect(klass).toHaveText("Fighter 3 (Champion)");
  await expect(hp).toHaveText("25 / 25");

  // A wizard's hit die is d6: the average is 4.
  await builder.getByLabel("Add a class", { exact: true }).selectOption("Wizard");
  await builder.getByRole("button", { name: "Add class" }).click();
  await expect(klass).toHaveText("Fighter 3 (Champion) / Wizard 1");
  await expect(builder.getByLabel("Class 2", { exact: true })).toHaveValue("wizard");
  await region("Hit Points: Wizard 1").getByRole("button", { name: "Average (4)" }).click();
  await builder.getByRole("button", { name: "Add a Wizard level" }).click();
  await region("Hit Points: Wizard 2").getByRole("button", { name: "Average (4)" }).click();
  await builder.getByRole("button", { name: "School of Evocation", exact: true }).click();
  await expect(klass).toHaveText("Fighter 3 (Champion) / Wizard 2 (School of Evocation)");
  await expect(hp).toHaveText("35 / 35");

  // Removing a level or a class that is not the first does not ask.
  await builder.getByRole("button", { name: "Remove a Wizard level" }).click();
  await expect(klass).toHaveText("Fighter 3 (Champion) / Wizard 1");
  await builder.getByRole("button", { name: "Remove Wizard", exact: true }).click();
  await expect(klass).toHaveText("Fighter 3 (Champion)");
  await expect(hp).toHaveText("25 / 25");
  await expect(builder.getByLabel("Class 2", { exact: true })).toHaveCount(0);
});

test("a new wizard 1 picks a cantrip and a spell on the Spells step, and prepares the spell", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Barbarian 1");

  // A barbarian has no spells, so the step appears with the wizard: 3 cantrips and 6 spells.
  await expect(stepButton(page, "Spells")).toHaveCount(0);
  await stepButton(page, "Class").click();
  await builder.getByLabel("Class 1", { exact: true }).selectOption("Wizard");
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Wizard 1");
  await expect(stepButton(page, "Spells")).toHaveAccessibleName("Spells (9 to do)");
  await stepButton(page, "Spells").click();

  const cantrips = builder.getByRole("region", { name: /^Wizard Cantrips Known/ });
  await cantrips.getByRole("button", { name: "Fire Bolt", exact: true }).click();
  await expect(cantrips.getByRole("button", { name: "Fire Bolt", exact: true })).toHaveAttribute("aria-pressed", "true");
  const spells = builder.getByRole("region", { name: /^Wizard Spells Known/ });
  await spells.getByLabel("Search: Wizard Spells Known").fill("magic missile");
  await spells.getByRole("button", { name: "1 - Magic Missile", exact: true }).click();
  await expect(spells.getByRole("list", { name: "Chosen: Wizard Spells Known" })).toHaveText("1 - Magic Missile");
  await expect(stepButton(page, "Spells")).toHaveAccessibleName("Spells (7 to do)");

  // emptyCharacter has Int 12: a wizard 1 prepares 2 spells.
  const prepared = builder.getByRole("region", { name: "Prepared spells: Wizard" });
  await expect(prepared).toContainText("0 of 2 prepared");
  await prepared.getByLabel("Prepared: Magic Missile").check();
  await expect(prepared).toContainText("1 of 2 prepared");

  const firstLevel = preview.getByRole("table", { name: "1st Level" });
  await expect(firstLevel.getByRole("columnheader", { name: "Prepared" })).toBeVisible();
  await expect(firstLevel.getByRole("row", { name: /^Magic Missile/ }).getByRole("cell").last()).toHaveText("Yes");
  await expect(preview.getByRole("table", { name: "Cantrips" })).toContainText("Fire Bolt");
});

test("Random character opens a complete character in the builder", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Random character" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);
  await expect(page.getByRole("region", { name: "Still to do" })).toHaveText("Every choice is made.");
  await expect(page.getByRole("region", { name: "Preview" }).getByLabel("Class", { exact: true })).toHaveText(/^\w.* \d+/);
});

test("the builder lists the picks still to make, and a pick removes its message", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  const summary = page.getByRole("region", { name: "Still to do" });
  await expect(summary).toContainText("You have 1 more 'Race' selection to make.");
  await expect(summary).toContainText("You have 2 more 'Skill Proficiency' selections to make.");
  // Starting equipment counts on the Equipment step but is not in the summary, as in the old builder.
  await expect(summary).not.toContainText("Starting Equipment");
  await expect(stepButton(page, "Class")).toHaveAccessibleName("Class (2 to do)");
  await expect(stepButton(page, "Equipment")).toHaveAccessibleName("Equipment (2 to do)");
  await expect(stepButton(page, "Race")).toHaveAccessibleName("Race (1 to do)");

  await page.getByRole("region", { name: "Builder" }).getByRole("button", { name: "Human", exact: true }).click();
  await expect(page.getByRole("region", { name: "Preview" }).getByLabel("Race", { exact: true })).toHaveText("Human");
  await expect(summary).not.toContainText("'Race'");
});

/** The count of drafts stored, read from IndexedDB: a change is kept as a draft at once. */
const draftCount = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("alchemy-5e");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const count = open.result.transaction("drafts").objectStore("drafts").count();
          count.onerror = () => reject(count.error);
          count.onsuccess = () => {
            open.result.close();
            resolve(count.result);
          };
        };
      }),
  );

test("a reload mid-edit asks first, then recovers the draft", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  const race = page.getByRole("region", { name: "Preview" }).getByLabel("Race", { exact: true });
  await expect(page.getByRole("status")).toHaveText("Saved");
  await builder.getByRole("button", { name: "Dwarf", exact: true }).click();
  await expect(race).toHaveText("Dwarf");
  await expect(page.getByRole("status")).toHaveText("Unsaved changes");
  await expect.poll(() => draftCount(page)).toBe(1);

  // Autosave has not run yet, so leaving asks first.
  let dialogType = "";
  page.once("dialog", (dialog) => {
    dialogType = dialog.type();
    return dialog.accept();
  });
  await page.reload();
  expect(dialogType).toBe("beforeunload");
  await expect(page.getByText("Unsaved changes from your last visit were recovered.")).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Unsaved changes");
  await expect(race).toHaveText("Dwarf");
});

test("Save stores the changes now, and leaving the builder saves them too", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  const race = page.getByRole("region", { name: "Preview" }).getByLabel("Race", { exact: true });
  await builder.getByRole("button", { name: "Dwarf", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Unsaved changes");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);

  // Nothing is pending, so a reload does not ask (Playwright would dismiss the prompt and stay).
  await page.reload();
  await expect(race).toHaveText("Dwarf");
  await expect(page.getByRole("status")).toHaveText("Saved");
  await expect(page.getByText(/were recovered/)).toHaveCount(0);

  // A move to the list saves at once: the list shows the change before autosave would have run.
  await builder.getByRole("button", { name: "Elf", exact: true }).click();
  await expect(race).toHaveText("Elf");
  await page.getByRole("link", { name: "Alchemy 5e" }).click();
  await expect(page.getByRole("listitem", { name: "Unnamed character" })).toContainText("Elf · Barbarian 1", { timeout: 3000 });
  await expect.poll(() => draftCount(page)).toBe(0);
});

test("fighter-1's scores by hand: a standard human with the standard scores, then a swap and point buy", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  const str = page.getByRole("region", { name: "Preview" }).getByLabel("STR", { exact: true });
  await builder.getByRole("button", { name: "Human", exact: true }).click();
  await builder.getByRole("button", { name: "Damaran", exact: true }).click();
  await builder.getByRole("button", { name: "Standard Human", exact: true }).click();
  await expect(builder.getByRole("button", { name: "Standard Human", exact: true })).toHaveAttribute("aria-pressed", "true");

  await stepButton(page, "Abilities").click();
  await expect(builder.getByRole("button", { name: "Standard Scores" })).toHaveAttribute("aria-pressed", "true");
  const scores = builder.getByRole("table", { name: "Ability scores" });
  const total = scores.getByRole("row", { name: /^Total/ }).getByRole("cell");
  await expect(total).toHaveText(["16", "15", "14", "13", "11", "9"]);
  await expect(scores.getByRole("row", { name: /^Race/ }).getByRole("cell")).toHaveText(["+1", "+1", "+1", "+1", "+1", "+1"]);
  await expect(str).toHaveText("16+3");

  // STR and DEX change places.
  await builder.getByRole("button", { name: "Move STR right" }).click();
  await expect(total).toHaveText(["15", "16", "14", "13", "11", "9"]);
  await expect(str).toHaveText("15+2");

  // Point buy starts every score at 8, and an increase spends points.
  await builder.getByRole("button", { name: "Point Buy" }).click();
  await expect(total).toHaveText(["9", "9", "9", "9", "9", "9"]);
  await expect(builder.getByText("Points left: 27 of 27")).toBeVisible();
  await builder.getByRole("button", { name: "Increase CON" }).click();
  await expect(total).toHaveText(["9", "9", "10", "9", "9", "9"]);
  await expect(builder.getByText("Points left: 26 of 27")).toBeVisible();
});

test("fighter-20 without armor or magic items is equipped on the Equipment step", async ({ page }, testInfo) => {
  // fighter-20 ("Ser Aldric") without its armor, magic items, hands and attunement.
  const strict = JSON.parse(readFileSync(join(charactersDir, "fighter-20.strict.json"), "utf8"));
  const lists = ["~:armor", "~:magic-weapons", "~:other-magic-items"];
  strict["~:orcpub.entity.strict/selections"] = strict["~:orcpub.entity.strict/selections"].filter(
    (s: Record<string, string>) => !lists.includes(s["~:orcpub.entity.strict/key"]),
  );
  for (const key of ["worn-armor", "wielded-shield", "main-hand-weapon", "attuned-magic-items"]) {
    delete strict["~:orcpub.entity.strict/values"][`~:orcpub.dnd.e5.character/${key}`];
  }
  const file = testInfo.outputPath("fighter-20-unequipped.json");
  writeFileSync(file, JSON.stringify(strict));

  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(file);
  await page.getByRole("link", { name: "Build", exact: true }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = page.getByRole("region", { name: "Preview" });
  const ac = preview.getByLabel("Armor Class", { exact: true });
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Fighter 20 (Champion)");
  await expect(ac).toHaveText("18");
  await stepButton(page, "Equipment").click();

  await builder.getByLabel("Add an item to Armor").selectOption("Plate");
  await expect(builder.getByLabel("Carried: Plate")).toBeChecked();
  await builder.getByLabel("Add an item to Magic Weapons").selectOption("Longsword +1");
  await builder.getByLabel("Add an item to Other Magic Items").selectOption("Amulet of Health");
  await builder.getByLabel("Worn armor").selectOption("Plate");
  await builder.getByLabel("Wielded shield").selectOption("Shield");
  await builder.getByLabel("Main hand").selectOption("Longsword +1");
  await builder.getByLabel("Attuned: Amulet of Health").check();

  await expect(ac).toHaveText("20");
  await expect(preview.getByLabel("Hit Points", { exact: true })).toHaveText("204 / 204");
  const longsword = preview.getByRole("table", { name: "Weapon attacks" }).getByRole("row", { name: /^Longsword 1 / });
  await expect(longsword.getByRole("cell")).toHaveText(["Longsword 1", "Yes", "+12 to hit", "+6"]);
});

test("the Description step writes a name on Enter and XP on blur, and the preview shows them", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByRole("heading", { level: 1 })).toBeVisible();

  // Description is the last step, and it has nothing to do.
  const description = page.getByRole("navigation", { name: "Steps" }).getByRole("button").last();
  await expect(description).toHaveAccessibleName("Description");
  await description.click();

  const name = builder.getByLabel("Character Name");
  await name.fill("Brannor Ironfist");
  await name.press("Enter");
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText("Brannor Ironfist");

  await builder.getByLabel("Experience Points").fill("900");
  await builder.getByRole("heading", { name: "Description" }).click();
  await expect(preview.getByLabel("XP", { exact: true })).toHaveText("900");
});

test("fighter-1 built from New character through the steps matches its expected values", async ({ page }) => {
  // The picks of fighter-1.strict.json. The golden test (parity.test.ts) checks the whole entity.
  const expected = JSON.parse(readFileSync(join(charactersDir, "fighter-1.expected.json"), "utf8"));
  await page.goto("/");
  await page.getByRole("button", { name: "New character" }).click();
  await expect(page).toHaveURL(/\/build\/[0-9a-f-]+$/);
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = page.getByRole("region", { name: "Preview" });
  const card = (name: string) => builder.getByRole("button", { name, exact: true });
  const pick = async (...names: string[]) => {
    for (const name of names) {
      await card(name).click();
      await expect(card(name)).toHaveAttribute("aria-pressed", "true");
    }
  };

  // The human knows one language more; the acolyte opens two more.
  await pick("Human", "Damaran", "Standard Human", "Dwarvish");
  await stepButton(page, "Background").click();
  await pick("Lawful Good", "Acolyte", "Elvish", "Giant");
  await stepButton(page, "Class").click();
  await builder.getByLabel("Class 1", { exact: true }).selectOption("Fighter");
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Fighter 1");
  await pick("Defense", "Athletics", "Perception");
  // The standard scores are the default.
  await stepButton(page, "Abilities").click();
  await expect(builder.getByRole("button", { name: "Standard Scores" })).toHaveAttribute("aria-pressed", "true");
  await stepButton(page, "Equipment").click();
  // The starting equipment of the class and the background is on this step.
  await pick("Amulet", "Prayer Book", "Chain Mail", "Martial Weapon and Shield", "Longsword", "Two Handaxes", "Dungeoneer's Pack");
  await builder.getByLabel("Worn armor").selectOption("Chain mail");
  await builder.getByLabel("Wielded shield").selectOption("Shield");
  // The main hand sets the off hand to none. The golden has the shield there, but the
  // off-hand list offers only dual-wield weapons. The values below do not change.
  await builder.getByLabel("Main hand").selectOption("Longsword");
  await stepButton(page, "Description").click();
  const name = builder.getByLabel("Character Name");
  await name.fill(expected["character-name"]);
  await name.press("Enter");

  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(expected["character-name"]);
  // The worn chain mail and the wielded shield: 19.
  const worn = expected["armor-class-with-armor"].find((o: { armor: string; shield: string }) => o.armor === "chain-mail" && o.shield === "shield");
  await expect(preview.getByLabel("Armor Class", { exact: true })).toHaveText(String(worn.ac));
  const hp = expected["max-hit-points"];
  await expect(preview.getByLabel("Hit Points", { exact: true })).toHaveText(`${hp} / ${hp}`);
  const longsword = expected["weapon-modifiers"].longsword;
  const row = preview.getByRole("table", { name: "Weapon attacks" }).getByRole("row", { name: /^Longsword / });
  await expect(row.getByRole("cell")).toHaveText(["Longsword", "Yes", `+${longsword["best-attack"]} to hit`, `+${longsword["best-damage"]}`]);
});
