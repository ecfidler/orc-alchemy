import "fake-indexeddb/auto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { CONTENT_TYPES } from "../engine/content.ts";
import { engine, loadEngine } from "../engine/engine.ts";
import { missingContent } from "../engine/reconcile.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { listPacks, type PackRecord } from "../storage/packs.ts";
import { MyContent } from "./MyContent.tsx";

const downloads = vi.hoisted(() => [] as { name: string; text: string }[]);
vi.mock("./Export.tsx", () => ({ downloadText: (name: string, text: string) => downloads.push({ name, text }) }));

beforeAll(() => loadEngine());

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  downloads.length = 0;
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
  useHomebrew.setState({ lastImport: null, pending: null });
});

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");
const orcbrewDir = join(fixturesDir, "orcbrew");
const orcbrewFiles = readdirSync(orcbrewDir).filter((f) => f.endsWith(".orcbrew"));
const orcbrew = (file: string) => readFileSync(join(orcbrewDir, file), "utf8");
const load = (file: string) => useHomebrew.getState().load(file, orcbrew(file));

function renderPage(Page = MyContent) {
  const router = createMemoryRouter([{ path: "/content", element: <Page /> }], { initialEntries: ["/content"] });
  render(<RouterProvider router={router} />);
}

const yes = () => vi.stubGlobal("confirm", () => true);

test.each(orcbrewFiles)("%s: every pack shows the 13 lists, each with every item of its type", async (file) => {
  await load(file);
  renderPage();
  const { packs } = useHomebrew.getState();
  expect(packs.length).toBeGreaterThan(0);
  for (const { id, plugin } of packs) {
    const section = await screen.findByRole("region", { name: id });
    expect(section.querySelectorAll("summary")).toHaveLength(13);
    for (const { type, many } of CONTENT_TYPES) {
      const stored = Object.keys((plugin as Record<string, object | undefined>)[`~:${type}`] ?? {}).length;
      expect(within(section).getByRole("list", { name: `${id} ${many}` }).querySelectorAll("li"), `${id} ${many}`).toHaveLength(stored);
    }
  }
});

test("a class shows its pack after its name", async () => {
  await load("duplicate-external-b.orcbrew");
  renderPage();
  const classes = within(await screen.findByRole("region", { name: "duplicate-external-b" })).getByRole("list", { name: "duplicate-external-b classes" });
  for (const li of within(classes).getAllByRole("listitem")) expect(li.textContent).toMatch(/ \(duplicate-external-b\)Delete$/);
});

test("turning an item off leaves it out of the next evaluate; turning it on brings it back", async () => {
  await load("duplicate-external-b.orcbrew");
  renderPage();
  const r8 = engine().importCharacter(readFileSync(join(fixturesDir, "legacy/r8-unresolved-keys.strict.json"), "utf8")).entity;
  const classes = () => engine().evaluate(r8, { homebrew: useHomebrew.getState().homebrew }).built.classes;
  expect(classes()).toEqual(["artificer"]);

  const artificer = await screen.findByRole<HTMLInputElement>("checkbox", { name: "Artificer (Alternate) (duplicate-external-b)" });
  fireEvent.click(artificer);
  await waitFor(() => expect(artificer.checked).toBe(false));
  expect(classes()).toEqual([]);
  expect(missingContent(r8, useHomebrew.getState().homebrew).map((u) => u.key)).toContain("artificer");

  fireEvent.click(artificer);
  await waitFor(() => expect(artificer.checked).toBe(true));
  expect(classes()).toEqual(["artificer"]);
});

test("the old app's off flag in a file shows as off, and turning the item or pack on removes it", async () => {
  // As the old app writes it: :disabled? true on an item, and on the pack.
  const text = orcbrew("warlock-test-content.orcbrew")
    .replace("{:keen-mind\n  {:key :keen-mind", "{:keen-mind\n  {:disabled? true :key :keen-mind")
    .replace(/^\{/, "{:disabled? true\n ");
  await useHomebrew.getState().load("warlock-test-content.orcbrew", text);
  renderPage();
  const section = await screen.findByRole("region", { name: "warlock-test-content" });
  const pack = within(section).getByRole<HTMLInputElement>("checkbox", { name: "Enabled" });
  const keenMind = within(section).getByRole<HTMLInputElement>("checkbox", { name: "Keen Mind" });
  expect(pack.checked).toBe(false);
  expect(keenMind.checked).toBe(false);
  const feats = () => engine().buildTemplate(useHomebrew.getState().homebrew).content.feats;
  expect(feats()).not.toContain("keen-mind");

  fireEvent.click(pack);
  await waitFor(() => expect(pack.checked).toBe(true));
  expect(feats()).not.toContain("keen-mind");
  fireEvent.click(keenMind);
  await waitFor(() => expect(keenMind.checked).toBe(true));
  expect(feats()).toContain("keen-mind");
  const [stored] = (await listPacks()) as PackRecord[];
  expect(JSON.stringify(stored.plugin)).not.toContain("disabled?");
});

test("a pack's checkbox turns it off, and Delete removes it from storage after a confirmation", async () => {
  await load("warlock-test-content.orcbrew");
  renderPage();
  const section = await screen.findByRole("region", { name: "warlock-test-content" });
  fireEvent.click(within(section).getByRole("checkbox", { name: "Enabled" }));
  await waitFor(() => expect(useHomebrew.getState().homebrew).toBeUndefined());

  vi.stubGlobal("confirm", () => false);
  fireEvent.click(within(section).getByRole("button", { name: "Delete" }));
  expect(useHomebrew.getState().packs).toHaveLength(1);
  yes();
  fireEvent.click(within(section).getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "warlock-test-content" })).toBeNull());
  expect(await listPacks()).toEqual([]);
});

test("Delete on an item removes it from the pack and from storage", async () => {
  await load("duplicate-external-b.orcbrew");
  renderPage();
  yes();
  fireEvent.click(await screen.findByRole("button", { name: "Delete Artificer (Alternate) (duplicate-external-b)" }));
  await waitFor(() => expect(screen.queryByRole("checkbox", { name: "Artificer (Alternate) (duplicate-external-b)" })).toBeNull());
  const [stored] = (await listPacks()) as PackRecord[];
  expect(stored.plugin).not.toHaveProperty(["~:orcpub.dnd.e5/classes", "~:artificer"]);
});

test("Export downloads <pack>.orcbrew, and Export all downloads all-content.orcbrew, pretty-printed unless turned off", async () => {
  await load("warlock-test-content.orcbrew");
  renderPage();
  const section = await screen.findByRole("region", { name: "warlock-test-content" });
  fireEvent.click(within(section).getByRole("button", { name: "Export" }));
  await waitFor(() => expect(downloads.map((d) => d.name)).toEqual(["warlock-test-content.orcbrew"]));
  expect(engine().parseOrcbrew(downloads[0].text, { name: "warlock-test-content" }).data).toEqual(
    Object.fromEntries(useHomebrew.getState().packs.map((p) => [p.id, p.plugin])),
  );

  fireEvent.click(screen.getByRole("checkbox", { name: "Pretty-print exported files" }));
  fireEvent.click(screen.getByRole("button", { name: "Export all" }));
  await waitFor(() => expect(downloads.map((d) => d.name)).toEqual(["warlock-test-content.orcbrew", "all-content.orcbrew"]));
  expect(downloads[1].text.split("\n").length).toBeLessThan(downloads[0].text.split("\n").length);
});

test("a pack the old app would refuse lists its problems, and Export anyway downloads it filled", async () => {
  await load("duplicate-external-b.orcbrew");
  // Blank one class's option-pack, as a stored pack from elsewhere might have it.
  const [pack] = useHomebrew.getState().packs;
  const plugin = pack.plugin as Record<string, Record<string, Record<string, unknown>>>;
  const classes = plugin["~:orcpub.dnd.e5/classes"];
  useHomebrew.setState({
    packs: [{ ...pack, plugin: { ...plugin, "~:orcpub.dnd.e5/classes": { ...classes, "~:artificer": { ...classes["~:artificer"], "~:option-pack": "" } } } }],
  });
  renderPage();

  fireEvent.click(within(await screen.findByRole("region", { name: "duplicate-external-b" })).getByRole("button", { name: "Export" }));
  const problems = await screen.findByRole("alert", { name: "Export problems in duplicate-external-b" });
  expect(within(problems).getAllByRole("listitem").map((li) => li.textContent)).toContain(
    "duplicate-external-b: Class artificer: its option source is blank",
  );
  expect(downloads).toEqual([]);

  fireEvent.click(within(problems).getByRole("button", { name: "Export anyway" }));
  await waitFor(() => expect(downloads.map((d) => d.name)).toEqual(["duplicate-external-b.orcbrew"]));
  const reread = engine().parseOrcbrew(downloads[0].text, { name: "duplicate-external-b" }).data!;
  expect(engine().validateForExport(reread).valid).toBe(true);
});

test("a stored pack that could not be read is listed with its warning, and Delete removes it", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.resetModules();
  const { savePacks, listPacks: list } = await import("../storage/packs.ts");
  const { MyContent: Page } = await import("./MyContent.tsx");
  const good: PackRecord = { id: "good", rules: "2014", enabled: true, disabledItems: [], plugin: {}, updatedAt: "" };
  await savePacks([good, { ...good, id: "bad", plugin: "not a map" as unknown as object }]);

  renderPage(Page);
  const warning = await screen.findByRole("region", { name: "Unreadable homebrew packs" });
  expect(warning.textContent).toContain("The stored pack bad could not be read, so it is not used.");
  yes();
  fireEvent.click(within(warning).getByRole("button", { name: "Delete bad" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Unreadable homebrew packs" })).toBeNull());
  expect(((await list()) as PackRecord[]).map((p) => p.id)).toEqual(["good"]);
});
