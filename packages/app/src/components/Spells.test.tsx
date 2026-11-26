import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { loadSpellContent, preparedSpells } from "../engine/spells.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";
import { FULL_REASON, PER_LINE, pickLines, reservedPicks } from "./Spells.tsx";

// The prepare boxes wait for the spell records (ORC-288), so the records load first.
beforeAll(async () => {
  await loadEngine();
  await loadSpellContent();
});
afterEach(cleanup);

const q = (ability: string) => `~:orcpub.dnd.e5.character/${ability}`;

/** A character of the class at the level (1 by default), with Int 10 and Wis 13, as stored before the Spells step. */
function caster(klass: string, levels = 1): StrictEntity {
  const e = engine();
  const scores = { str: 8, dex: 14, con: 13, int: 10, wis: 13, cha: 15 };
  let entity = e.setField(e.emptyCharacter(), ["ability-scores", "standard-scores"], Object.fromEntries(Object.entries(scores).map(([a, n]) => [q(a), n])));
  entity = e.setClass(entity, 0, klass);
  for (let n = 1; n < levels; n++) entity = e.addLevel(entity, klass);
  return entity;
}

/** A character of the fixtures of the fork. */
const fixtureStrict = (name: string): StrictEntity =>
  JSON.parse(readFileSync(join(import.meta.dirname, `../../../../fixtures/characters/${name}.strict.json`), "utf8"));

/** Opens the entity in the builder, on the Spells step. */
function open(id: string, entity: StrictEntity) {
  useCharacter.getState().load(id, entity);
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Spells/ }));
}

const entity = () => useCharacter.getState().entity!;
// With the popup open, the page behind it is hidden from a screen reader, so the step is found with its hidden parts.
const region = (name: string) => within(screen.getByRole("region", { name: new RegExp(`^${name}`), hidden: true }));
/** The prepare counts of the Spells step: [state, text]. */
const counts = () => [...document.querySelectorAll("[data-prepare-count]")].map((count) => [count.getAttribute("data-prepare-count"), count.textContent]);
/** The "Add spells" popup of a selection, after a click on its button. */
function openPopup(name: string) {
  fireEvent.click(screen.getByRole("button", { name: `Add spells: ${name}` }));
  return within(screen.getByRole("dialog", { name }));
}
/** The box of a spell in the open popup. */
const box = (name: string) => within(screen.getByRole("dialog")).getByRole("checkbox", { name: `Chosen: ${name}` });
/** The names of the picks on the step. */
const chosen = (name: string) =>
  within(screen.getByRole("list", { name: `Chosen: ${name}`, hidden: true }))
    .queryAllByRole("button", { hidden: true })
    .map((b) => b.textContent);
/** The number of known spells of the level in the built character. */
const known = (level: number) => engine().evaluate(entity()).built["spells-known"]?.[String(level)]?.__entries.length ?? 0;

test("the step shows the heading, the picks and the Add spells button of a selection; it has no cards, no level filter and no search", () => {
  open("spells-wizard-1-step", caster("wizard"));
  const cantrips = region("Wizard Cantrips Known");
  // The picks to make are an inline note in the heading.
  expect(cantrips.getByRole("heading").textContent).toBe("Wizard Cantrips Known,3 left");
  // The list of the picks is there before the first pick, so the pick does not move the button (ORC-352, ORC-357).
  expect(chosen("Wizard Cantrips Known")).toEqual([]);
  expect(cantrips.getByRole("button", { name: "Add spells: Wizard Cantrips Known" }).textContent).toBe("Add spells");
  expect(cantrips.queryByRole("button", { name: "Acid Splash" })).toBeNull();
  expect(screen.queryByRole("combobox", { name: /^Level/ })).toBeNull();
  expect(screen.queryByRole("searchbox")).toBeNull();
});

test("a box in the popup adds a cantrip and removes it; the count of the popup and the mark of the step follow", () => {
  open("spells-wizard-1-add", caster("wizard"));
  const popup = openPopup("Wizard Cantrips Known");
  // The title is the heading of the selection, with its count as the left mark.
  expect(popup.getByRole("heading", { level: 2 }).textContent).toBe("Wizard Cantrips Known,3 left");
  // The list has only the options of the selection: the cantrips, by level.
  expect(popup.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Cantrips", "Acid Splash"]);
  fireEvent.click(box("Acid Splash"));
  expect(box("Acid Splash")).toBeChecked();
  expect(known(0)).toBe(1);
  expect(popup.getByRole("heading", { level: 2 }).textContent).toBe("Wizard Cantrips Known,2 left");
  expect(region("Wizard Cantrips Known").getByRole("heading", { hidden: true }).textContent).toBe("Wizard Cantrips Known,2 left");
  expect(chosen("Wizard Cantrips Known")).toEqual(["Acid Splash"]);
  // A second click removes it.
  fireEvent.click(box("Acid Splash"));
  expect(box("Acid Splash")).not.toBeChecked();
  expect(popup.getByRole("heading", { level: 2 }).textContent).toBe("Wizard Cantrips Known,3 left");
  expect(chosen("Wizard Cantrips Known")).toEqual([]);
  // Space on a row changes its box too.
  const row = popup.getByRole("button", { name: "Fire Bolt, not chosen" });
  fireEvent.keyDown(row, { key: " " });
  fireEvent.keyUp(row, { key: " " });
  expect(box("Fire Bolt")).toBeChecked();
  expect(chosen("Wizard Cantrips Known")).toEqual(["Fire Bolt"]);
});

test("at the maximum the other boxes are disabled, with the reason; the count is a green Done; a remove enables them again", () => {
  open("spells-wizard-1-full", caster("wizard"));
  const popup = openPopup("Wizard Cantrips Known");
  for (const name of ["Acid Splash", "Fire Bolt", "Light"]) fireEvent.click(box(name));
  expect(popup.getByRole("heading", { level: 2 }).textContent).toBe("Wizard Cantrips Known,Done");
  expect(popup.getByRole("heading", { level: 2 }).querySelector("[data-success]")).not.toBeNull();
  const mending = box("Mending");
  expect(mending).toHaveAttribute("aria-disabled", "true");
  expect(document.getElementById(mending.getAttribute("aria-describedby")!)!.textContent).toBe(FULL_REASON);
  // A click on a disabled box adds nothing.
  fireEvent.click(mending);
  expect(box("Mending")).not.toBeChecked();
  // The boxes of the picks can still change.
  expect(box("Light")).not.toHaveAttribute("aria-disabled", "true");
  fireEvent.click(box("Light"));
  expect(popup.getByRole("heading", { level: 2 }).textContent).toBe("Wizard Cantrips Known,1 left");
  expect(box("Mending")).not.toHaveAttribute("aria-disabled", "true");
  expect(box("Mending")).not.toHaveAttribute("aria-describedby");
  expect(chosen("Wizard Cantrips Known")).toEqual(["Acid Splash", "Fire Bolt"]);
});

test("a selection with no maximum never disables a box: a wizard 1 adds more spells than its 6 to its spellbook", () => {
  open("spells-wizard-1-book", caster("wizard"));
  const popup = openPopup("Wizard Spells Known");
  // The 1st-level spells of the wizard list, A to Z by the names of the records.
  const names = [...document.querySelectorAll("[data-spell-row]")].map((row) => row.textContent);
  expect(names.slice(0, 3)).toEqual(["AlarmRitual", "Burning Hands", "Charm Person"]);
  for (const name of ["Alarm", "Burning Hands", "Charm Person", "Comprehend Languages", "Detect Magic", "Disguise Self"]) fireEvent.click(box(name));
  expect(popup.getByRole("heading", { level: 2 }).textContent).toBe("Wizard Spells Known,Done");
  expect(box("Feather Fall")).not.toHaveAttribute("aria-disabled", "true");
  fireEvent.click(box("Feather Fall"));
  expect(box("Feather Fall")).toBeChecked();
  expect(known(1)).toBe(7);
});

test("the search narrows the list of the popup; a name on the step opens the popup at its spell; Done closes it", () => {
  open("spells-wizard-1-search", caster("wizard"));
  const popup = openPopup("Wizard Spells Known");
  fireEvent.change(popup.getByRole("textbox", { name: "Search spells" }), { target: { value: "magic m" } });
  expect(popup.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Magic Missile"]);
  fireEvent.click(box("Magic Missile"));
  fireEvent.click(popup.getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(chosen("Wizard Spells Known")).toEqual(["Magic Missile"]);
  // The name opens the popup at the spell: its row is current, and the spell view shows it.
  fireEvent.click(within(screen.getByRole("list", { name: "Chosen: Wizard Spells Known" })).getByRole("button", { name: "Magic Missile" }));
  const again = within(screen.getByRole("dialog", { name: "Wizard Spells Known" }));
  expect(again.getByRole("button", { name: "Magic Missile, chosen" })).toHaveAttribute("aria-current", "true");
  const view = within(again.getByRole("region", { name: "Magic Missile" }));
  expect(view.getByRole("checkbox", { name: "Chosen" })).toBeChecked();
  // The box of the spell view removes the spell too.
  fireEvent.click(view.getByRole("checkbox", { name: "Chosen" }));
  expect(chosen("Wizard Spells Known")).toEqual([]);
});

test("the picks of a wizard 3 show by level, with a heading for each level", () => {
  open("spells-wizard-3", caster("wizard", 3));
  const popup = openPopup("Wizard Spells Known");
  expect(popup.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["1st level", "2nd level", "Alarm"]);
  expect(popup.getByRole("group", { name: "2nd level" })).toBeTruthy();
  fireEvent.click(box("Blur"));
  fireEvent.click(box("Alarm"));
  const list = screen.getByRole("list", { name: "Chosen: Wizard Spells Known", hidden: true });
  expect(
    within(list)
      .getAllByRole("listitem", { hidden: true })
      .map((item) => item.textContent),
  ).toEqual(["1st level", "Alarm", "2nd level", "Blur"]);
});

test("a wizard 1 adds two spells in the popup, and prepares one spell of 1 on the step", () => {
  open("spells-wizard-1-prepare", caster("wizard"));
  openPopup("Wizard Spells Known");
  fireEvent.click(box("Alarm"));
  fireEvent.click(box("Burning Hands"));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  // Int 10: a wizard 1 prepares 1 spell.
  const prepared = region("Prepared spells: Wizard");
  expect(prepared.getByText("0 of 1 prepared")).toBeTruthy();
  fireEvent.click(prepared.getByRole("checkbox", { name: "Prepared: Alarm" }));
  expect(region("Prepared spells: Wizard").getByText("1 of 1 prepared")).toBeTruthy();
  expect(preparedSpells(entity())).toEqual({ Wizard: new Set(["alarm"]) });
  expect(screen.getByRole("checkbox", { name: "Prepared: Alarm" })).toBeChecked();
  // At the limit the other boxes stay on (ORC-288).
  expect(screen.getByRole("checkbox", { name: "Prepared: Burning Hands" })).not.toHaveAttribute("aria-disabled", "true");
  fireEvent.click(screen.getByRole("checkbox", { name: "Prepared: Alarm" }));
  expect(preparedSpells(entity())).toEqual({ Wizard: new Set() });
});

test("a cleric is told it does not select known spells", () => {
  open("spells-cleric-1", caster("cleric"));
  expect(
    screen.getByText("Except for cantrips, Clerics do not need to select known spells since they can prepare any spell available in their class spell lists."),
  ).toBeTruthy();
  // Wis 13: a cleric 1 prepares 2 of the spells it knows.
  expect(region("Prepared spells: Cleric").getByText("0 of 2 prepared")).toBeTruthy();
});

test("a Life cleric's domain spells are always prepared and take no place in its count", () => {
  const e = engine();
  open("spells-life-cleric-1", e.select(caster("cleric"), ["class", "cleric", "levels", "level-1", "divine-domain"], "life-domain"));
  const prepared = region("Prepared spells: Cleric");
  expect(prepared.getByText("0 of 2 prepared")).toBeTruthy();
  const bless = prepared.getByRole("checkbox", { name: "Prepared: Bless" });
  expect(bless).toBeChecked();
  expect(bless).toHaveAttribute("aria-disabled", "true");
  fireEvent.click(prepared.getByRole("checkbox", { name: "Prepared: Bane" }));
  expect(region("Prepared spells: Cleric").getByText("1 of 2 prepared")).toBeTruthy();
  expect(preparedSpells(entity())).toEqual({ Cleric: new Set(["bane"]) });
  // A click on the always-prepared box changes nothing.
  fireEvent.click(region("Prepared spells: Cleric").getByRole("checkbox", { name: "Prepared: Bless" }));
  expect(region("Prepared spells: Cleric").getByRole("checkbox", { name: "Prepared: Bless" })).toBeChecked();
  expect(counts()).toEqual([["under", "1 of 2 prepared"]]);
  expect(preparedSpells(entity())).toEqual({ Cleric: new Set(["bane"]) });
});

test("a cleric at the limit can prepare one more spell: the count is red and says to remove 1 spell (ORC-288)", () => {
  open("spells-cleric-over", caster("cleric"));
  const box = (name: string) => region("Prepared spells: Cleric").getByRole("checkbox", { name: `Prepared: ${name}` });
  // Under the limit: yellow.
  expect(counts()).toEqual([["under", "0 of 2 prepared"]]);
  fireEvent.click(box("Bane"));
  fireEvent.click(box("Bless"));
  // At the limit: green, and the count shows in the builder.
  expect(counts()).toEqual([["at", "2 of 2 prepared"]]);
  expect(box("Command")).not.toHaveAttribute("aria-disabled", "true");
  fireEvent.click(box("Command"));
  // Over the limit: red, with the spells to remove. The app removes nothing.
  expect(counts()).toEqual([["over", "3 of 2 prepared. Remove 1 spell."]]);
  expect(preparedSpells(entity())).toEqual({ Cleric: new Set(["bane", "bless", "command"]) });
  fireEvent.click(box("Bless"));
  expect(counts()).toEqual([["at", "2 of 2 prepared"]]);
});

test("the Spells step of a paladin 2 is not empty: it has no spell to pick, but it has spells to prepare", () => {
  open("spells-paladin-2", caster("paladin", 2));
  const spells = within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Spells/ });
  expect(spells.hasAttribute("data-dimmed")).toBe(false);
  expect(screen.queryByText("This character has no spell to pick.")).toBeNull();
  expect(screen.getByRole("region", { name: /^Prepared spells: Paladin/ })).toBeTruthy();
});

test("the space of the picks keeps the lines of the most picks: a line for each 2 or 4 names, a new line at each level, and a heading line for each level", () => {
  // Wizard cantrips: 3 names of one level, with no level heading.
  expect([pickLines(3, 1, PER_LINE.narrow), pickLines(3, 1, PER_LINE.wide)]).toEqual([2, 1]);
  // A wizard 1's spellbook: 6 names of one level.
  expect([pickLines(6, 1, PER_LINE.narrow), pickLines(6, 1, PER_LINE.wide)]).toEqual([3, 2]);
  // A wizard 3's spellbook: 8 names of two levels, each level with its heading.
  expect([pickLines(8, 2, PER_LINE.narrow), pickLines(8, 2, PER_LINE.wide)]).toEqual([7, 5]);
  // A selection with no pick to make keeps one line.
  expect(pickLines(0, 1, PER_LINE.narrow)).toBe(1);
  // The space is for the maximum, or with no maximum for the picks to make, or the picks when they are more.
  expect(reservedPicks({ max: 3, min: 3, selected: [] })).toBe(3);
  expect(reservedPicks({ max: null, min: 6, selected: [] })).toBe(6);
  expect(reservedPicks({ max: null, min: 6, selected: ["a", "b", "c", "d", "e", "f", "g"] })).toBe(7);
});

test("Eldritch Invocations of warlock-10-drow has the control of its kind, not the Add spells popup (ORC-357)", () => {
  open("spells-warlock-10", fixtureStrict("warlock-10-drow"));
  const invocations = region("Eldritch Invocations");
  expect(screen.queryByRole("button", { name: "Add spells: Eldritch Invocations" })).toBeNull();
  // 5 picks from more than 6 options: the ui Picker, with the picks as tokens and its add button.
  expect(invocations.getByRole("button", { name: /^Add a choice/ })).toBeTruthy();
  // The spell selections of the warlock keep the popup.
  for (const name of ["Warlock Cantrips Known", "Warlock Spells Known", "Book of Shadows Cantrips", "Book of Ancient Secrets Rituals"])
    expect(screen.getByRole("button", { name: `Add spells: ${name}` })).toBeTruthy();
});

test("Mystic Arcanum: a box replaces the one pick, and the box of the pick is disabled with its reason", () => {
  open("spells-warlock-11", caster("warlock", 11));
  const name = "Mystic Arcanum: Spell Level 6";
  const popup = openPopup(name);
  fireEvent.click(box("Circle of Death"));
  expect(box("Circle of Death")).toBeChecked();
  expect(box("Circle of Death")).toHaveAttribute("aria-disabled", "true");
  expect(document.getElementById(box("Circle of Death").getAttribute("aria-describedby")!)!.textContent).toBe("Pick another spell in its place.");
  expect(popup.getByRole("heading", { level: 2 }).textContent).toBe(`${name},Done`);
  // A box of another spell replaces the pick.
  fireEvent.click(box("Conjure Fey"));
  expect(box("Conjure Fey")).toBeChecked();
  expect(box("Circle of Death")).not.toBeChecked();
  expect(box("Circle of Death")).not.toHaveAttribute("aria-disabled", "true");
  expect(chosen(name)).toEqual(["Conjure Fey"]);
});

test("a change of the count goes in the live region of the popup, with the selection", () => {
  open("spells-wizard-1-live", caster("wizard"));
  const popup = openPopup("Wizard Cantrips Known");
  const live = () => screen.getByRole("dialog").querySelector('[aria-live="polite"]')!.textContent;
  fireEvent.click(box("Acid Splash"));
  expect(live()).toBe("Wizard Cantrips Known: 2 left");
  for (const name of ["Fire Bolt", "Light"]) fireEvent.click(box(name));
  expect(live()?.trim()).toBe("Wizard Cantrips Known: Done");
  expect(popup.getByRole("heading", { level: 2 })).toBeTruthy();
});

test("at the close the focus goes back to the name that opened the popup, or to Add spells when that spell was removed", async () => {
  open("spells-wizard-1-focus", caster("wizard"));
  openPopup("Wizard Spells Known");
  fireEvent.click(box("Magic Missile"));
  fireEvent.click(box("Sleep"));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
  const name = (spell: string) => within(screen.getByRole("list", { name: "Chosen: Wizard Spells Known" })).queryByRole("button", { name: spell });
  // The popup opens from a name and closes: the focus goes back to the name.
  fireEvent.click(name("Sleep")!);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(document.activeElement).toBe(name("Sleep")));
  // The popup opens from a name, and the user removes that spell: the focus goes to Add spells.
  fireEvent.click(name("Magic Missile")!);
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("checkbox", { name: "Chosen: Magic Missile" }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add spells: Wizard Spells Known" })));
  expect(name("Magic Missile")).toBeNull();
});
