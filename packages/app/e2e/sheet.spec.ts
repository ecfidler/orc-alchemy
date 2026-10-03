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
  await page.goto("/");
  await page.getByLabel("Import character file").setInputFiles(join(charactersDir, "fighter-1.strict.json"));

  await expect(page).toHaveURL("/sheet");
  await expect(page.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeVisible();
  await expect(page.getByLabel("Armor Class", { exact: true })).toHaveText("19");
  await expect(page.getByLabel("Hit Points", { exact: true })).toHaveText("12 / 12");
});

for (const name of srdGolden) {
  test(`${name} renders its expected name, AC and HP`, async ({ page }) => {
    const built = readFixture(`${name}.expected.json`);
    const worn = built["armor-class-with-armor"].find(
      (o: { armor: string | null; shield: string | null }) =>
        o.armor === built["worn-armor"] && o.shield === built["wielded-shield"],
    );

    await page.goto("/");
    await page.getByLabel("Import character file").setInputFiles(join(charactersDir, `${name}.strict.json`));

    await expect(page.getByRole("heading", { level: 1, name: built["character-name"] })).toBeVisible();
    await expect(page.getByLabel("Armor Class", { exact: true })).toHaveText(String(worn.ac));
    const hp = built["max-hit-points"];
    await expect(page.getByLabel("Hit Points", { exact: true })).toHaveText(`${built["current-hit-points"] ?? hp} / ${hp}`);
  });
}
