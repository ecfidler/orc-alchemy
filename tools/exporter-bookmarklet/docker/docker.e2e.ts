// The exporter bookmarklet against the old app in Docker (ORC-67).
//
// Run it:
//   - In GitHub Actions, on demand:
//       gh workflow run bookmarklet-docker.yml --ref <branch>
//   - Locally, with Docker: bring the old app up from an ecfidler/orcpub
//     checkout (branch pubdoor) as .github/workflows/bookmarklet-docker.yml
//     does, so that it serves https://localhost and has the user testadmin
//     with password SecurePass123. Start from an empty database
//     (`docker compose down -v`), because the test adds the characters. Then:
//       cd packages/app
//       bunx playwright test -c ../../tools/exporter-bookmarklet/docker/docker.config.ts
//     OLD_APP_URL sets a different address for the old app.
//
// The test saves the SRD golden characters to the old server, runs the
// bookmarklet on the old site, and checks the bundle it downloads: in Node
// with the engine, and in the app's Import page.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, request, test } from "@playwright/test";
import { evaluate, importCharacter, readServerEdn } from "@pubdoor/dmv";

const oldApp = process.env.OLD_APP_URL ?? "https://localhost";
const charactersDir = join(import.meta.dirname, "../../../fixtures/characters");
const readJson = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));
const bookmarklet = readFileSync(join(import.meta.dirname, "../bookmarklet.js"), "utf8");

// The golden characters that need no homebrew and no custom magic items (those come in ORC-77).
const goldens = readdirSync(charactersDir)
  .filter((file) => file.endsWith(".meta.json"))
  .map((file) => file.slice(0, -".meta.json".length))
  .filter((name) => {
    const meta = readJson(`${name}.meta.json`);
    return meta.orcbrew.length === 0 && meta.magicItems === undefined;
  });
const expected = new Map(goldens.map((name) => [name, readJson(`${name}.expected.json`)]));
const nameOf = (golden: string): string => expected.get(golden)["character-name"];

let token: string;

test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: oldApp, ignoreHTTPSErrors: true });
  const login = await api.post("/login", { data: { username: "testadmin", password: "SecurePass123" } });
  const loginBody = await login.text();
  expect(login.status(), loginBody).toBe(200);
  // The old server answers in EDN: {:token "<jwt>" ...}.
  token = /:token\s+"([^"]+)"/.exec(loginBody)![1];

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
  // 1. Run the bookmarklet on the old site as the logged-in user.
  await page.goto(oldApp);
  await page.evaluate((jwt) => localStorage.setItem("user", `{:username "testadmin" :token "${jwt}"}`), token);
  const download = page.waitForEvent("download");
  await page.evaluate(bookmarklet);
  const text = readFileSync(await (await download).path(), "utf8");
  const bundle = JSON.parse(text);

  // 2. One raw EDN response for each endpoint, with every saved character.
  expect(bundle).toMatchObject({ format: "dmv-export", version: 1, exportedFrom: new URL(oldApp).origin });
  expect(bundle.characters).toEqual([expect.any(String)]);
  expect(bundle.magicItems).toEqual([expect.any(String)]);
  for (const golden of goldens) expect(bundle.characters[0]).toContain(`"${nameOf(golden)}"`);
  expect(readServerEdn(bundle.magicItems[0])).toEqual([]);

  // 3. Each character builds as its expected.json, as in the app's engine tests.
  const built = new Map<string, unknown>();
  for (const character of readServerEdn(bundle.characters[0])) {
    const b = evaluate(importCharacter(character).entity).built as Record<string, unknown>;
    built.set(b["character-name"] as string, b);
  }
  for (const golden of goldens) expect.soft(built.get(nameOf(golden)), golden).toEqual(expected.get(golden));

  // 4. The app's Import page lists each character in the bundle.
  await page.goto("/import");
  await page.getByLabel("Import dmv-export bundle").setInputFiles({ name: "dmv-export.json", mimeType: "application/json", buffer: Buffer.from(text) });
  await expect(page.getByRole("heading", { name: `Imported ${goldens.length} characters` })).toBeVisible();
  for (const golden of goldens) {
    await expect(page.getByRole("button", { name: nameOf(golden), exact: true })).toBeVisible();
  }
});
