import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import type { BuilderSelection } from "../engine/builder.ts";
import { storedHitPoints } from "../engine/classes.ts";
import { loadEngine, type StrictEntity } from "../engine/engine.ts";
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

const region = (name: string) => screen.getByRole("region", { name: new RegExp(`^${name}`) });

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

// The left mark of a heading (ORC-340, docs/design/character-builder.md "Marks, not sentences"): "2 left" in yellow,
// "Remove 1" in red, and a check with "Done", in the heading text.
test("a selection heading: 2 left in yellow, Remove 1 in red, and Done when no pick is left", () => {
  const selection = (remaining: number) => ({ key: "languages", name: "Languages", remaining }) as BuilderSelection;
  const { rerender } = render(<Heading id="h" selection={selection(2)} />);
  // (jsdom drops the space at the end of an inline span; a browser reads "Languages, 2 left".)
  expect(screen.getByRole("heading", { name: /^Languages, ?2 left$/ })).toBeTruthy();
  expect(screen.getByText("2 left").dataset.tone).toBe("act");
  rerender(<Heading id="h" selection={selection(-1)} />);
  expect(screen.getByRole("heading").textContent).toBe("Languages,Remove 1");
  expect(screen.getByText("Remove 1").dataset.tone).toBe("failed");
  rerender(<Heading id="h" selection={selection(0)} />);
  expect(screen.getByRole("heading").textContent).toBe("Languages,Done");
  rerender(<Heading id="h" selection={selection(2)} mark={false} />);
  expect(screen.getByRole("heading").textContent).toBe("Languages");
});

test("a step with only picks to remove shows the red mark on the step rail, and its name says so", () => {
  // fighter-3-wizard-2's half-elf has one language too many, which is on the Proficiencies step.
  open(fighter3Wizard2(), "Proficiencies");
  const proficiencies = within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: "Proficiencies, remove 1 pick" });
  expect(within(proficiencies).getByText("Remove 1").dataset.tone).toBe("failed");
});
