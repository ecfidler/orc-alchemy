import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");
const readFixture = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));
const magicItemsDir = join(import.meta.dirname, "../../../fixtures/magic-items");
const orcbrewDir = join(import.meta.dirname, "../../../fixtures/orcbrew");

const srdGolden = readdirSync(charactersDir)
  .filter((file) => file.endsWith(".meta.json"))
  .map((file) => file.slice(0, -".meta.json".length))
  .filter((name) => readFixture(`${name}.meta.json`).orcbrew.length === 0);

/**
 * Imports a golden and opens its sheet. A golden with custom magic items goes
 * in a dmv-export bundle with its meta's items file, as the exporter
 * bookmarklet writes it, so the items load before the character.
 */
async function importGolden(page: Page, name: string) {
  const itemsFile: string | undefined = readFixture(`${name}.meta.json`).magicItems;
  await page.goto("/import");
  if (itemsFile === undefined) {
    await page.getByLabel("Import character file").setInputFiles(join(charactersDir, `${name}.strict.json`));
    return;
  }
  const bundle = {
    format: "dmv-export",
    version: 1,
    characters: [readFixture(`${name}.strict.json`)],
    magicItems: [readFileSync(join(magicItemsDir, itemsFile), "utf8")],
  };
  await page.getByLabel("Import dmv-export bundle").setInputFiles({ name: "dmv-export.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(bundle)) });
  await page.getByRole("button", { name: readFixture(`${name}.expected.json`)["character-name"], exact: true }).click();
}

test("importing fighter-1 opens its sheet", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-1.strict.json"));

  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeVisible();
  await expect(page.getByLabel("Armor Class", { exact: true })).toHaveText("19");
  await expect(page.getByLabel("Hit Points", { exact: true })).toHaveText("12 / 12");
});

test("an imported character survives reload", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-1.strict.json"));
  await expect(page.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeVisible();
  await expect(page.getByLabel("Armor Class", { exact: true })).toHaveText("19");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

for (const name of srdGolden) {
  test(`${name} renders its expected name, AC and HP`, async ({ page }) => {
    const built = readFixture(`${name}.expected.json`);
    const worn = built["armor-class-with-armor"].find(
      (o: { armor: string | null; shield: string | null }) =>
        o.armor === built["worn-armor"] && o.shield === built["wielded-shield"],
    );

    await importGolden(page, name);

    await expect(page.getByRole("heading", { level: 1, name: built["character-name"] })).toBeVisible();
    await expect(page.getByLabel("Armor Class", { exact: true })).toHaveText(String(worn.ac));
    const hp = built["max-hit-points"];
    await expect(page.getByLabel("Hit Points", { exact: true })).toHaveText(`${built["current-hit-points"] ?? hp} / ${hp}`);
  });
}

test("a bundle's custom magic items load, and the sheet shows the ones the character equips", async ({ page }) => {
  await importGolden(page, "fighter-5-custom-magic-items");

  await expect(page.getByRole("heading", { level: 1, name: "Durga Anvilmar" })).toBeVisible();
  await expect(page.getByRole("list", { name: /^Unresolved content/ })).toHaveCount(0);
  // Emberbrand adds 1 to hit and 2 damage, and fire resistance. The sheet names armor from its key.
  await expect(page.getByRole("table", { name: "Weapon attacks" }).getByRole("row", { name: "Emberbrand Longsword Yes +8 to hit +8" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Armor class options" }).getByRole("row", { name: "Wardens Plate 20" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "Fire" })).toBeVisible();
});

test("wizard-1 lists its prepared spells, and its High Elf cantrip on one line", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "wizard-1.strict.json"));

  const spells = page.getByRole("table", { name: "Spells by level" });
  await expect(spells.getByRole("columnheader", { name: "Prepared spells" })).toBeVisible();
  await expect(spells.getByRole("row", { name: /^1st / }).getByRole("listitem")).toHaveText(["Alarm", "Burning Hands", "Charm Person", "Color Spray"]);
  // A race with only a cantrip has no boxes and no tags (ORC-176).
  await expect(page.getByRole("listitem").filter({ hasText: "(High Elf, INT, DC 13, +5)" })).toHaveText("Minor Illusion (High Elf, INT, DC 13, +5)");
});

test("without IndexedDB, import still opens the sheet and a notice says nothing is saved", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "indexedDB", { value: undefined }));
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-1.strict.json"));

  await expect(page.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText(/kept only until you close this tab/);
});

test("a long name gets smaller and wraps to two lines, and the name box keeps its height", async ({ page }) => {
  const name = "Brannor Ironfist";
  const heading = page.getByRole("heading", { level: 1 });
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-1.strict.json"));
  await expect(heading).toHaveText(name);
  const short = await heading.evaluate((element) => ({ height: element.clientHeight, size: parseFloat(getComputedStyle(element).fontSize) }));

  const long = `${name} the Unbroken, Shield of the Northern Marches`;
  const file = readFileSync(join(charactersDir, "fighter-1.strict.json"), "utf8").replace(`"${name}"`, JSON.stringify(long));
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles({ name: "long.json", mimeType: "application/json", buffer: Buffer.from(file) });
  await expect(heading).toHaveText(long);
  const fitted = await heading.evaluate((element) => ({
    height: element.clientHeight,
    size: parseFloat(getComputedStyle(element).fontSize),
    wraps: getComputedStyle(element).whiteSpace === "normal",
    overflows: element.scrollWidth > element.clientWidth,
  }));
  expect(fitted.height).toBe(short.height);
  expect(fitted.size).toBeLessThan(short.size);
  expect(fitted.wraps).toBe(true);
  expect(fitted.overflows).toBe(false);
});

test("a long class truncates, and the proficiencies and AC by armor are in the left column under Equipment", async ({ page }) => {
  // The header columns size from their content (ORC-176), so the class is cut only on a narrower sheet.
  await page.setViewportSize({ width: 1024, height: 720 });
  await importGolden(page, "fighter-3-wizard-2");
  const classes = page.getByLabel("Class", { exact: true });
  await expect(classes).toHaveAttribute("title", "Fighter 3 (Champion) / Wizard 2 (School of Evocation)");
  expect(await classes.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  const box = (name: string) => page.getByRole("group", { name, exact: true }).boundingBox();
  const equipment = (await box("Equipment"))!;
  const proficiencies = (await box("Other proficiencies & languages"))!;
  const armor = (await box("AC by armor"))!;
  const attacks = (await box("Attacks"))!;
  expect(proficiencies.x).toBe(equipment.x);
  expect(proficiencies.y).toBeGreaterThan(equipment.y);
  expect(armor.y).toBeGreaterThan(proficiencies.y);
  expect(attacks.x).toBeGreaterThan(equipment.x);
});

// ORC-176: a Tiefling Warlock 20 from the level 20 audit, with a source tag on each spell. Its spell list made the
// page scroll sideways.
for (const width of [1440, 1024, 800, 390, 360]) {
  test(`warlock-20 does not scroll sideways at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/import");
    await page.getByLabel("Import character file").setInputFiles(join(import.meta.dirname, "warlock-20.strict.json"));
    await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
    const tabs = width < 760 ? await page.getByRole("tab").allTextContents() : [];
    for (const tab of tabs.length > 0 ? tabs : [null]) {
      if (tab) await page.getByRole("tab", { name: tab }).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `${tab ?? "sheet"} tab`).toBeLessThanOrEqual(width);
    }
  });
}

const SCALED_USES = "scaled-uses-fighter-6-barbarian-1";

/** Loads scaled-uses.orcbrew, then imports its golden character and opens the sheet. */
async function importScaledUses(page: Page) {
  await page.goto("/import");
  await page.getByLabel("Load homebrew file").setInputFiles(join(orcbrewDir, "scaled-uses.orcbrew"));
  await expect(page.getByRole("region", { name: "Import log" })).toBeVisible();
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, `${SCALED_USES}.strict.json`));
  await expect(page.getByRole("heading", { level: 1, name: readFixture(`${SCALED_USES}.expected.json`)["character-name"] })).toBeVisible();
}

/** The feature names under a heading of "Features & traits": each bubble's title, or a plain feature's bold name. */
const sectionNames = (page: Page, title: string) =>
  page.getByRole("heading", { level: 3, name: title, exact: true }).locator("..").locator(".ui-use-bubble-title, p > b").allTextContents();

// ORC-203: the engine puts every pack feature in traits; the sheet sorts them by type.
test("scaled-uses shows its typed pack features in the Actions, Bonus Actions and Reactions sections", async ({ page }) => {
  await importScaledUses(page);
  expect(await sectionNames(page, "Actions")).toEqual(["Action Surge", "Crashing Wave", "Stormcaller", "Undertow"]);
  expect(await sectionNames(page, "Bonus Actions")).toEqual(["Ebb and Flow", "Rage", "Rolling Gait", "Second Wind", "Tide Step"]);
  expect(await sectionNames(page, "Reactions")).toEqual(["Brine Ward"]);
  expect(await sectionNames(page, "Features, Traits, and Feats")).toEqual([
    "Deep Lungs",
    "Defense Fighting Style",
    "Riptide",
    "Salt Sense",
    "Sea Legs",
    "Shelter the Faithful",
    "Steady Footing",
  ]);
  await expect(page.getByRole("group", { name: "Crashing Wave" }).getByRole("button", { name: "30 / 30 left. Spend 5" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Brine Ward" }).getByRole("button", { name: "Use 1" })).toBeVisible();
  // Undertow resolves to -1 uses: no bubble.
  await expect(page.getByRole("group", { name: "Undertow" })).toHaveCount(0);
});

// Screenshots for the PR: PR_SCREENSHOTS=1 bun run e2e -- sheet.spec.ts -g orc-203
test.describe("screenshots", () => {
  test.skip(!process.env.PR_SCREENSHOTS, "Set PR_SCREENSHOTS=1 to take the PR screenshots.");
  test.use({ deviceScaleFactor: 2 });
  const dir = join(import.meta.dirname, "../../../pr-screenshots");
  for (const theme of ["light", "dark"] as const) {
    test(`orc-203 scaled-uses sheet, ${theme}`, async ({ page }) => {
      mkdirSync(dir, { recursive: true });
      const shot = (what: string) => join(dir, `orc-203-${what}-${theme}.png`);
      await page.addInitScript((theme) => localStorage.setItem("theme", theme), theme);

      await page.setViewportSize({ width: 1280, height: 900 });
      await importScaledUses(page);
      await page.evaluate(() => document.fonts.ready);
      await page.getByRole("group", { name: "Features & traits" }).screenshot({ path: shot("sheet-features") });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole("tab", { name: "Features" }).click();
      await page.getByRole("tabpanel").getByRole("heading", { level: 3, name: "Actions", exact: true }).waitFor();
      await page.screenshot({ path: shot("phone-features"), fullPage: true });
    });
  }
});
