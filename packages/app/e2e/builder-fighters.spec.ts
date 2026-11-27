// The fighter fixtures of fixtures/characters made in the builder, in a browser: fighter-1 by hand and through the
// steps, and fighter-20 equipped on the Equipment step.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pickOption } from "@orc-alchemy/ui/testing/playwright";
import { expect, test } from "@playwright/test";
import { addFirstClass, newCharacter, openStep, pickIn, picksIn, section, stepButton } from "./builder-helpers.ts";
import { openSheetPanel, summaryCard } from "./sheet-panel.ts";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");

test("fighter-1's scores by hand: a standard human with the standard scores, then a swap and point buy", async ({ page }) => {
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const str = summaryCard(page).getByLabel("STR", { exact: true });
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Human");
  await pickIn(section(page, "Subrace"), "Damaran");
  await builder.getByRole("button", { name: "Standard Human", exact: true }).click();
  await expect(builder.getByRole("button", { name: "Standard Human", exact: true })).toHaveAttribute("aria-pressed", "true");

  await stepButton(page, "Abilities").click();
  await expect(builder.getByRole("button", { name: "Standard Scores" })).toHaveAttribute("aria-pressed", "true");
  const scores = section(page, "Base Ability Scores");
  const total = scores.locator("[data-total]");
  await expect(total).toHaveText(["Total 16", "Total 15", "Total 14", "Total 13", "Total 11", "Total 9"]);
  await expect(scores.locator("[data-token]")).toHaveText(Array(6).fill("+1 Race"));
  await expect(str).toHaveText("16 +3");

  // STR and DEX change places: two clicks on their chips (ORC-345).
  await scores.getByRole("button", { name: /^Strength base score/ }).click();
  await scores.getByRole("button", { name: /^Dexterity base score/ }).click();
  await expect(total).toHaveText(["Total 15", "Total 16", "Total 14", "Total 13", "Total 11", "Total 9"]);
  await expect(str).toHaveText("15 +2");

  // Point buy starts every score at 8, and an increase spends points.
  await builder.getByRole("button", { name: "Point Buy" }).click();
  await expect(total).toHaveText(Array(6).fill("Total 9"));
  await expect(scores.locator("[data-strip]")).toHaveText("27 of 27 points left");
  await scores.getByRole("button", { name: "Increase Constitution" }).click();
  await expect(total).toHaveText(["Total 9", "Total 9", "Total 10", "Total 9", "Total 9", "Total 9"]);
  await expect(scores.locator("[data-strip]")).toHaveText("26 of 27 points left");
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
  await page.getByRole("link", { name: "Edit", exact: true }).click();
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = summaryCard(page);
  const ac = preview.getByLabel("Armor Class", { exact: true });
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Fighter 20");
  await expect(ac).toHaveText("18");
  await stepButton(page, "Equipment").click();

  await pickOption(builder.getByLabel("Add an item to Armor"), "Plate");
  await expect(builder.getByRole("checkbox", { name: "Carried: Plate" })).toBeChecked();
  await pickOption(builder.getByLabel("Add an item to Magic Weapons"), "Longsword +1");
  await pickOption(builder.getByLabel("Add an item to Other Magic Items"), "Amulet of Health");
  await pickOption(builder.getByLabel("Worn armor"), "Plate");
  await pickOption(builder.getByLabel("Wielded shield"), "Shield");
  await pickOption(builder.getByLabel("Main hand"), "Longsword +1");
  await builder.getByRole("checkbox", { name: "Attuned: Amulet of Health" }).check();

  await expect(ac).toHaveText("20");
  await expect(preview.getByLabel("Hit points", { exact: true })).toHaveText("204");
  const panel = await openSheetPanel(page);
  const longsword = panel.getByRole("table", { name: "Weapon attacks" }).getByRole("row", { name: /^Longsword 1 / });
  // The panel is narrower than 720px, so it has no Proficient? column (ORC-176).
  await expect(longsword.getByRole("cell")).toHaveText(["Longsword 1", "+12 to hit", "+6"]);
});

test("fighter-1 built from New character through the steps matches its expected values", async ({ page }) => {
  // The picks of fighter-1.strict.json. The golden test (parity.test.ts) checks the whole entity.
  const expected = JSON.parse(readFileSync(join(charactersDir, "fighter-1.expected.json"), "utf8"));
  await newCharacter(page);
  const builder = page.getByRole("region", { name: "Builder" });
  const preview = summaryCard(page);
  const card = (name: string) => builder.getByRole("button", { name, exact: true });
  const pick = async (...names: string[]) => {
    for (const name of names) {
      await card(name).click();
      await expect(card(name)).toHaveAttribute("aria-pressed", "true");
    }
  };

  // The name first, on the step that a new character opens on.
  const name = builder.getByRole("textbox", { name: "Character name" });
  await expect(name).toBeFocused();
  await name.fill(expected["character-name"]);
  await name.press("Enter");
  await expect(builder.getByRole("heading", { level: 2 })).toHaveText("Class");
  await openStep(page, "Race");
  await pickIn(section(page, "Race"), "Human");
  await pickIn(section(page, "Subrace"), "Damaran");
  await pick("Standard Human");
  await openStep(page, "Background");
  await pickIn(section(page, "Background"), "Acolyte");
  await addFirstClass(page, "Fighter");
  await expect(preview.getByLabel("Class", { exact: true })).toHaveText("Fighter 1");
  await pick("Defense");
  // The human knows one language more and the acolyte two more: one selection, with the fighter's skills.
  await stepButton(page, "Proficiencies").click();
  for (const language of ["Dwarvish", "Elvish", "Giant"]) await pickIn(section(page, "Languages"), language);
  for (const skill of ["Athletics", "Perception"]) await pickIn(section(page, "Skills: Fighter"), skill);
  await expect(picksIn(section(page, "Languages"))).toHaveText(["Dwarvish", "Elvish", "Giant"]);
  await expect(picksIn(section(page, "Skills: Fighter"))).toHaveText(["Athletics", "Perception"]);
  // The standard scores are the default.
  await stepButton(page, "Abilities").click();
  await expect(builder.getByRole("button", { name: "Standard Scores" })).toHaveAttribute("aria-pressed", "true");
  await stepButton(page, "Equipment").click();
  // The starting equipment of the class and the background is on this step.
  await pick("Amulet", "Prayer Book", "Chain Mail", "Martial Weapon and Shield");
  // The martial weapon is one pick of 27: a list behind a Choose button, with a search field.
  await pickIn(section(page, "Starting Equipment: Martial Weapon"), "Longsword");
  await pick("Two Handaxes", "Dungeoneer's Pack");
  await pickOption(builder.getByLabel("Worn armor"), "Chain mail");
  await pickOption(builder.getByLabel("Wielded shield"), "Shield");
  // The main hand sets the off hand to none. The golden has the shield there, but the
  // off-hand list offers only dual-wield weapons. The values below do not change.
  await pickOption(builder.getByLabel("Main hand"), "Longsword");
  await stepButton(page, "Description").click();
  // Alignment is the first field, a select (ORC-352).
  const alignment = builder.getByRole("combobox", { name: /^Alignment/ });
  await pickOption(alignment, "Lawful Good");
  await expect(alignment).toHaveText("Lawful Good");

  await expect(preview.getByLabel("Name", { exact: true })).toHaveText(expected["character-name"]);
  // The worn chain mail and the wielded shield: 19.
  const worn = expected["armor-class-with-armor"].find((o: { armor: string; shield: string }) => o.armor === "chain-mail" && o.shield === "shield");
  await expect(preview.getByLabel("Armor Class", { exact: true })).toHaveText(String(worn.ac));
  const hp = expected["max-hit-points"];
  await expect(preview.getByLabel("Hit points", { exact: true })).toHaveText(String(hp));
  const longsword = expected["weapon-modifiers"].longsword;
  const panel = await openSheetPanel(page);
  const row = panel.getByRole("table", { name: "Weapon attacks" }).getByRole("row", { name: /^Longsword / });
  // The panel is narrower than 720px, so it has no Proficient? column (ORC-176).
  await expect(row.getByRole("cell")).toHaveText(["Longsword", `+${longsword["best-attack"]} to hit`, `+${longsword["best-damage"]}`]);
});
