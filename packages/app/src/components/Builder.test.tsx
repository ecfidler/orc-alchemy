// The frame of the builder (ORC-340, docs/design/character-builder.md "The step rail"): the step rail, the step
// title, Back and Next, the empty steps and the status toast. e2e/builder.spec.ts measures in a browser that a pick
// does not move a selection heading.
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { STEP_NAMES } from "../engine/builder.ts";
import { engine, loadEngine } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";
import { Builder, BuilderStatusToast, useBuilderStatus } from "./Builder.tsx";

beforeAll(() => loadEngine());
afterEach(cleanup);

const rail = () => within(screen.getByRole("navigation", { name: "Steps" }));
const builder = () => within(screen.getByRole("region", { name: "Builder" }));
const title = () => builder().getByRole("heading", { level: 2 });

/** A new character, a level 1 barbarian, in the builder at the step. */
function open(step?: string, sheetLink?: ReactElement) {
  useCharacter.getState().load("builder-frame", engine().emptyCharacter());
  render(<Builder step={step} sheetLink={sheetLink} />);
}

test("the rail has the ten steps in order, with the number of each, and the open step is current", () => {
  open("Class");
  const buttons = rail().getAllByRole("button");
  const shown = (b: HTMLElement) => `${b.querySelector(".ui-rail-number")?.textContent} ${b.querySelector(".ui-rail-label")?.firstChild?.textContent}`;
  expect(buttons.map(shown)).toEqual(STEP_NAMES.map((name, i) => `${i + 1} ${name}`));
  expect(
    rail()
      .getByRole("button", { name: /^Class/ })
      .getAttribute("aria-current"),
  ).toBe("step");
  expect(buttons.filter((b) => b.hasAttribute("aria-current"))).toHaveLength(1);
  // The title of the step is an h2, with its place in the ten at its right.
  expect(title().textContent).toBe("Class");
  expect(builder().getByText("Step 2 of 10")).toBeTruthy();
});

test("the name of a step button has its count of picks left", () => {
  open();
  // A barbarian picks 2 skills, on the Proficiencies step, and has no feat to pick.
  expect(rail().getByRole("button", { name: "Proficiencies, 2 picks left" })).toBeTruthy();
  expect(rail().getByRole("button", { name: "Race, 1 pick left" })).toBeTruthy();
  expect(rail().getByRole("button", { name: "Feats" })).toBeTruthy();
});

test("there is no list of the picks still to make", () => {
  open();
  expect(screen.queryByRole("region", { name: "Still to do" })).toBeNull();
  expect(screen.queryByText("Every choice is made.")).toBeNull();
  expect(screen.queryByText(/more '.*' selection/)).toBeNull();
});

test("Next names the step that follows, Back goes back, and the focus goes to the step title after each", () => {
  open("Name");
  // The Name step has no Back.
  expect(builder().queryByRole("button", { name: "Back" })).toBeNull();
  fireEvent.click(builder().getByRole("button", { name: "Next: Class" }));
  expect(title().textContent).toBe("Class");
  expect(document.activeElement).toBe(title());
  expect(
    rail()
      .getByRole("button", { name: /^Class/ })
      .getAttribute("aria-current"),
  ).toBe("step");
  fireEvent.click(builder().getByRole("button", { name: "Next: Background" }));
  expect(title().textContent).toBe("Background");
  expect(document.activeElement).toBe(title());
  fireEvent.click(builder().getByRole("button", { name: "Back" }));
  expect(title().textContent).toBe("Class");
  expect(document.activeElement).toBe(title());
  // A click on the rail keeps the focus on the rail.
  const feats = rail().getByRole("button", { name: /^Feats/ });
  feats.focus();
  fireEvent.click(feats);
  expect(title().textContent).toBe("Feats");
  expect(document.activeElement).toBe(feats);
});

test("the Description step has Go to the sheet in the place of Next", () => {
  open("Description", <a href="/sheet/builder-frame" />);
  expect(builder().queryByRole("button", { name: /^Next/ })).toBeNull();
  expect(builder().getByRole("link", { name: "Go to the sheet" }).getAttribute("href")).toBe("/sheet/builder-frame");
  expect(builder().getByRole("button", { name: "Back" })).toBeTruthy();
});

test("a step with nothing to pick is dimmed in the rail, still opens, and shows one line", () => {
  open();
  const feats = rail().getByRole("button", { name: "Feats" });
  expect(feats.hasAttribute("data-dimmed")).toBe(true);
  expect(
    rail()
      .getByRole("button", { name: /^Class/ })
      .hasAttribute("data-dimmed"),
  ).toBe(false);
  fireEvent.click(feats);
  expect(title().textContent).toBe("Feats");
  expect(builder().getByText("This character has no feat to pick.")).toBeTruthy();
  // The feat cards do not show.
  expect(builder().queryByRole("group", { name: "Feats" })).toBeNull();
});

test("a selection heading has its left mark, and a pick changes it", () => {
  open("Race");
  const race = builder().getByRole("region", { name: /^Race/ });
  expect(within(race).getAllByRole("heading")[0].textContent).toBe("Race,1 left");
  fireEvent.click(within(race).getByRole("button", { name: "Human" }));
  expect(within(builder().getByRole("region", { name: /^Race/ })).getAllByRole("heading")[0].textContent).toBe("Race,Done");
});

test("a part in the builder's status toast shows a text in it; outside it the function does nothing", () => {
  let say: (text: string) => void = () => {};
  function Speaker() {
    say = useBuilderStatus();
    return null;
  }
  const status = () => document.querySelector("[data-toast-status]")?.textContent ?? "";
  render(<Speaker />);
  act(() => say("Nothing"));
  expect(status()).toBe("");
  cleanup();
  render(
    <BuilderStatusToast>
      <Speaker />
    </BuilderStatusToast>,
  );
  act(() => say("Fire Bolt is picked."));
  expect(status()).toBe("Fire Bolt is picked.");
});

test("the builder page has the status toast", () => {
  open();
  expect(document.querySelector("[data-toast-status]")).toBeTruthy();
});
