import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");
const readFixture = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));

const srdGolden = readdirSync(charactersDir)
  .filter((file) => file.endsWith(".meta.json"))
  .map((file) => file.slice(0, -".meta.json".length))
  .filter((name) => readFixture(`${name}.meta.json`).orcbrew.length === 0);

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

    await page.goto("/import");
    await page.getByLabel("Import character file").setInputFiles(join(charactersDir, `${name}.strict.json`));

    await expect(page.getByRole("heading", { level: 1, name: built["character-name"] })).toBeVisible();
    await expect(page.getByLabel("Armor Class", { exact: true })).toHaveText(String(worn.ac));
    const hp = built["max-hit-points"];
    await expect(page.getByLabel("Hit Points", { exact: true })).toHaveText(`${built["current-hit-points"] ?? hp} / ${hp}`);
  });
}

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
