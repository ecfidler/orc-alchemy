import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Download } from "@playwright/test";

const orcbrewDir = join(import.meta.dirname, "../../../fixtures/orcbrew");

test("a chosen homebrew pack is listed until it is removed", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Load homebrew file").setInputFiles(join(orcbrewDir, "warlock-test-content.orcbrew"));

  const pack = page.getByRole("listitem", { name: "warlock-test-content" });
  await expect(pack).toBeVisible();
  await expect(page.getByRole("region", { name: "Import log" })).toContainText("Import successful");

  await pack.getByRole("button", { name: "Remove warlock-test-content" }).click();
  await expect(pack).toHaveCount(0);
});

test("a loaded pack and its enabled flag survive a reload", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Load homebrew file").setInputFiles(join(orcbrewDir, "warlock-test-content.orcbrew"));
  const enabled = page.getByRole("listitem", { name: "warlock-test-content" }).getByRole("checkbox", { name: "warlock-test-content" });
  await expect(enabled).toBeChecked();

  await page.reload();
  await expect(enabled).toBeChecked();
  // The checkbox changes once the flag is stored, so check it after the click.
  await enabled.click();
  await expect(enabled).not.toBeChecked();

  await page.reload();
  await expect(enabled).not.toBeChecked();
});

const fixturesDir = join(import.meta.dirname, "../../../fixtures");
const readJson = (file: string) => JSON.parse(readFileSync(join(fixturesDir, file), "utf8"));
const bonusStr = (n: number) => (n > 0 ? `+${n}` : `${n}`);

// ORC-54: a character whose content is all in its pack opens its sheet, which shows the oracle's values.
test("a homebrew golden character, imported after its pack, shows its expected.json values", async ({ page }) => {
  const built = readJson("characters/ironwrought-artificer-3.expected.json");
  await page.goto("/import");
  await page.getByLabel("Load homebrew file").setInputFiles(join(orcbrewDir, "duplicate-external-b.orcbrew"));
  await expect(page.getByRole("listitem", { name: "duplicate-external-b" })).toBeVisible();
  await page.getByLabel("Import character file").setInputFiles(join(fixturesDir, "characters/ironwrought-artificer-3.strict.json"));

  await expect(page).toHaveURL(/\/sheet\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { level: 1, name: built["character-name"] })).toBeVisible();
  await expect(page.getByLabel("Hit Points")).toHaveText(`${built["max-hit-points"]} / ${built["max-hit-points"]}`);
  await expect(page.getByLabel("Proficiency Bonus")).toHaveText(bonusStr(built["proficiency-bonus"]));
  await expect(page.getByLabel("Passive Perception")).toHaveText(String(built["passive-perception"]));
  for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
    const key = `orcpub.dnd.e5.character/${ability}`;
    await expect(page.getByLabel(ability.toUpperCase(), { exact: true })).toHaveText(`${built.abilities[key]}${bonusStr(built["ability-bonuses"][key])}`);
  }
  const worn = built["armor-class-with-armor"].find((o: { armor: string | null }) => o.armor === built["worn-armor"]);
  await expect(page.getByLabel("Armor Class")).toHaveText(String(worn.ac));
});

test("Export everything writes the packs, and its bundle restores them and the characters in an empty browser", async ({ page, browser }) => {
  await page.goto("/import");
  await page.getByLabel("Load homebrew file").setInputFiles(join(orcbrewDir, "warlock-test-content.orcbrew"));
  const enabled = page.getByRole("listitem", { name: "warlock-test-content" }).getByRole("checkbox", { name: "warlock-test-content" });
  await enabled.click();
  await expect(enabled).not.toBeChecked();
  await page.getByLabel("Import character file").setInputFiles(join(fixturesDir, "characters/fighter-1.strict.json"));
  await expect(page).toHaveURL(/\/sheet\//);
  await page.goto("/");

  const downloads: Download[] = [];
  page.on("download", (d) => downloads.push(d));
  await page.getByRole("button", { name: "Export everything" }).click();
  await expect.poll(() => downloads.map((d) => d.suggestedFilename()).sort()).toEqual(["all-content.orcbrew", "dmv-export.json"]);
  const bundlePath = await downloads.find((d) => d.suggestedFilename() === "dmv-export.json")!.path();
  const orcbrewPath = await downloads.find((d) => d.suggestedFilename() === "all-content.orcbrew")!.path();

  const empty = await (await browser.newContext()).newPage();
  await empty.goto("/import");
  await empty.getByLabel("Import dmv-export bundle").setInputFiles({ name: "dmv-export.json", mimeType: "application/json", buffer: readFileSync(bundlePath) });
  await expect(empty.getByText("Loaded 1 homebrew pack")).toBeVisible();
  const imported = empty.getByRole("region", { name: "Imported characters" });
  await expect(imported.getByRole("button", { name: "Brannor Ironfist", exact: true })).toBeVisible();
  const restored = empty.getByRole("listitem", { name: "warlock-test-content" }).getByRole("checkbox", { name: "warlock-test-content" });
  await expect(restored).not.toBeChecked();

  // The .orcbrew file is the old app's all-content export: it loads as a pack file.
  const other = await (await browser.newContext()).newPage();
  await other.goto("/import");
  await other.getByLabel("Load homebrew file").setInputFiles({ name: "all-content.orcbrew", mimeType: "application/edn", buffer: readFileSync(orcbrewPath) });
  await expect(other.getByRole("listitem", { name: "warlock-test-content" })).toBeVisible();
});

// ORC-70: the conflict step stores nothing until each conflict has a choice.
test("a pack with key conflicts loads after Rename all and Apply", async ({ page }) => {
  await page.goto("/import");
  await page.getByLabel("Load homebrew file").setInputFiles(join(orcbrewDir, "duplicate-external-a.orcbrew"));
  await expect(page.getByRole("listitem", { name: "duplicate-external-a" })).toBeVisible();
  await page.getByLabel("Load homebrew file").setInputFiles(join(orcbrewDir, "duplicate-external-b.orcbrew"));

  const conflicts = page.getByRole("region", { name: "Resolve key conflicts" });
  await expect(conflicts.getByRole("group")).toHaveCount(4);
  await expect(page.getByRole("listitem", { name: "duplicate-external-b" })).toHaveCount(0);
  await conflicts.getByRole("button", { name: "Rename all" }).click();
  await conflicts.getByRole("button", { name: "Apply and import" }).click();

  await expect(page.getByRole("listitem", { name: "duplicate-external-b" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Import log" })).toContainText("Key renames (4)");
});
