import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { type SpendSlots, toSheet } from "../engine/sheet.ts";
import { loadSpellContent, setPrepared, setSpentSlots } from "../engine/spells.ts";
import { SPELL_SLOTS_FOLDED_KEY } from "../state/spell-slots-fold.ts";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { SpellsPanel } from "./SpellsPanel.tsx";

// The spell slots of the Spells panel (ORC-286, docs/design/spells-panel.md "Spent spell slots").

beforeAll(async () => {
  await loadEngine();
  await loadSpellContent();
});

beforeEach(() => localStorage.clear());

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const q = (key: string) => `~:orcpub.dnd.e5.character/${key}`;
const readStrict = (path: string): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, path), "utf8"));
const fixture = (name: string) => readStrict(`../../../../fixtures/characters/${name}.strict.json`);
const e2eFile = (name: string) => readStrict(`../../e2e/${name}.strict.json`);

/** A character of these classes and levels, with Charisma 15 for the multiclass rule, by the builder's calls (as in spells.test.ts). */
function buildClasses(classes: [key: string, level: number][], picks: [path: string[], key: string][] = []): StrictEntity {
  const e = engine();
  let entity = e.setField(
    e.emptyCharacter(),
    ["ability-scores", "standard-scores"],
    Object.fromEntries(Object.entries({ str: 8, dex: 14, con: 13, int: 13, wis: 13, cha: 15 }).map(([a, n]) => [q(a), n])),
  );
  classes.forEach(([key, level], i) => {
    entity = i === 0 ? e.setClass(entity, 0, key) : e.addClass(entity, key);
    for (let n = 2; n <= level; n++) entity = e.addLevel(entity, key);
  });
  for (const [path, key] of picks) entity = e.select(entity, path, key);
  return entity;
}

/**
 * The sheet and the open panel of a character, as the sheet page has them: the two change the spent slots with the
 * same handler, on the same entity.
 */
function renderLive(start: StrictEntity, { sheet: withSheet = false } = {}) {
  function Live() {
    const [entity, setEntity] = useState(start);
    const sheet = toSheet(engine().evaluate(entity).built, entity);
    const spend: SpendSlots = (group, spent) => setEntity((current) => setSpentSlots(engine(), current, sheet.spellcasting!, group, spent));
    return (
      <>
        {withSheet && <CharacterSheet sheet={sheet} onSpendSlots={spend} />}
        <SpellsPanel open onOpenChange={() => {}} spellcasting={sheet.spellcasting!} classes={sheet.classes} builderHref="/b" onSpendSlots={spend} />
      </>
    );
  }
  render(<RouterProvider router={createMemoryRouter([{ path: "/", element: <Live /> }], { initialEntries: ["/"] })} />);
  return screen.findByRole("dialog", { name: "Spells" });
}

/** A cleric 5 / warlock 3 with some spells, by the builder's calls: rows, with the Pact entry. */
function cleric5Warlock3(): StrictEntity {
  let entity = buildClasses(
    [
      ["cleric", 5],
      ["warlock", 3],
    ],
    [
      [["class", "cleric", "levels", "level-1", "divine-domain"], "life-domain"],
      ...["guidance", "sacred-flame", "spare-the-dying"].map((key): [string[], string] => [["class", "cleric", "cleric-cantrips-known"], key]),
      ...["eldritch-blast", "mage-hand"].map((key): [string[], string] => [["class", "warlock", "warlock-cantrips-known"], key]),
      ...["hellish-rebuke", "charm-person", "invisibility"].map((key): [string[], string] => [["class", "warlock", "warlock-spells-known"], key]),
    ],
  );
  for (const key of ["healing-word", "aid", "spirit-guardians"]) entity = setPrepared(engine(), entity, "Cleric", key, true);
  return engine().setValue(entity, "character-name", "Maren Ashgrove");
}

/**
 * A wizard 3 / warlock 2 with many prepared spells, by the builder's calls: its 1st-level heading has four circles
 * and the two pact diamonds, the widest heading of a narrow list.
 */
function wizard3Warlock2(): StrictEntity {
  const wizardSpells = ["burning-hands", "charm-person", "detect-magic", "mage-armor", "magic-missile", "shield", "sleep", "thunderwave", "misty-step", "web"];
  let entity = buildClasses(
    [
      ["wizard", 3],
      ["warlock", 2],
    ],
    [
      ...["fire-bolt", "light", "mage-hand"].map((key): [string[], string] => [["class", "wizard", "wizard-cantrips-known"], key]),
      ...wizardSpells.map((key): [string[], string] => [["class", "wizard", "wizard-spells-known"], key]),
      ...["eldritch-blast", "minor-illusion"].map((key): [string[], string] => [["class", "warlock", "warlock-cantrips-known"], key]),
      ...["hellish-rebuke", "expeditious-retreat", "unseen-servant"].map((key): [string[], string] => [["class", "warlock", "warlock-spells-known"], key]),
    ],
  );
  for (const key of wizardSpells) entity = setPrepared(engine(), entity, "Wizard", key, true);
  return engine().setValue(entity, "character-name", "Corin Vale");
}

const block = (dialog: HTMLElement) => dialog.querySelector<HTMLElement>("[data-slots-block]")!;
const grid = (dialog: HTMLElement) => block(dialog).querySelector<HTMLElement>("[data-layout]");
const fold = (dialog: HTMLElement) => within(block(dialog)).getByRole("button", { name: "Spell slots" });
/** The heading row of a level in the list. */
const headingRow = (dialog: HTMLElement, name: string) => within(dialog).getByRole("heading", { level: 3, name }).parentElement!;
/** The slot groups on a heading, sliders or copies, as [label or "copy", value]. */
const headingGroups = (dialog: HTMLElement, name: string) =>
  [...headingRow(dialog, name).querySelectorAll<HTMLElement>(".ui-slot-circles")].map((group) => ({
    slider: group.getAttribute("role") === "slider",
    marked: group.querySelectorAll("[data-marked]").length,
    shape: group.getAttribute("data-shape"),
  }));
/** The entries of the block, as their names: the text of each level name. */
const entryNames = (dialog: HTMLElement) =>
  [...grid(dialog)!.querySelectorAll<HTMLElement>("button, span.whitespace-nowrap")].map((name) => name.textContent).filter((name) => name !== "");
/** The elements that Tab stops at in the panel body, by their names. */
const tabStops = (dialog: HTMLElement) =>
  [...dialog.querySelectorAll<HTMLElement>('[tabindex="0"], button:not([tabindex="-1"]), a, input')]
    .filter((element) => !element.hasAttribute("disabled") && element.closest("[hidden]") === null)
    .map((element) => element.getAttribute("aria-label") ?? element.textContent);

test("a wizard 9 shows one column for each level, 1st level first, with the circles going down; no total", async () => {
  const dialog = await renderLive(buildClasses([["wizard", 9]], [[["class", "wizard", "wizard-cantrips-known"], "fire-bolt"]]));
  expect(grid(dialog)!.getAttribute("data-layout")).toBe("columns");
  expect(entryNames(dialog)).toEqual(["1st", "2nd", "3rd", "4th", "5th"]);
  const sliders = within(block(dialog)).getAllByRole("slider");
  expect(sliders.map((slider) => [slider.getAttribute("aria-label"), slider.getAttribute("aria-valuetext"), slider.getAttribute("aria-orientation")])).toEqual([
    ["1st-level slots", "0 of 4 spent", "vertical"],
    ["2nd-level slots", "0 of 3 spent", "vertical"],
    ["3rd-level slots", "0 of 3 spent", "vertical"],
    ["4th-level slots", "0 of 3 spent", "vertical"],
    ["5th-level slots", "0 of 1 spent", "vertical"],
  ]);
  expect(block(dialog).textContent).not.toMatch(/total/i);
}, 20_000);

test("a cleric 5 shows one row for each level", async () => {
  const dialog = await renderLive(buildClasses([["cleric", 5]]));
  expect(grid(dialog)!.getAttribute("data-layout")).toBe("rows");
  expect(entryNames(dialog)).toEqual(["1st", "2nd", "3rd"]);
  expect(
    within(block(dialog))
      .getAllByRole("slider")
      .map((slider) => slider.getAttribute("aria-orientation")),
  ).toEqual(["horizontal", "horizontal", "horizontal"]);
}, 20_000);

test("a warlock shows the Pact entry with the diamonds, and no entry of circles; the heading has the Pact label and the diamonds", async () => {
  const dialog = await renderLive(fixture("warlock-10-drow"));
  // One entry: rows, though its slots are of the 5th level.
  expect(grid(dialog)!.getAttribute("data-layout")).toBe("rows");
  expect(entryNames(dialog)).toEqual(["Pact 5th"]);
  const [pact] = within(block(dialog)).getAllByRole("slider");
  expect([pact!.getAttribute("aria-label"), pact!.getAttribute("aria-valuetext"), pact!.getAttribute("data-shape")]).toEqual([
    "Pact slots, 5th level",
    "0 of 2 spent",
    "diamond",
  ]);
  expect(within(block(dialog)).getByRole("button", { name: "Pact 5th, go to 5th level" })).toBeTruthy();
  const fifth = headingRow(dialog, "5th level");
  expect(fifth.textContent).toBe("5th levelPact");
  expect(headingGroups(dialog, "5th level")).toEqual([{ slider: false, marked: 0, shape: "diamond" }]);
}, 20_000);

test("e2e/cleric-5-warlock-3.strict.json is the cleric 5 / warlock 3, by the builder's calls", () => {
  expect(e2eFile("cleric-5-warlock-3")).toEqual(JSON.parse(JSON.stringify(cleric5Warlock3())));
}, 20_000);

test("e2e/wizard-3-warlock-2.strict.json is the wizard 3 / warlock 2, by the builder's calls", () => {
  expect(e2eFile("wizard-3-warlock-2")).toEqual(JSON.parse(JSON.stringify(wizard3Warlock2())));
}, 20_000);

test("a wizard 3 / warlock 2: the 1st-level heading has the circles, then the Pact label and the diamonds", async () => {
  const dialog = await renderLive(e2eFile("wizard-3-warlock-2"));
  expect(grid(dialog)!.getAttribute("data-layout")).toBe("rows");
  expect(entryNames(dialog)).toEqual(["1st", "2nd", "Pact 1st"]);
  expect(headingGroups(dialog, "1st level").map((group) => group.shape)).toEqual([null, "diamond"]);
}, 20_000);

test("a cleric 5 / warlock 3 shows rows, with the Pact entry after the levels: Pact 2nd", async () => {
  const dialog = await renderLive(cleric5Warlock3());
  expect(grid(dialog)!.getAttribute("data-layout")).toBe("rows");
  expect(entryNames(dialog)).toEqual(["1st", "2nd", "3rd", "Pact 2nd"]);
  // The 2nd-level heading: the circles, then the Pact label and the diamonds at the right end.
  expect(headingGroups(dialog, "2nd level").map((group) => group.shape)).toEqual([null, "diamond"]);
  expect(headingRow(dialog, "2nd level").textContent).toBe("2nd levelPact");
}, 20_000);

test("a multiclass warlock shows its 5th-level circles and then the Pact entry; its heading shows circles, then diamonds", async () => {
  const dialog = await renderLive(e2eFile("warlock-10-sorcerer-9"));
  expect(grid(dialog)!.getAttribute("data-layout")).toBe("columns");
  expect(entryNames(dialog)).toEqual(["1st", "2nd", "3rd", "4th", "5th", "Pact5th"]);
  expect(
    within(block(dialog))
      .getAllByRole("slider")
      .slice(-2)
      .map((slider) => [slider.getAttribute("aria-label"), slider.getAttribute("aria-valuetext")]),
  ).toEqual([
    ["5th-level slots", "0 of 1 spent"],
    ["Pact slots, 5th level", "0 of 2 spent"],
  ]);
  expect(headingGroups(dialog, "5th level").map((group) => group.shape)).toEqual([null, "diamond"]);
}, 20_000);

test("a slot spent in the block shows on the level heading and on the sheet, and the reverse", async () => {
  const dialog = await renderLive(e2eFile("warlock-10-sorcerer-9"), { sheet: true });
  /** The sheet's slider of a group: the sheet is behind the modal panel. */
  const onSheet = (name: string) => screen.getAllByRole("slider", { name, hidden: true }).find((slider) => !dialog.contains(slider))!;
  const inBlock = (name: string) => within(block(dialog)).getByRole("slider", { name });
  fireEvent.click(inBlock("Pact slots, 5th level").children[1]!);
  fireEvent.keyDown(inBlock("1st-level slots"), { key: "ArrowUp" });
  expect(inBlock("Pact slots, 5th level").getAttribute("aria-valuetext")).toBe("1 of 2 spent");
  expect(headingGroups(dialog, "5th level")).toEqual([
    { slider: false, marked: 0, shape: null },
    { slider: false, marked: 1, shape: "diamond" },
  ]);
  expect(headingGroups(dialog, "1st level")[0]!.marked).toBe(1);
  expect(onSheet("Pact slots, 5th level").getAttribute("aria-valuetext")).toBe("1 of 2 spent");
  expect(onSheet("5th-level slots").getAttribute("aria-valuetext")).toBe("0 of 1 spent");
  expect(onSheet("1st-level slots").getAttribute("aria-valuetext")).toBe("1 of 4 spent");
  // The sheet spends one: the block and the heading show it.
  fireEvent.click(onSheet("5th-level slots").children[0]!);
  expect(inBlock("5th-level slots").getAttribute("aria-valuetext")).toBe("1 of 1 spent");
  expect(headingGroups(dialog, "5th level")[0]!.marked).toBe(1);
  // A click on a copy on a heading changes the same state, and the focus stays where it was.
  const focused = document.activeElement;
  fireEvent.click(headingRow(dialog, "1st level").querySelector(".ui-slot-circle[data-marked]")!);
  expect(inBlock("1st-level slots").getAttribute("aria-valuetext")).toBe("0 of 4 spent");
  expect(onSheet("1st-level slots").getAttribute("aria-valuetext")).toBe("0 of 4 spent");
  expect(document.activeElement).toBe(focused);
}, 30_000);

test("a click on a circle in the block keeps the focus on its group", async () => {
  const dialog = await renderLive(e2eFile("life-cleric-9"));
  const third = within(block(dialog)).getByRole("slider", { name: "3rd-level slots" });
  fireEvent.click(third.children[2]!);
  expect(document.activeElement).toBe(third);
  expect(third.getAttribute("aria-valuetext")).toBe("1 of 3 spent");
}, 20_000);

test("the block starts open; the fold button folds it, and a folded block is folded at the next open", async () => {
  let dialog = await renderLive(e2eFile("life-cleric-9"));
  expect(fold(dialog).getAttribute("aria-expanded")).toBe("true");
  expect(grid(dialog)).not.toBeNull();
  fireEvent.click(fold(dialog));
  expect(fold(dialog).getAttribute("aria-expanded")).toBe("false");
  expect(grid(dialog)).toBeNull();
  expect(localStorage.getItem(SPELL_SLOTS_FOLDED_KEY)).toBe("1");
  cleanup();
  dialog = await renderLive(e2eFile("life-cleric-9"));
  expect(fold(dialog).getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(fold(dialog));
  expect(localStorage.getItem(SPELL_SLOTS_FOLDED_KEY)).toBeNull();
}, 20_000);

test("storage that throws does not break the panel: the fold stays in memory", async () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const dialog = await renderLive(e2eFile("life-cleric-9"));
  expect(fold(dialog).getAttribute("aria-expanded")).toBe("true");
  fireEvent.click(fold(dialog));
  expect(fold(dialog).getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(fold(dialog));
  expect(fold(dialog).getAttribute("aria-expanded")).toBe("true");
}, 20_000);

test("each level has one Tab stop for its slots, two with circles and diamonds: in the block while it is open, on the headings while it is folded", async () => {
  const dialog = await renderLive(e2eFile("warlock-10-sorcerer-9"));
  const slots = ["1st-level slots", "2nd-level slots", "3rd-level slots", "4th-level slots", "5th-level slots", "Pact slots, 5th level"];
  // The order of the block: the levels, then the Pact entry.
  const blockOrder = [...slots.filter((name) => !name.startsWith("Pact")), "Pact slots, 5th level"];
  const sliderStops = () => tabStops(dialog).filter((name) => name !== null && slots.includes(name));
  expect(sliderStops()).toEqual(blockOrder);
  // The copies on the headings: no stops, and hidden from a screen reader.
  for (const copy of dialog.querySelectorAll("[data-pane=list] .ui-slot-circles")) {
    expect(copy.closest("[aria-hidden=true]")).not.toBeNull();
    expect(copy.hasAttribute("tabindex")).toBe(false);
  }
  expect(within(dialog).getAllByRole("slider")).toHaveLength(6);
  fireEvent.click(fold(dialog));
  // Folded: the groups on the headings are the stops, in the order of the list.
  expect(sliderStops()).toEqual(slots);
  for (const slider of within(dialog).getAllByRole("slider")) expect(slider.closest("[data-pane=list]")).not.toBeNull();
  // The rows stay one stop.
  expect(dialog.querySelectorAll('[data-spell-row][tabindex="0"]')).toHaveLength(1);
}, 20_000);

test("the arrow keys on a heading's slots change the slots and do not move the focus to a row", async () => {
  localStorage.setItem(SPELL_SLOTS_FOLDED_KEY, "1");
  const dialog = await renderLive(e2eFile("life-cleric-9"));
  const first = within(headingRow(dialog, "1st level")).getByRole("slider", { name: "1st-level slots" });
  first.focus();
  fireEvent.keyDown(first, { key: "ArrowDown" });
  fireEvent.keyDown(first, { key: "ArrowUp" });
  fireEvent.keyDown(first, { key: "ArrowUp" });
  expect(document.activeElement).toBe(first);
  expect(first.getAttribute("aria-valuetext")).toBe("2 of 4 spent");
}, 20_000);

test("a level link scrolls the list to its level, smoothly, but not under reduced motion; the focus stays on the link", async () => {
  const scrollTo = vi.fn();
  HTMLElement.prototype.scrollTo = scrollTo;
  try {
    let dialog = await renderLive(e2eFile("life-cleric-9"));
    const link = within(block(dialog)).getByRole("button", { name: "Go to 3rd level" });
    link.focus();
    fireEvent.click(link);
    expect(scrollTo).toHaveBeenCalledWith({ top: expect.any(Number), behavior: "smooth" });
    expect(document.activeElement).toBe(link);
    cleanup();
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      addEventListener() {},
      removeEventListener() {},
    }));
    dialog = await renderLive(e2eFile("life-cleric-9"));
    fireEvent.click(within(block(dialog)).getByRole("button", { name: "Go to 5th level" }));
    expect(scrollTo).toHaveBeenLastCalledWith({ top: expect.any(Number), behavior: "instant" });
  } finally {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo;
  }
}, 20_000);

test("a search that hides a level disables its link; the block keeps the entry and its slots", async () => {
  const dialog = await renderLive(e2eFile("life-cleric-9"));
  fireEvent.change(within(dialog).getByRole("textbox", { name: "Search spells" }), { target: { value: "heal" } });
  expect((within(block(dialog)).getByRole("button", { name: "Go to 1st level" }) as HTMLButtonElement).disabled).toBe(false);
  expect((within(block(dialog)).getByRole("button", { name: "Go to 3rd level" }) as HTMLButtonElement).disabled).toBe(true);
  expect(within(block(dialog)).getByRole("slider", { name: "3rd-level slots" })).toBeTruthy();
}, 20_000);

test("on a phone the block is at the top of the list view and of the spell view; in the spell view the level names are plain text", async () => {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: query === "(max-width: 600px)", addEventListener() {}, removeEventListener() {} }));
  const dialog = await renderLive(e2eFile("life-cleric-9"));
  const panes = dialog.querySelector("[data-pane=list]")!.parentElement!;
  expect(panes.firstElementChild!.contains(block(dialog))).toBe(true);
  expect(within(block(dialog)).getByRole("button", { name: "Go to 1st level" })).toBeTruthy();
  fireEvent.click(within(dialog).getByRole("button", { name: /^Aid/ }));
  await waitFor(() => expect(dialog.querySelector("[data-pane=list]")!.hasAttribute("hidden")).toBe(true));
  expect(block(dialog).closest("[hidden]")).toBeNull();
  expect(within(block(dialog)).queryByRole("button", { name: "Go to 1st level" })).toBeNull();
  expect(entryNames(dialog)).toEqual(["1st", "2nd", "3rd", "4th", "5th"]);
  // The slots still change there.
  fireEvent.keyDown(within(block(dialog)).getByRole("slider", { name: "2nd-level slots" }), { key: "ArrowRight" });
  expect(within(block(dialog)).getByRole("slider", { name: "2nd-level slots" }).getAttribute("aria-valuetext")).toBe("1 of 3 spent");
}, 20_000);
