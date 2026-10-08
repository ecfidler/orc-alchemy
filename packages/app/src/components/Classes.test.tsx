import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { storedHitPoints } from "../engine/classes.ts";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const fighter3Wizard2 = (): StrictEntity => JSON.parse(readFileSync(join(charactersDir, "fighter-3-wizard-2.strict.json"), "utf8"));

beforeAll(() => loadEngine());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Opens the entity in the builder, on the step. */
function open(entity: StrictEntity, step: string) {
  useCharacter.getState().load("classes", entity);
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: new RegExp(`^${step}`) }));
}

const built = () => engine().evaluate(useCharacter.getState().entity!).built;
const region = (name: string) => screen.getByRole("region", { name: new RegExp(`^${name}`) });

test("removing the first class asks first when the next class is above level 1", () => {
  open(fighter3Wizard2(), "Class");
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  fireEvent.click(screen.getByRole("button", { name: "Remove Fighter" }));
  expect(confirm).toHaveBeenCalledWith(
    "Remove Fighter? Wizard becomes the first class and returns to level 1, and its other levels and their choices are removed. This cannot be undone.",
  );
  expect(built().classes).toEqual(["fighter", "wizard"]);

  confirm.mockReturnValue(true);
  fireEvent.click(screen.getByRole("button", { name: "Remove Fighter" }));
  expect(built().classes).toEqual(["wizard"]);
  expect(built().levels.wizard["class-level"]).toBe(1);
  expect((screen.getByLabelText("Class 1") as HTMLSelectElement).value).toBe("wizard");
  expect(screen.getByRole("button", { name: "Remove Wizard" }).hasAttribute("disabled")).toBe(true);
});

test("hit points by roll or typed in", () => {
  open(fighter3Wizard2(), "Class");
  const path = ["class", "wizard", "levels", "level-2", "hit-points"];
  const hp = within(region("Hit Points: Wizard 2"));
  expect(hp.getByRole("button", { name: "Average (4)" }).getAttribute("aria-pressed")).toBe("true");
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  fireEvent.click(hp.getByRole("button", { name: "Roll (1d6)" }));
  expect(storedHitPoints(useCharacter.getState().entity!, path)).toEqual({ method: "roll", value: 4 });
  expect(hp.getByRole("button", { name: "Roll (1d6)" }).getAttribute("aria-pressed")).toBe("true");
  // A cleared field is not written.
  fireEvent.change(hp.getByLabelText("Hit points"), { target: { value: "" } });
  fireEvent.change(hp.getByLabelText("Hit points"), { target: { value: "0" } });
  expect(storedHitPoints(useCharacter.getState().entity!, path)).toEqual({ method: "roll", value: 4 });
  fireEvent.change(hp.getByLabelText("Hit points"), { target: { value: "2" } });
  expect(storedHitPoints(useCharacter.getState().entity!, path)).toEqual({ method: "manual-entry", value: 2 });
});

test("the half-elf's improvement takes two different abilities, and shows the engine's refusal", () => {
  open(engine().select(engine().emptyCharacter(), ["race"], "half-elf"), "Race");
  const asi = within(region("Ability Score Improvement"));
  // The half-elf's CHA +2 is its race's, so CHA is not offered.
  expect(asi.getByRole("button", { name: "Increase CHA" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(asi.getByRole("button", { name: "Increase STR" }));
  fireEvent.click(asi.getByRole("button", { name: "Increase STR" }));
  expect(asi.getByRole("alert").textContent).toMatch(/different abilities/);
  fireEvent.click(asi.getByRole("button", { name: "Increase DEX" }));
  expect(asi.queryByRole("alert")).toBeNull();
  expect(asi.getByRole("button", { name: "Increase INT" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(asi.getByRole("button", { name: "Decrease STR" }));
  expect(asi.getByRole("button", { name: "Decrease STR" }).hasAttribute("disabled")).toBe(true);
  expect(asi.getByRole("button", { name: "Increase INT" }).hasAttribute("disabled")).toBe(false);
});
