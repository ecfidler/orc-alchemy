import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { HitDiceAction, HitDie } from "../engine/hit-dice.ts";
import { HitDiceBox, HitDiceRow, rollProblem } from "./HitDiceBox.tsx";

afterEach(cleanup);

const multiclass: HitDie[] = [
  { die: 10, total: 3, left: 1 },
  { die: 8, total: 7, left: 0 },
  { die: 6, total: 1, left: 1 },
];

const box = () => screen.getByRole("button", { name: /^Hit dice, / });

/** Opens the popup from the box, with the focus on the box first as after a Tab, and returns the popup. */
async function openPopup() {
  box().focus();
  fireEvent.click(box());
  const popup = await screen.findByRole("dialog", { name: "Hit dice" });
  await waitFor(() => expect(document.activeElement).toBe(within(popup).getAllByRole("textbox", { name: "Roll" })[0]));
  return popup;
}

const rowOf = (popup: HTMLElement, die: string) => within(within(popup).getByRole("group", { name: die }));

test("the box is a button named by the dice left of each die size: 'Hit dice, 3 of 5 d10'", () => {
  render(<HitDiceBox dice={[{ die: 10, total: 5, left: 3 }]} onAction={vi.fn()} />);
  expect(box().getAttribute("aria-label")).toBe("Hit dice, 3 of 5 d10");
  expect(box().textContent).toBe("3 / 5d10");
  cleanup();
  render(<HitDiceBox dice={multiclass} onAction={vi.fn()} />);
  expect(box().getAttribute("aria-label")).toBe("Hit dice, 1 of 3 d10, 0 of 7 d8, 1 of 1 d6");
  expect(box().textContent).toBe("1 / 3d100 / 7d81 / 1d6");
});

test("without onAction, as in the builder preview, the box is not a button and shows the dice", () => {
  render(<HitDiceBox dice={multiclass} />);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByRole("group", { name: "Hit dice" }).textContent).toBe("1 / 3d100 / 7d81 / 1d6");
});

test("the popup has one row for each die size; Spend takes the roll and closes the popup; the focus goes back to the box", async () => {
  const onAction = vi.fn<(action: HitDiceAction) => void>();
  render(<HitDiceBox dice={multiclass} onAction={onAction} />);
  const popup = await openPopup();
  expect(
    within(popup)
      .getAllByRole("group")
      .map((group) => group.textContent?.match(/^d\d+/)?.[0]),
  ).toEqual(["d10", "d8", "d6"]);
  const d10 = rowOf(popup, "d10");
  fireEvent.change(d10.getByRole("textbox", { name: "Roll" }), { target: { value: "7" } });
  fireEvent.click(d10.getByRole("button", { name: "Spend" }));
  expect(onAction.mock.calls).toEqual([[{ kind: "spend", die: 10, roll: 7 }]]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(box()));
});

test("Roll for me rolls the die with the random source; Regain gives a die back", async () => {
  const onAction = vi.fn<(action: HitDiceAction) => void>();
  render(<HitDiceBox dice={multiclass} onAction={onAction} random={() => 0.5} />);
  let popup = await openPopup();
  fireEvent.click(rowOf(popup, "d6").getByRole("button", { name: "Roll for me" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  popup = await openPopup();
  fireEvent.click(rowOf(popup, "d8").getByRole("button", { name: "Regain" }));
  expect(onAction.mock.calls).toEqual([[{ kind: "spend", die: 6, roll: 4 }], [{ kind: "regain", die: 8 }]]);
});

test("Spend and Roll for me are disabled with no die of the size left, and Regain with none spent", async () => {
  render(<HitDiceBox dice={multiclass} onAction={vi.fn()} />);
  const popup = await openPopup();
  const disabled = (die: string) =>
    ["Spend", "Roll for me", "Regain"].map((name) => (rowOf(popup, die).getByRole("button", { name }) as HTMLButtonElement).disabled);
  expect(disabled("d10")).toEqual([false, false, false]);
  expect(disabled("d8")).toEqual([true, true, false]);
  expect(disabled("d6")).toEqual([false, false, true]);
});

test("an empty field or a roll outside 1 to the die size keeps the popup open with a note; a change of the field clears it", async () => {
  const onAction = vi.fn();
  render(<HitDiceBox dice={multiclass} onAction={onAction} />);
  const popup = await openPopup();
  const d10 = rowOf(popup, "d10");
  const note = () => within(popup).getByRole("status").textContent;
  fireEvent.click(d10.getByRole("button", { name: "Spend" }));
  expect(note()).toBe(rollProblem(10));
  expect(rollProblem(10)).toBe("Type a roll from 1 to 10 for the d10.");
  for (const value of ["0", "11"]) {
    fireEvent.change(d10.getByRole("textbox", { name: "Roll" }), { target: { value } });
    expect(note()).toBe("");
    fireEvent.click(d10.getByRole("button", { name: "Spend" }));
    expect(note()).toBe(rollProblem(10));
  }
  expect(onAction).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("Enter in a Roll field does Spend of that row", async () => {
  const onAction = vi.fn<(action: HitDiceAction) => void>();
  render(<HitDiceBox dice={multiclass} onAction={onAction} />);
  const popup = await openPopup();
  const field = rowOf(popup, "d6").getByRole("textbox", { name: "Roll" });
  fireEvent.change(field, { target: { value: "5" } });
  fireEvent.keyDown(field, { key: "Enter" });
  expect(onAction.mock.calls).toEqual([[{ kind: "spend", die: 6, roll: 5 }]]);
});

test("HitDiceRow without onRegain has no Regain, as in the Short rest dialog; disabled keeps the Roll field, Spend and Roll for me disabled", () => {
  const onSpend = vi.fn();
  render(<HitDiceRow hitDie={{ die: 8, total: 4, left: 2 }} onSpend={onSpend} onProblem={vi.fn()} disabled />);
  expect(screen.getAllByRole("button").map((b) => [b.textContent, (b as HTMLButtonElement).disabled])).toEqual([
    ["Spend", true],
    ["Roll for me", true],
  ]);
  expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Roll" }).disabled).toBe(true);
  fireEvent.change(screen.getByRole("textbox", { name: "Roll" }), { target: { value: "3" } });
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Roll" }), { key: "Enter" });
  expect(onSpend).not.toHaveBeenCalled();
});
