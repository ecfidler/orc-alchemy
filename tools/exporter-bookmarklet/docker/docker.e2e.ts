// The exporter bookmarklet against the old app in Docker (ORC-67).
//
// Run it:
//   - In GitHub Actions, on demand:
//       gh workflow run bookmarklet-docker.yml --ref <branch>
//   - Locally, with Docker: bring the old app up from an ecfidler/orcpub
//     checkout (tag pubdoor-v0.3.0) as .github/workflows/bookmarklet-docker.yml
//     does, so that it serves https://localhost and has the user testadmin
//     with password SecurePass123. Start from an empty database
//     (`docker compose down -v`), because the test adds the characters. Then:
//       cd packages/app
//       bunx playwright test -c ../../tools/exporter-bookmarklet/docker/docker.config.ts
//     OLD_APP_URL sets a different address for the old app.
//
// The test saves the SRD golden characters to the old server by POST, logs in
// through the old app's login form, saves the old builder's new character
// through its UI, runs the bookmarklet, and checks the bundle it downloads:
// in Node with the engine, and in the app's Import page and sheet.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, request, test } from "@playwright/test";
import { emptyCharacter, evaluate, importCharacter, readServerEdn } from "@pubdoor/dmv";

const oldApp = process.env.OLD_APP_URL ?? "https://localhost";
const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");
const readJson = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));
const bookmarklet = readFileSync(join(import.meta.dirname, "../bookmarklet.js"), "utf8");

// The golden characters that need no homebrew and no custom magic items (those come in ORC-77).
// The old server's schema has no attuned-magic-items attribute, and the old UI never sets it
// (its attune event is commented out), so a golden that holds it cannot be saved there.
const goldens = readdirSync(charactersDir)
  .filter((file) => file.endsWith(".meta.json"))
  .map((file) => file.slice(0, -".meta.json".length))
  .filter((name) => {
    const meta = readJson(`${name}.meta.json`);
    const attuned = readFileSync(join(charactersDir, `${name}.strict.json`), "utf8").includes("attuned-magic-items");
    return meta.orcbrew.length === 0 && meta.magicItems === undefined && !attuned;
  });
const expected = new Map(goldens.map((name) => [name, readJson(`${name}.expected.json`)]));
const nameOf = (golden: string): string => expected.get(golden)["character-name"];

test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: oldApp, ignoreHTTPSErrors: true });
  const login = await api.post("/login", { data: { username: "testadmin", password: "SecurePass123" } });
  const loginBody = await login.text();
  expect(login.status(), loginBody).toBe(200);
  // The old server answers in EDN: {:token "<jwt>" ...}.
  const token = /:token\s+"([^"]+)"/.exec(loginBody)![1];

  for (const golden of goldens) {
    const saved = await api.post("/dnd/5e/characters", {
      headers: { Authorization: `Token ${token}`, "Content-Type": "application/transit+json" },
      data: readFileSync(join(charactersDir, `${golden}.strict.json`), "utf8"),
    });
    expect(saved.status(), `save ${golden}: ${await saved.text()}`).toBe(200);
  }
  await api.dispose();
});

test("the bookmarklet exports the old server's characters, and the app imports them", async ({ page }) => {
  // 1. Log in through the old app's login form (views.cljs login-page), so that
  //    the old app itself stores the user, with its :token, in localStorage.
  await page.goto(`${oldApp}/pages/login-page`);
  await page.getByPlaceholder("Username or Email", { exact: true }).fill("testadmin");
  await page.getByPlaceholder("Password", { exact: true }).fill("SecurePass123");
  await page.getByRole("button", { name: "LOGIN", exact: true }).click();
  await page.waitForFunction(() => /:token\s+"/.test(localStorage.getItem("user") ?? ""));

  // 2. Save the old builder's new character, a level 1 barbarian, through the
  //    UI (character_builder.cljs). The old app names an unnamed character at random.
  await page.goto(`${oldApp}/pages/dnd/5e/character-builder`);
  const saved = page.waitForResponse((r) => r.request().method() === "POST" && new URL(r.url()).pathname === "/dnd/5e/characters");
  await page.getByRole("button", { name: /Save New Character$/ }).click();
  expect((await saved).status()).toBe(200);

  // 3. Run the bookmarklet on the old site.
  const download = page.waitForEvent("download");
  await page.evaluate(bookmarklet);
  const text = readFileSync(await (await download).path(), "utf8");
  const bundle = JSON.parse(text);

  // 4. One raw EDN response for each endpoint, with every saved character.
  expect(bundle).toMatchObject({ format: "dmv-export", version: 1, exportedFrom: new URL(oldApp).origin });
  expect(bundle.characters).toEqual([expect.any(String)]);
  expect(bundle.magicItems).toEqual([expect.any(String)]);
  for (const golden of goldens) expect(bundle.characters[0]).toContain(`"${nameOf(golden)}"`);
  expect(readServerEdn(bundle.magicItems[0])).toEqual([]);

  // 5. Each golden builds as its expected.json, as in the app's engine tests.
  const built = readServerEdn(bundle.characters[0]).map(
    (character) => evaluate(importCharacter(character).entity).built as Record<string, unknown>,
  );
  expect(built).toHaveLength(goldens.length + 1);
  const byName = new Map(built.map((b) => [b["character-name"], b]));
  for (const golden of goldens) expect.soft(byName.get(nameOf(golden)), golden).toEqual(expected.get(golden));

  // 6. The character saved through the old builder builds as the engine's new
  //    character, except for the random name.
  const goldenNames = new Set(goldens.map(nameOf));
  const fromBuilder = built.filter((b) => !goldenNames.has(b["character-name"] as string));
  expect(fromBuilder).toHaveLength(1);
  const { "character-name": builderName, ...builderBuilt } = fromBuilder[0];
  const { "character-name": _, ...newCharacter } = evaluate(emptyCharacter()).built as Record<string, unknown>;
  expect.soft(builderBuilt, "the old builder's new character").toEqual(newCharacter);

  // 7. The app's Import page lists each character in the bundle, and a sheet
  //    shows the expected Armor Class and Hit Points (as e2e/sheet.spec.ts).
  await page.goto("/import");
  await page.getByLabel("Import dmv-export bundle").setInputFiles({ name: "dmv-export.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.getByRole("heading", { name: `Imported ${goldens.length + 1} characters` })).toBeVisible();
  for (const name of [...goldenNames, builderName as string]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }

  const fighter = expected.get("fighter-1");
  const worn = fighter["armor-class-with-armor"].find(
    (o: { armor: string | null; shield: string | null }) => o.armor === fighter["worn-armor"] && o.shield === fighter["wielded-shield"],
  );
  await page.getByRole("button", { name: fighter["character-name"], exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: fighter["character-name"] })).toBeVisible();
  await expect(page.getByLabel("Armor Class", { exact: true })).toHaveText(String(worn.ac));
  const hp = fighter["max-hit-points"];
  await expect(page.getByLabel("Hit Points", { exact: true })).toHaveText(`${fighter["current-hit-points"] ?? hp} / ${hp}`);
});

// The guide's way without the bookmark (ORC-68, doc 03 Path A): open a
// character's public URL with no login, and paste the text in step 3.
test("a character's public URL text imports in step 3", async ({ browser, page }) => {
  const api = await request.newContext({ baseURL: oldApp, ignoreHTTPSErrors: true });
  const login = await api.post("/login", { data: { username: "testadmin", password: "SecurePass123" } });
  const token = /:token\s+"([^"]+)"/.exec(await login.text())![1];
  const list = await (await api.get("/dnd/5e/characters", { headers: { Authorization: `Token ${token}` } })).text();
  await api.dispose();
  const fighter = expected.get("fighter-1");
  const id = readServerEdn(list)
    .map((c) => c as Record<string, unknown>)
    .find((c) => evaluate(importCharacter(c).entity).built["character-name"] === fighter["character-name"])!["~:db/id"];
  expect(id, "the character list gives each character's :db/id").toBeDefined();

  const anonymous = await browser.newContext({ ignoreHTTPSErrors: true });
  const oldPage = await anonymous.newPage();
  await oldPage.goto(`${oldApp}/dnd/5e/characters/${id}`);
  const text = await oldPage.locator("body").innerText();
  await anonymous.close();

  await page.goto("/import");
  await page.getByLabel("Paste the character's text").fill(text);
  await page.getByRole("button", { name: "Import pasted character" }).click();
  await expect(page.getByRole("heading", { level: 1, name: fighter["character-name"] })).toBeVisible();
});
