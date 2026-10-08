import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, expect, test, vi } from "vitest";
import { engine, loadEngine } from "../engine/engine.ts";
import { useHomebrew } from "../state/homebrew.ts";
import type { PackRecord } from "../storage/packs.ts";
import { ImportPage } from "./ImportPage.tsx";

afterEach(async () => {
  cleanup();
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
  useHomebrew.setState({ lastImport: null });
});

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");
const orcbrewDir = join(fixturesDir, "orcbrew");
const orcbrew = (file: string) => readFileSync(join(orcbrewDir, file), "utf8");

/** Renders the Import page, with a stand-in sheet page to open. */
function renderPage(Page = ImportPage) {
  const router = createMemoryRouter(
    [
      { path: "/import", element: <Page /> },
      { path: "/sheet/:id", element: <h1>Sheet page</h1> },
    ],
    { initialEntries: ["/import"] },
  );
  render(<RouterProvider router={router} />);
}

function choose(label: string, name: string, text: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { files: [new File([text], name)] } });
}

/** The titles of the log's sections, in order. */
const sectionTitles = (log: HTMLElement) => Array.from(log.querySelectorAll("summary"), (s) => s.textContent);

test("the page shows the three steps in order: homebrew, bundle, one character", () => {
  renderPage();
  expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
    "1. Homebrew",
    "2. Character bundle",
    "3. One character",
  ]);
});

test("a chosen pack is listed with its import log, its checkbox disables it, and Remove takes it out", async () => {
  renderPage();
  choose("Load homebrew file", "warlock-test-content.orcbrew", orcbrew("warlock-test-content.orcbrew"));

  const pack = await screen.findByRole("listitem", { name: "warlock-test-content" });
  const log = screen.getByRole("region", { name: "Import log" });
  expect(within(log).getByRole("heading").textContent).toBe("Import log: warlock-test-content.orcbrew");
  expect(within(log).getByRole("status").textContent).toMatch(/^✅ Import successful/);
  expect(within(log).getByText("No issues found. The import completed cleanly.")).toBeTruthy();

  const enabled = within(pack).getByRole<HTMLInputElement>("checkbox", { name: "warlock-test-content" });
  expect(enabled.checked).toBe(true);
  fireEvent.click(enabled);
  await waitFor(() => expect(enabled.checked).toBe(false));
  expect(useHomebrew.getState().homebrew).toBeUndefined();

  fireEvent.click(within(pack).getByRole("button", { name: "Remove warlock-test-content" }));
  await waitFor(() => expect(screen.queryByRole("list", { name: "Homebrew packs" })).toBeNull());
});

// ORC-69: each drift fixture's automatic fixes are listed, in the old import log's sections.
test.each([
  ["drift-01-nil-nil-pairs", ["Data cleanup (1)"]],
  ["drift-02-disabled-nil", ["Data cleanup (1)"]],
  ["drift-03-empty-pack-names", ["Data cleanup (1)", "Advanced details (2)"]],
  ["drift-04-trailing-commas", ["Data cleanup (1)"]],
  ["drift-05-unicode", ["Data cleanup (1)"]],
  ["drift-06-missing-names", ["Field fixes (2 items)"]],
  ["drift-07-missing-fields", ["Field fixes (2 items)"]],
  ["drift-08-multi-plugin", []],
  ["drift-09-size-forms", []],
  ["drift-10-ability-key-forms", ["Data cleanup (3)"]],
  ["drift-11-skill-options-without-choose", ["Data cleanup (1)"]],
  ["drift-12-ability-key-places", ["Data cleanup (8)"]],
])("%s imports and its log lists its automatic fixes", async (name, titles) => {
  renderPage();
  choose("Load homebrew file", `${name}.orcbrew`, orcbrew(`${name}.orcbrew`));

  const log = await screen.findByRole("region", { name: "Import log" });
  expect(within(log).getByRole("status").textContent).toMatch(/^✅ Import successful/);
  expect(sectionTitles(log)).toEqual(titles);
  const changes = useHomebrew.getState().lastImport!.log.changes;
  // Each change is one list item, and a field fix also lists each item it filled.
  const details = changes.reduce((n, c) => n + ((c as { details?: unknown[] }).details?.length ?? 0), 0);
  expect(log.querySelectorAll("li")).toHaveLength(changes.length + details);
  if (titles.length === 0) expect(within(log).getByText("No issues found. The import completed cleanly.")).toBeTruthy();
});

test("a field fix names each item and the fields it filled", async () => {
  renderPage();
  choose("Load homebrew file", "drift-07-missing-fields.orcbrew", orcbrew("drift-07-missing-fields.orcbrew"));

  const log = await screen.findByRole("region", { name: "Import log" });
  const items = Array.from(log.querySelectorAll("li li"), (li) => li.textContent);
  expect(items).toEqual(["unfinished-bolt (spells): filled name, level, school", "unnamed-class (classes): filled name"]);
});

test.each(["community-dandwiki-star-elf", "community-gmbinder-homebrew", "community-mezzoloth-race"])(
  "the community pack %s imports with nothing to report",
  async (name) => {
    renderPage();
    choose("Load homebrew file", `${name}.orcbrew`, orcbrew(`${name}.orcbrew`));

    expect(await screen.findByRole("listitem", { name })).toBeTruthy();
    const log = screen.getByRole("region", { name: "Import log" });
    expect(within(log).getByText("No issues found. The import completed cleanly.")).toBeTruthy();
  },
);

test("a file that does not parse lists no pack, and its log gives the error", async () => {
  renderPage();
  choose("Load homebrew file", "broken.orcbrew", "{:orcpub.dnd.e5/spells {:fireball");

  const log = await screen.findByRole("region", { name: "Import log" });
  expect(within(log).getByRole("status").textContent).toMatch(/^⚠️ Could not read file/);
  expect(sectionTitles(log)).toEqual(["Errors (1)"]);
  expect(within(log).getByText("Unexpected EOF while reading item 1 of map.")).toBeTruthy();
  expect(screen.queryByRole("list", { name: "Homebrew packs" })).toBeNull();
});

const withInvalidItem =
  '{:orcpub.dnd.e5/spells {:good {:name "Good" :level 1 :school "evocation" :option-pack "p"} :bad {:name "Bad" :level 1 :school "evocation" :option-pack 5}}}';

test("progressive by default: an invalid item is skipped and listed, and the rest loads", async () => {
  renderPage();
  choose("Load homebrew file", "p.orcbrew", withInvalidItem);

  const log = await screen.findByRole("region", { name: "Import log" });
  expect(sectionTitles(log)).toEqual(["Skipped items (1)"]);
  expect(within(log).getByText(/^bad/).closest("li")!.textContent).toMatch(/option-pack/);
  expect(await screen.findByRole("listitem", { name: "p" })).toBeTruthy();
});

test("strict: an invalid item stops the whole file, and its log gives the errors", async () => {
  renderPage();
  fireEvent.click(screen.getByRole("checkbox", { name: /^Strict/ }));
  choose("Load homebrew file", "p.orcbrew", withInvalidItem);

  const log = await screen.findByRole("region", { name: "Import log" });
  expect(within(log).getByRole("status").textContent).toMatch(/^⚠️ Invalid orcbrew file/);
  expect(sectionTitles(log)).toEqual(["Errors (1)"]);
  expect(screen.queryByRole("list", { name: "Homebrew packs" })).toBeNull();
});

test("a stored pack that could not be read shows a warning, and the other packs are listed", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.resetModules();
  try {
    const { savePacks } = await import("../storage/packs.ts");
    const { ImportPage } = await import("./ImportPage.tsx");
    const good: PackRecord = { id: "good", rules: "2014", enabled: true, disabledItems: [], plugin: {}, updatedAt: "" };
    await savePacks([good, { ...good, id: "bad", plugin: "not a map" as unknown as object }]);

    renderPage(ImportPage);
    const warning = await screen.findByRole("alert", { name: "Unreadable homebrew packs" });
    expect(warning.textContent).toBe("The stored pack bad could not be read, so it is not used. It is kept in this browser as it is. The record is not a stored pack.");
    expect(within(screen.getByRole("list", { name: "Homebrew packs" })).getByRole("listitem", { name: "good" })).toBeTruthy();
  } finally {
    vi.unstubAllGlobals();
  }
});

const fighter = () => readFileSync(join(fixturesDir, "characters/fighter-1.strict.json"), "utf8");

test("a pasted character opens its sheet", async () => {
  renderPage();
  const button = screen.getByRole<HTMLButtonElement>("button", { name: "Import pasted character" });
  expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Paste the character's text"), { target: { value: fighter() } });
  fireEvent.click(button);

  expect(await screen.findByRole("heading", { name: "Sheet page" }, { timeout: 5000 })).toBeTruthy();
});

test("pasted text that is not a character says why under step 3", async () => {
  renderPage();
  fireEvent.change(screen.getByLabelText("Paste the character's text"), { target: { value: "<html>Not found</html>" } });
  fireEvent.click(screen.getByRole("button", { name: "Import pasted character" }));

  const step = screen.getByRole("region", { name: "One character" });
  expect((await within(step).findByRole("alert")).textContent).toBe("This file is not JSON");
});

test("the bundle step refuses a single character, and points to step 3", async () => {
  renderPage();
  choose("Import dmv-export bundle", "fighter.json", fighter());

  const step = screen.getByRole("region", { name: "Character bundle" });
  expect((await within(step).findByRole("alert")).textContent).toBe("This is not a dmv-export bundle. To import one character, use step 3.");
});

test("a bundle lists its characters, and its packs' log shows under step 1", async () => {
  await loadEngine();
  const { data } = engine().parseOrcbrew(orcbrew("warlock-test-content.orcbrew"), { name: "warlock-test-content" });
  const bundle = { format: "dmv-export", version: 1, characters: [JSON.parse(fighter())], homebrew: data };

  renderPage();
  choose("Import dmv-export bundle", "dmv-export.json", JSON.stringify(bundle));

  const imported = await screen.findByRole("region", { name: "Imported characters" }, { timeout: 5000 });
  expect(within(imported).getByRole("heading").textContent).toBe("Imported 1 character");
  expect(within(imported).getByText("Loaded 1 homebrew pack")).toBeTruthy();
  expect(within(screen.getByRole("region", { name: "Import log" })).getByRole("heading").textContent).toBe("Import log: dmv-export.json");
});
