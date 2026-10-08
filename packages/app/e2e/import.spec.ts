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

// With no homebrew loaded, a fixture has unresolved keys when its meta file lists some or names a pack.
const hasUnresolved = (file: string) => {
  const meta = readJson(file.replace(".strict.json", ".meta.json"));
  return meta.unresolved !== undefined || meta.orcbrew.length > 0;
};

for (const file of strictFiles) {
  test(`${file} imports and opens its sheet`, async ({ page }) => {
    const name = readJson(file.replace(".strict.json", ".expected.json"))["character-name"] || "Unnamed character";

    await page.goto("/import");
    await page.getByLabel("Import character file").setInputFiles(join(fixturesDir, file));

    if (hasUnresolved(file)) {
      await expect(page.getByRole("list", { name: `Unresolved content for ${name}` })).toBeVisible();
      await page.getByRole("button", { name, exact: true }).click();
    }
    await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });
}

for (const [file, keys] of [
  ["characters/ironwrought-artificer-3.strict.json", ["Race: ironwrought", "Subrace: envoy", "Class: artificer", "Subclass: alchemist"]],
  ["characters/warlock-10-drow.strict.json", ["Subrace: dark-elf-drow-", "Background: spy", "Feat: keen-mind", "Subclass: the-archfey"]],
  ["legacy/r8-unresolved-keys.strict.json", ["Race: ironwrought", "Subrace: envoy", "Class: artificer", "Subclass: alchemist"]],
  ["legacy/character-test-2.strict.json", ["Subclass: eldritch-knight", "Background: noble", "Feat: ritual-caster"]],
] as const) {
  test(`${file} lists its unresolved keys`, async ({ page }) => {
    const name = readJson(file.replace(".strict.json", ".expected.json"))["character-name"] || "Unnamed character";

    await page.goto("/import");
    await page.getByLabel("Import character file").setInputFiles(join(fixturesDir, file));

    const list = page.getByRole("list", { name: `Unresolved content for ${name}` });
    for (const key of keys) await expect(list.getByRole("listitem").filter({ hasText: `${key} (` })).toHaveCount(1);
    await expect(page).toHaveURL("/import");
  });
}

test("an SRD character opens its sheet with no unresolved content", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles(join(fixturesDir, "characters/fighter-1.strict.json"));

  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeVisible();
  await expect(page.getByRole("list", { name: /^Unresolved content/ })).toHaveCount(0);
});

test("a dmv-export bundle lists its characters to open", async ({ page }) => {
  const bundle = {
    format: "dmv-export",
    version: 1,
    characters: [readJson("characters/fighter-1.strict.json"), readJson("characters/wizard-5.strict.json")],
    magicItems: [],
  };

  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles({
    name: "dmv-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bundle)),
  });
  await expect(page.getByRole("heading", { name: "Imported 2 characters" })).toBeVisible();
  await page.getByRole("button", { name: "Fimble Nackle", exact: true }).click();

  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: "Fimble Nackle" })).toBeVisible();
});

test("a dmv-character envelope opens its sheet", async ({ page }) => {
  const envelope = { format: "dmv-character", version: 1, rules: "2014", entity: readJson("characters/wizard-5.strict.json") };

  await page.goto("/import");
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

  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles({
    name: "dmv-export.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(bundle)),
  });

  await expect(page.getByRole("heading", { name: "Imported 1 character" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Brannor Ironfist", exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText("Character 2 of 2: This is not a character file");
});

test("a file that is not a character says why", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Import character file").setInputFiles({
    name: "other.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"foo":1}'),
  });

  await expect(page.getByRole("alert")).toHaveText("This is not a character file");
  await expect(page).toHaveURL("/import");
});
