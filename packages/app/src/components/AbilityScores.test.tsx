// The ability score control (ORC-345): the four methods with the six boxes, a swap of two scores by two clicks and by
// the keyboard, and the increases of a choice from a different source. A drag and the layout are in
// e2e/ability-scores.spec.ts, as jsdom has no layout.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";

beforeAll(() => loadEngine());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const NAMES = ["Strength", "Dexterity", "Constitution", "Intelligence", "Wisdom", "Charisma"];

/** Opens the entity in the builder, on the Abilities step. */
function open(entity: StrictEntity) {
  useCharacter.getState().load("abilities", entity);
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Abilities/ }));
}

const dwarf = () => engine().select(engine().emptyCharacter(), ["race"], "dwarf");
const control = () => screen.getByRole("region", { name: /^Base Ability Scores/ });
const method = (name: string) => within(control()).getByRole("button", { name });
const box = (name: string) => within(control()).getByRole("group", { name });
const chip = (name: string) => within(box(name)).getByRole("button", { name: new RegExp(`^${name} base score`) });
/** A text of each box, by its data attribute: the total, the modifier, the cost of the next point, or the tokens. */
const read = (attribute: string) => NAMES.map((name) => [...box(name).querySelectorAll(`[${attribute}]`)].map((e) => e.textContent).join(" | "));
const totals = () => read("data-total").map((text) => text.replace("Total ", ""));
const status = () => within(control()).getByRole("status").textContent;
const strip = () => control().querySelector("[data-strip]")!.textContent;
const built = () => {
  const abilities = engine().evaluate(useCharacter.getState().entity!).built.abilities;
  return ["str", "dex", "con", "int", "wis", "cha"].map((a) => abilities[`orcpub.dnd.e5.character/${a}` as keyof typeof abilities]);
};

test("Standard Scores is the default: six boxes with the total, the modifier and the race's token", () => {
  open(dwarf());
  expect(screen.getByRole("heading", { name: /^Base Ability Scores, ?Done$/ })).toBeTruthy();
  // The methods in the order of the spec.
  expect(
    within(screen.getByRole("group", { name: "Base Ability Scores" }))
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Standard Scores", "Standard Roll", "Point Buy", "Manual Entry"]);
  expect(method("Standard Scores").getAttribute("aria-pressed")).toBe("true");
  expect(totals()).toEqual(["15", "14", "15", "12", "10", "8"]);
  expect(read("data-modifier").map((text) => text.replace("modifier ", ""))).toEqual(["+2", "+2", "+2", "+1", "0", "−1"]);
  // A dwarf with no subrace has only the Con +2 of its race.
  expect(read("data-token")).toEqual(["", "", "+2 Race", "", "", ""]);
  expect(NAMES.map((name) => chip(name).getAttribute("aria-label"))).toEqual(NAMES.map((name, i) => `${name} base score ${[15, 14, 13, 12, 10, 8][i]}`));
  expect(strip()).toBe("Drag a score to a different box, or pick two scores to swap them.");
});

test("two clicks swap two scores, and a live region says the result; a second click on the same chip puts it down", () => {
  open(dwarf());
  fireEvent.click(chip("Strength"));
  expect(chip("Strength").getAttribute("aria-pressed")).toBe("true");
  expect(status()).toBe("Strength 15 picked up.");
  expect(strip()).toBe("Now pick the score to swap with. Escape puts it down.");
  fireEvent.click(chip("Strength"));
  expect(chip("Strength").getAttribute("aria-pressed")).toBe("false");
  expect(status()).toBe("Strength 15 put down.");

  fireEvent.click(chip("Strength"));
  fireEvent.click(chip("Charisma"));
  expect(built()).toEqual([8, 14, 15, 12, 10, 15]);
  expect(status()).toBe("Strength 8, Charisma 15");
  expect(
    within(control())
      .queryAllByRole("button", { pressed: true })
      .filter((b) => b.dataset.chip),
  ).toEqual([]);
  expect(totals()).toEqual(["8", "14", "15", "12", "10", "15"]);
});

test("the keyboard: Enter picks a chip up, Escape puts it down, Space on a second chip swaps, and the focus stays there", () => {
  open(dwarf());
  chip("Dexterity").focus();
  // A key press on a button is a click in a browser; jsdom needs the click.
  fireEvent.keyDown(chip("Dexterity"), { key: "Enter" });
  fireEvent.click(chip("Dexterity"));
  expect(chip("Dexterity").getAttribute("aria-pressed")).toBe("true");
  fireEvent.keyDown(chip("Dexterity"), { key: "Escape" });
  expect(chip("Dexterity").getAttribute("aria-pressed")).toBe("false");
  expect(status()).toBe("Dexterity 14 put down.");

  fireEvent.click(chip("Dexterity"));
  const wisdom = chip("Wisdom");
  wisdom.focus();
  fireEvent.click(wisdom);
  expect(built()).toEqual([15, 10, 15, 12, 14, 8]);
  expect(status()).toBe("Dexterity 10, Wisdom 14");
  expect(document.activeElement).toBe(chip("Wisdom"));
  expect(chip("Wisdom").getAttribute("aria-label")).toBe("Wisdom base score 14");
});

test("the methods are one named tab stop; the arrow keys move between them, a press picks one, and a press of the picked one keeps it", async () => {
  open(dwarf());
  const methods = within(screen.getByRole("group", { name: "Base Ability Scores" })).getAllByRole("button");
  expect(methods.map((m) => m.tabIndex)).toEqual([0, -1, -1, -1]);
  methods[0].focus();
  fireEvent.keyDown(methods[0], { key: "ArrowRight" });
  await waitFor(() => expect(document.activeElement).toBe(method("Standard Roll")));
  fireEvent.keyDown(document.activeElement!, { key: "ArrowRight" });
  await waitFor(() => expect(document.activeElement).toBe(method("Point Buy")));
  fireEvent.click(document.activeElement!);
  expect(method("Point Buy").getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(method("Point Buy"));
  expect(method("Point Buy").getAttribute("aria-pressed")).toBe("true");
  expect(built()).toEqual([8, 8, 10, 8, 8, 8]);
});

test("Point Buy starts at 8s, shows the cost of the next point, and counts points within the old limits", () => {
  open(dwarf());
  fireEvent.click(method("Point Buy"));
  expect(built()).toEqual([8, 8, 10, 8, 8, 8]);
  expect(strip()).toBe("27 of 27 points left");
  expect(read("data-next-cost")).toEqual(Array(6).fill("next: 1 pt"));
  const decrease = within(box("Strength")).getByRole("button", { name: "Decrease Strength" });
  const increase = within(box("Strength")).getByRole("button", { name: "Increase Strength" });
  expect(decrease.hasAttribute("disabled")).toBe(true);

  for (let i = 0; i < 5; i++) fireEvent.click(increase);
  expect(read("data-next-cost")[0]).toBe("next: 2 pt");
  for (let i = 0; i < 2; i++) fireEvent.click(increase);
  expect(built()[0]).toBe(15);
  expect(strip()).toBe("18 of 27 points left");
  expect(read("data-next-cost")[0]).toBe("max");
  expect(increase.hasAttribute("disabled")).toBe(true);
  fireEvent.click(decrease);
  expect(strip()).toBe("20 of 27 points left");
  expect(increase.hasAttribute("disabled")).toBe(false);

  // Clicking the selected method again changes nothing.
  fireEvent.click(method("Point Buy"));
  expect(built()[0]).toBe(14);
});

test("Point Buy shows points spent over 27, from an import", () => {
  // wizard-5's scores cost 29 points.
  const scores = { str: 8, dex: 14, con: 14, int: 15, wis: 12, cha: 10 };
  const value = Object.fromEntries(Object.entries(scores).map(([a, n]) => [`~:orcpub.dnd.e5.character/${a}`, n]));
  open(engine().setField(engine().emptyCharacter(), ["ability-scores", "point-buy"], value));
  expect(strip()).toBe("2 points too many of 27");
  expect(within(box("Strength")).getByRole("button", { name: "Increase Strength" }).hasAttribute("disabled")).toBe(true);
});

test("Standard Roll rolls 4d6 for each ability, and Re-roll rolls again; the scores are chips", () => {
  open(dwarf());
  // Every die a 3, then every die a 5.
  vi.spyOn(Math, "random").mockReturnValue(2 / 6);
  fireEvent.click(method("Standard Roll"));
  expect(built()).toEqual([9, 9, 11, 9, 9, 9]);
  expect(chip("Charisma").getAttribute("aria-label")).toBe("Charisma base score 9");
  vi.spyOn(Math, "random").mockReturnValue(4 / 6);
  fireEvent.click(within(control()).getByRole("button", { name: "Re-roll" }));
  expect(built()).toEqual([15, 15, 17, 15, 15, 15]);
});

test("Manual Entry keeps the scores, and writes a typed score from 1 to 30", () => {
  open(dwarf());
  fireEvent.click(chip("Strength"));
  fireEvent.click(chip("Dexterity"));
  fireEvent.click(method("Manual Entry"));
  expect(built()).toEqual([14, 15, 15, 12, 10, 8]);
  expect(strip()).toBe("Type each base score, from 1 to 30.");

  const str = screen.getByLabelText<HTMLInputElement>("Strength base score");
  expect(str.value).toBe("14");
  // A cleared field is not written, and keeps its text.
  fireEvent.change(str, { target: { value: "" } });
  expect(str.value).toBe("");
  expect(built()[0]).toBe(14);
  fireEvent.change(str, { target: { value: "18" } });
  expect(built()[0]).toBe(18);
  expect(totals()[0]).toBe("18");
  fireEvent.change(str, { target: { value: "31" } });
  expect(built()[0]).toBe(18);
  fireEvent.change(screen.getByLabelText("Constitution base score"), { target: { value: "3" } });
  expect(totals()).toEqual(["18", "15", "5", "12", "10", "8"]);

  // Standard Scores puts the standard scores back.
  fireEvent.click(method("Standard Scores"));
  expect(built()).toEqual([15, 14, 15, 12, 10, 8]);
});

test("the half-elf's increases: a section with its source and left mark, a token in the box, and the engine's refusal in the toast", () => {
  open(engine().select(engine().emptyCharacter(), ["race"], "half-elf"));
  const section = screen.getByRole("region", { name: /^Ability Score Increase: Half-Elf/ });
  const asi = within(section);
  expect(asi.getByRole("heading").textContent).toMatch(/2 left$/);
  // The half-elf's Cha +2 is its race's, so Cha is not offered.
  expect(asi.getByRole("button", { name: "Increase Charisma" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(asi.getByRole("button", { name: "Increase Strength" }));
  expect(read("data-token")).toEqual(["+1 Race", "", "", "", "", "+2 Race"]);
  fireEvent.click(asi.getByRole("button", { name: "Increase Strength" }));
  // The refusal shows in the status toast, a polite live region, and not in the section.
  const toast = document.querySelector<HTMLElement>("[data-toast-status]")!;
  expect([toast.getAttribute("role"), toast.textContent]).toEqual(["status", expect.stringMatching(/different abilities/)]);
  expect(asi.queryByRole("alert")).toBeNull();
  fireEvent.click(asi.getByRole("button", { name: "Increase Dexterity" }));
  expect(asi.getByRole("heading").textContent).toMatch(/Done$/);
  expect(asi.getByRole("button", { name: "Increase Intelligence" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(asi.getByRole("button", { name: "Decrease Strength" }));
  expect(asi.getByRole("button", { name: "Decrease Strength" }).hasAttribute("disabled")).toBe(true);
  expect(asi.getByRole("button", { name: "Increase Intelligence" }).hasAttribute("disabled")).toBe(false);
  expect(read("data-token")).toEqual(["", "+1 Race", "", "", "", "+2 Race"]);
});

test("a plus that would take a total over 20 is disabled", () => {
  const halfElf = engine().select(engine().emptyCharacter(), ["race"], "half-elf");
  const value = Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map((a) => [`~:orcpub.dnd.e5.character/${a}`, a === "str" ? 20 : 10]));
  open(engine().setField(halfElf, ["ability-scores", "manual-entry"], value));
  const asi = within(screen.getByRole("region", { name: /^Ability Score Increase: Half-Elf/ }));
  expect(asi.getByRole("button", { name: "Increase Strength" }).hasAttribute("disabled")).toBe(true);
  expect(asi.getByRole("button", { name: "Increase Dexterity" }).hasAttribute("disabled")).toBe(false);
});

test("an Ability Score Improvement of a class level is a section with the class and the level; more than two sources fold", () => {
  // fighter-20 has six improvements, the human's +1 and an Amulet of Health.
  const fixture = JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/fighter-20.strict.json"), "utf8"));
  open(engine().importCharacter(fixture).entity);
  expect(screen.getAllByRole("heading", { name: /^Ability Score Improvement: Fighter \d+/ }).map((h) => h.textContent?.replace(/Done$/, ""))).toEqual([
    "Ability Score Improvement: Fighter 4,",
    "Ability Score Improvement: Fighter 8,",
    "Ability Score Improvement: Fighter 12,",
    "Ability Score Improvement: Fighter 14,",
    "Ability Score Improvement: Fighter 16,",
    "Ability Score Improvement: Fighter 19,",
  ]);
  // Con: +1 Race, +3 Improvement and +2 Other (the amulet): two tokens, the second the sum of the rest.
  const con = box("Constitution");
  expect([...con.querySelectorAll("[data-token]")].map((t) => t.textContent)).toEqual(["+1 Race", "+5 more"]);
  expect(con.querySelector("[data-tokens]")!.getAttribute("title")).toBe("+1 Race, +3 Improvement, +2 Other");
  expect(con.querySelector("[data-tokens] .sr-only")!.textContent).toBe("+1 Race, +3 Improvement, +2 Other");
});
