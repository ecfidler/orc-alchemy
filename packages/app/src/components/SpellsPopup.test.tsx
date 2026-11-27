// The Spells step: the prepared spells, and the popup of a warlock, the one pick, the live region and the focus (ORC-357).
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine } from "../engine/engine.ts";
import { loadSpellContent, preparedSpells } from "../engine/spells.ts";
import { box, caster, chosen, counts, entity, fixtureStrict, open, openPopup, region } from "./spells-step-testing.tsx";

// The prepare boxes wait for the spell records (ORC-288), so the records load first.
beforeAll(async () => {
  await loadEngine();
  await loadSpellContent();
});
afterEach(cleanup);

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
