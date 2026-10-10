import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";

const source = readFileSync(new URL("./bookmarklet.js", import.meta.url), "utf8");
const charactersEdn = '[{:db/id 1, :orcpub.entity.strict/values {}}]';
const itemsEdn = '({:db/id 2, :orcpub.dnd.e5.magic-items/name "Emberbrand"})';

/** Runs the script against a fake page and a fake old server, and gives what it did. */
async function run({ user = '{:username "u", :token "abc.def"}', token = "abc.def" } = {}) {
  const page = { overlay: null, downloads: [], fetched: [] };
  const element = (tag) => ({
    tag,
    style: {},
    textContent: "",
    click() {
      if (tag === "a") page.downloads.push({ name: this.download, blob: this.href });
    },
    remove() {},
  });
  const document = {
    getElementById: (id) => (page.overlay && page.overlay.id === id ? page.overlay : null),
    createElement: element,
    body: {
      appendChild(child) {
        if (child.tag === "div") page.overlay = child;
      },
    },
  };
  const localStorage = { getItem: (key) => (key === "user" ? user : null) };
  const bodies = { "/dnd/5e/characters": charactersEdn, "/dnd/5e/items": itemsEdn };
  async function fetch(path, { headers }) {
    page.fetched.push(path);
    const ok = headers.Authorization === `Token ${token}` && path in bodies;
    return new Response(ok ? bodies[path] : "", { status: ok ? 200 : 401 });
  }
  const URL = { createObjectURL: (blob) => blob };
  const location = { origin: "https://old.example" };

  new Function("document", "localStorage", "fetch", "URL", "location", source)(document, localStorage, fetch, URL, location);
  // Let the fetch chain finish.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return page;
}

test("downloads the bundle with the raw text of both responses", async () => {
  const page = await run();
  expect(page.downloads).toHaveLength(1);
  expect(page.downloads[0].name).toBe("dmv-export.json");
  expect(JSON.parse(await page.downloads[0].blob.text())).toEqual({
    format: "dmv-export",
    version: 1,
    exportedFrom: "https://old.example",
    characters: [charactersEdn],
    magicItems: [itemsEdn],
  });
  expect(page.overlay.textContent).toContain("Downloaded dmv-export.json");
});

test("not logged in shows an error and fetches nothing", async () => {
  const page = await run({ user: null });
  expect(page.fetched).toEqual([]);
  expect(page.downloads).toEqual([]);
  expect(page.overlay.textContent).toContain("Log in to Dungeon Master's Vault first, then run the exporter again.");
});

test("an expired login shows an error and downloads nothing", async () => {
  const page = await run({ token: "other" });
  expect(page.fetched).toEqual(["/dnd/5e/characters"]);
  expect(page.downloads).toEqual([]);
  expect(page.overlay.textContent).toContain("Your login has expired.");
});
