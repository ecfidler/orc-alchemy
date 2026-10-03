import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const fixturesDir = join(import.meta.dirname, "../../../fixtures");
const strictFiles = ["characters", "legacy"].flatMap((dir) =>
  readdirSync(join(fixturesDir, dir))
    .filter((file) => file.endsWith(".strict.json"))
    .map((file) => `${dir}/${file}`),
);
const readJson = (file: string) => JSON.parse(readFileSync(join(fixturesDir, file), "utf8"));

for (const file of strictFiles) {
  test(`${file} imports and opens its sheet`, async ({ page }) => {
    const name = readJson(file.replace(".strict.json", ".expected.json"))["character-name"];

    await page.goto("/");
    await page.getByLabel("Import character file").setInputFiles(join(fixturesDir, file));

    await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1, name: name || "Unnamed character" })).toBeVisible();
  });
}

test("a dmv-export bundle lists its characters to open", async ({ page }) => {
  const bundle = {
    format: "dmv-export",
    version: 1,
    characters: [readJson("characters/fighter-1.strict.json"), readJson("characters/wizard-5.strict.json")],
    magicItems: [],
  };

  await page.goto("/");
  await page.getByLabel("Import character file").setInputFiles({
    name: "dmv-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await expect(page.getByRole("heading", { name: "Imported 2 characters" })).toBeVisible();
  await page.getByRole("button", { name: "Fimble Nackle" }).click();

  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Fimble Nackle" })).toBeVisible();
});

test("a dmv-character envelope opens its sheet", async ({ page }) => {
  const envelope = { format: "dmv-character", version: 1, rules: "2014", entity: readJson("characters/wizard-5.strict.json") };

  await page.goto("/");
  await page.getByLabel("Import character file").setInputFiles({
    name: "fimble.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(envelope)),
  });

  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Fimble Nackle" })).toBeVisible();
});

test("a bundle lists the characters that import and the ones that fail", async ({ page }) => {
  const bundle = { format: "dmv-export", version: 1, characters: [readJson("characters/fighter-1.strict.json"), {}] };

  await page.goto("/");
  await page.getByLabel("Import character file").setInputFiles({
    name: "dmv-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bundle)),
  });

  await expect(page.getByRole("heading", { name: "Imported 1 character" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Brannor Ironfist" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText("Character 2 of 2: This is not a character file");
});

test("a file that is not a character says why", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Import character file").setInputFiles({
    name: "other.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"foo":1}'),
  });

  await expect(page.getByRole("alert")).toHaveText("This is not a character file");
  await expect(page).toHaveURL("/");
});
