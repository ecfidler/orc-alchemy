import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";

beforeAll(() => loadEngine());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Opens the entity in the builder, on the Abilities step. */
function open(entity: StrictEntity) {
  useCharacter.getState().load("abilities", entity);
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: "Abilities" }));
}

const dwarf = () => engine().select(engine().emptyCharacter(), ["race"], "dwarf");
const method = (name: string) => screen.getByRole("button", { name });
const table = () => screen.getByRole("table", { name: "Ability scores" });
/** A row's cells after its header, as text. */
const row = (name: string) =>
  Array.from(within(table()).getByRole("row", { name: new RegExp(`^${name}`) }).querySelectorAll("td"), (cell) => cell.textContent);
const built = () => {
  const abilities = engine().evaluate(useCharacter.getState().entity!).built.abilities;
  return ["str", "dex", "con", "int", "wis", "cha"].map((a) => abilities[`orcpub.dnd.e5.character/${a}` as keyof typeof abilities]);
};

test("Standard Scores is the default, and a swap moves a score to its neighbour", () => {
  open(dwarf());
  expect(screen.getByRole("heading", { name: "Base Ability Scores" })).toBeTruthy();
  expect(method("Standard Scores").getAttribute("aria-pressed")).toBe("true");
  expect(method("Point Buy").getAttribute("aria-pressed")).toBe("false");
  expect(row("Race")).toEqual(["0", "0", "+2", "0", "0", "0"]);
  expect(row("Total")).toEqual(["15", "14", "15", "12", "10", "8"]);
  expect(row("Modifier")).toEqual(["+2", "+2", "+2", "+1", "0", "-1"]);
  // A dwarf with no subrace picked has no subrace, improvement or other row.
  expect(within(table()).queryByRole("row", { name: /^Subrace/ })).toBeNull();
  expect(within(table()).queryByRole("row", { name: /^Improvements/ })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Move STR left" }));
  expect(built()).toEqual([8, 14, 15, 12, 10, 15]);
  fireEvent.click(screen.getByRole("button", { name: "Move DEX right" }));
  expect(row("Total")).toEqual(["8", "13", "16", "12", "10", "15"]);
});

test("Point Buy starts at 8s and counts points, within the old limits", () => {
  open(dwarf());
  fireEvent.click(method("Point Buy"));
  expect(method("Point Buy").getAttribute("aria-pressed")).toBe("true");
  expect(built()).toEqual([8, 8, 10, 8, 8, 8]);
  expect(screen.getByText("Points left: 27 of 27")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Decrease STR" }).hasAttribute("disabled")).toBe(true);

  const increase = screen.getByRole("button", { name: "Increase STR" });
  for (let i = 0; i < 7; i++) fireEvent.click(increase);
  expect(built()[0]).toBe(15);
  expect(screen.getByText("Points left: 18 of 27")).toBeTruthy();
  // As the old point buy, each score shows its cost.
  expect(row("Base")).toEqual(["−15(9 pts)+", ...Array(5).fill("−8(0 pts)+")]);
  expect(increase.hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Decrease STR" }));
  expect(screen.getByText("Points left: 20 of 27")).toBeTruthy();
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
  expect(screen.getByText("Points: 2 too many of 27")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Increase STR" }).hasAttribute("disabled")).toBe(true);
});

test("Standard Roll rolls 4d6 for each ability, and Re-roll rolls again", () => {
  open(dwarf());
  // Every die a 3, then every die a 5.
  vi.spyOn(Math, "random").mockReturnValue(2 / 6);
  fireEvent.click(method("Standard Roll"));
  expect(built()).toEqual([9, 9, 11, 9, 9, 9]);
  expect(screen.getByRole("button", { name: "Move CHA right" })).toBeTruthy();
  vi.spyOn(Math, "random").mockReturnValue(4 / 6);
  fireEvent.click(screen.getByRole("button", { name: "Re-roll" }));
  expect(built()).toEqual([15, 15, 17, 15, 15, 15]);
});

test("Manual Entry keeps the scores, and writes a typed score from 1 to 30", () => {
  open(dwarf());
  fireEvent.click(screen.getByRole("button", { name: "Move STR right" }));
  fireEvent.click(method("Manual Entry"));
  expect(built()).toEqual([14, 15, 15, 12, 10, 8]);

  const str = screen.getByLabelText<HTMLInputElement>("STR base score");
  expect(str.value).toBe("14");
  // A cleared field is not written, and keeps its text.
  fireEvent.change(str, { target: { value: "" } });
  expect(str.value).toBe("");
  expect(built()[0]).toBe(14);
  fireEvent.change(str, { target: { value: "18" } });
  expect(built()[0]).toBe(18);
  expect(row("Total")[0]).toBe("18");
  fireEvent.change(str, { target: { value: "31" } });
  expect(built()[0]).toBe(18);
  fireEvent.change(screen.getByLabelText("CON base score"), { target: { value: "3" } });
  expect(row("Total")).toEqual(["18", "15", "5", "12", "10", "8"]);

  // Standard Scores puts the standard scores back.
  fireEvent.click(method("Standard Scores"));
  expect(built()).toEqual([15, 14, 15, 12, 10, 8]);
});
