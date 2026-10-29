import { readFileSync } from "node:fs";
import { join } from "node:path";
import { answerConfirmDialog } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { storedHitPoints } from "../engine/classes.ts";
import type { BuilderSelection } from "../engine/builder.ts";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";
import { Heading } from "./Classes.tsx";

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

test("removing the first class asks first when the next class is above level 1", async () => {
  open(fighter3Wizard2(), "Class");
  fireEvent.click(screen.getByRole("button", { name: "Remove Fighter" }));
  expect(await answerConfirmDialog("Cancel")).toBe(
    "Remove Fighter? Wizard becomes the first class and returns to level 1, and its other levels and their choices are removed. This cannot be undone.",
  );
  expect(built().classes).toEqual(["fighter", "wizard"]);

  fireEvent.click(screen.getByRole("button", { name: "Remove Fighter" }));
  await answerConfirmDialog("Remove");
  await waitFor(() => expect(built().classes).toEqual(["wizard"]));
  expect(built().levels.wizard["class-level"]).toBe(1);
  expect(screen.getByRole("combobox", { name: "Class 1" })).toHaveTextContent("Wizard");
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
  // A press of Roll while it is pressed rolls again.
  vi.spyOn(Math, "random").mockReturnValue(0.99);
  fireEvent.click(hp.getByRole("button", { name: "Roll (1d6)" }));
  expect(storedHitPoints(useCharacter.getState().entity!, path)).toEqual({ method: "roll", value: 6 });
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  fireEvent.click(hp.getByRole("button", { name: "Roll (1d6)" }));
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

// The theme spec, "Stuck note": picks to make are a stuck note; too many picks are danger text, not a note.
test("a selection heading: a stuck note for picks to make, danger text for too many, and neither when done", () => {
  const selection = (remaining: number) => ({ key: "languages", name: "Languages", remaining }) as BuilderSelection;
  const { rerender } = render(<Heading id="h" selection={selection(2)} />);
  expect(screen.getByRole("note").textContent).toBe("2 to choose.");
  expect(screen.getByRole("heading").textContent).toBe("Languages");
  rerender(<Heading id="h" selection={selection(-1)} />);
  expect(screen.queryByRole("note")).toBeNull();
  const tooMany = screen.getByText("(1 too many)");
  expect(tooMany.className).toContain("text-danger");
  rerender(<Heading id="h" selection={selection(0)} />);
  expect(screen.queryByRole("note")).toBeNull();
  expect(screen.getByRole("heading").textContent).toBe("Languages");
});
