import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { AMOUNT_NOTE, AmountField, NoteSpace, useAmount } from "./AmountField.tsx";
import { Button } from "./Button.tsx";

afterEach(cleanup);

/** A form with an amount field and its note, as a popup has it. */
function Form({ showLabel, initial = null, onAct }: { showLabel?: boolean; initial?: number | null; onAct: (n: number) => void }) {
  const amount = useAmount(initial);
  return (
    <>
      <AmountField amount={amount} showLabel={showLabel} className="w-20" />
      <Button onClick={() => amount.submit(onAct)}>Go</Button>
      <NoteSpace note={amount.note} />
    </>
  );
}

const field = () => screen.getByRole<HTMLInputElement>("textbox", { name: "Amount" });
const note = () => screen.getByRole("status");

test("the field has a visible label Amount by default, or only the name without one", () => {
  render(<Form onAct={() => {}} />);
  expect(field().closest("label")?.textContent).toBe("Amount");
  cleanup();
  render(<Form showLabel={false} onAct={() => {}} />);
  expect([field().closest("label"), field().getAttribute("aria-label")]).toEqual([null, "Amount"]);
});

test("submit gives a number of 0 or more; with no number the note shows, and a change removes it", () => {
  const act = vi.fn();
  render(<Form onAct={act} />);
  expect(note().textContent).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Go" }));
  expect([note().textContent, act.mock.calls.length]).toEqual([AMOUNT_NOTE, 0]);
  fireEvent.change(field(), { target: { value: "-2" } });
  expect(note().textContent).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Go" }));
  expect([note().textContent, act.mock.calls.length]).toEqual([AMOUNT_NOTE, 0]);
  fireEvent.change(field(), { target: { value: "0" } });
  fireEvent.click(screen.getByRole("button", { name: "Go" }));
  expect(act.mock.calls).toEqual([[0]]);
  expect(note().textContent).toBe("");
});

test("the field starts with the initial amount, and its text is selected at the focus", () => {
  render(<Form initial={12} onAct={() => {}} />);
  expect(field().value).toBe("12");
  fireEvent.focus(field());
  expect([field().selectionStart, field().selectionEnd]).toEqual([0, 2]);
});

test("the note space is there with no note, so that its height is kept", () => {
  const { container } = render(<NoteSpace note={null} />);
  expect(container.querySelector(".ui-note-space[role=status]")?.childElementCount).toBe(0);
});
