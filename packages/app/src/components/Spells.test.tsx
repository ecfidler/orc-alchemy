// The Spells step, part 1: the picks on the step and the boxes of the "Add spells" popup (ORC-352, ORC-357). Part 2
// is SpellsPicks.test.tsx; the two files keep each one in the time budget (ORC-375).
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { loadEngine } from "../engine/engine.ts";
import { loadSpellContent } from "../engine/spells.ts";
import { FULL_REASON } from "./Spells.tsx";
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
