// The Review uses page (ORC-207, docs/design/homebrew-forms.md, "Review uses
// page"): the count and the link in the import log and on My Content, the
// rows and their checkboxes, Save, which writes the checked rows as the form
// does, and the skipped rows, which stay in this browser only.
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { optionNames } from "@orc-alchemy/ui/testing";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, beforeEach, expect, test } from "vitest";
import { itemAt } from "../engine/content.ts";
import { engine, loadEngine } from "../engine/engine.ts";
import { exportOrcbrew } from "../engine/orcbrew-export.ts";
import { toSheet } from "../engine/sheet.ts";
import { orcbrewHomebrew, useHomebrew } from "../state/homebrew.ts";
import { reloadSkipped, setSkipped, SKIPPED_USES_KEY, useSkippedUses } from "../state/skipped-uses.ts";
import { listPacks } from "../storage/packs.ts";
import { usesRows } from "./builders/review-uses.ts";
import { choose, press, shown } from "./builders/test-picks.ts";
import { bigPlugin, REVIEW_PACK, REVIEW_PACK_FILE, REVIEW_ROWS, reviewOrcbrew, reviewPlugin, toEdn } from "./builders/test-review-pack.ts";
import { SUGGESTION_PACK } from "./builders/test-suggestion-pack.ts";
import { suggestedFrequency } from "./builders/uses.ts";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { HomebrewBuilder } from "./HomebrewBuilder.tsx";
import { ImportLog } from "./ImportLog.tsx";
import { MyContent } from "./MyContent.tsx";
import { ReviewUses } from "./ReviewUses.tsx";

beforeAll(() => loadEngine());
beforeEach(() => {
  localStorage.clear();
  reloadSkipped();
});
afterEach(async () => {
  cleanup();
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
  useHomebrew.setState({ lastImport: null, pending: null });
  localStorage.clear();
  reloadSkipped();
});

const RACES = "~:orcpub.dnd.e5/races";
const FEATS = "~:orcpub.dnd.e5/feats";
const LONG = "~:orcpub.dnd.e5.units/long-rest";
const PAGE = `/content/review-uses/${encodeURIComponent(REVIEW_PACK)}`;
const SUGGESTIONS = REVIEW_ROWS.filter(([, kind]) => kind === "suggestion").map(([name]) => name);
const HINTS = REVIEW_ROWS.filter(([, kind]) => kind === "hint").map(([name]) => name);

const importPack = () => useHomebrew.getState().load(REVIEW_PACK_FILE, reviewOrcbrew());
const stored = () => useHomebrew.getState().packs.find((p) => p.id === REVIEW_PACK)!;
type Plugin = Record<string, Record<string, Record<string, unknown>>>;
type Traits = Record<string, unknown>[];

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/content", element: <MyContent /> },
      { path: "/import", element: <ImportLogPage /> },
      { path: "/content/review-uses/:pack", element: <ReviewUses /> },
      { path: "/content/edit/:type/:pack/:key", element: <HomebrewBuilder /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}
function ImportLogPage() {
  const lastImport = useHomebrew((state) => state.lastImport);
  return lastImport && <ImportLog result={lastImport} />;
}

const box = (name: string) => screen.getByRole("checkbox", { name });
const rowsShown = () => screen.queryAllByRole("checkbox").filter((c) => !["All rows", "Show skipped"].includes(c.getAttribute("aria-label") ?? c.closest("label")?.textContent ?? ""));
const rowNames = () => REVIEW_ROWS.map(([name]) => name).filter((name) => screen.queryByRole("checkbox", { name }) !== null);
async function openPage() {
  const router = renderAt(PAGE);
  await screen.findByRole("checkbox", { name: "All rows" });
  return router;
}
/** Skips the row Sea Hag Tidal Surge, as an earlier Save would. */
const skipSeaHag = () => setSkipped(REVIEW_PACK, [usesRows(stored().plugin).find((r) => r.name === "Sea Hag Tidal Surge")!.id], []);
async function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await screen.findByText(/^Saved \d+ features?\./);
}

test("the import log says how many features may have uses, with a Review uses link to the pack's page", async () => {
  await importPack();
  expect(useHomebrew.getState().lastImport?.packs).toEqual([REVIEW_PACK]);
  const router = renderAt("/import");
  const list = await screen.findByRole("list", { name: "Suggested uses" });
  expect(list.textContent).toBe(`${REVIEW_ROWS.length} features may have uses. Review uses`);
  fireEvent.click(within(list).getByRole("link", { name: "Review uses" }));
  await screen.findByRole("checkbox", { name: "All rows" });
  expect(router.state.location.pathname).toBe(PAGE);
});

test("a file with no such features shows no count; a file of two packs names each pack that has some", async () => {
  await useHomebrew.getState().load("plain.orcbrew", toEdn({ [RACES]: { "~:plain": { "~:key": "~:plain", "~:name": "Plain", "~:option-pack": "plain", "~:speed": 30, "~:size": "~:small", "~:traits": [{ "~:name": "Dark", "~:description": "You see in the dark." }] } } }));
  renderAt("/import");
  await screen.findByRole("region", { name: "Import log" });
  expect(screen.queryByRole("list", { name: "Suggested uses" })).toBeNull();
  cleanup();

  await useHomebrew.getState().load("two.orcbrew", toEdn({ "Pack A": reviewPlugin("Pack A"), "Pack B": { [RACES]: {} } }));
  expect(useHomebrew.getState().lastImport?.packs).toEqual(["Pack A", "Pack B"]);
  renderAt("/import");
  const list = await screen.findByRole("list", { name: "Suggested uses" });
  expect(list.textContent).toBe(`Pack A: ${REVIEW_ROWS.length} features may have uses. Review uses`);
  expect(within(list).getByRole("link", { name: "Review uses in Pack A" }).getAttribute("href")).toBe("/content/review-uses/Pack%20A");
});

test("My Content shows the count and the link on each pack that has such features", async () => {
  await importPack();
  await useHomebrew.getState().saveItem("Other", RACES, { "~:key": "~:plain", "~:name": "Plain", "~:option-pack": "Other" });
  renderAt("/content");
  const pack = await screen.findByRole("region", { name: REVIEW_PACK });
  expect(within(pack).getByText(`${REVIEW_ROWS.length} features may have uses.`, { exact: false })).toBeTruthy();
  expect(within(pack).getByRole("link", { name: `Review uses in ${REVIEW_PACK}` }).getAttribute("href")).toBe(PAGE);
  expect(within(screen.getByRole("region", { name: "Other" })).queryByRole("link", { name: /Review uses/ })).toBeNull();
});

test("the page lists the rows by item; a suggestion row starts checked, a hint row unchecked with No suggestion; opening it stores nothing", async () => {
  await importPack();
  const before = await listPacks();
  await openPage();
  expect(rowNames()).toEqual(REVIEW_ROWS.map(([name]) => name));
  expect(rowsShown()).toHaveLength(REVIEW_ROWS.length);
  for (const name of SUGGESTIONS) expect(box(name), name).toBeChecked();
  for (const name of HINTS) expect(box(name), name).not.toBeChecked();
  // Each row is in the section of its item, under the item's name.
  const race = screen.getByRole("region", { name: "Tidecaller (race)" });
  expect(within(race).getByRole("heading", { level: 2 }).textContent).toBe("Tidecaller race");
  // The matched sentence, with the phrase marked; the suggestion is in the uses control.
  const song = box("Tidecaller Song of Courage").closest(".grid")! as HTMLElement;
  expect([...song.querySelectorAll("mark")].map((m) => m.textContent)).toEqual(["As a bonus action", SUGGESTION_PACK[3].phrase]);
  expect(within(song).getByRole("button", { name: "Scaled" })).toHaveAttribute("aria-pressed", "true");
  expect(shown("Tidecaller Song of Courage equal to")).toBe("Charisma modifier");
  expect(shown("Tidecaller Song of Courage minimum")).toBe("1");
  expect(shown("Tidecaller Song of Courage type")).toBe("Bonus Action");
  // A hint row says so, and its control is None.
  const charm = box("Tidecaller Old Charm").closest(".grid")! as HTMLElement;
  expect(within(charm).getByText("No suggestion")).toBeTruthy();
  expect(within(charm).getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");
  // No preview, and nothing stored.
  expect(screen.queryByRole("group", { name: /preview$/ })).toBeNull();
  expect(screen.getByText(`${SUGGESTIONS.length} of ${REVIEW_ROWS.length} checked`)).toBeTruthy();
  expect(await listPacks()).toEqual(before);
});

test("All rows checks every row, and unchecks every row; a hint row becomes checked when the user fills its control", async () => {
  await importPack();
  await openPage();
  const all = screen.getByRole("checkbox", { name: "All rows" });
  expect(all).not.toBeChecked();
  fireEvent.click(all);
  for (const [name] of REVIEW_ROWS) expect(box(name)).toBeChecked();
  expect(all).toBeChecked();
  fireEvent.click(all);
  for (const [name] of REVIEW_ROWS) expect(box(name)).not.toBeChecked();

  press("Tidecaller Old Charm Uses", "Fixed");
  expect(box("Tidecaller Old Charm")).toBeChecked();
  expect(box("Tidecaller Wind Song")).not.toBeChecked();
});

test("Save writes :frequency and :type for the checked rows only; every other item and key stays", async () => {
  await importPack();
  const before = stored();
  await openPage();
  fireEvent.click(screen.getByRole("checkbox", { name: "All rows" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "All rows" }));
  fireEvent.click(box("Tidecaller Tidal Surge"));
  fireEvent.click(box("Tide-Touched Feat"));
  // The user changes a suggestion, and fills a hint row.
  fireEvent.click(box("Sea Hag Song of Courage"));
  await choose("Sea Hag Song of Courage minimum", "None");
  press("Tidecaller Old Charm Uses", "Fixed");
  await choose("Tidecaller Old Charm amount", "3");
  await save();

  const plugin = reviewPlugin() as Plugin;
  const race = plugin[RACES]["~:tidecaller"];
  const traits = race["~:traits"] as Traits;
  traits[0] = { ...traits[0], "~:frequency": { "~:units": LONG, "~:amount": 1 }, "~:type": "~:action" };
  const charm = SUGGESTION_PACK.findIndex((f) => f.name === "Old Charm");
  traits[charm] = { ...traits[charm], "~:frequency": { "~:units": LONG, "~:amount": 3 } };
  plugin[FEATS]["~:tide-touched"] = { ...plugin[FEATS]["~:tide-touched"], "~:frequency": { "~:units": LONG, "~:amount": 1 }, "~:type": "~:action" };
  const hag = plugin["~:orcpub.dnd.e5/monsters"]["~:sea-hag"]["~:traits"] as Traits;
  hag[1] = { ...hag[1], "~:frequency": { "~:units": LONG, "~:amount": { "~:ability": "~:cha" } } };

  const after = stored();
  expect(after.plugin).toEqual(plugin);
  expect({ ...after, plugin: undefined, updatedAt: undefined }).toEqual({ ...before, plugin: undefined, updatedAt: undefined });
  expect((await listPacks()).find((p) => (p as { id: string }).id === REVIEW_PACK)).toEqual(after);
  // The saved rows go; the unchecked suggestion rows are skipped, and the hint rows stay.
  expect(rowNames()).toEqual(HINTS.filter((name) => name !== "Tidecaller Old Charm"));
});

test("a checked row with no uses stores nothing and counts as unchecked; None unchecks a row", async () => {
  await importPack();
  const before = stored();
  await openPage();
  // A hint row filled and then emptied is unchecked again.
  press("Tidecaller Old Charm Uses", "Fixed");
  expect(box("Tidecaller Old Charm")).toBeChecked();
  press("Tidecaller Old Charm Uses", "None");
  expect(box("Tidecaller Old Charm")).not.toBeChecked();
  // All rows checks the hint rows too, with no uses.
  fireEvent.click(screen.getByRole("checkbox", { name: "All rows" }));
  for (const name of HINTS) expect(box(name)).toBeChecked();
  // A suggestion row set to None is unchecked, and writes no type.
  press("Tidecaller Tidal Surge Uses", "None");
  expect(box("Tidecaller Tidal Surge")).not.toBeChecked();
  // Checked again by hand, it still has no uses.
  fireEvent.click(box("Tidecaller Tidal Surge"));
  expect(box("Tidecaller Tidal Surge")).toBeChecked();
  await save();
  expect(screen.getByRole("status").textContent).toBe(`Saved ${SUGGESTIONS.length - 1} features. Skipped 1.`);

  const traits = (itemAt(stored().plugin, RACES, "~:tidecaller") as Record<string, Traits>)["~:traits"];
  const original = ((reviewPlugin() as Plugin)[RACES]["~:tidecaller"]["~:traits"] as Traits);
  expect(traits[0]).toEqual(original[0]);
  for (const [i, f] of SUGGESTION_PACK.entries()) if (f.uses === "hint") expect(traits[i], f.name).toEqual(original[i]);
  expect(itemAt(stored().plugin, "~:orcpub.dnd.e5/backgrounds", "~:pearl-diver")).toEqual(itemAt(before.plugin, "~:orcpub.dnd.e5/backgrounds", "~:pearl-diver"));
  // The suggestion row is skipped; the hint rows stay.
  expect(JSON.parse(localStorage.getItem(SKIPPED_USES_KEY)!)[REVIEW_PACK]).toEqual([expect.stringContaining("Tidal Surge")]);
  expect(rowNames()).toEqual(HINTS);
});

test("Show skipped keeps the user's changes to the rows", async () => {
  await importPack();
  skipSeaHag();
  await openPage();
  await choose("Tidecaller Song of Courage minimum", "None");
  fireEvent.click(box("Tidecaller Tidal Surge"));
  press("Tidecaller Old Charm Uses", "Fixed");
  fireEvent.click(screen.getByRole("checkbox", { name: "Show skipped" }));
  expect(box("Sea Hag Tidal Surge")).toBeVisible();
  fireEvent.click(screen.getByRole("checkbox", { name: "Show skipped" }));
  expect(shown("Tidecaller Song of Courage minimum")).toBe("None");
  expect(box("Tidecaller Tidal Surge")).not.toBeChecked();
  expect(box("Tidecaller Old Charm")).toBeChecked();
});

test("a failed save stores nothing, keeps the skipped rows as they were, and shows why", async () => {
  await importPack();
  skipSeaHag();
  await openPage();
  const before = stored();
  const records = await listPacks();
  const skipped = localStorage.getItem(SKIPPED_USES_KEY);
  // The store's own failure for a pack that is not stored.
  const saveItems = useHomebrew.getState().saveItems;
  useHomebrew.setState({ saveItems: (_pack, changes) => saveItems("Not Stored", changes) });
  try {
    fireEvent.click(box("Tidecaller Song of Courage"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe("No pack named Not Stored");
  } finally {
    useHomebrew.setState({ saveItems });
  }
  expect(stored()).toEqual(before);
  expect(await listPacks()).toEqual(records);
  expect(localStorage.getItem(SKIPPED_USES_KEY)).toBe(skipped);
  // The rows are as the user left them.
  expect(box("Tidecaller Song of Courage")).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
});

test("a subclass feature's level is named by the class, as in the subclass form", async () => {
  const plugin = reviewPlugin() as Plugin;
  plugin["~:orcpub.dnd.e5/classes"]["~:wavecaller"]["~:name"] = "Caller of Waves";
  plugin["~:orcpub.dnd.e5/subclasses"]["~:deep-path"]["~:class"] = "~:wavecaller";
  await useHomebrew.getState().load(REVIEW_PACK_FILE, toEdn(plugin));
  await openPage();
  press("Deep Path Warding Hand Uses", "Scaled");
  const page = await optionNames(screen.getByRole("combobox", { name: "Deep Path Warding Hand equal to" }));
  expect(page).toContain(`Caller of Waves (${REVIEW_PACK}) level × n`);
  cleanup();
  renderAt(`/content/edit/subclass/${encodeURIComponent(REVIEW_PACK)}/deep-path`);
  press(await screen.findByRole("group", { name: "Feature 1 Uses" }).then(() => "Feature 1 Uses"), "Scaled");
  expect(await optionNames(screen.getByRole("combobox", { name: "Feature 1 equal to" }))).toEqual(page);
});

test("what Save stores for a row equals what the form stores for the same choice", async () => {
  await importPack();
  await openPage();
  fireEvent.click(screen.getByRole("checkbox", { name: "All rows" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "All rows" }));
  fireEvent.click(box("Tidecaller Song of Courage"));
  await save();
  const fromPage = itemAt(stored().plugin, RACES, "~:tidecaller");
  cleanup();

  // The same race in another pack, through the form: "Use this" on the uses and the type of feature 4.
  const pack = "Form Pack";
  await useHomebrew.getState().saveItem(pack, RACES, (reviewPlugin(pack) as Plugin)[RACES]["~:tidecaller"]);
  const router = renderAt(`/content/edit/race/${encodeURIComponent(pack)}/tidecaller`);
  fireEvent.click(await screen.findByRole("button", { name: "Feature 4 uses: Use this" }));
  fireEvent.click(screen.getByRole("button", { name: "Feature 4 type: Use this" }));
  const formSave = screen.getByRole<HTMLButtonElement>("button", { name: "Save" });
  await waitFor(() => expect(formSave.disabled).toBe(false));
  fireEvent.click(formSave);
  await waitFor(() => expect(router.state.location.pathname).toBe("/content"), { timeout: 10_000 });
  const fromForm = itemAt(useHomebrew.getState().packs.find((p) => p.id === pack)!.plugin, RACES, "~:tidecaller");
  expect(fromForm).toEqual({ ...fromPage, "~:option-pack": pack });
});

test("after Save, the sheet shows the bubble of a saved feature, and an .orcbrew export has the uses and nothing about skipped rows", async () => {
  await importPack();
  await openPage();
  fireEvent.click(box("Tidecaller Mist Walk"));
  await save();

  // Every suggestion of the race is stored as the form's "Use this" writes it, but the skipped one.
  const traits = (itemAt(stored().plugin, RACES, "~:tidecaller") as Record<string, Traits>)["~:traits"];
  for (const [i, f] of SUGGESTION_PACK.entries()) {
    const expected = typeof f.uses === "object" && f.uses !== null && f.name !== "Mist Walk" ? suggestedFrequency(f.uses) : undefined;
    expect(traits[i]["~:frequency"], f.name).toEqual(expected);
  }

  // The engine evaluates a character of the race: Tidal Surge is an action with 1 use for each long rest.
  const e = engine();
  const homebrew = useHomebrew.getState().homebrew!;
  const character = e.select(e.emptyCharacter(), ["race"], "tidecaller", { homebrew });
  const sheet = toSheet(e.evaluate(character, { homebrew }).built, character);
  expect(sheet.features.actions.find((f) => f.name === "Tidal Surge")?.uses).toEqual({ amount: 1, recharge: "Long rest" });
  expect(sheet.features.traits.find((f) => f.name === "Mist Walk")?.uses).toBeUndefined();
  cleanup();
  render(<CharacterSheet sheet={sheet} />);
  const bubble = screen.getByRole("group", { name: "Tidal Surge" });
  expect(within(bubble).getAllByRole("button", { name: /^Use / })).toHaveLength(1);
  expect(within(bubble).getByText("Long rest")).toBeTruthy();

  // The export has the uses, reads back equal, and says nothing of the skipped row.
  expect(localStorage.getItem(SKIPPED_USES_KEY)).toContain("Mist Walk");
  const exported = exportOrcbrew(orcbrewHomebrew(), { pack: REVIEW_PACK });
  if (!("text" in exported)) throw new Error("The pack did not export");
  expect(exported.text).toContain(":frequency");
  expect(exported.text).not.toMatch(/skip/i);
  expect(e.parseOrcbrew(exported.text, { name: REVIEW_PACK }).data![REVIEW_PACK]).toEqual(stored().plugin);
  expect(JSON.stringify(stored())).not.toMatch(/skip/i);
});

test("a skipped row does not come back after a reload, comes back with Show skipped, and the count leaves it out", async () => {
  await importPack();
  await openPage();
  fireEvent.click(box("Tidecaller Mist Walk"));
  fireEvent.click(box("Reefborn Second Breath"));
  await save();
  expect(screen.queryByRole("checkbox", { name: "Tidecaller Mist Walk" })).toBeNull();
  cleanup();

  // A reload: the skipped rows are read again from this browser.
  useSkippedUses.setState({}, true);
  reloadSkipped();
  await openPage();
  expect(rowNames()).toEqual(HINTS);
  expect(screen.getByRole("checkbox", { name: "Show skipped" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("checkbox", { name: "Show skipped" }));
  expect(rowNames()).toEqual(REVIEW_ROWS.map(([name]) => name).filter((name) => HINTS.includes(name) || ["Tidecaller Mist Walk", "Reefborn Second Breath"].includes(name)));
  // A skipped row shows as skipped, and starts unchecked.
  expect(box("Tidecaller Mist Walk")).not.toBeChecked();
  expect(within(box("Tidecaller Mist Walk").closest(".grid")! as HTMLElement).getByText("Skipped")).toBeTruthy();

  // Checking a skipped row and saving stores it, and it is skipped no more.
  fireEvent.click(box("Tidecaller Mist Walk"));
  await save();
  expect(localStorage.getItem(SKIPPED_USES_KEY)).not.toContain("Mist Walk");
  expect(localStorage.getItem(SKIPPED_USES_KEY)).toContain("Second Breath");
  cleanup();

  // My Content counts the rows that stay: the hints. The skipped row is not counted.
  renderAt("/content");
  const pack = await screen.findByRole("region", { name: REVIEW_PACK });
  expect(within(pack).getByText(`${HINTS.length} features may have uses.`, { exact: false })).toBeTruthy();
});

test("an unchecked hint row is not skipped after Save; deleting the pack forgets its skipped rows", async () => {
  await importPack();
  await openPage();
  fireEvent.click(box("Sea Hag Tidal Surge"));
  await save();
  expect(rowNames()).toEqual(HINTS);
  expect(JSON.parse(localStorage.getItem(SKIPPED_USES_KEY)!)).toEqual({ [REVIEW_PACK]: [expect.stringContaining("Tidal Surge")] });
  await useHomebrew.getState().remove(REVIEW_PACK);
  expect(localStorage.getItem(SKIPPED_USES_KEY)).toBeNull();
});

test("a pack with no rows says so with a link back; a pack that is not stored says so", async () => {
  await useHomebrew.getState().saveItem("Plain", RACES, { "~:key": "~:plain", "~:name": "Plain", "~:option-pack": "Plain" });
  renderAt("/content/review-uses/Plain");
  expect(await screen.findByText("No features in this pack may have uses.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to My Content" })).toBeTruthy();
  cleanup();
  renderAt("/content/review-uses/Nope");
  expect(await screen.findByRole("heading", { name: "There is no pack Nope" })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Back to My Content" })).toBeTruthy();
});

test("a pack of 1,104 features shows its 224 rows", { timeout: 60_000 }, async () => {
  await useHomebrew.getState().load("Big Pack.orcbrew", toEdn(bigPlugin()));
  renderAt("/content/review-uses/Big%20Pack");
  await screen.findByRole("checkbox", { name: "All rows" });
  expect(rowsShown()).toHaveLength(224);
  fireEvent.click(box("Race 1 Tidal Surge"));
  expect(box("Race 1 Tidal Surge")).not.toBeChecked();
  expect(screen.getByText("111 of 224 checked")).toBeTruthy();
});
