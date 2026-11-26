// The frame of the builder (ORC-340, docs/design/character-builder.md "The step rail"): the step rail, the step
// title, Back and Next, the empty steps and the status toast. The summary card and the full sheet panel are ORC-341
// ("The summary card"). e2e/builder.spec.ts measures in a browser that a pick does not move a selection heading or a
// line of the card.
import "fake-indexeddb/auto";
import { pickOption } from "@orc-alchemy/ui/testing";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { STEP_NAMES } from "../engine/builder.ts";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { newCharacter } from "../engine/new-character.ts";
import { useCharacter } from "../state/character.ts";
import { Builder, BuilderStatusToast, useBuilderStatus } from "./Builder.tsx";
import { closeSheetPanel, openSheetPanel, summaryCard } from "./test-sheet-panel.ts";

beforeAll(() => loadEngine());
afterEach(cleanup);

const rail = () => within(screen.getByRole("navigation", { name: "Steps" }));
const builder = () => within(screen.getByRole("region", { name: "Builder" }));
const title = () => builder().getByRole("heading", { level: 2 });

/** A new character, a level 1 barbarian, or `entity`, in the builder at the step. */
function open(step?: string, sheetLink?: ReactElement, entity: StrictEntity = engine().emptyCharacter() as StrictEntity) {
  useCharacter.getState().load("builder-frame", entity);
  render(<Builder step={step} sheetLink={sheetLink} />);
}

/** The value of each line of the summary card, by its label, and the six abilities. */
function cardLines() {
  const card = summaryCard();
  const lines = within(card)
    .getAllByRole("term")
    .map((term) => [term.textContent, card.querySelector(`[aria-labelledby="${term.id}"]`)?.textContent]);
  return Object.fromEntries(lines);
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

test("the summary card has the same lines on each step, with the values of the character", () => {
  open("Class");
  const before = cardLines();
  // emptyCharacter is a level 1 barbarian with no race and no background, and the standard scores.
  expect(before).toEqual({
    Name: "Unnamed character",
    Class: "Barbarian 1",
    Level: "1",
    Background: "",
    Race: "",
    "Hit points": "13",
    "Armor Class": "13",
    Speed: "",
    STR: "15 +2",
    DEX: "14 +2",
    CON: "13 +1",
    INT: "12 +1",
    WIS: "10 +0",
    CHA: "8 -1",
  });
  // The card has no control but the button below it.
  expect(
    within(summaryCard())
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Open the full sheet"]);
  fireEvent.click(rail().getByRole("button", { name: /^Race/ }));
  expect(cardLines()).toEqual(before);
  fireEvent.click(builder().getByRole("button", { name: "Dwarf" }));
  expect(cardLines()).toMatchObject({ Race: "Dwarf", Speed: "25 ft.", "Hit points": "14", CON: "15 +2" });
});

test("a character with no class and no race shows in the card and in the full sheet panel with no error", async () => {
  // The app's new character: no class, no race.
  open("Class", undefined, newCharacter(engine()));
  // The class, the level and the hit points are empty.
  expect(cardLines()).toMatchObject({ Class: "", Level: "", Race: "", "Hit points": "", Speed: "", STR: "15 +2" });
  const panel = await openSheetPanel();
  expect(within(panel).getByRole("heading", { level: 1, name: "Unnamed character" })).toBeTruthy();
  expect(within(panel).getByLabelText("Class", { exact: true }).textContent).toBe("");
  // The Hit Points box shows no number, and the Hit dice box none.
  expect(within(panel).getByRole("group", { name: "Hit Points" }).textContent).toBe("");
  expect(within(panel).getByRole("group", { name: "Hit dice" }).textContent).toBe("");
  await closeSheetPanel();
});

test("the Class step of a new character shows 1 left in the rail and at its heading, and the first class can be added", async () => {
  open("Class", undefined, newCharacter(engine()));
  expect(rail().getByRole("button", { name: "Class, 1 pick left" })).toBeTruthy();
  const classes = builder().getByRole("region", { name: /^Class/ });
  expect(within(classes).getAllByRole("heading")[0].textContent).toBe("Class,1 left");
  // No class row: only the class to add. A wizard needs INT 13 as a multiclass, but not as the first class.
  expect(within(classes).queryByRole("combobox", { name: "Class 1" })).toBeNull();
  await pickOption(within(classes).getByRole("combobox", { name: "Add a class" }), "Wizard");
  fireEvent.click(within(classes).getByRole("button", { name: "Add class" }));
  expect(within(builder().getByRole("region", { name: /^Class/ })).getAllByRole("heading")[0].textContent).toBe("Class,Done");
  expect(cardLines()).toMatchObject({ Class: "Wizard 1", Level: "1", "Hit points": "7" });
  expect(rail().getByRole("button", { name: "Class" })).toBeTruthy();
});

test("without a step, the builder opens the first step with a mark, or Class when no step has one", () => {
  // The engine's barbarian has its class and no background.
  open();
  expect(title().textContent).toBe("Background");
  cleanup();
  // The new character has a mark on Class; Name never has one.
  open(undefined, undefined, newCharacter(engine()));
  expect(title().textContent).toBe("Class");
  cleanup();
  // A character with no pick to make: each step is done.
  open(undefined, undefined, engine().autofill(engine().emptyCharacter(), { seed: 7 }) as StrictEntity);
  expect(title().textContent).toBe("Class");
});

test("Open the full sheet opens the sheet in a panel with the focus in it, and Close and Escape give the focus back", async () => {
  open("Class");
  const opener = within(summaryCard()).getByRole("button", { name: "Open the full sheet" });
  opener.focus();
  const panel = await openSheetPanel();
  // The panel shows the sheet as the preview: no play control.
  expect(within(panel).getByLabelText("Class", { exact: true }).textContent).toBe("Barbarian 1");
  expect(within(panel).queryByRole("button", { name: /Hit points/i })).toBeNull();
  await waitFor(() => expect(panel.contains(document.activeElement)).toBe(true));
  await closeSheetPanel();
  await waitFor(() => expect(document.activeElement).toBe(opener));

  // The Sheet button between Back and Next (only under 720px in a browser) opens the same panel. Escape closes it.
  const sheet = builder().getByRole("button", { name: "Sheet" });
  sheet.focus();
  fireEvent.click(sheet);
  const again = await screen.findByRole("dialog", { name: "Sheet" });
  await waitFor(() => expect(again.contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(again, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(sheet));
});

test("the Sheet button is between Back and Next", () => {
  open("Class");
  const row = builder().getByRole("button", { name: "Back" }).parentElement!;
  expect(
    within(row)
      .getAllByRole("button")
      .map((b) => b.textContent),
  ).toEqual(["Back", "Sheet", "Next: Background"]);
});
