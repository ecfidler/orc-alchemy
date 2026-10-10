import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");
const readFixture = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));
const magicItemsDir = join(import.meta.dirname, "../../../fixtures/magic-items");

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

test("wizard-1 marks its prepared spells", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "wizard-1.strict.json"));

  const first = page.getByRole("table", { name: "1st Level" });
  await expect(first.getByRole("row", { name: /^Alarm / })).toContainText("Yes");
  await expect(first.getByRole("row", { name: /^Detect Magic / })).toContainText("—");
  await expect(first.getByRole("cell", { name: "Yes" })).toHaveCount(4);
});

test("without IndexedDB, import still opens the sheet and a notice says nothing is saved", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "indexedDB", { value: undefined }));
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-1.strict.json"));

  await expect(page.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText(/kept only until you close this tab/);
});
