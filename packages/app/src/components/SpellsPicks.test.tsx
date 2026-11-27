// The Spells step, part 2: the search of the "Add spells" popup and the picks on the step by level, in a comma
// separated list (ORC-352, ORC-357). Part 1 is Spells.test.tsx; the two files keep each one in the time budget (ORC-375).
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { loadEngine } from "../engine/engine.ts";
import { loadSpellContent } from "../engine/spells.ts";
import { reservedPicks, sizerGroups } from "./Spells.tsx";
import { box, caster, chosen, open, openPopup } from "./spells-step-testing.tsx";

// The prepare boxes wait for the spell records (ORC-288), so the records load first.
beforeAll(async () => {
  await loadEngine();
  await loadSpellContent();
});
afterEach(cleanup);

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
