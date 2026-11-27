// The Spells step: the picks on the step and the boxes of the "Add spells" popup (ORC-352, ORC-357).
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { loadEngine } from "../engine/engine.ts";
import { loadSpellContent } from "../engine/spells.ts";
import { FULL_REASON, reservedPicks, sizerGroups } from "./Spells.tsx";
import { box, caster, chosen, known, open, openPopup, region } from "./spells-step-testing.tsx";

// The prepare boxes wait for the spell records (ORC-288), so the records load first.
beforeAll(async () => {
  await loadEngine();
  await loadSpellContent();
});
afterEach(cleanup);

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
  ).toEqual(["1st levelAlarm", "Alarm", "2nd levelBlur", "Blur"]);
  // Each level is a list item with its label in front of a list of its names.
  expect(within(list).getAllByRole("list", { hidden: true })).toHaveLength(2);
});

test("the hidden sizer of the picks has the longest names of the most picks, and with levels a group for each level that the picks can fill", () => {
  const spell = (name: string, level: number) => ({ key: name, source: "S", name, castNote: null, level, selected: false });
  const group = (level: number, names: string[]) => ({ level, spells: names.map((name) => spell(name, level)) });
  // One level: the `reserved` longest names, with no label.
  expect(sizerGroups([group(0, ["Light", "Fire Bolt", "Mage Hand", "Prestidigitation"])], 2)).toEqual([
    { label: null, names: ["Prestidigitation", "Fire Bolt"], extraLabels: [] },
  ]);
  // Two levels and 3 picks: the first group has the 3 longest names and the width of the other label; the other
  // group has its label and the longest name.
  expect(sizerGroups([group(1, ["Alarm", "Magic Missile"]), group(2, ["Blur", "Misty Step"])], 3)).toEqual([
    { label: "1st level", names: ["Magic Missile", "Misty Step", "Alarm"], extraLabels: ["2nd level"] },
    { label: "2nd level", names: ["Magic Missile"], extraLabels: [] },
  ]);
  // Many levels and 2 picks: the picks can fill 2 groups only.
  const levels = [1, 2, 3, 4].map((level) => group(level, [`Spell ${level}`]));
  expect(sizerGroups(levels, 2).map((g) => g.label)).toEqual(["1st level", "2nd level"]);
  // No pick to make: one label, no name.
  expect(sizerGroups(levels, 0)).toEqual([{ label: "1st level", names: [], extraLabels: [] }]);
  // The space is for the maximum, or with no maximum for the picks to make, or the picks when they are more.
  expect(reservedPicks({ max: 3, min: 3, selected: [] })).toBe(3);
  expect(reservedPicks({ max: null, min: 6, selected: [] })).toBe(6);
  expect(reservedPicks({ max: null, min: 6, selected: ["a", "b", "c", "d", "e", "f", "g"] })).toBe(7);
});

test("the picks show as a comma separated list; the commas are not in the accessibility tree; with no pick the list shows None", () => {
  open("spells-wizard-1-commas", caster("wizard"));
  const list = () => screen.getByRole("list", { name: "Chosen: Wizard Spells Known" });
  expect(list().textContent).toBe("None");
  openPopup("Wizard Spells Known");
  for (const name of ["Shield", "Mage Armor", "Magic Missile"]) fireEvent.click(box(name));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Done" }));
  expect(list().textContent).toBe("Mage Armor, Magic Missile, Shield");
  expect(
    within(list())
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["Mage Armor, ", "Magic Missile, ", "Shield"]);
  for (const comma of list().querySelectorAll("li > span")) expect(comma).toHaveAttribute("aria-hidden", "true");
  expect(chosen("Wizard Spells Known")).toEqual(["Mage Armor", "Magic Missile", "Shield"]);
});
